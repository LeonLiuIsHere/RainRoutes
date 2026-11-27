import { ClientState } from '../model/ClientState.js';
import { RemoteData, OUTCOME, ROUTE_STATUS } from '../model/RemoteData.js';

/**
 * Main controller connecting the UI views and data models (architecture §2.2).
 *
 * It handles every user action, asks RemoteData for server data, stores the
 * results in ClientState and tells the views what to display. It never
 * decides whether a door is usable or which route is best; the server does.
 *
 * The controller talks to the views through two small interfaces, so that it
 * does not depend on how each view is built (main.js connects them):
 *
 * @typedef {Object} UiPort
 * @property {(places: ReadonlyArray<Object>, form: Object) => void} renderHome
 *     Show the route form with these selectable places and these values.
 * @property {(errors: ReadonlyArray<{field: string, problem: string}>) => void} showFieldErrors
 *     Show each error next to its input; an empty list clears all errors.
 * @property {(mapData: Object, places: ReadonlyArray<Object>) => void} renderMap
 *     Draw the background, building outlines and selectable places.
 * @property {(result: Object, query: Object, onSelectOption: (kind: string) => void) => void} renderRoutes
 *     Show the comparison cards for a route result (also "no route" and
 *     "incomplete" results), labelled with the query they answer.
 * @property {(option: Object, onSelectStep: (index: number) => void) => void} renderRouteDetail
 *     Show the step cards of the selected option.
 * @property {(segments: ReadonlyArray<Object>, highlightedEdgeIds: ReadonlyArray<string>) => void} highlightRoute
 *     Draw the route on the map and emphasize the given edges.
 * @property {() => void} clearRoutes
 *     Remove any route, comparison and step cards from the page.
 * @property {(busy: boolean) => void} setBusy
 *     Show or hide that a route search is running.
 * @property {(handler: (form: Object) => void) => void} onSearch
 *     Register the handler for "Find routes"; form has origin, destination,
 *     departure and maxExtraMinutes.
 * @property {(handler: (placeId: string) => void) => void} [onPlaceClick]
 *     Optional: register the handler for clicks on a place on the map.
 *
 * @typedef {Object} MessagePort  Implemented by MessageView.
 * @property {(message: string) => void} showLoading
 * @property {(message: string, options?: {retry?: boolean}) => void} showError
 * @property {(message: string) => void} showInfo
 * @property {() => void} hide
 * @property {(version: string) => void} setDataVersion
 * @property {(handler: () => void) => void} bindRetry
 */

/** User-facing text shown by the controller. */
export const TEXT = Object.freeze({
    LOADING_MAP: 'Loading map…',
    SEARCHING: 'Searching for routes…',
    SERVICE_ERROR: 'Service error, please retry.',
    INCOMPLETE: 'Search incomplete. These are the best routes found so far.',
    DATA_UPDATED: 'The map data was updated. Please check your origin and destination, then search again.',
});

export class ClientController {
    #state;
    #remote;
    #ui;
    #messages;
    /** What Retry repeats: the last action that failed with a service error. */
    #retryAction = null;
    /** True once a route query has been re-sent after a data version change. */
    #resentAfterVersionChange = false;

    /**
     * Initializes the client controller.
     * @precondition ui implements UiPort and messages implements MessagePort;
     *   state and remoteData, if given, are a ClientState and a RemoteData
     * @postcondition the controller is created and listens to "Find routes",
     *   place clicks (if the UI supports them) and Retry; nothing is fetched yet
     * @param {{ui: UiPort, messages: MessagePort, state?: ClientState, remoteData?: RemoteData}} deps
     */
    constructor({ ui, messages, state = new ClientState(), remoteData = new RemoteData() }) {
        if (ui === undefined || messages === undefined) {
            throw new TypeError('ClientController needs ui and messages');
        }
        this.#ui = ui;
        this.#messages = messages;
        this.#state = state;
        this.#remote = remoteData;

        this.#ui.onSearch((form) => this.handleSearchRoutes(form));
        if (typeof this.#ui.onPlaceClick === 'function') {
            this.#ui.onPlaceClick((placeId) => this.handlePlaceClick(placeId));
        }
        this.#messages.bindRetry(() => this.retry());
    }

    /**
     * Initializes the application on startup.
     * @precondition the views can be drawn (DOM is loaded)
     * @postcondition resolves to true after the map, places, form and data
     *   version are displayed; resolves to false after showing a service error
     *   with Retry. Never rejects.
     * @returns {Promise<boolean>}
     */
    async init() {
        this.#retryAction = () => this.init();
        this.#messages.showLoading(TEXT.LOADING_MAP);
        const loaded = await this.#loadMapAndMeta();
        if (loaded === null) {
            return false;
        }
        this.#messages.hide();
        return true;
    }

    /**
     * Handles the route search action triggered by the user.
     * @precondition form holds the form values (fields that are undefined keep
     *   their current value)
     * @postcondition if the form is invalid, the field errors are shown and no
     *   request is sent; otherwise the previous result is cleared, a request is
     *   sent, and when it finishes exactly one of these is shown: the route
     *   result, the server's field errors, or a service error with Retry.
     *   A response for an older query is never shown. Never rejects.
     * @param {{origin?: string|null, destination?: string|null,
     *          departure?: string|null, maxExtraMinutes?: number|string|null}} form
     * @returns {Promise<void>}
     */
    async handleSearchRoutes(form) {
        this.#state.applyForm(form);
        const errors = this.#state.validateForm();
        this.#ui.showFieldErrors(errors);
        if (errors.length > 0) {
            return;
        }
        this.#resentAfterVersionChange = false;
        await this.#search();
    }

    /**
     * Handles the user choosing a route option.
     * @precondition the current result has an option of this kind
     * @postcondition that option's steps are shown and its route is drawn
     * @param {string} kind
     */
    handleSelectOption(kind) {
        this.#state.selectOption(kind);
        this.#showSelectedOption();
    }

    /**
     * Handles the user choosing a step of the selected option.
     * @precondition an option is selected and index is a valid step index
     * @postcondition the step's edges are highlighted on the map
     * @param {number} index
     */
    handleSelectStep(index) {
        this.#state.selectStep(index);
        const option = this.#state.getSelectedOption();
        this.#ui.highlightRoute(option.segments, this.#state.getSelectedStep().edgeIds);
    }

    /**
     * Handles a click on a selectable place on the map: the first click sets
     * the origin, later clicks set the destination.
     * @precondition none
     * @postcondition if placeId is a selectable place, it becomes the origin
     *   (if none is set) or otherwise the destination, and the form is redrawn;
     *   unknown ids are ignored
     * @param {string} placeId
     */
    handlePlaceClick(placeId) {
        if (this.#state.getPlace(placeId) === null) {
            return;
        }
        if (this.#state.getOrigin() === null) {
            this.#state.setOrigin(placeId);
        } else {
            this.#state.setDestination(placeId);
        }
        this.#ui.showFieldErrors([]);
        this.#ui.renderHome(this.#state.getPlaces(), this.#state.getForm());
    }

    /**
     * Repeats the last action that failed with a service error.
     * @precondition none
     * @postcondition the failed action is run again; does nothing if there is none
     * @returns {Promise<void>}
     */
    async retry() {
        const action = this.#retryAction;
        if (action !== null) {
            this.#messages.hide();
            await action();
        }
    }

    // ---------------------------------------------------------------- private

    /**
     * Sends the current form as a route query and shows the outcome.
     */
    async #search() {
        const request = this.#state.toRouteRequest();
        this.#retryAction = () => this.#search();

        this.#state.clearRouteResult();
        this.#ui.clearRoutes();
        this.#ui.setBusy(true);
        this.#messages.showLoading(TEXT.SEARCHING);

        const outcome = await this.#remote.fetchRoutes(request);
        if (outcome.kind === OUTCOME.STALE) {
            return; // a newer query owns the page now
        }
        this.#ui.setBusy(false);

        switch (outcome.kind) {
        case OUTCOME.VALIDATION:
            this.#messages.hide();
            this.#ui.showFieldErrors(outcome.fields);
            return;
        case OUTCOME.SERVICE:
            this.#messages.showError(TEXT.SERVICE_ERROR, { retry: true });
            return;
        case OUTCOME.OK:
            break;
        default:
            this.#messages.showError(TEXT.SERVICE_ERROR, { retry: true });
            return;
        }

        const result = outcome.data;
        if (result.dataVersion !== this.#state.getDataVersion()) {
            await this.#handleDataVersionChange();
            return;
        }

        this.#state.setRouteResult(result, request);
        if (result.status === ROUTE_STATUS.INCOMPLETE) {
            this.#messages.showInfo(TEXT.INCOMPLETE);
        } else {
            this.#messages.hide();
        }
        this.#ui.renderRoutes(result, this.#state.getRouteQuery(), (kind) => this.handleSelectOption(kind));
        this.#showSelectedOption();
    }

    /**
     * The server answered with a different data version than the map on screen,
     * so the server was restarted with new data. Reload the map first, so the
     * map and the route always come from the same version. Re-send the query
     * once if its places still exist; otherwise ask the user to check the form.
     */
    async #handleDataVersionChange() {
        this.#messages.showLoading(TEXT.LOADING_MAP);
        const loaded = await this.#loadMapAndMeta();
        if (loaded === null) {
            return;
        }
        const formStillValid = loaded.cleared.length === 0 && this.#state.validateForm().length === 0;
        if (this.#resentAfterVersionChange || !formStillValid) {
            this.#ui.showFieldErrors(this.#state.validateForm());
            this.#messages.showInfo(TEXT.DATA_UPDATED);
            return;
        }
        this.#resentAfterVersionChange = true;
        await this.#search();
    }

    /**
     * Fetches meta and map data, stores them and redraws the map and form.
     * @returns {Promise<{cleared: string[]}|null>} null after showing a service error
     */
    async #loadMapAndMeta() {
        for (let attempt = 0; attempt < 2; attempt++) {
            const [meta, map] = await Promise.all([this.#remote.fetchMetadata(), this.#remote.fetchMapData()]);
            if (meta.kind !== OUTCOME.OK || map.kind !== OUTCOME.OK) {
                this.#retryAction = () => this.init();
                this.#messages.showError(TEXT.SERVICE_ERROR, { retry: true });
                return null;
            }
            if (meta.data.dataVersion !== map.data.dataVersion) {
                continue; // the data changed between the two requests; fetch both again
            }

            const places = map.data.places.length > 0 ? map.data.places : meta.data.places;
            const cleared = this.#state.setPlaces(places);
            this.#state.setMapData({ map: map.data.map, buildings: map.data.buildings });
            this.#state.setDataVersion(map.data.dataVersion);

            this.#messages.setDataVersion(map.data.dataVersion);
            this.#ui.renderMap(this.#state.getMapData(), this.#state.getPlaces());
            this.#ui.renderHome(this.#state.getPlaces(), this.#state.getForm());
            return { cleared };
        }
        this.#retryAction = () => this.init();
        this.#messages.showError(TEXT.SERVICE_ERROR, { retry: true });
        return null;
    }

    #showSelectedOption() {
        const option = this.#state.getSelectedOption();
        if (option === null) {
            return;
        }
        this.#ui.renderRouteDetail(option, (index) => this.handleSelectStep(index));
        this.#ui.highlightRoute(option.segments, []);
    }
}

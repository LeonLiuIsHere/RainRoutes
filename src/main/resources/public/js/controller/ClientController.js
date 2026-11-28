import { ClientState } from '../model/ClientState.js';
import { RemoteData, OUTCOME, ROUTE_STATUS } from '../model/RemoteData.js';

/**
 * Main controller connecting the UI views and data models (architecture §2.2).
 *
 * It handles every user action, asks RemoteData for server data, stores the
 * results in ClientState and tells the views what to display. It never
 * decides whether a door is usable or which route is best; the server does.
 *
 * The panel has two screens: "plan" (form and route comparison) and "detail"
 * (steps of one option). Choosing an option opens "detail"; Back returns to "plan".
 *
 * The controller talks to the views through two interfaces, so that it does
 * not depend on how each view is built; main.js connects them to the views.
 *
 * @typedef {Object} UiPort
 * @property {(places: ReadonlyArray<Object>, form: Object) => void} renderHome
 *     Offer these places in the form and show these form values.
 * @property {(endpoints: {origin: string|null, destination: string|null}) => void} showSelectedEndpoints
 *     Show the chosen origin and destination in the form and on the map.
 * @property {(errors: ReadonlyArray<{field: string, problem: string}>) => void} showFieldErrors
 *     Show each error next to its input; an empty list clears all errors.
 * @property {(mapData: Object, places: ReadonlyArray<Object>) => void} renderMap
 *     Draw the background, building outlines and selectable places.
 * @property {(result: Object, query: Object) => void} renderRoutes
 *     Show the comparison for a route result (including "no route" and
 *     "incomplete"), labelled with the query it answers.
 * @property {(kind: string|null) => void} setSelectedOption
 *     Mark this option card as selected.
 * @property {(option: Object) => void} renderRouteDetail
 *     Show the step cards of an option.
 * @property {(index: number|null) => void} setSelectedStep
 *     Mark this step as selected (null: none).
 * @property {(segments: ReadonlyArray<Object>) => void} drawRoute
 *     Draw these route segments on the map (empty: no route).
 * @property {(edgeIds: ReadonlyArray<string>) => void} highlightEdges
 *     Emphasize these edges of the drawn route (empty: none).
 * @property {() => void} clearRoutes
 *     Remove the route, comparison and steps from the page.
 * @property {(screen: 'plan'|'detail') => void} showScreen
 *     Switch the panel to this screen.
 * @property {(busy: boolean) => void} setBusy
 *     Show or hide that a route search is running.
 * @property {(handler: (form: Object) => void) => void} onSearch
 *     "Find routes"; form has origin, destination, departure, maxExtraMinutes.
 * @property {(handler: (form: Object) => void) => void} onFormChange
 *     Any change to the form, with the same fields as onSearch.
 * @property {(handler: (placeId: string) => void) => void} onPlaceClick
 * @property {(handler: (kind: string) => void) => void} onSelectOption
 * @property {(handler: (index: number) => void) => void} onSelectStep
 * @property {(handler: () => void) => void} onBack
 *     Back from the detail screen.
 * @property {(handler: () => void) => void} onEditTrip
 *     "Edit trip" from the comparison (also offered when there is no route).
 *
 * @typedef {Object} MessagePort  Implemented by MessageView.
 * @property {(message: string) => void} showLoading
 * @property {(message: string, options?: {retry?: boolean}) => void} showError
 * @property {(message: string) => void} showInfo
 * @property {() => void} hide
 * @property {(version: string) => void} setDataVersion
 * @property {(handler: () => void) => void} onRetry
 */

/** User-facing text shown by the controller. */
export const TEXT = Object.freeze({
    LOADING_MAP: 'Loading map…',
    SEARCHING: 'Searching for routes…',
    SERVICE_ERROR: 'Service error, please retry.',
    INCOMPLETE: 'Search incomplete. These are the best routes found so far.',
    DATA_UPDATED: 'The map data was updated. Please check your origin and destination, then search again.',
});

export const SCREEN = Object.freeze({ PLAN: 'plan', DETAIL: 'detail' });

export class ClientController {
    #state;
    #remote;
    #ui;
    #messages;
    /** What Retry repeats: the last action that failed with a service error. */
    #retryAction = null;
    /** True once a route query has been re-sent after a data version change. */
    #resentAfterVersionChange = false;
    /** True while a route request is waiting for its answer. */
    #searching = false;

    /**
     * Initializes the client controller.
     * @precondition ui implements UiPort and messages implements MessagePort;
     *   state and remoteData, if given, are a ClientState and a RemoteData
     * @postcondition the controller is created and has registered a handler
     *   for every user action; nothing is fetched yet
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

        ui.onSearch((form) => this.handleSearchRoutes(form));
        ui.onFormChange((form) => this.handleFormChange(form));
        ui.onPlaceClick((placeId) => this.handlePlaceClick(placeId));
        ui.onSelectOption((kind) => this.handleSelectOption(kind));
        ui.onSelectStep((index) => this.handleSelectStep(index));
        ui.onBack(() => this.handleBack());
        ui.onEditTrip(() => this.handleEditTrip());
        messages.onRetry(() => this.retry());
    }

    /**
     * Initializes the application on startup.
     * @precondition the views can be drawn (DOM is loaded)
     * @postcondition resolves to true after the map, places, form and data
     *   version are displayed on the plan screen; resolves to false after
     *   showing a service error with Retry. Never rejects.
     * @returns {Promise<boolean>}
     */
    async init() {
        this.#retryAction = () => this.init();
        this.#ui.showScreen(SCREEN.PLAN);
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
     *   sent, and when it finishes exactly one of these is shown on the plan
     *   screen: the route result (fastest option selected and drawn), the
     *   server's field errors, or a service error with Retry. A response for an
     *   older query is never shown. Never rejects.
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
     * Handles any change to the form. A search that is still running is
     * abandoned, so its answer can never be shown for the changed trip.
     * @precondition form holds the form values (undefined fields are kept)
     * @postcondition the state holds the new values, the endpoints are shown
     *   on the map, and no search is running
     * @param {Object} form
     */
    handleFormChange(form) {
        this.#state.applyForm(form);
        this.#endpointsChanged();
    }

    /**
     * Handles a click on a selectable place on the map.
     * @precondition none
     * @postcondition if there is no origin, the place becomes the origin; else if
     *   there is no destination and the place is not the origin, it becomes the
     *   destination; otherwise the trip starts over with the place as origin and
     *   no destination. The form and map show the endpoints and no search is
     *   running. Unknown ids are ignored.
     * @param {string} placeId
     */
    handlePlaceClick(placeId) {
        if (this.#state.getPlace(placeId) === null) {
            return;
        }
        const origin = this.#state.getOrigin();
        if (origin === null) {
            this.#state.setOrigin(placeId);
        } else if (this.#state.getDestination() === null && placeId !== origin) {
            this.#state.setDestination(placeId);
        } else {
            this.#state.setOrigin(placeId);
            this.#state.setDestination(null);
        }
        this.#ui.showFieldErrors([]);
        this.#endpointsChanged();
    }

    /**
     * Handles the user choosing a route option card.
     * @precondition the current result has an option of this kind
     * @postcondition the option is selected and drawn, and its steps are shown
     *   on the detail screen with no step selected
     * @param {string} kind
     */
    handleSelectOption(kind) {
        this.#state.selectOption(kind);
        const option = this.#state.getSelectedOption();
        this.#ui.setSelectedOption(kind);
        this.#ui.drawRoute(option.segments);
        this.#ui.highlightEdges([]);
        this.#ui.renderRouteDetail(option);
        this.#ui.setSelectedStep(null);
        this.#ui.showScreen(SCREEN.DETAIL);
    }

    /**
     * Handles the user choosing a step of the selected option.
     * @precondition an option is selected and index is a valid step index
     * @postcondition the step is marked and its edges are highlighted on the map
     * @param {number} index
     */
    handleSelectStep(index) {
        this.#state.selectStep(index);
        this.#ui.setSelectedStep(index);
        this.#ui.highlightEdges(this.#state.getSelectedStep().edgeIds);
    }

    /**
     * Handles Back on the detail screen.
     * @precondition none
     * @postcondition the plan screen is shown; the selected option stays
     *   selected and drawn, and no step is highlighted
     */
    handleBack() {
        if (this.#state.getSelectedOption() !== null) {
            this.#state.selectStep(null);
        }
        this.#ui.setSelectedStep(null);
        this.#ui.highlightEdges([]);
        this.#ui.showScreen(SCREEN.PLAN);
    }

    /**
     * Handles "Change trip" (offered when there is no route).
     * @precondition none
     * @postcondition the route result and field errors are removed from the
     *   page, any running search is abandoned, the form keeps its values, and
     *   the plan screen is shown
     */
    handleEditTrip() {
        this.#cancelSearch();
        this.#state.clearRouteResult();
        this.#ui.clearRoutes();
        this.#ui.showFieldErrors([]);
        this.#ui.showScreen(SCREEN.PLAN);
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

    #endpointsChanged() {
        this.#cancelSearch();
        this.#ui.showSelectedEndpoints({
            origin: this.#state.getOrigin(),
            destination: this.#state.getDestination(),
        });
    }

    /** Abandons a running search; its answer will arrive as stale and be ignored. */
    #cancelSearch() {
        if (!this.#searching) {
            return;
        }
        this.#searching = false;
        this.#remote.cancelRoutes();
        this.#ui.setBusy(false);
        this.#messages.hide();
    }

    /**
     * Sends the current form as a route query and shows the outcome.
     */
    async #search() {
        const request = this.#state.toRouteRequest();
        this.#retryAction = () => this.#search();

        this.#state.clearRouteResult();
        this.#ui.clearRoutes();
        this.#ui.showScreen(SCREEN.PLAN);
        this.#ui.setBusy(true);
        this.#messages.showLoading(TEXT.SEARCHING);
        this.#searching = true;

        const outcome = await this.#remote.fetchRoutes(request);
        if (outcome.kind === OUTCOME.STALE) {
            return; // a newer query or a form change owns the page now
        }
        this.#searching = false;
        this.#ui.setBusy(false);

        switch (outcome.kind) {
        case OUTCOME.VALIDATION:
            this.#messages.hide();
            this.#ui.showFieldErrors(outcome.fields);
            return;
        case OUTCOME.OK:
            break;
        default: // OUTCOME.SERVICE, or anything unexpected
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
        this.#ui.renderRoutes(result, this.#state.getRouteQuery());
        const option = this.#state.getSelectedOption();
        this.#ui.setSelectedOption(option === null ? null : option.kind);
        this.#ui.drawRoute(option === null ? [] : option.segments);
        this.#ui.highlightEdges([]);
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
            this.#ui.showSelectedEndpoints({
                origin: this.#state.getOrigin(),
                destination: this.#state.getDestination(),
            });
            return { cleared };
        }
        this.#retryAction = () => this.init();
        this.#messages.showError(TEXT.SERVICE_ERROR, { retry: true });
        return null;
    }
}

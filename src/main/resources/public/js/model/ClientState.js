/**
 * Client-side state of the Rain Routes page.
 *
 * Only ClientController reads and updates a ClientState (architecture §2.3).
 * Server data stored here (places, map, route result) is deep-frozen, so the
 * getters can return it directly without exposing the representation.
 *
 * Abstraction function:
 *   AF(s) = the page as the user currently sees it, where
 *     - s.#places is the list of selectable places from data version s.#dataVersion,
 *     - s.#origin, s.#destination, s.#departure and s.#maxExtraMinutes are the
 *       form values the user last submitted or chose ('' departure means "now"),
 *     - s.#routeResult is the route result shown for the query s.#routeQuery
 *       (null if no result is shown),
 *     - s.#selectedKind and s.#selectedStepIndex are the option and step the
 *       user has selected in that result (null if none).
 *
 * Rep invariant:
 *   - #placesById has exactly the ids of #places, and the ids are unique
 *   - #dataVersion is null or a non-empty string
 *   - #origin and #destination are null or non-empty strings
 *   - #departure is a string (possibly empty)
 *   - #maxExtraMinutes is null or a number (NaN allowed until validated)
 *   - #routeResult is null iff #routeQuery is null
 *   - #selectedKind is null, or the kind of one option in #routeResult
 *   - #selectedStepIndex is null, or a valid step index of the selected option
 *     (and then #selectedKind is not null)
 */

/** Default maximum extra walking time offered in the form, in minutes. */
export const DEFAULT_MAX_EXTRA_MINUTES = 2;

/** Form field names; they match the field names in the server's validation errors. */
export const FIELD = Object.freeze({
    ORIGIN: 'origin',
    DESTINATION: 'destination',
    DEPARTURE: 'departure',
    MAX_EXTRA_MINUTES: 'maxExtraMinutes',
});

/** Machine-readable validation problems used on the client. */
export const PROBLEM = Object.freeze({
    MISSING: 'MISSING',
    UNKNOWN_PLACE: 'UNKNOWN_PLACE',
    IDENTICAL_ENDPOINTS: 'IDENTICAL_ENDPOINTS',
    INVALID_TIME: 'INVALID_TIME',
    NEGATIVE: 'NEGATIVE',
    NOT_FINITE: 'NOT_FINITE',
});

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Checks whether a string is a calendar-valid local date-time such as
 * "2026-11-05T09:50" (seconds optional). Time-zone rules such as daylight
 * saving gaps are checked by the server, not here.
 * @precondition none
 * @postcondition returns true iff text has the form YYYY-MM-DDTHH:mm[:ss]
 *   and names a real date and a time between 00:00 and 23:59:59
 * @param {unknown} text
 * @returns {boolean}
 */
export function isValidLocalDateTime(text) {
    if (typeof text !== 'string') {
        return false;
    }
    const match = LOCAL_DATE_TIME.exec(text);
    if (match === null) {
        return false;
    }
    const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
        return false;
    }
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day >= 1 && day <= daysInMonth;
}

/**
 * Returns a deep-frozen deep copy of a JSON-like value.
 * @precondition value contains only plain objects, arrays and primitives
 * @postcondition returns a copy that cannot be modified at any depth
 * @param {T} value
 * @returns {T}
 * @template T
 */
function frozenCopy(value) {
    const copy = structuredClone(value);
    const freeze = (v) => {
        if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
            Object.values(v).forEach(freeze);
            Object.freeze(v);
        }
        return v;
    };
    return freeze(copy);
}

/**
 * Normalizes an optional endpoint id: blank or missing becomes null.
 * @param {unknown} id
 * @returns {string|null}
 */
function normalizeId(id) {
    if (id === null || id === undefined) {
        return null;
    }
    const text = String(id).trim();
    return text === '' ? null : text;
}

export class ClientState {
    /** @type {ReadonlyArray<Object>} */
    #places = Object.freeze([]);
    /** @type {Map<string, Object>} */
    #placesById = new Map();
    /** @type {Object|null} */
    #mapData = null;
    /** @type {string|null} */
    #dataVersion = null;
    /** @type {string|null} */
    #origin = null;
    /** @type {string|null} */
    #destination = null;
    /** @type {string} */
    #departure = '';
    /** @type {number|null} */
    #maxExtraMinutes = DEFAULT_MAX_EXTRA_MINUTES;
    /** @type {Object|null} */
    #routeResult = null;
    /** @type {Object|null} */
    #routeQuery = null;
    /** @type {string|null} */
    #selectedKind = null;
    /** @type {number|null} */
    #selectedStepIndex = null;

    /**
     * Initializes a new instance of ClientState.
     * @precondition none
     * @postcondition a new state with no places, no data version, no route
     *   result, empty endpoints, departure "now" and the default extra time
     */
    constructor() {
        this.#checkRep();
    }

    // ---------------------------------------------------------------- data

    /**
     * @precondition none
     * @postcondition returns the data version last received, or null
     * @returns {string|null}
     */
    getDataVersion() {
        return this.#dataVersion;
    }

    /**
     * @precondition version is a non-empty string
     * @postcondition the stored data version is version
     * @param {string} version
     * @throws {TypeError} if version is not a non-empty string
     */
    setDataVersion(version) {
        if (typeof version !== 'string' || version === '') {
            throw new TypeError('dataVersion must be a non-empty string');
        }
        this.#dataVersion = version;
        this.#checkRep();
    }

    /**
     * Replaces the selectable places. Endpoints that are no longer selectable
     * are cleared, so the form never keeps an option that has become invalid.
     * @precondition places is an array of objects with a non-empty string id,
     *   and the ids are unique
     * @postcondition getPlaces() returns a frozen copy of places in the same
     *   order; origin and destination that are not among the new ids are set
     *   to null; returns the names of the fields that were cleared
     * @param {Array<{id: string, label: string, xNorm: number, yNorm: number}>} places
     * @returns {string[]} cleared field names (FIELD.ORIGIN and/or FIELD.DESTINATION)
     * @throws {TypeError} if places is not an array of objects with string ids
     * @throws {RangeError} if two places share an id
     */
    setPlaces(places) {
        if (!Array.isArray(places)) {
            throw new TypeError('places must be an array');
        }
        const byId = new Map();
        for (const place of places) {
            if (place === null || typeof place !== 'object'
                || typeof place.id !== 'string' || place.id === '') {
                throw new TypeError('every place needs a non-empty string id');
            }
            if (byId.has(place.id)) {
                throw new RangeError(`duplicate place id ${place.id}`);
            }
            byId.set(place.id, null);
        }
        this.#places = frozenCopy(places);
        this.#placesById = new Map(this.#places.map((p) => [p.id, p]));

        const cleared = [];
        if (this.#origin !== null && !this.#placesById.has(this.#origin)) {
            this.#origin = null;
            cleared.push(FIELD.ORIGIN);
        }
        if (this.#destination !== null && !this.#placesById.has(this.#destination)) {
            this.#destination = null;
            cleared.push(FIELD.DESTINATION);
        }
        this.#checkRep();
        return cleared;
    }

    /**
     * @precondition none
     * @postcondition returns the selectable places (frozen; do not modify)
     * @returns {ReadonlyArray<{id: string, label: string, xNorm: number, yNorm: number}>}
     */
    getPlaces() {
        return this.#places;
    }

    /**
     * @precondition none
     * @postcondition returns the place with this id (frozen), or null if there is none
     * @param {string} id
     * @returns {Object|null}
     */
    getPlace(id) {
        return this.#placesById.get(id) ?? null;
    }

    /**
     * @precondition mapData is a JSON-like object (map image and building outlines)
     * @postcondition getMapData() returns a frozen copy of mapData
     * @param {Object} mapData
     * @throws {TypeError} if mapData is not an object
     */
    setMapData(mapData) {
        if (mapData === null || typeof mapData !== 'object') {
            throw new TypeError('mapData must be an object');
        }
        this.#mapData = frozenCopy(mapData);
    }

    /**
     * @precondition none
     * @postcondition returns the stored map data (frozen), or null if none
     * @returns {Object|null}
     */
    getMapData() {
        return this.#mapData;
    }

    // ---------------------------------------------------------------- form

    /**
     * Gets the current selected origin place id.
     * @precondition none
     * @postcondition returns the current origin identifier or null
     * @returns {string|null}
     */
    getOrigin() {
        return this.#origin;
    }

    /**
     * Sets the origin identifier. Whether it is a known place is checked by
     * validateForm(), so a stale id is reported to the user instead of thrown.
     * @precondition originId is a string or null
     * @postcondition origin is the trimmed id, or null if originId is null or blank
     * @param {string|null} originId
     */
    setOrigin(originId) {
        this.#origin = normalizeId(originId);
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the current destination identifier or null
     * @returns {string|null}
     */
    getDestination() {
        return this.#destination;
    }

    /**
     * @precondition destinationId is a string or null
     * @postcondition destination is the trimmed id, or null if destinationId is null or blank
     * @param {string|null} destinationId
     */
    setDestination(destinationId) {
        this.#destination = normalizeId(destinationId);
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition origin and destination are exchanged
     */
    swapEndpoints() {
        [this.#origin, this.#destination] = [this.#destination, this.#origin];
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the departure text; '' means "leave now"
     * @returns {string}
     */
    getDeparture() {
        return this.#departure;
    }

    /**
     * Stores the departure exactly as entered (trimmed), so that the user's
     * input is kept even when it is invalid.
     * @precondition departure is a string, null or undefined
     * @postcondition departure is the trimmed text, or '' (now) for null/undefined
     * @param {string|null|undefined} departure
     */
    setDeparture(departure) {
        this.#departure = departure === null || departure === undefined ? '' : String(departure).trim();
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the maximum extra minutes, null if missing, or NaN
     *   if the user typed something that is not a number
     * @returns {number|null}
     */
    getMaxExtraMinutes() {
        return this.#maxExtraMinutes;
    }

    /**
     * Stores the maximum extra walking time. Text is converted to a number;
     * blank text becomes null (missing). Range checks happen in validateForm().
     * @precondition value is a number, a string, null or undefined
     * @postcondition stored value is null for null/undefined/blank text,
     *   otherwise Number(value) (which may be NaN or infinite)
     * @param {number|string|null|undefined} value
     */
    setMaxExtraMinutes(value) {
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
            this.#maxExtraMinutes = null;
        } else {
            this.#maxExtraMinutes = Number(value);
        }
        this.#checkRep();
    }

    /**
     * Copies the values of a submitted form into the state. Fields that are
     * absent (undefined) keep their current value.
     * @precondition form is an object
     * @postcondition each present field is stored as by its setter
     * @param {{origin?: string|null, destination?: string|null,
     *          departure?: string|null, maxExtraMinutes?: number|string|null}} form
     */
    applyForm(form) {
        if (form === null || typeof form !== 'object') {
            throw new TypeError('form must be an object');
        }
        if (form.origin !== undefined) this.setOrigin(form.origin);
        if (form.destination !== undefined) this.setDestination(form.destination);
        if (form.departure !== undefined) this.setDeparture(form.departure);
        if (form.maxExtraMinutes !== undefined) this.setMaxExtraMinutes(form.maxExtraMinutes);
    }

    /**
     * @precondition none
     * @postcondition returns a new object with the current form values
     * @returns {{origin: string|null, destination: string|null,
     *            departure: string, maxExtraMinutes: number|null}}
     */
    getForm() {
        return {
            origin: this.#origin,
            destination: this.#destination,
            departure: this.#departure,
            maxExtraMinutes: this.#maxExtraMinutes,
        };
    }

    /**
     * Checks the form before a route request is sent. The server repeats all
     * of these checks; this only saves a round trip and gives instant feedback.
     * @precondition none
     * @postcondition returns one entry per problem, in field order; an empty
     *   array means toRouteRequest() will succeed
     * @returns {ReadonlyArray<{field: string, problem: string}>}
     */
    validateForm() {
        const errors = [];
        const checkPlace = (field, id) => {
            if (id === null) {
                errors.push({ field, problem: PROBLEM.MISSING });
            } else if (!this.#placesById.has(id)) {
                errors.push({ field, problem: PROBLEM.UNKNOWN_PLACE });
            }
        };
        checkPlace(FIELD.ORIGIN, this.#origin);
        checkPlace(FIELD.DESTINATION, this.#destination);
        if (this.#origin !== null && this.#origin === this.#destination) {
            errors.push({ field: FIELD.DESTINATION, problem: PROBLEM.IDENTICAL_ENDPOINTS });
        }
        if (this.#departure !== '' && !isValidLocalDateTime(this.#departure)) {
            errors.push({ field: FIELD.DEPARTURE, problem: PROBLEM.INVALID_TIME });
        }
        const extra = this.#maxExtraMinutes;
        if (extra === null) {
            errors.push({ field: FIELD.MAX_EXTRA_MINUTES, problem: PROBLEM.MISSING });
        } else if (!Number.isFinite(extra)) {
            errors.push({ field: FIELD.MAX_EXTRA_MINUTES, problem: PROBLEM.NOT_FINITE });
        } else if (extra < 0) {
            errors.push({ field: FIELD.MAX_EXTRA_MINUTES, problem: PROBLEM.NEGATIVE });
        }
        return Object.freeze(errors.map((e) => Object.freeze(e)));
    }

    /**
     * Builds the body of POST /api/routes (architecture §3.3).
     * @precondition validateForm() returns no errors
     * @postcondition returns {origin, destination, maxExtraMinutes} plus
     *   departure if one was entered; departure is omitted for "now"
     * @returns {{origin: string, destination: string, maxExtraMinutes: number, departure?: string}}
     * @throws {Error} if the form is not valid
     */
    toRouteRequest() {
        if (this.validateForm().length > 0) {
            throw new Error('toRouteRequest called with an invalid form');
        }
        const request = {
            origin: this.#origin,
            destination: this.#destination,
            maxExtraMinutes: this.#maxExtraMinutes,
        };
        if (this.#departure !== '') {
            request.departure = this.#departure;
        }
        return request;
    }

    // ---------------------------------------------------------------- route result

    /**
     * Stores a route result together with the query that produced it, and
     * selects the first option (the fastest route) if there is one.
     * @precondition result is a parsed route result (RemoteData.parseRouteResult)
     *   whose options have distinct kinds; query is the request that produced it
     * @postcondition getRouteResult() and getRouteQuery() return frozen copies;
     *   the selected option is the first option or null; no step is selected
     * @param {Object} result
     * @param {Object} query
     * @throws {TypeError} if result has no options array or query is not an object
     */
    setRouteResult(result, query) {
        if (result === null || typeof result !== 'object' || !Array.isArray(result.options)) {
            throw new TypeError('result must have an options array');
        }
        if (query === null || typeof query !== 'object') {
            throw new TypeError('query must be an object');
        }
        this.#routeResult = frozenCopy(result);
        this.#routeQuery = frozenCopy(query);
        this.#selectedKind = this.#routeResult.options.length > 0 ? this.#routeResult.options[0].kind : null;
        this.#selectedStepIndex = null;
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition no route result, query, option or step is stored
     */
    clearRouteResult() {
        this.#routeResult = null;
        this.#routeQuery = null;
        this.#selectedKind = null;
        this.#selectedStepIndex = null;
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the current route result (frozen), or null
     * @returns {Object|null}
     */
    getRouteResult() {
        return this.#routeResult;
    }

    /**
     * The request that produced the current result. Views show it so that the
     * result is always labelled with the input it answers.
     * @precondition none
     * @postcondition returns the query (frozen), or null if there is no result
     * @returns {Object|null}
     */
    getRouteQuery() {
        return this.#routeQuery;
    }

    /**
     * @precondition a route result is stored and has an option of this kind
     * @postcondition that option is selected and no step is selected
     * @param {string} kind e.g. 'FASTEST' or 'LOWER_EXPOSURE'
     * @throws {RangeError} if there is no option of this kind
     */
    selectOption(kind) {
        if (this.#findOption(kind) === null) {
            throw new RangeError(`no route option of kind ${kind}`);
        }
        this.#selectedKind = kind;
        this.#selectedStepIndex = null;
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the selected option (frozen), or null
     * @returns {Object|null}
     */
    getSelectedOption() {
        return this.#selectedKind === null ? null : this.#findOption(this.#selectedKind);
    }

    /**
     * @precondition index is null, or an option is selected and
     *   0 <= index < its number of steps
     * @postcondition the selected step is index (null clears the selection)
     * @param {number|null} index
     * @throws {RangeError} if no option is selected or index is out of range
     */
    selectStep(index) {
        if (index === null) {
            this.#selectedStepIndex = null;
            this.#checkRep();
            return;
        }
        const option = this.getSelectedOption();
        if (option === null) {
            throw new RangeError('no option is selected');
        }
        if (!Number.isInteger(index) || index < 0 || index >= option.steps.length) {
            throw new RangeError(`step index ${index} is out of range`);
        }
        this.#selectedStepIndex = index;
        this.#checkRep();
    }

    /**
     * @precondition none
     * @postcondition returns the selected step index, or null
     * @returns {number|null}
     */
    getSelectedStepIndex() {
        return this.#selectedStepIndex;
    }

    /**
     * @precondition none
     * @postcondition returns the selected step (frozen), or null
     * @returns {Object|null}
     */
    getSelectedStep() {
        const option = this.getSelectedOption();
        return option === null || this.#selectedStepIndex === null
            ? null
            : option.steps[this.#selectedStepIndex];
    }

    // ---------------------------------------------------------------- private

    #findOption(kind) {
        if (this.#routeResult === null) {
            return null;
        }
        return this.#routeResult.options.find((o) => o.kind === kind) ?? null;
    }

    /** Asserts the rep invariant (see the class comment). */
    #checkRep() {
        const fail = (what) => { throw new Error(`ClientState rep invariant violated: ${what}`); };
        if (this.#placesById.size !== this.#places.length) fail('place ids');
        if (this.#dataVersion !== null && (typeof this.#dataVersion !== 'string' || this.#dataVersion === '')) fail('dataVersion');
        for (const id of [this.#origin, this.#destination]) {
            if (id !== null && (typeof id !== 'string' || id === '')) fail('endpoint id');
        }
        if (typeof this.#departure !== 'string') fail('departure');
        if (this.#maxExtraMinutes !== null && typeof this.#maxExtraMinutes !== 'number') fail('maxExtraMinutes');
        if ((this.#routeResult === null) !== (this.#routeQuery === null)) fail('result/query pairing');
        if (this.#selectedKind !== null && this.#findOption(this.#selectedKind) === null) fail('selected kind');
        if (this.#selectedStepIndex !== null) {
            const option = this.getSelectedOption();
            if (option === null || this.#selectedStepIndex >= option.steps.length) fail('selected step');
        }
    }
}

/**
 * Client-side model of the server's data, and the only client component that
 * talks to the server (architecture §2.3, §3).
 *
 * Every public method resolves to an Outcome and never rejects:
 *   { kind: 'ok',         data }                       the parsed response
 *   { kind: 'validation', fields, dataVersion }        400 VALIDATION_ERROR
 *   { kind: 'service',    reason, httpStatus }         network failure, timeout,
 *                                                      server error or a response
 *                                                      that breaks the contract
 *   { kind: 'stale' }                                  a route response for a query
 *                                                      that a newer fetchRoutes replaced
 * A service error is never reported as "no route" (architecture §3.4).
 *
 * Responses are parsed into one canonical shape (see the typedefs below), so
 * views do not depend on how the server spells field names. For example a
 * node's coordinates may arrive as xNorm/yNorm or x_norm/y_norm, and a point
 * as [x, y] or {xNorm, yNorm}; both become {xNorm, yNorm}.
 *
 * Concurrency: route requests are numbered. Starting a new route request
 * aborts the previous one, and any route response that is not for the newest
 * request is reported as stale, even if it arrives last.
 */

/**
 * @typedef {{id: string, label: string, xNorm: number, yNorm: number}} Place
 * @typedef {{xNorm: number, yNorm: number}} Point
 * @typedef {{id: string, name: string, outline: Point[]}} Building
 * @typedef {{imageUrl: string, imageWidth: number|null, imageHeight: number|null}} MapInfo
 * @typedef {{dataVersion: string, places: Place[]}} Meta
 * @typedef {{dataVersion: string, map: MapInfo, buildings: Building[], places: Place[]}} MapData
 * @typedef {{edgeId: string, cover: string, points: Point[]}} Segment
 * @typedef {{text: string, edgeIds: string[]}} Step  (plus the optional fields of parseStepExtras)
 * @typedef {{kind: string, optimal: boolean, distanceM: number, walkSeconds: number,
 *            exposedM: number, extraSeconds: number, exposureReductionM: number,
 *            segments: Segment[], steps: Step[]}} RouteOption
 * @typedef {{dataVersion: string, status: string, identical: boolean,
 *            options: RouteOption[]}} RouteResult
 */

export const OUTCOME = Object.freeze({
    OK: 'ok',
    VALIDATION: 'validation',
    SERVICE: 'service',
    STALE: 'stale',
});

/** Why a request ended as a service error. */
export const SERVICE_REASON = Object.freeze({
    NETWORK: 'NETWORK',
    TIMEOUT: 'TIMEOUT',
    HTTP_ERROR: 'HTTP_ERROR',
    BAD_RESPONSE: 'BAD_RESPONSE',
});

export const ROUTE_STATUS = Object.freeze({
    COMPLETE: 'COMPLETE',
    NO_FEASIBLE_ROUTE: 'NO_FEASIBLE_ROUTE',
    INCOMPLETE: 'INCOMPLETE',
});

export const OPTION_KIND = Object.freeze({
    FASTEST: 'FASTEST',
    LOWER_EXPOSURE: 'LOWER_EXPOSURE',
});

export const DEFAULT_TIMEOUT_MS = 15000;

/** Thrown by the parsers when a response does not follow the API contract. */
export class ProtocolError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProtocolError';
    }
}

// -------------------------------------------------------------------- parsers

function requireObject(value, where) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new ProtocolError(`${where} must be an object`);
    }
    return value;
}

function requireArray(value, where) {
    if (!Array.isArray(value)) {
        throw new ProtocolError(`${where} must be an array`);
    }
    return value;
}

function requireString(value, where) {
    if (typeof value !== 'string' || value === '') {
        throw new ProtocolError(`${where} must be a non-empty string`);
    }
    return value;
}

function requireMetric(value, where) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new ProtocolError(`${where} must be a finite, non-negative number`);
    }
    return value;
}

function requireCoordinate(value, where) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ProtocolError(`${where} must be a finite number`);
    }
    return value;
}

/** Accepts [x, y], {xNorm, yNorm}, {x_norm, y_norm} or {x, y}. */
function parsePoint(value, where) {
    if (Array.isArray(value)) {
        if (value.length !== 2) {
            throw new ProtocolError(`${where} must have two coordinates`);
        }
        return { xNorm: requireCoordinate(value[0], `${where}[0]`), yNorm: requireCoordinate(value[1], `${where}[1]`) };
    }
    const o = requireObject(value, where);
    const x = o.xNorm ?? o.x_norm ?? o.x;
    const y = o.yNorm ?? o.y_norm ?? o.y;
    return { xNorm: requireCoordinate(x, `${where}.xNorm`), yNorm: requireCoordinate(y, `${where}.yNorm`) };
}

/** A label may be a string, null/absent, or a serialized Optional ({value}). */
function parseLabel(value, fallback) {
    if (typeof value === 'string' && value !== '') {
        return value;
    }
    if (value !== null && typeof value === 'object' && typeof value.value === 'string' && value.value !== '') {
        return value.value;
    }
    return fallback;
}

function parsePlace(value, where) {
    const o = requireObject(value, where);
    const id = requireString(o.id, `${where}.id`);
    const point = parsePoint(o, where);
    return { id, label: parseLabel(o.label, id), xNorm: point.xNorm, yNorm: point.yNorm };
}

function parsePlaces(value, where) {
    if (value === undefined || value === null) {
        return [];
    }
    return requireArray(value, where).map((p, i) => parsePlace(p, `${where}[${i}]`));
}

/**
 * Parses the body of GET /api/meta.
 * @precondition none
 * @postcondition returns a Meta in canonical shape
 * @param {unknown} json
 * @returns {Meta}
 * @throws {ProtocolError} if json does not follow the API contract
 */
export function parseMeta(json) {
    const o = requireObject(json, 'meta');
    return {
        dataVersion: requireString(o.dataVersion, 'meta.dataVersion'),
        places: parsePlaces(o.places, 'meta.places'),
    };
}

/**
 * Parses the body of GET /api/map.
 * @precondition none
 * @postcondition returns MapData in canonical shape
 * @param {unknown} json
 * @returns {MapData}
 * @throws {ProtocolError} if json does not follow the API contract
 */
export function parseMapData(json) {
    const o = requireObject(json, 'map response');
    const m = requireObject(o.map, 'map');
    const size = (v, where) => (v === undefined || v === null ? null : requireMetric(v, where));
    const buildings = o.buildings === undefined || o.buildings === null
        ? []
        : requireArray(o.buildings, 'buildings').map((b, i) => {
            const where = `buildings[${i}]`;
            const bo = requireObject(b, where);
            return {
                id: requireString(bo.id, `${where}.id`),
                name: typeof bo.name === 'string' && bo.name !== '' ? bo.name : bo.id,
                outline: requireArray(bo.outline, `${where}.outline`).map((p, j) => parsePoint(p, `${where}.outline[${j}]`)),
            };
        });
    return {
        dataVersion: requireString(o.dataVersion, 'map response.dataVersion'),
        map: {
            imageUrl: requireString(m.imageUrl, 'map.imageUrl'),
            imageWidth: size(m.imageWidth, 'map.imageWidth'),
            imageHeight: size(m.imageHeight, 'map.imageHeight'),
        },
        buildings,
        places: parsePlaces(o.places, 'map response.places'),
    };
}

function parseKind(value, where) {
    const kind = requireString(value, where).toUpperCase();
    if (kind === 'BASELINE') {
        return OPTION_KIND.FASTEST;
    }
    if (kind !== OPTION_KIND.FASTEST && kind !== OPTION_KIND.LOWER_EXPOSURE) {
        throw new ProtocolError(`${where} is not a known option kind`);
    }
    return kind;
}

/**
 * The optional step fields that RouteDetailView shows (title, cover, card reader,
 * opening hours, a "not verified yet" note, written details and photos).
 * A field that is missing or has the wrong type is left out, so a server that
 * does not send them still works. (Written by Yuki.)
 * @precondition so is an object
 * @postcondition returns only the extra fields that are present and valid
 * @param {Object} so the step object from the server
 * @returns {Object}
 */
export function parseStepExtras(so) {
    const extras = {};
    for (const key of ['title', 'hours', 'pending']) {
        if (typeof so[key] === 'string' && so[key] !== '') {
            extras[key] = so[key];
        }
    }
    if (typeof so.cover === 'string') {
        extras.cover = so.cover.toLowerCase();
    }
    if (typeof so.cardReader === 'boolean') {
        extras.cardReader = so.cardReader;
    }
    if (Array.isArray(so.details)) {
        extras.details = so.details.filter((d) => typeof d === 'string');
    }
    if (Array.isArray(so.photos)) {
        extras.photos = so.photos
            .filter((p) => p !== null && typeof p === 'object' && typeof p.url === 'string')
            .map((p) => ({ id: String(p.id ?? ''), url: p.url, caption: String(p.caption ?? '') }));
    }
    return extras;
}

function parseOption(value, where) {
    const o = requireObject(value, where);
    const segments = requireArray(o.segments ?? [], `${where}.segments`).map((s, i) => {
        const sw = `${where}.segments[${i}]`;
        const so = requireObject(s, sw);
        return {
            edgeId: requireString(so.edgeId, `${sw}.edgeId`),
            cover: requireString(so.cover, `${sw}.cover`).toLowerCase(),
            points: requireArray(so.points, `${sw}.points`).map((p, j) => parsePoint(p, `${sw}.points[${j}]`)),
        };
    });
    const steps = requireArray(o.steps ?? [], `${where}.steps`).map((s, i) => {
        const sw = `${where}.steps[${i}]`;
        const so = requireObject(s, sw);
        return {
            text: requireString(so.text, `${sw}.text`),
            edgeIds: requireArray(so.edgeIds ?? [], `${sw}.edgeIds`).map((e, j) => requireString(e, `${sw}.edgeIds[${j}]`)),
            ...parseStepExtras(so),
        };
    });
    return {
        kind: parseKind(o.kind, `${where}.kind`),
        optimal: o.optimal === undefined ? true : Boolean(o.optimal),
        distanceM: requireMetric(o.distanceM, `${where}.distanceM`),
        walkSeconds: requireMetric(o.walkSeconds, `${where}.walkSeconds`),
        exposedM: requireMetric(o.exposedM, `${where}.exposedM`),
        extraSeconds: requireMetric(o.extraSeconds ?? 0, `${where}.extraSeconds`),
        exposureReductionM: requireMetric(o.exposureReductionM ?? 0, `${where}.exposureReductionM`),
        segments,
        steps,
    };
}

/**
 * Parses the body of a 200 response to POST /api/routes.
 * @precondition none
 * @postcondition returns a RouteResult in canonical shape whose options have
 *   distinct kinds; COMPLETE has 1–2 options, NO_FEASIBLE_ROUTE has none,
 *   INCOMPLETE has 0–2
 * @param {unknown} json
 * @returns {RouteResult}
 * @throws {ProtocolError} if json does not follow the API contract
 */
export function parseRouteResult(json) {
    const o = requireObject(json, 'route result');
    const status = requireString(o.status, 'route result.status');
    if (!Object.values(ROUTE_STATUS).includes(status)) {
        throw new ProtocolError(`unknown route status ${status}`);
    }
    const options = requireArray(o.options ?? [], 'route result.options')
        .map((opt, i) => parseOption(opt, `options[${i}]`));
    if (options.length > 2) {
        throw new ProtocolError('a route result has at most two options');
    }
    if (new Set(options.map((opt) => opt.kind)).size !== options.length) {
        throw new ProtocolError('route options must have distinct kinds');
    }
    if (status === ROUTE_STATUS.COMPLETE && options.length === 0) {
        throw new ProtocolError('COMPLETE needs at least one option');
    }
    if (status === ROUTE_STATUS.NO_FEASIBLE_ROUTE && options.length > 0) {
        throw new ProtocolError('NO_FEASIBLE_ROUTE must have no options');
    }
    return {
        dataVersion: requireString(o.dataVersion, 'route result.dataVersion'),
        status,
        identical: typeof o.identical === 'boolean' ? o.identical : options.length === 1,
        options,
    };
}

/**
 * Parses the body of a 400 VALIDATION_ERROR response.
 * @precondition none
 * @postcondition returns the field errors, or null if json is not a validation error
 * @param {unknown} json
 * @returns {{fields: {field: string, problem: string}[], dataVersion: string|null}|null}
 */
export function parseValidationError(json) {
    if (json === null || typeof json !== 'object' || json.error === null || typeof json.error !== 'object'
        || json.error.code !== 'VALIDATION_ERROR') {
        return null;
    }
    const raw = Array.isArray(json.error.fields) ? json.error.fields : [];
    const fields = raw
        .filter((f) => f !== null && typeof f === 'object')
        .map((f) => ({
            field: typeof f.field === 'string' ? f.field : 'form',
            problem: typeof f.problem === 'string' ? f.problem : 'INVALID',
        }));
    return {
        fields,
        dataVersion: typeof json.dataVersion === 'string' ? json.dataVersion : null,
    };
}

// -------------------------------------------------------------------- RemoteData

/**
 * Handles fetching data from the backend server APIs.
 */
export class RemoteData {
    #baseUrl;
    #fetch;
    #timeoutMs;
    #routeSeq = 0;
    /** @type {AbortController|null} */
    #routeController = null;

    /**
     * @precondition baseUrl is '' (same server) or an absolute URL without a
     *   trailing slash; fetchFn behaves like window.fetch; timeoutMs > 0
     * @postcondition a RemoteData that sends requests to baseUrl + '/api/...'
     * @param {{baseUrl?: string, fetchFn?: Function, timeoutMs?: number}} [options]
     */
    constructor({ baseUrl = '', fetchFn = (...args) => globalThis.fetch(...args), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
        if (typeof fetchFn !== 'function') {
            throw new TypeError('fetchFn must be a function');
        }
        if (!(timeoutMs > 0)) {
            throw new RangeError('timeoutMs must be positive');
        }
        this.#baseUrl = baseUrl;
        this.#fetch = fetchFn;
        this.#timeoutMs = timeoutMs;
    }

    /**
     * Fetches metadata from the server (GET /api/meta).
     * @precondition none
     * @postcondition resolves to {kind:'ok', data: Meta} or a service error; never rejects
     * @returns {Promise<Object>}
     */
    async fetchMetadata() {
        return this.#get('/api/meta', parseMeta);
    }

    /**
     * Fetches the map: background image, building outlines and selectable
     * places (GET /api/map).
     * @precondition none
     * @postcondition resolves to {kind:'ok', data: MapData} or a service error; never rejects
     * @returns {Promise<Object>}
     */
    async fetchMapData() {
        return this.#get('/api/map', parseMapData);
    }

    /**
     * Requests route options from the backend (POST /api/routes). Starting a
     * new request makes every earlier route request stale.
     * @precondition request is a plain object as built by ClientState.toRouteRequest()
     * @postcondition resolves to {kind:'ok', data: RouteResult}, a validation
     *   error, a service error, or {kind:'stale'} if fetchRoutes or cancelRoutes
     *   was called again before this request finished; never rejects
     * @param {{origin: string, destination: string, maxExtraMinutes: number, departure?: string}} request
     * @returns {Promise<Object>}
     */
    async fetchRoutes(request) {
        this.#routeController?.abort();
        const seq = ++this.#routeSeq;
        const controller = new AbortController();
        this.#routeController = controller;

        const outcome = await this.#send('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        }, controller, parseRouteResult);

        if (seq !== this.#routeSeq) {
            return { kind: OUTCOME.STALE };
        }
        this.#routeController = null;
        return outcome;
    }

    /**
     * Abandons the route request in flight, if any.
     * @precondition none
     * @postcondition a pending fetchRoutes resolves to {kind:'stale'}
     */
    cancelRoutes() {
        this.#routeSeq++;
        this.#routeController?.abort();
        this.#routeController = null;
    }

    async #get(path, parse) {
        return this.#send(path, { method: 'GET' }, new AbortController(), parse);
    }

    /**
     * Sends one request and classifies the result. Never rejects.
     * @returns {Promise<Object>} an Outcome; an abort that is not a timeout gives 'stale'
     */
    async #send(path, init, controller, parse) {
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, this.#timeoutMs);

        let status;
        let text;
        try {
            const response = await this.#fetch(this.#baseUrl + path, {
                ...init,
                headers: { Accept: 'application/json', ...(init.headers ?? {}) },
                signal: controller.signal,
            });
            status = response.status;
            text = await response.text();
        } catch (error) {
            if (timedOut) {
                return service(SERVICE_REASON.TIMEOUT);
            }
            if (controller.signal.aborted) {
                return { kind: OUTCOME.STALE };
            }
            return service(SERVICE_REASON.NETWORK);
        } finally {
            clearTimeout(timer);
        }

        let json;
        try {
            json = text === '' ? null : JSON.parse(text);
        } catch {
            return service(status >= 200 && status < 300 ? SERVICE_REASON.BAD_RESPONSE : SERVICE_REASON.HTTP_ERROR, status);
        }

        if (status === 400) {
            const validation = parseValidationError(json);
            if (validation !== null) {
                return { kind: OUTCOME.VALIDATION, fields: validation.fields, dataVersion: validation.dataVersion };
            }
        }
        if (status < 200 || status >= 300) {
            return service(SERVICE_REASON.HTTP_ERROR, status);
        }
        try {
            return { kind: OUTCOME.OK, data: parse(json) };
        } catch (error) {
            // A ProtocolError means the server broke the contract; anything else
            // is a parser bug. Either way the caller gets a service error, so
            // this method keeps its promise never to reject.
            console.warn(`Unexpected response from ${path}: ${error.message}`);
            return service(SERVICE_REASON.BAD_RESPONSE, status);
        }
    }
}

function service(reason, httpStatus = null) {
    return { kind: OUTCOME.SERVICE, reason, httpStatus };
}

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    RemoteData, OUTCOME, SERVICE_REASON, parseMeta, parseMapData, parseRouteResult,
    parseValidationError, ProtocolError, parseStepExtras,
} from '../../main/resources/public/js/model/RemoteData.js';

/** A response object as returned by fetch. */
function response(status, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { status, text: async () => text };
}

/** A fetch that answers each call from a list of handlers, recording the calls. */
function fakeFetch(...handlers) {
    const calls = [];
    const fn = async (url, init) => {
        calls.push({ url, init });
        const handler = handlers[calls.length - 1];
        if (handler === undefined) throw new Error('unexpected fetch');
        return handler(url, init);
    };
    fn.calls = calls;
    return fn;
}

/** A fetch whose answer is released later; it rejects with AbortError if aborted. */
function deferredFetch() {
    const pending = [];
    const fn = (url, init) => new Promise((resolve, reject) => {
        const entry = { url, init, resolve };
        pending.push(entry);
        init.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
        });
    });
    fn.pending = pending;
    return fn;
}

const META = { dataVersion: 'v1', places: [{ id: 'A', x_norm: 0.1, y_norm: 0.2, label: 'Place A' }] };
const MAP = {
    dataVersion: 'v1',
    map: { imageUrl: 'images/map.png', imageWidth: 1000, imageHeight: 800 },
    buildings: [{ id: 'B1', name: 'Building', outline: [[0.1, 0.1], { xNorm: 0.2, yNorm: 0.1 }, { x: 0.2, y: 0.2 }] }],
    places: [{ id: 'A', xNorm: 0.1, yNorm: 0.2, label: null }],
};
const ROUTE = {
    dataVersion: 'v1',
    status: 'COMPLETE',
    identical: false,
    options: [
        {
            kind: 'FASTEST', distanceM: 100, walkSeconds: 80, exposedM: 50, extraSeconds: 0, exposureReductionM: 0,
            segments: [{ edgeId: 'E1', cover: 'OUTDOOR', points: [[0.1, 0.1], [0.2, 0.2]] }],
            steps: [{ text: 'Walk 100 m outdoors.', edgeIds: ['E1'] }],
        },
        {
            kind: 'LOWER_EXPOSURE', distanceM: 120, walkSeconds: 100, exposedM: 10, extraSeconds: 20,
            exposureReductionM: 40, segments: [], steps: [],
        },
    ],
};
const REQUEST = { origin: 'A', destination: 'D', maxExtraMinutes: 2 };

describe('parsers', () => {
    test('parseMeta accepts snake_case coordinates and falls back to the id as label', () => {
        assert.deepEqual(parseMeta(META), {
            dataVersion: 'v1', places: [{ id: 'A', label: 'Place A', xNorm: 0.1, yNorm: 0.2 }],
        });
        assert.equal(parseMeta({ dataVersion: 'v', places: [{ id: 'Q', xNorm: 0, yNorm: 0 }] }).places[0].label, 'Q');
        assert.equal(parseMeta({ dataVersion: 'v', places: [{ id: 'Q', xNorm: 0, yNorm: 0, label: { value: 'Opt' } }] })
            .places[0].label, 'Opt');
        assert.deepEqual(parseMeta({ dataVersion: 'v' }).places, []);
    });

    test('parseMapData normalizes every point form', () => {
        const m = parseMapData(MAP);
        assert.deepEqual(m.buildings[0].outline, [
            { xNorm: 0.1, yNorm: 0.1 }, { xNorm: 0.2, yNorm: 0.1 }, { xNorm: 0.2, yNorm: 0.2 },
        ]);
        assert.equal(m.places[0].label, 'A');
        assert.equal(m.map.imageWidth, 1000);
        const minimal = parseMapData({ dataVersion: 'v', map: { imageUrl: 'x.png' } });
        assert.deepEqual(minimal.buildings, []);
        assert.equal(minimal.map.imageHeight, null);
    });

    test('parseRouteResult lower-cases cover, maps BASELINE to FASTEST and fills defaults', () => {
        const r = parseRouteResult(ROUTE);
        assert.equal(r.options[0].segments[0].cover, 'outdoor');
        assert.deepEqual(r.options[0].segments[0].points[1], { xNorm: 0.2, yNorm: 0.2 });
        assert.equal(r.options[0].optimal, true);
        const baseline = structuredClone(ROUTE);
        baseline.options = [baseline.options[0]];
        baseline.options[0].kind = 'BASELINE';
        delete baseline.identical;
        delete baseline.options[0].extraSeconds;
        const parsed = parseRouteResult(baseline);
        assert.equal(parsed.options[0].kind, 'FASTEST');
        assert.equal(parsed.identical, true);
        assert.equal(parsed.options[0].extraSeconds, 0);
    });

    test('parseRouteResult enforces the contract', () => {
        const bad = (mutate) => {
            const r = structuredClone(ROUTE);
            mutate(r);
            assert.throws(() => parseRouteResult(r), ProtocolError);
        };
        bad((r) => { delete r.dataVersion; });
        bad((r) => { r.status = 'MAYBE'; });
        bad((r) => { r.options = []; });
        bad((r) => { r.status = 'NO_FEASIBLE_ROUTE'; });
        bad((r) => { r.options.push(structuredClone(r.options[0])); });
        bad((r) => { r.options[1].kind = 'FASTEST'; });
        bad((r) => { r.options[0].kind = 'SCENIC'; });
        bad((r) => { r.options[0].distanceM = -1; });
        bad((r) => { r.options[0].walkSeconds = Infinity; });
        bad((r) => { r.options[0].segments[0].points = [[0.1]]; });
        bad((r) => { r.options[0].segments[0].points[0] = { xNorm: 'a', yNorm: 0 }; });
        bad((r) => { r.options[0].steps[0].text = ''; });
        bad((r) => { r.options = 'none'; });
        assert.throws(() => parseRouteResult(null), ProtocolError);
        assert.throws(() => parseRouteResult([]), ProtocolError);
    });

    test('optional step fields are kept when valid and dropped when not', () => {
        const r = structuredClone(ROUTE);
        r.options[0].steps[0] = {
            text: 'Enter ICCS.', edgeIds: ['E1'], title: 'ICCS north door', cover: 'INDOOR', cardReader: true,
            hours: 'Mon–Fri 07:00–22:00', pending: '', details: ['Push the left door', 3],
            photos: [{ id: 'P1', url: 'images/p1.jpg', caption: 'Door' }, { id: 'P2' }, null], secret: 'dropped',
        };
        assert.deepEqual(parseRouteResult(r).options[0].steps[0], {
            text: 'Enter ICCS.', edgeIds: ['E1'], title: 'ICCS north door', hours: 'Mon–Fri 07:00–22:00',
            cover: 'indoor', cardReader: true, details: ['Push the left door'],
            photos: [{ id: 'P1', url: 'images/p1.jpg', caption: 'Door' }],
        });
        assert.deepEqual(parseStepExtras({ text: 't' }), {});
        assert.deepEqual(parseStepExtras({ photos: [{ url: 'u' }] }).photos, [{ id: '', url: 'u', caption: '' }]);
    });

    test('NO_FEASIBLE_ROUTE and INCOMPLETE results parse', () => {
        assert.equal(parseRouteResult({ dataVersion: 'v', status: 'NO_FEASIBLE_ROUTE', options: [] }).options.length, 0);
        assert.equal(parseRouteResult({ dataVersion: 'v', status: 'INCOMPLETE' }).status, 'INCOMPLETE');
    });

    test('parseValidationError', () => {
        assert.deepEqual(parseValidationError({
            dataVersion: 'v1',
            error: { code: 'VALIDATION_ERROR', fields: [{ field: 'destination', problem: 'IDENTICAL_ENDPOINTS' }, null, {}] },
        }), {
            dataVersion: 'v1',
            fields: [{ field: 'destination', problem: 'IDENTICAL_ENDPOINTS' }, { field: 'form', problem: 'INVALID' }],
        });
        assert.equal(parseValidationError({ error: { code: 'INTERNAL_ERROR' } }), null);
        assert.equal(parseValidationError(null), null);
        assert.deepEqual(parseValidationError({ error: { code: 'VALIDATION_ERROR' } }).fields, []);
    });
});

describe('RemoteData requests', () => {
    test('fetchMetadata and fetchMapData send GET to the right paths', async () => {
        const fetchFn = fakeFetch(() => response(200, META), () => response(200, MAP));
        const remote = new RemoteData({ baseUrl: 'http://host:7070', fetchFn });
        const meta = await remote.fetchMetadata();
        const map = await remote.fetchMapData();
        assert.equal(meta.kind, OUTCOME.OK);
        assert.equal(map.kind, OUTCOME.OK);
        assert.equal(fetchFn.calls[0].url, 'http://host:7070/api/meta');
        assert.equal(fetchFn.calls[1].url, 'http://host:7070/api/map');
        assert.equal(fetchFn.calls[0].init.method, 'GET');
        assert.equal(fetchFn.calls[0].init.headers.Accept, 'application/json');
    });

    test('fetchRoutes posts the request as JSON and parses the result', async () => {
        const fetchFn = fakeFetch(() => response(200, ROUTE));
        const outcome = await new RemoteData({ fetchFn }).fetchRoutes(REQUEST);
        assert.equal(outcome.kind, OUTCOME.OK);
        assert.equal(outcome.data.options.length, 2);
        const { url, init } = fetchFn.calls[0];
        assert.equal(url, '/api/routes');
        assert.equal(init.method, 'POST');
        assert.equal(init.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(init.body), REQUEST);
    });

    test('400 VALIDATION_ERROR becomes a validation outcome', async () => {
        const body = { dataVersion: 'v1', error: { code: 'VALIDATION_ERROR', fields: [{ field: 'origin', problem: 'UNKNOWN' }] } };
        const outcome = await new RemoteData({ fetchFn: fakeFetch(() => response(400, body)) }).fetchRoutes(REQUEST);
        assert.deepEqual(outcome, { kind: OUTCOME.VALIDATION, fields: [{ field: 'origin', problem: 'UNKNOWN' }], dataVersion: 'v1' });
    });

    test('server errors, bad JSON and network failures are service errors, never "no route"', async () => {
        const cases = [
            [() => response(500, { dataVersion: 'v1', error: { code: 'INTERNAL_ERROR' } }), SERVICE_REASON.HTTP_ERROR, 500],
            [() => response(400, { error: { code: 'SOMETHING_ELSE' } }), SERVICE_REASON.HTTP_ERROR, 400],
            [() => response(502, '<html>Bad gateway</html>'), SERVICE_REASON.HTTP_ERROR, 502],
            [() => response(200, '{not json'), SERVICE_REASON.BAD_RESPONSE, 200],
            [() => response(200, { status: 'COMPLETE' }), SERVICE_REASON.BAD_RESPONSE, 200],
            [() => response(200, ''), SERVICE_REASON.BAD_RESPONSE, 200],
            [() => { throw new TypeError('Failed to fetch'); }, SERVICE_REASON.NETWORK, null],
        ];
        const originalWarn = console.warn;
        console.warn = () => {};
        try {
            for (const [handler, reason, httpStatus] of cases) {
                const outcome = await new RemoteData({ fetchFn: fakeFetch(handler) }).fetchRoutes(REQUEST);
                assert.deepEqual(outcome, { kind: OUTCOME.SERVICE, reason, httpStatus });
            }
        } finally {
            console.warn = originalWarn;
        }
    });

    test('a request that takes too long becomes a TIMEOUT service error', async () => {
        const fetchFn = deferredFetch();
        const outcome = await new RemoteData({ fetchFn, timeoutMs: 20 }).fetchMetadata();
        assert.deepEqual(outcome, { kind: OUTCOME.SERVICE, reason: SERVICE_REASON.TIMEOUT, httpStatus: null });
    });

    test('a new route request aborts the previous one, which becomes stale', async () => {
        const fetchFn = deferredFetch();
        const remote = new RemoteData({ fetchFn });
        const first = remote.fetchRoutes({ ...REQUEST, destination: 'X' });
        const second = remote.fetchRoutes(REQUEST);
        assert.equal(fetchFn.pending[0].init.signal.aborted, true);
        fetchFn.pending[1].resolve(response(200, ROUTE));
        assert.deepEqual(await first, { kind: OUTCOME.STALE });
        assert.equal((await second).kind, OUTCOME.OK);
    });

    test('responses arriving in reverse order: the older one is stale even if it arrives last', async () => {
        // A fetch that ignores abort, like a server that already answered.
        const resolvers = [];
        const fetchFn = () => new Promise((resolve) => resolvers.push(resolve));
        const remote = new RemoteData({ fetchFn });
        const first = remote.fetchRoutes({ ...REQUEST, destination: 'X' });
        const second = remote.fetchRoutes(REQUEST);
        resolvers[1](response(200, ROUTE));
        assert.equal((await second).kind, OUTCOME.OK);
        resolvers[0](response(200, ROUTE));
        assert.deepEqual(await first, { kind: OUTCOME.STALE });
    });

    test('cancelRoutes makes the pending request stale', async () => {
        const fetchFn = deferredFetch();
        const remote = new RemoteData({ fetchFn });
        const pending = remote.fetchRoutes(REQUEST);
        remote.cancelRoutes();
        assert.deepEqual(await pending, { kind: OUTCOME.STALE });
        remote.cancelRoutes(); // nothing pending: no effect
    });

    test('constructor checks its options', () => {
        assert.throws(() => new RemoteData({ fetchFn: 'nope' }), TypeError);
        assert.throws(() => new RemoteData({ fetchFn: async () => {}, timeoutMs: 0 }), RangeError);
        assert.doesNotThrow(() => new RemoteData());
    });
});

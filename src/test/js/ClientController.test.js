import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ClientController, TEXT, SCREEN } from '../../main/resources/public/js/controller/ClientController.js';
import { ClientState, FIELD, PROBLEM } from '../../main/resources/public/js/model/ClientState.js';
import { OUTCOME, SERVICE_REASON } from '../../main/resources/public/js/model/RemoteData.js';

const PLACES = [
    { id: 'A', label: 'Place A', xNorm: 0.1, yNorm: 0.1 },
    { id: 'X', label: 'Crossing X', xNorm: 0.5, yNorm: 0.5 },
    { id: 'D', label: 'Place D', xNorm: 0.9, yNorm: 0.9 },
];
const MAP_INFO = { imageUrl: 'images/map.png', imageWidth: 1000, imageHeight: 1000 };

const ok = (data) => ({ kind: OUTCOME.OK, data });
const meta = (version, places = PLACES) => ok({ dataVersion: version, places });
const map = (version, places = PLACES) => ok({ dataVersion: version, map: MAP_INFO, buildings: [], places });
const serviceError = { kind: OUTCOME.SERVICE, reason: SERVICE_REASON.HTTP_ERROR, httpStatus: 500 };

function routeResult(version = 'v1') {
    return ok({
        dataVersion: version,
        status: 'COMPLETE',
        identical: false,
        options: [
            {
                kind: 'FASTEST', optimal: true, distanceM: 100, walkSeconds: 80, exposedM: 50, extraSeconds: 0,
                exposureReductionM: 0,
                segments: [{ edgeId: 'E1', cover: 'outdoor', points: [{ xNorm: 0.1, yNorm: 0.1 }, { xNorm: 0.9, yNorm: 0.9 }] }],
                steps: [{ text: 'Walk', edgeIds: ['E1'] }],
            },
            {
                kind: 'LOWER_EXPOSURE', optimal: true, distanceM: 120, walkSeconds: 100, exposedM: 10, extraSeconds: 20,
                exposureReductionM: 40,
                segments: [{ edgeId: 'E2', cover: 'indoor', points: [{ xNorm: 0.1, yNorm: 0.1 }, { xNorm: 0.5, yNorm: 0.5 }] },
                    { edgeId: 'E3', cover: 'covered', points: [{ xNorm: 0.5, yNorm: 0.5 }, { xNorm: 0.9, yNorm: 0.9 }] }],
                steps: [{ text: 'Go inside', edgeIds: ['E2'] }, { text: 'Walk covered', edgeIds: ['E3'] }],
            },
        ],
    });
}

/** Records every UiPort call and keeps the registered handlers. */
function fakeUi() {
    const calls = [];
    const ui = {
        calls,
        handlers: {},
        last(name) { return [...calls].reverse().find((c) => c.name === name); },
        count(name) { return calls.filter((c) => c.name === name).length; },
    };
    for (const name of ['renderHome', 'showSelectedEndpoints', 'showFieldErrors', 'renderMap', 'renderRoutes',
        'setSelectedOption', 'renderRouteDetail', 'setSelectedStep', 'drawRoute', 'highlightEdges', 'clearRoutes',
        'showScreen', 'setBusy']) {
        ui[name] = (...args) => calls.push({ name, args });
    }
    for (const [method, key] of [['onSearch', 'search'], ['onFormChange', 'formChange'], ['onPlaceClick', 'placeClick'],
        ['onSelectOption', 'selectOption'], ['onSelectStep', 'selectStep'], ['onBack', 'back'], ['onEditTrip', 'editTrip']]) {
        ui[method] = (h) => { ui.handlers[key] = h; };
    }
    return ui;
}

/** Records every MessagePort call. */
function fakeMessages() {
    const calls = [];
    const m = { calls, last() { return calls[calls.length - 1]; } };
    for (const name of ['showLoading', 'showError', 'showInfo', 'hide', 'setDataVersion']) {
        m[name] = (...args) => calls.push({ name, args });
    }
    m.onRetry = (h) => { m.retry = h; };
    return m;
}

/** Answers each fetch method from its own queue of outcomes. */
function fakeRemote({ metas = [], maps = [], routes = [] } = {}) {
    const r = { requests: [] };
    const take = (queue, what) => {
        if (queue.length === 0) throw new Error(`unexpected ${what}`);
        const next = queue.shift();
        return typeof next === 'function' ? next() : Promise.resolve(next);
    };
    r.fetchMetadata = () => take(metas, 'fetchMetadata');
    r.fetchMapData = () => take(maps, 'fetchMapData');
    r.fetchRoutes = (request) => { r.requests.push(request); return take(routes, 'fetchRoutes'); };
    r.cancelled = 0;
    r.cancelRoutes = () => { r.cancelled++; };
    return r;
}

function setup(remoteQueues) {
    const ui = fakeUi();
    const messages = fakeMessages();
    const state = new ClientState();
    const remote = fakeRemote(remoteQueues);
    const controller = new ClientController({ ui, messages, state, remoteData: remote });
    return { ui, messages, state, remote, controller };
}

const FORM = { origin: 'A', destination: 'D', departure: '', maxExtraMinutes: 2 };

describe('ClientController.init', () => {
    test('loads meta and map, then draws map, form and data version', async () => {
        const { ui, messages, state, controller } = setup({ metas: [meta('v1')], maps: [map('v1')] });
        assert.equal(await controller.init(), true);
        assert.deepEqual(messages.calls[0], { name: 'showLoading', args: [TEXT.LOADING_MAP] });
        assert.equal(messages.last().name, 'hide');
        assert.ok(messages.calls.some((c) => c.name === 'setDataVersion' && c.args[0] === 'v1'));
        assert.equal(state.getDataVersion(), 'v1');
        assert.equal(ui.last('renderMap').args[1].length, 3);
        assert.equal(ui.last('renderHome').args[0].length, 3);
    });

    test('uses the meta places when the map has none', async () => {
        const { state, controller } = setup({ metas: [meta('v1')], maps: [map('v1', [])] });
        await controller.init();
        assert.equal(state.getPlaces().length, 3);
    });

    test('a service error shows Retry, and Retry loads again', async () => {
        const { messages, controller } = setup({
            metas: [serviceError, meta('v1')], maps: [map('v1'), map('v1')],
        });
        assert.equal(await controller.init(), false);
        assert.deepEqual(messages.last(), { name: 'showError', args: [TEXT.SERVICE_ERROR, { retry: true }] });
        await messages.retry();
        assert.equal(messages.last().name, 'hide');
    });

    test('meta and map from different versions are fetched again', async () => {
        const { state, controller } = setup({ metas: [meta('v1'), meta('v2')], maps: [map('v2'), map('v2')] });
        assert.equal(await controller.init(), true);
        assert.equal(state.getDataVersion(), 'v2');
    });

    test('versions that keep disagreeing end in a service error', async () => {
        const { messages, controller } = setup({ metas: [meta('v1'), meta('v1')], maps: [map('v2'), map('v3')] });
        assert.equal(await controller.init(), false);
        assert.equal(messages.last().name, 'showError');
    });

    test('constructor requires ui and messages', () => {
        assert.throws(() => new ClientController({ messages: fakeMessages() }), TypeError);
    });
});

describe('ClientController.handleSearchRoutes', () => {
    test('an invalid form shows field errors and sends nothing', async () => {
        const { ui, remote, controller } = setup({ metas: [meta('v1')], maps: [map('v1')] });
        await controller.init();
        await ui.handlers.search({ origin: 'A', destination: 'A', maxExtraMinutes: -1 });
        assert.deepEqual(ui.last('showFieldErrors').args[0], [
            { field: FIELD.DESTINATION, problem: PROBLEM.IDENTICAL_ENDPOINTS },
            { field: FIELD.MAX_EXTRA_MINUTES, problem: PROBLEM.NEGATIVE },
        ]);
        assert.equal(remote.requests.length, 0);
    });

    test('a valid search clears the old result, shows loading, then the routes', async () => {
        const { ui, messages, state, remote, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [routeResult()],
        });
        await controller.init();
        await ui.handlers.search({ ...FORM, departure: '2026-11-05T09:50' });

        assert.deepEqual(remote.requests[0],
            { origin: 'A', destination: 'D', maxExtraMinutes: 2, departure: '2026-11-05T09:50' });
        assert.deepEqual(ui.last('showFieldErrors').args[0], []);
        assert.equal(ui.count('clearRoutes'), 1);
        assert.equal(ui.last('showScreen').args[0], SCREEN.PLAN);
        assert.ok(messages.calls.some((c) => c.name === 'showLoading' && c.args[0] === TEXT.SEARCHING));
        assert.equal(messages.last().name, 'hide');
        assert.deepEqual(ui.calls.filter((c) => c.name === 'setBusy').map((c) => c.args[0]), [true, false]);

        const rendered = ui.last('renderRoutes');
        assert.equal(rendered.args[0].options.length, 2);
        assert.deepEqual(rendered.args[1], remote.requests[0]);
        assert.equal(state.getSelectedOption().kind, 'FASTEST');
        assert.equal(ui.last('setSelectedOption').args[0], 'FASTEST');
        assert.equal(ui.last('drawRoute').args[0][0].edgeId, 'E1');
        assert.equal(ui.count('renderRouteDetail'), 0); // detail opens only when a card is chosen
    });

    test('choosing a card opens the detail screen; steps highlight; Back returns', async () => {
        const { ui, state, controller } = setup({ metas: [meta('v1')], maps: [map('v1')], routes: [routeResult()] });
        await controller.init();
        await controller.handleSearchRoutes(FORM);

        ui.handlers.selectOption('LOWER_EXPOSURE');
        assert.equal(ui.last('setSelectedOption').args[0], 'LOWER_EXPOSURE');
        assert.equal(ui.last('renderRouteDetail').args[0].kind, 'LOWER_EXPOSURE');
        assert.equal(ui.last('drawRoute').args[0].length, 2);
        assert.equal(ui.last('setSelectedStep').args[0], null);
        assert.equal(ui.last('showScreen').args[0], SCREEN.DETAIL);

        ui.handlers.selectStep(1);
        assert.equal(ui.last('setSelectedStep').args[0], 1);
        assert.deepEqual(ui.last('highlightEdges').args[0], ['E3']);

        ui.handlers.back();
        assert.equal(ui.last('showScreen').args[0], SCREEN.PLAN);
        assert.deepEqual(ui.last('highlightEdges').args[0], []);
        assert.equal(state.getSelectedStepIndex(), null);
        assert.equal(state.getSelectedOption().kind, 'LOWER_EXPOSURE');
    });

    test('Back with no result still returns to the plan screen', () => {
        const { ui } = setup({});
        ui.handlers.back();
        assert.equal(ui.last('showScreen').args[0], SCREEN.PLAN);
    });

    test('Edit trip removes the result but keeps the form', async () => {
        const { ui, state, controller } = setup({ metas: [meta('v1')], maps: [map('v1')], routes: [routeResult()] });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        ui.handlers.editTrip();
        assert.equal(state.getRouteResult(), null);
        assert.equal(state.getOrigin(), 'A');
        assert.equal(ui.last('showScreen').args[0], SCREEN.PLAN);
        assert.equal(ui.count('clearRoutes'), 2);
    });

    test('changing the form while a search runs abandons that search', async () => {
        let release;
        const pending = () => new Promise((resolve) => { release = resolve; });
        const { ui, messages, remote, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [pending],
        });
        await controller.init();
        const search = controller.handleSearchRoutes(FORM);
        ui.handlers.formChange({ destination: 'X' });
        assert.equal(remote.cancelled, 1);
        assert.equal(ui.last('setBusy').args[0], false);
        assert.equal(messages.last().name, 'hide');
        assert.deepEqual(ui.last('showSelectedEndpoints').args[0], { origin: 'A', destination: 'X' });

        release({ kind: OUTCOME.STALE }); // what RemoteData answers after cancelRoutes
        await search;
        assert.equal(ui.count('renderRoutes'), 0);
    });

    test('Edit trip during a search also abandons it', async () => {
        let release;
        const { ui, remote, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [() => new Promise((r) => { release = r; })],
        });
        await controller.init();
        const search = controller.handleSearchRoutes(FORM);
        ui.handlers.editTrip();
        assert.equal(remote.cancelled, 1);
        release({ kind: OUTCOME.STALE });
        await search;
        ui.handlers.formChange({ origin: 'X' }); // nothing running: no second cancel
        assert.equal(remote.cancelled, 1);
    });

    test('no route: the result is shown and no option is selected', async () => {
        const noRoute = ok({ dataVersion: 'v1', status: 'NO_FEASIBLE_ROUTE', identical: false, options: [] });
        const { ui, messages, controller } = setup({ metas: [meta('v1')], maps: [map('v1')], routes: [noRoute] });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.equal(ui.last('renderRoutes').args[0].status, 'NO_FEASIBLE_ROUTE');
        assert.equal(ui.last('setSelectedOption').args[0], null);
        assert.deepEqual(ui.last('drawRoute').args[0], []);
        assert.equal(ui.count('renderRouteDetail'), 0);
        assert.equal(messages.last().name, 'hide');
    });

    test('an incomplete search shows the routes and an information message', async () => {
        const incomplete = routeResult();
        incomplete.data.status = 'INCOMPLETE';
        const { ui, messages, controller } = setup({ metas: [meta('v1')], maps: [map('v1')], routes: [incomplete] });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.deepEqual(messages.last(), { name: 'showInfo', args: [TEXT.INCOMPLETE] });
        assert.equal(ui.count('renderRoutes'), 1);
    });

    test("the server's field errors are shown next to the inputs", async () => {
        const fields = [{ field: 'departure', problem: 'NONEXISTENT_LOCAL_TIME' }];
        const { ui, messages, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [{ kind: OUTCOME.VALIDATION, fields, dataVersion: 'v1' }],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.deepEqual(ui.last('showFieldErrors').args[0], fields);
        assert.equal(messages.last().name, 'hide');
        assert.equal(ui.count('renderRoutes'), 0);
    });

    test('a service error shows Retry, and Retry sends the same query again', async () => {
        const { ui, messages, remote, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [serviceError, routeResult()],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.deepEqual(messages.last(), { name: 'showError', args: [TEXT.SERVICE_ERROR, { retry: true }] });
        assert.equal(ui.count('renderRoutes'), 0);

        await messages.retry();
        assert.deepEqual(remote.requests[1], remote.requests[0]);
        assert.equal(ui.count('renderRoutes'), 1);
    });

    test('an unknown outcome kind is treated as a service error', async () => {
        const { messages, controller } = setup({ metas: [meta('v1')], maps: [map('v1')], routes: [{ kind: 'weird' }] });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.equal(messages.last().name, 'showError');
    });

    test('a stale outcome changes nothing on the page', async () => {
        const { ui, messages, controller } = setup({
            metas: [meta('v1')], maps: [map('v1')], routes: [{ kind: OUTCOME.STALE }],
        });
        await controller.init();
        const before = messages.calls.length;
        await controller.handleSearchRoutes(FORM);
        assert.equal(ui.count('renderRoutes'), 0);
        // only the "searching" message was shown; nothing after the stale answer
        assert.deepEqual(messages.calls.slice(before).map((c) => c.name), ['showLoading']);
    });

    test('Retry with nothing to retry does nothing', async () => {
        const { messages, controller } = setup({});
        await controller.retry();
        assert.equal(messages.calls.length, 0);
    });
});

describe('ClientController data version changes', () => {
    test('a route from a newer data version reloads the map and re-sends the query once', async () => {
        const { ui, state, remote, controller } = setup({
            metas: [meta('v1'), meta('v2')],
            maps: [map('v1'), map('v2')],
            routes: [routeResult('v2'), routeResult('v2')],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.equal(state.getDataVersion(), 'v2');
        assert.equal(remote.requests.length, 2);
        assert.equal(ui.count('renderMap'), 2);
        assert.equal(ui.count('renderRoutes'), 1);
    });

    test('if the version changes again, the user is asked to search again', async () => {
        const { ui, messages, controller } = setup({
            metas: [meta('v1'), meta('v2'), meta('v3')],
            maps: [map('v1'), map('v2'), map('v3')],
            routes: [routeResult('v2'), routeResult('v3')],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.deepEqual(messages.last(), { name: 'showInfo', args: [TEXT.DATA_UPDATED] });
        assert.equal(ui.count('renderRoutes'), 0);
    });

    test('if a chosen place disappeared in the new data, the query is not re-sent', async () => {
        const fewer = [PLACES[0], PLACES[1]];
        const { ui, messages, remote, state, controller } = setup({
            metas: [meta('v1'), meta('v2', fewer)],
            maps: [map('v1'), map('v2', fewer)],
            routes: [routeResult('v2')],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.equal(remote.requests.length, 1);
        assert.equal(state.getDestination(), null);
        assert.deepEqual(ui.last('showFieldErrors').args[0], [{ field: FIELD.DESTINATION, problem: PROBLEM.MISSING }]);
        assert.deepEqual(messages.last(), { name: 'showInfo', args: [TEXT.DATA_UPDATED] });
    });

    test('a failure while reloading the map shows a service error', async () => {
        const { messages, controller } = setup({
            metas: [meta('v1'), serviceError], maps: [map('v1'), map('v2')], routes: [routeResult('v2')],
        });
        await controller.init();
        await controller.handleSearchRoutes(FORM);
        assert.equal(messages.last().name, 'showError');
    });
});

describe('ClientController place clicks', () => {
    test('place clicks fill origin, then destination, then start over', async () => {
        const { ui, state, controller } = setup({ metas: [meta('v1')], maps: [map('v1')] });
        await controller.init();
        ui.handlers.placeClick('A');
        assert.equal(state.getOrigin(), 'A');
        ui.handlers.placeClick('A'); // same place again: start over with it as origin
        assert.deepEqual([state.getOrigin(), state.getDestination()], ['A', null]);
        ui.handlers.placeClick('D');
        assert.deepEqual(ui.last('showSelectedEndpoints').args[0], { origin: 'A', destination: 'D' });
        ui.handlers.placeClick('X'); // both set: start over
        assert.deepEqual([state.getOrigin(), state.getDestination()], ['X', null]);
        ui.handlers.placeClick('NOT-A-PLACE');
        assert.equal(state.getOrigin(), 'X');
    });

});

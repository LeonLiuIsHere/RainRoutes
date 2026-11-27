import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { start, ELEMENT_IDS, toViewMap, toViewResult } from '../../main/resources/public/js/main.js';
import { RemoteData } from '../../main/resources/public/js/model/RemoteData.js';

/**
 * These tests check that main.js drives views that have exactly the interface
 * Yuki described (constructor(container), "in" methods, on...() callbacks).
 */

class FakeElement {
    constructor() { this.dataset = {}; this.attrs = new Set(); }
    toggleAttribute(name, on) { if (on) this.attrs.add(name); else this.attrs.delete(name); }
}
function fakeDocument(ids = Object.values(ELEMENT_IDS)) {
    const els = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
    return { els, getElementById: (id) => els[id] ?? null };
}

/** Builds a fake view class that records "in" calls and stores on...() callbacks. */
function fakeViewClass(name, log) {
    return class {
        constructor(container, footer) {
            this.container = container;
            this.footer = footer;
            this.cb = {};
            log[name] = this;
            this.calls = [];
            return new Proxy(this, {
                get(target, prop) {
                    if (prop in target || typeof prop !== 'string') return target[prop];
                    if (prop.startsWith('on')) return (cb) => { target.cb[prop] = cb; };
                    return (...args) => { target.calls.push({ prop, args }); };
                },
            });
        }
        last(prop) { return [...this.calls].reverse().find((c) => c.prop === prop); }
    };
}

const RESPONSES = {
    '/api/meta': { dataVersion: 'v1', places: [{ id: 'N-1', xNorm: 0.1, yNorm: 0.1, label: 'Origin' },
        { id: 'N-2', xNorm: 0.2, yNorm: 0.2, label: 'Destination' }] },
    '/api/map': { dataVersion: 'v1', map: { imageUrl: 'map.png', imageWidth: 1000, imageHeight: 1000 },
        buildings: [{ id: 'B', name: 'Bldg', outline: [{ xNorm: 0.1, yNorm: 0.1 }, { xNorm: 0.2, yNorm: 0.1 }, { xNorm: 0.2, yNorm: 0.2 }] }],
        places: [{ id: 'N-1', xNorm: 0.1, yNorm: 0.1, label: 'Origin' }, { id: 'N-2', xNorm: 0.2, yNorm: 0.2, label: 'Destination' }] },
    '/api/routes': { dataVersion: 'v1', status: 'COMPLETE', identical: true, options: [{
        kind: 'FASTEST', distanceM: 100, walkSeconds: 80, exposedM: 50, extraSeconds: 0, exposureReductionM: 0,
        segments: [{ edgeId: 'E-1', cover: 'OUTDOOR', points: [{ xNorm: 0.1, yNorm: 0.1 }, { xNorm: 0.2, yNorm: 0.2 }] }],
        steps: [{ text: 'Walk 100 m outdoors.', edgeIds: ['E-1'] }] }] },
};
const fetchFn = async (url) => ({ status: 200, text: async () => JSON.stringify(RESPONSES[url]) });

async function boot() {
    const log = {};
    const classes = {};
    for (const name of ['HomeView', 'MapView', 'RouteComparisonView', 'RouteDetailView', 'MessageView']) {
        classes[name] = fakeViewClass(name, log);
    }
    classes.BottomSheet = class extends fakeViewClass('BottomSheet', log) {
        getHeight() { return 240; }
    };
    const doc = fakeDocument();
    const controller = await start(doc, classes, { remoteData: new RemoteData({ fetchFn }) });
    return { log, doc, controller };
}

describe('main.js with views that follow Yuki\'s interface', () => {
    test('startup: views get their containers, places, map and data version', async () => {
        const { log, doc } = await boot();
        const { HomeView: home, MapView: map, MessageView: messages, BottomSheet: sheet } = log;
        assert.equal(home.container, doc.els[ELEMENT_IDS.home]);
        assert.equal(messages.container, doc.els[ELEMENT_IDS.app]);
        assert.equal(messages.footer, doc.els[ELEMENT_IDS.footer]);
        assert.equal(sheet.container, doc.els[ELEMENT_IDS.layout]);
        assert.ok(home.last('render'));
        assert.deepEqual(home.last('setPlaces').args[0], [{ id: 'N-1', label: 'Origin' }, { id: 'N-2', label: 'Destination' }]);
        const mapData = map.last('renderMap').args[0];
        assert.deepEqual(mapData.buildings[0].outline, [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]]);
        assert.deepEqual(mapData.places[0], { id: 'N-1', label: 'Origin', x: 0.1, y: 0.1 });
        assert.equal(mapData.imageUrl, 'map.png');
        assert.equal(mapData.width, 1000);
        assert.deepEqual(map.last('setSelected').args[0], { origin: null, destination: null });
        assert.deepEqual(messages.last('setDataVersion').args, ['v1']);
        assert.deepEqual(map.last('setBottomInset').args, [240]);
        assert.equal(doc.els[ELEMENT_IDS.layout].dataset.screen, 'plan');

        sheet.cb.onChange(300); // the user dragged the sheet
        assert.deepEqual(map.last('setBottomInset').args, [300]);
        assert.ok(map.last('refit'));
    });

    test('search, open a card, select a step, go back', async () => {
        const { log, doc } = await boot();
        const { HomeView: home, MapView: map, RouteComparisonView: cmp, RouteDetailView: detail, BottomSheet: sheet } = log;
        const panel = doc.els[ELEMENT_IDS.layout];

        await home.cb.onSearch({ origin: 'N-1', destination: 'N-2', departure: '', maxExtraMinutes: 2 });
        const result = cmp.last('render').args[0];
        assert.equal(result.status, 'COMPLETE');
        assert.deepEqual(result.options[0].segments[0].points, [[0.1, 0.1], [0.2, 0.2]]);
        assert.equal(result.options[0].segments[0].cover, 'outdoor');
        assert.deepEqual(cmp.last('setSelected').args, ['FASTEST']);
        assert.deepEqual(map.last('renderRoute').args[0][0].edgeId, 'E-1');
        assert.deepEqual(sheet.last('setState').args, ['half']);
        assert.ok(detail.last('clear'));

        cmp.cb.onSelect('FASTEST');
        assert.equal(detail.last('render').args[0].kind, 'FASTEST');
        assert.equal(panel.dataset.screen, 'detail');

        detail.cb.onStepSelect(0);
        assert.deepEqual(detail.last('setSelectedStep').args, [0]);
        assert.deepEqual(map.last('highlightSegments').args, [['E-1']]);

        const stepCalls = detail.calls.filter((c) => c.prop === 'setSelectedStep').length;
        detail.cb.onBack();
        assert.equal(panel.dataset.screen, 'plan');
        assert.deepEqual(map.last('highlightSegments').args, [[]]);
        assert.equal(detail.calls.filter((c) => c.prop === 'setSelectedStep').length, stepCalls); // null is not passed on
        assert.ok(sheet.last('scrollToTop'));

        cmp.cb.onEditTrip();
        assert.ok(cmp.last('clear'));
        assert.deepEqual(home.last('showFieldErrors').args, [[]]);
    });

    test('map clicks and form changes update both the form and the map', async () => {
        const { log } = await boot();
        const { HomeView: home, MapView: map } = log;
        map.cb.onPlaceClick('N-2');
        assert.deepEqual(home.last('setValues').args[0], { origin: 'N-2', destination: null });
        map.cb.onPlaceClick('N-1');
        assert.deepEqual(home.last('setValues').args[0], { origin: 'N-2', destination: 'N-1' });
        map.cb.onPlaceClick('N-1'); // both set: start over
        assert.deepEqual(home.last('setValues').args[0], { origin: 'N-1', destination: null });
        home.cb.onChange({ origin: 'N-1', destination: 'N-2' });
        assert.deepEqual(map.last('setSelected').args[0], { origin: 'N-1', destination: 'N-2' });
    });

    test('invalid form: errors go to HomeView.showFieldErrors', async () => {
        const { log } = await boot();
        await log.HomeView.cb.onSearch({ origin: 'N-1', destination: 'N-1', departure: '', maxExtraMinutes: 2 });
        assert.deepEqual(log.HomeView.last('showFieldErrors').args[0], [{ field: 'destination', problem: 'IDENTICAL_ENDPOINTS' }]);
    });

    test('a missing element is reported by id', async () => {
        const doc = fakeDocument(['map']);
        await assert.rejects(start(doc, {}), /missing elements with id: app, layout/);
    });

    test('shape helpers keep the original objects unchanged', () => {
        const mapData = { map: { imageUrl: 'm.png' }, buildings: [{ id: 'B', name: 'B', outline: [{ xNorm: 0, yNorm: 1 }] }] };
        assert.deepEqual(toViewMap(mapData, []).buildings[0].outline, [[0, 1]]);
        assert.equal(toViewMap(mapData, []).width, undefined);
        assert.deepEqual(mapData.buildings[0].outline, [{ xNorm: 0, yNorm: 1 }]);
        const r = toViewResult({ status: 'NO_FEASIBLE_ROUTE', options: [] });
        assert.deepEqual(r.options, []);
    });
});

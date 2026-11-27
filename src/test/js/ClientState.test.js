import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    ClientState, FIELD, PROBLEM, DEFAULT_MAX_EXTRA_MINUTES, isValidLocalDateTime,
} from '../../main/resources/public/js/model/ClientState.js';

const PLACES = [
    { id: 'A', label: 'Place A', xNorm: 0.1, yNorm: 0.1 },
    { id: 'X', label: 'Crossing X', xNorm: 0.5, yNorm: 0.5 },
    { id: 'D', label: 'Place D', xNorm: 0.9, yNorm: 0.9 },
];

function stateWithPlaces() {
    const s = new ClientState();
    s.setPlaces(PLACES);
    return s;
}

const RESULT = {
    dataVersion: 'v1',
    status: 'COMPLETE',
    identical: false,
    options: [
        { kind: 'FASTEST', steps: [{ text: 's1', edgeIds: ['E1'] }, { text: 's2', edgeIds: ['E2'] }], segments: [] },
        { kind: 'LOWER_EXPOSURE', steps: [{ text: 't1', edgeIds: ['E3'] }], segments: [] },
    ],
};

describe('isValidLocalDateTime', () => {
    test('accepts real local date-times with or without seconds', () => {
        assert.equal(isValidLocalDateTime('2026-11-05T09:50'), true);
        assert.equal(isValidLocalDateTime('2026-11-05T23:59:59'), true);
        assert.equal(isValidLocalDateTime('2028-02-29T00:00'), true);
    });
    test('rejects impossible dates, times and wrong formats', () => {
        for (const bad of ['2026-02-29T10:00', '2026-02-30T10:00', '2026-13-01T10:00', '2026-11-05T24:00',
            '2026-11-05T10:60', '2026-11-05 10:00', '2026-11-05', '', 'now', null, 12345]) {
            assert.equal(isValidLocalDateTime(bad), false, String(bad));
        }
    });
});

describe('ClientState form', () => {
    test('starts empty with departure "now" and the default extra time', () => {
        const s = new ClientState();
        assert.deepEqual(s.getForm(), {
            origin: null, destination: null, departure: '', maxExtraMinutes: DEFAULT_MAX_EXTRA_MINUTES,
        });
    });

    test('reports missing endpoints', () => {
        const errors = stateWithPlaces().validateForm();
        assert.deepEqual(errors, [
            { field: FIELD.ORIGIN, problem: PROBLEM.MISSING },
            { field: FIELD.DESTINATION, problem: PROBLEM.MISSING },
        ]);
    });

    test('reports identical endpoints and unknown places', () => {
        const s = stateWithPlaces();
        s.applyForm({ origin: 'A', destination: 'A' });
        assert.deepEqual(s.validateForm(), [{ field: FIELD.DESTINATION, problem: PROBLEM.IDENTICAL_ENDPOINTS }]);
        s.applyForm({ destination: 'NOPE' });
        assert.deepEqual(s.validateForm(), [{ field: FIELD.DESTINATION, problem: PROBLEM.UNKNOWN_PLACE }]);
    });

    test('reports invalid departure times but keeps the text the user typed', () => {
        const s = stateWithPlaces();
        s.applyForm({ origin: 'A', destination: 'D', departure: ' 2026-02-30T10:00 ' });
        assert.equal(s.getDeparture(), '2026-02-30T10:00');
        assert.deepEqual(s.validateForm(), [{ field: FIELD.DEPARTURE, problem: PROBLEM.INVALID_TIME }]);
    });

    test('checks the extra walking time: missing, not finite, negative', () => {
        const s = stateWithPlaces();
        s.applyForm({ origin: 'A', destination: 'D' });
        const problemFor = (value) => {
            s.setMaxExtraMinutes(value);
            const e = s.validateForm().find((x) => x.field === FIELD.MAX_EXTRA_MINUTES);
            return e === undefined ? null : e.problem;
        };
        assert.equal(problemFor(''), PROBLEM.MISSING);
        assert.equal(problemFor(null), PROBLEM.MISSING);
        assert.equal(problemFor('abc'), PROBLEM.NOT_FINITE);
        assert.equal(problemFor('Infinity'), PROBLEM.NOT_FINITE);
        assert.equal(problemFor(Number.NaN), PROBLEM.NOT_FINITE);
        assert.equal(problemFor(-1), PROBLEM.NEGATIVE);
        assert.equal(problemFor(0), null);
        assert.equal(problemFor('5'), null);
        assert.equal(s.getMaxExtraMinutes(), 5);
        assert.equal(problemFor(7.5), null);
    });

    test('toRouteRequest omits departure for "now" and includes it otherwise', () => {
        const s = stateWithPlaces();
        s.applyForm({ origin: 'A', destination: 'D', maxExtraMinutes: 2 });
        assert.deepEqual(s.toRouteRequest(), { origin: 'A', destination: 'D', maxExtraMinutes: 2 });
        s.setDeparture('2026-11-05T09:50');
        assert.deepEqual(s.toRouteRequest(),
            { origin: 'A', destination: 'D', maxExtraMinutes: 2, departure: '2026-11-05T09:50' });
    });

    test('toRouteRequest throws for an invalid form', () => {
        assert.throws(() => stateWithPlaces().toRouteRequest(), Error);
    });

    test('blank ids become null and swapEndpoints exchanges them', () => {
        const s = stateWithPlaces();
        s.setOrigin('  ');
        assert.equal(s.getOrigin(), null);
        s.applyForm({ origin: 'A', destination: 'D' });
        s.swapEndpoints();
        assert.equal(s.getOrigin(), 'D');
        assert.equal(s.getDestination(), 'A');
    });

    test('getForm returns a copy', () => {
        const s = stateWithPlaces();
        s.getForm().origin = 'A';
        assert.equal(s.getOrigin(), null);
    });

    test('applyForm rejects non-objects', () => {
        assert.throws(() => new ClientState().applyForm(null), TypeError);
    });
});

describe('ClientState places and data', () => {
    test('setPlaces clears endpoints that are no longer selectable', () => {
        const s = stateWithPlaces();
        s.applyForm({ origin: 'A', destination: 'D' });
        const cleared = s.setPlaces([PLACES[0], PLACES[1]]);
        assert.deepEqual(cleared, [FIELD.DESTINATION]);
        assert.equal(s.getOrigin(), 'A');
        assert.equal(s.getDestination(), null);
    });

    test('setPlaces rejects duplicates and malformed input', () => {
        const s = new ClientState();
        assert.throws(() => s.setPlaces([PLACES[0], PLACES[0]]), RangeError);
        assert.throws(() => s.setPlaces([{ label: 'no id' }]), TypeError);
        assert.throws(() => s.setPlaces('x'), TypeError);
    });

    test('stored places are frozen copies', () => {
        const input = structuredClone(PLACES);
        const s = new ClientState();
        s.setPlaces(input);
        input[0].label = 'changed';
        assert.equal(s.getPlace('A').label, 'Place A');
        assert.throws(() => { s.getPlaces()[0].label = 'x'; }, TypeError);
        assert.equal(s.getPlace('missing'), null);
    });

    test('data version and map data', () => {
        const s = new ClientState();
        assert.equal(s.getDataVersion(), null);
        s.setDataVersion('v1');
        assert.equal(s.getDataVersion(), 'v1');
        assert.throws(() => s.setDataVersion(''), TypeError);
        s.setMapData({ map: { imageUrl: 'm.png' }, buildings: [] });
        assert.equal(s.getMapData().map.imageUrl, 'm.png');
        assert.throws(() => s.setMapData(null), TypeError);
    });
});

describe('ClientState route result', () => {
    test('stores result and query, selects the first option', () => {
        const s = stateWithPlaces();
        const query = { origin: 'A', destination: 'D', maxExtraMinutes: 2 };
        s.setRouteResult(RESULT, query);
        assert.equal(s.getSelectedOption().kind, 'FASTEST');
        assert.deepEqual(s.getRouteQuery(), query);
        assert.equal(s.getSelectedStep(), null);
        assert.throws(() => { s.getRouteResult().status = 'X'; }, TypeError);
    });

    test('a result with no options selects nothing', () => {
        const s = stateWithPlaces();
        s.setRouteResult({ dataVersion: 'v1', status: 'NO_FEASIBLE_ROUTE', identical: false, options: [] }, {});
        assert.equal(s.getSelectedOption(), null);
        assert.throws(() => s.selectStep(0), RangeError);
    });

    test('selectOption and selectStep', () => {
        const s = stateWithPlaces();
        s.setRouteResult(RESULT, {});
        s.selectStep(1);
        assert.equal(s.getSelectedStep().text, 's2');
        s.selectOption('LOWER_EXPOSURE');
        assert.equal(s.getSelectedStepIndex(), null);
        assert.throws(() => s.selectStep(1), RangeError);
        assert.throws(() => s.selectStep(-1), RangeError);
        assert.throws(() => s.selectStep(0.5), RangeError);
        s.selectStep(0);
        assert.equal(s.getSelectedStep().text, 't1');
        s.selectStep(null);
        assert.equal(s.getSelectedStep(), null);
        assert.throws(() => s.selectOption('BOGUS'), RangeError);
    });

    test('clearRouteResult removes everything', () => {
        const s = stateWithPlaces();
        s.setRouteResult(RESULT, {});
        s.clearRouteResult();
        assert.equal(s.getRouteResult(), null);
        assert.equal(s.getRouteQuery(), null);
        assert.equal(s.getSelectedOption(), null);
        assert.throws(() => s.selectOption('FASTEST'), RangeError);
    });

    test('setRouteResult checks its arguments', () => {
        const s = new ClientState();
        assert.throws(() => s.setRouteResult({}, {}), TypeError);
        assert.throws(() => s.setRouteResult(RESULT, null), TypeError);
    });
});

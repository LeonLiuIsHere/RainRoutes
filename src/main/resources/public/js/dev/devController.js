import { HomeView } from '../views/HomeView.js';
import { MapView } from '../views/MapView.js';
import { RouteComparisonView } from '../views/RouteComparisonView.js';
import { RouteDetailView } from '../views/RouteDetailView.js';
import { MessageView } from '../views/MessageView.js';
import { BottomSheet } from '../views/BottomSheet.js';
import { fakeMap, fakeMeta, scenarios } from './fakeData.js';

/**
 * A stand-in for ClientController, only for testing the views without a server.
 * It does what the real controller will do: create views, feed them data, react to their callbacks.
 * @param {{home, cmp, detail, map, app, layout, footer}} els containers from dev.html (layout = the bottom sheet element)
 * @param {() => string} getScenario 'two' | 'same' | 'none' | 'error'
 */
export function startDev(els, getScenario) {
    const home = new HomeView(els.home);
    const map = new MapView(els.map);
    const cmp = new RouteComparisonView(els.cmp);
    const detail = new RouteDetailView(els.detail);
    const messages = new MessageView(els.app, els.footer);
    const sheet = new BottomSheet(els.layout); // moves home/cmp/detail/footer into the sheet

    // the sheet covers the bottom of the map: keep routes in the part you can still see
    map.setBottomInset(sheet.getHeight());
    sheet.onChange((height) => { map.setBottomInset(height); map.refit(); });

    let result = null;
    let lastSearch = null;

    // page start (= GET /api/meta and /api/map)
    home.render();
    home.setPlaces(fakeMeta.places);
    map.renderMap(fakeMap);
    messages.setDataVersion(fakeMeta.dataVersion);

    // Two screens: 'plan' (form + options) and 'detail' (steps). CSS reads data-screen.
    function setScreen(name) {
        els.layout.dataset.screen = name;
        sheet.scrollToTop();
    }

    // just draw the route on the map (preview on the plan screen)
    function previewOption(kind) {
        const option = result.options.find((o) => o.kind === kind);
        map.renderRoute(option.segments);
        cmp.setSelected(kind);
        return option;
    }

    // user chose an option: show its steps on the detail screen
    function openDetail(kind) {
        detail.render(previewOption(kind));
        setScreen('detail');
        sheet.setState('half');
    }

    function search(values) {
        // the real controller checks required fields before sending
        const errors = [];
        if (!values.origin) errors.push({ field: 'origin', problem: 'MISSING' });
        if (!values.destination) errors.push({ field: 'destination', problem: 'MISSING' });
        if (values.origin && values.origin === values.destination) errors.push({ field: 'destination', problem: 'IDENTICAL_ENDPOINTS' });
        if (!values.departure) errors.push({ field: 'departure', problem: 'INVALID_TIME' });
        if (values.maxExtraMinutes === null || values.maxExtraMinutes < 0) errors.push({ field: 'maxExtraMinutes', problem: 'NEGATIVE' });
        if (errors.length) { home.showFieldErrors(errors); return; }

        lastSearch = values;
        messages.showLoading();
        setTimeout(() => { // pretend the server takes a moment
            const scenario = getScenario();
            if (scenario === 'error') {
                messages.showError('Service error. Check your connection and try again.');
                return;
            }
            messages.hide();
            result = scenarios[scenario];
            cmp.render(result);
            setScreen('plan');
            sheet.setState('half');
            detail.clear();
            if (result.options.length) {
                previewOption(result.options[0].kind);
            } else {
                map.renderRoute([]);
            }
        }, 400);
    }

    home.onSearch(search);
    messages.bindRetry(() => search(lastSearch));
    cmp.onSelect(openDetail);
    detail.onBack(() => { map.highlightSegments([]); setScreen('plan'); });
    cmp.onEditTrip(() => home.showFieldErrors([]));
    home.onChange((v) => map.setSelected({ origin: v.origin, destination: v.destination }));
    detail.onStepSelect((i) => {
        const option = detail.option;
        map.highlightSegments(option.steps[i].edgeIds);
    });
    map.onPlaceClick((id) => {
        const cur = home.getValues();
        let { origin, destination } = cur;
        if (!origin) origin = id;
        else if (!destination && id !== origin) destination = id;
        else { origin = id; destination = null; }
        home.setValues({ origin, destination });
        map.setSelected({ origin, destination });
    });

    return { home, map, cmp, detail, messages, sheet };
}

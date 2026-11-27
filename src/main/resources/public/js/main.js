import { ClientController } from './controller/ClientController.js';
import { MessageView } from './views/MessageView.js';
import { HomeView } from './views/HomeView.js';
import { MapView } from './views/MapView.js';
import { RouteComparisonView } from './views/RouteComparisonView.js';
import { RouteDetailView } from './views/RouteDetailView.js';
import { BottomSheet } from './views/BottomSheet.js';

/**
 * Page entry point: builds Yuki's views, connects them to ClientController and
 * starts the app. index.html loads it with
 *   <script type="module" src="js/main.js"></script>
 *
 * This is the only file that knows both the controller's UiPort and the views'
 * own methods. If a view's methods or the data shape a view expects change,
 * adjust this file; ClientController does not change.
 */

/** Element ids, the same as in dev.html. `layout` becomes the bottom sheet. */
export const ELEMENT_IDS = Object.freeze({
    app: 'app',
    map: 'map',
    layout: 'layout',
    home: 'home',
    comparison: 'cmp',
    detail: 'detail',
    footer: 'footer',
});

/**
 * @precondition none
 * @postcondition returns the elements named in ELEMENT_IDS
 * @param {Document} doc
 * @returns {Record<string, HTMLElement>}
 * @throws {Error} naming every missing id
 */
function findElements(doc) {
    const missing = Object.values(ELEMENT_IDS).filter((id) => doc.getElementById(id) === null);
    if (missing.length > 0) {
        throw new Error(`index.html is missing elements with id: ${missing.join(', ')}`);
    }
    return Object.fromEntries(Object.entries(ELEMENT_IDS).map(([key, id]) => [key, doc.getElementById(id)]));
}

// ---------------------------------------------------------------- data shapes for the views
// ClientState stores points as {xNorm, yNorm}. Yuki's views take points as
// [x, y], places as {id, label, x, y} and the map as one flat object
// (see the class comment of MapView). All shape conversion happens here.

const toPair = (p) => [p.xNorm, p.yNorm];

/** The mapData object of MapView.renderMap. */
export function toViewMap(mapData, places) {
    return {
        imageUrl: mapData.map.imageUrl,
        width: mapData.map.imageWidth ?? undefined,
        height: mapData.map.imageHeight ?? undefined,
        buildings: mapData.buildings.map((b) => ({ id: b.id, name: b.name, outline: b.outline.map(toPair) })),
        places: places.map((p) => ({ id: p.id, label: p.label, x: p.xNorm, y: p.yNorm })),
    };
}

export function toViewSegments(segments) {
    return segments.map((s) => ({ edgeId: s.edgeId, cover: s.cover, points: s.points.map(toPair) }));
}

export function toViewOption(option) {
    return { ...option, segments: toViewSegments(option.segments), steps: option.steps.map((s) => ({ ...s })) };
}

/** The result object of RouteComparisonView.render (the POST /api/routes response). */
export function toViewResult(result) {
    return { ...result, options: result.options.map(toViewOption) };
}

/**
 * Adapts Yuki's views to the controller's UiPort.
 * @precondition views and elements come from start()
 * @postcondition returns an object implementing UiPort
 */
function createUi(views, elements, sheet) {
    return {
        renderHome(places) {
            views.home.setPlaces(places.map((p) => ({ id: p.id, label: p.label })));
        },
        showSelectedEndpoints(endpoints) {
            views.home.setValues({ origin: endpoints.origin, destination: endpoints.destination });
            views.map.setSelected({ origin: endpoints.origin, destination: endpoints.destination });
        },
        showFieldErrors(errors) {
            views.home.showFieldErrors(errors.map((e) => ({ field: e.field, problem: e.problem })));
        },
        renderMap(mapData, places) {
            views.map.renderMap(toViewMap(mapData, places));
        },
        renderRoutes(result) {
            views.comparison.render(toViewResult(result));
            views.detail.clear();
            sheet.setState('half');
        },
        setSelectedOption(kind) {
            views.comparison.setSelected(kind);
        },
        renderRouteDetail(option) {
            views.detail.render(toViewOption(option));
            sheet.setState('half');
        },
        setSelectedStep(index) {
            // render() already starts with no step selected, so null needs no call
            if (index !== null) {
                views.detail.setSelectedStep(index);
            }
        },
        drawRoute(segments) {
            views.map.renderRoute(toViewSegments(segments));
        },
        highlightEdges(edgeIds) {
            views.map.highlightSegments([...edgeIds]);
        },
        clearRoutes() {
            views.map.renderRoute([]);
            views.comparison.clear();
            views.detail.clear();
        },
        showScreen(screen) {
            elements.layout.dataset.screen = screen;
            sheet.scrollToTop();
        },
        setBusy(busy) {
            elements.layout.toggleAttribute('aria-busy', busy);
        },
        onSearch: (handler) => views.home.onSearch(handler),
        onFormChange: (handler) => views.home.onChange(handler),
        onPlaceClick: (handler) => views.map.onPlaceClick(handler),
        onSelectOption: (handler) => views.comparison.onSelect(handler),
        onSelectStep: (handler) => views.detail.onStepSelect(handler),
        onBack: (handler) => views.detail.onBack(handler),
        onEditTrip: (handler) => views.comparison.onEditTrip(handler),
    };
}

const VIEW_CLASSES = Object.freeze({
    HomeView, MapView, RouteComparisonView, RouteDetailView, MessageView, BottomSheet,
});

/**
 * Starts the application.
 * @precondition the DOM is loaded and contains the elements in ELEMENT_IDS;
 *   classes (for tests) provide the view classes
 * @postcondition the views are built, the controller is running and the
 *   initial data has been requested
 * @param {Document} [doc]
 * @param {Object} [classes]
 * @param {Object} [controllerOptions] extra ClientController dependencies (for tests)
 * @returns {Promise<ClientController>}
 */
export async function start(doc = document, classes = VIEW_CLASSES, controllerOptions = {}) {
    const elements = findElements(doc);
    const views = {
        home: new classes.HomeView(elements.home),
        map: new classes.MapView(elements.map),
        comparison: new classes.RouteComparisonView(elements.comparison),
        detail: new classes.RouteDetailView(elements.detail),
    };
    const messages = new classes.MessageView(elements.app, elements.footer);
    const sheet = new classes.BottomSheet(elements.layout); // moves home/cmp/detail/footer into the sheet
    views.home.render();

    // the sheet covers the bottom of the map: keep routes in the part that is still visible
    views.map.setBottomInset(sheet.getHeight());
    sheet.onChange((height) => {
        views.map.setBottomInset(height);
        views.map.refit();
    });

    const controller = new ClientController({ ui: createUi(views, elements, sheet), messages, ...controllerOptions });
    await controller.init();
    return controller;
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { start(); });
    } else {
        start();
    }
}

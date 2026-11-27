import { ClientController } from './controller/ClientController.js';
import { MessageView } from './views/MessageView.js';
import { HomeView } from './views/HomeView.js';
import { MapView } from './views/MapView.js';
import { RouteComparisonView } from './views/RouteComparisonView.js';
import { RouteDetailView } from './views/RouteDetailView.js';

/**
 * Page entry point: builds the views, connects them to ClientController and
 * starts the app. Load it from index.html with
 *   <script type="module" src="js/main.js"></script>
 *
 * This is the only file that knows both the controller's UiPort and the
 * views' own methods. If a view's method names change, adjust createUi below;
 * ClientController does not need to change.
 *
 * Expected elements in index.html (ids):
 *   home, map, routes, route-detail, messages, footer
 */

const CONTAINER_IDS = ['home', 'map', 'routes', 'route-detail', 'messages', 'footer'];

/**
 * @precondition every id in CONTAINER_IDS exists in doc
 * @postcondition returns the elements by id
 * @param {Document} doc
 * @returns {Record<string, HTMLElement>}
 * @throws {Error} naming the missing ids
 */
function findContainers(doc) {
    const missing = CONTAINER_IDS.filter((id) => doc.getElementById(id) === null);
    if (missing.length > 0) {
        throw new Error(`index.html is missing elements with id: ${missing.join(', ')}`);
    }
    return Object.fromEntries(CONTAINER_IDS.map((id) => [id, doc.getElementById(id)]));
}

/**
 * Adapts the views to the controller's UiPort. Methods that the views do not
 * have (yet) are skipped, so the page still runs while views are unfinished.
 * @precondition views and containers come from start()
 * @postcondition returns an object implementing UiPort
 */
function createUi(views, containers) {
    const call = (view, method, ...args) => {
        if (typeof view[method] === 'function') {
            return view[method](...args);
        }
        return undefined;
    };
    let homeRendered = false;
    let searchHandler = () => {};

    return {
        renderHome(places, form) {
            if (!homeRendered) {
                views.home.render(containers.home, places, form);
                views.home.bindEvents((values) => searchHandler(values));
                homeRendered = true;
            }
            call(views.home, 'setPlaces', places);
            call(views.home, 'setForm', form);
        },
        showFieldErrors(errors) {
            call(views.home, 'showFieldErrors', errors);
        },
        renderMap(mapData, places) {
            views.map.renderMap({ ...mapData, places });
        },
        renderRoutes(result, query, onSelectOption) {
            views.comparison.render(result.options, onSelectOption, result, query);
        },
        renderRouteDetail(option, onSelectStep) {
            views.detail.render(containers['route-detail'], option, onSelectStep);
        },
        highlightRoute(segments, highlightedEdgeIds) {
            views.map.renderRoute(segments, highlightedEdgeIds);
        },
        clearRoutes() {
            views.map.renderRoute([], []);
            views.comparison.render([], () => {}, null, null);
            containers['route-detail'].replaceChildren();
        },
        setBusy(busy) {
            call(views.home, 'setBusy', busy);
        },
        onSearch(handler) {
            searchHandler = handler;
        },
        onPlaceClick(handler) {
            call(views.map, 'onPlaceClick', handler);
        },
    };
}

/**
 * Starts the application.
 * @precondition the DOM is loaded and contains the elements listed above
 * @postcondition the controller is running and the initial data is requested
 * @returns {Promise<ClientController>}
 */
export async function start(doc = document) {
    const containers = findContainers(doc);
    const views = {
        home: new HomeView(),
        map: new MapView(containers.map),
        comparison: new RouteComparisonView(),
        detail: new RouteDetailView(),
    };
    const messages = new MessageView(containers.messages, containers.footer);
    const controller = new ClientController({ ui: createUi(views, containers), messages });
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

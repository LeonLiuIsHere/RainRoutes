import { h, s } from './dom.js';

const MIN_ZOOM = 1 / 8; // smallest visible width, as a fraction of the whole map
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * The map: background image + one SVG overlay (buildings, route lines, places).
 * Everything lives in the SAME svg, so zoom/pan can never misalign layers.
 * All coordinates from the server are normalized (0..1) and get multiplied by the map size here.
 *
 * Talks to ClientController only:
 *   in : renderMap(mapData), renderRoute(segments), highlightSegments(edgeIds), setSelected({origin, destination}),
 *        setBottomInset(px), refit()
 *   out: onPlaceClick(cb)
 *
 * The map fills its container (put it full screen). A bottom sheet may cover the lower part of it:
 * tell the map how tall that is with setBottomInset(px) so routes are fitted into the part you can still see.
 *
 * mapData = { imageUrl, width, height, buildings: [{id, name, outline: [[x,y],...]}],
 *             places: [{id, label, x, y}] }   (x, y are 0..1; x_norm / y_norm also accepted)
 * segment = { edgeId, cover: 'indoor'|'covered'|'outdoor', points: [[x,y],...] }
 */
export class MapView {
    /** @param {HTMLElement} container */
    constructor(container) {
        this.container = container;
        this.W = 1000;
        this.H = 1000;
        this.view = { x: 0, y: 0, w: 1000, h: 1000 }; // what part of the map is visible (same shape as the screen)
        this.k = 1;                 // map units per screen pixel
        this.insetBottom = 0;       // px of the screen covered by the bottom sheet
        this.lastPoints = null;     // last route, so refit() can fit it again
        this.tracked = [];          // markers/labels that must keep the same size on screen
        this.markers = new Map();   // place id -> { g, badge }
        this.selected = { origin: null, destination: null };
        this.placeHandler = null;
        this.drag = null;
        this.dragged = false;

        this.bgLayer = s('g');
        this.buildingLayer = s('g');
        this.routeLayer = s('g');
        this.placeLayer = s('g');
        this.svg = s('svg', {
            class: 'map-svg', role: 'group', 'aria-label': 'Campus map', viewBox: '0 0 1000 1000',
        }, this.bgLayer, this.buildingLayer, this.routeLayer, this.placeLayer);

        this._bindPanZoom();

        const controls = h('div', { class: 'map-controls' },
            h('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => this.zoomBy(1.5) }, '+'),
            h('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => this.zoomBy(1 / 1.5) }, '−'),
            h('button', { type: 'button', 'aria-label': 'Show whole map', onclick: () => this.resetView() }, 'Reset'),
        );

        container.classList.add('map-view');
        container.replaceChildren(
            h('div', { class: 'map-frame' }, this.svg, controls),
            this._legend(),
        );

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => this._onResize()).observe(this.svg);
        }
    }

    /**
     * Draws background, building outlines and clickable places.
     * @param {Object} mapData see class comment
     */
    renderMap(mapData) {
        this.W = mapData.width || 1000;
        this.H = mapData.height || 1000;
        this.view = { x: 0, y: 0, w: this.W, h: this.H };
        this.tracked = [];
        this.markers.clear();
        for (const layer of [this.bgLayer, this.buildingLayer, this.placeLayer]) layer.replaceChildren();

        if (mapData.imageUrl) {
            this.bgLayer.append(s('image', { href: mapData.imageUrl, x: 0, y: 0, width: this.W, height: this.H }));
        }

        for (const b of mapData.buildings || []) {
            const pts = b.outline.map(([x, y]) => [x * this.W, y * this.H]);
            const poly = s('polygon', { class: 'bld', points: pts.map((p) => p.join(',')).join(' ') }, s('title', null, b.name));
            this.buildingLayer.append(poly);
            const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
            const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
            const label = s('text', { class: 'bld-label' }, b.abbr || b.name);
            this.buildingLayer.append(label);
            this._track(label, cx, cy);
        }

        for (const p of mapData.places || []) this._addPlace(p);

        this.resetView();
        this.setSelected(this.selected);
    }

    /**
     * Draws the route lines. Indoor = solid, covered = dashed, outdoor = dotted red (not colour only).
     * Zooms the map to fit the route.
     * @param {Array} segments see class comment
     */
    renderRoute(segments) {
        this.routeLayer.replaceChildren();
        const all = [];
        for (const seg of segments || []) {
            const pts = seg.points.map(([x, y]) => `${x * this.W},${y * this.H}`).join(' ');
            this.routeLayer.append(s('g', { class: `seg seg-${seg.cover}`, 'data-edge-id': seg.edgeId },
                s('polyline', { class: 'halo', points: pts }),
                s('polyline', { class: 'line', points: pts }),
            ));
            all.push(...seg.points);
        }
        this.routeLayer.classList.remove('has-highlight');
        this.lastPoints = all.length ? all : null;
        if (all.length) this._fitTo(all); else this.resetView();
    }

    /**
     * Emphasises some segments and dims the rest. Pass [] to clear.
     * @param {string[]} edgeIds
     */
    highlightSegments(edgeIds) {
        const on = new Set(edgeIds || []);
        this.routeLayer.classList.toggle('has-highlight', on.size > 0);
        for (const g of this.routeLayer.children) {
            g.classList.toggle('on', on.has(g.getAttribute('data-edge-id')));
        }
    }

    /**
     * Marks the chosen start/end places (text badge + style, so it is not colour only).
     * @param {{origin?: ?string, destination?: ?string}} sel place ids
     */
    setSelected({ origin = null, destination = null } = {}) {
        this.selected = { origin, destination };
        for (const [id, m] of this.markers) {
            const isFrom = id === origin;
            const isTo = id === destination;
            m.g.classList.toggle('is-origin', isFrom);
            m.g.classList.toggle('is-destination', isTo);
            m.badge.textContent = isFrom ? 'From' : isTo ? 'To' : '';
        }
    }

    /** @param {Function} callback called with the place id when a place is clicked or Enter is pressed */
    onPlaceClick(callback) {
        this.placeHandler = callback;
    }

    zoomBy(factor, cx = this.view.x + this.view.w / 2, cy = this.view.y + this.view.h / 2) {
        const v = this.view;
        const w = clamp(v.w / factor, this.W * MIN_ZOOM, this._maxW());
        const hh = w * this._aspect();
        // keep the point under (cx, cy) fixed on screen
        const rx = (cx - v.x) / v.w;
        const ry = (cy - v.y) / v.h;
        this._setView(cx - rx * w, cy - ry * hh, w);
    }

    /** Whole map visible, centred in the part of the screen above the bottom sheet. */
    resetView() {
        this.lastPoints = null;
        const { rw } = this._size();
        const visH = this._visibleHeight();
        const w = clamp(rw / Math.min(rw / this.W, visH / this.H), this.W * MIN_ZOOM, this._maxW());
        this._setView(this.W / 2 - w / 2, this.H / 2 - visH / 2 / (rw / w), w);
    }

    /** @param {number} px how many pixels at the bottom of the screen the sheet covers */
    setBottomInset(px) {
        this.insetBottom = px || 0;
    }

    /** Fits the current route again (call after the sheet changed size). */
    refit() {
        if (this.lastPoints) this._fitTo(this.lastPoints);
    }

    // ---- internals ----

    _addPlace(p) {
        const x = (p.x ?? p.x_norm) * this.W;
        const y = (p.y ?? p.y_norm) * this.H;
        const onRight = x > this.W * 0.6; // labels on the right edge go to the left of the dot
        const badge = s('text', { class: 'place-badge', x: 0, y: -14 });
        const g = s('g', { class: 'place', tabindex: '0', role: 'button', 'aria-label': `Pick ${p.label}`, 'data-place-id': p.id },
            s('circle', { r: 8 }),
            s('text', { class: `place-label${onRight ? ' left' : ''}`, x: onRight ? -13 : 13, y: 4 }, p.label),
            badge,
        );
        g.addEventListener('click', () => { if (!this.dragged) this._pick(p.id); });
        g.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._pick(p.id); }
        });
        this.placeLayer.append(g);
        this._track(g, x, y);
        this.markers.set(p.id, { g, badge });
    }

    _pick(id) {
        if (this.placeHandler) this.placeHandler(id);
    }

    _legend() {
        const item = (cls, text) => h('li', null, h('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' }), text);
        return h('ul', { class: 'map-legend', 'aria-label': 'Map legend' },
            item('cover-indoor', 'Indoors'),
            item('cover-covered', 'Covered'),
            item('cover-outdoor', 'Outdoors (rain)'),
            h('li', null, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Place you can pick'),
        );
    }

    /** Remember an element that should keep a fixed screen size while zooming. */
    _track(el, x, y) {
        this.tracked.push({ el, x, y });
        el.setAttribute('transform', `translate(${x} ${y}) scale(${this.k})`);
    }

    /** Size of the screen area of the map. Falls back to the map's own size when not laid out (tests). */
    _size() {
        const r = this.svg.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return { rw: r.width, rh: r.height, left: r.left, top: r.top };
        return { rw: this.W, rh: this.H, left: 0, top: 0 };
    }

    _aspect() {
        const { rw, rh } = this._size();
        return rh / rw;
    }

    /** Widest view: far enough out to fit the whole map into the part above the bottom sheet. */
    _maxW() {
        return Math.max(this.W, this.H / this._aspect()) * 2.2;
    }

    _scale() {
        return this._size().rw / this.view.w; // screen pixels per map unit
    }

    _apply() {
        const v = this.view;
        this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
        this.k = 1 / this._scale();
        for (const t of this.tracked) t.el.setAttribute('transform', `translate(${t.x} ${t.y}) scale(${this.k})`);
    }

    /** Height in px of the part of the screen not covered by the bottom sheet. */
    _visibleHeight() {
        const { rh } = this._size();
        return rh - Math.min(this.insetBottom, rh * 0.8);
    }

    /**
     * The view always has the same shape as the screen, so the map fills it with no blank bars.
     * Panning is free: the only rule is that the middle of the visible area (above the sheet) stays on the map.
     * That way any edge of the map can be dragged up into view.
     */
    _setView(x, y, w) {
        w = clamp(w, this.W * MIN_ZOOM, this._maxW());
        const hh = w * this._aspect();
        const { rw } = this._size();
        const offY = this._visibleHeight() / 2 / (rw / w); // map units from the top of the view to the middle of the visible part
        const cx = clamp(x + w / 2, 0, this.W);
        const cy = clamp(y + offY, 0, this.H);
        this.view = { x: cx - w / 2, y: cy - offY, w, h: hh };
        this._apply();
    }

    /** Screen resized (or phone turned): keep the same centre and zoom. */
    _onResize() {
        const v = this.view;
        const cx = v.x + v.w / 2;
        const cy = v.y + v.h / 2;
        const hh = v.w * this._aspect();
        this._setView(cx - v.w / 2, cy - hh / 2, v.w);
    }

    /** Client (screen) position -> map units. */
    _toUnits(clientX, clientY) {
        const r = this._size();
        const sc = this._scale();
        return [this.view.x + (clientX - r.left) / sc, this.view.y + (clientY - r.top) / sc];
    }

    /** Zoom so the route fits in the part of the screen the bottom sheet does not cover. */
    _fitTo(points) {
        const { rw } = this._size();
        const visH = this._visibleHeight();
        const xs = points.map((p) => p[0] * this.W);
        const ys = points.map((p) => p[1] * this.H);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bw = Math.max(maxX - minX, this.W * 0.08); // a tiny route should not zoom in forever
        const bh = Math.max(maxY - minY, this.H * 0.08);
        const pad = 1.5;
        let sc = Math.min(rw / (bw * pad), visH / (bh * pad));
        const w = clamp(rw / sc, this.W * MIN_ZOOM, this._maxW());
        sc = rw / w;
        // put the route centre in the middle of the visible part (above the sheet)
        this._setView((minX + maxX) / 2 - w / 2, (minY + maxY) / 2 - visH / 2 / sc, w);
    }

    /** One finger/mouse drags the map, two fingers pinch to zoom (and drag), wheel zooms. */
    _bindPanZoom() {
        const svg = this.svg;
        this.pointers = new Map(); // pointerId -> {x, y} of every finger/mouse currently down
        this.pinch = null;         // {dist, mx, my}: distance and midpoint of two fingers

        svg.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pointers.size === 1) {
                this.drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false, id: e.pointerId };
            } else if (this.pointers.size === 2) {
                this.drag = null;
                this.dragged = true; // a pinch must not count as a click on a place
                this.pinch = this._pinchState();
            }
        });

        svg.addEventListener('pointermove', (e) => {
            if (!this.pointers.has(e.pointerId)) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.pinch && this.pointers.size >= 2) {
                const now = this._pinchState();
                if (this.pinch.dist > 0 && now.dist > 0) {
                    // zoom by how much the fingers moved apart, and follow the midpoint so the map also drags
                    const [ux, uy] = this._toUnits(this.pinch.mx, this.pinch.my); // map point that was under the old midpoint
                    const w = clamp(this.view.w / (now.dist / this.pinch.dist), this.W * MIN_ZOOM, this._maxW());
                    const r = this._size();
                    const perPx = w / r.rw; // map units per screen pixel after zooming
                    this._setView(ux - (now.mx - r.left) * perPx, uy - (now.my - r.top) * perPx, w);
                }
                this.pinch = now;
                return;
            }

            const d = this.drag;
            if (!d || d.id !== e.pointerId) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (!d.moved && Math.hypot(dx, dy) < 5) return; // small wiggle = still a click
            if (!d.moved) {
                d.moved = true;
                if (svg.setPointerCapture) svg.setPointerCapture(d.id);
                svg.classList.add('is-dragging');
            }
            const sc = this._scale();
            this._setView(d.vx - dx / sc, d.vy - dy / sc, this.view.w);
        });

        const end = (e) => {
            this.pointers.delete(e.pointerId);
            if (this.pointers.size < 2) this.pinch = null;
            if (this.pointers.size === 1) {
                // one finger left after a pinch: keep dragging with it, no jump
                const [id, p] = [...this.pointers.entries()][0];
                this.drag = { x: p.x, y: p.y, vx: this.view.x, vy: this.view.y, moved: true, id };
                return;
            }
            if (this.pointers.size > 1) return;
            if (this.drag && this.drag.moved) this.dragged = true;
            if (this.dragged) setTimeout(() => { this.dragged = false; }, 0); // the click ending a drag/pinch picks nothing
            this.drag = null;
            svg.classList.remove('is-dragging');
        };
        svg.addEventListener('pointerup', end);
        svg.addEventListener('pointercancel', end);

        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const [ux, uy] = this._toUnits(e.clientX, e.clientY);
            this.zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, ux, uy);
        }, { passive: false });
    }

    /** Distance and midpoint (screen px) of the first two fingers. */
    _pinchState() {
        const [a, b] = [...this.pointers.values()];
        return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
}

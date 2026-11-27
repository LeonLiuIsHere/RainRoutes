import { h, meters, duration } from './dom.js';

const KIND_TITLE = { FASTEST: 'Fastest', LOWER_EXPOSURE: 'Driest' };
const KIND_HINT = { FASTEST: 'Shortest walking time', LOWER_EXPOSURE: 'Least time outdoors' };

/**
 * Shows the route options (fastest / driest), or why there is none.
 *
 * Talks to ClientController only:
 *   in : render(result), setSelected(kind), clear()
 *   out: onSelect(cb), onEditTrip(cb)
 *
 * result = the whole route result from POST /api/routes (architecture §3.3):
 *   { status: 'COMPLETE'|'NO_FEASIBLE_ROUTE', identical: boolean, options: [...] }
 * After render() the first option is shown as selected, so the controller should show its details too.
 */
export class RouteComparisonView {
    /** @param {HTMLElement} [container] */
    constructor(container = null) {
        this.container = container || h('div', { class: 'cmp-view' });
        this.selectHandler = null;
        this.editHandler = null;
        this.selected = null;
        this.cards = new Map(); // kind -> button
    }

    /**
     * Draws the result.
     * Also accepts the old stub call render(optionsArray, selectCallback).
     * @param {Object|Array} result
     * @param {Function} [selectCallback]
     */
    render(result, selectCallback) {
        if (selectCallback) this.selectHandler = selectCallback;
        if (Array.isArray(result)) result = { status: 'COMPLETE', identical: false, options: result };
        this.cards.clear();
        if (!result) return this.clear();

        if (result.status === 'NO_FEASIBLE_ROUTE' || !result.options || result.options.length === 0) {
            this.selected = null;
            this.container.replaceChildren(this._noRoute());
            return undefined;
        }

        const options = result.options;
        this.selected = options[0].kind;
        const list = h('ul', { class: 'option-list' }, ...options.map((o) => h('li', null, this._card(o))));
        const note = options.length === 1
            ? h('p', { class: 'hint' }, result.identical
                ? 'The fastest and driest routes are the same, so only one is shown.'
                : 'No drier route fits within your extra time.')
            : null;
        this.container.replaceChildren(h('h2', null, 'Routes'), list, note);
        return undefined;
    }

    /** Updates which card looks selected (does not call the callback). */
    setSelected(kind) {
        this.selected = kind;
        for (const [k, btn] of this.cards) btn.setAttribute('aria-pressed', String(k === kind));
    }

    clear() {
        this.selected = null;
        this.cards.clear();
        this.container.replaceChildren();
    }

    /** @param {Function} callback called with 'FASTEST' or 'LOWER_EXPOSURE' when the user picks a card */
    onSelect(callback) {
        this.selectHandler = callback;
    }

    /** @param {Function} callback called when the user presses "Change trip" on the no-route screen */
    onEditTrip(callback) {
        this.editHandler = callback;
    }

    // ---- helpers ----

    _card(o) {
        const share = o.distanceM > 0 ? Math.min(100, (o.exposedM / o.distanceM) * 100) : 0;
        const rows = [
            ['Distance', meters(o.distanceM)],
            ['Outdoors', meters(o.exposedM)],
        ];

        const btn = h('button', {
            type: 'button', class: 'option', 'aria-pressed': String(o.kind === this.selected),
            onclick: () => {
                this.setSelected(o.kind);
                if (this.selectHandler) this.selectHandler(o.kind);
            },
        },
            h('span', { class: 'opt-head' },
                h('span', { class: 'opt-title' }, KIND_TITLE[o.kind] || o.kind),
                h('span', { class: 'opt-time' }, duration(o.walkSeconds)),
            ),
            h('span', { class: 'opt-hint' }, KIND_HINT[o.kind] || ''),
            // bar = how much of the walk is outdoors
            h('span', { class: 'exposure-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${share}%` })),
            h('dl', { class: 'metrics' }, ...rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
        );
        this.cards.set(o.kind, btn);
        return btn;
    }

    _noRoute() {
        return h('div', { class: 'empty', role: 'status' },
            h('h2', null, 'No open route at that time'),
            h('p', null, 'Some doors on the way are closed or have no recorded hours. Try a later time, or different places.'),
            h('button', {
                type: 'button', class: 'btn',
                onclick: () => { if (this.editHandler) this.editHandler(); },
            }, 'Change trip'),
        );
    }
}

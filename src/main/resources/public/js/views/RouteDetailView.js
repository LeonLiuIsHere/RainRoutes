import { h, meters, duration, COVER_LABELS } from './dom.js';

const ROUTE_TITLE = { FASTEST: 'Fastest route', LOWER_EXPOSURE: 'Driest route' };

/**
 * Step-by-step cards for the selected route option.
 *
 * Talks to ClientController only:
 *   in : render(option), setSelectedStep(index), clear()
 *   out: onStepSelect(cb), onBack(cb)   (Back = "Back to routes", the controller switches screens)
 *
 * option = one entry of result.options (architecture §3.3). Each step has
 *   text, edgeIds                                   (required, from the server)
 * and these OPTIONAL fields (missing ones are simply not shown):
 *   title, cover ('indoor'|'covered'|'outdoor'), cardReader (true),
 *   hours ('Mon–Fri 07:30–17:00'), pending ('what is not verified yet'),
 *   details (['1st thing to do', ...], shown when the step is selected),
 *   photos ([{id, url, caption}], always shown as thumbnails)
 */
export class RouteDetailView {
    /** @param {HTMLElement} [container] can also be given in render(container, route) like the old stub */
    constructor(container = null) {
        this.container = container || h('div', { class: 'detail-view' });
        this.stepHandler = null;
        this.backHandler = null;
        this.option = null;
        this.index = -1;
        this.dialog = null;
    }

    /**
     * Draws the summary and step cards.
     * Also accepts the stub style render(container, option, onSelectStep).
     * @param {Object|HTMLElement} option
     * @param {Object} [route]
     * @param {Function} [onSelectStep] same as onStepSelect(callback)
     */
    render(option, route, onSelectStep) {
        if (option && option.nodeType) { // stub style: (container, option, onSelectStep)
            this.container = option;
            option = route;
        }
        if (typeof onSelectStep === 'function') this.stepHandler = onSelectStep;
        this.option = option || null;
        this.index = -1;
        if (!option) return this.clear();

        const steps = option.steps || [];
        const summary = h('dl', { class: 'metrics summary' },
            h('dt', null, 'Time'), h('dd', null, duration(option.walkSeconds)),
            h('dt', null, 'Distance'), h('dd', null, meters(option.distanceM)),
            h('dt', null, 'Outdoors'), h('dd', null, meters(option.exposedM)),
        );
        this.list = h('ol', { class: 'step-list' }, ...steps.map((st, i) => this._step(st, i)));
        this.prev = h('button', { type: 'button', class: 'btn', onclick: () => this._go(this.index - 1) }, 'Previous step');
        this.next = h('button', { type: 'button', class: 'btn', onclick: () => this._go(this.index + 1) }, 'Next step');

        this.container.replaceChildren(
            h('button', { type: 'button', class: 'btn back-btn', onclick: () => { if (this.backHandler) this.backHandler(); } }, 'Back to routes'),
            h('h2', null, ROUTE_TITLE[option.kind] || 'Step by step'),
            summary,
            steps.length ? this.list : h('p', { class: 'hint' }, 'No step-by-step directions for this route yet.'),
            steps.length ? h('div', { class: 'step-nav' }, this.prev, this.next) : null,
        );
        this._updateNav();
        return undefined;
    }

    /** Selects a step in the UI only (does not call the callback). */
    setSelectedStep(index) {
        this.index = index;
        [...this.list.children].forEach((li, i) => {
            const on = i === index;
            li.classList.toggle('is-selected', on);
            li.querySelector('.step-head').setAttribute('aria-expanded', String(on));
            li.querySelector('.step-more').hidden = !on; // the written details open when selected
        });
        const li = this.list.children[index];
        if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
        this._updateNav();
    }

    clear() {
        this.option = null;
        this.index = -1;
        this.container.replaceChildren();
    }

    /** @param {Function} callback called with the step index when the user selects a step */
    onStepSelect(callback) {
        this.stepHandler = callback;
    }

    /** @param {Function} callback called when the user presses "Back to routes" */
    onBack(callback) {
        this.backHandler = callback;
    }

    // ---- helpers ----

    _go(index) {
        const count = (this.option.steps || []).length;
        if (index < 0 || index >= count) return;
        this.setSelectedStep(index);
        if (this.stepHandler) this.stepHandler(index);
    }

    _updateNav() {
        if (!this.prev) return;
        const count = ((this.option && this.option.steps) || []).length;
        this.prev.disabled = this.index <= 0;
        this.next.disabled = this.index >= count - 1;
    }

    _step(st, i) {
        const tags = [];
        if (st.cover) {
            tags.push(h('span', { class: 'tag' }, h('span', { class: `swatch cover-${st.cover}`, 'aria-hidden': 'true' }), COVER_LABELS[st.cover] || st.cover));
        }
        if (st.cardReader) tags.push(h('span', { class: 'tag' }, 'Card reader'));
        if (st.hours) tags.push(h('span', { class: 'tag' }, st.hours));

        // photos are always visible (like Tim's guide); tap one to enlarge
        const photos = st.photos && st.photos.length
            ? h('ul', { class: 'photos' }, ...st.photos.map((p) => h('li', null,
                h('button', { type: 'button', class: 'photo-btn', 'aria-label': `Enlarge photo ${p.id || ''} ${p.caption || ''}`.trim(), onclick: () => this._openPhoto(p) },
                    h('img', { src: p.url, alt: p.caption || `Photo ${p.id || ''}`, loading: 'lazy' }),
                    h('span', { class: 'photo-cap' }, p.id ? h('strong', null, p.id) : null, p.caption ? ` ${p.caption}` : ''),
                ))))
            : h('p', { class: 'hint photo-none' }, 'No photo for this step yet.');

        const more = h('div', { class: 'step-more', hidden: true },
            st.details && st.details.length ? h('ol', { class: 'details' }, ...st.details.map((d) => h('li', null, d))) : null,
        );

        return h('li', { class: 'step' },
            h('button', { type: 'button', class: 'step-head', 'aria-expanded': 'false', onclick: () => this._go(i) },
                h('span', { class: 'step-num' }, i + 1),
                h('span', { class: 'step-body' },
                    st.title ? h('strong', null, st.title) : null,
                    h('span', null, st.text),
                ),
            ),
            tags.length ? h('div', { class: 'tags' }, ...tags) : null,
            st.pending ? h('p', { class: 'pending' }, h('strong', null, 'Not verified yet: '), st.pending) : null,
            photos,
            more,
        );
    }

    _openPhoto(p) {
        if (!this.dialog) {
            this.dialog = h('dialog', { class: 'photo-dialog' });
            this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this._close(); });
            document.body.append(this.dialog);
        }
        this.dialog.replaceChildren(
            h('img', { src: p.url, alt: p.caption || '' }),
            h('p', null, `${p.id ? `${p.id}  ` : ''}${p.caption || ''}`),
            h('button', { type: 'button', class: 'btn', onclick: () => this._close() }, 'Close'),
        );
        if (this.dialog.showModal) this.dialog.showModal(); else this.dialog.setAttribute('open', '');
    }

    _close() {
        if (this.dialog.close) this.dialog.close(); else this.dialog.removeAttribute('open');
    }
}

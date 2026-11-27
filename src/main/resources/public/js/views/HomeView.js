import { h } from './dom.js';

/** Error codes from the server (architecture §3.4) -> plain text. */
const PROBLEM_TEXT = {
    MISSING: 'Choose a place.',
    UNKNOWN_PLACE: 'That place is not on the map.',
    IDENTICAL_ENDPOINTS: 'Start and end must be different places.',
    INVALID_TIME: 'Enter a valid date and time.',
    NEGATIVE: 'Extra time cannot be negative.',
};

const MAX_EXTRA = 20; // slider goes 0..20 minutes

/** Current Vancouver time as "2026-11-05T09:50" (value for datetime-local). */
function nowInVancouver() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Vancouver',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * The route form: origin, destination, departure, max extra walking time.
 *
 * Talks to ClientController only:
 *   in : setPlaces(places), setValues(partial), showFieldErrors(fields)
 *   out: onSearch(cb), onChange(cb)
 */
export class HomeView {
    /** @param {HTMLElement} [container] can also be given later in render() */
    constructor(container = null) {
        this.container = container;
        this.places = [];
        this.searchHandler = null;
        this.changeHandler = null;
        this.els = null;
    }

    /**
     * Draws the form.
     * @param {HTMLElement} [container]
     */
    render(container) {
        if (container) this.container = container;

        const originSel = this._placeSelect('origin');
        const destSel = this._placeSelect('destination');
        const departure = h('input', { id: 'f-departure', type: 'datetime-local', value: nowInVancouver() });
        const slider = h('input', {
            id: 'f-extra', type: 'range', min: '0', max: String(MAX_EXTRA), step: '1', value: '2',
            class: 'extra-slider', 'aria-describedby': 'err-maxExtraMinutes', 'aria-valuetext': '2 minutes',
        });
        const readout = h('output', { for: 'f-extra', class: 'extra-readout' }, '2 min');
        slider.addEventListener('input', () => this._showExtra());

        const form = h('form', { class: 'home-form', novalidate: true },
            h('h2', null, 'Plan a dry route'),
            this._field('origin', 'From', originSel),
            this._field('destination', 'To', destSel),
            this._field('departure', 'Leave at', departure, 'Vancouver time'),
            h('div', { class: 'field' },
                h('label', { for: 'f-extra' }, 'Extra walking you accept'),
                h('div', { class: 'slider-row' }, slider, readout),
                h('p', { class: 'hint' }, 'How much longer you will walk to stay drier. 0 means fastest route only.'),
                h('p', { class: 'field-error', id: 'err-maxExtraMinutes' }),
            ),
            h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this._search() }, 'Find routes'),
        );

        // The button handles clicks itself, so it works even where form submit is blocked
        // (e.g. a sandboxed preview). Enter inside a field also searches.
        form.addEventListener('submit', (e) => { e.preventDefault(); this._search(); });
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); this._search(); }
        });
        form.addEventListener('change', () => {
            if (this.changeHandler) this.changeHandler(this.getValues());
        });
        // typing/choosing again clears that field's old error
        form.addEventListener('input', (e) => {
            const id = e.target.id || '';
            const name = id === 'f-extra' ? 'maxExtraMinutes' : id.replace('f-', '');
            this._setError(name, '');
        });

        this.els = { form, originSel, destSel, departure, slider, readout };
        this.container.replaceChildren(form);
        this.setPlaces(this.places);
    }

    /**
     * Fills both dropdowns. Keeps the current choice if it is still in the list.
     * @param {Array<{id: string, label: string}>} places
     */
    setPlaces(places) {
        this.places = places || [];
        if (!this.els) return;
        for (const sel of [this.els.originSel, this.els.destSel]) {
            const keep = sel.value;
            sel.replaceChildren(
                h('option', { value: '' }, 'Choose a place'),
                ...this.places.map((p) => h('option', { value: p.id }, p.label)),
            );
            sel.value = this.places.some((p) => p.id === keep) ? keep : '';
        }
    }

    /**
     * Sets some of the fields from outside (e.g. user clicked a place on the map).
     * @param {{origin?: string|null, destination?: string|null, departure?: string, maxExtraMinutes?: number}} values
     */
    setValues(values) {
        if (!this.els) return;
        if ('origin' in values) this.els.originSel.value = values.origin || '';
        if ('destination' in values) this.els.destSel.value = values.destination || '';
        if (values.departure) this.els.departure.value = values.departure;
        if (typeof values.maxExtraMinutes === 'number') {
            this.els.slider.value = String(Math.min(Math.max(values.maxExtraMinutes, 0), MAX_EXTRA));
            this._showExtra();
        }
    }

    /**
     * Current form values. Empty fields come back as null, and the controller checks them.
     * @returns {{origin: ?string, destination: ?string, departure: ?string, maxExtraMinutes: ?number}}
     */
    getValues() {
        const e = this.els;
        return {
            origin: e.originSel.value || null,
            destination: e.destSel.value || null,
            departure: e.departure.value || null,
            maxExtraMinutes: Number(e.slider.value),
        };
    }

    /**
     * Shows an error under each named field. Pass [] to clear all.
     * @param {Array<{field: string, problem: string}>} fields e.g. [{field:'destination', problem:'IDENTICAL_ENDPOINTS'}]
     */
    showFieldErrors(fields) {
        if (!this.els) return;
        for (const name of ['origin', 'destination', 'departure', 'maxExtraMinutes']) this._setError(name, '');
        for (const { field, problem } of fields || []) {
            this._setError(field, PROBLEM_TEXT[problem] || `Problem: ${problem}`);
        }
        const first = this.els.form.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
    }

    /** @param {Function} callback called with {origin, destination, departure, maxExtraMinutes} */
    onSearch(callback) {
        this.searchHandler = callback;
    }

    /** Old stub name, same as onSearch. */
    bindEvents(searchCallback) {
        this.onSearch(searchCallback);
    }

    /** @param {Function} callback called with the form values whenever a field changes */
    onChange(callback) {
        this.changeHandler = callback;
    }

    // ---- helpers ----

    _placeSelect(name) {
        return h('select', { id: `f-${name}`, 'aria-describedby': `err-${name}` });
    }

    _field(name, labelText, control, hint) {
        control.setAttribute('aria-describedby', `err-${name}`);
        return h('div', { class: 'field' },
            h('label', { for: `f-${name}` }, labelText),
            control,
            hint ? h('p', { class: 'hint' }, hint) : null,
            h('p', { class: 'field-error', id: `err-${name}` }),
        );
    }

    _showExtra() {
        const m = this.els.slider.value;
        this.els.readout.textContent = `${m} min`;
        this.els.slider.setAttribute('aria-valuetext', `${m} minutes`);
    }

    _search() {
        this.showFieldErrors([]);
        if (this.searchHandler) this.searchHandler(this.getValues());
    }

    _setError(name, text) {
        const msg = this.els.form.querySelector(`#err-${name}`);
        if (!msg) return;
        msg.textContent = text;
        const control = name === 'maxExtraMinutes' ? this.els.slider : this.els.form.querySelector(`#f-${name}`);
        if (control) control.setAttribute('aria-invalid', text ? 'true' : 'false');
    }
}

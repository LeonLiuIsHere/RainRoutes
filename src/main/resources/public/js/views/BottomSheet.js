import { h } from './dom.js';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * The panel at the bottom of the screen (like Google Maps). Three heights:
 *   peek = just a strip, half = about half the screen, full = almost the whole screen.
 * Tap the handle to go to the next height, or drag it up and down.
 *
 * Give it an element that already contains the panels. They move into a scrolling body inside the sheet.
 *   in : setState('peek'|'half'|'full'), scrollToTop()
 *   out: onChange(cb)  cb is called after the height changed, so the map can refit its route
 */
export class BottomSheet {
    /** @param {HTMLElement} el */
    constructor(el) {
        this.el = el;
        this.state = 'half';
        this.height = 0;
        this.changeHandler = null;
        this.drag = null;
        this.justDragged = false;

        el.classList.add('sheet');
        this.handle = h('button', { type: 'button', class: 'sheet-handle' }, h('span', { class: 'grip', 'aria-hidden': 'true' }));
        this.body = h('div', { class: 'sheet-body' }, ...Array.from(el.childNodes));
        el.replaceChildren(this.handle, this.body);

        this.handle.addEventListener('click', () => {
            if (this.justDragged) return;
            this.setState({ peek: 'half', half: 'full', full: 'peek' }[this.state]);
        });
        this._bindDrag();
        window.addEventListener('resize', () => this._applyHeight(this._heights()[this.state]));
        this.setState('half');
    }

    /** @param {'peek'|'half'|'full'} name */
    setState(name) {
        this.state = name;
        this._applyHeight(this._heights()[name]);
        this.handle.setAttribute('aria-expanded', String(name !== 'peek'));
        this.handle.setAttribute('aria-label', `Resize panel, now ${name === 'peek' ? 'collapsed' : name === 'half' ? 'half open' : 'fully open'}`);
        if (this.changeHandler) this.changeHandler(this.height);
    }

    /** Current height in px. */
    getHeight() {
        return this.height;
    }

    scrollToTop() {
        this.body.scrollTop = 0;
    }

    /** @param {Function} callback called with the new height (px) after the sheet changed state */
    onChange(callback) {
        this.changeHandler = callback;
    }

    // ---- helpers ----

    _heights() {
        const screen = window.innerHeight || 700;
        return { peek: 92, half: Math.round(screen * 0.5), full: Math.round(screen * 0.9) };
    }

    _applyHeight(px) {
        this.height = px;
        this.el.style.height = `${px}px`;
    }

    _bindDrag() {
        const handle = this.handle;
        handle.addEventListener('pointerdown', (e) => {
            this.drag = { y: e.clientY, height: this.height, moved: false, id: e.pointerId };
        });
        handle.addEventListener('pointermove', (e) => {
            const d = this.drag;
            if (!d) return;
            const dy = d.y - e.clientY; // up is positive
            if (!d.moved && Math.abs(dy) < 6) return; // small wiggle = a tap
            if (!d.moved) {
                d.moved = true;
                if (handle.setPointerCapture) handle.setPointerCapture(d.id);
                this.el.classList.add('is-dragging');
            }
            const hs = this._heights();
            this._applyHeight(clamp(d.height + dy, hs.peek, hs.full));
        });
        const end = () => {
            const d = this.drag;
            this.drag = null;
            this.el.classList.remove('is-dragging');
            if (!d || !d.moved) return;
            this.justDragged = true; // the click that ends a drag must not also cycle the state
            setTimeout(() => { this.justDragged = false; }, 0);
            // snap to the closest of the three heights
            const hs = this._heights();
            const nearest = Object.keys(hs).sort((a, b) => Math.abs(hs[a] - this.height) - Math.abs(hs[b] - this.height))[0];
            this.setState(nearest);
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }
}

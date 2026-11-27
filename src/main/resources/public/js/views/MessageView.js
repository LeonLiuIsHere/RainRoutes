import { h } from './dom.js';

/**
 * Messages that don't belong to one input: loading, service errors (with Retry), data version.
 *
 * Talks to ClientController only:
 *   in : showError(message), showLoading(text), hide(), setDataVersion(version)
 *   out: onRetry(cb)
 */
export class MessageView {
    /**
     * @param {HTMLElement} [container] the error/loading banner goes at the start of this
     * @param {HTMLElement} [footerContainer] the data-version line goes at the end of this (default: same container)
     */
    constructor(container = document.body, footerContainer = container) {
        this.container = container;
        this.retryHandler = null;
        this.banner = h('div', { class: 'msg-region' });
        this.footer = h('p', { class: 'msg-footer' });
        container.prepend(this.banner);
        footerContainer.append(this.footer);
    }

    /**
     * Shows an error banner. A Retry button appears if onRetry() was set.
     * @param {string} message say what went wrong and what to do
     */
    showError(message) {
        const retry = this.retryHandler
            ? h('button', { type: 'button', class: 'btn', onclick: () => this.retryHandler() }, 'Retry')
            : null;
        this.banner.replaceChildren(h('div', { class: 'msg msg-error', role: 'alert' }, h('span', null, message), retry));
    }

    /** @param {string} [text] */
    showLoading(text = 'Finding routes…') {
        this.banner.replaceChildren(h('div', { class: 'msg msg-loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text));
    }

    hide() {
        this.banner.replaceChildren();
    }

    /** @param {Function} callback called when the user presses Retry */
    onRetry(callback) {
        this.retryHandler = callback;
    }

    /** @param {string} version e.g. "2026-11-05.1" */
    setDataVersion(version) {
        this.footer.textContent = version ? `Data version ${version}` : '';
    }
}

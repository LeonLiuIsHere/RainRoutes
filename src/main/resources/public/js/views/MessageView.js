/**
 * Shows messages that are not tied to one form input (architecture §2.1):
 * loading, service errors with Retry, information notices, and the data
 * version in the footer.
 *
 * Built on Yuki's MessageView: same constructor, same DOM and CSS classes
 * (.msg-region, .msg, .msg-error, .msg-loading, .spinner, .msg-footer), so
 * css/views.css styles it. Added: showInfo(), and the {retry} option of showError().
 *
 * All text is inserted as text, never as HTML.
 */
export const MESSAGE_TYPE = Object.freeze({
    LOADING: 'loading',
    INFO: 'info',
    ERROR: 'error',
});

export class MessageView {
    #doc;
    #banner;
    #footer;
    /** @type {(() => void)|null} */
    #retryHandler = null;
    /** @type {string|null} */
    #type = null;

    /**
     * @precondition container is an element in a document; footerContainer is
     *   an element in the same document (default: container)
     * @postcondition an empty message banner is placed at the start of container,
     *   and an empty data-version line at the end of footerContainer
     * @param {HTMLElement} container
     * @param {HTMLElement} [footerContainer]
     */
    constructor(container, footerContainer = container) {
        this.#doc = container.ownerDocument;
        this.#banner = this.#el('div', { class: 'msg-region' });
        this.#footer = this.#el('p', { class: 'msg-footer' });
        container.prepend(this.#banner);
        footerContainer.append(this.#footer);
    }

    /**
     * Registers what happens when the user presses Retry.
     * @precondition handler is a function
     * @postcondition handler is called on every later Retry press; it replaces
     *   any earlier handler
     * @param {() => void} handler
     */
    onRetry(handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('handler must be a function');
        }
        this.#retryHandler = handler;
    }

    /**
     * Same as onRetry; kept for code written against the Milestone 2 stub.
     * @precondition handler is a function
     * @postcondition as for onRetry
     * @param {() => void} handler
     */
    bindRetry(handler) {
        this.onRetry(handler);
    }

    /**
     * Displays an error banner.
     * @precondition message is a non-empty string
     * @postcondition the message is shown as an alert; a Retry button is shown
     *   iff options.retry is true and a Retry handler is registered
     * @param {string} message say what went wrong and what to do
     * @param {{retry?: boolean}} [options]
     */
    showError(message, { retry = true } = {}) {
        requireText(message);
        const button = retry && this.#retryHandler !== null
            ? this.#el('button', { type: 'button', class: 'btn' }, 'Retry')
            : null;
        if (button !== null) {
            button.addEventListener('click', () => this.#retryHandler());
        }
        this.#show(MESSAGE_TYPE.ERROR,
            this.#el('div', { class: 'msg msg-error', role: 'alert' }, this.#el('span', null, message), button));
    }

    /**
     * Displays a notice that is not an error, e.g. "Search incomplete".
     * It uses the loading banner's look without the spinner.
     * @precondition message is a non-empty string
     * @postcondition the message is shown as a status; no Retry button
     * @param {string} message
     */
    showInfo(message) {
        requireText(message);
        this.#show(MESSAGE_TYPE.INFO,
            this.#el('div', { class: 'msg msg-loading msg-info', role: 'status' }, this.#el('span', null, message)));
    }

    /**
     * Displays a loading indicator.
     * @precondition text is a non-empty string
     * @postcondition a spinner and the text are shown as a status
     * @param {string} [text]
     */
    showLoading(text = 'Finding routes…') {
        requireText(text);
        this.#show(MESSAGE_TYPE.LOADING,
            this.#el('div', { class: 'msg msg-loading', role: 'status' },
                this.#el('span', { class: 'spinner', 'aria-hidden': 'true' }), this.#el('span', null, text)));
    }

    /**
     * Hides any message.
     * @precondition none
     * @postcondition the banner is empty
     */
    hide() {
        this.#type = null;
        this.#banner.replaceChildren();
    }

    /**
     * @precondition version is a string
     * @postcondition the footer reads "Data version <version>", or is empty for ''
     * @param {string} version
     */
    setDataVersion(version) {
        this.#footer.textContent = version ? `Data version ${version}` : '';
    }

    /**
     * @precondition none
     * @postcondition returns the type of the message shown, or null if none
     * @returns {string|null}
     */
    getCurrentType() {
        return this.#type;
    }

    #show(type, node) {
        this.#type = type;
        this.#banner.replaceChildren(node);
    }

    /** Builds an element with attributes and text/element children. */
    #el(tag, attrs, ...kids) {
        const el = this.#doc.createElement(tag);
        for (const [key, value] of Object.entries(attrs ?? {})) {
            el.setAttribute(key, value);
        }
        for (const kid of kids) {
            if (kid === null || kid === undefined) continue;
            el.append(typeof kid === 'string' ? this.#doc.createTextNode(kid) : kid);
        }
        return el;
    }
}

function requireText(text) {
    if (typeof text !== 'string' || text === '') {
        throw new TypeError('message must be a non-empty string');
    }
}

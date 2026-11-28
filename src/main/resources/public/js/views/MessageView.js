/**
 * Shows messages that are not tied to one form input (architecture §2.1):
 * loading indicators, "Service error, please retry" with a Retry button,
 * information notices, and the data version in the footer.
 *
 * All text is inserted with textContent, never as HTML.
 * Styling hooks for the stylesheet:
 *   .message, .message--loading, .message--info, .message--error,
 *   .message__text, .message__retry, .data-version
 */
export const MESSAGE_TYPE = Object.freeze({
    LOADING: 'loading',
    INFO: 'info',
    ERROR: 'error',
});

export class MessageView {
    #root;
    #text;
    #retryButton;
    #versionElement;
    /** @type {(() => void)|null} */
    #retryHandler = null;
    /** @type {string|null} */
    #type = null;

    /**
     * Builds the message area inside container.
     * @precondition container is an element in a document; footer is null or
     *   an element in the same document
     * @postcondition the message area is created, empty and hidden; if footer
     *   is given, a data-version line is added to it
     * @param {HTMLElement} container
     * @param {HTMLElement|null} [footer]
     */
    constructor(container, footer = null) {
        const doc = container.ownerDocument;

        this.#root = doc.createElement('div');
        this.#root.className = 'message';
        this.#root.hidden = true;
        // Polite by default; errors switch to assertive in #show.
        this.#root.setAttribute('aria-live', 'polite');

        this.#text = doc.createElement('p');
        this.#text.className = 'message__text';

        this.#retryButton = doc.createElement('button');
        this.#retryButton.type = 'button';
        this.#retryButton.className = 'message__retry';
        this.#retryButton.textContent = 'Retry';
        this.#retryButton.hidden = true;
        this.#retryButton.addEventListener('click', () => {
            if (this.#retryHandler !== null) {
                this.#retryHandler();
            }
        });

        this.#root.append(this.#text, this.#retryButton);
        container.append(this.#root);

        this.#versionElement = null;
        if (footer !== null) {
            this.#versionElement = doc.createElement('span');
            this.#versionElement.className = 'data-version';
            footer.append(this.#versionElement);
        }
    }

    /**
     * Registers what happens when the user presses Retry.
     * @precondition handler is a function
     * @postcondition handler is called on every later Retry press; it replaces
     *   any earlier handler
     * @param {() => void} handler
     */
    bindRetry(handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('handler must be a function');
        }
        this.#retryHandler = handler;
    }

    /**
     * Displays an error message to the user.
     * @precondition message is a non-empty string
     * @postcondition the message is shown as an error and announced to screen
     *   readers; the Retry button is shown iff options.retry is true
     * @param {string} message
     * @param {{retry?: boolean}} [options]
     */
    showError(message, { retry = true } = {}) {
        this.#show(MESSAGE_TYPE.ERROR, message);
        this.#retryButton.hidden = !retry;
    }

    /**
     * Displays a notice that is not an error, e.g. "Search incomplete".
     * @precondition message is a non-empty string
     * @postcondition the message is shown as information; no Retry button
     * @param {string} message
     */
    showInfo(message) {
        this.#show(MESSAGE_TYPE.INFO, message);
        this.#retryButton.hidden = true;
    }

    /**
     * Displays a loading status indicator.
     * @precondition message is a non-empty string
     * @postcondition the loading text is shown and the area is marked busy;
     *   no Retry button
     * @param {string} [message]
     */
    showLoading(message = 'Loading…') {
        this.#show(MESSAGE_TYPE.LOADING, message);
        this.#retryButton.hidden = true;
        this.#root.setAttribute('aria-busy', 'true');
    }

    /**
     * Hides any active loading or message indicators.
     * @precondition none
     * @postcondition the message area is hidden and empty
     */
    hide() {
        this.#type = null;
        this.#root.hidden = true;
        this.#root.removeAttribute('aria-busy');
        this.#text.textContent = '';
        this.#retryButton.hidden = true;
    }

    /**
     * Shows the data version in the footer.
     * @precondition version is a non-empty string
     * @postcondition the footer reads "Data version <version>" if a footer was given
     * @param {string} version
     */
    setDataVersion(version) {
        if (this.#versionElement !== null) {
            this.#versionElement.textContent = `Data version ${version}`;
        }
    }

    /**
     * @precondition none
     * @postcondition returns the type of the message shown, or null if hidden
     * @returns {string|null}
     */
    getCurrentType() {
        return this.#type;
    }

    #show(type, message) {
        if (typeof message !== 'string' || message === '') {
            throw new TypeError('message must be a non-empty string');
        }
        this.#type = type;
        this.#root.className = `message message--${type}`;
        this.#root.setAttribute('aria-live', type === MESSAGE_TYPE.ERROR ? 'assertive' : 'polite');
        this.#root.setAttribute('role', type === MESSAGE_TYPE.ERROR ? 'alert' : 'status');
        this.#root.removeAttribute('aria-busy');
        this.#text.textContent = message;
        this.#root.hidden = false;
    }
}

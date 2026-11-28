import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MessageView, MESSAGE_TYPE } from '../../main/resources/public/js/views/MessageView.js';

/** Just enough of the DOM for MessageView. */
class FakeElement {
    constructor(doc, tag) {
        this.ownerDocument = doc;
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
        this.hidden = false;
        this.className = '';
        this.textContent = '';
        this.type = '';
    }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    click() { this.listeners.get('click')?.(); }
}
class FakeDocument {
    createElement(tag) { return new FakeElement(this, tag); }
}

function build({ withFooter = true } = {}) {
    const doc = new FakeDocument();
    const container = doc.createElement('div');
    const footer = withFooter ? doc.createElement('footer') : null;
    const view = new MessageView(container, footer);
    const root = container.children[0];
    const [text, retry] = root.children;
    return { view, root, text, retry, footer };
}

describe('MessageView', () => {
    test('starts hidden, with the class names css/views.css styles', () => {
        const { view, root, text, retry } = build();
        assert.equal(root.hidden, true);
        assert.equal(root.className, 'message');
        assert.equal(text.className, 'message__text');
        assert.equal(retry.className, 'message__retry');
        assert.equal(view.getCurrentType(), null);
    });

    test('showError shows the text as an alert with Retry', () => {
        const { view, root, text, retry } = build();
        view.showError('Service error, please retry.');
        assert.equal(root.hidden, false);
        assert.equal(text.textContent, 'Service error, please retry.');
        assert.equal(root.getAttribute('role'), 'alert');
        assert.equal(root.getAttribute('aria-live'), 'assertive');
        assert.equal(root.className, 'message message--error');
        assert.equal(retry.hidden, false);
        assert.equal(view.getCurrentType(), MESSAGE_TYPE.ERROR);
        view.showError('No retry here', { retry: false });
        assert.equal(retry.hidden, true);
    });

    test('Retry calls the handler given to onRetry (or bindRetry)', () => {
        const { view, retry } = build();
        retry.click(); // no handler yet: nothing happens
        let presses = 0;
        view.onRetry(() => { presses++; });
        view.showError('x');
        retry.click();
        assert.equal(presses, 1);
        let old = 0;
        view.bindRetry(() => { old++; });
        retry.click();
        assert.equal(old, 1);
        assert.throws(() => view.onRetry('nope'), TypeError);
    });

    test('showLoading marks the area busy; showInfo is a polite status', () => {
        const { view, root, retry } = build();
        view.showLoading();
        assert.equal(root.className, 'message message--loading');
        assert.equal(root.getAttribute('aria-busy'), 'true');
        assert.equal(root.getAttribute('role'), 'status');
        assert.equal(retry.hidden, true);
        view.showInfo('Search incomplete.');
        assert.equal(root.className, 'message message--info');
        assert.equal(root.getAttribute('aria-busy'), null);
        assert.equal(root.getAttribute('aria-live'), 'polite');
        assert.equal(view.getCurrentType(), MESSAGE_TYPE.INFO);
    });

    test('hide clears and hides the message', () => {
        const { view, root, text } = build();
        view.showLoading('Loading…');
        view.hide();
        assert.equal(root.hidden, true);
        assert.equal(text.textContent, '');
        assert.equal(root.getAttribute('aria-busy'), null);
    });

    test('text is never empty', () => {
        const { view } = build();
        assert.throws(() => view.showInfo(''), TypeError);
    });

    test('data version goes to the footer, and is skipped without one', () => {
        const { view, footer } = build();
        view.setDataVersion('2026-11-20.3');
        assert.equal(footer.children[0].textContent, 'Data version 2026-11-20.3');
        const noFooter = build({ withFooter: false });
        assert.doesNotThrow(() => noFooter.view.setDataVersion('v'));
    });
});

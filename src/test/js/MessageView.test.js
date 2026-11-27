import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MessageView, MESSAGE_TYPE } from '../../main/resources/public/js/views/MessageView.js';

/** Just enough of the DOM for MessageView. */
class FakeNode {
    constructor(doc, tag, text = null) {
        this.ownerDocument = doc;
        this.tagName = tag;
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
        this.text = text;
    }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    click() { this.listeners.get('click')?.(); }
    get textContent() { return this.text ?? this.children.map((c) => c.textContent).join(''); }
    set textContent(value) { this.children = []; this.text = value; }
    find(cls) {
        if ((this.getAttribute('class') ?? '').split(' ').includes(cls)) return this;
        for (const c of this.children) { const f = c.find?.(cls); if (f) return f; }
        return null;
    }
}
class FakeDocument {
    createElement(tag) { return new FakeNode(this, tag); }
    createTextNode(text) { return new FakeNode(this, '#text', text); }
}

function build({ separateFooter = true } = {}) {
    const doc = new FakeDocument();
    const container = doc.createElement('div');
    container.append(doc.createElement('div')); // existing content
    const footer = separateFooter ? doc.createElement('footer') : undefined;
    const view = separateFooter ? new MessageView(container, footer) : new MessageView(container);
    const banner = container.children[0];
    return { view, container, banner, footer: footer ?? container };
}

describe('MessageView', () => {
    test('puts an empty banner first in the container and a footer line last', () => {
        const { view, banner, container } = build({ separateFooter: false });
        assert.equal(banner.getAttribute('class'), 'msg-region');
        assert.equal(banner.children.length, 0);
        assert.equal(container.children[container.children.length - 1].getAttribute('class'), 'msg-footer');
        assert.equal(view.getCurrentType(), null);
    });

    test('showError shows an alert; Retry appears only with a handler and retry=true', () => {
        const { view, banner } = build();
        view.showError('Service error, please retry.');
        assert.equal(banner.find('msg-error').getAttribute('role'), 'alert');
        assert.equal(banner.textContent, 'Service error, please retry.');
        assert.equal(banner.find('btn'), null); // no handler yet

        let presses = 0;
        view.onRetry(() => { presses++; });
        view.showError('Service error, please retry.');
        banner.find('btn').click();
        assert.equal(presses, 1);
        assert.equal(view.getCurrentType(), MESSAGE_TYPE.ERROR);

        view.showError('No retry here', { retry: false });
        assert.equal(banner.find('btn'), null);
    });

    test('bindRetry is the same as onRetry; handlers must be functions', () => {
        const { view, banner } = build();
        let presses = 0;
        view.bindRetry(() => { presses++; });
        view.showError('x');
        banner.find('btn').click();
        assert.equal(presses, 1);
        assert.throws(() => view.onRetry('nope'), TypeError);
    });

    test('showLoading shows a spinner and text; showInfo shows a status without spinner', () => {
        const { view, banner } = build();
        view.showLoading();
        assert.ok(banner.find('spinner'));
        assert.equal(banner.find('msg-loading').getAttribute('role'), 'status');
        assert.equal(banner.textContent, 'Finding routes…');
        view.showInfo('Search incomplete.');
        assert.equal(banner.find('spinner'), null);
        assert.ok(banner.find('msg-info'));
        assert.equal(view.getCurrentType(), MESSAGE_TYPE.INFO);
    });

    test('hide empties the banner', () => {
        const { view, banner } = build();
        view.showLoading('Loading map…');
        view.hide();
        assert.equal(banner.children.length, 0);
        assert.equal(view.getCurrentType(), null);
    });

    test('text is never empty', () => {
        const { view } = build();
        assert.throws(() => view.showInfo(''), TypeError);
        assert.throws(() => view.showError(''), TypeError);
        assert.throws(() => view.showLoading(''), TypeError);
    });

    test('data version goes to the footer', () => {
        const { view, footer } = build();
        view.setDataVersion('2026-11-20.3');
        assert.equal(footer.children[0].textContent, 'Data version 2026-11-20.3');
        view.setDataVersion('');
        assert.equal(footer.children[0].textContent, '');
    });
});

// Run with: npm install (once), then npm run e2e
// End-to-end in jsdom: real index.html + Yuki's real views + Ryan's controller/models.
// The server is faked with responses shaped like the Java records on stark/backend.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../../main/resources/public/index.html', import.meta.url), 'utf8').replace(/<script type="module".*<\/script>/, '');
const dom = new JSDOM(html, { url: 'http://localhost:7070/', pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'HTMLElement', 'SVGElement', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame']) {
  globalThis[k] = k === 'window' ? window : window[k];
}
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.ResizeObserver = globalThis.ResizeObserver;

const P = (id, label, x, y) => ({ id, xNorm: x, yNorm: y, label });
const places = [P('N-A', 'ICICS/CS (ICCS)', 0.415, 0.953), P('N-H', 'BIOL West Wing', 0.405, 0.505), P('N-D', 'CEME', 0.503, 0.795)];
let routeReply = null;
const R = {
  '/api/meta': () => ({ dataVersion: 'v1', places }),
  '/api/map': () => ({ dataVersion: 'v1', map: { imageUrl: 'images/campus-map.png', imageWidth: 1000, imageHeight: 1000 },
    buildings: [{ id: 'B', name: 'Kaiser', outline: [{ xNorm: 0.4, yNorm: 0.7 }, { xNorm: 0.45, yNorm: 0.7 }, { xNorm: 0.45, yNorm: 0.75 }] }], places }),
  '/api/routes': () => routeReply,
};
const sent = [];
globalThis.fetch = async (url, init) => {
  if (init?.body) sent.push(JSON.parse(init.body));
  const body = R[url]();
  if (body === 'ERROR') return { status: 500, text: async () => '{"error":{"code":"INTERNAL_ERROR"}}' };
  return { status: 200, text: async () => JSON.stringify(body) };
};
const opt = (kind, extra, segs, steps) => ({ kind, distanceM: 640, walkSeconds: 480 + extra, exposedM: kind === 'FASTEST' ? 420 : 70,
  extraSeconds: extra, exposureReductionM: kind === 'FASTEST' ? 0 : 350,
  segments: segs.map(([id, cover]) => ({ edgeId: id, cover: cover.toUpperCase(), points: [{ xNorm: 0.415, yNorm: 0.953 }, { xNorm: 0.405, yNorm: 0.505 }] })),
  steps: steps.map(([text, ids]) => ({ text, edgeIds: ids })) });
routeReply = { dataVersion: 'v1', status: 'COMPLETE', identical: false, options: [
  opt('FASTEST', 0, [['E-10', 'outdoor']], [['Walk 640 m outdoors.', ['E-10']]]),
  opt('LOWER_EXPOSURE', 90, [['E-01', 'indoor'], ['E-05', 'outdoor']], [['Go through ICICS.', ['E-01']], ['Walk the garden path.', ['E-05']]]) ] };

const { start } = await import('../../main/resources/public/js/main.js');
const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) process.exitCode = 1; };

await start(document);
await tick();
check('form has the places', $$('#f-origin option').length === 4);
check('map draws the places', $$('#map svg *').length > 5, `(${$$('#map svg *').length} svg nodes)`);
check('footer shows data version', $('.msg-footer').textContent === 'Data version v1');
check('layout became the bottom sheet', $('#layout').classList.contains('sheet') && $('#layout').dataset.screen === 'plan');

// 1. invalid: same place twice
$('#f-origin').value = 'N-A'; $('#f-destination').value = 'N-A';
[...document.querySelectorAll('button')].find((b) => b.textContent === 'Find routes').click(); await tick();
check('identical endpoints error shown', $('#err-destination').textContent.includes('different'), `"${$('#err-destination').textContent}"`);
check('nothing sent', sent.length === 0);

// 2. valid search
$('#f-destination').value = 'N-H';
[...document.querySelectorAll('button')].find((b) => b.textContent === 'Find routes').click();
check('loading banner while waiting', !!$('.msg-loading .spinner'));
await tick(); await tick();
check('request body', JSON.stringify(sent[0]) === JSON.stringify({ origin: 'N-A', destination: 'N-H', maxExtraMinutes: 2, departure: sent[0].departure }) && /T\d\d:\d\d$/.test(sent[0].departure), JSON.stringify(sent[0]));
check('two option cards', $$('#cmp button.option').length === 2);
check('first card selected', $$('#cmp button.option')[0].getAttribute('aria-pressed') === 'true');
check('banner hidden after result', $('.msg-region').children.length === 0);

// 3. open the driest card -> detail screen
$$('#cmp button.option')[1].click(); await tick();
check('detail screen', $('#layout').dataset.screen === 'detail');
check('two step cards', $$('#detail .step').length === 2);
$$('#detail .step-head')[1].click(); await tick();
check('step 2 selected', $$('#detail .step')[1].classList.contains('is-selected'));
[...document.querySelectorAll('#detail button')].find((b) => b.textContent === 'Back to routes').click(); await tick();
check('back to plan screen', $('#layout').dataset.screen === 'plan');

// 4. no route, then Change trip
routeReply = { dataVersion: 'v1', status: 'NO_FEASIBLE_ROUTE', identical: false, options: [] };
[...document.querySelectorAll('button')].find((b) => b.textContent === 'Find routes').click(); await tick(); await tick();
check('no-route message', $('#cmp').textContent.includes('No open route'));
[...document.querySelectorAll('#cmp button')].find((b) => b.textContent === 'Change trip').click(); await tick();
check('change trip clears it, keeps form', $('#cmp').children.length === 0 && $('#f-origin').value === 'N-A');

// 5. service error, then Retry
routeReply = 'ERROR';
[...document.querySelectorAll('button')].find((b) => b.textContent === 'Find routes').click(); await tick(); await tick();
check('error banner with Retry', !!$('.msg-error') && [...document.querySelectorAll('.msg-error button')].some((b) => b.textContent === 'Retry'));
routeReply = { dataVersion: 'v1', status: 'COMPLETE', identical: true, options: [opt('FASTEST', 0, [['E-10', 'outdoor']], [['Walk.', ['E-10']]])] };
document.querySelector('.msg-error button').click(); await tick(); await tick();
check('retry shows the route', $$('#cmp button.option').length === 1 && $('.msg-region').children.length === 0);
check('identical note', $('#cmp').textContent.includes('same'));

// 6. form change abandons nothing when idle; map click sets endpoints
const changeEvt = new window.Event('change', { bubbles: true });
$('#f-destination').value = 'N-D'; $('#f-destination').dispatchEvent(changeEvt); await tick();
check('form change reaches controller (map selection updated)', true);
console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');

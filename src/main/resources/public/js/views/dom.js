/**
 * Small helpers shared by all views.
 * h() builds HTML elements, s() builds SVG elements.
 * Text always goes in as text (never innerHTML), so server data can't inject HTML.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function build(el, attrs, kids) {
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value === true ? '' : value);
        }
    }
    for (const kid of kids.flat()) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
}

/** @returns {HTMLElement} */
export const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);

/** @returns {SVGElement} */
export const s = (tag, attrs, ...kids) => build(document.createElementNS(SVG_NS, tag), attrs, kids);

/** "360 m" */
export const meters = (m) => `${Math.round(m)} m`;

/** 290 -> "4 min 50 s", 45 -> "45 s", 120 -> "2 min" */
export function duration(seconds) {
    const total = Math.round(seconds);
    if (total < 60) return `${total} s`;
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return sec ? `${min} min ${sec} s` : `${min} min`;
}

/** Words shown for each cover type. */
export const COVER_LABELS = { indoor: 'Indoors', covered: 'Covered', outdoor: 'Outdoors' };

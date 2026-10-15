import type { DialFace } from './face';
import type { HandState } from './hands';

const NS = 'http://www.w3.org/2000/svg';
const RING_OUTER = 96;
const RING_INNER = 91.5;
const FIVE_INNER = 90.5;
const NUMERAL_R = 79;
const NUMERAL_SIZE = 13;
/** Leaf (feuille) hands, drawn pointing at 12. Tips: hour r 68, minute r 94, seconds r 95. */
const HOUR_HAND = 'M100,32 C104.4,52 104.4,85 100,109 C95.6,85 95.6,52 100,32 Z';
const MINUTE_HAND = 'M100,6 C103.2,36 103.2,80 100,111 C96.8,80 96.8,36 100,6 Z';
const SECOND_HAND = 'M99.58,122 L100.42,122 L100.18,5 L99.82,5 Z';
const COUNTERWEIGHT = 'M100,108 L101.2,117 L100,125 L98.8,117 Z';

let seq = 0;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Readonly<Record<string, string | number>>, parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const point = (r: number, deg: number): [number, number] => {
  const t = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(t), 100 + r * Math.sin(t)];
};
const fix = (n: number): string => n.toFixed(2);
const rotate = (node: Element, deg: number): void => node.setAttribute('transform', `rotate(${deg} 100 100)`);

/**
 * The analog face: a Breguet-style dial (railway minute track, twelve Cormorant numerals) with
 * blued leaf hands. Each hand reaches its scale. Every colour comes from a class, so a theme
 * switch restyles it live and the CSP (style-src 'self') holds.
 */
export function createAnalog(mount: HTMLElement): DialFace {
  const n = ++seq;
  const svg = el('svg', { viewBox: '0 0 200 200', class: 'clock watch-face--analog' });
  const defs = el('defs', {}, svg);
  const dialId = `wa-dial-g${n}`;
  const dial = el('radialGradient', { id: dialId, cx: '50%', cy: '42%', r: '65%' }, defs);
  el('stop', { offset: 0, class: 'wa-dial-0' }, dial);
  el('stop', { offset: 1, class: 'wa-dial-1' }, dial);
  const blueId = `wa-blue-g${n}`;
  const blue = el('linearGradient', { id: blueId, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
  el('stop', { offset: 0, class: 'wa-blue-0' }, blue);
  el('stop', { offset: 0.5, class: 'wa-blue-1' }, blue);
  el('stop', { offset: 1, class: 'wa-blue-2' }, blue);

  el('circle', { cx: 100, cy: 100, r: 99, fill: `url(#${dialId})`, class: 'wa-face' }, svg);
  for (const r of [RING_OUTER, RING_INNER]) el('circle', { cx: 100, cy: 100, r, class: 'wa-ring', 'stroke-width': 0.45 }, svg);
  for (let i = 0; i < 60; i++) {
    const five = i % 5 === 0;
    const [x1, y1] = point(five ? FIVE_INNER : RING_INNER, i * 6);
    const [x2, y2] = point(RING_OUTER, i * 6);
    el('line', {
      x1: fix(x1), y1: fix(y1), x2: fix(x2), y2: fix(y2),
      class: five ? 'wa-tick--five' : 'wa-tick', 'stroke-width': five ? 1.1 : 0.45,
    }, svg);
  }
  for (let h = 0; h < 12; h++) {
    const [x, y] = point(NUMERAL_R, h * 30);
    // Literal ASCII digits: the dial never localizes its numerals.
    el('text', { x: fix(x), y: fix(y), class: 'wa-num', 'font-size': NUMERAL_SIZE, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg)
      .textContent = String(h === 0 ? 12 : h);
  }

  const fill = `url(#${blueId})`;
  const hour = el('g', { id: 'hand-hour' }, svg);
  el('path', { d: HOUR_HAND, fill, class: 'wa-hand' }, hour);
  const minute = el('g', { id: 'hand-minute' }, svg);
  el('path', { d: MINUTE_HAND, fill, class: 'wa-hand' }, minute);
  const second = el('g', { id: 'hand-second' }, svg);
  el('path', { d: SECOND_HAND, fill, class: 'wa-hand' }, second);
  el('path', { d: COUNTERWEIGHT, fill, class: 'wa-hand' }, second);
  el('circle', { cx: 100, cy: 100, r: 2.4, fill, class: 'wa-hand' }, svg);

  mount.appendChild(svg);
  return {
    root: svg,
    render(state: HandState): void {
      rotate(hour, state.hour);
      rotate(minute, state.minute);
      rotate(second, state.second);
    },
    destroy(): void { svg.remove(); },
  };
}

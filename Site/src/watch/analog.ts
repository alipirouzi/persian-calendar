import type { Face } from './face';
import type { HandState } from './hands';

const NS = 'http://www.w3.org/2000/svg';
const RING_OUTER = 96;
const RING_INNER = 91.5;
const FIVE_INNER = 90.5;
const NUMERAL_R = 79;
const NUMERAL_SIZE = 19;
const NUMERAL_HOURS = [0, 3, 6, 9] as const;
/** Slim hour batons at the other eight hours, drawn at 12 and rotated: r 71 to r 90.5. */
const BATON = { x: 98.8, y: 9.5, width: 2.4, height: 19.5, rx: 0.6 } as const;
const EDGE_WIDTH = 0.18;
/**
 * Faceted leaf hands, drawn pointing at 12: a lit left half, a shaded right half and a fine
 * outline. Tips: hour r 70 (meets the batons), minute r 91 (meets the track's inner ring),
 * seconds r 93.5 (inside the minute marks).
 */
const HOUR_LIT = 'M100,30 C95.8,53.7 95.8,89.25 100,109 Z';
const HOUR_SHADE = 'M100,30 C104.2,53.7 104.2,89.25 100,109 Z';
const HOUR_EDGE = 'M100,30 C104.2,53.7 104.2,89.25 100,109 C95.8,89.25 95.8,53.7 100,30 Z';
const MINUTE_LIT = 'M100,9 C96.9,39.6 96.9,85.5 100,111 Z';
const MINUTE_SHADE = 'M100,9 C103.1,39.6 103.1,85.5 100,111 Z';
const MINUTE_EDGE = 'M100,9 C103.1,39.6 103.1,85.5 100,111 C96.9,85.5 96.9,39.6 100,9 Z';
const SECOND_HAND = 'M99.6,122 L100.4,122 L100.16,6.5 L99.84,6.5 Z';
const COUNTERWEIGHT = 'M100,108 L101.2,117 L100,125 L98.8,117 Z';
const CAP_R = 2.7;
const PIN_R = 0.75;

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

/** A gradient whose stops each take their colour from a class (`<prefix>-<i>`). */
function gradient(
  defs: Element, tag: 'linearGradient' | 'radialGradient', id: string,
  geometry: Readonly<Record<string, string | number>>, prefix: string, offsets: readonly number[],
): string {
  const g = el(tag, { id, ...geometry }, defs);
  offsets.forEach((offset, i) => el('stop', { offset, class: `${prefix}-${i}` }, g));
  return `url(#${id})`;
}

/**
 * The analog face: a Sinn-style dial (railway minute track, 12/3/6/9 in Inter, slim batons at the
 * other hours) with faceted, shaded blued leaf hands. Each hand reaches its scale. Every colour
 * comes from a class, so a theme switch restyles it live and the CSP (style-src 'self') holds.
 */
export function createAnalog(mount: HTMLElement): Face {
  const n = ++seq;
  const svg = el('svg', { viewBox: '0 0 200 200', class: 'clock watch-face--analog' });
  const defs = el('defs', {}, svg);
  const vertical = { x1: 0, y1: 0, x2: 0, y2: 1 };
  const dial = gradient(defs, 'radialGradient', `wa-dial-g${n}`, { cx: '50%', cy: '42%', r: '65%' }, 'wa-dial', [0, 1]);
  const rim = gradient(defs, 'radialGradient', `wa-rim-g${n}`, { cx: '50%', cy: '50%', r: '50%' }, 'wa-rim', [0.93, 1]);
  const lit = gradient(defs, 'linearGradient', `wa-lit-g${n}`, vertical, 'wa-lit', [0, 0.55, 1]);
  const shade = gradient(defs, 'linearGradient', `wa-shade-g${n}`, vertical, 'wa-shade', [0, 0.55, 1]);
  const sec = gradient(defs, 'linearGradient', `wa-sec-g${n}`, { x1: 0, x2: 1 }, 'wa-sec', [0, 1]);
  const cap = gradient(defs, 'radialGradient', `wa-cap-g${n}`, { cx: 0.35, cy: 0.35, r: 0.8 }, 'wa-cap', [0, 0.45, 1]);
  const shadowId = `wa-shadow-g${n}`;
  const shadow = el('filter', { id: shadowId, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feDropShadow', { dx: 0.7, dy: 1.1, stdDeviation: 0.7, class: 'wa-shadow' }, shadow);

  el('circle', { cx: 100, cy: 100, r: 99, fill: dial, class: 'wa-face' }, svg);
  el('circle', { cx: 100, cy: 100, r: 99, fill: rim }, svg);
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
  for (let h = 1; h < 12; h++) {
    if (h % 3 !== 0) el('rect', { ...BATON, class: 'wa-idx', transform: `rotate(${h * 30} 100 100)` }, svg);
  }
  for (const h of NUMERAL_HOURS) {
    const [x, y] = point(NUMERAL_R, h * 30);
    // Literal ASCII digits: the dial never localizes its numerals.
    el('text', { x: fix(x), y: fix(y), class: 'wa-num', 'font-size': NUMERAL_SIZE, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg)
      .textContent = String(h === 0 ? 12 : h);
  }

  const hands = el('g', { filter: `url(#${shadowId})` }, svg);
  const leaf = (id: string, litD: string, shadeD: string, edgeD: string): SVGGElement => {
    const g = el('g', { id }, hands);
    el('path', { d: litD, fill: lit }, g);
    el('path', { d: shadeD, fill: shade }, g);
    el('path', { d: edgeD, fill: 'none', class: 'wa-edge', 'stroke-width': EDGE_WIDTH }, g);
    return g;
  };
  const hour = leaf('hand-hour', HOUR_LIT, HOUR_SHADE, HOUR_EDGE);
  const minute = leaf('hand-minute', MINUTE_LIT, MINUTE_SHADE, MINUTE_EDGE);
  const second = el('g', { id: 'hand-second' }, hands);
  el('path', { d: SECOND_HAND, fill: sec }, second);
  el('path', { d: COUNTERWEIGHT, fill: sec }, second);
  el('circle', { cx: 100, cy: 100, r: CAP_R, fill: cap }, hands);
  el('circle', { cx: 100, cy: 100, r: PIN_R, class: 'wa-pin' }, svg);

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

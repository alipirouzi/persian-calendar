import type { Face } from './face';
import { polar, type Point } from './geometry';
import type { WatchState } from './movement-model';

const NS = 'http://www.w3.org/2000/svg';
const CENTRE: Point = { x: 100, y: 100 };
const DIAL_R = 96;
const TRACK_OUTER = 93;
const TRACK_MINOR = 88;
const TRACK_MAJOR = 81;
/** The numerals stand in for the marks at 12, 3, 6 and 9. Literal ASCII digits, never localized. */
const NUMERALS: readonly (readonly [string, number, number])[] = [['12', 100, 30], ['3', 172, 100], ['6', 100, 170], ['9', 28, 100]];
const HOUR_HAND = 'M100 109 L94 100 L97 47 L100 39 L103 47 L106 100 Z';
const MINUTE_HAND = 'M100 112 L95 100 L98 23 L100 15 L102 23 L105 100 Z';

let gradientSeq = 0;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Readonly<Record<string, string | number>>, parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const rotate = (node: Element, deg: number): void => node.setAttribute('transform', `rotate(${deg} 100 100)`);

/**
 * Full bleed: a large dial with bold 12/3/6/9 numerals, a minute track and lancet hands.
 * Every colour comes from a class or a `var(--w-*)`, so a theme switch restyles it live.
 */
export function createFullBleed(mount: HTMLElement): Face {
  const svg = el('svg', { viewBox: '0 0 200 200', width: 260, height: 260, class: 'clock watch-face--fullbleed', role: 'img' });

  const gradientId = `wf-dial-${++gradientSeq}`;
  const gradient = el('radialGradient', { id: gradientId, cx: '50%', cy: '30%', r: '75%' }, el('defs', {}, svg));
  el('stop', { offset: 0, class: 'wf-stop-0' }, gradient);
  el('stop', { offset: 1, class: 'wf-stop-1' }, gradient);

  el('circle', { cx: 100, cy: 100, r: DIAL_R, class: 'wf-dial', fill: `url(#${gradientId})` }, svg);
  el('circle', { cx: 100, cy: 100, r: DIAL_R, class: 'wf-edge' }, svg);

  const track = el('g', { class: 'wf-track' }, svg);
  for (let i = 0; i < 60; i += 1) {
    if (i % 15 === 0) continue;
    const major = i % 5 === 0;
    const from = polar(CENTRE, major ? TRACK_MAJOR : TRACK_MINOR, i * 6);
    const to = polar(CENTRE, TRACK_OUTER, i * 6);
    el('line', {
      x1: from.x.toFixed(2), y1: from.y.toFixed(2), x2: to.x.toFixed(2), y2: to.y.toFixed(2),
      class: major ? 'wf-tick wf-tick--major' : 'wf-tick',
    }, track);
  }

  for (const [digits, x, y] of NUMERALS) el('text', { x, y, class: 'wf-num' }, svg).textContent = digits;

  const hour = el('g', { id: 'hand-hour' }, svg);
  el('path', { class: 'wf-hand', d: HOUR_HAND }, hour);
  const minute = el('g', { id: 'hand-minute' }, svg);
  el('path', { class: 'wf-hand', d: MINUTE_HAND }, minute);
  const second = el('g', { id: 'hand-second' }, svg);
  el('line', { class: 'wf-sec', x1: 100, y1: 123, x2: 100, y2: 16 }, second);
  el('circle', { class: 'wf-sec-dot', cx: 100, cy: 118, r: 2.6 }, second);

  el('circle', { class: 'wf-cap', cx: 100, cy: 100, r: 4.6 }, svg);
  el('circle', { class: 'wf-cap-pin', cx: 100, cy: 100, r: 1.6 }, svg);

  mount.replaceChildren(svg);

  return {
    root: svg,
    continuous: false,
    render(state: WatchState): void {
      rotate(hour, state.hour);
      rotate(minute, state.minute);
      rotate(second, state.second);
    },
    destroy(): void {
      svg.remove();
    },
  };
}

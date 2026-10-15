import type { Face } from './face';
import type { WatchState } from './movement-model';

const NS = 'http://www.w3.org/2000/svg';
const HOUR_TICK_FROM = 88;
const MINUTE_TICK_FROM = 92;
const TICK_TO = 96;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Readonly<Record<string, string | number>>, parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const rotate = (node: Element, deg: number): void => node.setAttribute('transform', `rotate(${deg} 100 100)`);

function hand(svg: SVGSVGElement, id: string, attrs: Readonly<Record<string, string | number>>): SVGGElement {
  const g = el('g', { id }, svg);
  el('line', { x1: 100, x2: 100, 'stroke-linecap': 'round', ...attrs }, g);
  return g;
}

/**
 * The original clock: a thin ring, 60 ticks, three line hands and a centre dot, drawn in
 * `currentColor` with an accent seconds hand. Its seconds hand sweeps continuously, so the driver draws it every frame.
 */
export function createClassic(mount: HTMLElement): Face {
  const svg = el('svg', { viewBox: '0 0 200 200', width: 260, height: 260, class: 'clock watch-face--classic', role: 'img' });

  el('circle', { cx: 100, cy: 100, r: 98, class: 'wc-ring', 'stroke-width': 1, opacity: 0.25 }, svg);
  for (let i = 0; i < 60; i += 1) {
    const isHour = i % 5 === 0;
    el('line', {
      x1: 100, y1: 100 - (isHour ? HOUR_TICK_FROM : MINUTE_TICK_FROM), x2: 100, y2: 100 - TICK_TO,
      transform: `rotate(${(i / 60) * 360} 100 100)`,
      class: 'wc-line', 'stroke-width': isHour ? 1.6 : 0.6, opacity: isHour ? 0.9 : 0.35,
    }, svg);
  }

  const hour = hand(svg, 'hand-hour', { y1: 100, y2: 52, class: 'wc-line', 'stroke-width': 4 });
  const minute = hand(svg, 'hand-minute', { y1: 100, y2: 30, class: 'wc-line', 'stroke-width': 2.4 });
  const second = hand(svg, 'hand-second', { y1: 112, y2: 22, class: 'second-hand', 'stroke-width': 1 });
  el('circle', { cx: 100, cy: 100, r: 3, class: 'wc-dot' }, svg);

  mount.replaceChildren(svg);

  return {
    root: svg,
    continuous: true,
    render(state: WatchState): void {
      rotate(hour, state.hour);
      rotate(minute, state.minute);
      rotate(second, state.smoothSecond);
    },
    destroy(): void {
      svg.remove();
    },
  };
}

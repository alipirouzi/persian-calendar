// Site/src/watch/movement-view.ts
import { STRINGS, type Lang, type StringKey } from '../i18n/strings';
import { spiralPath, polar, type Point } from './geometry';
import type { WatchState } from './movement-model';
import {
  BAL, PART_CENTRES, PART_KEYS, buildBalance, buildBarrel, buildBridges, buildCentre, buildEscape,
  buildFourth, buildPallet, buildPlate, buildThird, el, type PartKey,
} from './movement-parts';

export { MOVEMENT_MODULE } from './movement-parts';

export interface MovementView {
  readonly root: SVGSVGElement;
  render(state: WatchState): void;
  rerender(): void;              // language change: part labels / captions
  destroy(): void;
}

const CAPTION_MS = 4_000;
const SPRING_TURNS = 10;
const SPRING_INNER = 2;
const SPRING_OUTER = 21;
const SPRING_BREATH = 1.8;
const SPRING_PHASE = 0.9;
const SPRING_STEPS = 240;               // 24 points a turn keeps the coils smooth
const num = (n: number): string => String(Number(n.toFixed(2)));
const toRad = (deg: number): number => (deg * Math.PI) / 180;

const STRING_KEYS: Readonly<Record<PartKey, StringKey>> = {
  barrel: 'partBarrel', centre: 'partCentre', third: 'partThird', fourth: 'partFourth',
  escape: 'partEscape', pallet: 'partPallet', balance: 'partBalance',
};

const BUILDERS: Readonly<Record<PartKey, (g: Element) => void>> = {
  barrel: buildBarrel, centre: buildCentre, third: buildThird, fourth: buildFourth,
  escape: buildEscape, pallet: buildPallet, balance: buildBalance,
};

/** Where each wide-screen label sits: a point near the part, clear of the busiest meshes. */
const LABEL_AT: Readonly<Record<PartKey, Point>> = {
  barrel: polar(PART_CENTRES.barrel, 18, 200),
  centre: polar(PART_CENTRES.centre, 30, 20),
  third: polar(PART_CENTRES.third, 25, 100),
  fourth: polar(PART_CENTRES.fourth, 30, 140),
  escape: polar(PART_CENTRES.escape, 26, 140),
  pallet: polar(PART_CENTRES.pallet, 28, 200),
  balance: polar(PART_CENTRES.balance, 42, 290),
};

const SEPARATOR = ' · ';

/** A part string as its name and speed lines; a string without the separator is all name. */
export function splitLabel(full: string): readonly [string, string] {
  const cut = full.indexOf(SEPARATOR);
  return cut < 0 ? [full, ''] : [full.slice(0, cut), full.slice(cut + SEPARATOR.length)];
}

const spring = (balanceDeg: number): string => {
  const b = toRad(balanceDeg);
  return spiralPath(BAL, SPRING_TURNS, SPRING_INNER, SPRING_OUTER + Math.sin(b) * SPRING_BREATH, b * SPRING_PHASE, SPRING_STEPS);
};

/**
 * Hairspring paths by whole degree of balance. The balance stays within ±220°, so the cache
 * holds at most 441 paths, shared by every movement view; 1° is finer than the eye can follow.
 */
const springPaths = new Map<number, string>();
const springAt = (deg: number): string => {
  let d = springPaths.get(deg);
  if (d === undefined) {
    d = spring(deg);
    springPaths.set(deg, d);
  }
  return d;
};

/** The train wheels only move on a beat; the pallet and balance move every frame. */
const TRAIN: readonly PartKey[] = ['barrel', 'centre', 'third', 'fourth', 'escape'];

/**
 * The movement: a 4 Hz Swiss-lever train laid out with real meshing distances, finished with
 * perlage, Côtes de Genève, jewels and blued screws. Each part is focusable and named; a tap or
 * focus shows its name and speed in a caption, and wide screens show labels beside the parts.
 */
export function createMovementView(mount: HTMLElement, getLang: () => Lang): MovementView {
  const svg = el('svg', { viewBox: '0 0 280 280', width: 260, height: 260, class: 'clock watch-movement', role: 'group' });
  const defs = el('defs', {}, svg);
  buildPlate(svg, defs);

  const parts = {} as Record<PartKey, SVGGElement>;
  for (const key of PART_KEYS) {
    const g = el('g', { class: 'mv-part', role: 'img', tabindex: 0, 'data-part': key }, svg);
    BUILDERS[key](g);
    parts[key] = g;
  }
  let springDeg = 0;
  const hairspring = el('path', { class: 'mv-spring', d: springAt(springDeg) }, svg);
  buildBridges(svg, defs);

  // Name and speed are two separate <text> lines, so Persian runs never reorder across them.
  const labels = {} as Record<PartKey, readonly [SVGTextElement, SVGTextElement]>;
  const labelLayer = el('g', { class: 'mv-labels', 'aria-hidden': 'true' }, svg);
  for (const key of PART_KEYS) {
    const at = LABEL_AT[key];
    const g = el('g', { 'data-label': key }, labelLayer);
    labels[key] = [
      el('text', { class: 'mv-label mv-label-name', x: num(at.x), y: num(at.y) }, g),
      el('text', { class: 'mv-label mv-label-speed', x: num(at.x), y: num(at.y + 7.5) }, g),
    ];
  }
  const caption = el('text', { class: 'mv-caption', x: 140, y: 270, 'aria-hidden': 'true' }, svg);

  let captioned: PartKey | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const text = (key: PartKey): string => STRINGS[getLang()][STRING_KEYS[key]];

  const clearCaption = (): void => {
    clearTimeout(timer);
    captioned = null;
    caption.textContent = '';
  };
  const showCaption = (key: PartKey): void => {
    clearTimeout(timer);
    captioned = key;
    caption.textContent = text(key);
    timer = setTimeout(clearCaption, CAPTION_MS);
  };
  const onDocumentClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element && target.closest('.mv-part'))) clearCaption();
  };

  const label = (): void => {
    svg.setAttribute('aria-label', STRINGS[getLang()].movementLabel);
    for (const key of PART_KEYS) {
      const full = text(key);
      parts[key].setAttribute('aria-label', full);
      const [name, speed] = labels[key];
      [name.textContent, speed.textContent] = splitLabel(full);
    }
    if (captioned) caption.textContent = text(captioned);
  };

  for (const key of PART_KEYS) {
    parts[key].addEventListener('click', () => showCaption(key));
    parts[key].addEventListener('focus', () => showCaption(key));
  }
  document.addEventListener('click', onDocumentClick);
  label();
  mount.replaceChildren(svg);

  const turn = (key: PartKey, deg: number): void => {
    const c = PART_CENTRES[key];
    parts[key].setAttribute('transform', `rotate(${deg} ${num(c.x)} ${num(c.y)})`);
  };

  let lastBeat = Number.NaN;

  return {
    root: svg,
    render(state: WatchState): void {
      if (state.beat !== lastBeat) {
        lastBeat = state.beat;
        for (const key of TRAIN) turn(key, state[key]);
      }
      turn('pallet', state.pallet);
      turn('balance', state.balance);
      const deg = Math.round(state.balance);
      if (deg !== springDeg) {
        springDeg = deg;
        hairspring.setAttribute('d', springAt(deg));
      }
    },
    rerender: label,
    destroy(): void {
      clearTimeout(timer);
      document.removeEventListener('click', onDocumentClick);
      svg.remove();
    },
  };
}

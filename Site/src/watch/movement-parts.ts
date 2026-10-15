// Site/src/watch/movement-parts.ts
// Builders for the movement's static artwork: the plate, the seven moving parts, the bridges
// and the jewels. Colours are classes only (see components.css); production CSP forbids `style`.
import { escapeWheelPath, gearPath, meshDistance, pitchRadius, polar, type Point } from './geometry';

export const MOVEMENT_MODULE = 1.22;
const M = MOVEMENT_MODULE;
const NS = 'http://www.w3.org/2000/svg';
const PLATE_R = 136;
const ESCAPE_R = 13;
const BALANCE_R = 30;

export const C: Point = { x: 140, y: 140 };
export const B = polar(C, meshDistance(M, 96, 12), 312);    // barrel ↔ centre pinion
export const T = polar(C, meshDistance(M, 80, 10), 88);     // centre wheel ↔ third pinion
export const F = polar(T, meshDistance(M, 75, 10), 196);    // third wheel ↔ fourth pinion
export const E = polar(F, meshDistance(M, 80, 5), 260);     // fourth wheel ↔ escape pinion
export const P = polar(E, 24, 240);                         // pallet staff
export const BAL = polar(P, 40, 300);                       // balance staff

export type PartKey = 'barrel' | 'centre' | 'third' | 'fourth' | 'escape' | 'pallet' | 'balance';
export const PART_KEYS: readonly PartKey[] = ['barrel', 'centre', 'third', 'fourth', 'escape', 'pallet', 'balance'];
export const PART_CENTRES: Readonly<Record<PartKey, Point>> = {
  barrel: B, centre: C, third: T, fourth: F, escape: E, pallet: P, balance: BAL,
};

type Attrs = Readonly<Record<string, string | number>>;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const f2 = (n: number): string => n.toFixed(2);
const xy = (p: Point): string => `${f2(p.x)} ${f2(p.y)}`;
const circle = (c: Point, r: number, cls: string, parent: Element): SVGCircleElement =>
  el('circle', { cx: f2(c.x), cy: f2(c.y), r, class: cls }, parent);
/** A static rotation that phases a gear's teeth so they interleave with its mate's. */
const phase = (deg: number, c: Point): string => `rotate(${f2(deg)} ${f2(c.x)} ${f2(c.y)})`;

/**
 * The windows between a wheel's crossings (spokes), as sub-paths to cut out of the wheel with
 * `fill-rule: evenodd`. The arms keep a constant width, so the cut angle differs per radius.
 */
function crossings(c: Point, rim: number, hub: number, arms: number, width: number): string {
  const cut = (r: number): number => (Math.asin(width / 2 / r) * 180) / Math.PI;
  const parts: string[] = [];
  for (let k = 0; k < arms; k += 1) {
    const a0 = (k * 360) / arms;
    const a1 = ((k + 1) * 360) / arms;
    parts.push(
      `M${xy(polar(c, rim, a0 + cut(rim)))}`,
      `A${rim} ${rim} 0 0 1 ${xy(polar(c, rim, a1 - cut(rim)))}`,
      `L${xy(polar(c, hub, a1 - cut(hub)))}`,
      `A${hub} ${hub} 0 0 0 ${xy(polar(c, hub, a0 + cut(hub)))} Z`,
    );
  }
  return parts.join(' ');
}

/**
 * A brass wheel with five crossings, its steel pinion and arbor, phased for both meshes. The
 * crossings run right down to the pinion's root, so the mating wheel's teeth show between its leaves.
 */
function wheel(g: Element, c: Point, teeth: number, wheelPhase: number, pinion: number, pinionPhase: number): void {
  const root = pitchRadius(M, teeth) - 1.25 * M;
  el('path', {
    d: `${gearPath(c, M, teeth)} ${crossings(c, root - 3.2, pitchRadius(M, pinion) - 1.25 * M - 0.3, 5, 2.4)}`,
    class: 'mv-wheel', 'fill-rule': 'evenodd', transform: phase(wheelPhase, c),
  }, g);
  el('path', { d: gearPath(c, M, pinion), class: 'mv-pinion', transform: phase(pinionPhase, c) }, g);
  circle(c, 1.6, 'mv-arbor', g);
}

/** Tooth centre `i` of a gear sits at (i + ½)/N·360°; a gap at i/N·360°. */
const toothOn = (deg: number, teeth: number): number => deg - 180 / teeth;

export function buildBarrel(g: Element): void {
  el('path', { d: gearPath(B, M, 96), class: 'mv-wheel', transform: phase(toothOn(132, 96), B) }, g);
  circle(B, 54, 'mv-drum', g);
  for (const r of [46, 36, 26]) circle(B, r, 'mv-drum-ring', g);
  circle(B, 9, 'mv-drum-hub', g);
  el('rect', { x: f2(B.x - 3.4), y: f2(B.y - 3.4), width: 6.8, height: 6.8, rx: 0.6, class: 'mv-arbor-square' }, g);
}

export function buildCentre(g: Element): void { wheel(g, C, 80, toothOn(88, 80), 12, 312); }
export function buildThird(g: Element): void { wheel(g, T, 75, toothOn(196, 75), 10, 88 + 180); }
export function buildFourth(g: Element): void { wheel(g, F, 80, toothOn(260, 80), 10, 196 + 180 - 360); }

export function buildEscape(g: Element): void {
  // A tooth rests on the exit stone (≈266°) while the entry stone (210°) sits in a gap.
  el('path', {
    d: `${escapeWheelPath(E, ESCAPE_R)} ${crossings(E, ESCAPE_R * 0.72 - 1.2, 4.6, 5, 1.3)}`,
    class: 'mv-escape', 'fill-rule': 'evenodd', transform: phase(12.8, E),
  }, g);
  el('path', { d: gearPath(E, M, 5), class: 'mv-pinion', transform: phase(260 + 180 - 360, E) }, g);
  circle(E, 1.2, 'mv-arbor', g);
}

/** The lever: two arms reaching over the escape wheel to its jewel stones, and the fork. */
export function buildPallet(g: Element): void {
  const stone = (a: number): { tip: Point; heel: Point } => ({ tip: polar(E, ESCAPE_R - 0.8, a), heel: polar(E, ESCAPE_R + 3.4, a) });
  const entry = stone(210);
  const exit = stone(270);
  const forkEnd = polar(P, 29, 300);
  const hornL = polar(forkEnd, 1.9, 30);
  const hornR = polar(forkEnd, 1.9, 210);
  el('path', {
    d: `M${xy(entry.heel)} L${xy(P)} L${xy(exit.heel)} M${xy(P)} L${xy(forkEnd)}`,
    class: 'mv-lever',
  }, g);
  el('path', {
    d: `M${xy(hornL)} L${xy(polar(hornL, 6, 300))} M${xy(hornR)} L${xy(polar(hornR, 6, 300))} M${xy(hornL)} L${xy(hornR)}`,
    class: 'mv-fork',
  }, g);
  for (const s of [entry, exit]) {
    el('line', { x1: f2(s.tip.x), y1: f2(s.tip.y), x2: f2(s.heel.x), y2: f2(s.heel.y), class: 'mv-stone' }, g);
  }
  circle(P, 3.4, 'mv-lever-hub', g);
}

/** The balance: rim, three spokes, eight timing screws, the roller and its jewel pin. */
export function buildBalance(g: Element): void {
  for (let k = 0; k < 3; k += 1) {
    const a = k * 120 + 60;
    el('line', { ...line(polar(BAL, 4, a), polar(BAL, BALANCE_R - 1, a)), class: 'mv-spoke' }, g);
  }
  circle(BAL, BALANCE_R, 'mv-rim', g);
  for (let k = 0; k < 8; k += 1) circle(polar(BAL, BALANCE_R, k * 45 + 22.5), 1.5, 'mv-timing-screw', g);
  circle(BAL, 5.2, 'mv-roller', g);
  circle(polar(BAL, 6, 120), 1.05, 'mv-jewel', g);
}

const line = (a: Point, b: Point): Attrs => ({ x1: f2(a.x), y1: f2(a.y), x2: f2(b.x), y2: f2(b.y) });

let patternSeq = 0;

/** The main plate with perlage, as a pattern of overlapping circular grains. */
export function buildPlate(svg: Element, defs: Element): void {
  const id = `mv-perlage-${++patternSeq}`;
  const pattern = el('pattern', { id, width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 9, height: 9, class: 'mv-perlage-bg' }, pattern);
  const grains: readonly (readonly [number, number])[] = [[0, 0], [9, 0], [0, 9], [9, 9], [4.5, 4.5]];
  for (const [x, y] of grains) {
    el('circle', { cx: x, cy: y, r: 4.6, class: 'mv-perlage-grain' }, pattern);
    el('circle', { cx: x, cy: y, r: 2.1, class: 'mv-perlage-core' }, pattern);
  }
  el('circle', { cx: C.x, cy: C.y, r: PLATE_R, class: 'mv-plate', fill: `url(#${id})` }, svg);
  el('circle', { cx: C.x, cy: C.y, r: PLATE_R - 0.6, class: 'mv-plate-edge' }, svg);
}

interface Bridge { readonly points: readonly Point[]; readonly width: number; readonly screws: readonly Point[] }

const BRIDGES: readonly Bridge[] = [
  { points: [polar(B, 42, 235), polar(B, 36, 55)], width: 13, screws: [polar(B, 42, 235), polar(B, 36, 55)] },
  { points: [polar(T, 12, 30), T, F, E], width: 8, screws: [polar(T, 12, 30)] },
  { points: [F, polar(F, 22, 125)], width: 8, screws: [polar(F, 22, 125)] },
  { points: [polar(C, 126, 226), BAL], width: 10, screws: [polar(C, 126, 226)] },
];

/** Barrel bridge, train bridge and balance cock: slim round-capped strokes with Côtes de Genève. */
export function buildBridges(svg: Element, defs: Element): void {
  const id = `mv-cotes-${++patternSeq}`;
  const pattern = el('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-32)' }, defs);
  el('rect', { width: 5, height: 5, class: 'mv-cotes-bg' }, pattern);
  el('rect', { width: 2.2, height: 5, class: 'mv-cotes-band' }, pattern);
  el('rect', { width: 0.5, height: 5, x: 2.2, class: 'mv-cotes-sheen' }, pattern);

  const layer = el('g', { class: 'mv-bridges' }, svg);
  for (const b of BRIDGES) {
    const d = b.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xy(p)}`).join(' ');
    el('path', { d, class: 'mv-bridge-edge', 'stroke-width': b.width + 1.4 }, layer);
    el('path', { d, class: 'mv-bridge', stroke: `url(#${id})`, 'stroke-width': b.width }, layer);
  }
  const pins = el('g', { class: 'mv-pins' }, svg);
  for (const p of [C, T, F, E, P, BAL]) {
    circle(p, 3.1, 'mv-chaton', pins);
    circle(p, 1.7, 'mv-jewel', pins);
  }
  for (const s of BRIDGES.flatMap((b) => b.screws)) {
    circle(s, 2.5, 'mv-screw', pins);
    el('line', { ...line(polar(s, 1.8, 40), polar(s, 1.8, 220)), class: 'mv-screw-slot' }, pins);
  }
}

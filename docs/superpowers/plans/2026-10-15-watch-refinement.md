# Watch Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Full bleed / Classic faces and the movement with an elegant Analog face (Breguet dial,
blued leaf hands) and a Bodoni Moda Digital face. Cap the desktop watch at 360 px.

**Architecture:** A new pure module `hands.ts` replaces `movement-model.ts`. Two new faces, `analog.ts`
and `digital.ts`, implement a slimmer `Face` interface. The driver `watch.ts` loses the movement and
the toggle. Every movement module, test, string and style is deleted. Colours are CSS custom properties
applied through classes (CSP `style-src 'self'`).

**Tech Stack:** Vite + vanilla TypeScript, SVG, Vitest + jsdom (100 % coverage gate), Playwright,
nginx/Docker, `@fontsource`.

**Spec:** `docs/superpowers/specs/2026-10-15-watch-refinement-design.md`

## Global Constraints

- **CSP:** `style-src 'self'`, so no `style` attributes are ever created by script.
  - Colours, including gradient `stop-color`, come from classes and `var(--…)`.
  - `setAttribute('fill', 'url(#id)')` and `data-*` attributes are fine.
- **Digits:** the watch shows Latin digits in every language. The accessible label follows the UI
  language: "Watch, 10:09" / "ساعت، ۱۰:۰۹" via `formatTemplate(STRINGS[lang].watchLabel, …)`.
- **Faces:** `FaceId = 'analog' | 'digital'`, default `'analog'`. `fullbleed`, `classic` and unknown
  values parse to `'analog'`.
- **Analog geometry:** viewBox `0 0 200 200`, centre (100, 100).
  - Railway rings at r 96 and r 91.5, stroke 0.45.
  - 60 minute ticks r 91.5–96, stroke 0.45; five-minute ticks r 90.5–96, stroke 1.1.
  - Numerals 1–12 at r 79, size 13, upright.
  - Hand tips: hour r 68, minute r 94, seconds r 95. The seconds needle is ~0.85 wide at its base.
- **Colours:**
  - **Light:**
    - dial `#fdfbf6 → #ece6da`, numerals `#1d1f24`, track `#2a2c31`;
    - blued `#4a7fe0 → #244fae → #13306f`;
    - digital seconds `#2f5cc0`, digital text `#1d1f24`.
  - **Dark:**
    - dial `#23272f → #0e1014`, numerals `#efe9dc`, track `#c9c3b6`;
    - blued `#9dbcff → #5f8ef0 → #3561c4`;
    - digital seconds `#7aa2f7`, digital text `#efe9dc`.
- **Fonts:**
  - Analog numerals: Cormorant Garamond 600, lining figures, already bundled.
  - Digital: Bodoni Moda 400, Latin subset only, self-hosted, added woff2 ≤ 30 kB.
  - Font tokens are NOT overridden by `html[lang='fa']`.
- **Motion:**
  - The seconds hand ticks in 125 ms steps (`BEAT_MS`), with 1 s steps under reduced motion.
  - The hour and minute hands are continuous.
  - The driver draws only on a beat change. Reduced motion uses a 1 s interval. A hidden page stops.
- **Desktop (≥ 1024 px):** the watch box is ≤ 360 px wide. Narrow screens are unchanged.
- **Commands** (run from `Site/`):
  - `npx vitest run --coverage` must show 100 % on statements, branches, functions and lines;
  - `npx tsc --noEmit` must be clean;
  - `npm run build`, then `npx playwright test`, must be green.

  Port 4173 must be free before the e2e run.
- **Git:** commit per task (user-authorised); never stage `.superpowers/`; never push.

## Review Focus

1. **A user upgrading with `watch.face: 'fullbleed'` or `'classic'` saved:** the page loads Analog with
   no error, and Settings shows "Analog". Pinned in Task 4: settings-model and a DOM test.
2. **Digital at a 320 px wide phone and in Persian:** the digits fit the box (no overflow or wrap) and
   stay Latin. Pinned in Task 5 e2e.
3. **Switching the face while the page is hidden, then returning:** the new face renders the current
   time at once, with no stale or blank face. Pinned in Task 4 DOM test.
4. **A dark-mode switch while the page is open:** the analog dial, numerals and hands restyle live without
   re-render (class-based colours). Pinned in Task 5 e2e.
5. **A wide but short window (1280 × 720):** the watch column still fits, with the watch ≤ 360 px and
   the today lines visible. Pinned in Task 5 e2e.

---

## File map

| File | Change |
|---|---|
| `Site/src/watch/hands.ts` | **Create** (T1): pure hand state |
| `Site/tests/watch-hands.test.ts` | **Create** (T1) |
| `Site/src/watch/analog.ts` | **Create** (T2) |
| `Site/tests/dom/analog.test.ts` | **Create** (T2) |
| `Site/src/watch/digital.ts` | **Create** (T3) |
| `Site/tests/dom/digital.test.ts` | **Create** (T3) |
| `Site/src/styles/tokens.css` | T2: add `--wa-*`, `--font-dial`. T3: add `--wd-*`, `--font-digital`. T4: delete `--w-*` |
| `Site/src/styles/components.css` | T2: `.wa-*`. T3: `.wd-*`. T4: delete `.wc-*`, `.wf-*`, `.mv-*`, movement layout. T5: desktop size |
| `Site/src/main.ts` | T3: font import. T4: wiring unchanged except types |
| `Site/package.json` | T3: `@fontsource/bodoni-moda` |
| `Site/src/watch/face.ts` | T2: the `Face` interface takes `HandState` + `Date`. T4: `FaceId` analog/digital |
| `Site/src/watch/watch.ts` | T4: rewrite without the movement |
| `Site/src/settings/settings-model.ts` | T4: default `'analog'` |
| `Site/src/i18n/strings.ts` | T4: strings |
| `Site/index.html` | T4: markup, select options |
| Deleted in T4 | `full-bleed.ts`, `classic.ts`, `movement-view.ts`, `movement-parts.ts`, `geometry.ts`, `movement-model.ts` and tests `full-bleed.test.ts`, `classic.test.ts`, `movement-view.test.ts`, `watch-geometry.test.ts`, `watch-model.test.ts` |
| `Site/e2e/watch.spec.ts`, `Site/e2e/site.spec.ts` | T4: remove movement. T5: sizes, hands reach, screenshots |
| `README.md`, `docs/SECURITY.md` | T6 |

---

### Task 1: Pure hand state (`hands.ts`)

**Files:**
- Create: `Site/src/watch/hands.ts`
- Test: `Site/tests/watch-hands.test.ts`

**Interfaces:**
- **Produces:**
  - `BEAT_MS = 125`
  - `interface HandState { readonly hour: number; readonly minute: number; readonly second: number; readonly beat: number }`
  - `msSinceLocalMidnight(date: Date): number`
  - `handState(ms: number, reduced: boolean): HandState`
  - `hhmm(date: Date): string`
  - `pad2(n: number): string`

`movement-model.ts` stays untouched in this task; Task 4 deletes it.

- [ ] **Step 1: Write the failing test** `Site/tests/watch-hands.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BEAT_MS, handState, hhmm, msSinceLocalMidnight, pad2 } from '../src/watch/hands';

const at = (h: number, m: number, s: number, ms = 0) => msSinceLocalMidnight(new Date(2026, 9, 15, h, m, s, ms));

describe('hand state', () => {
  it('points the hands at 10:09:36', () => {
    const s = handState(at(10, 9, 36), false);
    expect(s.hour).toBeCloseTo(304.8, 6);
    expect(s.minute).toBeCloseTo(57.6, 6);
    expect(s.second).toBeCloseTo(216, 6);
  });

  it('ticks the seconds hand in 125 ms steps; hour and minute move continuously', () => {
    expect(BEAT_MS).toBe(125);
    const a = handState(at(10, 9, 36, 124), false);
    const b = handState(at(10, 9, 36, 125), false);
    expect(a.second).toBeCloseTo(216, 6);
    expect(b.second).toBeCloseTo(216.75, 6);
    expect(b.beat).toBe(a.beat + 1);
    expect(a.minute).toBeGreaterThan(57.6);
  });

  it('steps once a second under reduced motion', () => {
    const a = handState(at(10, 9, 36, 0), true);
    const b = handState(at(10, 9, 36, 999), true);
    expect(b.second).toBe(a.second);
    expect(b.beat).toBe(a.beat);
    expect(handState(at(10, 9, 37), true).beat).toBe(a.beat + 8);
  });

  it('wraps at noon and midnight', () => {
    expect(handState(at(0, 0, 0), false)).toEqual({ hour: 0, minute: 0, second: 0, beat: 0 });
    expect(handState(at(12, 0, 0), false).hour).toBe(0);
    expect(handState(at(23, 59, 59, 875), false).second).toBeCloseTo(359.25, 6);
  });

  it('formats HH:MM with Latin digits and pads', () => {
    expect(hhmm(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(pad2(3)).toBe('03');
    expect(pad2(42)).toBe('42');
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `cd Site && npx vitest run tests/watch-hands.test.ts`
Expected: FAIL, "Failed to resolve import ../src/watch/hands".

- [ ] **Step 3: Implement** `Site/src/watch/hands.ts`

```ts
export const BEAT_MS = 125;                       // 4 Hz: the seconds hand ticks 8 times a second

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_HALF_DAY = 43_200_000;
const BEATS_PER_SECOND = MS_PER_SECOND / BEAT_MS;

export interface HandState { readonly hour: number; readonly minute: number; readonly second: number; readonly beat: number }

export function msSinceLocalMidnight(date: Date): number {
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

/**
 * The hands at `ms` past local midnight. Hour and minute move continuously; the seconds hand
 * ticks once a beat (once a second under reduced motion). `beat` changes exactly when the
 * seconds hand moves, so the driver can skip frames in between.
 */
export function handState(ms: number, reduced: boolean): HandState {
  const beat = reduced ? Math.floor(ms / MS_PER_SECOND) * BEATS_PER_SECOND : Math.floor(ms / BEAT_MS);
  const ticked = beat * BEAT_MS;
  return {
    hour: ((ms % MS_PER_HALF_DAY) / MS_PER_HALF_DAY) * 360,
    minute: ((ms % MS_PER_HOUR) / MS_PER_HOUR) * 360,
    second: ((ticked % MS_PER_MINUTE) / MS_PER_MINUTE) * 360,
    beat,
  };
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const hhmm = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
```

- [ ] **Step 4: Run it and check it passes**

Run: `cd Site && npx vitest run tests/watch-hands.test.ts`. Expected: 5 passed.
Then `npx vitest run --coverage` and `npx tsc --noEmit`. Expected: green, with 100 % coverage
(`hands.ts` is fully covered).

- [ ] **Step 5: Commit**

```bash
git add Site/src/watch/hands.ts Site/tests/watch-hands.test.ts
git commit -m "feat(site): pure hand state for the refined watch"
```

---

### Task 2: Analog face (`analog.ts`)

**Files:**
- Create: `Site/src/watch/analog.ts`
- Test: `Site/tests/dom/analog.test.ts`
- Modify: `Site/src/watch/face.ts`
- Modify: `Site/src/styles/tokens.css`
- Modify: `Site/src/styles/components.css` (append the `.wa-*` block after the existing watch rules)

**Interfaces:**
- **Consumes:** `HandState` from `./hands` (Task 1).
- **Produces:** `createAnalog(mount: HTMLElement): Face`.
  - The root is `<svg class="clock watch-face--analog">`.
  - The hand groups have ids `hand-hour`, `hand-minute` and `hand-second`, and their `transform` is
    `rotate(<deg> 100 100)`.
  - Numerals are `text.wa-num`.
- **Changes `Face` in `face.ts`:** add a second, *new* interface, leaving the old one in place for the
  old faces until Task 4:

```ts
export interface DialFace {
  readonly root: Element;
  render(state: HandState, date: Date): void;
  destroy(): void;
}
```

  `createAnalog` returns `DialFace`. Task 4 renames `DialFace` to `Face` and deletes the old one.

- [ ] **Step 1: Write the failing test** `Site/tests/dom/analog.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAnalog } from '../../src/watch/analog';
import type { DialFace } from '../../src/watch/face';
import { handState, msSinceLocalMidnight } from '../../src/watch/hands';

let mount: HTMLElement; let face: DialFace;
beforeEach(() => { mount = document.createElement('div'); document.body.appendChild(mount); face = createAnalog(mount); });
afterEach(() => { face.destroy(); mount.remove(); });

/** The radius a hand reaches: the highest point (smallest y) of its paths, pointing at 12. */
const tipRadius = (id: string): number => {
  const ys = [...document.querySelectorAll(`#${id} path`)]
    .flatMap((p) => (p.getAttribute('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1));
  return 100 - Math.min(...ys);
};

describe('analog face', () => {
  it('builds a railway track, twelve upright Latin numerals and three hands', () => {
    const svg = mount.querySelector('svg.clock.watch-face--analog')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(svg.querySelectorAll('.wa-ring')).toHaveLength(2);
    expect(svg.querySelectorAll('.wa-tick')).toHaveLength(48);
    expect(svg.querySelectorAll('.wa-tick--five')).toHaveLength(12);
    expect([...svg.querySelectorAll('.wa-num')].map((n) => n.textContent))
      .toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    for (const n of svg.querySelectorAll('.wa-num')) expect(n.hasAttribute('transform')).toBe(false);
    for (const id of ['hand-hour', 'hand-minute', 'hand-second']) expect(svg.querySelector(`#${id}`)).not.toBeNull();
  });

  it('lets every hand reach its scale', () => {
    expect(tipRadius('hand-hour')).toBeCloseTo(68, 1);    // just inside the numerals (~r 72.5)
    expect(tipRadius('hand-minute')).toBeCloseTo(94, 1);  // into the railway track (91.5–96)
    expect(tipRadius('hand-second')).toBeCloseTo(95, 1);  // onto the outer track
  });

  it('rotates the hands for 10:09:36', () => {
    const date = new Date(2026, 9, 15, 10, 9, 36);
    face.render(handState(msSinceLocalMidnight(date), false), date);
    const deg = (id: string) => Number(/rotate\(([-\d.]+) 100 100\)/.exec(mount.querySelector(`#${id}`)!.getAttribute('transform')!)![1]);
    expect(deg('hand-hour')).toBeCloseTo(304.8, 3);
    expect(deg('hand-minute')).toBeCloseTo(57.6, 3);
    expect(deg('hand-second')).toBeCloseTo(216, 3);
  });

  it('colours through classes only, with gradients unique per instance', () => {
    expect(mount.querySelectorAll('[style]')).toHaveLength(0);
    for (const s of mount.querySelectorAll('stop')) expect(s.getAttribute('class')).toMatch(/^wa-(dial|blue)-\d$/);
    const other = document.createElement('div'); const second = createAnalog(other);
    const ids = [...mount.querySelectorAll('linearGradient, radialGradient')].map((g) => g.id);
    const otherIds = [...other.querySelectorAll('linearGradient, radialGradient')].map((g) => g.id);
    expect(ids.some((id) => otherIds.includes(id))).toBe(false);
    second.destroy();
  });

  it('removes itself on destroy', () => {
    face.destroy();
    expect(mount.querySelector('svg')).toBeNull();
    face = createAnalog(mount);
  });
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `cd Site && npx vitest run tests/dom/analog.test.ts`. Expected: FAIL, the import does not resolve.

- [ ] **Step 3: Add `DialFace` to `face.ts`** (append the interface above, plus
  `import type { HandState } from './hands';`).

- [ ] **Step 4: Implement** `Site/src/watch/analog.ts`

```ts
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
```

- [ ] **Step 5: Tokens.** In `Site/src/styles/tokens.css`, add to `:root`, after the `--w-*` block:

```css
  /* Watch — Analog and Digital */
  --font-dial: 'Cormorant Garamond', serif;
  --wa-dial-0: #fdfbf6; --wa-dial-1: #ece6da;
  --wa-ink: #1d1f24;    --wa-track: #2a2c31;
  --wa-blue-0: #4a7fe0; --wa-blue-1: #244fae; --wa-blue-2: #13306f;
```

  and inside the `@media (prefers-color-scheme: dark) { :root { … } }` block:

```css
    --wa-dial-0: #23272f; --wa-dial-1: #0e1014;
    --wa-ink: #efe9dc;    --wa-track: #c9c3b6;
    --wa-blue-0: #9dbcff; --wa-blue-1: #5f8ef0; --wa-blue-2: #3561c4;
```

  `--font-dial` must not appear in the `html[lang='fa']` block.

- [ ] **Step 6: Styles.** Append to the watch section of `components.css`:

```css
/* Watch — the Analog face. Classes only (CSP: style-src 'self'). */
.wa-dial-0 { stop-color: var(--wa-dial-0); }
.wa-dial-1 { stop-color: var(--wa-dial-1); }
.wa-blue-0 { stop-color: var(--wa-blue-0); }
.wa-blue-1 { stop-color: var(--wa-blue-1); }
.wa-blue-2 { stop-color: var(--wa-blue-2); }
.wa-ring { fill: none; stroke: var(--wa-track); }
.wa-tick, .wa-tick--five { stroke: var(--wa-track); }
.wa-num {
  fill: var(--wa-ink);
  font-family: var(--font-dial);
  font-weight: 600;
  font-feature-settings: "lnum";
  font-variant-numeric: lining-nums;
}
```

- [ ] **Step 7: Run it and check it passes.** `cd Site && npx vitest run tests/dom/analog.test.ts`. Expected:
  5 passed. Then the full `npx vitest run --coverage` at 100 %, and `npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add Site/src/watch/analog.ts Site/src/watch/face.ts Site/tests/dom/analog.test.ts Site/src/styles/tokens.css Site/src/styles/components.css
git commit -m "feat(site): Analog face — Breguet dial, blued leaf hands"
```

---

### Task 3: Digital face (`digital.ts`) and Bodoni Moda

**Files:**
- Create: `Site/src/watch/digital.ts`
- Test: `Site/tests/dom/digital.test.ts`
- Modify: `Site/package.json` and lockfile (`npm i @fontsource/bodoni-moda@5.3.0`)
- Modify: `Site/src/main.ts` (font import)
- Modify: `Site/src/styles/tokens.css`
- Modify: `Site/src/styles/components.css`

**Interfaces:**
- **Consumes:** `DialFace` (Task 2) and `hhmm`, `pad2`, `HandState` (Task 1).
- **Produces:** `createDigital(mount: HTMLElement): DialFace`. The root is a
  `<div class="clock watch-face--digital">` holding two children:
  - `<span class="wd-hm" aria-hidden="true">`
  - `<span class="wd-ss" aria-hidden="true">`

- [ ] **Step 1: Write the failing test** `Site/tests/dom/digital.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDigital } from '../../src/watch/digital';
import type { DialFace } from '../../src/watch/face';
import { handState, msSinceLocalMidnight } from '../../src/watch/hands';

let mount: HTMLElement; let face: DialFace;
const draw = (date: Date) => face.render(handState(msSinceLocalMidnight(date), false), date);
beforeEach(() => { mount = document.createElement('div'); document.body.appendChild(mount); face = createDigital(mount); });
afterEach(() => { face.destroy(); mount.remove(); });

describe('digital face', () => {
  it('shows 24-hour HH:MM and small seconds, in Latin digits, hidden from the a11y tree', () => {
    draw(new Date(2026, 9, 15, 22, 9, 36));
    const root = mount.querySelector('.clock.watch-face--digital')!;
    expect(root.querySelector('.wd-hm')!.textContent).toBe('22:09');
    expect(root.querySelector('.wd-ss')!.textContent).toBe('36');
    for (const s of root.querySelectorAll('span')) expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(mount.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('writes text only when it changes', () => {
    const hm = mount.querySelector('.wd-hm')!; const ss = mount.querySelector('.wd-ss')!;
    draw(new Date(2026, 9, 15, 10, 9, 36, 0));
    const hmNode = hm.firstChild; const ssNode = ss.firstChild;
    draw(new Date(2026, 9, 15, 10, 9, 36, 500));     // same second: nothing rewritten
    expect(hm.firstChild).toBe(hmNode);
    expect(ss.firstChild).toBe(ssNode);
    draw(new Date(2026, 9, 15, 10, 9, 37, 0));       // new second, same minute
    expect(hm.firstChild).toBe(hmNode);
    expect(ss.textContent).toBe('37');
  });

  it('removes itself on destroy', () => {
    face.destroy();
    expect(mount.querySelector('.watch-face--digital')).toBeNull();
    face = createDigital(mount);
  });
});
```

- [ ] **Step 2: Run it and check it fails.** `cd Site && npx vitest run tests/dom/digital.test.ts`. Expected: FAIL
  (the import does not resolve).

- [ ] **Step 3: Implement** `Site/src/watch/digital.ts`

```ts
import type { DialFace } from './face';
import { hhmm, pad2 } from './hands';

/**
 * The digital face: 24-hour HH:MM in Bodoni Moda with small blued seconds. The visible digits
 * are aria-hidden; the driver names the face. Text is written only when it changes.
 */
export function createDigital(mount: HTMLElement): DialFace {
  const root = document.createElement('div');
  root.className = 'clock watch-face--digital';
  const hm = document.createElement('span');
  hm.className = 'wd-hm';
  const ss = document.createElement('span');
  ss.className = 'wd-ss';
  for (const s of [hm, ss]) { s.setAttribute('aria-hidden', 'true'); root.appendChild(s); }
  mount.appendChild(root);

  let shownHm = '';
  let shownSs = '';
  return {
    root,
    render(_state, date: Date): void {
      const nextHm = hhmm(date);
      if (nextHm !== shownHm) { shownHm = nextHm; hm.textContent = nextHm; }
      const nextSs = pad2(date.getSeconds());
      if (nextSs !== shownSs) { shownSs = nextSs; ss.textContent = nextSs; }
    },
    destroy(): void { root.remove(); },
  };
}
```

- [ ] **Step 4: The font.**
  - Run `cd Site && npm i @fontsource/bodoni-moda@5.3.0`.
  - Check that `node_modules/@fontsource/bodoni-moda/latin-400.css` exists. If the package names it
    differently, use its Latin 400 normal entry, and record the actual name in your report.
  - In `Site/src/main.ts`, after the Cormorant imports, add
    `import '@fontsource/bodoni-moda/latin-400.css';`
  - Check the size: `ls -l node_modules/@fontsource/bodoni-moda/files/*latin-400-normal.woff2` must be
    ≤ 30 720 bytes. If it is larger, STOP and report (do not substitute another font).

- [ ] **Step 5: Tokens.** In `tokens.css`, under `:root` next to the Task 2 block:

```css
  --font-digital: 'Bodoni Moda', 'Cormorant Garamond', serif;
  --wd-ink: #1d1f24;    --wd-sec: #2f5cc0;
```

  and in the dark block:

```css
    --wd-ink: #efe9dc;    --wd-sec: #7aa2f7;
```

- [ ] **Step 6: Styles.** Append to `components.css`:

```css
/* Watch — the Digital face: sized from its box (container units), never wraps. */
.watch-face--digital {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.08em;
  color: var(--wd-ink);
  font-family: var(--font-digital);
  font-weight: 400;
  font-feature-settings: "lnum", "tnum";
  font-variant-numeric: lining-nums tabular-nums;
  white-space: nowrap;
  line-height: 1;
}
.wd-hm { font-size: 24cqi; }
.wd-ss { font-size: 8cqi; color: var(--wd-sec); }
```

  (Task 4 makes `#watch-box` the inline-size container for the digital face.)

- [ ] **Step 7: Run it and check it passes.** `npx vitest run tests/dom/digital.test.ts` gives 3 passed. Then the full
  suite at 100 %, `npx tsc --noEmit`, and `npm run build`, which must succeed. Record the JS, CSS and
  font sizes from the build output in the report.

- [ ] **Step 8: Commit**

```bash
git add Site/src/watch/digital.ts Site/tests/dom/digital.test.ts Site/package.json Site/package-lock.json Site/src/main.ts Site/src/styles/tokens.css Site/src/styles/components.css
git commit -m "feat(site): Digital face in Bodoni Moda"
```

---

### Task 4: Switch over: the driver, settings and markup; delete the movement and old faces

**Files:**
- Modify: `Site/src/watch/face.ts`
- Modify: `Site/src/watch/watch.ts`
- Modify: `Site/src/watch/analog.ts` and `digital.ts` (`DialFace` → `Face`)
- Modify: `Site/src/settings/settings-model.ts`
- Modify: `Site/src/i18n/strings.ts`
- Modify: `Site/index.html`
- Modify: `Site/src/styles/tokens.css`
- Modify: `Site/src/styles/components.css`
- Delete: `Site/src/watch/{full-bleed,classic,movement-view,movement-parts,geometry,movement-model}.ts`
- Delete: `Site/tests/dom/{full-bleed,classic,movement-view}.test.ts`
- Delete: `Site/tests/{watch-geometry,watch-model}.test.ts`
- Modify tests:
  - `Site/tests/dom/watch.test.ts`
  - `Site/tests/settings-model.test.ts`
  - `Site/tests/dom/settings-store.test.ts`
  - `Site/tests/dom/watch-settings.test.ts`
  - plus any test importing deleted modules (`grep -rln "movement\|full-bleed\|classic\|geometry" Site/tests`)
- Modify e2e: `Site/e2e/watch.spec.ts`

**Interfaces:**
- **Consumes:** `createAnalog`, `createDigital`, `handState`, `BEAT_MS`, `hhmm`, `msSinceLocalMidnight`.
- **Produces:**
  - `type FaceId = 'analog' | 'digital'`
  - `FACE_IDS = ['analog', 'digital']`
  - `interface Face { readonly root: Element; render(state: HandState, date: Date): void; destroy(): void }`
  - `createWatch(section, { now, onTick?, getFace, getLang }): Watch`
  - `Watch { setFace(face: FaceId): void; rerender(): void; destroy(): void }`
  - the driver sets `#watch-box`'s `data-face` to the current face id.

- [ ] **Step 1: Update the tests first (they must fail).**
  - **`tests/settings-model.test.ts`:**
    - the default is `{ face: 'analog' }`;
    - `'digital'` is kept;
    - `'fullbleed'`, `'classic'`, `'sundial'`, `3`, `null` and a non-object `watch` all parse to
      `'analog'`;
    - the fixture at line 20 uses `'digital'`.
  - **`tests/dom/settings-store.test.ts`:** expected default `{ face: 'analog' }`.
  - **`tests/dom/watch-settings.test.ts`:** use `'digital'` where it uses `'classic'`, and assert that
    the select's options are exactly `['analog', 'digital']`.
  - **`tests/dom/watch.test.ts`:** rewrite around the new driver. Keep the existing harness (fake rAF,
    `BODY` from `index.html`, `make()`), set `face = 'analog'`, and remove every movement or toggle test.
    It must contain these cases:

```ts
  it('draws the chosen face with an accessible time', () => {
    make();
    expect(document.querySelector('.clock.watch-face--analog')).not.toBeNull();
    expect(document.querySelector('.clock')!.getAttribute('role')).toBe('img');
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:30');
    expect(document.getElementById('watch-box')!.dataset.face).toBe('analog');
  });

  it('renders only when the beat changes', () => {
    const onTick = make();
    onTick.mockClear();
    runFrame(); runFrame();
    expect(onTick).not.toHaveBeenCalled();
    now = new Date(now.getTime() + 125);
    runFrame();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('swaps faces, names the new one and draws it at once', () => {
    make();
    face = 'digital';
    watch!.setFace('digital');
    expect(document.querySelector('.watch-face--analog')).toBeNull();
    const digital = document.querySelector('.clock.watch-face--digital')!;
    expect(digital.getAttribute('aria-label')).toBe('Watch, 10:30');
    expect(digital.querySelector('.wd-hm')!.textContent).toBe('10:30');
    expect(document.getElementById('watch-box')!.dataset.face).toBe('digital');
    watch!.setFace('digital');                       // same face: no rebuild
    expect(document.querySelector('.watch-face--digital')).toBe(digital);
  });

  it('switching face while hidden shows the current time on return', () => {
    make();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    watch!.setFace('digital');
    now = new Date(2026, 9, 15, 10, 31, 5);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('.wd-hm')!.textContent).toBe('10:31');
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:31');
  });

  it('relabels once a minute and on a language change', () => {
    make();
    const label = () => document.querySelector('.clock')!.getAttribute('aria-label');
    now = new Date(2026, 9, 15, 10, 30, 30); runFrame();
    expect(label()).toBe('Watch, 10:30');
    now = new Date(2026, 9, 15, 10, 31, 0); runFrame();
    expect(label()).toBe('Watch, 10:31');
    lang = 'fa'; watch!.rerender();
    expect(label()).toBe('ساعت، ۱۰:۳۱');
  });
```

  Keep (adapted) the existing tests for:
  - pause on hidden and immediate render on visible;
  - the reduced-motion interval (`setMediaMatches(true)`), and the switch between loops on a
    motion-preference change;
  - `destroy` removes listeners and the face.

  Those tests must not reference `movement`, `toggle`, `fadeEnd` or `#watch-digital`.
  - **`e2e/watch.spec.ts`:**
    - delete the "Show movement", "reduced motion: the movement", "movement open", "Show movement keeps
      the dial", "movement labels" and movement-screenshot tests;
    - rewrite the face-picker test (default `.watch-face--analog`; choose `digital`; it survives a
      reload);
    - rewrite the light/dark test on `.wa-num`;
    - rewrite the Persian test: `.wa-num` has `['12','1',…,'11']`, the label matches
      `^ساعت، [۰-۹]{2}:[۰-۹]{2}$`, and with Digital chosen `.wd-hm` matches `^\d\d:\d\d$`;
    - keep the sticky-column test, without any toggle steps.

- [ ] **Step 2: Run the unit tests and check they fail.** `cd Site && npx vitest run`. Expected: failures in the
  settings, watch-settings and watch suites.

- [ ] **Step 3: `face.ts`.** Replace the whole file with:

```ts
import type { HandState } from './hands';

export type FaceId = 'analog' | 'digital';
export const FACE_IDS: readonly FaceId[] = ['analog', 'digital'];

/** A watch face: draws the hands' state (Analog) or the date's digits (Digital). */
export interface Face {
  readonly root: Element;
  render(state: HandState, date: Date): void;
  destroy(): void;
}
```

  In `analog.ts`, `digital.ts` and their tests, replace `DialFace` with `Face`.

- [ ] **Step 4: `watch.ts`.** Replace the whole file with:

```ts
import { formatTemplate, STRINGS, type Lang } from '../i18n/strings';
import { createAnalog } from './analog';
import { createDigital } from './digital';
import type { Face, FaceId } from './face';
import { BEAT_MS, handState, hhmm, msSinceLocalMidnight } from './hands';

export interface WatchOptions {
  readonly now: () => Date;
  /** Called with the drawn time on every rendered frame (main.ts's minute gate). */
  readonly onTick?: (date: Date) => void;
  readonly getFace: () => FaceId;
  readonly getLang: () => Lang;
}

export interface Watch {
  setFace(face: FaceId): void;
  /** Language change: the watch label. */
  rerender(): void;
  destroy(): void;
}

const FACES: Readonly<Record<FaceId, (mount: HTMLElement) => Face>> = {
  analog: createAnalog,
  digital: createDigital,
};
const MS_PER_MINUTE = 60_000;
const minuteOf = (ms: number): number => Math.floor(ms / MS_PER_MINUTE);

/**
 * Drives the watch face. Frames are rAF-paced but drawn only when the beat changes (8 a
 * second): the seconds hand ticks and the digits change no faster. Reduced motion draws once a
 * second. A hidden page draws nothing and catches up at once on return.
 */
export function createWatch(section: HTMLElement, { now, onTick, getFace, getLang }: WatchOptions): Watch {
  const box = section.querySelector<HTMLElement>('#watch-box')!;
  const mount = section.querySelector<HTMLElement>('#clock-mount')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let faceId = getFace();
  let face = FACES[faceId](mount);
  let labelMinute = Number.NaN;
  let lastBeat = Number.NaN;
  let rafId = 0;
  let intervalId = 0;

  /** The label only changes with the minute or the language; rerender resets `labelMinute`. */
  const relabel = (date: Date, minute: number): void => {
    if (minute === labelMinute) return;
    labelMinute = minute;
    const lang = getLang();
    face.root.setAttribute('aria-label', formatTemplate(STRINGS[lang].watchLabel, { time: hhmm(date) }, lang));
  };

  const resetLabel = (): void => {
    labelMinute = Number.NaN;
    const date = now();
    relabel(date, minuteOf(msSinceLocalMidnight(date)));
  };

  const nameFace = (): void => {
    box.dataset.face = faceId;
    face.root.setAttribute('role', 'img');
    resetLabel();
  };

  const render = (): void => {
    const date = now();
    const ms = msSinceLocalMidnight(date);
    face.render(handState(ms, reduced.matches), date);
    relabel(date, minuteOf(ms));
    lastBeat = Math.floor(ms / BEAT_MS);
    onTick?.(date);
  };

  // rAF only runs without reduced motion; frames inside a beat have nothing new to draw.
  const frame = (): void => {
    rafId = requestAnimationFrame(frame);
    if (Math.floor(msSinceLocalMidnight(now()) / BEAT_MS) === lastBeat) return;
    render();
  };

  const stop = (): void => {
    cancelAnimationFrame(rafId);
    window.clearInterval(intervalId);
    rafId = 0;
    intervalId = 0;
  };

  const start = (): void => {
    stop();
    render();
    if (reduced.matches) intervalId = window.setInterval(render, 1000);
    else rafId = requestAnimationFrame(frame);
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  /** A hidden page stays stopped; the visible handler picks the right loop on return. */
  const onMotionChange = (): void => {
    if (!document.hidden) start();
  };

  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotionChange);
  nameFace();
  start();

  return {
    setFace(next: FaceId): void {
      if (next === faceId) return;
      face.destroy();
      faceId = next;
      face = FACES[faceId](mount);
      nameFace();
      render();
    },
    rerender: resetLabel,
    destroy(): void {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
      face.destroy();
    },
  };
}
```

- [ ] **Step 5: Settings model.** In `settings-model.ts`, change the default `watch: { face: 'fullbleed' }`
  to `watch: { face: 'analog' }`. `oneOf(…, FACE_IDS, fallback.watch.face)` already maps legacy and
  unknown values to the fallback.

- [ ] **Step 6: Strings.** In `strings.ts`:
  - Remove these keys from the key union and from both `en` and `fa`: `faceFullBleed`, `faceClassic`,
    `showMovement`, `showTime`, `partBarrel`, `partCentre`, `partThird`, `partFourth`, `partEscape`,
    `partPallet`, `partBalance`, `movementLabel`.
  - Add `faceAnalog` (en `'Analog'`, fa `'عقربه‌ای'`; the fa string contains U+200C ZWNJ between ه and
    ا) and `faceDigital` (en `'Digital'`, fa `'دیجیتال'`).

- [ ] **Step 7: Markup.** In `index.html`:
  - Replace the clock section with:

```html
      <section id="clock-section" aria-label="Clock">
        <div id="watch-box">
          <div id="clock-mount"></div>
        </div>
      </section>
```

  - Replace the two `<option>`s of `#set-watch-face` with:

```html
          <option value="analog" data-str="faceAnalog"></option>
          <option value="digital" data-str="faceDigital"></option>
```

- [ ] **Step 8: Delete** the six old modules and five old test files listed above. Then
  `grep -rn "movement\|full-bleed\|fullbleed\|classic\|geometry\|movement-model\|watch-digital\|movement-toggle" Site/src Site/tests Site/e2e Site/index.html`
  must print nothing watch-related.
  - Hits in `ui/number-picker.ts`, `tests/grid-navigation.test.ts` or `dom-helpers.ts` that are not
    about the watch stay as they are; list them in the report.
  - If `dom-helpers.ts` has helpers used only by deleted tests, leave them unless coverage or lint
    fails.

- [ ] **Step 9: Styles and tokens.**
  - In `tokens.css`, delete every `--w-*` line from both blocks, together with the
    `/* Watch — Full bleed and the movement */` comment. The `--wa-*`, `--wd-*` and `--font-*` lines
    stay.
  - In `components.css`, delete:
    - `.clock .second-hand`, `.wc-line`, `.wc-ring` and `.wc-dot`;
    - every `.wf-*` rule;
    - every `.mv-*` rule, including the media queries that only hold `.mv-*`;
    - the movement transitions (`#watch-box.is-movement …`, the `#movement-mount` rules);
    - `#watch-digital` (both rules), the `#clock-section:has(#movement-toggle…)` rule, and every
      `#movement-toggle` rule.

    Keep `.clock { color: var(--text); display: block; }`.
  - Replace the watch-box block with the following, and keep the landscape and wide `#watch-box`
    media rules unchanged (Task 5 changes the wide one):

```css
/* The watch: one square holding the face. The Digital face is a single line, so its box keeps
   the width but drops the square, and is the container its type sizes from. */
#clock-section { display: grid; justify-items: center; gap: 1rem; }
#watch-box { position: relative; width: min(92vw, 62vh); aspect-ratio: 1; }
#clock-mount { position: absolute; inset: 0; }
#watch-box svg { width: 100%; height: 100%; }
#watch-box[data-face="digital"] { aspect-ratio: auto; container-type: inline-size; }
#watch-box[data-face="digital"] #clock-mount { position: static; }
```

- [ ] **Step 10: Run everything.**
  - `npx vitest run --coverage`: 100 % on all four.
  - `npx tsc --noEmit`: clean.
  - Port 4173 free, `npm run build`, then `npx playwright test`: all green.
  - Note the before and after JS and CSS sizes from the build output (Task 6 needs them).

- [ ] **Step 11: Commit**

```bash
git add -A Site/src Site/tests Site/e2e Site/index.html
git status --short   # nothing under .superpowers/ staged
git commit -m "feat(site): Analog and Digital faces replace Full bleed, Classic and the movement"
```

---

### Task 5: Desktop size and layout e2e

**Files:**
- Modify: `Site/src/styles/components.css` (the `@media (min-width: 1024px) { #watch-box … }` rule)
- Modify e2e: `Site/e2e/site.spec.ts`, `Site/e2e/watch.spec.ts`

**Interfaces:** consumes the DOM from Task 4: `#watch-box`, `.watch-face--analog`,
`.watch-face--digital`, `#hand-*`, `.wa-ring` and `.wd-hm`.

- [ ] **Step 1: Write the failing e2e tests** in `e2e/watch.spec.ts`:

```ts
for (const [w, h] of [[1440, 900], [1280, 800], [1280, 720]] as const) {
  test(`wide screens: the watch is at most 360 px and the column fits at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const box = (await page.locator('#watch-box').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(360.5);
    expect(box.width).toBeGreaterThanOrEqual(200);
    expect(box.x + box.width / 2).toBeLessThan(w / 2);            // in the left column
    await expect(page.locator('#today-persian')).toBeInViewport();
    await expect(page.locator('#today-gregorian')).toBeInViewport();
  });
}

test('phones: the watch size is unchanged (min(92vw, 62vh))', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto('/');
  const box = (await page.locator('#watch-box').boundingBox())!;
  expect(box.width).toBeCloseTo(Math.min(0.92 * 400, 0.62 * 860), 0);
});

test('the analog hands reach their scales on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const r = await page.evaluate(() => {
    const svg = document.querySelector('.watch-face--analog') as SVGSVGElement;
    const ctm = svg.getScreenCTM()!;
    const unit = Math.hypot(ctm.a, ctm.b);                      // px per viewBox unit
    const c = new DOMPoint(100, 100).matrixTransform(ctm);
    const reach = (id: string) => {
      const g = document.getElementById(id) as unknown as SVGGraphicsElement;
      const path = g.querySelector('path') as SVGPathElement;
      const m = path.getScreenCTM()!;
      let best = 0;
      for (let i = 0; i <= 400; i++) {
        const p = path.getPointAtLength((path.getTotalLength() * i) / 400).matrixTransform(m);
        best = Math.max(best, Math.hypot(p.x - c.x, p.y - c.y));
      }
      return best / unit;
    };
    return { hour: reach('hand-hour'), minute: reach('hand-minute'), second: reach('hand-second') };
  });
  expect(r.hour).toBeGreaterThan(67); expect(r.hour).toBeLessThan(72.5);       // stops at the numerals
  expect(r.minute).toBeGreaterThan(91.5); expect(r.minute).toBeLessThanOrEqual(96); // inside the track
  expect(r.second).toBeGreaterThan(94); expect(r.second).toBeLessThanOrEqual(96);
});

test('digital fits a 320 px phone, in Persian, with Latin digits', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'fa');
    localStorage.setItem('settings.v1', JSON.stringify({ watch: { face: 'digital' } }));
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const hm = page.locator('.wd-hm');
  await expect(hm).toHaveText(/^\d\d:\d\d$/);
  const fit = await page.evaluate(() => {
    const face = document.querySelector('.watch-face--digital') as HTMLElement;
    const box = document.getElementById('watch-box')!.getBoundingClientRect();
    const r = face.getBoundingClientRect();
    const hmRect = face.querySelector('.wd-hm')!.getBoundingClientRect();
    return { overflow: face.scrollWidth - face.clientWidth, inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5, oneLine: hmRect.height < 1.6 * parseFloat(getComputedStyle(face.querySelector('.wd-hm')!).fontSize) };
  });
  expect(fit.overflow).toBeLessThanOrEqual(0);
  expect(fit.inside).toBe(true);
  expect(fit.oneLine).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('dark mode restyles the analog dial live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const look = () => page.evaluate(() => [
    getComputedStyle(document.querySelector('.wa-num')!).fill,
    getComputedStyle(document.querySelector('.wa-ring')!).stroke,
    getComputedStyle(document.querySelector('.wa-blue-1')!).stopColor,
  ].join('|'));
  const light = await look();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(look).not.toBe(light);
});
```

  - Replace the movement screenshot loop with a matrix of `light`/`dark` × `400`/`1440` ×
    `analog`/`digital`, written to `test-results/screens/watch-${scheme}-${w}-${face}.png`. Choose the
    face via `addInitScript` setting `settings.v1`.
  - In `e2e/site.spec.ts`, the test "desktop stays pixel-identical regardless of short viewport height"
    asserts the clock width is ≥ 500, which encodes the old design the spec replaces. Change it to
    `expect(clock!.width).toBeLessThanOrEqual(360.5)` and keep the rest.

- [ ] **Step 2: Run them and check they fail.** Run `npm run build && npx playwright test e2e/watch.spec.ts e2e/site.spec.ts`.
  Expected: the ≤ 360 tests and the site.spec desktop test fail (the box is about 576 px). The
  others may already pass.

- [ ] **Step 3: Implement.** In `components.css`, replace the wide-screen watch-box rule with:

```css
/* Wide screens: a watch, not a wall clock — at most 360 px, centred in the sticky left column,
   and never so large that the column (watch and today lines) overflows a short viewport. `svh`
   keeps the dial from resizing as browser bars come and go; the floor keeps it a watch on very
   short windows. The `vh` line is for browsers without `svh`. */
@media (min-width: 1024px) {
  #watch-box {
    width: min(360px, 40vw, 72vh, max(calc(100vh - 16rem), 160px));
    width: min(360px, 40vw, 72vh, max(calc(100svh - 16rem), 160px));
  }
}
```

  (The height budget drops from 22rem to 16rem because the toggle and the digits row are gone. If
  1280 × 720 then fails the today-lines check, raise it back towards 22rem and report the value.)

- [ ] **Step 4: Run everything.** Run the full `npx playwright test`, `npx vitest run --coverage` (100 %)
  and `npx tsc --noEmit`.
  - Look at all eight screenshots in `test-results/screens/`: hands on their scales, numerals legible,
    the digital line fitting, both themes.
  - Copy them to `.superpowers/sdd/2026-10-15-watch-refinement/shots/`, and describe in the report
    what you saw in each.

- [ ] **Step 5: Commit**

```bash
git add Site/src/styles/components.css Site/e2e/watch.spec.ts Site/e2e/site.spec.ts
git commit -m "feat(site): a 360 px watch on desktop; layout and legibility e2e"
```

---

### Task 6: Docs

**Files:**
- Modify: `README.md` (repo root)
- Modify: `docs/SECURITY.md`

- [ ] **Step 1: README.** In the Watch section, describe what ships, with no aspirational prose:
  - **Analog:** a Breguet-style dial, railway minute track, twelve Cormorant Garamond numerals, blued
    leaf hands reaching their scales, a seconds hand ticking 8 times a second.
  - **Digital:** HH:MM in Bodoni Moda with small blued seconds.
  - Both faces always use Latin digits.
  - Settings → Watch: Analog · Digital.
  - Desktop: the watch is at most 360 px in a sticky left column. Phones are unchanged.

  Remove every mention of the movement, Show movement, Full bleed, Classic, gear ratios, the
  balance and the escapement. Update:
  - the repo layout list for `src/watch/` (`hands.ts`, `face.ts`, `analog.ts`, `digital.ts`,
    `watch-settings.ts`, `watch.ts`);
  - the test counts (Vitest, Playwright passed/skipped), using the real numbers from a fresh run;
  - the bundle size (JS, CSS and the Bodoni woff2), from `npm run build`.
- [ ] **Step 2: SECURITY.md.**
  - Update the test counts if they are listed there.
  - The note that `settings.v1` holds the watch face stays, with the values now `analog` / `digital`
    if values are mentioned.
- [ ] **Step 3: Verify.** `grep -n -i "movement\|full bleed\|classic\|escapement\|balance wheel" README.md docs/SECURITY.md`
  prints nothing about the watch.
- [ ] **Step 4: Commit**

```bash
git add README.md docs/SECURITY.md
git commit -m "docs: the refined watch — Analog and Digital"
```

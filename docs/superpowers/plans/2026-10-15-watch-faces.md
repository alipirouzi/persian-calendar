# Watch Faces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal analog clock with a screen-native "Full bleed" mechanical watch, plus a realistic geared movement behind *Show movement*. Keep the old clock as a selectable "Classic" face. Follow the system light/dark setting. Make the watch a sticky left half on wide screens.

**Architecture:** Two pure modules sit at the core, both at 100% coverage:
- `geometry.ts` holds gear, escape-wheel and hairspring shapes, and places wheels at real meshing distances.
- `movement-model.ts` turns one moment into an angle for every hand and wheel. Every wheel's angle is derived from the escapement's beat count through the real ratios.

Three DOM modules build the SVGs and render from that state: `full-bleed.ts`, `classic.ts` and `movement-view.ts`. A single driver, `watch.ts`, replaces `clock/clock.ts`. It runs the frame loop: dial-only frames render only when the 125 ms beat changes, and every frame renders while the movement is open. It also pauses while the page is hidden, honours reduced motion, owns the *Show movement* toggle and the accessible label, and calls `main.ts`'s minute gate. Colours are CSS custom properties, so a system theme change restyles everything live.

**Tech Stack:** Vite 7 + vanilla TypeScript, SVG, Vitest 3 (+ jsdom 30 under `tests/dom/`), Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-10-15-watch-faces-design.md`

## Global Constraints

- **Faces:** Full bleed (default) and Classic (today's minimal clock, unchanged look). Stored as `watch.face` in `settings.v1`; an unknown value falls back to `fullbleed`.
- **Full bleed dial:**
  - no case, bezel or lugs;
  - 60-mark minute track, with the 5-minute marks heavier and the 12/3/6/9 positions left to the numerals;
  - numerals **12, 3, 6, 9**, large, weight 800, **Latin digits always**, including when the UI is Persian;
  - broad sword hour and minute hands, a slim accent-red seconds hand with a counterweight, and a red centre cap.
- **Seconds tick 8 times a second** (4 Hz, 28 800 vph; 125 ms steps). Hour and minute hands move continuously. Under reduced motion, the hands step once a second.
- **Palette:**
  - Light: dial `#fbf9f4 → #ebe6dc`, numerals `#15181d`, hands `#1a1f26`, accent `#e0401f`.
  - Dark: dial `#1d2128 → #0b0d10`, numerals `#f4f1e8`, hands `#e9f5dd`, accent `#ff5a36`.
  - Contrast: at least 4.5:1 for numerals, and at least 3:1 for hands and track, against the dial in both modes.
- **Show movement:**
  - A pill `<button>` with `aria-pressed`, labelled **Show movement / Show time** (EN) and **نمایش موتور / نمایش ساعت** (FA).
  - The dial transition is opacity → 0 and scale 1 → 1.08 over ~0.9 s ease-out. The movement goes opacity → 1 and scale 0.96 → 1. Under reduced motion this is an instant cross-fade.
  - While the movement shows, the time appears as large `HH:MM` digits (Latin, 24-hour).
  - The open state is session-only; the app opens on the dial.
- **Movement:** a 4 Hz Swiss-lever train with these parts.
  - barrel 96 teeth, 1 turn / 8 h, counter-clockwise;
  - centre wheel 80 / pinion 12, 1 turn / hour, clockwise;
  - third wheel 75 / pinion 10, 8 turns / hour, counter-clockwise;
  - fourth wheel 80 / pinion 10, 1 turn / minute, clockwise;
  - escape wheel 15 club teeth / pinion 5, 16 turns / minute in 12° steps per beat, counter-clockwise;
  - pallet fork, rocks once per beat;
  - balance at 4 Hz, ±220°, passing through zero on every beat.
- **Derivation:** escape = beats × 12°, fourth = escape / 16, third = fourth / 7.5, centre = third / 8, barrel = centre / 8. Meshing distance = the sum of the two pitch radii (module × teeth / 2).
- **Finishing:**
  - perlage on the main plate, Côtes-de-Genève stripes on the bridges;
  - red jewels at pivots, blued screws, a balance cock;
  - a hairspring that breathes with the balance.
- **Part names:** shown on tap or keyboard focus. On wide screens the labels are always visible. EN and FA.
- **Lazy movement:** the movement SVG is built on first open and removed when returning to the dial.
- **Layout:**
  - **Phone (< 1024 px):** the watch fills the width, `min(92vw, 62vh)`.
  - **Wide (≥ 1024 px):** two columns. On the left, the watch, the today lines and the toggle sit in a sticky, full-height, vertically centred column. On the right, the converter and month views scroll.
  - **RTL:** the columns mirror, but the watch itself does not.
  - **Existing test:** "desktop: converter incl. status row is fully above the fold" must still pass.
- **Accessibility:**
  - The watch has `role="img"` and an accessible name with the current time, in UI-language digits, updated once a minute.
  - Focus stays on the toggle across the transition.
- **Frame budget:**
  - With the dial only, render when the 125 ms beat changes (about 8 fps).
  - With the movement open, render every rAF frame.
  - Reduced motion uses a 1 s interval.
  - A hidden page stops the loop entirely.
- **Coverage:** 100% on `src/**/*.ts`. The `src/clock/**` exclusion is removed together with the folder.
- **Out of scope:** sound, device-motion parallax, further complications, and the Discs and Retrograde faces.
- **Hygiene:** no `console.log`, no secrets, no personal data. Commit messages use `<type>: <description>`. Never stage `.superpowers/` or `.DS_Store`.

## Decisions this plan makes (beyond the spec's wording)

1. **Both faces draw in a `viewBox="0 0 200 200"` centred on (100, 100), and their root SVG carries class `clock`.** The hands keep the ids `hand-hour`, `hand-minute` and `hand-second`, with transforms `rotate(<deg> 100 100)`. The existing E2E hooks (`#hand-second`, `.clock`) therefore keep working.
2. **The movement uses its own `viewBox="0 0 280 280"` centred on (140, 140)**, sized with the dial and stacked under it in the same box.
3. **The Show movement toggle only exists for Full bleed.** It is hidden for Classic, because the spec ties the movement to Full bleed.
4. **The `watchState` model takes `ms` since local midnight plus `reduced`.** Under reduced motion the beat index advances in whole seconds (8 beats per second, jumping together), so the train stays geared and consistent while it steps once a second.
5. **The tests that encode the old clock sizes are rewritten to the new layout, a deliberate spec change:**
   - 'landscape phone: clock shrinks', 'tablet clock is larger than phone clock' and 'desktop stays pixel-identical …' (`.clock` height 210).
   - Their new expectations are listed in Task 6. The behaviour they guard, that the today panel stays reachable and that desktop doesn't depend on a short viewport, is kept.
6. **The today lines move into the left column with the watch on wide screens.** On phones they stay where they are, directly under the watch. The markup gains two wrappers: `#watch-column` (clock section + today) and `#content-column` (converter + calendars).

## Review Focus

1. **The device clock or the time sync jumps backwards**, for example on a correction. The hands and every wheel must follow at once; nothing may spin round to "catch up". Pinned in Task 2: the state is a pure function of `ms`.
2. **Switching the system theme while the movement is open** must restyle both layers immediately, with no reload and no stale inline colours. Pinned in Task 4/5 DOM tests (no inline `fill`/`stroke` colour attributes, only classes) and in Task 6 E2E (`emulateMedia` switch mid-page).
3. **Opening the movement, hiding the app, and returning hours later** must resume at the current time. The loop must not run while hidden, and the movement must not freeze on the old state. Pinned in the Task 6 DOM test.
4. **Switching the face to Classic while the movement is open** must close the movement, remove its SVG and hide the toggle. Pinned in Task 6.
5. **A Persian UI** must keep Latin digits on the dial and in the movement's `HH:MM`, while the accessible label and button text are Persian. Pinned in Task 4 (DOM) and Task 6 (E2E).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `Site/src/watch/geometry.ts` | create | Pure shapes and placement |
| `Site/src/watch/movement-model.ts` | create | Pure time → angles (replaces `clock/clock-math.ts`) |
| `Site/src/watch/face.ts` | create | `Face` interface, `FaceId`, `FACE_IDS` |
| `Site/src/watch/full-bleed.ts` | create | DOM: Full bleed dial |
| `Site/src/watch/classic.ts` | create | DOM: today's clock as a `Face` |
| `Site/src/watch/movement-view.ts` | create | DOM: lazy movement SVG, part captions |
| `Site/src/watch/watch.ts` | create | DOM: driver, toggle, a11y label, frame budget |
| `Site/src/watch/watch-settings.ts` | create | DOM: Settings "Watch" group |
| `Site/src/clock/clock.ts`, `clock-math.ts`, `tests/clock-math.test.ts` | delete | Replaced |
| `Site/src/settings/settings-model.ts` | modify | `watch.face` |
| `Site/src/i18n/strings.ts`, `Site/index.html`, `Site/src/styles/tokens.css`, `components.css`, `base.css`, `Site/src/main.ts`, `Site/vite.config.ts` | modify | Strings, markup, palette, layout, wiring, coverage config |
| `Site/tests/watch-geometry.test.ts`, `watch-model.test.ts`, `tests/dom/full-bleed.test.ts`, `classic.test.ts`, `movement-view.test.ts`, `watch.test.ts`, `watch-settings.test.ts` | create | Tests |
| `Site/e2e/watch.spec.ts`, `Site/e2e/site.spec.ts` | create / modify | E2E |
| `README.md`, `docs/SECURITY.md` | modify | Docs |

All commands run from `Site/` unless stated otherwise.

---

### Task 1: Geometry kit

**Files:** Create `Site/src/watch/geometry.ts`. Test: `Site/tests/watch-geometry.test.ts`.

**Interfaces — Produces:**

```ts
export interface Point { readonly x: number; readonly y: number }
export const pitchRadius: (module: number, teeth: number) => number;          // module * teeth / 2
export const polar: (from: Point, distance: number, degrees: number) => Point; // 0° = up (12 o'clock), clockwise
export const meshDistance: (module: number, wheelTeeth: number, pinionTeeth: number) => number; // sum of pitch radii
export function gearPath(centre: Point, module: number, teeth: number): string;   // SVG path, closed
export function escapeWheelPath(centre: Point, radius: number, teeth?: number): string; // club teeth, default 15
export function spiralPath(centre: Point, turns: number, innerRadius: number, outerRadius: number, phaseRad?: number, steps?: number): string;
```

- [ ] **Step 1: Write the failing test**

```ts
// Site/tests/watch-geometry.test.ts
import { describe, expect, it } from 'vitest';
import {
  escapeWheelPath, gearPath, meshDistance, pitchRadius, polar, spiralPath,
} from '../src/watch/geometry';

const points = (d: string): [number, number][] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const dist = ([x, y]: [number, number], c = { x: 50, y: 50 }) => Math.hypot(x - c.x, y - c.y);

describe('pitch radius and meshing', () => {
  it('is module × teeth / 2', () => {
    expect(pitchRadius(1.2, 80)).toBeCloseTo(48);
  });
  it('meshes a wheel and a pinion at the sum of their pitch radii', () => {
    expect(meshDistance(1.2, 80, 12)).toBeCloseTo(48 + 7.2);
  });
});

describe('polar', () => {
  it('measures 0° straight up and turns clockwise', () => {
    const c = { x: 100, y: 100 };
    const up = polar(c, 10, 0), right = polar(c, 10, 90), down = polar(c, 10, 180);
    expect(up.x).toBeCloseTo(100); expect(up.y).toBeCloseTo(90);
    expect(right.x).toBeCloseTo(110); expect(right.y).toBeCloseTo(100);
    expect(down.y).toBeCloseTo(110);
  });
});

describe('gearPath', () => {
  it('is a closed path with every point between the root and tip circles', () => {
    const d = gearPath({ x: 50, y: 50 }, 1, 20);       // pitch r 10, tip 11, root 8.75
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
    for (const p of points(d)) {
      expect(dist(p)).toBeGreaterThanOrEqual(8.75 - 1e-6);
      expect(dist(p)).toBeLessThanOrEqual(11 + 1e-6);
    }
  });
  it('has one tooth tip per tooth', () => {
    const tips = points(gearPath({ x: 50, y: 50 }, 1, 20)).filter((p) => Math.abs(dist(p) - 11) < 1e-3);
    expect(tips.length).toBe(20 * 2);                    // each flat tooth tip has two corner points
  });
});

describe('escapeWheelPath', () => {
  it('has 15 club teeth by default, all within the radius', () => {
    const pts = points(escapeWheelPath({ x: 50, y: 50 }, 13));
    expect(pts.filter((p) => Math.abs(dist(p) - 13) < 1e-3)).toHaveLength(15);
    for (const p of pts) expect(dist(p)).toBeLessThanOrEqual(13 + 1e-6);
  });
});

describe('spiralPath', () => {
  it('runs from the inner to the outer radius', () => {
    const pts = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20));
    expect(dist(pts[0]!)).toBeCloseTo(2);
    expect(dist(pts.at(-1)!)).toBeCloseTo(20);
    expect(pts.length).toBe(161);                        // default 160 steps + start
  });
  it('rotates with its phase', () => {
    const a = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20, 0, 10))[0]!;
    const b = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20, Math.PI / 2, 10))[0]!;
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run `npx vitest run tests/watch-geometry.test.ts`. Expected: FAIL, because the module does not exist yet.

- [ ] **Step 3: Implement**

```ts
// Site/src/watch/geometry.ts
export interface Point { readonly x: number; readonly y: number }

const TAU = Math.PI * 2;
const fmt = (n: number): string => n.toFixed(2);
const at = (c: Point, angle: number, r: number): string =>
  `${fmt(c.x + Math.sin(angle) * r)} ${fmt(c.y - Math.cos(angle) * r)}`;

export const pitchRadius = (module: number, teeth: number): number => (module * teeth) / 2;

/** 0° points to 12 o'clock and angles grow clockwise, as on a dial. */
export const polar = (from: Point, distance: number, degrees: number): Point => {
  const a = (degrees * Math.PI) / 180;
  return { x: from.x + Math.sin(a) * distance, y: from.y - Math.cos(a) * distance };
};

/** Two gears mesh when their pitch circles touch. */
export const meshDistance = (module: number, wheelTeeth: number, pinionTeeth: number): number =>
  pitchRadius(module, wheelTeeth) + pitchRadius(module, pinionTeeth);

/**
 * A spur gear: addendum = module, dedendum = 1.25 × module (the standard proportions),
 * flanks drawn as straight lines with a flat tip — close enough to an involute at this size.
 */
export function gearPath(centre: Point, module: number, teeth: number): string {
  const r = pitchRadius(module, teeth);
  const tip = r + module;
  const root = r - 1.25 * module;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (k: number): number => ((i + k) / teeth) * TAU;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${at(centre, a(0), root)}`,
      `L${at(centre, a(0.15), root)}`,
      `L${at(centre, a(0.3), tip)}`,
      `L${at(centre, a(0.5), tip)}`,
      `L${at(centre, a(0.65), root)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** A Swiss-lever escape wheel: slanted club teeth, the tip being the radius. */
export function escapeWheelPath(centre: Point, radius: number, teeth = 15): string {
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (k: number): number => ((i + k) / teeth) * TAU;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${at(centre, a(0), radius * 0.72)}`,
      `L${at(centre, a(0.55), radius)}`,
      `L${at(centre, a(0.7), radius * 0.97)}`,
      `L${at(centre, a(0.62), radius * 0.82)}`,
      `L${at(centre, a(1), radius * 0.72)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** An Archimedean spiral — the hairspring. */
export function spiralPath(
  centre: Point, turns: number, innerRadius: number, outerRadius: number, phaseRad = 0, steps = 160,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = phaseRad + t * turns * TAU;
    const r = innerRadius + (outerRadius - innerRadius) * t;
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(centre.x + Math.cos(angle) * r)} ${fmt(centre.y + Math.sin(angle) * r)}`);
  }
  return parts.join(' ');
}
```

If a test fails only because of 2-decimal rounding, loosen the tolerance in the *test* to `1e-2` and record why in the report. Never change the geometry to suit a tolerance.

- [ ] **Step 4: Run and pass**

Run `npx vitest run tests/watch-geometry.test.ts && npx vitest run --coverage && npx tsc --noEmit`. All three must pass with coverage at 100%.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/watch/geometry.ts Site/tests/watch-geometry.test.ts
git commit -m "feat(site): watch geometry kit — gears, escape wheel, hairspring, meshing"
```

---

### Task 2: Movement model (replaces clock-math)

**Files:**
- Create `Site/src/watch/movement-model.ts`, test `Site/tests/watch-model.test.ts`.
- Delete `Site/src/clock/clock-math.ts` and `Site/tests/clock-math.test.ts`, moving their cases into the new test.
- Do not delete `clock.ts` in this task. It imports `clock-math`, so point that import at `../watch/movement-model` (`handAngles`, `msSinceLocalMidnight` re-exported) until Task 6 removes `clock.ts`.

**Interfaces — Produces:**

```ts
export const BEAT_MS = 125;
export const ESCAPE_STEP_DEG = 12;
export const TRAIN_RATIOS = { escapeToFourth: 16, fourthToThird: 7.5, thirdToCentre: 8, centreToBarrel: 8 } as const;
export const BALANCE_AMPLITUDE_DEG = 220;
export const PALLET_DEG = 9;
export interface HandAngles { readonly hour: number; readonly minute: number; readonly second: number }
export interface WatchState extends HandAngles {
  readonly beat: number;      // beat index since midnight; 8 per second (reduced: advances 8 at a time, once a second)
  readonly escape: number; readonly fourth: number; readonly third: number; readonly centre: number; readonly barrel: number;
  readonly pallet: number; readonly balance: number;
}
export function msSinceLocalMidnight(date: Date): number;
export function handAngles(ms: number): HandAngles;          // continuous (kept for Classic)
export function watchState(ms: number, reduced: boolean): WatchState;
export function hhmm(date: Date): string;                     // "09:05", Latin, 24-hour
```

Sign convention: positive means clockwise in SVG `rotate()`. The centre and fourth wheels are positive; the escape, third and barrel wheels are negative, which is the direction each one turns.

- [ ] **Step 1: Write the failing test**

```ts
// Site/tests/watch-model.test.ts
import { describe, expect, it } from 'vitest';
import {
  BALANCE_AMPLITUDE_DEG, BEAT_MS, handAngles, hhmm, msSinceLocalMidnight, PALLET_DEG, watchState,
} from '../src/watch/movement-model';

const mod = (x: number) => ((x % 360) + 360) % 360;
const at = (h: number, m: number, s: number, ms = 0) => ((h * 60 + m) * 60 + s) * 1000 + ms;

describe('handAngles (continuous, as the old clock-math)', () => {
  it('midnight → all hands at 12', () => { expect(handAngles(0)).toEqual({ hour: 0, minute: 0, second: 0 }); });
  it('10:30:00 → hour 315°, minute 180°', () => {
    const a = handAngles(at(10, 30, 0));
    expect(a.hour).toBe(315); expect(a.minute).toBe(180); expect(a.second).toBe(0);
  });
  it('12 h wraps to 0', () => { expect(handAngles(12 * 3_600_000).hour).toBe(0); });
  it('is continuous: 500 ms → second 3°', () => { expect(handAngles(500).second).toBe(3); });
});

describe('msSinceLocalMidnight and hhmm', () => {
  it('reads local wall-clock fields', () => {
    const d = new Date(2026, 6, 31, 1, 2, 3, 400);
    expect(msSinceLocalMidnight(d)).toBe(at(1, 2, 3, 400));
    expect(hhmm(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(hhmm(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('watchState', () => {
  it('ticks the seconds hand 8 times a second', () => {
    expect(watchState(at(0, 0, 1, 0), false).second).toBe(6);
    expect(watchState(at(0, 0, 1, 124), false).second).toBe(6);
    expect(watchState(at(0, 0, 1, 125), false).second).toBe(6.75);
  });

  it('steps once a second under reduced motion', () => {
    expect(watchState(at(0, 0, 1, 900), true).second).toBe(6);
    expect(watchState(at(0, 0, 2, 0), true).second).toBe(12);
  });

  it('moves hour and minute hands continuously', () => {
    const s = watchState(at(10, 30, 30), false);
    expect(s.minute).toBeCloseTo(183);
    expect(s.hour).toBeCloseTo(315.25);
  });

  it('steps the escape wheel 12° per beat, counter-clockwise', () => {
    const a = watchState(at(3, 0, 0), false), b = watchState(at(3, 0, 0, BEAT_MS), false);
    expect(a.escape - b.escape).toBeCloseTo(12);
  });

  it('gears the whole train to the hands at any time of day', () => {
    for (let ms = 0; ms < 86_400_000; ms += 7_777_777) {
      const s = watchState(ms, false);
      expect(mod(s.fourth)).toBeCloseTo(mod(s.second), 6);           // fourth wheel carries the seconds
      expect(Math.abs(mod(s.centre) - mod(s.minute))).toBeLessThan(0.02); // centre carries the minutes (within one beat)
      expect(s.fourth).toBeCloseTo(-s.escape / 16, 6);
      expect(s.third).toBeCloseTo(-s.fourth / 7.5, 6);
      expect(s.centre).toBeCloseTo(-s.third / 8, 6);
      expect(s.barrel).toBeCloseTo(-s.centre / 8, 6);
    }
  });

  it('turns the centre wheel once an hour and the barrel once in eight', () => {
    const a = watchState(at(1, 0, 0), false), b = watchState(at(2, 0, 0), false);
    expect(b.centre - a.centre).toBeCloseTo(360, 6);
    expect(a.barrel - b.barrel).toBeCloseTo(45, 6);
  });

  it('passes the balance through zero exactly on every beat, at full swing between', () => {
    for (let k = 0; k < 16; k += 1) expect(watchState(k * BEAT_MS, false).balance).toBeCloseTo(0, 6);
    expect(Math.abs(watchState(BEAT_MS / 2, false).balance)).toBeCloseTo(BALANCE_AMPLITUDE_DEG, 6);
  });

  it('rocks the pallet to the opposite side on each beat', () => {
    const end = (beat: number) => watchState(beat * BEAT_MS + BEAT_MS - 1, false).pallet;
    expect(end(0)).toBeCloseTo(-end(1), 6);
    expect(Math.abs(end(0))).toBeCloseTo(PALLET_DEG, 6);
  });

  it('keeps the balance and pallet still under reduced motion', () => {
    const s = watchState(at(5, 5, 5, 60), true);
    expect(s.balance).toBe(0);
    expect(s.pallet).toBe(0);
  });

  it('is a pure function of time, so a backwards jump just shows the earlier state', () => {
    const later = watchState(at(12, 0, 0), false), earlier = watchState(at(11, 59, 0), false);
    expect(watchState(at(11, 59, 0), false)).toEqual(earlier);
    expect(later.minute).not.toBe(earlier.minute);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run `npx vitest run tests/watch-model.test.ts`. Expected: FAIL, because the module does not exist yet.

- [ ] **Step 3: Implement**

```ts
// Site/src/watch/movement-model.ts
export const BEAT_MS = 125;                       // 4 Hz: 28 800 vibrations an hour
export const ESCAPE_STEP_DEG = 12;               // half a tooth of a 15-tooth escape wheel per beat
export const TRAIN_RATIOS = { escapeToFourth: 16, fourthToThird: 7.5, thirdToCentre: 8, centreToBarrel: 8 } as const;
export const BALANCE_AMPLITUDE_DEG = 220;
export const PALLET_DEG = 9;
const PALLET_SNAP = 0.18;                         // share of a beat the fork takes to cross over

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_HALF_DAY = 43_200_000;
const BEATS_PER_SECOND = MS_PER_SECOND / BEAT_MS;

export interface HandAngles { readonly hour: number; readonly minute: number; readonly second: number }

export interface WatchState extends HandAngles {
  readonly beat: number;
  readonly escape: number;
  readonly fourth: number;
  readonly third: number;
  readonly centre: number;
  readonly barrel: number;
  readonly pallet: number;
  readonly balance: number;
}

export function msSinceLocalMidnight(date: Date): number {
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

export function handAngles(ms: number): HandAngles {
  return {
    hour: ((ms % MS_PER_HALF_DAY) / MS_PER_HALF_DAY) * 360,
    minute: ((ms % MS_PER_HOUR) / MS_PER_HOUR) * 360,
    second: ((ms % MS_PER_MINUTE) / MS_PER_MINUTE) * 360,
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');
export const hhmm = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Every moving part as an angle, all derived from the escapement's beats through the train's
 * ratios — so the centre wheel *is* the minute hand and the fourth wheel *is* the seconds.
 * A pure function of the time: a clock correction simply shows the corrected state.
 */
export function watchState(ms: number, reduced: boolean): WatchState {
  const beat = reduced
    ? Math.floor(ms / MS_PER_SECOND) * BEATS_PER_SECOND
    : Math.floor(ms / BEAT_MS);
  const escapeTurn = beat * ESCAPE_STEP_DEG;
  const fourth = escapeTurn / TRAIN_RATIOS.escapeToFourth;
  const third = fourth / TRAIN_RATIOS.fourthToThird;
  const centre = third / TRAIN_RATIOS.thirdToCentre;
  const barrel = centre / TRAIN_RATIOS.centreToBarrel;
  const { hour, minute } = handAngles(ms);
  const second = (fourth % 360 + 360) % 360;

  let pallet = 0;
  let balance = 0;
  if (!reduced) {
    const progress = Math.min(1, (ms % BEAT_MS) / BEAT_MS / PALLET_SNAP);
    const side = beat % 2 === 0 ? -1 : 1;
    pallet = side * PALLET_DEG * (2 * progress - 1);
    balance = Math.sin(((ms % MS_PER_SECOND) / MS_PER_SECOND) * 2 * Math.PI * BEATS_PER_SECOND / 2) * BALANCE_AMPLITUDE_DEG;
  }

  return { hour, minute, second, beat, escape: -escapeTurn, fourth, third: -third, centre, barrel: -barrel, pallet, balance };
}
```

Check the balance formula against the tests. Four oscillations per second means `sin(2π · 4 · t)`, and `BEATS_PER_SECOND / 2 = 4`, so it gives zero at every 125 ms boundary and ±220° at the half-beat. If a test disagrees, fix the *formula*, not the test, and record what was wrong. The test is the spec.

Then update `Site/src/clock/clock.ts` to import `handAngles, msSinceLocalMidnight` from `'../watch/movement-model'`, and delete `clock-math.ts` and its test.

- [ ] **Step 4: Run and pass**

Run `npx vitest run tests/watch-model.test.ts && npx vitest run --coverage && npx tsc --noEmit`. All must pass with coverage at 100%.

- [ ] **Step 5: Commit**

```bash
git status --short
git add -A Site/src/watch/movement-model.ts Site/tests/watch-model.test.ts Site/src/clock Site/tests/clock-math.test.ts
git commit -m "feat(site): movement model — every wheel geared to the hands from the escapement's beats"
```

---

### Task 3: Settings — `watch.face` and the Watch group

**Files:**
- Modify `Site/src/settings/settings-model.ts`, `Site/src/i18n/strings.ts` and `Site/index.html` (a new fieldset, placed first in `#settings-dialog` after the head).
- Create `Site/src/watch/face.ts` and `Site/src/watch/watch-settings.ts`.
- Tests: `Site/tests/settings-model.test.ts` (extend), `Site/tests/dom/watch-settings.test.ts`, and the whole-object expectations in `tests/dom/settings-store.test.ts`.

**Interfaces — Produces:**
- `face.ts`:
  - `export type FaceId = 'fullbleed' | 'classic'`, `export const FACE_IDS: readonly FaceId[] = ['fullbleed', 'classic']`
  - `export interface Face { readonly root: SVGSVGElement; render(state: WatchState): void; destroy(): void }`
- `Settings.watch: { readonly face: FaceId }`, with `DEFAULT_SETTINGS.watch = { face: 'fullbleed' }`.
- `setupWatchSettings({ store, getLang }): { rerender(): void }`. It drives a `<select id="set-watch-face">` and writes `watch.face` through `store.update((s) => ({ ...s, watch: { face } }))`, syncing from the store when the gear is clicked (the same pattern as `time-panel.ts`).

**Strings (EN / FA)**, added to `StringKey`:

| key | en | fa |
|---|---|---|
| `watchSection` | Watch | ساعت |
| `watchFace` | Face | صفحه |
| `faceFullBleed` | Full bleed | تمام‌صفحه |
| `faceClassic` | Classic | کلاسیک |
| `showMovement` | Show movement | نمایش موتور |
| `showTime` | Show time | نمایش ساعت |
| `watchLabel` | Watch, {time} | ساعت، {time} |
| `partBarrel` | Barrel · 1 turn in 8 hours | بشکه · یک دور در ۸ ساعت |
| `partCentre` | Centre wheel · 1 turn an hour | چرخ مرکزی · یک دور در ساعت |
| `partThird` | Third wheel · 8 turns an hour | چرخ سوم · ۸ دور در ساعت |
| `partFourth` | Fourth wheel · 1 turn a minute | چرخ چهارم · یک دور در دقیقه |
| `partEscape` | Escape wheel · 16 turns a minute | چرخ گریز · ۱۶ دور در دقیقه |
| `partPallet` | Pallet fork · 8 beats a second | لنگر · ۸ ضربه در ثانیه |
| `partBalance` | Balance · 4 Hz | چرخ تعادل · ۴ هرتز |

(The part strings are UI text, so in FA they use Persian digits. The **dial's** digits are Latin; see the Global Constraints.)

Markup (first fieldset in the dialog):

```html
      <fieldset class="settings-group">
        <legend data-str="watchSection"></legend>
        <label for="set-watch-face" data-str="watchFace"></label>
        <select id="set-watch-face">
          <option value="fullbleed" data-str="faceFullBleed"></option>
          <option value="classic" data-str="faceClassic"></option>
        </select>
      </fieldset>
```

- [ ] **Step 1: Write the failing tests**

Add to `tests/settings-model.test.ts`:

```ts
describe('watch group', () => {
  it('defaults to the Full bleed face', () => {
    expect(parseSettings(undefined).watch).toEqual({ face: 'fullbleed' });
  });
  it('keeps a known face and replaces an unknown one', () => {
    expect(parseSettings({ watch: { face: 'classic' } }).watch.face).toBe('classic');
    for (const face of ['sundial', 3, null]) expect(parseSettings({ watch: { face } }).watch.face).toBe('fullbleed');
    expect(parseSettings({ watch: 'classic' }).watch.face).toBe('fullbleed');
  });
});
```

Update `'keeps every valid field'` so its `raw` includes `watch: { face: 'classic' }`. Add `watch: { face: 'fullbleed' }` to the whole-object expectation in `tests/dom/settings-store.test.ts`.

```ts
// Site/tests/dom/watch-settings.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { setupWatchSettings } from '../../src/watch/watch-settings';
import { clickOn } from './dom-helpers';

const BODY = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const select = () => document.getElementById('set-watch-face') as HTMLSelectElement;
let store: SettingsStore;
let lang: Lang;

beforeEach(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } } });
  document.body.innerHTML = BODY;
  lang = 'en';
  store = createSettingsStore();
});

describe('watch settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupWatchSettings({ store, getLang: () => lang })).toThrow('#set-watch-face');
  });

  it('shows the stored face when the dialog opens', () => {
    setupWatchSettings({ store, getLang: () => lang });
    store.update((s) => ({ ...s, watch: { face: 'classic' } }));
    clickOn(document.getElementById('settings-toggle')!);
    expect(select().value).toBe('classic');
  });

  it('stores a new face and keeps the other groups', () => {
    setupWatchSettings({ store, getLang: () => lang });
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    select().value = 'classic';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().watch.face).toBe('classic');
    expect(store.get().time.source).toBe('device');
  });
});
```

Run `npx vitest run tests/settings-model.test.ts tests/dom/watch-settings.test.ts tests/dom/settings-store.test.ts`. It should FAIL.

- [ ] **Step 2: Implement**

In `settings-model.ts`, import `FACE_IDS, type FaceId` from `'../watch/face'`. Add `watch: { readonly face: FaceId }` to `Settings` and `watch: { face: 'fullbleed' }` to `DEFAULT_SETTINGS`. In `parseSettings`, add `watch: { face: oneOf(group('watch')['face'], FACE_IDS, fallback.watch.face) }`.

`face.ts` holds only the type, the constant and the interface (`import type { WatchState } from './movement-model'`).

`watch-settings.ts`: `byId` throws `Missing element #<id>`, and `#set-watch-face` is looked up first. Sync on the gear click, write on change, and keep `rerender` a no-op beyond what `data-str` already covers. Return `{ rerender }` for symmetry with the other groups. If `rerender` has nothing to do, keep it and cover it with one call in the test.

Wire it in `main.ts`: `const watchSettings = setupWatchSettings({ store: settings, getLang: () => lang });`, and add `watchSettings.rerender()` to `renderAll`.

- [ ] **Step 3: Run all tests, coverage, tsc**

Run `npx vitest run --coverage && npx tsc --noEmit`. All must pass with coverage at 100%.

- [ ] **Step 4: Commit**

```bash
git status --short
git add Site/src/settings/settings-model.ts Site/src/watch/face.ts Site/src/watch/watch-settings.ts Site/src/i18n/strings.ts Site/index.html Site/src/main.ts Site/tests/settings-model.test.ts Site/tests/dom/settings-store.test.ts Site/tests/dom/watch-settings.test.ts
git commit -m "feat(site): watch.face setting and the Settings Watch group"
```

---

### Task 4: Faces — palette, Full bleed and Classic

**Files:**
- Create `Site/src/watch/full-bleed.ts` and `Site/src/watch/classic.ts`.
- Modify `Site/src/styles/tokens.css` and `Site/src/styles/components.css`.
- Tests: `Site/tests/dom/full-bleed.test.ts` and `Site/tests/dom/classic.test.ts`.

**Interfaces:**
- Consumes `Face`, `WatchState` and `geometry` (`polar`).
- Produces `createFullBleed(mount: HTMLElement): Face` and `createClassic(mount: HTMLElement): Face`.
  - Each creates its `<svg viewBox="0 0 200 200" class="clock watch-face--<id>" role="img">` inside `mount`, replacing the mount's children.
  - Each holds `<g id="hand-hour">`, `<g id="hand-minute">` and `<g id="hand-second">`, rendered with `rotate(<deg> 100 100)`.
  - `destroy()` removes its SVG.
  - The accessible name is set by the driver (Task 6), not the face.

**Palette tokens** (`tokens.css`): light values in `:root`, dark values in the existing `@media (prefers-color-scheme: dark)` block.

```css
  /* Watch — Full bleed and the movement */
  --w-dial-0: #fbf9f4;  --w-dial-1: #ebe6dc;
  --w-ink: #15181d;     --w-hand: #1a1f26;   --w-accent: #e0401f;
  --w-track: #2a2f36;   --w-line: #cdc6b8;
  --w-plate: #e6e2d9;   --w-plate-dot: #d8d3c8; --w-bridge: #f4f2ee; --w-bridge-edge: #bdb6a8;
  --w-brass: #c49a4a;   --w-brass-dark: #9c7631; --w-steel: #a9b1ba; --w-steel-dark: #7c858f;
  --w-jewel: #c2183a;   --w-spring: #3d5fb8;  --w-shadow: rgba(60,50,30,.18);
```
```css
    --w-dial-0: #1d2128;  --w-dial-1: #0b0d10;
    --w-ink: #f4f1e8;     --w-hand: #e9f5dd;   --w-accent: #ff5a36;
    --w-track: #e3e0d6;   --w-line: #2c323a;
    --w-plate: #22262c;   --w-plate-dot: #2b3037; --w-bridge: #3a4048; --w-bridge-edge: #59616b;
    --w-brass: #c9a45c;   --w-brass-dark: #8c6f35; --w-steel: #b9c0c8; --w-steel-dark: #828a93;
    --w-jewel: #d4214a;   --w-spring: #7d9be0;  --w-shadow: rgba(0,0,0,.45);
```

**Full bleed construction** (viewBox 200, centre 100, dial radius 96):
- **Dial disc:** `<circle r="96" class="wf-dial">`. Its fill is a radial gradient whose `<stop>`s use `style="stop-color: var(--w-dial-0)"` and `var(--w-dial-1)`, so the theme switch restyles it.
- **Edge ring:** `<circle r="96" class="wf-edge">` with `stroke: var(--w-line)`.
- **Track:** 60 `<line class="wf-tick">` (`wf-tick--major` every 5 minutes), skipping 0/15/30/45, running from radius 88 (minor) or 81 (major) to 93. Stroke `var(--w-track)`, width 1 or 2.8.
- **Numerals:** `<text class="wf-num">` reading `12` at (100, 30), `3` at (172, 100), `6` at (100, 170) and `9` at (28, 100). Font 30 px, weight 800, `font-family: var(--font-ui)` but with **Latin digits**: the text content is literal ASCII and `font-feature-settings: "lnum"`. They are placed with `text-anchor: middle; dominant-baseline: central`.
- **Hour hand:** `#hand-hour` > `<path class="wf-hand" d="M100 109 L94 100 L97 47 L100 39 L103 47 L106 100 Z">`.
- **Minute hand:** `#hand-minute` > `<path class="wf-hand" d="M100 112 L95 100 L98 23 L100 15 L102 23 L105 100 Z">`.
- **Seconds hand:** `#hand-second` > `<line class="wf-sec" x1="100" y1="123" x2="100" y2="16">` plus `<circle class="wf-sec-dot" cx="100" cy="118" r="2.6">` as the counterweight.
- **Cap:** `<circle class="wf-cap" r="4.6">` and `<circle class="wf-cap-pin" r="1.6">`.
- **CSS** (components.css):
  - `.wf-num { fill: var(--w-ink) } .wf-hand { fill: var(--w-hand) } .wf-sec { stroke: var(--w-accent); stroke-width: 1.4 }`
  - `.wf-sec-dot, .wf-cap { fill: var(--w-accent) } .wf-cap-pin { fill: var(--w-dial-1) }`
  - `.wf-tick { stroke: var(--w-track); stroke-linecap: round }` and `.wf-edge { fill: none; stroke: var(--w-line) }`.

**No colour may be set as an attribute.** Every colour comes from a class or a `var()`.

**Classic:** today's markup from `clock/clock.ts` (`CLOCK_SVG`: 60 ticks, three line hands, a centre dot, `.second-hand` class), rebuilt with `document.createElementNS` in `classic.ts`. It keeps its continuous sweep, so it renders `state.hour`, `state.minute` and a new **`state.smoothSecond`** (= `handAngles(ms).second`). Under reduced motion the driver's 1 s interval makes it step, as today.

**Add `smoothSecond` to the model in this task** (`movement-model.ts`: `readonly smoothSecond: number` on `WatchState`, set from `handAngles(ms).second`), with this test in `tests/watch-model.test.ts`:

```ts
it('also offers a smooth seconds angle for the Classic face', () => {
  expect(watchState(((0 * 60 + 0) * 60 + 1) * 1000 + 500, false).smoothSecond).toBe(9);
});
```

- [ ] **Step 1: Write the failing DOM tests**

```ts
// Site/tests/dom/full-bleed.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createFullBleed } from '../../src/watch/full-bleed';
import { watchState } from '../../src/watch/movement-model';

let mount: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; });

describe('Full bleed face', () => {
  it('draws a 200-unit dial with the 12/3/6/9 numerals in Latin digits', () => {
    const face = createFullBleed(mount);
    expect(face.root.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(face.root.classList.contains('clock')).toBe(true);
    expect([...face.root.querySelectorAll('.wf-num')].map((t) => t.textContent)).toEqual(['12', '3', '6', '9']);
  });

  it('has 56 track marks (60 minus the four numeral positions), 8 of them major', () => {
    const face = createFullBleed(mount);
    expect(face.root.querySelectorAll('.wf-tick')).toHaveLength(56);
    expect(face.root.querySelectorAll('.wf-tick--major')).toHaveLength(8);
  });

  it('sets no colours as attributes, so the theme restyles it live', () => {
    const face = createFullBleed(mount);
    for (const node of face.root.querySelectorAll('*')) {
      for (const attr of ['fill', 'stroke', 'stop-color']) {
        const v = node.getAttribute(attr);
        if (v !== null) expect(v, `${node.tagName} ${attr}`).toMatch(/^(none|url\(#.+\)|var\(--w-[a-z0-9-]+\))$/);
      }
    }
  });

  it('turns the hands from the state, around the centre', () => {
    const face = createFullBleed(mount);
    face.render(watchState(((10 * 60 + 30) * 60) * 1000, false));
    expect(face.root.querySelector('#hand-hour')!.getAttribute('transform')).toBe('rotate(315 100 100)');
    expect(face.root.querySelector('#hand-minute')!.getAttribute('transform')).toBe('rotate(180 100 100)');
    expect(face.root.querySelector('#hand-second')!.getAttribute('transform')).toBe('rotate(0 100 100)');
  });

  it('destroy removes it', () => {
    createFullBleed(mount).destroy();
    expect(mount.children).toHaveLength(0);
  });
});
```


```ts
// Site/tests/dom/classic.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createClassic } from '../../src/watch/classic';
import { watchState } from '../../src/watch/movement-model';

let mount: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; });

describe('Classic face', () => {
  it('keeps today\'s look: 60 ticks, three line hands, a centre dot', () => {
    const face = createClassic(mount);
    expect(face.root.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(face.root.querySelectorAll('line')).toHaveLength(63);
    expect(face.root.querySelector('.second-hand')).not.toBeNull();
  });
  it('sweeps the seconds smoothly', () => {
    const face = createClassic(mount);
    face.render(watchState(1_500, false));
    expect(face.root.querySelector('#hand-second')!.getAttribute('transform')).toBe('rotate(9 100 100)');
  });
  it('destroy removes it', () => {
    createClassic(mount).destroy();
    expect(mount.children).toHaveLength(0);
  });
});
```

Run `npx vitest run tests/dom/full-bleed.test.ts tests/dom/classic.test.ts`. It should FAIL.

- [ ] **Step 2: Implement** both faces exactly as described above, plus the tokens and CSS, and the `smoothSecond` field with its test.

- [ ] **Step 3: Run all tests, coverage, tsc**

Run `npx vitest run --coverage && npx tsc --noEmit`. All must pass with coverage at 100%.

- [ ] **Step 4: Commit**

```bash
git status --short
git add Site/src/watch/full-bleed.ts Site/src/watch/classic.ts Site/src/watch/movement-model.ts Site/src/styles/tokens.css Site/src/styles/components.css Site/tests/dom/full-bleed.test.ts Site/tests/dom/classic.test.ts Site/tests/watch-model.test.ts
git commit -m "feat(site): Full bleed and Classic faces, light/dark watch palette"
```

---

### Task 5: The movement view

**Files:** Create `Site/src/watch/movement-view.ts`. Modify `Site/src/styles/components.css`. Test: `Site/tests/dom/movement-view.test.ts`.

**Interfaces:**
- Consumes `geometry`, `WatchState`, `STRINGS` and `Lang`.
- Produces:

```ts
export interface MovementView {
  readonly root: SVGSVGElement;
  render(state: WatchState): void;
  rerender(): void;              // language change: part labels / captions
  destroy(): void;
}
export function createMovementView(mount: HTMLElement, getLang: () => Lang): MovementView;
export const MOVEMENT_MODULE = 1.22;
```

**Layout**, in a 280-unit viewBox centred on C = (140, 140), main plate radius 136. Positions come from `meshDistance` and `polar`, exactly these:

```ts
const C = { x: 140, y: 140 };
const B = polar(C, meshDistance(M, 96, 12), 312);    // barrel ↔ centre pinion
const T = polar(C, meshDistance(M, 80, 10), 88);     // centre wheel ↔ third pinion
const F = polar(T, meshDistance(M, 75, 10), 196);    // third wheel ↔ fourth pinion
const E = polar(F, meshDistance(M, 80, 5), 260);     // fourth wheel ↔ escape pinion
const P = polar(E, 24, 240);                         // pallet staff
const BAL = polar(P, 40, 300);                        // balance staff
```

These were checked in the mockup: every part sits inside the plate, and the balance (radius 30) clears the barrel and the centre wheel.

**Parts**, each a `<g class="mv-part" tabindex="0" data-part="<key>" aria-label="<STRINGS part text>">`:

| key | contents |
|---|---|
| `barrel` | `gearPath(B, M, 96)`, a drum disc, and an arbor square |
| `centre` | `gearPath(C, M, 80)`, crossings, and pinion `gearPath(C, M, 12)` |
| `third` | `gearPath(T, M, 75)`, crossings, and pinion 10 |
| `fourth` | `gearPath(F, M, 80)`, crossings, and pinion 10 |
| `escape` | `escapeWheelPath(E, 13)` and pinion 5 |
| `pallet` | the anchor with two jewel stones and the fork towards the balance |
| `balance` | rim radius 30, three spokes, 8 timing screws, and the roller jewel |

The hairspring is a separate `<path class="mv-spring">` that is not rotated; it is re-pathed every frame with `spiralPath(BAL, 10, 2, 21 + sin(balance)·1.8, balance·0.9 rad)`.

**Finishing:**
- The main plate is filled with a `<pattern>` for perlage: a 9 × 9 circle using `var(--w-plate)` / `var(--w-plate-dot)` via `style`.
- The bridges are slim round-capped strokes, `var(--w-bridge)` with an edge colour, carrying a striped pattern for the Côtes de Genève. They run as the barrel bridge, the train bridge (Th → F → E) and the balance cock.
- Jewels (`var(--w-jewel)`) sit at every pivot, with blued screws (`var(--w-spring)`) at the bridge ends.

**Labels:**
- At ≥ 1024 px, `<text class="mv-label">` elements next to each part are visible through CSS. Below that, they are `display: none`.
- On tap, click or focus of a part on narrow screens, a caption `<text class="mv-caption">` at the bottom shows that part's string, and it clears after 4 s or on tap elsewhere.

**Colours:** classes and `var(--w-*)` only, with no colour attributes, the same rule as Task 4.

**Rendering:** `render(state)` rotates each part about its own centre, with the pinions together with their wheels:
- barrel by `state.barrel`, centre by `state.centre`, third by `state.third` and fourth by `state.fourth`;
- escape by `state.escape`;
- pallet by `state.pallet` about P;
- balance by `state.balance` about BAL, and the hairspring is re-pathed.

- [ ] **Step 1: Write the failing DOM test**

```ts
// Site/tests/dom/movement-view.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '../../src/i18n/strings';
import { createMovementView } from '../../src/watch/movement-view';
import { BEAT_MS, watchState } from '../../src/watch/movement-model';

let mount: HTMLElement; let lang: Lang;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; lang = 'en'; });
const part = (v: ReturnType<typeof createMovementView>, k: string) => v.root.querySelector(`[data-part="${k}"]`) as SVGGElement;
const angle = (g: Element) => Number(/rotate\((-?[\d.e-]+)/.exec(g.getAttribute('transform') ?? '')?.[1]);

describe('movement view', () => {
  it('builds the seven parts of a Swiss-lever train, each named', () => {
    const v = createMovementView(mount, () => lang);
    expect([...v.root.querySelectorAll('.mv-part')].map((g) => g.getAttribute('data-part')))
      .toEqual(['barrel', 'centre', 'third', 'fourth', 'escape', 'pallet', 'balance']);
    expect(part(v, 'balance').getAttribute('aria-label')).toBe('Balance · 4 Hz');
  });

  it('turns every part from the state, about its own staff', () => {
    const v = createMovementView(mount, () => lang);
    const s = watchState(3_725_000 + BEAT_MS * 3, false);
    v.render(s);
    expect(angle(part(v, 'centre'))).toBeCloseTo(s.centre);
    expect(angle(part(v, 'escape'))).toBeCloseTo(s.escape);
    expect(angle(part(v, 'balance'))).toBeCloseTo(s.balance);
    expect(part(v, 'centre').getAttribute('transform')).toMatch(/ 140 140\)$/);
  });

  it('breathes the hairspring with the balance', () => {
    const v = createMovementView(mount, () => lang);
    const spring = v.root.querySelector('.mv-spring')!;
    v.render(watchState(0, false));
    const rest = spring.getAttribute('d');
    v.render(watchState(BEAT_MS / 2, false));
    expect(spring.getAttribute('d')).not.toBe(rest);
  });

  it('sets no colours as attributes', () => {
    const v = createMovementView(mount, () => lang);
    for (const node of v.root.querySelectorAll('*')) for (const attr of ['fill', 'stroke']) {
      const val = node.getAttribute(attr);
      if (val !== null) expect(val).toMatch(/^(none|url\(#.+\)|var\(--w-[a-z0-9-]+\))$/);
    }
  });

  it('captions a part on tap and clears it after 4 s; re-labels in Persian', () => {
    vi.useFakeTimers();
    try {
      const v = createMovementView(mount, () => lang);
      part(v, 'escape').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(v.root.querySelector('.mv-caption')!.textContent).toBe('Escape wheel · 16 turns a minute');
      vi.advanceTimersByTime(4_000);
      expect(v.root.querySelector('.mv-caption')!.textContent).toBe('');
      lang = 'fa';
      v.rerender();
      expect(part(v, 'balance').getAttribute('aria-label')).toBe('چرخ تعادل · ۴ هرتز');
    } finally { vi.useRealTimers(); }
  });

  it('captions a part on keyboard focus too', () => {
    const v = createMovementView(mount, () => lang);
    part(v, 'barrel').dispatchEvent(new FocusEvent('focus'));
    expect(v.root.querySelector('.mv-caption')!.textContent).toBe('Barrel · 1 turn in 8 hours');
  });

  it('destroy removes it', () => {
    createMovementView(mount, () => lang).destroy();
    expect(mount.children).toHaveLength(0);
  });
});
```

Run `npx vitest run tests/dom/movement-view.test.ts`. It should FAIL.

- [ ] **Step 2: Implement** to the description and tests above, with CSS in `components.css` (`.mv-*` classes, the label visibility media query, and the caption style). Keep the file under ~300 lines, and split out a `movement-parts.ts` builder if it grows past that.

- [ ] **Step 3: Run all tests, coverage, tsc**

Run `npx vitest run --coverage && npx tsc --noEmit`. All must pass with coverage at 100%.

- [ ] **Step 4: Commit**

```bash
git status --short
git add Site/src/watch/movement-view.ts Site/src/styles/components.css Site/tests/dom/movement-view.test.ts
git commit -m "feat(site): the movement — a geared Swiss-lever train with finishing and part names"
```

---

### Task 6: Driver, toggle, layout and wiring (replaces clock.ts)

**Files:**
- Create `Site/src/watch/watch.ts` and `Site/tests/dom/watch.test.ts`.
- Delete `Site/src/clock/clock.ts`.
- Modify `Site/index.html`, `Site/src/main.ts`, `Site/src/styles/components.css`, `Site/src/styles/base.css`, `Site/vite.config.ts` (remove the `'src/clock/**'` coverage exclusion and its comment), and `Site/e2e/site.spec.ts`.
- Create `Site/e2e/watch.spec.ts`.

**Interfaces:**
- Consumes the faces, the movement view, the model, `FaceId`, `STRINGS`, `formatTemplate` and `toLocaleDigits`.
- Produces:

```ts
export interface WatchOptions {
  readonly now: () => Date;
  readonly onTick?: (date: Date) => void;   // called on every rendered frame (main.ts's minute gate)
  readonly getFace: () => FaceId;
  readonly getLang: () => Lang;
}
export interface Watch {
  setFace(face: FaceId): void;
  setMovementOpen(open: boolean): void;
  rerender(): void;                          // language change: label, button text, movement labels
  destroy(): void;
}
export function createWatch(section: HTMLElement, options: WatchOptions): Watch;
```

**Markup.** `<main>` children become:

```html
    <div id="watch-column">
      <section id="clock-section" aria-label="Clock">
        <div id="watch-box">
          <div id="clock-mount"></div>
          <div id="movement-mount" hidden></div>
          <p id="watch-digital" hidden></p>
        </div>
        <button id="movement-toggle" type="button" aria-pressed="false"></button>
      </section>
      <section id="today" aria-label="Today"> … unchanged … </section>
    </div>
    <div id="content-column">
      <section id="converter" …> … unchanged … </section>
      <section id="calendars" …> … unchanged … </section>
    </div>
```

**Driver behaviour:**
- **Faces:** creates the face from `getFace()` into `#clock-mount`. `setFace` destroys and recreates it. Switching to Classic closes the movement and hides the toggle (`hidden`); Full bleed shows it.
- **Labels:** the face root gets `role="img"` and an `aria-label` from `formatTemplate(STRINGS[lang].watchLabel, { time: hhmm(now) }, lang)`, updated when the minute changes and on `rerender()`.
- **Toggle:** clicking it calls `setMovementOpen(!open)`.
  - **Opening:** creates the movement view into `#movement-mount` if absent, unhides it and `#watch-digital`, and adds class `is-movement` to `#watch-box` (CSS runs the transition).
  - **Closing:** removes the class, and after `transitionend` (or at once under reduced motion) destroys the movement view and hides the mount.
  - **Both:** set `aria-pressed` and the button text (`showMovement` / `showTime`), and keep focus on the button.
- **`#watch-digital`:** shows `hhmm(now)` while open, in Latin digits.
- **Loop:**
  - With `prefers-reduced-motion: reduce`, use `setInterval(render, 1000)` with `reduced = true` in `watchState`.
  - Otherwise use rAF, where each frame computes `state = watchState(msSinceLocalMidnight(now()), false)`. With the movement closed and `state.beat` equal to the last rendered beat, skip the frame. Otherwise render the face (and the movement if open), call `onTick(date)`, and remember the beat.
  - Change of the reduced-motion media query restarts the loop.
- **Visibility:** hidden stops everything; visible restarts and renders at once (the same as `clock.ts`).
- **`destroy()`:** removes listeners, stops the loop and destroys the face and movement.

**Layout CSS:**
- **`#watch-box`:** `position: relative; width: min(92vw, 62vh); aspect-ratio: 1`. `#clock-mount` and `#movement-mount` are absolutely stacked, filling the box. The SVGs are `width: 100%; height: 100%`.
- **Transition:**
  - `#watch-box .clock`: transition `opacity .9s var(--ease)` and `transform .9s var(--ease)`.
  - `#watch-box.is-movement .clock`: `opacity: 0; transform: scale(1.08); pointer-events: none`.
  - `#movement-mount svg`: `opacity: 0; transform: scale(.96)`, with the same transition.
  - `#watch-box.is-movement #movement-mount svg`: `opacity: 1; transform: none`.
  - Reduced motion is already handled globally in `base.css`.
- **Supporting elements:**
  - `#watch-digital`: large Latin `HH:MM` (`font: 800 clamp(2rem, 1.4rem + 2vw, 3rem) var(--font-ui); font-feature-settings: "lnum"`), centred.
  - `#movement-toggle`: a pill, styled like `#set-time-test`.
- **Landscape phone (`max-height: 480px`):** `#watch-box { width: min(60vh, 92vw) }`.
- **Wide screens (`min-width: 1024px`):**
  - `main` widens to `max-width: 80rem` and becomes `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start`.
  - `#watch-column`: `position: sticky; top: 0; height: 100dvh; display: grid; place-content: center; gap: 1.5rem`.
  - `#watch-box`: `width: min(40vw, 72vh)`.
  - `#content-column`: `display: grid; gap: var(--space-section); padding-block-start: var(--space-section)`.
  - The old `.clock` size rules in `components.css` (lines ~241-250) are removed, and the new box rules replace them.
- **Phones:** `#watch-column` and `#content-column` are `display: contents`, so the order and spacing stay as today.

**`main.ts`:** replace `createClock(...)` with

```ts
const watch = createWatch(document.getElementById('clock-section')!, {
  now: time.now, onTick: refreshToday, getFace: () => settings.get().watch.face, getLang: () => lang,
});
settings.subscribe((s) => { watch.setFace(s.watch.face); });
```

(`setFace` must be a no-op when the face is unchanged.) Also add `watch.rerender()` to `renderAll`.

- [ ] **Step 1: Write the failing DOM test** (fake rAF and timers)

```ts
// Site/tests/dom/watch.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { FaceId } from '../../src/watch/face';
import { createWatch, type Watch } from '../../src/watch/watch';
import { setMediaMatches, clickOn } from './dom-helpers';

const BODY = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
let frames: FrameRequestCallback[]; let now: Date; let face: FaceId; let lang: Lang; let watch: Watch | undefined;
let hidden = false;
const runFrame = () => { const f = frames; frames = []; for (const cb of f) cb(0); };
const second = () => document.querySelector('#hand-second')!.getAttribute('transform');

beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  setMediaMatches(false);
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.body.innerHTML = BODY;
  now = new Date(2026, 9, 15, 10, 30, 0, 0); face = 'fullbleed'; lang = 'en';
});
afterEach(() => { watch?.destroy(); watch = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

const make = (onTick = vi.fn()) => {
  watch = createWatch(document.getElementById('clock-section')!, { now: () => now, onTick, getFace: () => face, getLang: () => lang });
  return onTick;
};

describe('watch driver', () => {
  it('draws the chosen face with an accessible time', () => {
    make();
    expect(document.querySelector('.clock.watch-face--fullbleed')).not.toBeNull();
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:30');
  });

  it('renders only when the beat changes while the dial shows', () => {
    const onTick = make();
    onTick.mockClear();
    runFrame(); runFrame();                       // same instant: nothing to draw
    expect(onTick).not.toHaveBeenCalled();
    now = new Date(now.getTime() + 125);
    runFrame();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('renders every frame while the movement shows', () => {
    const onTick = make();
    clickOn(document.getElementById('movement-toggle')!);
    onTick.mockClear();
    runFrame(); runFrame();
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('builds the movement on open and removes it on close, keeping focus on the toggle', () => {
    make();
    const toggle = document.getElementById('movement-toggle') as HTMLButtonElement;
    toggle.focus();
    clickOn(toggle);
    expect(document.querySelector('#movement-mount svg')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toBe('Show time');
    expect(document.getElementById('watch-digital')!.textContent).toBe('10:30');
    clickOn(toggle);
    document.getElementById('watch-box')!.dispatchEvent(new Event('transitionend'));
    expect(document.querySelector('#movement-mount svg')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('switching to Classic closes the movement and hides the toggle', () => {
    make();
    clickOn(document.getElementById('movement-toggle')!);
    face = 'classic';
    watch!.setFace('classic');
    expect(document.querySelector('.clock.watch-face--classic')).not.toBeNull();
    expect(document.querySelector('#movement-mount svg')).toBeNull();
    expect((document.getElementById('movement-toggle') as HTMLElement).hidden).toBe(true);
  });

  it('stops while hidden and draws the current time at once on return, movement included', () => {
    make();
    clickOn(document.getElementById('movement-toggle')!);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(frames).toHaveLength(0);
    now = new Date(2026, 9, 15, 14, 0, 0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('#hand-minute')!.getAttribute('transform')).toBe('rotate(0 100 100)');
    expect(document.getElementById('watch-digital')!.textContent).toBe('14:00');
  });

  it('steps once a second under reduced motion', () => {
    setMediaMatches(true);
    make();
    const before = second();
    now = new Date(now.getTime() + 1000);
    vi.advanceTimersByTime(1000);
    expect(second()).not.toBe(before);
    expect(frames).toHaveLength(0);
  });

  it('re-labels in Persian with Persian digits in the label, Latin on the dial', () => {
    make();
    lang = 'fa';
    watch!.rerender();
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('ساعت، ۱۰:۳۰');
    expect([...document.querySelectorAll('.wf-num')].map((t) => t.textContent)).toEqual(['12', '3', '6', '9']);
    expect(document.getElementById('movement-toggle')!.textContent).toBe('نمایش موتور');
  });

  it('setFace with the same face changes nothing', () => {
    make();
    const root = document.querySelector('.clock');
    watch!.setFace('fullbleed');
    expect(document.querySelector('.clock')).toBe(root);
  });
});
```

Run `npx vitest run tests/dom/watch.test.ts`. It should FAIL.

- [ ] **Step 2: Implement** `watch.ts`, the markup, the CSS and the `main.ts` wiring. Then delete `src/clock/` and remove the coverage exclusion.

- [ ] **Step 3: Update `e2e/site.spec.ts`** for the new design. These are deliberate expectation changes (Decision 5):
- `'landscape phone: clock shrinks …'` (844 × 390): `.clock` height ≤ 0.65 × 390, and `#today-persian` is in the viewport after `scrollIntoViewIfNeeded` with the watch still partly visible. Keep the screenshot.
- `'tablet clock is larger than phone clock'` (820 × 1180): `.clock` height ≥ 400.
- `'desktop stays pixel-identical regardless of short viewport height'` (1440 × 900): replace `toBe(210)` with "`.clock` width ≥ 500 and its centre x < 720 (left half)". Keep the `#p-y` checks.
- `'clock hands are driven'` and `'reduced motion …'` keep working unchanged, through `#hand-second` and `rotate(x 100 100)`.

- [ ] **Step 4: Write `e2e/watch.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

const angle = async (page: import('@playwright/test').Page, sel: string) =>
  Number(/rotate\((-?[\d.e-]+)/.exec((await page.locator(sel).getAttribute('transform')) ?? '')?.[1]);

test('Full bleed is the default; Classic can be chosen and survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.clock.watch-face--fullbleed')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-watch-face').selectOption('classic');
  await page.keyboard.press('Escape');
  await expect(page.locator('.clock.watch-face--classic')).toBeVisible();
  await expect(page.locator('#movement-toggle')).toBeHidden();
  await page.reload();
  await expect(page.locator('.clock.watch-face--classic')).toBeVisible();
});

test('Show movement reveals a train geared to the hands; Show time returns', async ({ page }) => {
  await page.goto('/');
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount svg')).toBeVisible();
  await expect(page.locator('#movement-toggle')).toHaveText('Show time');
  await expect(page.locator('#watch-digital')).toHaveText(/^\d\d:\d\d$/);
  // the centre wheel turns with the minute hand (within one beat)
  const minute = await angle(page, '#hand-minute');
  const centre = await angle(page, '#movement-mount [data-part="centre"]');
  expect(Math.abs((((centre - minute) % 360) + 360) % 360)).toBeLessThan(1);
  // the balance is actually swinging
  const a = await angle(page, '#movement-mount [data-part="balance"]');
  await page.waitForTimeout(60);
  expect(await angle(page, '#movement-mount [data-part="balance"]')).not.toBe(a);
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount svg')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('#movement-toggle')).toBeFocused();
});

test('reduced motion: the movement shows but the balance stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount [data-part="balance"]')).toHaveAttribute('transform', /^rotate\(0 /);
});

test('light and dark: the dial follows the system scheme, live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const fill = () => page.locator('.wf-num').first().evaluate((el) => getComputedStyle(el).fill);
  const light = await fill();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(fill).not.toBe(light);
});

test('Persian page: Latin digits on the dial, Persian label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'fa'));
  await page.goto('/');
  await expect(page.locator('.wf-num')).toHaveText(['12', '3', '6', '9']);
  await expect(page.locator('.clock')).toHaveAttribute('aria-label', /^ساعت، [۰-۹]{2}:[۰-۹]{2}$/);
  await expect(page.locator('#movement-toggle')).toHaveText('نمایش موتور');
});

test('wide screens: the watch is a sticky left half; phones stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const box = await page.locator('.clock').boundingBox();
  expect(box!.x + box!.width / 2).toBeLessThan(720);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  const after = await page.locator('.clock').boundingBox();
  expect(after!.y).toBeCloseTo(box!.y, 0);
  await page.setViewportSize({ width: 400, height: 860 });
  await page.reload();
  const phone = await page.locator('.clock').boundingBox();
  expect(phone!.width).toBeGreaterThan(340);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const [w, h] of [[400, 860], [1440, 900]] as const) {
    for (const view of ['dial', 'movement'] as const) {
      test(`screenshot watch ${scheme} ${w} ${view}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        if (view === 'movement') { await page.locator('#movement-toggle').click(); await page.waitForTimeout(1100); }
        await page.locator('#clock-section').screenshot({ path: `test-results/screens/watch-${scheme}-${w}-${view}.png` });
      });
    }
  }
}
```

- [ ] **Step 5: Run everything**

```bash
npx vitest run --coverage && npx tsc --noEmit
lsof -i :4173 -sTCP:LISTEN     # must print nothing
npm run build && npx playwright test
```

All must pass, including the existing midnight-turnover, time-sync, calendar and settings specs, and the desktop above-the-fold test. Look at the `watch-*.png` screenshots and list them in the report with what you saw.

- [ ] **Step 6: Commit**

```bash
git status --short
git add -A Site/src/watch Site/src/clock Site/index.html Site/src/main.ts Site/src/styles Site/vite.config.ts Site/tests/dom/watch.test.ts Site/e2e/watch.spec.ts Site/e2e/site.spec.ts
git commit -m "feat(site): the watch — Full bleed by default, Show movement, sticky on wide screens"
```

---

### Task 7: Docs

**Files:** Modify `README.md` and `docs/SECURITY.md`.

- [ ] **Step 1: README.md**
- **"Design and behaviour notes":** replace the clock bullet with a **Watch** bullet covering:
  - Full bleed (default), and Classic;
  - Latin digits on the dial, and light/dark following the system;
  - the seconds ticking at 4 Hz;
  - **Show movement**, with the train table (barrel / centre 1 per hour / third / fourth 1 per minute / escape 16 per minute / pallet / balance 4 Hz), the derivation from the escapement, part names on tap and labels on wide screens, and building only while open;
  - the battery behaviour (about 8 fps with the dial, full rate only with the movement open, stopped when hidden), and reduced motion;
  - the layout (full width on phones, a sticky left half from 1024 px).
- **Settings:** the Watch group.
- **Repo layout:** replace `clock/` with `watch/` (geometry, movement-model, face, full-bleed, classic, movement-view, watch, watch-settings).
- **Testing:** real test counts, coverage totals and bundle sizes from this run. Mention `e2e/watch.spec.ts` and the `watch-*` screenshots.
- **Coverage text:** `src/clock/**` is no longer excluded.

- [ ] **Step 2: docs/SECURITY.md:** `settings.v1` also holds the watch face (a preference, not personal data). Update the test counts.

- [ ] **Step 3: Check the claims** with `grep -n "watch\|clock" README.md docs/SECURITY.md`, against the code.

- [ ] **Step 4: Commit**

```bash
git status --short
git add README.md docs/SECURITY.md
git commit -m "docs: the watch — faces, movement, layout"
```

---

## After the tasks (controller)

1. Final whole-branch review, then one fix wave.
2. Docker image, then Chrome against the container:
   - both faces;
   - Show movement and Show time;
   - light and dark (System settings, or DevTools emulation);
   - phone width and desktop width (sticky);
   - Persian;
   - screenshots.
3. Push, CI and the deploy, then a live check in Chrome.
4. Ask the user to look at it on the iPhone: readability at arm's length, battery over a day, and the midnight turnover.

## Not in this plan

- Sound, tilt parallax, further complications (moon phase etc.), and the Discs and Retrograde faces: out of scope per the spec.
- A manual light/dark override: the app deliberately follows the system only (README).

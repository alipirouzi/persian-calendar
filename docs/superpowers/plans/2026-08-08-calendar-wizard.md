# Calendar Wizard, Hug-Content, and the SOLID Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A year → month → day drill-down in the calendar, a grid that hugs its rows, and the architecture underneath both: one reusable popup, one pure grid-navigation function, and one view strategy per mode.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (chromium, port 4173).

## Why the refactor is part of this, not separate

Adding a third view to `calendar-grid.ts` as it stands would mean a `switch (mode)`
in the renderer, another in the key handler, and another in the paging code —
three places to touch for every future view. And `calendar-grid.ts` already
duplicates `number-picker.ts`: open/close, `aria-expanded`, outside-pointerdown
dismissal, focusout dismissal, focus-return-to-invoker, side choice and height
cap exist twice, in two subtly different versions. Every defect the last two
review rounds found in the calendar was a rule the picker already had right.

So this change extracts what is genuinely shared and models what genuinely varies:

| Module | Responsibility | Principle |
|---|---|---|
| `ui/popup.ts` | Open/close, ARIA, dismissal, focus return, side + height cap | SRP; DRY across picker and calendar |
| `ui/grid-navigation.ts` | Pure key → intent mapping for any N-column grid | SRP; reused at 1, 3 and 7 columns |
| `converter/calendar-views.ts` | One strategy per view: cells, title, paging, selection | Strategy; OCP — a new view is a new entry |
| `ui/calendar-grid.ts` | Render a `RenderedView` into DOM; wire the other three | DIP — depends on the `CalendarView` interface |

## Global Constraints

- **No new *runtime* dependencies.** The shipped bundle stays framework-free.
  Task 1 adds two **dev-only** packages, which is the documented exception: 100%
  coverage cannot be measured without a coverage provider, and DOM units cannot
  be unit-tested without a DOM environment. Neither reaches `dist/`.
- Every visible string comes from `src/i18n/strings.ts`.
- Values are ASCII integers; only display text is localized.
- **Do not touch** `Lib/`, `Console/`, `Tests/` (C#), `Site/sw.js`, `deploy/`.
- All `npm` commands run in `Site/`.
- **Only one agent may run Playwright at a time** (port 4173 is `--strictPort`).
- **Playwright serves `dist/`** — always `npm run build` before `npx playwright test`.
- Commit exactly your task's files. Never push. Retry `git commit` on `index.lock`.

### Verified ground truth

- Persian 1200–1500 (301 years); Gregorian 1822–2121 (300 years).
- Row distribution over 20 years each: 5 rows ≈ 79%, 6 rows ≈ 21%, Gregorian February can need 4.
- `daysInPersianMonth(1403,12)`=30 (leap), `(1404,12)`=29, `(1403,10)`=30, `(1403,1)`=31.
- `toGregorian({py:1403,pm:10,pd:1})` = `{gy:2024,gm:12,gd:21}`, a Saturday.
- Dey 1403 lays out in exactly 5 rows; Farvardin 1403 needs 6.

### Shared contract

| Item | Value |
|---|---|
| View modes | `'days' \| 'months' \| 'years'` |
| Page size | 12, laid out **3 columns × 4 rows** (months and years) |
| Title element | `#<p\|g>-cal-title` is a `<button class="cal-title">` |
| Title behaviour | Always goes to **years**. Disabled while already there. |
| Drill down | year → months → days; a day picks, as today |
| Prev/next step | days ±1 month, months ±1 year, years ±12 |
| Wide-grid class | `cal-grid--wide` on the grid in months and years views |
| Cell ids | `<grid.id>-d<day>`, `-m<month>`, `-y<year>` |
| Cell classes | `.cal-cell`, `.cal-cell.active`, `.cal-cell.cursor`, `.cal-blank` |

**Phases:** T1 alone. Then T2–T5 in parallel. Then T6 and T7 in parallel. Then T8. Then T9. Then T10.

---

## Task 1: Test infrastructure — coverage and a DOM environment

**Files:** `Site/package.json`, `Site/vite.config.ts`

- [ ] **Step 1: Add the dev-only packages**

```bash
cd Site && npm install -D @vitest/coverage-v8 jsdom
```

Confirm they landed in `devDependencies`, not `dependencies`.

- [ ] **Step 2: Configure vitest** — in `Site/vite.config.ts`, replace the `test` block:

```typescript
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Only the files that need a DOM pay for one; everything else stays on the
    // node environment, which is markedly faster.
    environmentMatchGlobs: [['tests/dom/**/*.test.ts', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      // main.ts is the bootstrap — it wires modules together and is covered by
      // the Playwright suite end to end; clock rendering is likewise visual and
      // screenshot-tested. Neither has unit-testable logic of its own.
      exclude: ['src/main.ts', 'src/clock/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
```

- [ ] **Step 3: Add a coverage script** to `Site/package.json`:

```json
    "test:coverage": "vitest run --coverage",
```

- [ ] **Step 4: Baseline** — `cd Site && npm run test:coverage`.

It will FAIL the thresholds. That is expected and is the point: record the
starting percentages for each metric in your report so Task 10 can show movement.

- [ ] **Step 5: Commit**

```bash
git add Site/package.json Site/package-lock.json Site/vite.config.ts
git commit -m "test(site): coverage provider, jsdom environment, 100% thresholds"
```

---

## Task 2: `grid-navigation.ts` — pure key handling (parallel)

**Files:** Create `Site/src/ui/grid-navigation.ts`; create `Site/tests/grid-navigation.test.ts`

**Interfaces produced** (Tasks 7 and 8 depend on these exact names):

```typescript
export interface GridShape {
  /** 1 for a list, 3 for a month or year page, 7 for a day grid. */
  columns: number;
  count: number;
  rtl: boolean;
}
export type GridIntent =
  | { kind: 'move'; index: number }
  | { kind: 'page'; delta: -1 | 1 }
  | { kind: 'select' }
  | { kind: 'dismiss' }
  | { kind: 'open' }
  | null;
export function gridIntent(key: string, index: number, shape: GridShape, isOpen: boolean): GridIntent;
```

- [ ] **Step 1: Write the failing tests** — create `Site/tests/grid-navigation.test.ts` covering, at minimum:
  - `ArrowRight`/`ArrowLeft` move ±1 at 7, 3 and 1 columns, and **mirror when `rtl` is true**.
  - `ArrowDown`/`ArrowUp` move ±`columns`.
  - Moves clamp inside `[0, count-1]` and return `null` rather than an out-of-range index.
  - `Home`/`End` go to the first and last cell **of the current row** (index - index%columns, and that + columns - 1 clamped to count-1).
  - `PageUp`/`PageDown` return `{kind:'page', delta:-1|1}`.
  - `Enter` and `' '` return `{kind:'select'}` when open.
  - `Escape` returns `{kind:'dismiss'}` when open.
  - When `isOpen` is false, `ArrowDown`/`ArrowUp` return `{kind:'open'}` and everything else returns `null`.
  - Any unhandled key returns `null`.
  - `count === 0` never throws and always returns `null` for moves.

Write one assertion per branch — this module is the reference for the 100%
threshold and must reach it on its own.

- [ ] **Step 2: Run to verify failure**, then implement, then run again. Standard red-green.

- [ ] **Step 3: Confirm this file is at 100%** — `cd Site && npm run test:coverage`
and check `src/ui/grid-navigation.ts` shows 100% on all four metrics. Other files
will still be below threshold; that is fine at this stage.

- [ ] **Step 4: Commit**

```bash
git add Site/src/ui/grid-navigation.ts Site/tests/grid-navigation.test.ts
git commit -m "feat(site): pure grid key-intent mapping reusable at any column count"
```

---

## Task 3: Year and month pages in the model (parallel)

**Files:** Modify `Site/src/converter/calendar-grid-model.ts`; modify `Site/tests/calendar-grid-model.test.ts`

**Interfaces produced:**

```typescript
export interface GridPage<T> {
  cells: readonly (readonly (T | null)[])[];   // 4 rows x 3 columns
  title: string;
  canGoPrev: boolean;
  canGoNext: boolean;
}
export interface MonthCell { value: number; label: string }
export function yearPageStart(side: Side, year: number): number;
export function buildYearPage(side: Side, year: number, lang: Lang): GridPage<number>;
export function buildMonthPage(side: Side, year: number, lang: Lang): GridPage<MonthCell>;
export function stepYearPage(side: Side, pageStart: number, delta: number): number | null;
export function stepYear(side: Side, year: number, delta: number): number | null;
```

- [ ] **Step 1: Write the failing tests** — append to `Site/tests/calendar-grid-model.test.ts`:

```typescript
describe('year pages', () => {
  it('aligns pages to the start of the supported range', () => {
    expect(yearPageStart('persian', 1200)).toBe(1200);
    expect(yearPageStart('persian', 1211)).toBe(1200);
    expect(yearPageStart('persian', 1212)).toBe(1212);
    expect(yearPageStart('persian', 1403)).toBe(1392);
  });
  it('lays 12 years out in 4 rows of 3', () => {
    const page = buildYearPage('persian', 1403, 'en');
    expect(page.cells).toHaveLength(4);
    for (const row of page.cells) expect(row).toHaveLength(3);
    expect(page.cells.flat()).toEqual([
      1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403,
    ]);
    expect(page.title).toBe('1392 – 1403');
  });
  it('pads the final short page with nulls', () => {
    const page = buildYearPage('persian', 1500, 'en');
    expect(page.cells.flat().filter((y) => y !== null)).toEqual([1500]);
    expect(page.title).toBe('1500 – 1500');
    expect(page.canGoNext).toBe(false);
    expect(page.canGoPrev).toBe(true);
  });
  it('localizes the range title', () => {
    expect(buildYearPage('persian', 1403, 'fa').title).toBe('۱۳۹۲ – ۱۴۰۳');
  });
  it('stops paging at the range bounds', () => {
    expect(stepYearPage('persian', 1200, -1)).toBeNull();
    expect(stepYearPage('persian', 1200, 1)).toBe(1212);
    expect(buildYearPage('persian', 1200, 'en').canGoPrev).toBe(false);
    expect(buildYearPage('gregorian', 1822, 'en').canGoPrev).toBe(false);
  });
});

describe('month pages', () => {
  it('lays 12 months out in 4 rows of 3 with localized names', () => {
    const page = buildMonthPage('persian', 1403, 'en');
    expect(page.cells).toHaveLength(4);
    expect(page.cells.flat()[0]).toEqual({ value: 1, label: 'Farvardin' });
    expect(page.cells.flat()[11]).toEqual({ value: 12, label: 'Esfand' });
    expect(page.title).toBe('1403');
  });
  it('uses the other calendar and language', () => {
    const page = buildMonthPage('gregorian', 2026, 'fa');
    expect(page.cells.flat()[7]).toEqual({ value: 8, label: 'اوت' });
    expect(page.title).toBe('۲۰۲۶');
  });
  it('steps years within the range', () => {
    expect(stepYear('persian', 1403, 1)).toBe(1404);
    expect(stepYear('persian', 1500, 1)).toBeNull();
    expect(stepYear('gregorian', 1822, -1)).toBeNull();
    expect(buildMonthPage('persian', 1500, 'en').canGoNext).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd Site && npx vitest run tests/calendar-grid-model.test.ts`.

- [ ] **Step 3: Implement** — append to `Site/src/converter/calendar-grid-model.ts`:

```typescript
/** Years and months both page 12 at a time, in 4 rows of 3. */
const PAGE_SIZE = 12;
const PAGE_COLUMNS = 3;

export interface GridPage<T> {
  /** 4 rows x 3 columns; null pads a short final page. */
  cells: readonly (readonly (T | null)[])[];
  title: string;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export interface MonthCell { value: number; label: string }

function chunk<T>(items: readonly (T | null)[]): readonly (readonly (T | null)[])[] {
  return Array.from(
    { length: items.length / PAGE_COLUMNS },
    (_, row) => items.slice(row * PAGE_COLUMNS, (row + 1) * PAGE_COLUMNS),
  );
}

/** First year of the page `year` sits on, aligned to the range's own start. */
export function yearPageStart(side: Side, year: number): number {
  const [min] = yearBounds(side);
  return min + Math.floor((year - min) / PAGE_SIZE) * PAGE_SIZE;
}

export function stepYearPage(side: Side, pageStart: number, delta: number): number | null {
  const [min, max] = yearBounds(side);
  const next = pageStart + delta * PAGE_SIZE;
  return next < min || next > max ? null : next;
}

export function stepYear(side: Side, year: number, delta: number): number | null {
  const [min, max] = yearBounds(side);
  const next = year + delta;
  return next < min || next > max ? null : next;
}

export function buildYearPage(side: Side, year: number, lang: Lang): GridPage<number> {
  const [, max] = yearBounds(side);
  const start = yearPageStart(side, year);
  const last = Math.min(start + PAGE_SIZE - 1, max);
  const cells: (number | null)[] = Array.from({ length: PAGE_SIZE }, (_, i) => {
    const candidate = start + i;
    return candidate > max ? null : candidate;
  });
  return {
    cells: chunk(cells),
    title: `${toLocaleDigits(start, lang)} – ${toLocaleDigits(last, lang)}`,
    canGoPrev: stepYearPage(side, start, -1) !== null,
    canGoNext: stepYearPage(side, start, 1) !== null,
  };
}

export function buildMonthPage(side: Side, year: number, lang: Lang): GridPage<MonthCell> {
  const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  const cells: (MonthCell | null)[] = names.map((label, i) => ({ value: i + 1, label }));
  return {
    cells: chunk(cells),
    title: toLocaleDigits(year, lang),
    canGoPrev: stepYear(side, year, -1) !== null,
    canGoNext: stepYear(side, year, 1) !== null,
  };
}
```

- [ ] **Step 4: Run the full Vitest suite**, then **Step 5: Commit**

```bash
git add Site/src/converter/calendar-grid-model.ts Site/tests/calendar-grid-model.test.ts
git commit -m "feat(site): year and month page models for the calendar wizard"
```

---

## Task 4: Styles — hug the content, and the wizard views (parallel)

**Files:** Modify `Site/src/styles/components.css`

- [ ] **Step 1: Stop reserving a sixth row.** In `.cal-grid`, delete
`min-block-size: calc(6 * 2rem + 5 * 2px + 1.6rem);` and replace its comment with:

```css
  /* Hugs its rows: ~79% of months need five, so reserving six left a dead band
     in the common case to smooth a transition that happens in the other ~21%. */
```

In the touch media block, delete the now-redundant `min-block-size: auto;`.

- [ ] **Step 2: Add the wide grid and the title button.** After `.cal-blank`:

```css
/* Months and years page 12 at a time in 3 columns, keeping the same total width
   as the 7-column day grid so the popup does not resize between views. */
.cal-grid--wide { grid-template-columns: repeat(3, calc((7 * 2rem + 4 * 2px) / 3)); }
.cal-grid--wide .cal-cell { block-size: 2.4rem; font-size: 0.85rem; }

.cal-title {
  background: none; border: 0; padding: 0.15rem 0.4rem; border-radius: 4px;
  font: inherit; color: inherit; cursor: pointer;
  transition: color var(--duration) var(--ease), background var(--duration) var(--ease);
}
.cal-title:hover:not(:disabled) { color: var(--accent); background: var(--hairline); }
.cal-title:disabled { cursor: default; }
```

In the touch media block:

```css
  .cal-grid--wide { grid-template-columns: repeat(3, calc((7 * min(2.6rem, calc((100vw - 4rem) / 7)) + 4 * 2px) / 3)); }
  .cal-grid--wide .cal-cell { block-size: 3rem; font-size: 1rem; }
```

- [ ] **Step 3: Verify** — `cd Site && npx tsc --noEmit && npm run build`.

- [ ] **Step 4: Commit**

```bash
git add Site/src/styles/components.css
git commit -m "feat(site): hug the calendar grid and style the wizard views"
```

---

## Task 5: `popup.ts` — the reusable popup controller (parallel)

**Files:** Create `Site/src/ui/popup.ts`; create `Site/tests/dom/popup.test.ts`

Extract, verbatim in behaviour, what `number-picker.ts` and `calendar-grid.ts`
currently each implement. Read **both** before writing, and where they differ,
take the picker's version — it is the one the review rounds hardened.

**Interfaces produced** (Tasks 7 and 8 depend on these exact names):

```typescript
export interface Popup {
  readonly isOpen: boolean;
  /** `focusTarget` receives DOM focus; `invoker` receives it back on close. */
  open(options: { invoker: HTMLElement; focusTarget: HTMLElement }): void;
  close(restoreFocus: boolean): void;
  /** Re-apply the height cap after the surface's content changes size. */
  reposition(): void;
}

export function createPopup(parts: {
  trigger: HTMLElement;        // gets aria-expanded
  surface: HTMLElement;        // the popup itself; gets `hidden` and `above`
  /** Element the surface is positioned against. Defaults to surface.offsetParent. */
  anchor?: () => HTMLElement | null;
  /** Extra elements that count as "inside" for dismissal. */
  within?: readonly HTMLElement[];
}): Popup;
```

Responsibilities it owns, and which must be **removed** from the two consumers:
`hidden` toggling; `aria-expanded` on the trigger; the `above` side decision,
taken **once per open** and left alone; the inline `max-height` cap, re-applied by
`reposition()`; the `visualViewport` `resize` listener; outside-`pointerdown`
dismissal; `focusout` dismissal via `relatedTarget`; `mousedown` `preventDefault`
on the surface and trigger; and focus return to the invoker.

- [ ] **Step 1: Write `Site/tests/dom/popup.test.ts`** (jsdom) covering every branch:
open sets `hidden=false` and `aria-expanded=true`; close restores both and focuses
the invoker only when asked; a `pointerdown` outside closes while one inside does
not; `focusout` to an element inside does not close and to one outside does;
`reposition()` sets and clears `max-height`; `close` clears `above` and the inline
cap; opening twice is idempotent; `close` on an already-closed popup is a no-op.

jsdom has no layout, so `getBoundingClientRect` returns zeroes. Stub the rects the
positioning logic reads (assign a `getBoundingClientRect` on the elements under
test) so the side and cap branches are genuinely exercised rather than skipped.

- [ ] **Step 2: Implement, verify the file reaches 100%** — `cd Site && npm run test:coverage`.

- [ ] **Step 3: Commit**

```bash
git add Site/src/ui/popup.ts Site/tests/dom/popup.test.ts
git commit -m "feat(site): reusable popup controller shared by picker and calendar"
```

---

## Task 6: `calendar-views.ts` — one strategy per view (after Task 3)

**Files:** Create `Site/src/converter/calendar-views.ts`; create `Site/tests/calendar-views.test.ts`

**Interfaces produced** (Task 8 depends on these exact names):

```typescript
export type CalendarMode = 'days' | 'months' | 'years';
export interface ViewState { year: number; month: number; day: number }
export interface ViewCell { value: number; label: string }
export interface RenderedView {
  columns: number;
  /** Rows of cells; null is a blank slot. */
  rows: readonly (readonly (ViewCell | null)[])[];
  /** Extra header row for the day grid's weekday labels; empty otherwise. */
  headers: readonly string[];
  title: string;
  /** False in the years view — there is nothing above it. */
  titleActionable: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** 'd' | 'm' | 'y' — the cell id and data-attribute discriminator. */
  key: 'd' | 'm' | 'y';
  /** The value this view considers selected, for aria-selected. */
  selected: number;
}
export interface CalendarView {
  render(side: Side, state: ViewState, lang: Lang): RenderedView;
  /** Prev/next: a month, a year, or twelve years. Null at a range bound. */
  step(side: Side, state: ViewState, delta: -1 | 1): ViewState | null;
  /** What choosing `value` does: move to another view, or pick the date. */
  select(state: ViewState, value: number): { state: ViewState; next: CalendarMode | 'pick' };
}
export const CALENDAR_VIEWS: Readonly<Record<CalendarMode, CalendarView>>;
```

Behaviour per strategy:

| | days | months | years |
|---|---|---|---|
| `render` | `buildMonthGrid`; 7 columns; `headers` = weekday labels; `key='d'`; `selected=state.day`; `titleActionable=true` | `buildMonthPage`; 3 columns; no headers; `key='m'`; `selected=state.month`; `titleActionable=true` | `buildYearPage`; 3 columns; no headers; `key='y'`; `selected=state.year`; `titleActionable=false` |
| `step` | ±1 month via `stepMonth` | ±1 year via `stepYear` | ±12 via `stepYearPage`, keeping `year` on the new page |
| `select` | `{state with day}`, next `'pick'` | `{state with month}`, next `'days'` | `{state with year}`, next `'months'` |

`days.select` must **not** clamp — the day comes from a rendered cell. `months.select`
must clamp `state.day` to the new month's length so switching from a 31-day month
into Esfand cannot produce day 31.

- [ ] **Step 1: Write `Site/tests/calendar-views.test.ts`** driving every strategy
through `render`, `step` at both bounds, and `select`, in both languages and both
calendars, including the day-clamp on `months.select`. This module is pure — it
must reach 100% on its own.

- [ ] **Step 2: Implement, run the suite, confirm 100% for this file.**

- [ ] **Step 3: Commit**

```bash
git add Site/src/converter/calendar-views.ts Site/tests/calendar-views.test.ts
git commit -m "feat(site): calendar view strategies for days, months, and years"
```

---

## Task 7: Move `number-picker.ts` onto `popup.ts` (after Tasks 2 and 5)

**Files:** Modify `Site/src/ui/number-picker.ts`

Behaviour must not change — 106 Playwright tests already pin it. Delete the
open/close, `aria-expanded`, dismissal, focus-return, `positionList` and
`visualViewport` code and delegate to `createPopup`. Replace the inline key
`switch` with `gridIntent(key, index, { columns: 1, count, rtl: false }, isOpen)`.

`aria-activedescendant`, `aria-selected`, the option rendering, the `cursor`
scroll-into-view and the lazy-render flag stay here — they are the picker's own
concerns, not the popup's.

- [ ] **Step 1: Refactor. Step 2:** `cd Site && npx tsc --noEmit && npm test`. **Step 3:** Commit

```bash
git add Site/src/ui/number-picker.ts
git commit -m "refactor(site): number picker delegates popup and key handling"
```

---

## Task 8: The wizard in `calendar-grid.ts` (after Tasks 4, 6, 7)

**Files:** Modify `Site/src/ui/calendar-grid.ts`, `Site/index.html`, `Site/src/i18n/strings.ts`

- [ ] **Step 1: Title becomes a button** in both fieldsets of `Site/index.html`:

```html
              <button id="p-cal-title" class="cal-title" type="button"></button>
```

(`g-cal-title` likewise.) `converter.ts` uses `byId<HTMLElement>`, so it needs no change.

- [ ] **Step 2: `calendar-grid.ts` becomes a renderer.** It should hold: the
current `mode`, the `ViewState`, the cursor index, and the DOM building. Everything
else is delegated — `CALENDAR_VIEWS[mode]` for what to show and what a step or a
selection means, `gridIntent` for keys, `createPopup` for the popup.

Rendering a `RenderedView`: `headers` become `.cal-wd` `role="columnheader"` cells
in a `role="row"`; each row is a `role="row"` with `display: contents`; each cell is
`.cal-cell` with id `` `${grid.id}-${view.key}${cell.value}` ``, `data-day`/
`data-month`/`data-year` per `view.key`, `aria-selected` against `view.selected`,
`.cursor` on the cursor index, and `.cal-blank` for nulls. Toggle `cal-grid--wide`
when `view.columns === 3`. Set `grid`'s `aria-label` to `view.title`, the title
button's text to `view.title` and its `disabled` to `!view.titleActionable`.
Call `popup.reposition()` at the end of every render while open.

Transitions: title click → `mode = 'years'`, cursor on the current year. Cell click
or `select` intent → `CALENDAR_VIEWS[mode].select(state, value)`; if `next === 'pick'`
close and call `onPick`, otherwise set `mode = next`, take the returned state, put
the cursor on the newly relevant value, and render. Prev/next and the `page` intent
→ `CALENDAR_VIEWS[mode].step(side, state, delta)`, ignoring `null`.

`open()` always resets `mode` to `'days'`.

- [ ] **Step 3:** `cd Site && npx tsc --noEmit && npm run build`. **Step 4:** Commit

```bash
git add Site/src/ui/calendar-grid.ts Site/index.html Site/src/i18n/strings.ts
git commit -m "feat(site): year and month drill-down in the calendar"
```

---

## Task 9: E2E (after Task 8)

**Files:** Modify `Site/e2e/calendar.spec.ts`

- [ ] **Step 1: Add these tests** (verbatim):

```typescript
test('the title drills down to years, then months, then days', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Dey 1403');

  await page.locator('#p-cal-title').click();
  await expect(page.locator('#p-cal-title')).toHaveText('1392 – 1403');
  await expect(page.locator('#p-cal-title')).toBeDisabled();
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(12);

  await page.locator('#p-cal-grid .cal-cell[data-year="1400"]').click();
  await expect(page.locator('#p-cal-title')).toHaveText('1400');
  await expect(page.locator('#p-cal-title')).toBeEnabled();
  await expect(page.locator('#p-cal-grid .cal-cell[data-month="5"]')).toHaveText('Mordad');

  await page.locator('#p-cal-grid .cal-cell[data-month="5"]').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Mordad 1400');
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(31);
  await page.locator('#p-cal-grid .cal-cell[data-day="3"]').click();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-y')).toHaveValue('1400');
  await expect(page.locator('#p-m')).toHaveValue('5');
  await expect(page.locator('#p-d')).toHaveValue('3');
});

test('switching to a shorter month clamps the day', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1404');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d').fill('31');
  await page.locator('#p-cal').click();
  await page.locator('#p-cal-title').click();
  await page.locator('#p-cal-grid .cal-cell[data-year="1404"]').click();
  await page.locator('#p-cal-grid .cal-cell[data-month="12"]').click();
  // Esfand 1404 has 29 days, so the cursor cannot still be on 31.
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(29);
  await expect(page.locator('#p-cal-grid .cal-cell.cursor')).toHaveText('29');
});

test('the wizard is keyboard operable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-cal').click();
  await page.locator('#p-cal-title').click();
  await expect(page.locator('#p-cal-grid')).toBeFocused();
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-y1403');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-y1400');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-cal-title')).toHaveText('1400');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-cal-grid .cal-cell[data-day="1"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
});

test('paging steps by view: a month, a year, then twelve years', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-cal').click();
  await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Bahman 1403');
  await page.locator('#p-cal-title').click();
  await expect(page.locator('#p-cal-title')).toHaveText('1392 – 1403');
  await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-title')).toHaveText('1404 – 1415');
  await page.locator('#p-cal-grid .cal-cell[data-year="1404"]').click();
  await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-title')).toHaveText('1405');
});

test('the grid hugs its rows instead of reserving a sixth', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('1');
  await page.locator('#p-m').fill('10');           // Dey 1403: 5 rows
  await page.locator('#p-cal').click();
  const five = await page.locator('#p-cal-grid').boundingBox();
  const rowsFive = await page.locator('#p-cal-grid [role="row"]').count();
  await page.keyboard.press('Escape');
  await page.locator('#p-m').fill('1');            // Farvardin 1403: 6 rows
  await page.locator('#p-cal').click();
  const six = await page.locator('#p-cal-grid').boundingBox();
  const rowsSix = await page.locator('#p-cal-grid [role="row"]').count();
  expect(rowsSix).toBeGreaterThan(rowsFive);
  expect(six!.height).toBeGreaterThan(five!.height);
  const lastRowDays = await page.locator('#p-cal-grid [role="row"]').last()
    .locator('.cal-cell').count();
  expect(lastRowDays).toBeGreaterThan(0);          // no trailing all-blank row
});

test('every view stays inside a phone viewport', async ({ page }) => {
  for (const fa of [false, true]) {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    if (fa) await page.locator('#lang-toggle').click();
    await page.locator('#p-cal').click();
    for (const step of ['days', 'years', 'months'] as const) {
      if (step === 'years') await page.locator('#p-cal-title').click();
      if (step === 'months') await page.locator('#p-cal-grid .cal-cell').first().click();
      const box = await page.locator('#p-cal-pop').boundingBox();
      expect(box!.x, `${step} fa=${fa}`).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, `${step} fa=${fa}`).toBeLessThanOrEqual(321);
      expect(box!.y, `${step} fa=${fa}`).toBeGreaterThanOrEqual(-1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${step} fa=${fa}`).toBeLessThanOrEqual(0);
    }
  }
});

test('the popup does not change side while navigating', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-cal').click();
  const side = await page.locator('#p-cal-pop').evaluate((el) => el.classList.contains('above'));
  await page.locator('#p-cal-title').click();
  expect(await page.locator('#p-cal-pop').evaluate((el) => el.classList.contains('above'))).toBe(side);
  await page.locator('#p-cal-grid .cal-cell').first().click();
  expect(await page.locator('#p-cal-pop').evaluate((el) => el.classList.contains('above'))).toBe(side);
});
```

- [ ] **Step 2: Build, then run the full suite** — `cd Site && npm run build && npx playwright test`.
Expected: all PASS, including every pre-existing test — the refactor must not have
changed behaviour. If one fails, the implementation is the suspect; report the
exact assertion and actual value and fix the source. Never weaken an assertion.

- [ ] **Step 3: Commit**

```bash
git add Site/e2e/calendar.spec.ts
git commit -m "test(site): cover the calendar wizard and the hug-content grid"
```

---

## Task 10: Reach the coverage threshold, docs, full verification (last)

**Files:** `Site/tests/**`, `README.md`, `docs/SECURITY.md`

- [ ] **Step 1: Run coverage** — `cd Site && npm run test:coverage`.

- [ ] **Step 2: Close every gap** on the modules under `src/converter/` and
`src/ui/` and `src/i18n/` by adding unit tests — new `tests/dom/*.test.ts` files
for DOM modules, plain tests for pure ones. Do not lower a threshold or widen the
`exclude` list to make the run pass; if a branch is genuinely unreachable, prove it
is unreachable and delete the dead code instead.

- [ ] **Step 3: Report honestly.** If any metric still falls short, say so with the
exact number and the specific uncovered lines and why. A truthful 96% beats a
fabricated 100%.

- [ ] **Step 4: Update `README.md` and `docs/SECURITY.md`** — the calendar bullet
gains the drill-down and the hugging grid; the repo layout gains
`src/ui/popup.ts`, `src/ui/grid-navigation.ts`, `src/converter/calendar-views.ts`;
the testing section gains the coverage command and the real figure. Replace every
Vitest count, Playwright count and bundle size with numbers you observed.

- [ ] **Step 5: Full verification** — `cd Site && npm run test:coverage && npx tsc --noEmit && npm run build && npx playwright test`.

- [ ] **Step 6: Commit**

```bash
git add Site/tests README.md docs/SECURITY.md
git commit -m "test(site): close coverage gaps; docs for the wizard and refactor"
```

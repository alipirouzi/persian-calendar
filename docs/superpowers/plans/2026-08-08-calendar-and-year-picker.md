# Calendar Grid and Year Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Numeric-only fields, a year picker matching month and day, per-field captions replaced by one full date line, and a browsable calendar month grid per side.

**Architecture:** Pure logic stays DOM-free and vitest-tested (`field-options.ts`, `calendar-grid-model.ts`, `numeric-input.ts`); DOM components stay calendar-agnostic (`number-picker.ts`, `calendar-grid.ts`) and are E2E-tested; `converter.ts` wires them. `convertFrom` is unchanged.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (chromium, port 4173).

**Spec:** `docs/superpowers/specs/2026-08-08-calendar-and-year-picker-design.md`

## Global Constraints

- **No new dependencies**, runtime or dev.
- **Both languages always.** Every visible string comes from the tables in `src/i18n/strings.ts`.
- **Option `value` and grid day numbers are ASCII integers**; only display text is localized.
- **Do not touch** `Lib/`, `Console/`, `Tests/` (C#), `Site/sw.js`, or `deploy/`.
- **Working dir:** all `npm` commands run in `Site/`.
- **Commits:** commit exactly the files your task lists, conventional-commit messages, never push.
- **Only one agent may run Playwright at a time** — the preview server binds port 4173 with `--strictPort`. Do not run `npx playwright test` unless your task says to.
- If `git commit` fails on `index.lock`, sleep 2s and retry, up to 5 times.

### Verified ground truth (probed from `src/calendar/persian.ts` — use these, do not invent)

- Persian leap years near the present: 1399, 1403, 1408, 1412.
- `daysInPersianMonth(1403,12)` = 30 (leap); `(1404,12)` = 29; `(1403,10)` = 30; `(1403,1)` = 31.
- `toGregorian({py:1403,pm:10,pd:1})` = `{gy:2024,gm:12,gd:21}` — a **Saturday** (`getDay()` 6).
- `toGregorian({py:1403,pm:10,pd:22})` = `{gy:2025,gm:1,gd:11}` — a **Saturday**.
- `daysInGregorianMonth(2024,2)` = 29; `(2025,2)` = 28.
- Ranges: Persian 1200–1500, Gregorian 1822–2121.

### Shared contract (tasks running in parallel must match this exactly)

| Item | Value |
|---|---|
| Year picker ids | `p-y-toggle`, `p-y-list`, `g-y-toggle`, `g-y-list` |
| Calendar ids | `p-cal`, `p-cal-pop`, `p-cal-title`, `p-cal-prev`, `p-cal-next`, `p-cal-grid` (and `g-` twins) |
| Full date line | `<p id="full-date">` between `</form>` and `#status-row` |
| Removed from DOM | `#weekday`, `#p-m-hint`, `#g-m-hint`, every `.hint` span, `aria-describedby` on month inputs |
| New string keys | `chooseYear`, `openCalendar`, `prevMonth`, `nextMonth` |
| New table | `WEEKDAYS_SHORT: Record<Lang, readonly string[]>`, indexed by `getDay()` |
| Calendar CSS classes | `.cal-pop`, `.cal-head`, `.cal-nav`, `.cal-grid`, `.cal-wd`, `.cal-cell`, `.cal-cell.today`, `.cal-cell.active`, `.cal-blank` |
| `maxlength` | `4` on year inputs, `2` on month and day inputs |

**Phases:** Tasks 1–5 are parallel-safe (disjoint files). Task 6 needs 2 and 5. Task 7 needs 1,3,4,5,6. Task 8 needs 7. Task 9 last.

---

## Task 1: `yearOptions` in field-options

**Files:** Modify `Site/src/converter/field-options.ts`; modify `Site/tests/field-options.test.ts`

**Interfaces:**
- Consumes: existing imports in that file.
- Produces: `export function yearOptions(side: Side, lang: Lang): readonly FieldOption[]` — Task 7 depends on this name.

- [ ] **Step 1: Add the failing tests** to `Site/tests/field-options.test.ts` (add `yearOptions` to the existing import line):

```typescript
describe('yearOptions', () => {
  it('covers the Persian supported range', () => {
    const opts = yearOptions('persian', 'en');
    expect(opts).toHaveLength(301);
    expect(opts[0]).toEqual({ value: 1200, num: '1200', name: '' });
    expect(opts[300]).toEqual({ value: 1500, num: '1500', name: '' });
  });
  it('covers the Gregorian supported range', () => {
    const opts = yearOptions('gregorian', 'en');
    expect(opts).toHaveLength(300);
    expect(opts[0]).toEqual({ value: 1822, num: '1822', name: '' });
    expect(opts[299]).toEqual({ value: 2121, num: '2121', name: '' });
  });
  it('localizes the numerals and carries no name', () => {
    const opts = yearOptions('persian', 'fa');
    expect(opts[205]).toEqual({ value: 1405, num: '۱۴۰۵', name: '' });
    expect(opts.every((o) => o.name === '')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd Site && npx vitest run tests/field-options.test.ts`
Expected: FAIL — `yearOptions` is not exported.

- [ ] **Step 3: Implement** — append to `Site/src/converter/field-options.ts`:

```typescript
/**
 * Every supported year for one side. Numerals only: a year has no name, so the
 * popup renders these as a single column, like the no-context day list.
 */
export function yearOptions(side: Side, lang: Lang): readonly FieldOption[] {
  const [min, max] = side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  return Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    num: toLocaleDigits(min + i, lang),
    name: '',
  }));
}
```

- [ ] **Step 4: Run the full Vitest suite** — `cd Site && npm test`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add Site/src/converter/field-options.ts Site/tests/field-options.test.ts
git commit -m "feat(site): year option source for the year picker"
```

---

## Task 2: `calendar-grid-model.ts`

**Files:** Create `Site/src/converter/calendar-grid-model.ts`; create `Site/tests/calendar-grid-model.test.ts`

**Interfaces:**
- Consumes: `daysInPersianMonth`, `daysInGregorianMonth`, `toGregorian`, `PERSIAN_YEAR_MIN/MAX` from `../calendar/persian`; `GREGORIAN_YEAR_MIN/MAX`, `type Side` from `./converter-core`; `PERSIAN_MONTHS`, `GREGORIAN_MONTHS`, `WEEKDAYS_SHORT`, `toLocaleDigits`, `type Lang` from `../i18n/strings`.
- **`WEEKDAYS_SHORT` is added by Task 5.** Write your import against it; your vitest run will fail to resolve it until Task 5 lands, which is expected — if that happens, wait and re-run rather than adding the table yourself (it is Task 5's file).
- Produces (Tasks 6 and 7 depend on these exact names):
  - `export interface MonthGrid { year: number; month: number; title: string; weekdayHeaders: readonly string[]; weeks: readonly (readonly (number | null)[])[]; canGoPrev: boolean; canGoNext: boolean }`
  - `export function buildMonthGrid(side: Side, year: number, month: number, lang: Lang): MonthGrid`
  - `export function stepMonth(side: Side, year: number, month: number, delta: number): { year: number; month: number } | null`

- [ ] **Step 1: Write the failing tests** — create `Site/tests/calendar-grid-model.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildMonthGrid, stepMonth } from '../src/converter/calendar-grid-model';

describe('weekday headers', () => {
  it('starts Persian weeks on Saturday', () => {
    expect(buildMonthGrid('persian', 1403, 10, 'en').weekdayHeaders)
      .toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(buildMonthGrid('persian', 1403, 10, 'fa').weekdayHeaders)
      .toEqual(['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']);
  });
  it('starts Gregorian weeks on Monday', () => {
    expect(buildMonthGrid('gregorian', 2025, 1, 'en').weekdayHeaders)
      .toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('grid layout', () => {
  it('places Dey 1403 day 1 in the Saturday column', () => {
    // 1403-10-01 is 2024-12-21, a Saturday → column 0 in a Saturday-first week.
    const grid = buildMonthGrid('persian', 1403, 10, 'en');
    expect(grid.weeks[0]?.[0]).toBe(1);
    expect(grid.weeks[0]?.[6]).toBe(7);
    // 1403-10-22 is also a Saturday, so it starts a row.
    expect(grid.weeks[3]?.[0]).toBe(22);
  });
  it('pads the leading blanks and never the trailing row beyond the month', () => {
    const grid = buildMonthGrid('gregorian', 2025, 1, 'en');
    // 2025-01-01 is a Wednesday → column 2 in a Monday-first week.
    expect(grid.weeks[0]?.slice(0, 3)).toEqual([null, null, 1]);
    const flat = grid.weeks.flat().filter((d) => d !== null);
    expect(flat).toHaveLength(31);
    expect(flat[0]).toBe(1);
    expect(flat[30]).toBe(31);
  });
  it('uses the real month length, leap years included', () => {
    const count = (s: 'persian' | 'gregorian', y: number, m: number): number =>
      buildMonthGrid(s, y, m, 'en').weeks.flat().filter((d) => d !== null).length;
    expect(count('persian', 1403, 12)).toBe(30); // leap
    expect(count('persian', 1404, 12)).toBe(29); // common
    expect(count('gregorian', 2024, 2)).toBe(29);
    expect(count('gregorian', 2025, 2)).toBe(28);
  });
  it('every row has exactly seven cells', () => {
    for (const [s, y, m] of [['persian', 1403, 1], ['gregorian', 2025, 2]] as const) {
      for (const week of buildMonthGrid(s, y, m, 'en').weeks) {
        expect(week).toHaveLength(7);
      }
    }
  });
  it('titles the month in the current language', () => {
    expect(buildMonthGrid('persian', 1405, 5, 'en').title).toBe('Mordad 1405');
    expect(buildMonthGrid('persian', 1405, 5, 'fa').title).toBe('مرداد ۱۴۰۵');
    expect(buildMonthGrid('gregorian', 2026, 8, 'en').title).toBe('August 2026');
  });
});

describe('stepMonth', () => {
  it('rolls over year boundaries', () => {
    expect(stepMonth('persian', 1403, 12, 1)).toEqual({ year: 1404, month: 1 });
    expect(stepMonth('persian', 1403, 1, -1)).toEqual({ year: 1402, month: 12 });
    expect(stepMonth('gregorian', 2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });
  it('returns null at the supported range bounds', () => {
    expect(stepMonth('persian', 1200, 1, -1)).toBeNull();
    expect(stepMonth('persian', 1500, 12, 1)).toBeNull();
    expect(stepMonth('gregorian', 1822, 1, -1)).toBeNull();
    expect(stepMonth('gregorian', 2121, 12, 1)).toBeNull();
  });
  it('feeds canGoPrev and canGoNext', () => {
    expect(buildMonthGrid('persian', 1200, 1, 'en').canGoPrev).toBe(false);
    expect(buildMonthGrid('persian', 1200, 1, 'en').canGoNext).toBe(true);
    expect(buildMonthGrid('persian', 1500, 12, 'en').canGoNext).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd Site && npx vitest run tests/calendar-grid-model.test.ts`. Expected: FAIL, module missing.

- [ ] **Step 3: Create `Site/src/converter/calendar-grid-model.ts`:**

```typescript
import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian,
} from '../calendar/persian';
import {
  GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN, type Side,
} from './converter-core';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, WEEKDAYS_SHORT, type Lang,
} from '../i18n/strings';

export interface MonthGrid {
  year: number;
  month: number;
  /** e.g. "Mordad 1405" / "مرداد ۱۴۰۵". */
  title: string;
  /** Seven labels in this calendar's week order. */
  weekdayHeaders: readonly string[];
  /** Rows of seven; null is a cell outside the month. */
  weeks: readonly (readonly (number | null)[])[];
  canGoPrev: boolean;
  canGoNext: boolean;
}

const DAYS_IN_WEEK = 7;

/**
 * Persian weeks start Saturday, Gregorian weeks start Monday. Both are
 * expressed as an offset applied to the JS getDay() index (0 = Sunday).
 */
const WEEK_START_OFFSET: Record<Side, number> = { persian: 1, gregorian: 6 };

function yearBounds(side: Side): readonly [number, number] {
  return side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
}

function monthLength(side: Side, year: number, month: number): number {
  return side === 'persian'
    ? daysInPersianMonth(year, month)
    : daysInGregorianMonth(year, month);
}

/** Column of the first of the month, in this calendar's week order. */
function firstColumn(side: Side, year: number, month: number): number {
  const g = side === 'persian'
    ? toGregorian({ py: year, pm: month, pd: 1 })
    : { gy: year, gm: month, gd: 1 };
  const weekday = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return (weekday + WEEK_START_OFFSET[side]) % DAYS_IN_WEEK;
}

export function stepMonth(
  side: Side, year: number, month: number, delta: number,
): { year: number; month: number } | null {
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const [min, max] = yearBounds(side);
  if (nextYear < min || nextYear > max) return null;
  return { year: nextYear, month: nextMonth };
}

export function buildMonthGrid(
  side: Side, year: number, month: number, lang: Lang,
): MonthGrid {
  const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  const short = WEEKDAYS_SHORT[lang];
  const offset = WEEK_START_OFFSET[side];
  const weekdayHeaders = Array.from({ length: DAYS_IN_WEEK }, (_, col) =>
    short[(col - offset + DAYS_IN_WEEK * 2) % DAYS_IN_WEEK] as string);

  const length = monthLength(side, year, month);
  const lead = firstColumn(side, year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);
  const weeks = Array.from(
    { length: cells.length / DAYS_IN_WEEK },
    (_, row) => cells.slice(row * DAYS_IN_WEEK, (row + 1) * DAYS_IN_WEEK),
  );

  return {
    year, month,
    title: `${names[month - 1] as string} ${toLocaleDigits(year, lang)}`,
    weekdayHeaders,
    weeks,
    canGoPrev: stepMonth(side, year, month, -1) !== null,
    canGoNext: stepMonth(side, year, month, 1) !== null,
  };
}
```

- [ ] **Step 4: Run the full Vitest suite** — `cd Site && npm test`. Expected: all PASS once Task 5 has added `WEEKDAYS_SHORT`. If that table is still missing, re-run after Task 5 commits rather than adding it yourself.

- [ ] **Step 5: Commit**

```bash
git add Site/src/converter/calendar-grid-model.ts Site/tests/calendar-grid-model.test.ts
git commit -m "feat(site): month grid model with per-calendar week starts"
```

---

## Task 3: `numeric-input.ts` — reject non-numeric characters

**Files:** Create `Site/src/ui/numeric-input.ts`; create `Site/tests/numeric-input.test.ts`

**Interfaces:**
- Produces (Task 7 depends on these): `export function filterDigits(raw: string): string` and `export function restrictToDigits(input: HTMLInputElement): void`.

- [ ] **Step 1: Write the failing tests** — create `Site/tests/numeric-input.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { filterDigits } from '../src/ui/numeric-input';

describe('filterDigits', () => {
  it('keeps every digit script the converter accepts', () => {
    expect(filterDigits('1405')).toBe('1405');
    expect(filterDigits('۱۴۰۵')).toBe('۱۴۰۵');
    expect(filterDigits('١٤٠٥')).toBe('١٤٠٥');
  });
  it('strips letters, punctuation, and whitespace', () => {
    expect(filterDigits('abc')).toBe('');
    expect(filterDigits('14o5')).toBe('145');
    expect(filterDigits('1405-10-22')).toBe('14051022');
    expect(filterDigits(' 14 05 ')).toBe('1405');
    expect(filterDigits('١٤!٠٥')).toBe('١٤٠٥');
    expect(filterDigits('12.5')).toBe('125');
    expect(filterDigits('-1')).toBe('1');
    expect(filterDigits('1e3')).toBe('13');
  });
  it('leaves an already-clean or empty value untouched', () => {
    expect(filterDigits('')).toBe('');
    expect(filterDigits('7')).toBe('7');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd Site && npx vitest run tests/numeric-input.test.ts`. Expected: FAIL, module missing.

- [ ] **Step 3: Create `Site/src/ui/numeric-input.ts`:**

```typescript
/** Anything that is not an ASCII, Persian-Indic, or Arabic-Indic digit. */
const NON_DIGIT = /[^0-9۰-۹٠-٩]/g;

export function filterDigits(raw: string): string {
  return raw.replace(NON_DIGIT, '');
}

/**
 * Keep a text field numeric. Character-level only: out-of-range *numbers* still
 * reach convertFrom and still raise the localized range errors, because blocking
 * those at the keystroke would break typing `3` on the way to `30`.
 *
 * Paste goes through the same path — it fires `input` too. Register this BEFORE
 * any listener that reads the field, so they see the cleaned value.
 */
export function restrictToDigits(input: HTMLInputElement): void {
  input.addEventListener('input', () => {
    const before = input.value;
    const after = filterDigits(before);
    if (after === before) return;
    const caret = input.selectionStart ?? before.length;
    // The caret belongs after however many digits survived ahead of it.
    const kept = filterDigits(before.slice(0, caret)).length;
    input.value = after;
    input.setSelectionRange(kept, kept);
  });
}
```

- [ ] **Step 4: Run the full Vitest suite** — `cd Site && npm test`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add Site/src/ui/numeric-input.ts Site/tests/numeric-input.test.ts
git commit -m "feat(site): reject non-numeric characters in date fields"
```

---

## Task 4: Lazy option rendering in `number-picker.ts`

**Files:** Modify `Site/src/ui/number-picker.ts`

**Interfaces:** No API change. `setOptions` and `close` keep their signatures; the DOM for options is simply built on first open instead of on every `setOptions`.

- [ ] **Step 1: Add a dirty flag.** Immediately after `let ariaHost: HTMLElement = input;` add:

```typescript
  /**
   * Option DOM is built on first open, not on every setOptions. With three
   * pickers a side and 300 years apiece, eager rendering would put ~1,200 nodes
   * on the page before the user has opened anything.
   */
  let needsRender = true;
```

- [ ] **Step 2: Render on demand in `open`.** In `open`, insert the render immediately after the `if (options.length === 0) return;` guard and before `invoker = opts.invoker;`:

```typescript
    if (needsRender) { render(); needsRender = false; }
```

- [ ] **Step 3: Make `setOptions` defer.** Replace the returned `setOptions` body with:

```typescript
    setOptions(next) {
      options = next;
      needsRender = true;
      if (!isOpen) return;
      // Visible right now, so it has to change under the user immediately.
      render();
      needsRender = false;
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      paint();
    },
```

- [ ] **Step 4: Type-check** — `cd Site && npx tsc --noEmit && npm test`. Expected: clean, 100% of existing Vitest still passing.

- [ ] **Step 5: Commit**

```bash
git add Site/src/ui/number-picker.ts
git commit -m "perf(site): build picker option DOM on first open"
```

---

## Task 5: Strings, markup, and styles

**Files:** Modify `Site/src/i18n/strings.ts`, `Site/index.html`, `Site/src/styles/components.css`

**Interfaces:** Produces every id, class and string key in the shared contract table above. Tasks 6 and 7 depend on all of them.

- [ ] **Step 1: Extend `Site/src/i18n/strings.ts`.**

Add to the `StringKey` union, after `'chooseMonth' | 'chooseDay'`:

```typescript
  | 'chooseYear' | 'openCalendar' | 'prevMonth' | 'nextMonth'
```

Add to `STRINGS.en` after `chooseDay`:

```typescript
    chooseYear: 'Choose year',
    openCalendar: 'Open calendar',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
```

Add to `STRINGS.fa` after `chooseDay`:

```typescript
    chooseYear: 'انتخاب سال',
    openCalendar: 'تقویم',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
```

Add after the existing `WEEKDAYS` table:

```typescript
/** Short weekday labels for the calendar header, indexed like WEEKDAYS. */
export const WEEKDAYS_SHORT: Record<Lang, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fa: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],
};
```

- [ ] **Step 2: Rewrite both fieldsets in `Site/index.html`.**

Every field is now a picker, captions are gone, and the legend carries the
calendar button. The Persian fieldset becomes exactly:

```html
        <fieldset id="side-persian">
          <legend><span id="legend-persian"></span>
            <button id="p-cal" class="cal-btn" type="button" aria-expanded="false"
                    aria-controls="p-cal-pop">▦</button></legend>
          <div class="fields">
            <div class="field">
              <label for="p-y" data-str="year"></label>
              <div class="picker">
                <input id="p-y" type="text" inputmode="numeric" autocomplete="off"
                       maxlength="4" role="combobox" aria-expanded="false"
                       aria-controls="p-y-list" aria-autocomplete="none" />
                <button id="p-y-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-y-list">▾</button>
                <ul id="p-y-list" class="picker-list" role="listbox" tabindex="-1" hidden></ul>
              </div>
            </div>
            <div class="field">
              <label for="p-m" data-str="month"></label>
              <div class="picker">
                <input id="p-m" type="text" inputmode="numeric" autocomplete="off"
                       maxlength="2" role="combobox" aria-expanded="false"
                       aria-controls="p-m-list" aria-autocomplete="none" />
                <button id="p-m-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-m-list">▾</button>
                <ul id="p-m-list" class="picker-list" role="listbox" tabindex="-1" hidden></ul>
              </div>
            </div>
            <div class="field">
              <label for="p-d" data-str="day"></label>
              <div class="picker">
                <input id="p-d" type="text" inputmode="numeric" autocomplete="off"
                       maxlength="2" role="combobox" aria-expanded="false"
                       aria-controls="p-d-list" aria-autocomplete="none" />
                <button id="p-d-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-d-list">▾</button>
                <ul id="p-d-list" class="picker-list" role="listbox" tabindex="-1" hidden></ul>
              </div>
            </div>
          </div>
          <div id="p-cal-pop" class="cal-pop" hidden>
            <div class="cal-head">
              <button id="p-cal-prev" class="cal-nav" type="button">‹</button>
              <span id="p-cal-title"></span>
              <button id="p-cal-next" class="cal-nav" type="button">›</button>
            </div>
            <div id="p-cal-grid" class="cal-grid" role="grid" tabindex="-1"></div>
          </div>
        </fieldset>
```

Apply the identical structure to the Gregorian fieldset with every `p-` id
replaced by `g-` and `legend-persian` by `legend-gregorian`.

Then replace the status row block so the weekday span is gone and the full date
line sits above it:

```html
      <p id="full-date" hidden></p>
      <div id="status-row">
        <button id="btn-today" type="button" data-str="today"></button>
        <button id="btn-copy" type="button" data-str="copy"></button>
      </div>
      <p id="converter-error" role="status" hidden></p>
```

- [ ] **Step 3: Update `Site/src/styles/components.css`.**

Delete the whole `.hint { … }` rule — nothing uses that class any more.

Delete the `#weekday { … }` rule for the same reason.

Add after the `#status-row button::after` rule:

```css
/* The converter's readout: the same sentence the Copy button writes, so what is
   on screen is what lands on the clipboard. Muted and small so it reads as a
   caption of the form rather than competing with the today panel above. */
#full-date {
  margin-top: 1rem; text-align: center;
  font-size: 0.9rem; color: var(--text-muted);
}

legend { display: flex; align-items: center; gap: 0.5rem; }
.cal-btn {
  position: relative; background: none; border: 0; padding: 0; cursor: pointer;
  color: var(--text-muted); font-size: 0.9rem; line-height: 1;
  transition: color var(--duration) var(--ease);
}
.cal-btn:hover, .cal-btn[aria-expanded='true'] { color: var(--accent); }
/* Invisible hit-area extension, same pattern as #lang-toggle (WCAG 2.5.8). */
.cal-btn::after { content: ''; position: absolute; inset: -12px; }

.cal-pop {
  position: absolute; z-index: 20; margin-top: 0.4rem;
  padding: 0.6rem; background: var(--surface-raised);
  border: 1px solid var(--hairline); border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
}
.cal-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem; margin-bottom: 0.5rem;
  font-size: 0.85rem; color: var(--text);
}
.cal-nav {
  background: none; border: 0; cursor: pointer; padding: 0.2rem 0.5rem;
  color: var(--text-muted); font-size: 1rem; line-height: 1;
  transition: color var(--duration) var(--ease);
}
.cal-nav:hover:not(:disabled) { color: var(--accent); }
.cal-nav:disabled { opacity: 0.3; cursor: default; }
.cal-grid {
  display: grid; grid-template-columns: repeat(7, 2rem); gap: 2px;
  /* Six rows' worth of height so the popup does not jump between months. */
  min-block-size: calc(6 * 2rem + 5 * 2px + 1.6rem);
  align-content: start;
}
.cal-grid:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.cal-wd {
  block-size: 1.6rem; display: grid; place-items: center;
  font-size: 0.7rem; color: var(--text-muted);
}
.cal-cell {
  block-size: 2rem; display: grid; place-items: center;
  border-radius: 4px; cursor: pointer;
  font-size: 0.8rem; font-variant-numeric: tabular-nums; color: var(--text);
  transition: background var(--duration) var(--ease);
}
.cal-cell:hover { background: var(--hairline); }
/* Today is an outline, selection is a fill: two marks that can coexist. */
.cal-cell.today { box-shadow: inset 0 0 0 1px var(--accent); }
.cal-cell.active { background: var(--accent); color: var(--surface-raised); font-weight: 600; }
.cal-blank { block-size: 2rem; }
```

In the touch-target media block, add larger calendar cells so the grid stays
tappable:

```css
  .cal-grid { grid-template-columns: repeat(7, 2.6rem); min-block-size: calc(6 * 2.6rem + 5 * 2px + 1.6rem); }
  .cal-cell, .cal-blank { block-size: 2.6rem; }
  .cal-cell { font-size: 0.95rem; }
```

- [ ] **Step 4: Build and type-check** — `cd Site && npx tsc --noEmit && npm run build`.
Expected: clean. The page will render with an unwired year picker and an empty
calendar until Tasks 6 and 7 land — that is expected here.

- [ ] **Step 5: Commit**

```bash
git add Site/src/i18n/strings.ts Site/index.html Site/src/styles/components.css
git commit -m "feat(site): year picker markup, calendar shell, full date line"
```

---

## Task 6: `calendar-grid.ts` — the popup component (after Tasks 2 and 5)

**Files:** Create `Site/src/ui/calendar-grid.ts`

**Interfaces:**
- Consumes: `buildMonthGrid`, `stepMonth`, `type MonthGrid` from `../converter/calendar-grid-model` (Task 2); `STRINGS`, `toLocaleDigits`, `type Lang` from `../i18n/strings`; `type Side` from `../converter/converter-core`.
- Produces (Task 7 depends on these exact names):

```typescript
export interface CalendarGrid {
  /** Re-read language and re-render if open. */
  rerender(): void;
  close(): void;
}

export function createCalendarGrid(parts: {
  side: Side;
  button: HTMLButtonElement;
  popup: HTMLElement;
  title: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  grid: HTMLElement;
  getLang: () => Lang;
  /** The date the converter currently holds for this side, or null. */
  getCurrent: () => { year: number; month: number; day: number } | null;
  /** Today's date in this side's calendar. */
  getToday: () => { year: number; month: number; day: number };
  onPick: (year: number, month: number, day: number) => void;
}): CalendarGrid;
```

This task is DOM mechanics; it is covered by E2E in Task 8, not by Vitest.

- [ ] **Step 1: Implement `Site/src/ui/calendar-grid.ts`** to this behaviour. Follow `number-picker.ts` closely — same focus model, same close rules — so the codebase has one story, not two.

**Rendering.** `render()` calls `buildMonthGrid(side, viewYear, viewMonth, getLang())` and rebuilds `grid` from the result:
- Seven `<div class="cal-wd" role="columnheader">` cells from `weekdayHeaders`.
- For each week, a `<div role="row">` containing seven cells: `null` renders
  `<div class="cal-blank" role="gridcell"></div>`; a day renders
  `<div class="cal-cell" role="gridcell" id="<grid.id>-d<day>" data-day="<day>"
  aria-selected="…">` with `toLocaleDigits(day, lang)` as its text.
- `title.textContent = grid.title`; `prev.disabled = !grid.canGoPrev`;
  `next.disabled = !grid.canGoNext`.
- Mark `.active` on the cell matching `getCurrent()` when it falls in the viewed
  month, and `.today` on the cell matching `getToday()` likewise.
- Set `aria-activedescendant` on `grid` to the focused day's cell id.

**State.** `viewYear`/`viewMonth` start at `getCurrent() ?? getToday()`; `focusDay`
is the active day, clamped to the month's length whenever the view changes.

**Opening.** `button.click` toggles. On open: set the view from
`getCurrent() ?? getToday()`, render, un-hide `popup`, set `aria-expanded="true"`
on `button`, and focus `grid`. On close: hide, `aria-expanded="false"`, and
return focus to `button`.

**Keyboard on `grid`:** `ArrowLeft`/`ArrowRight` move one day (mirrored under RTL
is *not* required — arrow keys are logical here, left is previous day in both
directions, matching how the browser treats a grid); `ArrowUp`/`ArrowDown` move
seven days; `Home`/`End` jump to the first and last day of the displayed week;
`PageUp`/`PageDown` step a month; `Enter` and `Space` pick the focused day;
`Escape` closes. Moving past the end of a month steps into the next or previous
month when `stepMonth` allows it, and is a no-op at a range bound. Every handled
key calls `preventDefault()`.

**Picking.** Clicking a `.cal-cell` or pressing Enter/Space calls
`onPick(viewYear, viewMonth, focusDay)`, then closes.

**Dismissal.** A `document` `pointerdown` outside `button` and `popup` closes it,
exactly as the picker does. Escape closes. Nothing else.

**`rerender()`** re-renders in place when open (used by the language toggle) and
is a no-op when closed, since the next open renders fresh.

- [ ] **Step 2: Type-check** — `cd Site && npx tsc --noEmit`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add Site/src/ui/calendar-grid.ts
git commit -m "feat(site): browsable calendar month grid component"
```

---

## Task 7: Wire everything into `converter.ts` (after Tasks 1, 3, 4, 5, 6)

**Files:** Modify `Site/src/converter/converter.ts`

**Interfaces:** `setupConverter(getLang)` keeps its exact return shape `{ prefill, rerender }`, so `main.ts` needs no change.

- [ ] **Step 1: Add the imports**

```typescript
import { dayOptions, monthOptions, parseInRange, yearOptions } from './field-options';
import { createCalendarGrid, type CalendarGrid } from '../ui/calendar-grid';
import { restrictToDigits } from '../ui/numeric-input';
```

Remove `PERSIAN_MONTHS`/`GREGORIAN_MONTHS` from the import list **only if** they
end up unused after Step 4 — they are still needed for the `errDay` message.

- [ ] **Step 2: Extend `SideRefs`** — add `yearToggle`, `yearList`, `yearPicker`, and
`calendar: CalendarGrid`; **remove** `monthHint`.

- [ ] **Step 3: Build the year picker and the calendar per side**, inside the existing
`SIDES.map` that builds `refs`. Apply the digit filter to all three inputs
**before** creating the pickers, so the filter's `input` listener is registered
first and every later listener reads a cleaned value:

```typescript
    for (const field of [y, m, d]) restrictToDigits(field);
```

Create the year picker exactly like the month and day ones, with
`onCommit: (value) => { y.value = toLocaleDigits(value, getLang()); run(side, true); }`.

Create the calendar with:

```typescript
      calendar: createCalendarGrid({
        side,
        button: byId<HTMLButtonElement>(`${p}-cal`),
        popup: byId<HTMLElement>(`${p}-cal-pop`),
        title: byId<HTMLElement>(`${p}-cal-title`),
        prev: byId<HTMLButtonElement>(`${p}-cal-prev`),
        next: byId<HTMLButtonElement>(`${p}-cal-next`),
        grid: byId<HTMLElement>(`${p}-cal-grid`),
        getLang,
        getCurrent: () => {
          const year = parseInRange(y.value, ...(side === 'persian' ? [1200, 1500] : [1822, 2121]) as [number, number]);
          const month = parseInRange(m.value, 1, 12);
          const day = parseInRange(d.value, 1, 31);
          return year === null || month === null || day === null
            ? null : { year, month, day };
        },
        getToday: () => {
          const snap = nowSnapshot().local;
          return side === 'persian'
            ? { year: snap.p.py, month: snap.p.pm, day: snap.p.pd }
            : { year: snap.g.gy, month: snap.g.gm, day: snap.g.gd };
        },
        onPick: (year, month, day) => {
          const lang = getLang();
          y.value = toLocaleDigits(year, lang);
          m.value = toLocaleDigits(month, lang);
          d.value = toLocaleDigits(day, lang);
          run(side, true);
        },
      }),
```

- [ ] **Step 4: Replace `refreshOptions` and `renderLabels`.** The month hint is gone
and the year list must be refreshed when the language changes:

```typescript
  /** Day options for both sides, after any field changes. */
  const refreshOptions = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      const key = `${lang}|${r.y.value}|${r.m.value}`;
      if (key === dayKey[side]) continue;
      dayKey[side] = key;
      r.dayPicker.setOptions(dayOptions(side, r.y.value, r.m.value, lang));
    }
  };

  /** Option lists and accessible names that depend only on the language. */
  const renderLabels = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      r.yearPicker.setOptions(yearOptions(side, lang));
      r.monthPicker.setOptions(monthOptions(side, lang));
      for (const [el, key] of [
        [r.yearToggle, 'chooseYear'], [r.yearList, 'chooseYear'],
        [r.monthToggle, 'chooseMonth'], [r.monthList, 'chooseMonth'],
        [r.dayToggle, 'chooseDay'], [r.dayList, 'chooseDay'],
      ] as const) {
        el.setAttribute('aria-label', STRINGS[lang][key]);
      }
      r.calButton.setAttribute('aria-label', STRINGS[lang].openCalendar);
      r.calPrev.setAttribute('aria-label', STRINGS[lang].prevMonth);
      r.calNext.setAttribute('aria-label', STRINGS[lang].nextMonth);
      r.calendar.rerender();
    }
    dayKey.persian = '';
    dayKey.gregorian = '';
  };
```

Add `calButton`, `calPrev`, `calNext` to `SideRefs` and populate them alongside
the calendar so the labels above can be set.

- [ ] **Step 5: Replace `setStatus` so it drives the full date line** instead of the
deleted `#weekday` span. Look up `const fullDate = byId<HTMLElement>('full-date');`
next to the other element lookups, drop the `weekdayEl` lookup, and use:

```typescript
  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    fullDate.hidden = ok === null;
    fullDate.textContent = ok === null ? '' : copySentence(ok.p, ok.g, getLang());
    btnCopy.disabled = ok === null;
  };
```

`weekdayName` is no longer used here — remove it from the import if nothing else
in the file references it.

- [ ] **Step 6: Close every popup on «Today».** In the `btnToday` click handler,
alongside the existing picker closes, add `refs[side].calendar.close();` and add
`refs[side].yearPicker.close();`.

- [ ] **Step 7: Build and type-check** — `cd Site && npx tsc --noEmit && npm run build`.
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add Site/src/converter/converter.ts
git commit -m "feat(site): wire year picker, calendar, digit filter, full date line"
```

---

## Task 8: E2E — update the suite and cover the new surface (after Task 7)

**Files:** Modify `Site/e2e/converter-ux.spec.ts`, `Site/e2e/picker.spec.ts`; create `Site/e2e/calendar.spec.ts`

- [ ] **Step 1: Retire the removed DOM from the existing specs.** `#weekday`,
`#p-m-hint` and `#g-m-hint` no longer exist. In `converter-ux.spec.ts` and
`picker.spec.ts`, every assertion against them becomes an assertion against
`#full-date`:
- `expect(page.locator('#weekday')).toHaveText('Saturday')` →
  `expect(page.locator('#full-date')).toHaveText('Saturday, 22 Dey 1403 — January 11, 2025')`
- `expect(page.locator('#weekday')).toHaveText('')` →
  `expect(page.locator('#full-date')).toBeHidden()`
- Delete the test `the month hint shows the resolved name and clears when invalid`
  and replace it with `the full date line tracks the converter in both languages`
  asserting the sentence in `en`, then after `#lang-toggle`, the `fa` sentence.
- In `year, month and day are the same cell at every breakpoint`, the six inputs
  are now all inside `.picker`; the assertions are unchanged and must still pass.

- [ ] **Step 2: Add coverage for the numeric filter and the year picker** — append to
`Site/e2e/picker.spec.ts`:

```typescript
test('fields refuse non-numeric characters', async ({ page }) => {
  await page.goto('/');
  for (const id of ['#p-y', '#p-m', '#p-d', '#g-y', '#g-m', '#g-d']) {
    await page.locator(id).fill('');
    await page.locator(id).pressSequentially('a1b2');
    await expect(page.locator(id), id).toHaveValue('12');
  }
});

test('pasted text is filtered to digits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403-10-22');
  await expect(page.locator('#p-y')).toHaveValue('1403'); // maxlength 4 then holds
});

test('maxlength caps each field', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('');
  await page.locator('#p-y').pressSequentially('123456');
  await expect(page.locator('#p-y')).toHaveValue('1234');
  await page.locator('#p-m').fill('');
  await page.locator('#p-m').pressSequentially('123');
  await expect(page.locator('#p-m')).toHaveValue('12');
});

test('the year picker lists the supported range and commits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y-toggle').click();
  await expect(page.locator('#p-y-list')).toBeVisible();
  await expect(page.locator('#p-y-list li')).toHaveCount(301);
  await expect(page.locator('#p-y-list li[data-value="1200"]')).toHaveText('1200');
  await expect(page.locator('#p-y-list li[data-value="1500"]')).toHaveText('1500');
  await page.locator('#p-y-list li[data-value="1403"]').click();
  await expect(page.locator('#p-y')).toHaveValue('1403');
  await expect(page.locator('#g-y-list li')).toHaveCount(0); // not rendered until opened
  await page.locator('#g-y-toggle').click();
  await expect(page.locator('#g-y-list li')).toHaveCount(300);
});
```

- [ ] **Step 3: Create `Site/e2e/calendar.spec.ts`:**

```typescript
import { expect, test } from '@playwright/test';

async function openPersianCalendar(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
}

test('the Persian calendar opens on the current month, Saturday first', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-title')).toHaveText('Dey 1403');
  const heads = await page.locator('#p-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(30); // Dey
  await expect(page.locator('#p-cal-grid .cal-cell.active')).toHaveText('22');
});

test('the Gregorian calendar starts weeks on Monday', async ({ page }) => {
  await page.goto('/');
  await page.locator('#g-cal').click();
  const heads = await page.locator('#g-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('picking a day drives the conversion and closes', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await page.locator('#p-cal-grid .cal-cell[data-day="1"]').click();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-d')).toHaveValue('1');
  // 1403-10-01 is 2024-12-21.
  await expect(page.locator('#g-y')).toHaveValue('2024');
  await expect(page.locator('#g-m')).toHaveValue('12');
  await expect(page.locator('#g-d')).toHaveValue('21');
});

test('month navigation rolls across the year boundary', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  for (let i = 0; i < 3; i++) await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Farvardin 1404');
  await page.locator('#p-cal-prev').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Esfand 1403');
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(30); // 1403 is leap
});

test('navigation stops at the supported range bound', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1200');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d').fill('1');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-prev')).toBeDisabled();
  await expect(page.locator('#p-cal-next')).toBeEnabled();
});

test('the calendar is keyboard operable', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-grid')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d23');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d30');
  await page.keyboard.press('PageUp');
  await expect(page.locator('#p-cal-title')).toHaveText('Azar 1403');
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-cal')).toBeFocused();
});

test('Enter picks the focused day', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-d')).toHaveValue('21');
});

test('only one popup is open across pickers and calendars', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
});

test('the calendar follows the language toggle', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-title')).toHaveText('Dey 1403');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-cal-title')).toHaveText('دی ۱۴۰۳');
  const heads = await page.locator('#p-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']);
});

test('calendar cells are comfortable touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-cal').click();
  const cell = await page.locator('#p-cal-grid .cal-cell').first().boundingBox();
  expect(cell!.width).toBeGreaterThanOrEqual(24);
  expect(cell!.height).toBeGreaterThanOrEqual(24);
});
```

- [ ] **Step 4: Run the full suite** — `cd Site && npx playwright test`.
Expected: all PASS. If something fails, the implementation is the suspect —
diagnose it and report the exact failing assertion and the actual value. You may
edit source files from Tasks 5–7 to fix a genuine defect, but never weaken an
assertion, and report every source edit with its justification.

- [ ] **Step 5: Commit**

```bash
git add Site/e2e
git commit -m "test(site): cover the calendar, year picker, and digit filter"
```

---

## Task 9: Layout, README, and full verification (last)

**Files:** Modify `Site/src/styles/components.css` and/or `Site/src/styles/tokens.css` only if the fold invariant fails; modify `README.md` and `docs/SECURITY.md`

- [ ] **Step 1: Re-verify the above-the-fold contract.**

Run: `cd Site && npx playwright test -g "above the fold"`

Removing three caption rows frees roughly 16px per fieldset while the full date
line costs about 20px, so this should still pass. If it fails, reclaim space in
this order, re-running after each: tighten `#full-date`'s `margin-top`; lower
`--space-section` inside the existing `@media (min-width: 1025px)` block in
`tokens.css`; shrink the desktop clock from 210px. Aim for ≥30px of slack at
1440×700, and update the `clock.height` assertion in `site.spec.ts` if the clock
changes.

- [ ] **Step 2: Update `README.md` and `docs/SECURITY.md`.**

- The Converter bullet: all six fields are pickers; fields reject non-numeric
  characters and are length-capped; captions replaced by one full date line that
  matches what Copy writes; a calendar button per side opens a month grid with
  Persian weeks starting Saturday and Gregorian weeks starting Monday.
- Repo layout: add `src/converter/calendar-grid-model.ts`, `src/ui/calendar-grid.ts`,
  `src/ui/numeric-input.ts`.
- Replace every Vitest and Playwright count and the bundle sizes with the real
  numbers from Step 3. Do not guess. `docs/SECURITY.md` line 69 carries the same
  two counts.

- [ ] **Step 3: Full verification**

Run: `cd Site && npm test && npx tsc --noEmit && npm run build && npx playwright test`
Expected: everything green. Record the exact counts and the gzipped JS/CSS sizes.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/SECURITY.md Site/src/styles
git commit -m "docs: calendar and year picker, updated counts and sizes"
```

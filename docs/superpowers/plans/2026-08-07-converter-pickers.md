# Converter Pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the month and day fields into type-or-pick controls — a numeric text input for speed, an ARIA listbox for discoverability — with each day option labelled by its weekday.

**Architecture:** Two new modules with a hard boundary. `src/converter/field-options.ts` is pure and vitest-tested: it turns raw field text into `{ value, label }` option lists, and owns all calendar and i18n knowledge. `src/ui/number-picker.ts` is DOM-only and knows nothing about calendars: it renders whatever options it is handed and owns popup mechanics (open/close, ARIA, keyboard, focus). `src/converter/converter.ts` wires them to the existing conversion pipeline. `convertFrom` is unchanged.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (chromium, port 4173).

**Spec:** `docs/superpowers/specs/2026-08-07-converter-pickers-design.md`

## Global Constraints

- **No new dependencies**, runtime or dev. Everything is plain TypeScript.
- **Both languages always.** Every user-visible string comes from `STRINGS` / `PERSIAN_MONTHS` / `GREGORIAN_MONTHS` / `WEEKDAYS` in `src/i18n/strings.ts`. Never hardcode display text in markup or logic.
- **Option `value` is always an ASCII integer**; only `label` is localized.
- **Never rewrite the field the user is typing in** — conversion writes only the opposite side.
- **Do not touch** `Lib/`, `Console/`, `Tests/` (C#), `Site/sw.js`, or `deploy/`.
- **Working dir:** all `npm` commands run in `Site/`.
- **Commits:** commit exactly the files your task lists, conventional-commit messages, never push, never commit unrelated files.
- **Verified ground truth** (probed from `src/calendar/persian.ts`; use these vectors, do not invent others):
  - Persian leap years near the present: 1399, 1403, 1408, 1412.
  - `daysInPersianMonth(1403, 12)` = 30 (leap); `daysInPersianMonth(1404, 12)` = 29.
  - `daysInPersianMonth(1403, 10)` = 30 (Dey); `daysInPersianMonth(1403, 1)` = 31 (Farvardin).
  - `toGregorian({py:1403, pm:10, pd:22})` = `{gy:2025, gm:1, gd:11}`, a **Saturday**.
  - `toGregorian({py:1403, pm:10, pd:1})` = `{gy:2024, gm:12, gd:21}`, also a **Saturday**.
  - `daysInGregorianMonth(2024, 2)` = 29; `daysInGregorianMonth(2025, 2)` = 28.
- **Phases:** Task 1 first, alone. Tasks 2 and 3 are parallel-safe (disjoint files). Task 4 needs 1–3. Tasks 5 and 6 are parallel-safe after 4. Task 7 last.

---

## Task 1: `field-options.ts` — the pure option source

**Files:**
- Create: `Site/src/converter/field-options.ts`
- Test: `Site/tests/field-options.test.ts` (new)

**Interfaces:**
- Consumes: `daysInPersianMonth`, `daysInGregorianMonth`, `toGregorian`, `PERSIAN_YEAR_MIN`, `PERSIAN_YEAR_MAX` from `../calendar/persian`; `normalizeDigits`, `GREGORIAN_YEAR_MIN`, `GREGORIAN_YEAR_MAX`, `type Side` from `./converter-core`; `weekdayName` from `../i18n/format`; `PERSIAN_MONTHS`, `GREGORIAN_MONTHS`, `toLocaleDigits`, `type Lang` from `../i18n/strings`. All already exist.
- Produces (Tasks 2 and 4 depend on these exact names):
  - `export interface FieldOption { value: number; label: string }`
  - `export function parseInRange(raw: string, min: number, max: number): number | null`
  - `export function monthOptions(side: Side, lang: Lang): readonly FieldOption[]`
  - `export function dayOptions(side: Side, rawYear: string, rawMonth: string, lang: Lang): readonly FieldOption[]`

- [ ] **Step 1: Write the failing tests** — create `Site/tests/field-options.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { dayOptions, monthOptions, parseInRange } from '../src/converter/field-options';

describe('parseInRange', () => {
  it('accepts in-range ASCII, Persian, and Arabic digits', () => {
    expect(parseInRange('5', 1, 12)).toBe(5);
    expect(parseInRange('۵', 1, 12)).toBe(5);
    expect(parseInRange('٥', 1, 12)).toBe(5);
    expect(parseInRange(' 12 ', 1, 12)).toBe(12);
    expect(parseInRange('05', 1, 12)).toBe(5);
  });
  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parseInRange('', 1, 12)).toBeNull();
    expect(parseInRange('abc', 1, 12)).toBeNull();
    expect(parseInRange('1.5', 1, 12)).toBeNull();
    expect(parseInRange('1e3', 1, 12)).toBeNull();
    expect(parseInRange('-1', 1, 12)).toBeNull();
    expect(parseInRange('0', 1, 12)).toBeNull();
    expect(parseInRange('13', 1, 12)).toBeNull();
  });
});

describe('monthOptions', () => {
  it('labels Persian months with number and name', () => {
    const en = monthOptions('persian', 'en');
    expect(en).toHaveLength(12);
    expect(en[4]).toEqual({ value: 5, label: '5 Mordad' });
    expect(en[11]).toEqual({ value: 12, label: '12 Esfand' });
  });
  it('localizes digits and names in Persian', () => {
    expect(monthOptions('persian', 'fa')[4]).toEqual({ value: 5, label: '۵ مرداد' });
  });
  it('labels Gregorian months', () => {
    expect(monthOptions('gregorian', 'en')[7]).toEqual({ value: 8, label: '8 August' });
    expect(monthOptions('gregorian', 'fa')[7]).toEqual({ value: 8, label: '۸ اوت' });
  });
});

describe('dayOptions — valid year and month', () => {
  it('uses the real month length', () => {
    expect(dayOptions('persian', '1403', '1', 'en')).toHaveLength(31);  // Farvardin
    expect(dayOptions('persian', '1403', '10', 'en')).toHaveLength(30); // Dey
    expect(dayOptions('persian', '1403', '12', 'en')).toHaveLength(30); // Esfand, leap
    expect(dayOptions('persian', '1404', '12', 'en')).toHaveLength(29); // Esfand, common
    expect(dayOptions('gregorian', '2024', '2', 'en')).toHaveLength(29);
    expect(dayOptions('gregorian', '2025', '2', 'en')).toHaveLength(28);
  });
  it('labels each Persian day with its weekday', () => {
    const options = dayOptions('persian', '1403', '10', 'en');
    // 1403-10-01 → 2024-12-21 (Saturday); 1403-10-22 → 2025-01-11 (Saturday).
    expect(options[0]).toEqual({ value: 1, label: '1 Saturday' });
    expect(options[21]).toEqual({ value: 22, label: '22 Saturday' });
    expect(options[22]).toEqual({ value: 23, label: '23 Sunday' });
  });
  it('labels each Gregorian day with its weekday', () => {
    const options = dayOptions('gregorian', '2025', '1', 'en');
    expect(options[10]).toEqual({ value: 11, label: '11 Saturday' });
  });
  it('localizes digits and weekday names in Persian', () => {
    const options = dayOptions('persian', '1403', '10', 'fa');
    expect(options[21]).toEqual({ value: 22, label: '۲۲ شنبه' });
  });
  it('treats non-ASCII digit input the same as ASCII', () => {
    expect(dayOptions('persian', '۱۴۰۳', '۱۰', 'en'))
      .toEqual(dayOptions('persian', '1403', '10', 'en'));
  });
});

describe('dayOptions — fallback', () => {
  it('returns 31 plain options when the year or month is unusable', () => {
    for (const [y, m] of [['', ''], ['1403', ''], ['', '10'], ['abc', '10'],
      ['1403', '13'], ['1403', '0'], ['1199', '10'], ['1501', '10']] as const) {
      const options = dayOptions('persian', y, m, 'en');
      expect(options, `year="${y}" month="${m}"`).toHaveLength(31);
      expect(options[0], `year="${y}" month="${m}"`).toEqual({ value: 1, label: '1' });
      expect(options[30], `year="${y}" month="${m}"`).toEqual({ value: 31, label: '31' });
    }
  });
  it('respects the Gregorian year range in the fallback', () => {
    expect(dayOptions('gregorian', '1821', '1', 'en')).toHaveLength(31);
    expect(dayOptions('gregorian', '2122', '1', 'en')).toHaveLength(31);
    expect(dayOptions('gregorian', '1822', '2', 'en')).toHaveLength(28);
  });
  it('localizes fallback digits', () => {
    expect(dayOptions('persian', '', '', 'fa')[21]).toEqual({ value: 22, label: '۲۲' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Site && npx vitest run tests/field-options.test.ts`
Expected: FAIL — `src/converter/field-options.ts` does not exist.

- [ ] **Step 3: Create `Site/src/converter/field-options.ts`:**

```typescript
import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian,
  type GregorianDateParts,
} from '../calendar/persian';
import {
  GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN, normalizeDigits, type Side,
} from './converter-core';
import { weekdayName } from '../i18n/format';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, type Lang,
} from '../i18n/strings';

/** One entry in a NumberPicker popup. `value` is always an ASCII integer. */
export interface FieldOption { value: number; label: string }

/** Longest month in either calendar — the length of the no-context fallback list. */
const MAX_DAYS = 31;

/**
 * Parse a raw field to an integer within [min, max], or null.
 *
 * Stricter than converter-core's `parseField`: an all-digits test rejects
 * `1.5` and `1e3`, which `Number()` would happily accept. Option lists must
 * never be built from a value the user did not type as a plain integer.
 */
export function parseInRange(raw: string, min: number, max: number): number | null {
  const cleaned = normalizeDigits(raw.trim());
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= min && n <= max ? n : null;
}

export function monthOptions(side: Side, lang: Lang): readonly FieldOption[] {
  const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  return names.map((name, i) => ({
    value: i + 1,
    label: `${toLocaleDigits(i + 1, lang)} ${name}`,
  }));
}

/**
 * Day options for one side. With a usable year and month, every day of that
 * month is labelled with its weekday; otherwise a plain 1–31 list keeps the
 * popup useful without ever showing a weekday that would be wrong.
 */
export function dayOptions(
  side: Side, rawYear: string, rawMonth: string, lang: Lang,
): readonly FieldOption[] {
  const [yearMin, yearMax] = side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  const y = parseInRange(rawYear, yearMin, yearMax);
  const m = parseInRange(rawMonth, 1, 12);
  if (y === null || m === null) return plainDays(lang);

  const count = side === 'persian'
    ? daysInPersianMonth(y, m)
    : daysInGregorianMonth(y, m);
  return Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    const g: GregorianDateParts = side === 'persian'
      ? toGregorian({ py: y, pm: m, pd: d })
      : { gy: y, gm: m, gd: d };
    return { value: d, label: `${toLocaleDigits(d, lang)} ${weekdayName(g, lang)}` };
  });
}

function plainDays(lang: Lang): readonly FieldOption[] {
  return Array.from({ length: MAX_DAYS }, (_, i) => ({
    value: i + 1,
    label: toLocaleDigits(i + 1, lang),
  }));
}
```

- [ ] **Step 4: Run the full Vitest suite**

Run: `cd Site && npm test`
Expected: all PASS — the existing 59 plus the new ones.

- [ ] **Step 5: Commit**

```bash
git add Site/src/converter/field-options.ts Site/tests/field-options.test.ts
git commit -m "feat(site): month and weekday-labelled day option sources"
```

---

## Task 2: `number-picker.ts` — the popup component (after Task 1; parallel with Task 3)

**Files:**
- Create: `Site/src/ui/number-picker.ts`

**Interfaces:**
- Consumes: `type FieldOption` from `../converter/field-options` (Task 1); `normalizeDigits` from `../converter/converter-core`.
- Produces (Task 4 depends on these exact names):
  - `export interface NumberPicker { setOptions(options: readonly FieldOption[]): void; close(): void }`
  - `export function createNumberPicker(parts: { input: HTMLInputElement; toggle: HTMLButtonElement; list: HTMLElement; onCommit: (value: number) => void }): NumberPicker`
  - Option elements get `id="<list.id>-o<value>"` and `data-value="<value>"`. Task 5's E2E selectors depend on this.

This task is DOM mechanics with no calendar knowledge. It is covered by E2E in Task 5, not by Vitest — the repo has no DOM test environment and the constraint forbids adding one. This mirrors phase 1, where the DOM-wiring task was likewise E2E-only.

- [ ] **Step 1: Create `Site/src/ui/number-picker.ts`:**

```typescript
import type { FieldOption } from '../converter/field-options';
import { normalizeDigits } from '../converter/converter-core';

export interface NumberPicker {
  setOptions(options: readonly FieldOption[]): void;
  close(): void;
}

interface Parts {
  input: HTMLInputElement;
  toggle: HTMLButtonElement;
  list: HTMLElement;
  /** Called with the chosen option's value. The caller owns writing the field. */
  onCommit: (value: number) => void;
}

/**
 * A type-or-pick numeric field: the input stays a plain text field, and the
 * popup is an ARIA listbox driven by aria-activedescendant so focus never
 * leaves the input and typing keeps working while the list is open.
 *
 * Deliberately ignorant of calendars, languages, and digits — it renders the
 * options it is handed and reports the value that was chosen.
 */
export function createNumberPicker({ input, toggle, list, onCommit }: Parts): NumberPicker {
  let options: readonly FieldOption[] = [];
  let activeIndex = -1;
  let isOpen = false;
  /** Where focus returns when the popup closes: whatever opened it. */
  let invoker: HTMLElement = input;

  /** Index of the option matching the field's current number, or -1. */
  const selectedIndex = (): number => {
    const cleaned = normalizeDigits(input.value.trim());
    if (!/^\d+$/.test(cleaned)) return -1;
    const n = Number(cleaned);
    return options.findIndex((o) => o.value === n);
  };

  const paint = (): void => {
    const selected = selectedIndex();
    const children = [...list.children];
    children.forEach((child, i) => {
      const el = child as HTMLElement;
      el.classList.toggle('active', i === activeIndex);
      el.setAttribute('aria-selected', String(i === selected));
    });
    const active = activeIndex >= 0
      ? (children[activeIndex] as HTMLElement | undefined)
      : undefined;
    if (active === undefined) {
      input.removeAttribute('aria-activedescendant');
    } else {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  };

  const render = (): void => {
    list.replaceChildren(...options.map((option) => {
      const li = document.createElement('li');
      li.id = `${list.id}-o${option.value}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset['value'] = String(option.value);
      li.textContent = option.label;
      return li;
    }));
  };

  const setExpanded = (value: boolean): void => {
    isOpen = value;
    list.hidden = !value;
    input.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-expanded', String(value));
  };

  const open = (from: HTMLElement, fallback: 'first' | 'last'): void => {
    if (options.length === 0) return;
    invoker = from;
    const selected = selectedIndex();
    activeIndex = selected >= 0
      ? selected
      : (fallback === 'first' ? 0 : options.length - 1);
    setExpanded(true);
    paint();
  };

  const close = (restoreFocus: boolean): void => {
    if (!isOpen) return;
    setExpanded(false);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    if (restoreFocus) invoker.focus();
  };

  const commit = (index: number): void => {
    const option = options[index];
    if (option === undefined) return;
    close(true);
    onCommit(option.value);
  };

  const move = (delta: number): void => {
    if (options.length === 0) return;
    const next = activeIndex < 0 ? (delta > 0 ? 0 : options.length - 1) : activeIndex + delta;
    activeIndex = Math.min(options.length - 1, Math.max(0, next));
    paint();
  };

  input.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) move(1); else open(input, 'first');
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) move(-1); else open(input, 'last');
        return;
      case 'Home':
        if (!isOpen) return;
        event.preventDefault();
        activeIndex = 0;
        paint();
        return;
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        activeIndex = options.length - 1;
        paint();
        return;
      case 'Enter':
        if (!isOpen) return;
        // Suppressed even when nothing is active, so Enter never submits.
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex); else close(true);
        return;
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        close(true); // The typed value stands.
        return;
      case 'Tab':
        close(false); // Let focus proceed to the next field.
        return;
      default:
        return;
    }
  });

  // Keep the browser from moving focus on press: `click` decides where it belongs.
  toggle.addEventListener('mousedown', (event) => { event.preventDefault(); });
  toggle.addEventListener('click', () => {
    if (isOpen) { close(true); return; }
    // Opened by keyboard-then-click → focus returns to the input; opened by a
    // bare tap → focus stays on the toggle, so no OS keyboard covers the list.
    open(document.activeElement === input ? input : toggle, 'first');
  });

  list.addEventListener('mousedown', (event) => { event.preventDefault(); });
  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest('li');
    if (li === null || li.parentElement !== list) return;
    const index = [...list.children].indexOf(li);
    if (index >= 0) commit(index);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen) return;
    const target = event.target as Node;
    if (target === input || toggle.contains(target) || list.contains(target)) return;
    close(false);
  });

  return {
    setOptions(next) {
      options = next;
      render();
      if (!isOpen) return;
      // Stay usable across a re-render: clamp the cursor and repaint in place.
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      paint();
    },
    close() { close(false); },
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd Site && npx tsc --noEmit`
Expected: clean. (Nothing imports the module yet — Task 4 wires it.)

- [ ] **Step 3: Commit**

```bash
git add Site/src/ui/number-picker.ts
git commit -m "feat(site): ARIA listbox number picker component"
```

---

## Task 3: Markup, strings, and styles (after Task 1; parallel with Task 2)

**Files:**
- Modify: `Site/index.html` (both fieldsets)
- Modify: `Site/src/i18n/strings.ts` (two new keys)
- Modify: `Site/src/styles/components.css` (picker + hint styles; drop `select` rules)

**Interfaces:**
- Consumes: nothing.
- Produces (Task 4 depends on these exact names): DOM ids `p-m`, `p-m-toggle`, `p-m-list`, `p-m-hint`, `p-d`, `p-d-toggle`, `p-d-list`, and the `g-` equivalents. New `StringKey`s `chooseMonth` and `chooseDay`. CSS classes `.picker`, `.picker-toggle`, `.picker-list`, `.hint`, and `li.active`.

- [ ] **Step 1: Add the two string keys to `Site/src/i18n/strings.ts`**

Extend the `StringKey` union — insert `'chooseMonth' | 'chooseDay'` after `'copyFailed'`:

```typescript
export type StringKey =
  | 'pageTitle' | 'persianLabel' | 'gregorianLabel'
  | 'year' | 'month' | 'day' | 'tehranLabel' | 'langToggle'
  | 'today' | 'copy' | 'copied' | 'copyFailed'
  | 'chooseMonth' | 'chooseDay'
  | 'errYearRange' | 'errMonth' | 'errDay';
```

Add to `STRINGS.en`, after `copyFailed`:

```typescript
    chooseMonth: 'Choose month',
    chooseDay: 'Choose day',
```

Add to `STRINGS.fa`, after `copyFailed`:

```typescript
    chooseMonth: 'انتخاب ماه',
    chooseDay: 'انتخاب روز',
```

- [ ] **Step 2: Replace both fieldsets' `.fields` blocks in `Site/index.html`**

The Persian fieldset's `<div class="fields">` becomes exactly:

```html
          <div class="fields">
            <label><span data-str="year"></span>
              <input id="p-y" type="text" inputmode="numeric" />
              <span class="hint"></span></label>
            <label><span data-str="month"></span>
              <div class="picker">
                <input id="p-m" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="p-m-list"
                       aria-autocomplete="none" />
                <button id="p-m-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-m-list">▾</button>
                <ul id="p-m-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint" id="p-m-hint"></span></label>
            <label><span data-str="day"></span>
              <div class="picker">
                <input id="p-d" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="p-d-list"
                       aria-autocomplete="none" />
                <button id="p-d-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-d-list">▾</button>
                <ul id="p-d-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint"></span></label>
          </div>
```

The Gregorian fieldset's `<div class="fields">` is the same with every `p-` id replaced by `g-`:

```html
          <div class="fields">
            <label><span data-str="year"></span>
              <input id="g-y" type="text" inputmode="numeric" />
              <span class="hint"></span></label>
            <label><span data-str="month"></span>
              <div class="picker">
                <input id="g-m" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="g-m-list"
                       aria-autocomplete="none" />
                <button id="g-m-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="g-m-list">▾</button>
                <ul id="g-m-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint" id="g-m-hint"></span></label>
            <label><span data-str="day"></span>
              <div class="picker">
                <input id="g-d" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="g-d-list"
                       aria-autocomplete="none" />
                <button id="g-d-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="g-d-list">▾</button>
                <ul id="g-d-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint"></span></label>
          </div>
```

The empty `.hint` spans on the year and day labels are deliberate: they reserve the same row height so the two fieldsets stay baseline-aligned.

- [ ] **Step 3: Update `Site/src/styles/components.css`**

Replace the three rules that mention `select` (lines 26–34 in the current file) with:

```css
.fields input {
  width: 4.5rem; padding: 0.45rem 0.5rem; font: inherit; text-align: center;
  color: var(--text); background: var(--surface-raised);
  border: 1px solid var(--hairline); border-radius: 6px;
  transition: border-color var(--duration) var(--ease);
}
.fields input:focus { border-color: var(--accent); outline: none; }
.fields input#p-y, .fields input#g-y { width: 5.5rem; }
```

(The `.fields select { width: auto; min-width: 7rem; }` rule is deleted outright — there are no selects left, and the month names now live in the popup, which is what lets the fields be narrow again.)

Add after the `#status-row button::after` rule:

```css
/* Reserved height so a month name appearing or clearing never shifts the
   layout, and so year/month/day labels keep a common baseline. */
.hint {
  min-height: 1.1em; font-size: 0.7rem; line-height: 1.1;
  color: var(--text-muted); text-align: center;
  white-space: nowrap; overflow: hidden;
}

.picker { position: relative; width: 4.5rem; }
.picker input { width: 100%; padding-inline-end: 1.5rem; }
.picker-toggle {
  position: absolute; inset-block: 0; inset-inline-end: 0; width: 1.5rem;
  display: grid; place-items: center;
  background: none; border: 0; padding: 0; cursor: pointer;
  color: var(--text-muted); font-size: 0.7rem; line-height: 1;
  transition: color var(--duration) var(--ease);
}
.picker-toggle:hover { color: var(--accent); }
.picker input:focus + .picker-toggle { color: var(--accent); }
/* Anchored to the field's start edge so RTL opens toward the page centre.
   width:max-content lets "۲۲ چهارشنبه" breathe past the 4.5rem field. */
.picker-list {
  position: absolute; z-index: 10;
  inset-inline-start: 0; inset-block-start: calc(100% + 4px);
  min-width: 100%; width: max-content; max-width: 60vw;
  max-height: min(50vh, 20rem); overflow-y: auto; overscroll-behavior: contain;
  margin: 0; padding: 0.25rem; list-style: none;
  background: var(--surface-raised); border: 1px solid var(--hairline);
  border-radius: 6px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
  font-size: 0.85rem; color: var(--text); text-align: start;
}
.picker-list li {
  padding: 0.35rem 0.5rem; border-radius: 4px; cursor: pointer; white-space: nowrap;
}
/* Two distinct signals: `active` is the keyboard cursor, aria-selected is the
   value the field currently holds. */
.picker-list li.active { background: var(--hairline); }
.picker-list li[aria-selected='true'] { color: var(--accent); }
```

In the touch-target media block at the bottom of the file, replace its body:

```css
@media (max-width: 1024px), (pointer: coarse) {
  .fields input { min-height: 44px; font-size: 1rem; }
  .picker-toggle { width: 2rem; }
  .picker input { padding-inline-end: 2rem; }
  .picker-list li { min-height: 44px; display: flex; align-items: center; font-size: 1rem; }
}
```

- [ ] **Step 4: Build and type-check**

Run: `cd Site && npx tsc --noEmit && npm run build`
Expected: clean. The page will render with empty popups until Task 4 wires them — that is expected at this point.

- [ ] **Step 5: Commit**

```bash
git add Site/index.html Site/src/i18n/strings.ts Site/src/styles/components.css
git commit -m "feat(site): picker markup, labels, and styles"
```

---

## Task 4: Wire the pickers into `converter.ts` (after Tasks 1–3)

**Files:**
- Modify: `Site/src/converter/converter.ts` (substantial rework)
- Modify: `Site/e2e/site.spec.ts` (month fields are inputs now)
- Modify: `Site/e2e/converter-ux.spec.ts` (month fields are inputs now)

**Interfaces:**
- Consumes: `monthOptions`, `dayOptions`, `parseInRange`, `type FieldOption` (Task 1); `createNumberPicker`, `type NumberPicker` (Task 2); the DOM ids and `chooseMonth`/`chooseDay` strings (Task 3); the existing `convertFrom`, `formatUrlQuery`, `copySentence`, `weekdayName`, `nowSnapshot`.
- Produces: `setupConverter(getLang)` keeps its exact return shape `{ prefill, rerender }`, so `main.ts` needs **no change**.

- [ ] **Step 1: Replace `Site/src/converter/converter.ts` entirely with:**

```typescript
import { convertFrom, type Side } from './converter-core';
import { dayOptions, monthOptions, parseInRange } from './field-options';
import { formatUrlQuery } from './url-state';
import { createNumberPicker, type NumberPicker } from '../ui/number-picker';
import { nowSnapshot } from '../calendar/now';
import { copySentence, weekdayName } from '../i18n/format';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';

const COPIED_RESET_MS = 1500;
const SIDES = ['persian', 'gregorian'] as const;
const ID_PREFIX: Record<Side, 'p' | 'g'> = { persian: 'p', gregorian: 'g' };

interface SideRefs {
  y: HTMLInputElement;
  m: HTMLInputElement;
  d: HTMLInputElement;
  monthToggle: HTMLButtonElement;
  dayToggle: HTMLButtonElement;
  monthList: HTMLElement;
  dayList: HTMLElement;
  monthHint: HTMLElement;
  monthPicker: NumberPicker;
  dayPicker: NumberPicker;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function setupConverter(getLang: () => Lang): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
} {
  const error = byId<HTMLElement>('converter-error');
  const weekdayEl = byId<HTMLElement>('weekday');
  const btnToday = byId<HTMLButtonElement>('btn-today');
  const btnCopy = byId<HTMLButtonElement>('btn-copy');

  let lastEdited: Side = 'persian';
  let lastOk: { p: PersianDateParts; g: GregorianDateParts } | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  /** Last day-option signature per side: keystrokes that cannot change the
      list skip rebuilding up to 31 nodes. */
  const dayKey: Record<Side, string> = { persian: '', gregorian: '' };

  // `run` is referenced by the picker callbacks below and defined further down;
  // function declarations hoist, and nothing can fire before setup returns.
  const refs = Object.fromEntries(SIDES.map((side) => {
    const p = ID_PREFIX[side];
    const m = byId<HTMLInputElement>(`${p}-m`);
    const d = byId<HTMLInputElement>(`${p}-d`);
    const monthToggle = byId<HTMLButtonElement>(`${p}-m-toggle`);
    const dayToggle = byId<HTMLButtonElement>(`${p}-d-toggle`);
    const monthList = byId<HTMLElement>(`${p}-m-list`);
    const dayList = byId<HTMLElement>(`${p}-d-list`);
    const entry: SideRefs = {
      y: byId<HTMLInputElement>(`${p}-y`), m, d,
      monthToggle, dayToggle, monthList, dayList,
      monthHint: byId<HTMLElement>(`${p}-m-hint`),
      monthPicker: createNumberPicker({
        input: m, toggle: monthToggle, list: monthList,
        onCommit: (value) => {
          m.value = toLocaleDigits(value, getLang());
          run(side, true);
        },
      }),
      dayPicker: createNumberPicker({
        input: d, toggle: dayToggle, list: dayList,
        onCommit: (value) => {
          d.value = toLocaleDigits(value, getLang());
          run(side, true);
        },
      }),
    };
    return [side, entry] as const;
  })) as Record<Side, SideRefs>;

  const setSide = (side: Side, p: PersianDateParts, g: GregorianDateParts): void => {
    const lang = getLang();
    const r = refs[side];
    if (side === 'persian') {
      r.y.value = toLocaleDigits(p.py, lang);
      r.m.value = toLocaleDigits(p.pm, lang);
      r.d.value = toLocaleDigits(p.pd, lang);
    } else {
      r.y.value = toLocaleDigits(g.gy, lang);
      r.m.value = toLocaleDigits(g.gm, lang);
      r.d.value = toLocaleDigits(g.gd, lang);
    }
  };

  const showError = (message: string | null): void => {
    error.hidden = message === null;
    error.textContent = message ?? '';
  };

  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    weekdayEl.textContent = ok ? weekdayName(ok.g, getLang()) : '';
    btnCopy.disabled = ok === null;
  };

  /** Month hint text and day options for both sides, after any field changes. */
  const refreshOptions = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      const monthNumber = parseInRange(r.m.value, 1, 12);
      const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      r.monthHint.textContent = monthNumber === null
        ? ''
        : (names[monthNumber - 1] as string);

      const key = `${lang}|${r.y.value}|${r.m.value}`;
      if (key === dayKey[side]) continue;
      dayKey[side] = key;
      r.dayPicker.setOptions(dayOptions(side, r.y.value, r.m.value, lang));
    }
  };

  /** Month option lists and the pickers' accessible names. */
  const renderLabels = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      r.monthPicker.setOptions(monthOptions(side, lang));
      for (const [el, key] of [
        [r.monthToggle, 'chooseMonth'], [r.monthList, 'chooseMonth'],
        [r.dayToggle, 'chooseDay'], [r.dayList, 'chooseDay'],
      ] as const) {
        el.setAttribute('aria-label', STRINGS[lang][key]);
      }
    }
    // Every day label carries digits and a weekday name, so a language change
    // invalidates all of them.
    dayKey.persian = '';
    dayKey.gregorian = '';
  };

  function run(source: Side, updateUrl: boolean): void {
    lastEdited = source;
    const lang = getLang();
    const f = refs[source];
    const outcome = convertFrom(source, { y: f.y.value, m: f.m.value, d: f.d.value });
    if (outcome.status === 'ok') {
      setSide(source === 'persian' ? 'gregorian' : 'persian', outcome.persian, outcome.gregorian);
      showError(null);
      setStatus({ p: outcome.persian, g: outcome.gregorian });
      if (updateUrl) {
        const { persian: p, gregorian: g } = outcome;
        history.replaceState(null, '', source === 'persian'
          ? formatUrlQuery('persian', p.py, p.pm, p.pd)
          : formatUrlQuery('gregorian', g.gy, g.gm, g.gd));
      }
      refreshOptions();
      return;
    }
    setStatus(null);
    if (outcome.status === 'incomplete') {
      showError(null);
      refreshOptions();
      return;
    }
    const params = { ...outcome.params };
    if (outcome.errorKey === 'errDay') {
      const months = outcome.side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      (params as Record<string, string | number>)['month'] =
        months[(outcome.params['month'] as number) - 1] as string;
    }
    showError(formatTemplate(STRINGS[lang][outcome.errorKey], params, lang));
    refreshOptions();
  }

  const prefill = (p: PersianDateParts, g: GregorianDateParts): void => {
    setSide('persian', p, g);
    setSide('gregorian', p, g);
    showError(null);
    setStatus({ p, g });
    refreshOptions();
  };

  renderLabels();

  for (const side of SIDES) {
    const r = refs[side];
    // Year and month both feed the day list: month length and weekday names
    // depend on the year, so a year edit must regenerate the days too.
    for (const field of [r.y, r.m, r.d]) {
      field.addEventListener('input', () => run(side, true));
    }
  }

  btnToday.addEventListener('click', () => {
    for (const side of SIDES) {
      refs[side].monthPicker.close();
      refs[side].dayPicker.close();
    }
    const snap = nowSnapshot();
    prefill(snap.local.p, snap.local.g);
    history.replaceState(null, '', window.location.pathname);
  });

  const flashCopyLabel = (key: 'copied' | 'copyFailed'): void => {
    const lang = getLang();
    btnCopy.textContent = STRINGS[lang][key];
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      btnCopy.textContent = STRINGS[getLang()].copy;
    }, COPIED_RESET_MS);
  };

  btnCopy.addEventListener('click', () => {
    if (lastOk === null) return;
    navigator.clipboard.writeText(copySentence(lastOk.p, lastOk.g, getLang()))
      .then(() => flashCopyLabel('copied'))
      .catch(() => flashCopyLabel('copyFailed'));
  });

  return {
    prefill,
    rerender: () => {
      renderLabels();
      // Own the copy button's label regardless of caller ordering: a pending
      // "Copied"/"Copy failed" flash must not survive a language toggle.
      clearTimeout(copiedTimer);
      btnCopy.textContent = STRINGS[getLang()].copy;
      // Language switch: refresh digits/labels on BOTH sides from the last
      // valid state (the user is not mid-typing during a toggle).
      if (lastOk !== null) {
        setSide('persian', lastOk.p, lastOk.g);
        setSide('gregorian', lastOk.p, lastOk.g);
        setStatus(lastOk);
        showError(null);
        refreshOptions();
      } else {
        run(lastEdited, false);
      }
    },
  };
}
```

- [ ] **Step 2: Build and type-check**

Run: `cd Site && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Update the month call sites in `Site/e2e/site.spec.ts`**

Month fields are text inputs now, so `selectOption` no longer applies:

- line ~24 (`persian → gregorian live conversion`): `await page.locator('#p-m').selectOption('10');` → `await page.locator('#p-m').fill('10');`
- line ~34 (`gregorian → persian live conversion`): `await page.locator('#g-m').selectOption('7');` → `await page.locator('#g-m').fill('7');`
- line ~44 (`invalid day shows localized month-aware error`): `await page.locator('#p-m').selectOption('12');` → `await page.locator('#p-m').fill('12');`

In both touch-target tests, change the locator `'.fields input, .fields select'` to `'.fields input'`, and append this assertion inside each test's viewport loop, after the existing input loop:

```typescript
  for (const toggle of await page.locator('.picker-toggle').all()) {
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  }
```

- [ ] **Step 4: Update `Site/e2e/converter-ux.spec.ts`**

Replace the `enterPersianDate` helper's month line and the two option-label tests. The helper becomes:

```typescript
async function enterPersianDate(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
}
```

Replace the whole `month dropdowns carry localized labels and survive the language toggle` test with:

```typescript
test('month options carry localized labels and survive the language toggle', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('5 Mordad');
  await page.locator('#p-m-list li[data-value="5"]').click();
  await expect(page.locator('#p-m')).toHaveValue('5');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('۵ مرداد');
  await expect(page.locator('#p-m')).toHaveValue('۵'); // value preserved, digits localized
});
```

In `persian digits typed into fields convert identically to ASCII`, change `await page.locator('#g-m').selectOption('7');` to `await page.locator('#g-m').fill('7');`.

In `weekday clears and copy disables on invalid date`, change `await page.locator('#p-m').selectOption('12');` to `await page.locator('#p-m').fill('12');`.

- [ ] **Step 5: Run the full E2E suite**

Run: `cd Site && npx playwright test`
Expected: all PASS. This step proves no regressions; new-feature coverage is Task 5. If the above-the-fold test fails, leave it — Task 6 owns that and will re-tune the layout.

- [ ] **Step 6: Commit**

```bash
git add Site/src/converter/converter.ts Site/e2e/site.spec.ts Site/e2e/converter-ux.spec.ts
git commit -m "feat(site): type-or-pick month and day fields with weekday-labelled days"
```

---

## Task 5: E2E coverage for the pickers (after Task 4; parallel with Task 6)

**Files:**
- Create: `Site/e2e/picker.spec.ts`

**Interfaces:**
- Consumes: the DOM ids and `data-value` option contract from Tasks 2–4.
- Produces: test file only.

- [ ] **Step 1: Create `Site/e2e/picker.spec.ts`:**

```typescript
import { expect, test } from '@playwright/test';

// Fixed vector: 1403-10-22 ↔ 2025-01-11 (Saturday), shared with the unit tests.
// 1403 is a Persian leap year; Dey (month 10) has 30 days.

test('chevron opens the month list with localized number-and-name labels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await expect(page.locator('#p-m-list li')).toHaveCount(12);
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('5 Mordad');
  await expect(page.locator('#g-m-list li[data-value="8"]')).toHaveText('8 August');
});

test('clicking a month option commits it and drives the conversion', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-m-toggle').click();
  await page.locator('#p-m-list li[data-value="10"]').click();
  await expect(page.locator('#p-m')).toHaveValue('10');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-m')).toHaveValue('1');
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('typing a month converts without ever opening the popup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('day options carry weekday names and respect month length', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(30); // Dey
  await expect(page.locator('#p-d-list li[data-value="1"]')).toHaveText('1 Saturday');
  await expect(page.locator('#p-d-list li[data-value="22"]')).toHaveText('22 Saturday');
  await expect(page.locator('#p-d-list li[data-value="23"]')).toHaveText('23 Sunday');
});

test('day list regenerates when the month or year changes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(31); // Farvardin
  await page.locator('#p-m').fill('12');
  await expect(page.locator('#p-d-list li')).toHaveCount(30); // Esfand, 1403 is leap
  await page.locator('#p-y').fill('1404');
  await expect(page.locator('#p-d-list li')).toHaveCount(29); // Esfand, 1404 is common
});

test('day list falls back to a plain 1–31 list without a usable year', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(31);
  await expect(page.locator('#p-d-list li[data-value="22"]')).toHaveText('22');
});

test('keyboard: arrows open and move, Enter commits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown'); // opens at the selected option (1)
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('ArrowDown'); // → 2
  await page.keyboard.press('ArrowDown'); // → 3
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('3');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toBeFocused(); // focus returns to the invoker
});

test('keyboard: Escape closes and keeps the typed value; Tab closes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('7');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('ArrowDown'); // move off the selected option
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toHaveValue('7'); // untouched by the cursor move
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('#p-m-list')).toBeHidden();
});

test('keyboard: Home and End jump to the ends of the list', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('12');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('1');
});

test('ARIA state tracks the popup and the active option', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  const input = page.locator('#p-m');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(page.locator('#p-m-list')).toHaveAttribute('role', 'listbox');
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(input).toHaveAttribute('aria-activedescendant', 'p-m-list-o5');
  await expect(page.locator('#p-m-list li[data-value="5"]'))
    .toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'p-m-list-o6');
  // aria-selected still marks the field's value, not the cursor.
  await expect(page.locator('#p-m-list li[data-value="5"]'))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#p-m-list li[data-value="6"]'))
    .toHaveAttribute('aria-selected', 'false');
});

test('toggles carry a localized accessible name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-label', 'Choose month');
  await expect(page.locator('#p-d-toggle')).toHaveAttribute('aria-label', 'Choose day');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-label', 'انتخاب ماه');
  await expect(page.locator('#p-d-toggle')).toHaveAttribute('aria-label', 'انتخاب روز');
});

test('clicking outside closes the popup without changing the value', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#today').click();
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toHaveValue('5');
});

test('the month hint shows the resolved name and clears when invalid', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await expect(page.locator('#p-m-hint')).toHaveText('Mordad');
  await page.locator('#g-m').fill('8');
  await expect(page.locator('#g-m-hint')).toHaveText('August');
  await page.locator('#p-m').fill('13');
  await expect(page.locator('#p-m-hint')).toHaveText('');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#g-m-hint')).toHaveText('اوت');
});

test('an out-of-range typed month errors without blocking the keystroke', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('13');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#p-m')).toHaveValue('13'); // not swallowed
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#converter-error')).toHaveText('Month must be between 1 and 12');
  await expect(page.locator('#weekday')).toHaveText('');
  await expect(page.locator('#btn-copy')).toBeDisabled();
});

test('persian digits typed into the month field work like ASCII', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('۱۴۰۳');
  await page.locator('#p-m').fill('۱۰');
  await page.locator('#p-d').fill('۲۲');
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('day options are comfortable touch targets on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-d-toggle').click();
  const options = await page.locator('#p-d-list li').all();
  expect(options.length).toBeGreaterThan(0);
  for (const option of options.slice(0, 5)) {
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('an open popup does not cause horizontal overflow at phone widths', async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    await page.locator('#p-d-toggle').click();
    await expect(page.locator('#p-d-list')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `width=${width}`).toBeLessThanOrEqual(0);
  }
});
```

- [ ] **Step 2: Run the new spec**

Run: `cd Site && npx playwright test e2e/picker.spec.ts`
Expected: all PASS. Task 4 already implemented the behavior; if something fails, the *implementation* is the suspect — report it rather than bending the test.

- [ ] **Step 3: Run the full E2E suite**

Run: `cd Site && npx playwright test`
Expected: all PASS, except possibly the above-the-fold test which Task 6 owns.

- [ ] **Step 4: Commit**

```bash
git add Site/e2e/picker.spec.ts
git commit -m "test(site): E2E coverage for month and day pickers"
```

---

## Task 6: Re-verify the above-the-fold invariant (after Task 4; parallel with Task 5)

**Files:**
- Modify: `Site/src/styles/tokens.css` and/or `Site/src/styles/components.css` — only if the invariant fails
- Modify: `Site/e2e/site.spec.ts` — only if the desktop clock size changes

**Interfaces:**
- Consumes: the final DOM from Task 4. The `.hint` row adds roughly 16 px to the converter's height; the narrower fields give width back.
- Produces: no API surface. The contract below.

**The contract:** at any desktop viewport (width ≥ 1025 px) with height ≥ 700 px, the bottom of `#converter` sits inside the viewport with no scrolling. Phone and tablet layouts (≤ 1024 px) must not change — the existing screenshot tests guard that.

- [ ] **Step 1: Measure the current slack**

Run: `cd Site && npx playwright test -g "above the fold"`

If it PASSES, run this to record the margin:

```bash
cd Site && npx playwright test -g "above the fold" --reporter=line
```

Then skip to Step 4. Do not tune a layout that already satisfies the contract.

- [ ] **Step 2: If it fails, reclaim the space**

Reduce in this order, smallest visual cost first, re-running the test after each change:

1. In `components.css`, tighten the hint: `.hint { min-height: 1em; font-size: 0.68rem; }`
2. In `tokens.css`, inside the existing `@media (min-width: 1025px)` block, lower `--space-section` toward `clamp(1.5rem, 0.9rem + 1.2vw, 2.4rem)`.
3. In `components.css`, shrink the desktop clock in the `@media (min-width: 1025px)` rule from `210px` toward `195px`.

Aim for at least 30 px of slack at 1440×700. Stop at the first option that achieves it.

- [ ] **Step 3: If the desktop clock size changed, update the invariant test**

In `Site/e2e/site.spec.ts`, the test `desktop stays pixel-identical regardless of short viewport height` asserts `expect(clock!.height).toBe(210);`. Change `210` to the new value. Leave `tablet clock is larger than phone clock` alone — tablets are unaffected; verify it still passes rather than editing it.

- [ ] **Step 4: Run the full E2E suite and inspect the screenshots**

Run: `cd Site && npx playwright test`
Expected: all PASS.

Open `Site/test-results/screens/light-1440.png` and `dark-1440.png`. The converter must look intentional, not cramped: the hint line should read as a quiet caption under the month field, not as a crowded second row.

- [ ] **Step 5: Commit** (skip if nothing changed)

```bash
git add Site/src/styles/tokens.css Site/src/styles/components.css Site/e2e/site.spec.ts
git commit -m "fix(site): keep the converter above the fold with the picker hint row"
```

---

## Task 7: README and full verification (last)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

- Feature list: month and day fields accept typed numbers *or* a dropdown; day options show the weekday; the month name appears under the field.
- Repo-layout tree: add `src/converter/field-options.ts` and `src/ui/number-picker.ts`.
- Replace the Vitest and Playwright test counts with the real numbers from Step 2 — run the suites and read the totals, do not guess.
- If the README documents the desktop clock size or the month `<select>`, correct it.

- [ ] **Step 2: Full verification**

Run: `cd Site && npm test && npx tsc --noEmit && npm run build && npx playwright test`
Expected: everything green. Record the exact test counts and the reported JS/CSS bundle sizes.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: picker fields, updated test counts and layout"
```

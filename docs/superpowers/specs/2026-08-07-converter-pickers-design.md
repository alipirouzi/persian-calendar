# Converter Pickers — Design

**Date:** 2026-08-07
**Status:** Approved
**Scope:** `Site/` only. No C# changes.
**Builds on:** `2026-08-05-converter-ux-design.md` (phase 1, complete on
`worktree-converter-ux`)

## Goal

Make the month and day fields **type-or-pick**: a numeric text input for speed, a
dropdown for discoverability. Day options carry their weekday name so choosing a
date shows which day of the week it lands on.

Phase 1 replaced the month `<input type="number">` with a native `<select>`,
which bought localized names and mobile OS pickers but **removed the ability to
type `5`**. This phase restores typing without giving up the names, and extends
the same treatment to the day field.

## Decisions

| Question | Decision |
|---|---|
| Control mechanic | Numeric text input + chevron button opening an ARIA listbox |
| Day option labels | Number + weekday name, e.g. `۲۲ شنبه` / `22 Saturday` |
| Out-of-range typed values | Allowed; existing `errMonth`/`errDay` messages fire |
| Year fields | Stay plain text inputs — a 300-entry year list is worse than typing |
| Month name visibility | Muted hint line under each month input |
| Weekday placement | Status row only (unchanged); weekday names live in day options |
| Native `<select>` | Reversed from phase 1 — it cannot accept typed numbers |

### Why not the alternatives

- **`<datalist>`** looks like the free answer but is unusable here: browsers
  disagree on whether the option's `value` or `label` is inserted, and iOS
  Safari support is poor. A control whose committed value differs per browser
  cannot back a converter.
- **A filtering combobox** (type `مرد` → Mordad) was considered and dropped.
  The ask is numeric entry; name typeahead adds a filter index, fuzzy-match
  rules, and no-results states for a case that the popup already serves.
- **Keeping `<select>` with number-prefixed labels** (`۵ مرداد`) shows the
  number but still cannot accept `5` as input, so it fails the requirement.

## 1. `NumberPicker` — the popup component

New module `Site/src/ui/number-picker.ts`. Framework-free, DOM-only, and
deliberately ignorant of calendars and i18n: it renders whatever options it is
handed.

```ts
export interface FieldOption { value: number; label: string }

export interface NumberPicker {
  setOptions(options: readonly FieldOption[]): void;
  close(): void;
}

export function createNumberPicker(parts: {
  input: HTMLInputElement;
  toggle: HTMLButtonElement;
  list: HTMLElement;
  onCommit: () => void;
}): NumberPicker;
```

**Markup** (four instances: `p-m`, `p-d`, `g-m`, `g-d`):

```html
<label><span data-str="month"></span>
  <div class="picker">
    <input id="p-m" type="text" inputmode="numeric" autocomplete="off"
           role="combobox" aria-expanded="false" aria-controls="p-m-list"
           aria-autocomplete="none" />
    <button id="p-m-toggle" type="button" tabindex="-1" aria-label="…">▾</button>
    <ul id="p-m-list" role="listbox" hidden></ul>
  </div>
  <span class="hint" id="p-m-hint"></span>
</label>
```

Options render as `<li role="option" id="<listId>-o<value>" data-value="5">۵ مرداد</li>`.

### Responsibilities

Owned by `NumberPicker`:

- Open and close, including `aria-expanded` on **both** input and toggle, and
  `hidden` on the list.
- `aria-activedescendant` on the input — **focus never moves to the list**, so
  typing keeps working while the popup is open.
- `aria-selected="true"` on the option whose `value` matches the input's current
  parsed number; a separate `.active` class marks the keyboard cursor. The two
  are visually distinct: selected is a persistent accent mark, active is a
  hover-equivalent background.
- Scrolling the active option into view (`block: 'nearest'`).
- Outside-click and blur close.
- Re-rendering options while open without losing the open state.

Not owned by `NumberPicker`: what the options mean, when they change, digit
localization, conversion. Those belong to `field-options.ts` and `converter.ts`.

### Keyboard

| Key | Closed | Open |
|---|---|---|
| `↓`, `Alt+↓` | open at the selected option | move active down |
| `↑`, `Alt+↑` | open at the selected option | move active up |
| `Home` / `End` | — | first / last option |
| `Enter` | nothing (the form has no submit) | commit active, close |
| `Escape` | nothing | close, **keep the typed value** |
| `Tab` | — | close, let focus proceed |
| digits | normal text entry | normal text entry, list stays open |

Typing digits never opens the popup. The fast path stays fast.

### Focus

**Focus returns to whatever opened the popup** — the input when opened from the
input, the toggle button when opened by pointer. One code path for every
platform, and on touch it stops the OS keyboard from covering the list when the
user taps the chevron. The toggle carries `tabindex="-1"` so the tab sequence
stays year → month → day; keyboard users open the list from the input with `↓`.

The toggle calls `preventDefault()` on `mousedown` so the browser does not move
focus before the click handler decides where focus belongs.

## 2. `field-options.ts` — the pure option source

New module `Site/src/converter/field-options.ts`. No DOM, fully unit-tested.

```ts
export function monthOptions(side: Side, lang: Lang): readonly FieldOption[];
export function dayOptions(
  side: Side, rawYear: string, rawMonth: string, lang: Lang,
): readonly FieldOption[];
```

`monthOptions` returns 12 entries labelled `"<localized digits> <month name>"`
from the existing `PERSIAN_MONTHS` / `GREGORIAN_MONTHS` tables.

`dayOptions` normalizes `rawYear`/`rawMonth` with the existing
`normalizeDigits`, then:

- **Both parse to in-range integers** (year within the side's min/max, month
  1–12) → one entry per day of that month from `daysInPersianMonth` /
  `daysInGregorianMonth`, each labelled `"<digits> <weekday>"`. The Persian side
  converts each day through `toGregorian` before taking the weekday.
- **Otherwise** (empty, non-numeric, or out of range) → 31 entries labelled with
  digits only, no weekday names.

The 31-entry fallback is deliberate: it keeps the popup useful while the user is
still typing a year, and it never shows a weekday that would be wrong.

Leap years need no new arithmetic — `daysInPersianMonth` and
`daysInGregorianMonth` already handle them, and phase 1's parity test covers
1200–1500 day-for-day.

Reuses `weekdayName` from `src/i18n/format.ts` and `toLocaleDigits` from
`src/i18n/strings.ts`. Both already exist.

## 3. Wiring in `converter.ts`

- The month input's `input` event runs the existing conversion **and** refreshes
  that side's day options plus its month hint.
- The year input's `input` event also refreshes that side's day options —
  weekday names depend on the year, and so does Esfand's length.
- Committing from a popup writes localized digits into the input, then calls the
  same `run(side, true)` a keystroke would.
- `rerender()` (language toggle) rebuilds all four option lists and both month
  hints, preserving the current values.
- Only the day list of the side that changed is rebuilt. Rebuilding at most 31
  list items per keystroke is well inside frame budget.

`convertFrom` needs **no change**. `parseField` already normalizes digits, and
the month now arrives as raw input text rather than an ASCII `<select>` value —
which is what `parseField` was already written to accept. A typed `۵` is a
month the same way a typed `۱۴۰۳` is already a year.

The refs type changes: `m` becomes `HTMLInputElement`, and each side gains its
month/day `NumberPicker` handles and its month hint element.

## 4. Month name hint

A numeric month input hides the month's name, which phase 1's `<select>` showed
for free. To avoid that regression, a small muted line under each month input
shows the resolved name — `مرداد` on the Persian side, `August` on the
Gregorian side. It clears when the month does not parse to 1–12.

The slot reserves its height (`min-height`) whether filled or not, so nothing
shifts as the user types — the same discipline the rest of the site follows for
CLS. Day fields get the same reserved slot, left empty, so the two fieldsets'
rows stay baseline-aligned.

The weekday stays where phase 1 put it: the status row and the today panel.
Repeating it under both day fields would print the same word twice, because both
sides describe a single date. Weekday names appear **inside the day popup**,
which is what the feature is for.

## 5. Layout and performance

The popup is `position: absolute` inside a `position: relative` wrapper, so it
costs nothing in layout and cannot push the converter below the fold.

Month and day inputs become **narrower** than phase 1's selects (which carried
`min-width: 7rem` to fit the longest month name — the names now live in the
popup), buying back horizontal room. The hint line costs about `1.1em`
vertically. Phase 1's above-the-fold invariant is re-verified at 1440×700,
1280×720, and 1920×700, and the desktop rhythm re-tuned if the hint pushes past
it.

Mobile and coarse pointers:

- Option rows are at least 44 px tall under
  `@media (max-width: 1024px), (pointer: coarse)`, matching the existing
  touch-target rules.
- The list is capped at `max-height: min(50vh, 20rem)` and scrolls.
- `inputmode="numeric"` keeps the OS numeric keypad for typing.
- The popup never opens on focus, only on `↓` or a chevron tap, so it does not
  fight the keyboard.

No new runtime dependencies. The component is plain TypeScript; the added
bundle cost is the picker plus option generation, targeted under 2 kB
minified — the shipped JS budget stays comfortably inside the microsite
target.

## 6. Error handling

Unchanged from phase 1. A typed month of `13`, or day `31` in a 30-day month,
produces the existing localized `errMonth` / `errDay` message in the
`role="status"` line, clears the weekday, and disables Copy. Nothing is blocked
at the keystroke level: blocking would break paste, break mid-edit values (`3`
on the way to `30`), and interact badly with non-ASCII digits.

`errMonth` now guards a real form path again, not only the URL path phase 1
retained it for.

## 7. i18n additions

Two new `StringKey`s in both languages, used as the toggle buttons' accessible
names: `chooseMonth` (`Choose month` / `انتخاب ماه`) and `chooseDay`
(`Choose day` / `انتخاب روز`). No other new strings — month names, weekday
names, and digits all come from tables that already exist.

## 8. Testing

**Vitest** — new `tests/field-options.test.ts`:

- `monthOptions` labels in both languages, values 1–12, localized digits.
- `dayOptions` entry counts: 31 (Farvardin), 30 (Mordad), 29 and 30 (Esfand in a
  common and a leap year), 28 and 29 (February 2025 and 2024).
- Weekday labels against the fixed `1403-10-22 ↔ 2025-01-11` Saturday vector
  shared with the phase-1 tests.
- Fallback to 31 plain options for empty, non-numeric, and out-of-range year or
  month, in both languages.
- Persian and Arabic digit inputs produce the same options as ASCII.

**Playwright** — new `e2e/picker.spec.ts`:

- Chevron opens the list; month options read `5 Mordad` / `۵ مرداد`.
- Clicking an option commits it and drives the conversion.
- Typing `5` converts without opening the popup; typing `۵` matches `5`.
- Day options carry weekday names; the list regenerates when the month or year
  changes; Esfand shows 29 in a common year and 30 in a leap year.
- Keyboard: `↓` opens, `↓ ↓ Enter` commits the third option, `Escape` closes and
  keeps the typed value, `Tab` closes.
- ARIA: `aria-expanded` flips on input and toggle, `aria-activedescendant`
  tracks the active option, `aria-selected` marks the current value.
- Typed month `13` shows the localized error, clears the weekday, disables Copy.
- Language toggle preserves both values and relabels both popups.
- The month hint updates and clears with validity.
- Coarse-pointer option rows measure at least 44 px.
- The above-the-fold invariant still holds at all three desktop viewports.

Phase-1 specs change `selectOption('10')` to `fill('10')` where they drive month
fields.

**Live verification** in Chrome against the running site — desktop and mobile
viewports, both colour schemes, keyboard and pointer paths — before the work is
reported done. Green tests alone are not evidence that the control feels right.

## Out of scope

- Month-grid calendar view (still a separate future sub-project)
- Name typeahead or fuzzy filtering in the pickers
- A year picker
- Holidays, occasions, date-difference tools (rejected in phase 1)
- Any change to `Lib/`, `Console/`, the C# test vectors, `Site/sw.js` caching, or
  `deploy/`

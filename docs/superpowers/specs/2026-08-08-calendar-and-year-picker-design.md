# Calendar Grid, Year Picker, and Field Coherence — Design

**Date:** 2026-08-08
**Status:** Approved
**Scope:** `Site/` only. No C# changes.
**Builds on:** `2026-08-07-converter-pickers-design.md`

## Goal

Finish the converter's input surface: make every field behave and look the same,
stop accepting input that can never be a date, and add a calendar so a whole date
can be picked in one gesture.

Five changes, three of them corrections to what shipped on 2026-08-07.

| # | Change | Kind |
|---|---|---|
| 1 | Fields reject non-numeric characters | Bug fix |
| 2 | Year becomes a picker like month and day | Consistency |
| 3 | Per-field captions removed; one full date line added | Consistency |
| 4 | A calendar month grid per side | Feature |
| 5 | Option lists render lazily | Performance |

## 1. Numeric-only fields

**The bug:** all six fields are `type="text"`, and nothing rejects letters. Typing
`abc` into the year leaves `abc` sitting in the field. `convertFrom` reports
`incomplete` so no error appears — the field just holds nonsense.

Every field filters its own value on `input`: anything that is not an ASCII,
Persian-Indic, or Arabic-Indic digit is removed, and the caret is restored to the
position it would have had. Paste is filtered by the same path, since paste fires
`input`.

Fields also carry `maxlength` — 4 for years, 2 for months and days. A date field
has no use for more digits than that, and it stops a long value from overflowing
the cell.

This is deliberately *character* filtering only. Out-of-range **numbers** still
reach `convertFrom` and still produce the existing localized errors — blocking
those at the keystroke would break typing `3` on the way to `30`, which the
2026-08-07 spec already settled.

## 2. Year picker

The year was left as a bare input when month and day became type-or-pick, so one
cell in three has no chevron and no list. The year now gets both, with the same
markup, the same geometry, and the same component.

- Persian: 1200–1500 (301 options). Gregorian: 1822–2121 (300 options).
- Options are numerals only — a year has no name — so `name` is empty and the row
  renders as a single column, exactly like the no-context day list.
- The list opens scrolled to the current value, which the picker already does.

## 3. One full date line, no per-field captions

The month field carried a caption showing its resolved name; year and day carried
an empty reserved slot. One cell in three captioned is not a system.

All captions go. In their place, a single line under the form shows the full
human-readable date for whatever the converter currently holds — the **same
sentence the Copy button writes**, so what you see is what you copy:

```
Friday, 16 Mordad 1405 — August 7, 2026
جمعه ۱۶ مرداد ۱۴۰۵ — ۷ اوت ۲۰۲۶
```

`#weekday` in the status row is **removed**: the new line already contains the
weekday, and repeating it is the redundancy this change exists to remove. The
status row becomes «Today | Copy».

The line is hidden while the converter is invalid, where the error line speaks
instead. It is small and muted so it reads as a caption of the converter rather
than competing with the today panel above it — the two do coincide on first load,
when the converter is prefilled with today, and diverge the moment anything is
edited.

## 4. Calendar month grid

A button in each fieldset's legend row opens a browsable month grid for that
calendar. The three fields stay and stay in sync; the grid is an additional way
in, not a replacement.

### Layout

- Header: previous-month button, the month name and year in the current
  language's digits, next-month button.
- A weekday header row, then up to six week rows.
- **Persian weeks start Saturday; Gregorian weeks start Monday.** Column index
  for the first of the month is derived from the JS `getDay()` of its Gregorian
  equivalent: `(getDay + 1) % 7` for Persian, `(getDay + 6) % 7` for Gregorian.
- Day cells outside the month are blank, not filled with neighbouring months.

### Behaviour

- Picking a day writes that side's three fields and runs the existing conversion,
  then closes and returns focus to the calendar button.
- Month navigation rolls over the year and stops at the supported range bounds
  (Persian 1200–1500, Gregorian 1822–2121); the button at a bound is disabled.
- The cell matching the converter's current date is marked selected; today is
  marked separately.
- Opening the calendar closes any open picker popup and vice versa — one popup at
  a time.

### Keyboard and ARIA

Focus moves to the grid, which carries `role="grid"` and `aria-activedescendant`
— the same model the number picker already uses, so there is one focus story in
the codebase rather than two. Arrow keys move by day and week, `PageUp`/`PageDown`
by month, `Home`/`End` to the start and end of the week, `Enter` or `Space`
selects, `Escape` closes and restores focus. Rows are `role="row"` and cells
`role="gridcell"` with `aria-selected`.

## 5. Lazy option rendering

With the year picker added, eagerly building every list at load would put roughly
1,200 extra nodes on the page before the user has opened anything — most of them
years nobody will scroll to.

`setOptions` now stores the options and marks the list dirty; the DOM is built on
first open, and rebuilt on the next open after any change. Nothing else about the
picker's contract moves. This makes the month and day lists cheaper too.

## 6. i18n additions

New `StringKey`s: `openCalendar`, `prevMonth`, `nextMonth`. New table
`WEEKDAYS_SHORT`, indexed by JS `getDay()` like the existing `WEEKDAYS`, for the
grid's header row. `chooseYear` joins `chooseMonth` and `chooseDay`.

## 7. Testing

**Vitest** — `yearOptions` bounds and localization; `buildMonthGrid` for column
offsets in both calendars, week-start correctness, leap and common Esfand, 28/29
day February, first-of-month landing on each weekday, and range-bound navigation;
digit filtering including paste and mixed scripts.

**Playwright** — non-numeric input is rejected in all six fields and `maxlength`
holds; the year picker opens, lists the right bounds, and commits; captions are
gone and the full date line tracks the converter in both languages; the calendar
opens from both sides, shows Saturday-first for Persian and Monday-first for
Gregorian, navigates months across a year boundary, disables at the range bound,
selects a date that flows through to the other side, and is fully keyboard
operable; one popup at a time; the desktop above-the-fold invariant still holds;
field coherence assertions from 2026-08-07 still pass with the year picker added.

**Live verification** in a real browser across 320/375/768/1024/1440, both
themes, both writing directions, before this is called done.

## Out of scope

- Holidays, occasions, date-difference tools (rejected in phase 1)
- A year *grid* or decade view in the calendar — month navigation plus the year
  picker covers it
- Any change to `Lib/`, `Console/`, the C# vectors, `sw.js` caching, or `deploy/`

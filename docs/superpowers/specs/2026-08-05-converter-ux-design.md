# Converter UX — Design

**Date:** 2026-08-05
**Status:** Approved
**Scope:** `Site/` only. No C# changes.

## Goal

Make date conversion — the core purpose of the site — faster to find, easier to
use, and shareable, without compromising the minimal all-text aesthetic.

Sub-project 1 of 2. Sub-project 2 (browsable month-grid calendar view) is a
separate future spec. Holidays/occasions were considered and explicitly
rejected: the app visualizes and facilitates conversion, it does not interpret
dates.

## Decisions (validated via visual mockups)

| Question | Decision |
|---|---|
| Month input | Native `<select>` with localized month names (option A) |
| First-load discoverability | Everything above the fold on desktop (option B) |
| Weekday / copy / today placement | Single centered status row under the form (option A) |
| URL state | Yes — `history.replaceState` query param |
| Timezone selector | Rejected — clock already uses machine time; Tehran hint line covers the remote case |

## 1. Layout — above the fold (desktop)

Tighten `--space-section` rhythm and cap the clock slightly smaller so clock +
today panel + converter (including the status row) are fully visible without
scrolling in any desktop viewport of height ≥ 700 px. Phones
and tablets keep their current scrolling layout untouched. The existing
desktop-invariant E2E assertions are updated to the new geometry.

## 2. Month dropdowns

- Both month fields (`#p-m`, `#g-m`) become native `<select>` elements,
  values `1`–`12`, labels from the existing `PERSIAN_MONTHS` /
  `GREGORIAN_MONTHS` tables in the current language.
- Styled to match the text inputs (surface-raised background, hairline
  border, same focus treatment).
- Language toggle re-renders option labels in place, preserving the selected
  value.
- Native select is deliberate: keyboard typeahead, mobile OS pickers, and
  screen-reader semantics for free.
- An invalid month becomes impossible **from the form**. The `errMonth`
  branch in `converter-core.ts` and its string key are **retained**: URL
  params (§6) feed arbitrary values into `convertFrom`, so the guard still
  protects that path. (Amended 2026-08-05 during planning; originally
  marked for removal.)

## 3. Digit-tolerant year/day fields

- `#p-y`, `#p-d`, `#g-y`, `#g-d` change from `type="number"` to
  `type="text" inputmode="numeric"` (number inputs reject non-ASCII digits).
- `parseField` in `converter-core.ts` normalizes Persian-Indic (۰–۹, U+06F0–F9)
  and Arabic-Indic (٠–٩, U+0660–69) digits to ASCII before parsing. `1405`,
  `۱۴۰۵`, and `١٤٠٥` are equivalent everywhere.
- Programmatic writes (conversion results, prefill, today-reset) render values
  in the current language's digits via the existing `toLocaleDigits`.
- The field the user is actively typing in is never rewritten mid-edit.

## 4. Status row

Centered under the form, replacing the bare error line's slot:

```
امروز        سه‌شنبه        کپی
```

- **Weekday** (accent color): shown only while the converter holds a valid
  date; computed from the Gregorian parts via `Intl.DateTimeFormat` weekday —
  no new calendar math. When conversion errors, the error message occupies the
  row and the weekday/buttons context stays stable (buttons remain).
- **«امروز» / "Today"** (quiet text button): resets both sides to today,
  clears the URL query string, shows the weekday.
- **«کپی» / "Copy"** (quiet text button): writes the full sentence in the
  current language and digits to the clipboard, e.g.
  `سه‌شنبه ۱۴ مرداد ۱۴۰۵ — ۵ اوت ۲۰۲۶` /
  `Tuesday, 14 Mordad 1405 — August 5, 2026`, then swaps its label to
  «کپی شد» / "Copied" for ~1.5 s. Disabled while the converter is invalid.

## 5. Today panel

Weekday prepended to both today lines (Persian and Gregorian), same display
font, e.g. `سه‌شنبه ۱۴ مرداد ۱۴۰۵`.

## 6. URL state

- On every valid conversion, `history.replaceState` sets exactly one of
  `?p=YYYY-M-D` (Persian side last edited) or `?g=YYYY-M-D` (Gregorian side
  last edited). No history entries are created.
- On load: a present, well-formed, in-range param prefills the converter and
  the status row; anything invalid is ignored silently and today is shown.
- «امروز» clears the query string (clean root URL).
- Fully static; no service-worker changes (navigations are network-first and
  ignore query strings for caching purposes already).

## 7. i18n additions

New string keys: 7 weekday names × 2 languages, `today`, `copy`, `copied`.
`errMonth` is retained (see §2 — it guards URL-supplied months).

## 8. Error handling

`convertFrom` pipeline unchanged except digit normalization in `parseField`.
Year-range, month, and day-in-month errors keep their current messages and
`role="status"` line.

## 9. Testing

- **Vitest:** digit normalization (Persian/Arabic/ASCII/mixed), URL param
  format + parse round-trip incl. invalid inputs, weekday name lookup for
  known dates, copy-sentence formatting in both languages.
- **Playwright E2E:** dropdown conversion in both languages; typing `۱۴۰۵`
  converts identically to `1405`; opening `/?p=1404-1-1` prefills both sides;
  «امروز» resets and clears the query; «کپی» puts the sentence on the
  clipboard (clipboard permissions granted in config); updated above-fold
  invariant at 1440×900 and 1280×720.
- **README:** feature list and test counts updated.

## Out of scope

- Month-grid calendar view (sub-project 2, separate spec)
- Holidays, occasions, date-difference tools (rejected)
- Timezone selector (rejected)
- Any change to `Lib/`, `Console/`, or the C# test vectors

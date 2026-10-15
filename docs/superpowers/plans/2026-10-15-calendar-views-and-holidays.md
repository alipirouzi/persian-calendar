# Calendar Views and Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapsible Persian and Gregorian month views under the clock, marked with Iranian official holidays, Nuremberg public holidays and the user's own holidays, configurable in Settings, working offline. The Iranian lunar dates come from a weekly-crawled official data file, or from an `Intl` estimate when no file is available.

**Architecture:** Pure rule modules produce holidays per year: Iranian solar dates, a Bavarian/Nuremberg Easter computus, and Iranian lunar dates estimated via `Intl` `islamic-umalqura`. A pure validator reads the official per-year data file at `/api/holidays/ir/{year}.json`. A pure merge combines official, estimated and user holidays for one displayed month. A small service caches the official files and notifies when one arrives. Two DOM modules render the month panels and the Settings "Calendars & holidays" group. A GitHub Action crawls holidayapi.ir weekly and opens a PR whenever the data changes.

**Tech Stack:** Vite 7 + vanilla TypeScript, Vitest 3 (+ jsdom 30 under `tests/dom/`), Playwright 1.62, nginx, hand-rolled service worker, GitHub Actions, `tsx` for the crawler.

**Spec:** `docs/superpowers/specs/2026-10-14-settings-time-holidays-design.md` — section "C — Calendar views and holidays", plus "Architecture", "Error handling summary", "Testing" and "Docs".

## Global Constraints

- **Views:** a stack of `<details>` panels under the clock: **Persian month** (Sat-first) and **Gregorian month** (Mon-first), laid out with `calendar-grid-model.ts`.
  - Each panel has ‹ › month paging and a Today control.
  - Clicking a day prefills the converter on that day.
  - Today is outlined; holidays get a dot and a holiday colour.
  - Below each grid, the month's holidays: date, name, source tag (Iran / Nuremberg / Mine), and "estimated" where applicable.
- **Settings defaults:** `views.persian.enabled/.open` = `true/true`; `views.gregorian.enabled/.open` = `true/false`; `holidays.sources` = `ir`, `nuremberg`, `user`; `holidays.user[]` = `[]`.
- **User holiday shape:** `{ id, name, calendar: persian|gregorian, month, day, year?: number }`.
  - No `year` means every year.
  - Name is at most 60 characters, stored and rendered as text only.
  - A holiday on Esfand 30 or Feb 29 appears only in years where that day exists.
- **Test connection (holidays):** fetches `/api/holidays/ir/{current Persian year}.json` and reports `OK · 1405 official data · updated 2026-10-12` or `No official data for 1406 — using estimates`.
- **Iran, solar:** 1–4 Farvardin (Nowruz), 12 Farvardin, 13 Farvardin, 14 Khordad, 15 Khordad, 22 Bahman, 29 Esfand.
- **Iran, lunar (Hijri day → key):** 9 Muharram Tasua, 10 Muharram Ashura, 20 Safar Arbaeen, 28 Safar, last day of Safar, 8 Rabi I, 17 Rabi I, 3 Jumada II, 13 Rajab, 27 Rajab, 15 Sha'ban, 21 Ramadan, 1–2 Shawwal, 25 Shawwal, 10 Dhu al-Hijjah, 18 Dhu al-Hijjah.
- **Nuremberg (Bavaria without Assumption Day):** 1 Jan, 6 Jan, Good Friday, Easter Monday, 1 May, Ascension, Whit Monday, Corpus Christi, 3 Oct, 1 Nov, 25 Dec, 26 Dec. Easter via the anonymous Gregorian computus.
- **Lunar estimate:** iterate the days of the Persian year and keep those whose `islamic-umalqura` month/day match the rules, memoized per year. Results are flagged `estimated`.
- **Merge precedence (Iran lunar):** use the official file for that Persian year if present and valid, otherwise the estimate. A Gregorian month spans at most two Persian years; look up both.
- **Data file:** `Site/public/api/holidays/ir/{year}.json`, shaped `{ "year": 1405, "source": "holidayapi.ir", "fetched": "2026-10-12", "holidays": [{ "key": "ir.ashura", "p": "1405-04-04" }] }`.
  - Validation: `year` matches the URL, every `key` is known, and every `p` is a valid date in that year. Any failure means the whole file is ignored and the estimates are used.
- **Names:** every holiday key has EN and FA strings in `i18n/strings.ts`.
- **Crawler:** `.github/workflows/holidays-ir.yml`, weekly plus manual dispatch. The script is TypeScript run with `tsx`, under `tools/holidays-crawler/`.
  - It queries `https://holidayapi.ir/jalali/{y}/{m}/{d}` for the current and next Persian year, sequentially with a short delay.
  - It keeps rows where `is_holiday && is_religious`, maps descriptions to keys, and writes the JSON files.
  - An unknown description or an HTTP failure fails the job, and no PR is opened.
  - When the data changed, it opens a PR via `peter-evans/create-pull-request`; when nothing changed, it does nothing.
  - The user verifies each PR against the official calendar before merging.
- **Service worker:** `/api/holidays/**` is stale-while-revalidate. This is already the catch-all strategy in `sw.js`, so it needs no change.
- **Failure:** a holiday file that is missing, invalid, or not cached while offline falls back to the estimates, labelled "estimated". A crawler failure fails the Action visibly and leaves the site unaffected.
- **App-wide:** nothing blocks first paint, and the app works fully offline. Every new surface is EN/FA with RTL.
- **Quality bar:** coverage stays 100% on `src/**/*.ts`. No `console.log`, no secrets, no personal data.
- **Commits:** messages follow `<type>: <description>`; never stage `.superpowers/` or `.DS_Store`.

## Decisions this plan makes (beyond the spec's wording)

1. **Holiday names live in `strings.ts` as a separate `HOLIDAY_NAMES` map**, not as `StringKey`s. They are keyed by `HolidayKey`, so the 35 names do not bloat the UI dictionary, and `i18n.test.ts` checks both languages separately.
2. **The official file covers Iranian *lunar* holidays only**, because the crawler keeps only `is_religious` rows. Solar holidays always come from `rules-ir.ts`. The validator rejects non-lunar keys.
3. **The crawler rewrites a file only when its `holidays` change.** `fetched` alone never triggers a PR; otherwise a weekly run would open a PR every week.
4. **No data file is committed by hand.** After the push, the controller dispatches the workflow once. The workflow opens a PR with 1405/1406 for the user to verify, as the spec requires. Until that PR is merged the site shows estimates, labelled as such.
5. **The crawler's tests live in `Site/tests/crawler.test.ts`** and import from `tools/holidays-crawler/`. They run in the existing CI job, which needs no new job. `tsx` becomes a Site devDependency.
6. **Panels follow today.** A panel shows today's month and moves with it, for example after midnight or after a sync, until the user pages. Today resets the panel to the current month.
7. **Day click prefills the converter and scrolls it into view** (`block: 'nearest'`).
8. **Settings dialog gets `max-block-size` and `overflow: auto`**, because three groups no longer fit a phone screen.
9. **E2E tests that mock `/api/holidays/**` block the service worker** (`serviceWorkers: 'block'`). This is the decision the spec deferred to this plan. The offline test runs with the worker active and asserts that the estimates render.
10. **The user-holiday list is capped at 200 entries.** Invalid entries are dropped one by one while parsing. The id is `crypto.randomUUID()`.

## Review Focus

1. **A month that straddles Nowruz** (Gregorian March shows days from two Persian years): the holidays of *both* Persian years must appear, for example 29 Esfand 1404 = 2026-03-20 and Nowruz 1405 = 2026-03-21. Pinned in Task 3.
2. **A Hijri date that occurs twice in one Persian year** (the lunar year is 11 days shorter): both occurrences are holidays. Pinned in Task 2.
3. **A user holiday on Esfand 30 or Feb 29:** shown only in leap years, never moved to another day. Pinned in Task 3.
4. **Holiday files that exist but are wrong** (wrong year, unknown key, 30 Esfand in a non-leap year, HTML from a captive portal): the whole file is ignored and the estimates are used. Pinned in Task 2.
5. **Turning every holiday source off:** no dots and an empty list, while the grid still renders and day clicks still work. Pinned in Task 5.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `Site/src/holidays/holiday-keys.ts` | create | Key lists, `HolidayKey`, guards |
| `Site/src/holidays/rules-ir.ts` | create | Pure: Iranian solar holidays for a Persian year |
| `Site/src/holidays/rules-by.ts` | create | Pure: Easter computus, Nuremberg holidays for a Gregorian year |
| `Site/src/holidays/lunar-estimate.ts` | create | Pure: Iranian lunar holidays estimated via `Intl` |
| `Site/src/holidays/holiday-data.ts` | create | Validate and fetch `/api/holidays/ir/{y}.json` |
| `Site/src/holidays/merge.ts` | create | Pure: official ∪ estimated ∪ solar ∪ Nuremberg ∪ user → one month |
| `Site/src/holidays/holiday-service.ts` | create | Official-file cache + `forMonth` + notifications |
| `Site/src/views/calendar-panels.ts` | create | DOM: the two `<details>` month panels |
| `Site/src/holidays/holidays-panel.ts` | create | DOM: Settings "Calendars & holidays" group |
| `Site/src/settings/settings-model.ts` | modify | `views`, `holidays` groups, `parseUserHoliday` |
| `Site/src/i18n/strings.ts` | modify | UI strings + `HOLIDAY_NAMES` |
| `Site/index.html`, `Site/src/styles/components.css`, `Site/src/main.ts` | modify | Markup, styles, wiring |
| `tools/holidays-crawler/holidayapi.ts`, `tools/holidays-crawler/crawl.ts` | create | Crawler logic and CLI |
| `.github/workflows/holidays-ir.yml` | create | Weekly crawl → PR |
| `Site/tests/…`, `Site/e2e/calendar-views.spec.ts`, `Site/e2e/holiday-settings.spec.ts` | create | Tests |
| `README.md`, `docs/SECURITY.md` | modify | Docs |

All commands run from `Site/` unless stated otherwise.

---
### Task 1: Holiday keys, names, and the fixed-date rules (Iran solar, Nuremberg)

**Files:**
- Create: `Site/src/holidays/holiday-keys.ts`, `Site/src/holidays/rules-ir.ts`, `Site/src/holidays/rules-by.ts`
- Create: `Site/tests/fixtures/easter-2000-2100.json` (independent table; contents below)
- Modify: `Site/src/i18n/strings.ts` (add `HOLIDAY_NAMES`)
- Test: `Site/tests/holiday-rules.test.ts`, `Site/tests/i18n.test.ts` (one new test)

**Interfaces:**
- Produces:
  - `IR_SOLAR_KEYS`, `IR_LUNAR_KEYS`, `BY_KEYS` (readonly tuples), `type IrSolarKey`, `type IrLunarKey`, `type ByKey`, `type HolidayKey = IrSolarKey | IrLunarKey | ByKey`, `ALL_HOLIDAY_KEYS: readonly HolidayKey[]`, `isIrLunarKey(value: unknown): value is IrLunarKey`
  - `interface PersianHoliday { readonly p: PersianDateParts; readonly key: IrSolarKey | IrLunarKey }`
  - `irSolarHolidays(py: number): readonly PersianHoliday[]`
  - `interface GregorianHoliday { readonly g: GregorianDateParts; readonly key: ByKey }`
  - `easterSunday(gy: number): GregorianDateParts`, `nurembergHolidays(gy: number): readonly GregorianHoliday[]`
  - `HOLIDAY_NAMES: Record<Lang, Record<HolidayKey, string>>` in `strings.ts`

- [ ] **Step 1: Write the fixture and the failing tests**

`Site/tests/fixtures/easter-2000-2100.json`: generated with the Gauss/Lichtenberg algorithm, a *different* method from the one under test. It was spot-checked against published dates for 2000, 2019, 2024, 2025, 2026, 2038 and 2100:

```json
{"2000": "2000-04-23", "2001": "2001-04-15", "2002": "2002-03-31", "2003": "2003-04-20", "2004": "2004-04-11", "2005": "2005-03-27", "2006": "2006-04-16", "2007": "2007-04-08", "2008": "2008-03-23", "2009": "2009-04-12", "2010": "2010-04-04", "2011": "2011-04-24", "2012": "2012-04-08", "2013": "2013-03-31", "2014": "2014-04-20", "2015": "2015-04-05", "2016": "2016-03-27", "2017": "2017-04-16", "2018": "2018-04-01", "2019": "2019-04-21", "2020": "2020-04-12", "2021": "2021-04-04", "2022": "2022-04-17", "2023": "2023-04-09", "2024": "2024-03-31", "2025": "2025-04-20", "2026": "2026-04-05", "2027": "2027-03-28", "2028": "2028-04-16", "2029": "2029-04-01", "2030": "2030-04-21", "2031": "2031-04-13", "2032": "2032-03-28", "2033": "2033-04-17", "2034": "2034-04-09", "2035": "2035-03-25", "2036": "2036-04-13", "2037": "2037-04-05", "2038": "2038-04-25", "2039": "2039-04-10", "2040": "2040-04-01", "2041": "2041-04-21", "2042": "2042-04-06", "2043": "2043-03-29", "2044": "2044-04-17", "2045": "2045-04-09", "2046": "2046-03-25", "2047": "2047-04-14", "2048": "2048-04-05", "2049": "2049-04-18", "2050": "2050-04-10", "2051": "2051-04-02", "2052": "2052-04-21", "2053": "2053-04-06", "2054": "2054-03-29", "2055": "2055-04-18", "2056": "2056-04-02", "2057": "2057-04-22", "2058": "2058-04-14", "2059": "2059-03-30", "2060": "2060-04-18", "2061": "2061-04-10", "2062": "2062-03-26", "2063": "2063-04-15", "2064": "2064-04-06", "2065": "2065-03-29", "2066": "2066-04-11", "2067": "2067-04-03", "2068": "2068-04-22", "2069": "2069-04-14", "2070": "2070-03-30", "2071": "2071-04-19", "2072": "2072-04-10", "2073": "2073-03-26", "2074": "2074-04-15", "2075": "2075-04-07", "2076": "2076-04-19", "2077": "2077-04-11", "2078": "2078-04-03", "2079": "2079-04-23", "2080": "2080-04-07", "2081": "2081-03-30", "2082": "2082-04-19", "2083": "2083-04-04", "2084": "2084-03-26", "2085": "2085-04-15", "2086": "2086-03-31", "2087": "2087-04-20", "2088": "2088-04-11", "2089": "2089-04-03", "2090": "2090-04-16", "2091": "2091-04-08", "2092": "2092-03-30", "2093": "2093-04-12", "2094": "2094-04-04", "2095": "2095-04-24", "2096": "2096-04-15", "2097": "2097-03-31", "2098": "2098-04-20", "2099": "2099-04-12", "2100": "2100-03-28"}
```

```ts
// Site/tests/holiday-rules.test.ts
import { describe, expect, it } from 'vitest';
import EASTER from './fixtures/easter-2000-2100.json';
import {
  ALL_HOLIDAY_KEYS, BY_KEYS, IR_LUNAR_KEYS, IR_SOLAR_KEYS, isIrLunarKey,
} from '../src/holidays/holiday-keys';
import { irSolarHolidays } from '../src/holidays/rules-ir';
import { easterSunday, nurembergHolidays } from '../src/holidays/rules-by';

const iso = (g: { gy: number; gm: number; gd: number }): string =>
  `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;

describe('holiday keys', () => {
  it('lists every key once, in three disjoint groups', () => {
    expect(new Set(ALL_HOLIDAY_KEYS).size).toBe(ALL_HOLIDAY_KEYS.length);
    expect(ALL_HOLIDAY_KEYS.length).toBe(IR_SOLAR_KEYS.length + IR_LUNAR_KEYS.length + BY_KEYS.length);
    expect(IR_LUNAR_KEYS).toHaveLength(16);
  });

  it('recognises lunar keys only', () => {
    expect(isIrLunarKey('ir.ashura')).toBe(true);
    for (const value of ['ir.nowruz', 'by.christmas', 'nope', 3, null]) expect(isIrLunarKey(value)).toBe(false);
  });
});

describe('irSolarHolidays', () => {
  it('gives the fixed Iranian holidays of a year, Nowruz as four days', () => {
    const days = irSolarHolidays(1405).map((h) => `${h.p.pm}-${h.p.pd} ${h.key}`);
    expect(days).toEqual([
      '1-1 ir.nowruz', '1-2 ir.nowruz', '1-3 ir.nowruz', '1-4 ir.nowruz',
      '1-12 ir.republic', '1-13 ir.nature', '3-14 ir.khomeini', '3-15 ir.uprising',
      '11-22 ir.revolution', '12-29 ir.oil',
    ]);
    expect(irSolarHolidays(1405).every((h) => h.p.py === 1405)).toBe(true);
  });
});

describe('easterSunday', () => {
  it('matches an independently computed table for every year 2000–2100', () => {
    for (const [year, expected] of Object.entries(EASTER)) {
      expect(iso(easterSunday(Number(year))), year).toBe(expected);
    }
  });
});

describe('nurembergHolidays', () => {
  it('gives the twelve public holidays of 2026 in date order, without Assumption Day', () => {
    expect(nurembergHolidays(2026).map((h) => `${iso(h.g)} ${h.key}`)).toEqual([
      '2026-01-01 by.new-year', '2026-01-06 by.epiphany', '2026-04-03 by.good-friday',
      '2026-04-06 by.easter-monday', '2026-05-01 by.labour', '2026-05-14 by.ascension',
      '2026-05-25 by.whit-monday', '2026-06-04 by.corpus-christi', '2026-10-03 by.unity',
      '2026-11-01 by.all-saints', '2026-12-25 by.christmas', '2026-12-26 by.boxing',
    ]);
  });

  it('moves the Easter-based days across a month boundary correctly', () => {
    // Easter 2038 is 25 April: Ascension 3 June, Whit Monday 14 June, Corpus Christi 24 June.
    const byKey = new Map(nurembergHolidays(2038).map((h) => [h.key, iso(h.g)]));
    expect(byKey.get('by.good-friday')).toBe('2038-04-23');
    expect(byKey.get('by.ascension')).toBe('2038-06-03');
    expect(byKey.get('by.whit-monday')).toBe('2038-06-14');
    expect(byKey.get('by.corpus-christi')).toBe('2038-06-24');
  });
});
```

Add to `Site/tests/i18n.test.ts`:

```ts
import { ALL_HOLIDAY_KEYS } from '../src/holidays/holiday-keys';
import { HOLIDAY_NAMES } from '../src/i18n/strings';
```
```ts
  it('names every holiday in both languages', () => {
    for (const lang of ['en', 'fa'] as const) {
      expect(Object.keys(HOLIDAY_NAMES[lang]).sort()).toEqual([...ALL_HOLIDAY_KEYS].sort());
      for (const key of ALL_HOLIDAY_KEYS) expect(HOLIDAY_NAMES[lang][key].trim(), `${lang} ${key}`).not.toBe('');
    }
  });
```

(Merge these imports into the file's existing import lines; read the file first.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/holiday-rules.test.ts tests/i18n.test.ts`
Expected: FAIL. The modules don't exist, and `HOLIDAY_NAMES` is not exported.

- [ ] **Step 3: Implement**

```ts
// Site/src/holidays/holiday-keys.ts
export const IR_SOLAR_KEYS = [
  'ir.nowruz', 'ir.republic', 'ir.nature', 'ir.khomeini', 'ir.uprising', 'ir.revolution', 'ir.oil',
] as const;

export const IR_LUNAR_KEYS = [
  'ir.tasua', 'ir.ashura', 'ir.arbaeen', 'ir.prophet', 'ir.reza', 'ir.askari', 'ir.mawlid',
  'ir.fatima', 'ir.ali-birth', 'ir.mabath', 'ir.mahdi', 'ir.ali-martyrdom', 'ir.fitr',
  'ir.sadiq', 'ir.adha', 'ir.ghadir',
] as const;

export const BY_KEYS = [
  'by.new-year', 'by.epiphany', 'by.good-friday', 'by.easter-monday', 'by.labour',
  'by.ascension', 'by.whit-monday', 'by.corpus-christi', 'by.unity', 'by.all-saints',
  'by.christmas', 'by.boxing',
] as const;

export type IrSolarKey = typeof IR_SOLAR_KEYS[number];
export type IrLunarKey = typeof IR_LUNAR_KEYS[number];
export type ByKey = typeof BY_KEYS[number];
export type HolidayKey = IrSolarKey | IrLunarKey | ByKey;

export const ALL_HOLIDAY_KEYS: readonly HolidayKey[] = [...IR_SOLAR_KEYS, ...IR_LUNAR_KEYS, ...BY_KEYS];

export const isIrLunarKey = (value: unknown): value is IrLunarKey =>
  (IR_LUNAR_KEYS as readonly unknown[]).includes(value);
```

```ts
// Site/src/holidays/rules-ir.ts
import type { PersianDateParts } from '../calendar/persian';
import type { IrLunarKey, IrSolarKey } from './holiday-keys';

export interface PersianHoliday {
  readonly p: PersianDateParts;
  readonly key: IrSolarKey | IrLunarKey;
}

const SOLAR: readonly (readonly [month: number, day: number, key: IrSolarKey])[] = [
  [1, 1, 'ir.nowruz'], [1, 2, 'ir.nowruz'], [1, 3, 'ir.nowruz'], [1, 4, 'ir.nowruz'],
  [1, 12, 'ir.republic'], [1, 13, 'ir.nature'],
  [3, 14, 'ir.khomeini'], [3, 15, 'ir.uprising'],
  [11, 22, 'ir.revolution'], [12, 29, 'ir.oil'],
];

/** The Iranian public holidays fixed to the solar calendar, in date order. */
export function irSolarHolidays(py: number): readonly PersianHoliday[] {
  return SOLAR.map(([pm, pd, key]) => ({ p: { py, pm, pd }, key }));
}
```

```ts
// Site/src/holidays/rules-by.ts
import type { GregorianDateParts } from '../calendar/persian';
import type { ByKey } from './holiday-keys';

export interface GregorianHoliday {
  readonly g: GregorianDateParts;
  readonly key: ByKey;
}

/** The anonymous Gregorian computus (Meeus/Jones/Butcher). */
export function easterSunday(gy: number): GregorianDateParts {
  const a = gy % 19;
  const b = Math.floor(gy / 100);
  const c = gy % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { gy, gm: month, gd: day };
}

const MS_PER_DAY = 86_400_000;

const plusDays = (g: GregorianDateParts, days: number): GregorianDateParts => {
  const date = new Date(Date.UTC(g.gy, g.gm - 1, g.gd) + days * MS_PER_DAY);
  return { gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() };
};

/**
 * Bavaria's public holidays as observed in Nuremberg: Assumption Day (15 August)
 * is a holiday only in Catholic-majority municipalities, and Nuremberg is not one.
 */
export function nurembergHolidays(gy: number): readonly GregorianHoliday[] {
  const easter = easterSunday(gy);
  const fixed = (gm: number, gd: number, key: ByKey): GregorianHoliday => ({ g: { gy, gm, gd }, key });
  const moving = (offset: number, key: ByKey): GregorianHoliday => ({ g: plusDays(easter, offset), key });
  return [
    fixed(1, 1, 'by.new-year'),
    fixed(1, 6, 'by.epiphany'),
    moving(-2, 'by.good-friday'),
    moving(1, 'by.easter-monday'),
    fixed(5, 1, 'by.labour'),
    moving(39, 'by.ascension'),
    moving(50, 'by.whit-monday'),
    moving(60, 'by.corpus-christi'),
    fixed(10, 3, 'by.unity'),
    fixed(11, 1, 'by.all-saints'),
    fixed(12, 25, 'by.christmas'),
    fixed(12, 26, 'by.boxing'),
  ];
}
```

In `Site/src/i18n/strings.ts` add (after `STRINGS`):

```ts
import type { HolidayKey } from '../holidays/holiday-keys';
```
```ts
export const HOLIDAY_NAMES: Record<Lang, Record<HolidayKey, string>> = {
  en: {
    'ir.nowruz': 'Nowruz',
    'ir.republic': 'Islamic Republic Day',
    'ir.nature': 'Nature Day (Sizdah Bedar)',
    'ir.khomeini': 'Death of Ayatollah Khomeini',
    'ir.uprising': '15 Khordad Uprising',
    'ir.revolution': 'Revolution Day',
    'ir.oil': 'Oil Nationalisation Day',
    'ir.tasua': 'Tasua',
    'ir.ashura': 'Ashura',
    'ir.arbaeen': 'Arbaeen',
    'ir.prophet': 'Death of the Prophet, Martyrdom of Imam Hasan',
    'ir.reza': 'Martyrdom of Imam Reza',
    'ir.askari': 'Martyrdom of Imam Hasan al-Askari',
    'ir.mawlid': 'Birth of the Prophet and Imam Sadiq',
    'ir.fatima': 'Martyrdom of Fatimah',
    'ir.ali-birth': 'Birth of Imam Ali',
    'ir.mabath': 'Mab’ath',
    'ir.mahdi': 'Birth of Imam Mahdi',
    'ir.ali-martyrdom': 'Martyrdom of Imam Ali',
    'ir.fitr': 'Eid al-Fitr',
    'ir.sadiq': 'Martyrdom of Imam Sadiq',
    'ir.adha': 'Eid al-Adha',
    'ir.ghadir': 'Eid al-Ghadir',
    'by.new-year': 'New Year’s Day',
    'by.epiphany': 'Epiphany',
    'by.good-friday': 'Good Friday',
    'by.easter-monday': 'Easter Monday',
    'by.labour': 'Labour Day',
    'by.ascension': 'Ascension Day',
    'by.whit-monday': 'Whit Monday',
    'by.corpus-christi': 'Corpus Christi',
    'by.unity': 'German Unity Day',
    'by.all-saints': 'All Saints’ Day',
    'by.christmas': 'Christmas Day',
    'by.boxing': 'St Stephen’s Day',
  },
  fa: {
    'ir.nowruz': 'عید نوروز',
    'ir.republic': 'روز جمهوری اسلامی',
    'ir.nature': 'روز طبیعت',
    'ir.khomeini': 'رحلت امام خمینی',
    'ir.uprising': 'قیام ۱۵ خرداد',
    'ir.revolution': 'پیروزی انقلاب اسلامی',
    'ir.oil': 'ملی شدن صنعت نفت',
    'ir.tasua': 'تاسوعای حسینی',
    'ir.ashura': 'عاشورای حسینی',
    'ir.arbaeen': 'اربعین حسینی',
    'ir.prophet': 'رحلت رسول اکرم و شهادت امام حسن مجتبی',
    'ir.reza': 'شهادت امام رضا',
    'ir.askari': 'شهادت امام حسن عسکری',
    'ir.mawlid': 'میلاد رسول اکرم و امام جعفر صادق',
    'ir.fatima': 'شهادت حضرت فاطمه زهرا',
    'ir.ali-birth': 'ولادت امام علی',
    'ir.mabath': 'مبعث رسول اکرم',
    'ir.mahdi': 'ولادت حضرت قائم',
    'ir.ali-martyrdom': 'شهادت امام علی',
    'ir.fitr': 'عید سعید فطر',
    'ir.sadiq': 'شهادت امام جعفر صادق',
    'ir.adha': 'عید سعید قربان',
    'ir.ghadir': 'عید سعید غدیر خم',
    'by.new-year': 'سال نو میلادی',
    'by.epiphany': 'عید ظهور',
    'by.good-friday': 'جمعهٔ نیک',
    'by.easter-monday': 'دوشنبهٔ عید پاک',
    'by.labour': 'روز کارگر',
    'by.ascension': 'عروج مسیح',
    'by.whit-monday': 'دوشنبهٔ پنطیکاست',
    'by.corpus-christi': 'عید جسم مسیح',
    'by.unity': 'روز وحدت آلمان',
    'by.all-saints': 'روز همهٔ مقدسین',
    'by.christmas': 'کریسمس',
    'by.boxing': 'دومین روز کریسمس',
  },
};
```

If `resolveJsonModule` is not enabled for the JSON import in the test, use `import EASTER from './fixtures/easter-2000-2100.json' with { type: 'json' };` or read it with `readFileSync`. Whichever compiles under `tsc --noEmit` is fine. Do not change `tsconfig.json` without saying so in the report.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/holiday-rules.test.ts tests/i18n.test.ts && npx vitest run --coverage && npx tsc --noEmit`
Expected: PASS; coverage stays 100% on all four measures.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/holidays Site/src/i18n/strings.ts Site/tests/holiday-rules.test.ts Site/tests/i18n.test.ts Site/tests/fixtures/easter-2000-2100.json
git commit -m "feat(site): holiday keys, EN/FA names, Iranian solar and Nuremberg rules"
```

---
### Task 2: Lunar estimate and the official data file

**Files:**
- Create: `Site/src/holidays/lunar-estimate.ts`, `Site/src/holidays/holiday-data.ts`
- Create: `Site/tests/fixtures/ir-official-1405.json` (contents below: the 1405 religious holidays from holidayapi.ir, crawled 2026-10-15, already mapped to keys)
- Test: `Site/tests/lunar-estimate.test.ts`, `Site/tests/holiday-data.test.ts`

**Interfaces:**
- Consumes: `IrLunarKey`, `isIrLunarKey` (Task 1); `PersianHoliday` (Task 1, `rules-ir.ts`); `daysInPersianMonth`, `toGregorian`, `PersianDateParts` (`calendar/persian.ts`).
- Produces:
  - `estimateIrLunar(py: number, hijri?: HijriOf): readonly PersianHoliday[]`, memoized per year for the default `hijri`
  - `type HijriOf = (g: GregorianDateParts) => { hm: number; hd: number } | null`, plus `umalquraHijri: HijriOf`. `umalquraHijri` returns null for every date when the runtime lacks the `islamic-umalqura` calendar, and the estimate is then empty.
  - `interface OfficialHoliday { readonly key: IrLunarKey; readonly p: PersianDateParts }`
  - `interface OfficialFile { readonly year: number; readonly source: string; readonly fetched: string; readonly holidays: readonly OfficialHoliday[] }`
  - `holidayFileUrl(py: number): string` → `/api/holidays/ir/${py}.json`
  - `parseOfficialFile(raw: unknown, year: number): OfficialFile | null`
  - `fetchOfficialFile(year: number, fetchImpl?: (url: string) => Promise<Response>): Promise<OfficialFile | null>`, which never rejects

- [ ] **Step 1: Write the fixture and the failing tests**

`Site/tests/fixtures/ir-official-1405.json` holds holidayapi.ir's 1405 lunar holidays as crawled on 2026-10-15. It includes Fatimah's martyrdom on 1405-08-22, which the API flags `is_religious: false`; see Task 7.

```json
{"year": 1405, "source": "holidayapi.ir", "fetched": "2026-10-15", "holidays": [
 {"key": "ir.fitr", "p": "1405-01-01"}, {"key": "ir.fitr", "p": "1405-01-02"},
 {"key": "ir.sadiq", "p": "1405-01-25"}, {"key": "ir.adha", "p": "1405-03-06"},
 {"key": "ir.ghadir", "p": "1405-03-14"}, {"key": "ir.tasua", "p": "1405-04-03"},
 {"key": "ir.ashura", "p": "1405-04-04"}, {"key": "ir.arbaeen", "p": "1405-05-13"},
 {"key": "ir.prophet", "p": "1405-05-21"}, {"key": "ir.reza", "p": "1405-05-22"},
 {"key": "ir.askari", "p": "1405-05-30"}, {"key": "ir.mawlid", "p": "1405-06-08"},
 {"key": "ir.fatima", "p": "1405-08-22"}, {"key": "ir.ali-birth", "p": "1405-10-02"},
 {"key": "ir.mabath", "p": "1405-10-16"}, {"key": "ir.mahdi", "p": "1405-11-04"},
 {"key": "ir.ali-martyrdom", "p": "1405-12-09"}, {"key": "ir.fitr", "p": "1405-12-19"},
 {"key": "ir.fitr", "p": "1405-12-20"}
]}
```

```ts
// Site/tests/lunar-estimate.test.ts
import { describe, expect, it } from 'vitest';
import OFFICIAL_1405 from './fixtures/ir-official-1405.json';
import { toGregorian } from '../src/calendar/persian';
import { estimateIrLunar, umalquraHijri, type HijriOf } from '../src/holidays/lunar-estimate';

const day = (p: { py: number; pm: number; pd: number }): number => {
  const g = toGregorian(p);
  return Date.UTC(g.gy, g.gm - 1, g.gd) / 86_400_000;
};
const parse = (s: string) => {
  const [py, pm, pd] = s.split('-').map(Number) as [number, number, number];
  return { py, pm, pd };
};

describe('umalquraHijri', () => {
  it('reads Umm al-Qura month and day for a Gregorian date', () => {
    expect(umalquraHijri({ gy: 2026, gm: 6, gd: 25 })).toEqual({ hm: 1, hd: 10 }); // Ashura 1448
  });
});

describe('estimateIrLunar', () => {
  it('estimates 1405 in date order, Tasua and Ashura on 3–4 Tir', () => {
    const list = estimateIrLunar(1405).map((h) => `${h.p.pm}-${h.p.pd} ${h.key}`);
    expect(list).toContain('4-3 ir.tasua');
    expect(list).toContain('4-4 ir.ashura');
    expect(list[0]).toBe('1-1 ir.fitr'); // 2 Shawwal 1447 is Nowruz (1 Shawwal is 29 Esfand 1404) — correct as written
    const order = estimateIrLunar(1405).map((h) => day(h.p));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('marks the last day of Safar, whether Safar has 29 or 30 days', () => {
    const reza = estimateIrLunar(1405).filter((h) => h.key === 'ir.reza');
    expect(reza.map((h) => `${h.p.pm}-${h.p.pd}`)).toEqual(['5-22']);
  });

  it('keeps both occurrences of a Hijri date that falls twice in one Persian year', () => {
    const aliMartyrdom = estimateIrLunar(1404).filter((h) => h.key === 'ir.ali-martyrdom');
    expect(aliMartyrdom.map((h) => `${h.p.pm}-${h.p.pd}`)).toEqual(['1-1', '12-19']);
    expect(estimateIrLunar(1404).filter((h) => h.key === 'ir.fitr')).toHaveLength(3);
  });

  it('is within a day of every official 1405 holiday', () => {
    const estimates = estimateIrLunar(1405);
    for (const official of OFFICIAL_1405.holidays) {
      const near = estimates.some((e) => e.key === official.key
        && Math.abs(day(e.p) - day(parse(official.p))) <= 1);
      expect(near, `${official.key} ${official.p}`).toBe(true);
    }
  });

  it('memoizes per year', () => {
    expect(estimateIrLunar(1405)).toBe(estimateIrLunar(1405));
  });

  it('estimates nothing when the runtime has no Umm al-Qura calendar', () => {
    const none: HijriOf = () => null;
    expect(estimateIrLunar(1405, none)).toEqual([]);
  });
});
```

```ts
// Site/tests/holiday-data.test.ts
import { describe, expect, it, vi } from 'vitest';
import { fetchOfficialFile, holidayFileUrl, parseOfficialFile } from '../src/holidays/holiday-data';

const VALID = {
  year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
  holidays: [{ key: 'ir.ashura', p: '1405-04-04' }, { key: 'ir.tasua', p: '1405-04-03' }],
};

describe('parseOfficialFile', () => {
  it('accepts a valid file and parses the dates', () => {
    expect(parseOfficialFile(VALID, 1405)).toEqual({
      year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
      holidays: [
        { key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 4 } },
        { key: 'ir.tasua', p: { py: 1405, pm: 4, pd: 3 } },
      ],
    });
  });

  it('accepts Esfand 30 only in a leap year', () => {
    // 1403 is a leap year; 1405 is not.
    const leap = { ...VALID, year: 1403, holidays: [{ key: 'ir.fitr', p: '1403-12-30' }] };
    expect(parseOfficialFile(leap, 1403)).not.toBeNull();
    const notLeap = { ...VALID, holidays: [{ key: 'ir.fitr', p: '1405-12-30' }] };
    expect(parseOfficialFile(notLeap, 1405)).toBeNull();
  });

  it('rejects the whole file for any defect', () => {
    const broken: unknown[] = [
      null, 'x', [], {},
      { ...VALID, year: 1406 },                                   // not the requested year
      { ...VALID, year: '1405' },
      { ...VALID, source: '' },
      { ...VALID, fetched: '12.10.2026' },
      { ...VALID, holidays: 'none' },
      { ...VALID, holidays: [null] },
      { ...VALID, holidays: [{ key: 'ir.nowruz', p: '1405-01-01' }] },  // solar keys are not official-file keys
      { ...VALID, holidays: [{ key: 'ir.unknown', p: '1405-04-04' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1406-04-04' }] },  // date outside the year
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-13-01' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-07-31' }] },  // Mehr has 30 days
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-4-4' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: 14050404 }] },
    ];
    for (const raw of broken) expect(parseOfficialFile(raw, 1405), JSON.stringify(raw)).toBeNull();
  });
});

describe('fetchOfficialFile', () => {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('fetches the year\'s file from our own origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(VALID));
    await expect(fetchOfficialFile(1405, fetchImpl)).resolves.toMatchObject({ year: 1405 });
    expect(fetchImpl).toHaveBeenCalledWith(holidayFileUrl(1405));
    expect(holidayFileUrl(1405)).toBe('/api/holidays/ir/1405.json');
  });

  it.each([
    ['a 404', async () => new Response('Not found', { status: 404 })],
    ['a network error', async () => { throw new TypeError('offline'); }],
    ['an HTML page', async () => new Response('<!doctype html>', { status: 200 })],
    ['an invalid file', async () => json({ ...VALID, year: 1406 })],
  ])('gives null for %s', async (_label, answer) => {
    await expect(fetchOfficialFile(1405, vi.fn<typeof fetch>(answer as () => Promise<Response>))).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lunar-estimate.test.ts tests/holiday-data.test.ts`
Expected: FAIL, because the modules do not exist yet.

- [ ] **Step 3: Implement**

```ts
// Site/src/holidays/lunar-estimate.ts
import {
  daysInPersianMonth, toGregorian, type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import type { IrLunarKey } from './holiday-keys';
import type { PersianHoliday } from './rules-ir';

/** Hijri month and day of a Gregorian date, or null when the runtime cannot say. */
export type HijriOf = (g: GregorianDateParts) => { hm: number; hd: number } | null;

const SAFAR = 2;
const RABI_I = 3;

/** Hijri "month-day" → holiday. The last day of Safar is found separately. */
const RULES: Readonly<Record<string, IrLunarKey>> = {
  '1-9': 'ir.tasua', '1-10': 'ir.ashura', '2-20': 'ir.arbaeen', '2-28': 'ir.prophet',
  '3-8': 'ir.askari', '3-17': 'ir.mawlid', '6-3': 'ir.fatima', '7-13': 'ir.ali-birth',
  '7-27': 'ir.mabath', '8-15': 'ir.mahdi', '9-21': 'ir.ali-martyrdom', '10-1': 'ir.fitr',
  '10-2': 'ir.fitr', '10-25': 'ir.sadiq', '12-10': 'ir.adha', '12-18': 'ir.ghadir',
};

const UMALQURA = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', month: 'numeric', day: 'numeric',
});
const HAS_UMALQURA = UMALQURA.resolvedOptions().calendar === 'islamic-umalqura';

/**
 * `Intl` can format a date in the Umm al-Qura calendar but cannot convert back,
 * which is why the estimate walks the solar year a day at a time.
 */
export const umalquraHijri: HijriOf = (g) => {
  if (!HAS_UMALQURA) return null;
  const parts = UMALQURA.formatToParts(new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12)));
  const value = (type: 'month' | 'day'): number => Number(parts.find((x) => x.type === type)?.value);
  return { hm: value('month'), hd: value('day') };
};

function daysOf(py: number): PersianDateParts[] {
  const days: PersianDateParts[] = [];
  for (let pm = 1; pm <= 12; pm += 1) {
    for (let pd = 1; pd <= daysInPersianMonth(py, pm); pd += 1) days.push({ py, pm, pd });
  }
  return days;
}

function compute(py: number, hijri: HijriOf): readonly PersianHoliday[] {
  // One day past the year's end, so the year's last day can be checked for "last day of Safar".
  const days = [...daysOf(py), { py: py + 1, pm: 1, pd: 1 }];
  const dates = days.map((p) => hijri(toGregorian(p)));
  const holidays: PersianHoliday[] = [];
  for (let i = 0; i < days.length - 1; i += 1) {
    const h = dates[i];
    if (!h) continue;
    const key = RULES[`${h.hm}-${h.hd}`];
    if (key) holidays.push({ p: days[i]!, key });
    if (h.hm === SAFAR && dates[i + 1]?.hm === RABI_I) holidays.push({ p: days[i]!, key: 'ir.reza' });
  }
  return holidays;
}

const memo = new Map<number, readonly PersianHoliday[]>();

/**
 * Iranian lunar holidays for a Persian year, estimated with the Umm al-Qura
 * calendar. Iran fixes them by moon sighting, which can differ by a day either way.
 */
export function estimateIrLunar(py: number, hijri: HijriOf = umalquraHijri): readonly PersianHoliday[] {
  if (hijri !== umalquraHijri) return compute(py, hijri);
  let cached = memo.get(py);
  if (!cached) {
    cached = compute(py, hijri);
    memo.set(py, cached);
  }
  return cached;
}
```

(Coverage note: two different branches. The `if (!HAS_UMALQURA) return null;` line in `umalquraHijri` cannot be reached in Node, which has full ICU. Put `/* v8 ignore next */` on that line only, with a comment giving the reason. The `if (!h) continue;` in `compute()` *is* reached by the `none` test, so it must not be ignored.)

```ts
// Site/src/holidays/holiday-data.ts
import { daysInPersianMonth, type PersianDateParts } from '../calendar/persian';
import { isIrLunarKey, type IrLunarKey } from './holiday-keys';

export interface OfficialHoliday {
  readonly key: IrLunarKey;
  readonly p: PersianDateParts;
}

export interface OfficialFile {
  readonly year: number;
  readonly source: string;
  readonly fetched: string;
  readonly holidays: readonly OfficialHoliday[];
}

export const holidayFileUrl = (py: number): string => `/api/holidays/ir/${py}.json`;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseDay(value: unknown, year: number): PersianDateParts | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [py, pm, pd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (py !== year || pm < 1 || pm > 12 || pd < 1 || pd > daysInPersianMonth(py, pm)) return null;
  return { py, pm, pd };
}

function parseHoliday(value: unknown, year: number): OfficialHoliday | null {
  if (!isRecord(value) || !isIrLunarKey(value['key'])) return null;
  const p = parseDay(value['p'], year);
  return p === null ? null : { key: value['key'], p };
}

/** All or nothing: a file with any defect is ignored and the estimates stand in. */
export function parseOfficialFile(raw: unknown, year: number): OfficialFile | null {
  if (!isRecord(raw) || raw['year'] !== year) return null;
  const { source, fetched, holidays } = raw;
  if (typeof source !== 'string' || source === '') return null;
  if (typeof fetched !== 'string' || !ISO_DATE.test(fetched)) return null;
  if (!Array.isArray(holidays)) return null;
  const parsed = holidays.map((h) => parseHoliday(h, year));
  if (parsed.some((h) => h === null)) return null;
  return { year, source, fetched, holidays: parsed as OfficialHoliday[] };
}

/** Never rejects: no file, no network or a bad file all mean "use the estimates". */
export async function fetchOfficialFile(
  year: number,
  fetchImpl: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<OfficialFile | null> {
  try {
    const response = await fetchImpl(holidayFileUrl(year));
    if (!response.ok) return null;
    return parseOfficialFile(await response.json(), year);
  } catch {
    return null;
  }
}
```

(`fetchImpl` is called with exactly one argument, the URL. The tests check `toHaveBeenCalledWith(holidayFileUrl(1405))` against both an injected fetch and the global one, so the default wrapper must not add a second `undefined` argument.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lunar-estimate.test.ts tests/holiday-data.test.ts && npx vitest run --coverage && npx tsc --noEmit`
Expected: PASS at 100% coverage.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/holidays/lunar-estimate.ts Site/src/holidays/holiday-data.ts Site/tests/lunar-estimate.test.ts Site/tests/holiday-data.test.ts Site/tests/fixtures/ir-official-1405.json
git commit -m "feat(site): Iranian lunar holiday estimate and official data-file validation"
```

---
### Task 3: Settings — views and holidays groups

**Files:**
- Modify: `Site/src/settings/settings-model.ts`
- Test: `Site/tests/settings-model.test.ts`, and expectation updates in `Site/tests/dom/settings-store.test.ts` (whole-object comparisons gain the two new groups)

**Interfaces:**
- Produces:
  - `type HolidaySource = 'ir' | 'nuremberg' | 'user'`, `HOLIDAY_SOURCES: readonly HolidaySource[]` (canonical order)
  - `type UserHolidayCalendar = 'persian' | 'gregorian'`
  - `interface UserHoliday { readonly id: string; readonly name: string; readonly calendar: UserHolidayCalendar; readonly month: number; readonly day: number; readonly year?: number }`
  - `interface ViewSettings { readonly enabled: boolean; readonly open: boolean }`
  - `Settings` gains `readonly views: { readonly persian: ViewSettings; readonly gregorian: ViewSettings }` and `readonly holidays: { readonly sources: readonly HolidaySource[]; readonly user: readonly UserHoliday[] }`
  - `MAX_HOLIDAY_NAME_LENGTH = 60`, `MAX_USER_HOLIDAYS = 200`
  - `parseUserHoliday(raw: unknown): UserHoliday | null`, which the settings group (Task 6) uses to validate its form
  - `maxDayOfMonth(calendar: UserHolidayCalendar, month: number): number`, the longest the month can ever be (Esfand 30, Feb 29)

- [ ] **Step 1: Write the failing tests**

Append to `Site/tests/settings-model.test.ts` (import the new names):

```ts
describe('views and holidays groups', () => {
  it('defaults: both views on, Persian open, every holiday source, no user holidays', () => {
    const s = parseSettings(undefined);
    expect(s.views).toEqual({ persian: { enabled: true, open: true }, gregorian: { enabled: true, open: false } });
    expect(s.holidays).toEqual({ sources: ['ir', 'nuremberg', 'user'], user: [] });
  });

  it('keeps valid view flags and replaces invalid ones field by field', () => {
    const s = parseSettings({ views: { persian: { enabled: false, open: 'yes' }, gregorian: { open: true } } });
    expect(s.views).toEqual({ persian: { enabled: false, open: true }, gregorian: { enabled: true, open: true } });
  });

  it('keeps known sources once each, in canonical order; an empty list is a valid choice', () => {
    expect(parseSettings({ holidays: { sources: ['user', 'x', 'ir', 'ir'] } }).holidays.sources).toEqual(['ir', 'user']);
    expect(parseSettings({ holidays: { sources: [] } }).holidays.sources).toEqual([]);
    expect(parseSettings({ holidays: { sources: 'ir' } }).holidays.sources).toEqual(HOLIDAY_SOURCES);
  });

  it('drops invalid user holidays one by one and keeps the rest', () => {
    const good = { id: 'a1', name: 'Birthday', calendar: 'persian', month: 7, day: 22 };
    const user = [
      good,
      { ...good, id: 'a1' },                              // duplicate id
      { ...good, id: 'b', name: '   ' },
      { ...good, id: 'c', calendar: 'hijri' },
      { ...good, id: 'd', month: 13 },
      { ...good, id: 'e', month: 7, day: 31 },            // Mehr has 30 days
      { ...good, id: 'f', year: 1.5 },
      'nope',
    ];
    expect(parseSettings({ holidays: { user } }).holidays.user).toEqual([good]);
    expect(parseSettings({ holidays: { user: 'x' } }).holidays.user).toEqual([]);
  });

  it('caps the list', () => {
    const user = Array.from({ length: MAX_USER_HOLIDAYS + 5 }, (_, i) => ({
      id: `id${i}`, name: `H${i}`, calendar: 'gregorian', month: 1, day: 1,
    }));
    expect(parseSettings({ holidays: { user } }).holidays.user).toHaveLength(MAX_USER_HOLIDAYS);
  });
});

describe('parseUserHoliday', () => {
  const base = { id: 'x-1', name: 'Name', calendar: 'gregorian', month: 2, day: 29 };

  it('accepts Feb 29 and Esfand 30 as yearly days', () => {
    expect(parseUserHoliday(base)).toEqual(base);
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30 })).not.toBeNull();
  });

  it('accepts them with a year only when that year has the day', () => {
    expect(parseUserHoliday({ ...base, year: 2028 })).toEqual({ ...base, year: 2028 });
    expect(parseUserHoliday({ ...base, year: 2027 })).toBeNull();
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30, year: 1403 })).not.toBeNull();
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30, year: 1405 })).toBeNull();
  });

  it('trims the name and enforces its length', () => {
    expect(parseUserHoliday({ ...base, name: '  Party  ' })?.name).toBe('Party');
    expect(parseUserHoliday({ ...base, name: 'x'.repeat(MAX_HOLIDAY_NAME_LENGTH) })).not.toBeNull();
    expect(parseUserHoliday({ ...base, name: 'x'.repeat(MAX_HOLIDAY_NAME_LENGTH + 1) })).toBeNull();
  });

  it('rejects malformed ids, years out of range and non-integers', () => {
    for (const bad of [
      { ...base, id: '' }, { ...base, id: 'a b' }, { ...base, id: 7 },
      { ...base, year: 1000 }, { ...base, calendar: 'persian', month: 1, day: 1, year: 1600 },
      { ...base, day: 0 }, { ...base, month: 2.5 }, null,
    ]) expect(parseUserHoliday(bad), JSON.stringify(bad)).toBeNull();
  });

  it('knows the longest each month can be', () => {
    expect([1, 6, 7, 11, 12].map((m) => maxDayOfMonth('persian', m))).toEqual([31, 31, 30, 30, 30]);
    expect([1, 2, 4, 12].map((m) => maxDayOfMonth('gregorian', m))).toEqual([31, 29, 30, 31]);
  });
});
```

Change the existing `'keeps every valid field'` test's `raw` to include full `views` and `holidays` groups, for example `views: { persian: { enabled: false, open: false }, gregorian: { enabled: true, open: true } }` and `holidays: { sources: ['nuremberg'], user: [{ id: 'a', name: 'N', calendar: 'persian', month: 1, day: 1 }] }`. In `tests/dom/settings-store.test.ts`, add `views` and `holidays` (the defaults) to the whole-object `expected`. These edits are required by the type change and are not a behaviour change. The `'keeps every valid field'` fixture must already be canonical: trimmed names and sources in `HOLIDAY_SOURCES` order. `parseSettings` normalises both, and `toEqual(raw)` only holds for canonical input.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/settings-model.test.ts tests/dom/settings-store.test.ts`
Expected: FAIL. The new exports don't exist, and `views` and `holidays` are undefined.

- [ ] **Step 3: Implement** (additions to `Site/src/settings/settings-model.ts`)

```ts
import {
  daysInGregorianMonth, daysInPersianMonth, PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
} from '../calendar/persian';
import { GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN } from '../converter/converter-core';

export type HolidaySource = 'ir' | 'nuremberg' | 'user';
export const HOLIDAY_SOURCES: readonly HolidaySource[] = ['ir', 'nuremberg', 'user'];
export type UserHolidayCalendar = 'persian' | 'gregorian';

export interface UserHoliday {
  readonly id: string;
  readonly name: string;
  readonly calendar: UserHolidayCalendar;
  readonly month: number;
  readonly day: number;
  /** Absent: every year. */
  readonly year?: number;
}

export interface ViewSettings {
  readonly enabled: boolean;
  readonly open: boolean;
}

export const MAX_HOLIDAY_NAME_LENGTH = 60;
export const MAX_USER_HOLIDAYS = 200;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const GREGORIAN_MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
```

Extend `Settings` and `DEFAULT_SETTINGS`:

```ts
export interface Settings {
  readonly copy: CopySettings;
  readonly time: TimeSettings;
  readonly views: { readonly persian: ViewSettings; readonly gregorian: ViewSettings };
  readonly holidays: { readonly sources: readonly HolidaySource[]; readonly user: readonly UserHoliday[] };
}

export const DEFAULT_SETTINGS: Settings = {
  copy: { calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin' },
  time: { source: 'server' },
  views: { persian: { enabled: true, open: true }, gregorian: { enabled: true, open: false } },
  holidays: { sources: HOLIDAY_SOURCES, user: [] },
};
```

```ts
/** The longest the month can be in any year: Esfand 30 and Feb 29 count. */
export function maxDayOfMonth(calendar: UserHolidayCalendar, month: number): number {
  if (calendar === 'gregorian') return GREGORIAN_MAX_DAYS[month - 1] as number;
  return month <= 6 ? 31 : 30;
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** One user holiday, or null. With a year, the day must exist in that year. */
export function parseUserHoliday(raw: unknown): UserHoliday | null {
  if (!isRecord(raw)) return null;
  const { id, name, calendar, month, day, year } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_HOLIDAY_NAME_LENGTH) return null;
  if (calendar !== 'persian' && calendar !== 'gregorian') return null;
  if (!isInt(month, 1, 12) || !isInt(day, 1, maxDayOfMonth(calendar, month))) return null;
  const base = { id, name: trimmed, calendar, month, day };
  if (year === undefined) return base;
  const [min, max] = calendar === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX] : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  if (!isInt(year, min, max)) return null;
  const length = calendar === 'persian' ? daysInPersianMonth(year, month) : daysInGregorianMonth(year, month);
  return day <= length ? { ...base, year } : null;
}

const parseView = (raw: unknown, fallback: ViewSettings): ViewSettings => {
  const view = isRecord(raw) ? raw : {};
  return {
    enabled: typeof view['enabled'] === 'boolean' ? view['enabled'] : fallback.enabled,
    open: typeof view['open'] === 'boolean' ? view['open'] : fallback.open,
  };
};

const parseSources = (raw: unknown): readonly HolidaySource[] =>
  Array.isArray(raw) ? HOLIDAY_SOURCES.filter((s) => raw.includes(s)) : DEFAULT_SETTINGS.holidays.sources;

const parseUserHolidays = (raw: unknown): readonly UserHoliday[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const kept: UserHoliday[] = [];
  for (const entry of raw) {
    const holiday = parseUserHoliday(entry);
    if (holiday === null || seen.has(holiday.id)) continue;
    seen.add(holiday.id);
    kept.push(holiday);
    if (kept.length === MAX_USER_HOLIDAYS) break;
  }
  return kept;
};
```

and in `parseSettings`:

```ts
  const views = group('views');
  const holidays = group('holidays');
  return {
    copy: { … unchanged … },
    time: { … unchanged … },
    views: {
      persian: parseView(views['persian'], fallback.views.persian),
      gregorian: parseView(views['gregorian'], fallback.views.gregorian),
    },
    holidays: {
      sources: parseSources(holidays['sources']),
      user: parseUserHolidays(holidays['user']),
    },
  };
```

(Move `isRecord` above `parseUserHoliday` if needed. `parseSettings` already has a `group(key)` helper from the time-sync work; reuse it.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run --coverage && npx tsc --noEmit`
Expected: PASS at 100%. `tsc` must stay clean: every existing `store.update` already spreads `...s`, so the two new groups are carried through.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/settings/settings-model.ts Site/tests/settings-model.test.ts Site/tests/dom/settings-store.test.ts
git commit -m "feat(site): settings for calendar views, holiday sources and user holidays"
```

---
### Task 4: Merge and the holiday service

**Files:**
- Create: `Site/src/holidays/merge.ts`, `Site/src/holidays/holiday-service.ts`
- Test: `Site/tests/merge.test.ts`, `Site/tests/holiday-service.test.ts`

**Interfaces:**
- Consumes:
  - `irSolarHolidays`, `PersianHoliday` (Task 1)
  - `nurembergHolidays` (Task 1)
  - `estimateIrLunar` (Task 2)
  - `OfficialFile`, `fetchOfficialFile` (Task 2)
  - `HolidaySource`, `UserHoliday`, `Settings` (Task 3)
  - `Side` (`converter/converter-core.ts`)
  - `toGregorian`, `toPersian`, `daysInPersianMonth`, `daysInGregorianMonth`
- Produces:

```ts
// merge.ts
export type DayHoliday =
  | { readonly source: 'ir' | 'nuremberg'; readonly key: HolidayKey; readonly estimated: boolean }
  | { readonly source: 'user'; readonly id: string; readonly name: string; readonly estimated: false };
/** Day of the displayed month (1-based) → its holidays, Iran first, then Nuremberg, then the user's. Days without holidays are absent. */
export type MonthHolidays = ReadonlyMap<number, readonly DayHoliday[]>;
export interface MergeInput {
  readonly sources: readonly HolidaySource[];
  readonly user: readonly UserHoliday[];
  /** The validated official file for a Persian year, or null to use the estimate. */
  readonly official: (py: number) => OfficialFile | null;
  readonly estimate?: (py: number) => readonly PersianHoliday[];
}
export function holidaysForMonth(side: Side, year: number, month: number, input: MergeInput): MonthHolidays;

// holiday-service.ts
export interface HolidayService {
  forMonth(side: Side, year: number, month: number): MonthHolidays;
  /** Status for Settings: which official file the given Persian year uses. Refetches. */
  probe(py: number): Promise<OfficialFile | null>;
  subscribe(listener: () => void): () => void;
}
export interface HolidayServiceDeps {
  readonly store: Pick<SettingsStore, 'get'>;
  readonly fetchFile?: (py: number) => Promise<OfficialFile | null>;  // default fetchOfficialFile
  readonly dateNow?: () => number;                                     // default Date.now
}
export const OFFICIAL_RETRY_MS = 3_600_000;
export function createHolidayService(deps: HolidayServiceDeps): HolidayService;
```

Service behaviour:
- `forMonth` merges the stored settings (`holidays.sources`, `holidays.user`) with official files.
- **Starting a fetch:** only when `ir` is among the sources, for each Persian year the month touches that has neither a loaded file nor a fetch in flight. A failed fetch (null) is retried no sooner than `OFFICIAL_RETRY_MS` after it was made.
- **While waiting:** until a file arrives, `official(py)` is null, so the estimate shows.
- **When a file arrives:** listeners are notified so the panels re-render. A null result notifies nobody.
- **`probe`:** always fetches. A non-null result replaces the cached file and notifies. A null result keeps a previously loaded file (an offline probe must not wipe good data) and is returned to the caller as null.

- [ ] **Step 1: Write the failing tests**

```ts
// Site/tests/merge.test.ts
import { describe, expect, it } from 'vitest';
import { holidaysForMonth, type MergeInput } from '../src/holidays/merge';
import type { OfficialFile } from '../src/holidays/holiday-data';

const NO_FILE = (): OfficialFile | null => null;
const ALL: MergeInput = { sources: ['ir', 'nuremberg', 'user'], user: [], official: NO_FILE };
const summary = (map: ReadonlyMap<number, readonly { source: string; estimated: boolean; key?: string; name?: string }[]>) =>
  [...map].map(([day, list]) => `${day}:${list.map((h) => `${h.source}/${h.key ?? h.name}${h.estimated ? '*' : ''}`).join(',')}`);

describe('holidaysForMonth', () => {
  it('Farvardin 1405: Nowruz, Eid al-Fitr estimated, Sizdah Bedar; nothing from Nuremberg', () => {
    const days = summary(holidaysForMonth('persian', 1405, 1, ALL));
    expect(days).toContain('1:ir/ir.nowruz,ir/ir.fitr*');
    expect(days).toContain('13:ir/ir.nature');
    expect(days.find((d) => d.startsWith('24:'))).toBe('24:ir/ir.sadiq*');
  });

  it('a Gregorian month that straddles Nowruz shows both Persian years', () => {
    const days = summary(holidaysForMonth('gregorian', 2026, 3, ALL));
    expect(days).toContain('20:ir/ir.oil,ir/ir.fitr*');      // 29 Esfand 1404 + 1 Shawwal 1447
    expect(days).toContain('21:ir/ir.nowruz,ir/ir.fitr*');   // 1 Farvardin 1405
  });

  it('Nuremberg holidays by Gregorian date, in either view', () => {
    expect(summary(holidaysForMonth('gregorian', 2026, 4, ALL))).toEqual(
      expect.arrayContaining(['3:nuremberg/by.good-friday', '6:nuremberg/by.easter-monday']),
    );
    // 3 April 2026 is 14 Farvardin 1405.
    expect(summary(holidaysForMonth('persian', 1405, 1, ALL))).toContain('14:nuremberg/by.good-friday');
  });

  it('uses the official file for lunar dates when there is one, unflagged', () => {
    const official = (py: number): OfficialFile | null => (py === 1405
      ? { year: 1405, source: 's', fetched: '2026-10-12', holidays: [{ key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 5 } }] }
      : null);
    const days = summary(holidaysForMonth('persian', 1405, 4, { ...ALL, official }));
    expect(days).toEqual(['5:ir/ir.ashura']);   // the estimate's Tasua/Ashura on 3–4 Tir are gone
  });

  it('shows only the enabled sources; none at all gives an empty map', () => {
    expect(summary(holidaysForMonth('gregorian', 2026, 4, { ...ALL, sources: ['nuremberg'] })))
      .toEqual(['3:nuremberg/by.good-friday', '6:nuremberg/by.easter-monday']);
    expect(holidaysForMonth('persian', 1405, 1, { ...ALL, sources: [] }).size).toBe(0);
  });

  it('places yearly and one-off user holidays in either calendar', () => {
    const user = [
      { id: 'a', name: 'Yearly', calendar: 'persian' as const, month: 7, day: 22 },
      { id: 'b', name: 'Once', calendar: 'gregorian' as const, month: 10, day: 14, year: 2026 },
      { id: 'c', name: 'Other year', calendar: 'gregorian' as const, month: 10, day: 14, year: 2027 },
    ];
    // Mehr 1405 also holds German Unity Day (3 Oct = 11 Mehr), so look at user holidays only.
    expect(summary(holidaysForMonth('persian', 1405, 7, { ...ALL, sources: ['user'], user }))).toEqual(['22:user/Yearly,user/Once']);
    expect(summary(holidaysForMonth('gregorian', 2026, 10, { ...ALL, sources: ['user'], user }))).toEqual(['14:user/Yearly,user/Once']);
  });

  it('shows Esfand 30 and Feb 29 only in years that have them', () => {
    const user = [
      { id: 'e', name: 'Esfand 30', calendar: 'persian' as const, month: 12, day: 30 },
      { id: 'f', name: 'Feb 29', calendar: 'gregorian' as const, month: 2, day: 29 },
    ];
    const only = { ...ALL, sources: ['user'] as const, user };
    expect(summary(holidaysForMonth('persian', 1403, 12, only))).toEqual(['30:user/Esfand 30']); // leap
    expect(holidaysForMonth('persian', 1405, 12, only).size).toBe(0);
    expect(summary(holidaysForMonth('gregorian', 2028, 2, only))).toEqual(['29:user/Feb 29']);
    expect(holidaysForMonth('gregorian', 2026, 2, only).size).toBe(0);
  });
});
```

```ts
// Site/tests/holiday-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings/settings-model';
import { createHolidayService, OFFICIAL_RETRY_MS } from '../src/holidays/holiday-service';
import type { OfficialFile } from '../src/holidays/holiday-data';

const FILE_1405: OfficialFile = {
  year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
  holidays: [{ key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 5 } }],
};
const storeWith = (settings: Settings = DEFAULT_SETTINGS) => ({ get: () => settings });
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('holiday service', () => {
  it('shows estimates at once, then the official file once it arrives, and notifies', async () => {
    const fetchFile = vi.fn(async (py: number) => (py === 1405 ? FILE_1405 : null));
    const service = createHolidayService({ store: storeWith(), fetchFile });
    const listener = vi.fn();
    service.subscribe(listener);

    expect(service.forMonth('persian', 1405, 4).get(4)?.[0]).toMatchObject({ key: 'ir.ashura', estimated: true });
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.forMonth('persian', 1405, 4).get(5)?.[0]).toMatchObject({ key: 'ir.ashura', estimated: false });
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('fetches each Persian year the month touches, once', async () => {
    const fetchFile = vi.fn(async () => null);
    const service = createHolidayService({ store: storeWith(), fetchFile });
    service.forMonth('gregorian', 2026, 3);
    service.forMonth('gregorian', 2026, 3);
    expect(fetchFile.mock.calls.map(([py]) => py).sort()).toEqual([1404, 1405]);
  });

  it('retries a failed year only after an hour', async () => {
    let now = 0;
    const fetchFile = vi.fn(async () => null);
    const service = createHolidayService({ store: storeWith(), fetchFile, dateNow: () => now });
    service.forMonth('persian', 1405, 1);
    await flush();
    service.forMonth('persian', 1405, 1);
    expect(fetchFile).toHaveBeenCalledTimes(1);
    now = OFFICIAL_RETRY_MS;
    service.forMonth('persian', 1405, 1);
    expect(fetchFile).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when Iranian holidays are off', () => {
    const fetchFile = vi.fn(async () => FILE_1405);
    const settings = { ...DEFAULT_SETTINGS, holidays: { ...DEFAULT_SETTINGS.holidays, sources: ['nuremberg'] as const } };
    createHolidayService({ store: storeWith(settings), fetchFile }).forMonth('persian', 1405, 4);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('probe refetches and updates, but an empty probe keeps good data', async () => {
    let answer: OfficialFile | null = FILE_1405;
    const fetchFile = vi.fn(async () => answer);
    const service = createHolidayService({ store: storeWith(), fetchFile });
    const listener = vi.fn();
    service.subscribe(listener);
    await expect(service.probe(1405)).resolves.toBe(FILE_1405);
    expect(listener).toHaveBeenCalledTimes(1);
    answer = null;
    await expect(service.probe(1405)).resolves.toBeNull();
    expect(service.forMonth('persian', 1405, 4).get(5)?.[0]).toMatchObject({ estimated: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes', async () => {
    const service = createHolidayService({ store: storeWith(), fetchFile: async () => FILE_1405 });
    const listener = vi.fn();
    service.subscribe(listener)();
    service.forMonth('persian', 1405, 4);
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('uses the real fetch and clock by default', async () => {
    const realFetch = vi.fn<typeof fetch>(async () => new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', realFetch);
    try {
      createHolidayService({ store: storeWith() }).forMonth('persian', 1405, 1);
      await flush();
      expect(realFetch).toHaveBeenCalledWith('/api/holidays/ir/1405.json');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/merge.test.ts tests/holiday-service.test.ts`
Expected: FAIL, because the modules do not exist yet.

- [ ] **Step 3: Implement**

```ts
// Site/src/holidays/merge.ts
import {
  daysInGregorianMonth, daysInPersianMonth, toGregorian, toPersian,
  type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import type { Side } from '../converter/converter-core';
import type { HolidaySource, UserHoliday } from '../settings/settings-model';
import type { OfficialFile } from './holiday-data';
import type { HolidayKey } from './holiday-keys';
import { estimateIrLunar } from './lunar-estimate';
import { nurembergHolidays } from './rules-by';
import { irSolarHolidays, type PersianHoliday } from './rules-ir';

export type DayHoliday =
  | { readonly source: 'ir' | 'nuremberg'; readonly key: HolidayKey; readonly estimated: boolean }
  | { readonly source: 'user'; readonly id: string; readonly name: string; readonly estimated: false };

export type MonthHolidays = ReadonlyMap<number, readonly DayHoliday[]>;

export interface MergeInput {
  readonly sources: readonly HolidaySource[];
  readonly user: readonly UserHoliday[];
  readonly official: (py: number) => OfficialFile | null;
  readonly estimate?: (py: number) => readonly PersianHoliday[];
}

interface Day { readonly p: PersianDateParts; readonly g: GregorianDateParts }

const pKey = (p: PersianDateParts): string => `${p.py}-${p.pm}-${p.pd}`;
const gKey = (g: GregorianDateParts): string => `${g.gy}-${g.gm}-${g.gd}`;

function daysOfMonth(side: Side, year: number, month: number): Day[] {
  if (side === 'persian') {
    return Array.from({ length: daysInPersianMonth(year, month) }, (_, i) => {
      const p = { py: year, pm: month, pd: i + 1 };
      return { p, g: toGregorian(p) };
    });
  }
  return Array.from({ length: daysInGregorianMonth(year, month) }, (_, i) => {
    const g = { gy: year, gm: month, gd: i + 1 };
    return { p: toPersian(g), g };
  });
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

function iranByDay(years: ReadonlySet<number>, input: MergeInput): Map<string, DayHoliday[]> {
  const byDay = new Map<string, DayHoliday[]>();
  const estimate = input.estimate ?? estimateIrLunar;
  for (const py of years) {
    for (const h of irSolarHolidays(py)) push(byDay, pKey(h.p), { source: 'ir', key: h.key, estimated: false });
    const file = input.official(py);
    const lunar = file ? file.holidays : estimate(py);
    for (const h of lunar) push(byDay, pKey(h.p), { source: 'ir', key: h.key, estimated: file === null });
  }
  return byDay;
}

function nurembergByDay(years: ReadonlySet<number>): Map<string, DayHoliday[]> {
  const byDay = new Map<string, DayHoliday[]>();
  for (const gy of years) {
    for (const h of nurembergHolidays(gy)) push(byDay, gKey(h.g), { source: 'nuremberg', key: h.key, estimated: false });
  }
  return byDay;
}

const userMatches = (u: UserHoliday, day: Day): boolean => {
  const [y, m, d] = u.calendar === 'persian' ? [day.p.py, day.p.pm, day.p.pd] : [day.g.gy, day.g.gm, day.g.gd];
  return u.month === m && u.day === d && (u.year === undefined || u.year === y);
};

/** Every holiday on each day of one displayed month, whichever calendar shows it. */
export function holidaysForMonth(side: Side, year: number, month: number, input: MergeInput): MonthHolidays {
  const days = daysOfMonth(side, year, month);
  const on = (source: HolidaySource): boolean => input.sources.includes(source);
  const iran = on('ir') ? iranByDay(new Set(days.map((d) => d.p.py)), input) : new Map<string, DayHoliday[]>();
  const nuremberg = on('nuremberg') ? nurembergByDay(new Set(days.map((d) => d.g.gy))) : new Map<string, DayHoliday[]>();
  const user = on('user') ? input.user : [];
  const result = new Map<number, readonly DayHoliday[]>();
  days.forEach((day, index) => {
    const list: DayHoliday[] = [
      ...(iran.get(pKey(day.p)) ?? []),
      ...(nuremberg.get(gKey(day.g)) ?? []),
      ...user.filter((u) => userMatches(u, day))
        .map((u): DayHoliday => ({ source: 'user', id: u.id, name: u.name, estimated: false })),
    ];
    if (list.length > 0) result.set(index + 1, list);
  });
  return result;
}
```

Within a day the order is: Iranian solar, then Iranian lunar, then Nuremberg, then user. The tests rely on this: `ir.nowruz` comes before `ir.fitr`, and `ir.oil` before `ir.fitr`. Solar and lunar entries share one `byDay` map, and solar is pushed first.

```ts
// Site/src/holidays/holiday-service.ts
import type { Side } from '../converter/converter-core';
import type { SettingsStore } from '../settings/settings-store';
import { fetchOfficialFile, type OfficialFile } from './holiday-data';
import { holidaysForMonth, type MonthHolidays } from './merge';
import { daysInGregorianMonth, toPersian } from '../calendar/persian';

export const OFFICIAL_RETRY_MS = 60 * 60 * 1000;

export interface HolidayService {
  forMonth(side: Side, year: number, month: number): MonthHolidays;
  probe(py: number): Promise<OfficialFile | null>;
  subscribe(listener: () => void): () => void;
}

export interface HolidayServiceDeps {
  readonly store: Pick<SettingsStore, 'get'>;
  readonly fetchFile?: (py: number) => Promise<OfficialFile | null>;
  readonly dateNow?: () => number;
}

/** The Persian years a displayed month touches: one for a Persian month, one or two for a Gregorian one. */
const persianYearsOf = (side: Side, year: number, month: number): number[] => {
  if (side === 'persian') return [year];
  const first = toPersian({ gy: year, gm: month, gd: 1 }).py;
  const last = toPersian({ gy: year, gm: month, gd: daysInGregorianMonth(year, month) }).py;
  return first === last ? [first] : [first, last];
};

export function createHolidayService({
  store,
  fetchFile = (py) => fetchOfficialFile(py),
  dateNow = () => Date.now(),
}: HolidayServiceDeps): HolidayService {
  const files = new Map<number, OfficialFile>();
  const failedAt = new Map<number, number>();
  const inFlight = new Set<number>();
  const listeners = new Set<() => void>();
  const notify = (): void => { for (const listener of listeners) listener(); };

  const load = (py: number): void => {
    if (files.has(py) || inFlight.has(py)) return;
    const failed = failedAt.get(py);
    if (failed !== undefined && dateNow() - failed < OFFICIAL_RETRY_MS) return;
    inFlight.add(py);
    void fetchFile(py).then((file) => {
      inFlight.delete(py);
      if (file === null) {
        failedAt.set(py, dateNow());
        return;
      }
      files.set(py, file);
      notify();
    });
  };

  return {
    forMonth(side, year, month) {
      const { sources, user } = store.get().holidays;
      if (sources.includes('ir')) for (const py of persianYearsOf(side, year, month)) load(py);
      return holidaysForMonth(side, year, month, { sources, user, official: (py) => files.get(py) ?? null });
    },
    async probe(py) {
      const file = await fetchFile(py);
      if (file !== null) {
        files.set(py, file);
        notify();
      }
      return file;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/merge.test.ts tests/holiday-service.test.ts && npx vitest run --coverage && npx tsc --noEmit`
Expected: PASS at 100% coverage.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/holidays/merge.ts Site/src/holidays/holiday-service.ts Site/tests/merge.test.ts Site/tests/holiday-service.test.ts
git commit -m "feat(site): merge holidays per displayed month; official-file service with retry"
```

---
### Task 5: Month panels under the clock

**Files:**
- Create: `Site/src/views/calendar-panels.ts`
- Modify: `Site/index.html` (new `#calendars` section after `#today`), `Site/src/i18n/strings.ts`, `Site/src/styles/tokens.css` (`--holiday`), `Site/src/styles/components.css`, `Site/src/main.ts`
- Test: `Site/tests/dom/calendar-panels.test.ts`, `Site/e2e/calendar-views.spec.ts`

**Interfaces:**
- Consumes:
  - `HolidayService` (Task 4: `forMonth`, `subscribe`) and `createHolidayService`
  - `DayHoliday`, `MonthHolidays` (Task 4)
  - `HOLIDAY_NAMES` (Task 1)
  - `Settings.views`, plus the `SettingsStore` interface (`get`, `update`, `subscribe`)
  - `buildMonthGrid`, `stepMonth` (`converter/calendar-grid-model.ts`)
  - `nowSnapshot` (`calendar/now.ts`)
  - `formatPersianDate`, `formatGregorianDate` (`i18n/format.ts`)
  - `toGregorian`, `toPersian`
  - In `main.ts`: `time.now`, `createMinuteGate`, `converter.prefill(p, g)`
- Produces:

```ts
export interface CalendarPanelsDeps {
  readonly store: SettingsStore;
  readonly holidays: Pick<HolidayService, 'forMonth'>;
  readonly getLang: () => Lang;
  readonly now: () => Date;
  readonly onPickDay: (p: PersianDateParts, g: GregorianDateParts) => void;
}
export function setupCalendarPanels(deps: CalendarPanelsDeps): { rerender(): void; refreshToday(): void };
```

Behaviour:
- **Initial state:** each panel shows the month containing today, using `nowSnapshot(now()).local`, and *follows* today (Decision 6).
- **Paging:** ‹ / › step one month (`stepMonth`) and stop following; buttons disable at the range bounds. **Today** returns to today's month and follows again.
- **`refreshToday()`:** a following panel moves to today's month if it changed; every panel re-renders so the today outline moves.
- **Grid:** `buildMonthGrid(side, year, month, lang)` provides the title and the week order (Persian weeks start Saturday, Gregorian Monday).
  - Each day is a `<button class="mv-day">` inside a `<td>`, with locale digits.
  - Today gets class `today` and `aria-current="date"`.
  - A day with holidays gets class `holiday`, and its `aria-label` is the full date followed by ` — ` and the holiday names joined with `; `.
- **Holiday list** (below the grid), one `<li>` per holiday in day order, each holding:
  - `.mv-when` (day number + month name);
  - `.mv-name` (`HOLIDAY_NAMES[lang][key]` or the user's name);
  - `.mv-tag` (Iran / Nuremberg / Mine);
  - optionally `.mv-est` ("estimated").
  - No holidays → one `li.mv-none` saying so.
- **Text only:** user text is set with `textContent`, never `innerHTML`.
- **Clicking a day:** calls `onPickDay(p, g)` for that day, converting between calendars.
- **`<details>` state:** `hidden = !views[side].enabled`; `open` mirrors `views[side].open`, and a user toggle writes back through `store.update((s) => ({ ...s, views: { ...s.views, [side]: { ...s.views[side], open } } }))`.
- **Re-render triggers:** the store subscription re-renders, which covers source, user-holiday and view changes. `main.ts` also re-renders on holiday-service notifications and on a language change.

- [ ] **Step 1: Add markup, strings and styles** (no behaviour yet)

`Site/index.html`, after the `#today` section:

```html
    <section id="calendars" aria-label="Calendars">
      <details id="view-persian" class="month-view" data-side="persian">
        <summary data-str="viewPersian"></summary>
        <div class="mv-head">
          <button class="mv-nav mv-prev" type="button">‹</button>
          <h2 class="mv-title"></h2>
          <button class="mv-nav mv-next" type="button">›</button>
          <button class="mv-today" type="button" data-str="today"></button>
        </div>
        <table class="mv-grid">
          <thead><tr></tr></thead>
          <tbody></tbody>
        </table>
        <ul class="mv-holidays"></ul>
      </details>
      <details id="view-gregorian" class="month-view" data-side="gregorian">
        <summary data-str="viewGregorian"></summary>
        <div class="mv-head">
          <button class="mv-nav mv-prev" type="button">‹</button>
          <h2 class="mv-title"></h2>
          <button class="mv-nav mv-next" type="button">›</button>
          <button class="mv-today" type="button" data-str="today"></button>
        </div>
        <table class="mv-grid">
          <thead><tr></tr></thead>
          <tbody></tbody>
        </table>
        <ul class="mv-holidays"></ul>
      </details>
    </section>
```

`StringKey` additions and EN / FA values:

| key | en | fa |
|---|---|---|
| `viewPersian` | Persian month | ماه شمسی |
| `viewGregorian` | Gregorian month | ماه میلادی |
| `sourceIr` | Iran | ایران |
| `sourceNuremberg` | Nuremberg | نورنبرگ |
| `sourceUser` | Mine | شخصی |
| `estimated` | estimated | تخمینی |
| `noHolidays` | No holidays this month | این ماه تعطیلی ندارد |

`Site/src/styles/tokens.css`: add `--holiday: oklch(52% 0.17 28);` to the light palette and `--holiday: oklch(74% 0.13 28);` to the dark one. Each needs at least 4.5:1 against `--surface`; check it, and adjust lightness if it falls short.

`Site/src/styles/components.css` (append):

```css
/* Month views: quiet until opened, then the same grid language as the picker. */
#calendars { display: grid; gap: 0.75rem; justify-items: center; margin-block: 1.5rem 0.5rem; }
.month-view { inline-size: min(22rem, 100%); }
.month-view > summary {
  cursor: pointer; list-style: none; text-align: center;
  font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
}
.month-view > summary::-webkit-details-marker { display: none; }
.month-view > summary::before { content: '▸ '; display: inline-block; transition: transform var(--duration) var(--ease); }
.month-view[open] > summary::before { transform: rotate(90deg); }
:root[dir='rtl'] .month-view > summary::before { content: '◂ '; }
:root[dir='rtl'] .month-view[open] > summary::before { transform: rotate(-90deg); }
.month-view > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.mv-head { display: flex; align-items: center; gap: 0.5rem; margin-block: 0.75rem 0.5rem; }
.mv-title { flex: 1; text-align: center; font-size: 0.95rem; font-weight: 600; margin: 0; }
.mv-nav, .mv-today {
  background: none; border: 0; cursor: pointer; color: var(--text-muted); font: inherit;
  padding: 0.2rem 0.5rem; line-height: 1;
}
.mv-nav { font-size: 1rem; }
.mv-today { font-size: 0.8rem; border-bottom: 1px dotted var(--text-muted); }
.mv-nav:hover:not(:disabled), .mv-today:hover { color: var(--accent); }
.mv-nav:disabled { opacity: 0.3; cursor: default; }
.mv-nav:focus-visible, .mv-today:focus-visible, .mv-day:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mv-grid { inline-size: 100%; border-collapse: separate; border-spacing: 2px; table-layout: fixed; }
.mv-grid th { font-size: 0.7rem; font-weight: 400; color: var(--text-muted); block-size: 1.6rem; }
.mv-day {
  position: relative; inline-size: 100%; block-size: 2.2rem; border: 0; border-radius: 4px;
  background: none; color: var(--text); cursor: pointer;
  font: inherit; font-size: 0.85rem; font-variant-numeric: tabular-nums;
  transition: background var(--duration) var(--ease);
}
.mv-day:hover { background: var(--hairline); }
.mv-day.today { box-shadow: inset 0 0 0 1px var(--accent); }
.mv-day.holiday { color: var(--holiday); font-weight: 600; }
.mv-day.holiday::after {
  content: ''; position: absolute; inset-block-end: 4px; inset-inline-start: 50%;
  inline-size: 4px; block-size: 4px; margin-inline-start: -2px; border-radius: 50%; background: var(--holiday);
}
.mv-holidays { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.3rem; font-size: 0.85rem; }
.mv-holidays li { display: flex; flex-wrap: wrap; gap: 0.2rem 0.5rem; align-items: baseline; }
.mv-when { color: var(--holiday); font-variant-numeric: tabular-nums; min-inline-size: 4.5rem; }
.mv-name { flex: 1; unicode-bidi: isolate; }
.mv-tag, .mv-est { font-size: 0.7rem; color: var(--text-muted); border: 1px solid var(--hairline); border-radius: 999px; padding: 0 0.4rem; }
.mv-est { font-style: italic; }
.mv-none { color: var(--text-muted); }
```

- [ ] **Step 2: Write the failing DOM test**

```ts
// Site/tests/dom/calendar-panels.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { DayHoliday, MonthHolidays } from '../../src/holidays/merge';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { setupCalendarPanels } from '../../src/views/calendar-panels';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

// 2026-03-21 12:00 local = 1 Farvardin 1405 (a Saturday).
let now: Date;
let lang: Lang;
let store: SettingsStore;
let forMonth: ReturnType<typeof vi.fn<(side: string, y: number, m: number) => MonthHolidays>>;
let onPickDay: ReturnType<typeof vi.fn>;
let panels: { rerender: () => void; refreshToday: () => void };

const panel = (side: 'persian' | 'gregorian') => document.getElementById(`view-${side}`) as HTMLDetailsElement;
const q = <T extends Element>(side: 'persian' | 'gregorian', sel: string) => panel(side).querySelector(sel) as T;
const title = (side: 'persian' | 'gregorian') => q(side, '.mv-title').textContent;
const day = (side: 'persian' | 'gregorian', n: number) =>
  panel(side).querySelector<HTMLButtonElement>(`.mv-day[data-day="${n}"]`)!;
const items = (side: 'persian' | 'gregorian') =>
  [...panel(side).querySelectorAll('.mv-holidays li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());

const NOWRUZ: DayHoliday = { source: 'ir', key: 'ir.nowruz', estimated: false };
const FITR_EST: DayHoliday = { source: 'ir', key: 'ir.fitr', estimated: true };

beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  document.documentElement.dir = 'ltr';
  now = new Date(2026, 2, 21, 12);
  lang = 'en';
  store = createSettingsStore();
  forMonth = vi.fn((side: string, _y: number, m: number): MonthHolidays =>
    (side === 'persian' && m === 1 ? new Map([[1, [NOWRUZ, FITR_EST]]]) : new Map()));
  onPickDay = vi.fn();
  panels = setupCalendarPanels({ store, holidays: { forMonth }, getLang: () => lang, now: () => now, onPickDay });
});

describe('calendar panels', () => {
  it('opens on today\'s month in each calendar, with that calendar\'s week order', () => {
    expect(title('persian')).toBe('Farvardin 1405');
    expect(title('gregorian')).toBe('March 2026');
    const heads = (side: 'persian' | 'gregorian') => [...q(side, 'thead tr').children].map((th) => th.textContent);
    expect(heads('persian')[0]).toBe('Sat');
    expect(heads('gregorian')[0]).toBe('Mon');
  });

  it('starts Persian open and Gregorian closed, both visible', () => {
    expect(panel('persian').open).toBe(true);
    expect(panel('gregorian').open).toBe(false);
    expect(panel('persian').hidden || panel('gregorian').hidden).toBe(false);
  });

  it('outlines today and marks holidays with an accessible description', () => {
    expect(day('persian', 1).classList.contains('today')).toBe(true);
    expect(day('persian', 1).getAttribute('aria-current')).toBe('date');
    expect(day('persian', 1).classList.contains('holiday')).toBe(true);
    expect(day('persian', 1).getAttribute('aria-label')).toBe('1 Farvardin 1405 — Nowruz; Eid al-Fitr');
    expect(day('persian', 2).classList.contains('holiday')).toBe(false);
    expect(day('persian', 2).getAttribute('aria-label')).toBe('2 Farvardin 1405');
  });

  it('lists the month\'s holidays with source and estimate tags', () => {
    expect(items('persian')).toEqual(['1 Farvardin Nowruz Iran', '1 Farvardin Eid al-Fitr Iran estimated']);
    expect(items('gregorian')).toEqual(['No holidays this month']);
  });

  it('renders a user holiday name as text, never as markup', () => {
    forMonth.mockImplementation(() => new Map([[5, [{ source: 'user', id: 'x', name: '<b>Party</b>', estimated: false }]]]));
    panels.rerender();
    const name = panel('persian').querySelector('.mv-name')!;
    expect(name.textContent).toBe('<b>Party</b>');
    expect(name.querySelector('b')).toBeNull();
    expect(items('persian')[0]).toContain('Mine');
  });

  it('pages by month, stops following today, and Today brings it back', () => {
    clickOn(q('persian', '.mv-next'));
    expect(title('persian')).toBe('Ordibehesht 1405');
    expect(forMonth).toHaveBeenLastCalledWith('persian', 1405, 2);
    now = new Date(2026, 3, 25, 12); // a month later
    panels.refreshToday();
    expect(title('persian')).toBe('Ordibehesht 1405');
    clickOn(q('persian', '.mv-prev'));
    clickOn(q('persian', '.mv-prev'));
    expect(title('persian')).toBe('Esfand 1404');
    clickOn(q('persian', '.mv-today'));
    expect(title('persian')).toBe('Ordibehesht 1405');
  });

  it('follows today across a month change until the user pages', () => {
    now = new Date(2026, 3, 1, 0, 0, 30); // 1 April 2026
    panels.refreshToday();
    expect(title('gregorian')).toBe('April 2026');
    expect(day('gregorian', 1).classList.contains('today')).toBe(true);
  });

  it('labels the arrows and disables them at the edge of the range', () => {
    expect(q('persian', '.mv-prev').getAttribute('aria-label')).toBe('Previous month');
    expect(q('persian', '.mv-next').getAttribute('aria-label')).toBe('Next month');
    now = new Date(2121, 11, 15, 12); // the last supported Gregorian month
    panels.refreshToday();
    expect(q<HTMLButtonElement>('gregorian', '.mv-next').disabled).toBe(true);
  });

  it('picks a day for the converter, converting between calendars', () => {
    clickOn(day('persian', 13));
    expect(onPickDay).toHaveBeenCalledWith({ py: 1405, pm: 1, pd: 13 }, { gy: 2026, gm: 4, gd: 2 });
    clickOn(day('gregorian', 20));
    expect(onPickDay).toHaveBeenLastCalledWith({ py: 1404, pm: 12, pd: 29 }, { gy: 2026, gm: 3, gd: 20 });
  });

  it('stores a panel being opened or closed, and hides a disabled view', () => {
    panel('gregorian').open = true;
    panel('gregorian').dispatchEvent(new Event('toggle'));
    expect(store.get().views.gregorian.open).toBe(true);
    store.update((s) => ({ ...s, views: { ...s.views, persian: { enabled: false, open: true } } }));
    expect(panel('persian').hidden).toBe(true);
  });

  it('ignores a toggle event that matches what is stored', () => {
    const update = vi.spyOn(store, 'update');
    panel('persian').dispatchEvent(new Event('toggle'));
    expect(update).not.toHaveBeenCalled();
  });

  it('renders in Persian with Persian digits', () => {
    lang = 'fa';
    panels.rerender();
    expect(title('persian')).toBe('فروردین ۱۴۰۵');
    expect(day('persian', 13).textContent).toBe('۱۳');
    expect(items('persian')[1]).toBe('۱ فروردین عید سعید فطر ایران تخمینی');
  });

  it('ignores clicks between day buttons', () => {
    clickOn(q('persian', 'tbody'));
    expect(onPickDay).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run tests/dom/calendar-panels.test.ts`
Expected: FAIL, because the module does not exist yet.

- [ ] **Step 3: Implement**

```ts
// Site/src/views/calendar-panels.ts
import { nowSnapshot } from '../calendar/now';
import {
  toGregorian, toPersian, type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import { buildMonthGrid, stepMonth } from '../converter/calendar-grid-model';
import type { Side } from '../converter/converter-core';
import type { HolidayService } from '../holidays/holiday-service';
import type { DayHoliday } from '../holidays/merge';
import { formatGregorianDate, formatPersianDate } from '../i18n/format';
import {
  GREGORIAN_MONTHS, HOLIDAY_NAMES, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { SettingsStore } from '../settings/settings-store';

export interface CalendarPanelsDeps {
  readonly store: SettingsStore;
  readonly holidays: Pick<HolidayService, 'forMonth'>;
  readonly getLang: () => Lang;
  readonly now: () => Date;
  readonly onPickDay: (p: PersianDateParts, g: GregorianDateParts) => void;
}

const SIDES: readonly Side[] = ['persian', 'gregorian'];

interface Shown { year: number; month: number; following: boolean }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function partsOf(side: Side, year: number, month: number, day: number): { p: PersianDateParts; g: GregorianDateParts } {
  if (side === 'persian') {
    const p = { py: year, pm: month, pd: day };
    return { p, g: toGregorian(p) };
  }
  const g = { gy: year, gm: month, gd: day };
  return { p: toPersian(g), g };
}

const holidayName = (h: DayHoliday, lang: Lang): string =>
  h.source === 'user' ? h.name : HOLIDAY_NAMES[lang][h.key];

const SOURCE_LABEL = { ir: 'sourceIr', nuremberg: 'sourceNuremberg', user: 'sourceUser' } as const;

export function setupCalendarPanels(deps: CalendarPanelsDeps): { rerender(): void; refreshToday(): void } {
  const { store, holidays, getLang, now, onPickDay } = deps;

  const today = (side: Side): { year: number; month: number; day: number } => {
    const local = nowSnapshot(now()).local;
    return side === 'persian'
      ? { year: local.p.py, month: local.p.pm, day: local.p.pd }
      : { year: local.g.gy, month: local.g.gm, day: local.g.gd };
  };

  const shown: Record<Side, Shown> = {
    persian: { ...today('persian'), following: true },
    gregorian: { ...today('gregorian'), following: true },
  };

  const details = (side: Side): HTMLDetailsElement => {
    const node = document.getElementById(`view-${side}`);
    if (!node) throw new Error(`Missing element #view-${side}`);
    return node as HTMLDetailsElement;
  };
  const part = <T extends Element>(side: Side, selector: string): T => {
    const node = details(side).querySelector(selector);
    if (!node) throw new Error(`Missing ${selector} in #view-${side}`);
    return node as T;
  };

  const render = (side: Side): void => {
    const lang = getLang();
    const strings = STRINGS[lang];
    const view = store.get().views[side];
    const box = details(side);
    box.hidden = !view.enabled;
    if (box.open !== view.open) box.open = view.open;

    const { year, month } = shown[side];
    const grid = buildMonthGrid(side, year, month, lang);
    const marks = holidays.forMonth(side, year, month);
    const now = today(side);
    const isToday = (d: number): boolean => now.year === year && now.month === month && now.day === d;

    part<HTMLElement>(side, '.mv-title').textContent = grid.title;
    const prev = part<HTMLButtonElement>(side, '.mv-prev');
    const next = part<HTMLButtonElement>(side, '.mv-next');
    prev.disabled = !grid.canGoPrev;
    next.disabled = !grid.canGoNext;
    prev.setAttribute('aria-label', strings.prevMonth);
    next.setAttribute('aria-label', strings.nextMonth);

    const head = part<HTMLTableRowElement>(side, 'thead tr');
    head.replaceChildren(...grid.weekdayHeaders.map((label) => {
      const th = el('th', undefined, label);
      th.scope = 'col';
      return th;
    }));

    const body = part<HTMLTableSectionElement>(side, 'tbody');
    body.replaceChildren(...grid.weeks.map((week) => {
      const row = el('tr');
      for (const d of week) {
        const cell = el('td');
        if (d !== null) {
          const button = el('button', 'mv-day', toLocaleDigits(d, lang));
          button.type = 'button';
          button.dataset['day'] = String(d);
          const { p, g } = partsOf(side, year, month, d);
          const date = side === 'persian' ? formatPersianDate(p, lang) : formatGregorianDate(g, lang);
          const list = marks.get(d) ?? [];
          button.setAttribute('aria-label', list.length === 0
            ? date
            : `${date} — ${list.map((h) => holidayName(h, lang)).join('; ')}`);
          if (list.length > 0) button.classList.add('holiday');
          if (isToday(d)) {
            button.classList.add('today');
            button.setAttribute('aria-current', 'date');
          }
          cell.append(button);
        }
        row.append(cell);
      }
      return row;
    }));

    const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
    const listEl = part<HTMLUListElement>(side, '.mv-holidays');
    const entries = [...marks].sort(([a], [b]) => a - b)
      .flatMap(([d, list]) => list.map((h) => ({ d, h })));
    listEl.replaceChildren(...(entries.length === 0
      ? [el('li', 'mv-none', strings.noHolidays)]
      : entries.map(({ d, h }) => {
        const li = el('li');
        // Real spaces between the parts, so copied or read-out text is not run together.
        li.append(
          el('span', 'mv-when', `${toLocaleDigits(d, lang)} ${names[month - 1] as string}`), ' ',
          el('span', 'mv-name', holidayName(h, lang)), ' ',
          el('span', 'mv-tag', strings[SOURCE_LABEL[h.source]]),
        );
        if (h.estimated) li.append(' ', el('span', 'mv-est', strings.estimated));
        return li;
      })));
  };

  const rerender = (): void => { for (const side of SIDES) render(side); };

  for (const side of SIDES) {
    part<HTMLButtonElement>(side, '.mv-prev').addEventListener('click', () => { step(side, -1); });
    part<HTMLButtonElement>(side, '.mv-next').addEventListener('click', () => { step(side, 1); });
    part<HTMLButtonElement>(side, '.mv-today').addEventListener('click', () => {
      shown[side] = { ...today(side), following: true };
      render(side);
    });
    part<HTMLElement>(side, 'tbody').addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('.mv-day');
      if (!button) return;
      const { p, g } = partsOf(side, shown[side].year, shown[side].month, Number(button.dataset['day']));
      onPickDay(p, g);
    });
    details(side).addEventListener('toggle', () => {
      const open = details(side).open;
      if (open === store.get().views[side].open) return;
      store.update((s) => ({ ...s, views: { ...s.views, [side]: { ...s.views[side], open } } }));
    });
  }

  function step(side: Side, delta: number): void {
    const target = stepMonth(side, shown[side].year, shown[side].month, delta);
    if (target === null) return;
    shown[side] = { ...target, following: false };
    render(side);
  }

  store.subscribe(rerender);

  const refreshToday = (): void => {
    for (const side of SIDES) {
      if (shown[side].following) shown[side] = { ...today(side), following: true };
      render(side);
    }
  };

  rerender();
  return { rerender, refreshToday };
}
```

Notes for the implementer:
- `shown[side]` spreads `today(side)`, which has a `day` field. That is harmless, but if `Shown` must not carry `day`, take only `year` and `month`.
- `step`'s `target === null` branch is unreachable while the buttons are disabled at the bounds. If coverage reports it, keep the guard (a disabled button cannot be clicked, but `step` must not trust that) and cover it by calling `.click()` on a button after removing its `disabled` attribute in the test.
- `part`/`details` throw for missing markup. Add a test with an empty body expecting `toThrow('#view-persian')`.

- [ ] **Step 4: Wire into `main.ts`**

```ts
import { createHolidayService } from './holidays/holiday-service';
import { setupCalendarPanels } from './views/calendar-panels';
```
```ts
const holidayService = createHolidayService({ store: settings });
const panels = setupCalendarPanels({
  store: settings,
  holidays: holidayService,
  getLang: () => lang,
  now: time.now,
  onPickDay: (p, g) => {
    converter.prefill(p, g);
    document.getElementById('converter')?.scrollIntoView({ block: 'nearest' });
  },
});
holidayService.subscribe(() => { panels.rerender(); });
```
In `renderAll`, add `panels.rerender();`. Change the minute gate's callback to `() => { renderToday(); panels.refreshToday(); }`.

Place the new declarations after `converter`, and before the first `renderToday()` and the gate.

- [ ] **Step 5: Write the E2E spec**

```ts
// Site/e2e/calendar-views.spec.ts
import { expect, test, type Page } from '@playwright/test';

// 1 Farvardin 1405, 12:00 in Tehran.
const NOWRUZ_NOON = Date.UTC(2026, 2, 21, 8, 30) / 1000;

const fixTime = (page: Page) => page.route('**/api/time', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ epochSec: NOWRUZ_NOON }),
}));
const noOfficialData = (page: Page) => page.route('**/api/holidays/ir/*.json', (route) => route.fulfill({ status: 404, body: '' }));
const persian = (page: Page) => page.locator('#view-persian');
const gregorian = (page: Page) => page.locator('#view-gregorian');

test.describe('with a fixed clock and the service worker blocked', () => {
  test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

  test.beforeEach(async ({ page }) => {
    await fixTime(page);
    await noOfficialData(page);
    await page.goto('/');
    await expect(persian(page).locator('.mv-title')).toHaveText('Farvardin 1405');
  });

  test('Persian month is open on today, with Nowruz and an estimated Eid al-Fitr', async ({ page }) => {
    await expect(persian(page)).toHaveAttribute('open', '');
    await expect(gregorian(page)).not.toHaveAttribute('open', '');
    const today = persian(page).locator('.mv-day[aria-current="date"]');
    await expect(today).toHaveText('1');
    await expect(today).toHaveClass(/holiday/);
    await expect(persian(page).locator('.mv-holidays')).toContainText('Nowruz');
    await expect(persian(page).locator('.mv-holidays li', { hasText: 'Eid al-Fitr' }).first()).toContainText('estimated');
  });

  test('official data replaces the estimate', async ({ page }) => {
    await page.unroute('**/api/holidays/ir/*.json');
    await page.route('**/api/holidays/ir/1405.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [{ key: 'ir.ashura', p: '1405-04-05' }] }),
    }));
    await page.reload();
    for (let i = 0; i < 3; i += 1) await persian(page).locator('.mv-next').click();
    await expect(persian(page).locator('.mv-title')).toHaveText('Tir 1405');
    const ashura = persian(page).locator('.mv-holidays li', { hasText: 'Ashura' });
    await expect(ashura).toHaveCount(1);
    await expect(ashura).toContainText('5 Tir');
    await expect(ashura).not.toContainText('estimated');
  });

  test('Gregorian month shows Nuremberg holidays; paging and Today', async ({ page }) => {
    await gregorian(page).locator('summary').click();
    await expect(gregorian(page).locator('.mv-title')).toHaveText('March 2026');
    await gregorian(page).locator('.mv-next').click();
    const list = gregorian(page).locator('.mv-holidays');
    await expect(list).toContainText('Good Friday');
    await expect(list).toContainText('Easter Monday');
    await expect(list.locator('li', { hasText: 'Easter Monday' })).toContainText('Nuremberg');
    await gregorian(page).locator('.mv-today').click();
    await expect(gregorian(page).locator('.mv-title')).toHaveText('March 2026');
  });

  test('clicking a day fills the converter', async ({ page }) => {
    await persian(page).locator('.mv-day[data-day="13"]').click();
    await expect(page.locator('#p-d')).toHaveValue('13');
    await expect(page.locator('#g-m')).toHaveValue('4');
    await expect(page.locator('#g-d')).toHaveValue('2');
  });

  test('the open state survives a reload', async ({ page }) => {
    await persian(page).locator('summary').click();
    await expect(persian(page)).not.toHaveAttribute('open', '');
    await page.reload();
    await expect(persian(page).locator('.mv-title')).toHaveText('Farvardin 1405');
    await expect(persian(page)).not.toHaveAttribute('open', '');
  });

  test('Persian: translated, right to left, Persian digits', async ({ page }) => {
    await page.locator('#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(persian(page).locator('.mv-title')).toHaveText('فروردین ۱۴۰۵');
    await expect(persian(page).locator('summary')).toHaveText('ماه شمسی');
    await expect(persian(page).locator('.mv-holidays')).toContainText('عید نوروز');
  });
});

test('offline, the month view still renders with estimated holidays', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(persian(page).locator('.mv-day').first()).toBeVisible();
  await expect(persian(page).locator('.mv-holidays li').first()).toBeVisible();
  await context.setOffline(false);
});
```

(The last test only asserts that the month view renders offline. The committed data files arrive later through the crawler PR (Decision 4), so offline either shows estimates or a cached file. Both are correct.)

- [ ] **Step 6: Run everything**

```bash
npx vitest run tests/dom/calendar-panels.test.ts
npx vitest run --coverage && npx tsc --noEmit
lsof -i :4173 -sTCP:LISTEN   # must print nothing
npm run build && npx playwright test e2e/calendar-views.spec.ts && npx playwright test
```
Expected: all pass, and coverage stays at 100%. If an existing E2E test fails because the new section moved something on screen, adjust the test's mechanics only, and record each change in the report.

- [ ] **Step 7: Commit**

```bash
git status --short
git add Site/index.html Site/src/views Site/src/i18n/strings.ts Site/src/styles Site/src/main.ts Site/tests/dom/calendar-panels.test.ts Site/e2e/calendar-views.spec.ts
git commit -m "feat(site): Persian and Gregorian month views with holidays under the clock"
```

---
### Task 6: Settings — "Calendars & holidays" group

**Files:**
- Create: `Site/src/holidays/holidays-panel.ts`
- Modify: `Site/index.html` (third fieldset in `#settings-dialog`), `Site/src/i18n/strings.ts`, `Site/src/styles/components.css`, `Site/src/main.ts`
- Test: `Site/tests/dom/holidays-panel.test.ts`, `Site/e2e/holiday-settings.spec.ts`

**Interfaces:**
- Consumes:
  - `HolidayService.probe`, `OfficialFile` (Tasks 2 and 4)
  - `parseUserHoliday`, `HOLIDAY_SOURCES`, `MAX_USER_HOLIDAYS`, `UserHoliday`, `maxDayOfMonth` (Task 3)
  - `nowSnapshot`; `normalizeDigits` (`converter/converter-core.ts`, which maps Persian/Arabic-Indic digits to ASCII); `restrictToDigits` (`ui/numeric-input.ts`)
  - `PERSIAN_MONTHS`, `GREGORIAN_MONTHS`, `STRINGS`, `formatTemplate`, `toLocaleDigits`
- Produces: `setupHolidaySettings(deps: { store: SettingsStore; service: Pick<HolidayService, 'probe'>; getLang: () => Lang; now: () => Date; newId?: () => string }): { rerender: () => void }`. `newId` defaults to `() => crypto.randomUUID()`.

Behaviour:
- **On open (gear click):** sync every control from the store, clear the form, and clear the test result unless a test is running (the same rule as the Time group).
- **Views:** checkboxes `#set-view-persian` / `#set-view-gregorian` write `views[side].enabled`.
- **Sources:** checkboxes `#set-src-ir|nuremberg|user` write `holidays.sources = HOLIDAY_SOURCES.filter(checked)`.
- **User list `#set-user-holidays`:** one `<li>` per user holiday, in stored order.
  - Each shows `.uh-name` (as text) and `.uh-when`: day + month name + either the year, or "every year".
  - Each has an Edit and a Delete button, with `aria-label`s that include the holiday's name.
  - An empty list shows `li.settings-none` "None yet".
- **Form:** name; calendar select (Persian / Gregorian); month select, rebuilt from the chosen calendar's month names in the current language; day; optional year.
  - Day and year use `restrictToDigits`, and their values pass through `normalizeDigits` before `Number()`.
  - **Save** builds `{ id, name, calendar, month, day, year? }` and validates it with `parseUserHoliday`.
    - Invalid → `#set-uh-error` shows "Enter a name and a date that exists", and nothing is stored.
    - A new holiday when the list already holds `MAX_USER_HOLIDAYS` → the limit message.
    - Otherwise the holiday is stored: an edit replaces its entry in place, a new one is appended. The form then clears and the error hides.
  - **Edit** fills the form and switches Save's label to "Save"; **Cancel** (only visible while editing) clears it. **Delete** removes the entry immediately.
- **Test connection `#set-holidays-test`:** probes the current Persian year (`nowSnapshot(now()).local.p.py`).
  - Success → "OK · 1405 official data · updated 2026-10-12".
  - Null → "No official data for 1405 — using estimates".
  - While a test runs, the button carries `aria-disabled="true"` and ignores clicks, and the result shows "Testing…" (`STRINGS.testing`).
  - Digits are localized through `formatTemplate`.
- **Re-render:** the store subscription re-renders the list. `rerender()` re-renders labels, the month select, the list and the last result in the current language.

- [ ] **Step 1: Markup, strings, styles**

Insert into `#settings-dialog` after the Time fieldset:

```html
      <fieldset class="settings-group settings-holidays">
        <legend data-str="holidaysSection"></legend>
        <p class="settings-subhead" data-str="viewsLabel"></p>
        <label class="settings-check"><input type="checkbox" id="set-view-persian" /> <span data-str="viewPersian"></span></label>
        <label class="settings-check"><input type="checkbox" id="set-view-gregorian" /> <span data-str="viewGregorian"></span></label>
        <p class="settings-subhead" data-str="holidaySourcesLabel"></p>
        <label class="settings-check"><input type="checkbox" id="set-src-ir" /> <span data-str="sourceIrLong"></span></label>
        <label class="settings-check"><input type="checkbox" id="set-src-nuremberg" /> <span data-str="sourceNurembergLong"></span></label>
        <label class="settings-check"><input type="checkbox" id="set-src-user" /> <span data-str="sourceUserLong"></span></label>
        <ul id="set-user-holidays" class="settings-list"></ul>
        <div class="settings-form">
          <label for="set-uh-name" data-str="holidayName"></label>
          <input id="set-uh-name" type="text" maxlength="60" autocomplete="off" dir="auto" />
          <label for="set-uh-calendar" data-str="copyCalendar"></label>
          <select id="set-uh-calendar">
            <option value="persian" data-str="calPersian"></option>
            <option value="gregorian" data-str="calGregorian"></option>
          </select>
          <label for="set-uh-month" data-str="month"></label>
          <select id="set-uh-month"></select>
          <label for="set-uh-day" data-str="day"></label>
          <input id="set-uh-day" type="text" inputmode="numeric" maxlength="2" autocomplete="off" />
          <label for="set-uh-year" data-str="holidayYear"></label>
          <input id="set-uh-year" type="text" inputmode="numeric" maxlength="4" autocomplete="off" />
          <p id="set-uh-error" class="settings-error" role="alert" hidden></p>
          <div class="settings-test">
            <button id="set-uh-save" type="button"></button>
            <button id="set-uh-cancel" type="button" data-str="holidayCancel" hidden></button>
          </div>
        </div>
        <div class="settings-test">
          <button id="set-holidays-test" type="button" data-str="testConnection"></button>
          <output id="set-holidays-test-result" aria-live="polite" dir="auto"></output>
        </div>
      </fieldset>
```

`StringKey` additions (EN / FA):

| key | en | fa |
|---|---|---|
| `holidaysSection` | Calendars & holidays | تقویم‌ها و تعطیلات |
| `viewsLabel` | Show under the clock | نمایش زیر ساعت |
| `holidaySourcesLabel` | Holidays | تعطیلات |
| `sourceIrLong` | Iran (official) | ایران (رسمی) |
| `sourceNurembergLong` | Nuremberg (Bavaria) | نورنبرگ (باواریا) |
| `sourceUserLong` | My holidays | تعطیلات من |
| `holidayName` | Name | نام |
| `holidayYear` | Year (optional) | سال (اختیاری) |
| `everyYear` | every year | هر سال |
| `holidayAdd` | Add | افزودن |
| `holidaySave` | Save | ذخیره |
| `holidayCancel` | Cancel | انصراف |
| `holidayEdit` | Edit | ویرایش |
| `holidayDelete` | Delete | حذف |
| `holidayInvalid` | Enter a name and a date that exists | یک نام و تاریخی معتبر وارد کنید |
| `holidayLimit` | You can keep up to {max} holidays | حداکثر {max} تعطیلی می‌توانید داشته باشید |
| `noUserHolidays` | None yet | هنوز چیزی نیست |
| `holidaysTestOk` | OK · {year} official data · updated {date} | برقرار · داده رسمی {year} · به‌روزشده {date} |
| `holidaysTestNone` | No official data for {year} — using estimates | داده رسمی برای {year} نیست — تخمین‌ها استفاده می‌شوند |

CSS (append to `components.css`):

```css
/* Three groups no longer fit a phone screen: the dialog scrolls inside itself. */
#settings-dialog { max-block-size: calc(100dvh - 2rem); overflow: auto; overscroll-behavior: contain; }
.settings-subhead { grid-column: 1 / -1; margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--text-muted); }
.settings-check { grid-column: 1 / -1; display: flex; gap: 0.5rem; align-items: center; cursor: pointer; }
.settings-check input { accent-color: var(--accent); inline-size: 1rem; block-size: 1rem; }
.settings-list { grid-column: 1 / -1; list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; font-size: 0.85rem; }
.settings-list li { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; align-items: baseline; }
.uh-name { flex: 1; font-weight: 600; unicode-bidi: isolate; overflow-wrap: anywhere; }
.uh-when { color: var(--text-muted); }
.settings-list button, #set-uh-save, #set-uh-cancel, #set-holidays-test {
  background: none; border: 1px solid var(--control-border); color: var(--text);
  border-radius: 999px; padding: 0.2rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.8rem;
}
.settings-list button:hover, #set-uh-save:hover, #set-uh-cancel:hover,
#set-holidays-test:hover:not([aria-disabled='true']) { color: var(--accent); border-color: var(--accent); }
.settings-list button:focus-visible, #set-uh-save:focus-visible, #set-uh-cancel:focus-visible,
#set-holidays-test:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#set-holidays-test[aria-disabled='true'] { cursor: progress; opacity: 0.6; }
.settings-form { grid-column: 1 / -1; display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 0.9rem; align-items: center; }
.settings-error { grid-column: 1 / -1; margin: 0; color: var(--holiday); font-size: 0.8rem; }
.settings-none { color: var(--text-muted); }
#set-holidays-test-result { font-size: 0.85rem; color: var(--text-muted); unicode-bidi: isolate; }
```

- [ ] **Step 2: Write the failing DOM test**

```ts
// Site/tests/dom/holidays-panel.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { OfficialFile } from '../../src/holidays/holiday-data';
import { setupHolidaySettings } from '../../src/holidays/holidays-panel';
import { MAX_USER_HOLIDAYS } from '../../src/settings/settings-model';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string): string => byId(id).textContent ?? '';
const setValue = (id: string, value: string): void => {
  const el = byId<HTMLInputElement | HTMLSelectElement>(id);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};
const check = (id: string, on: boolean): void => {
  const box = byId<HTMLInputElement>(id);
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const entries = (): string[] =>
  [...byId('set-user-holidays').querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim() ?? '');

let lang: Lang;
let store: SettingsStore;
let probe: ReturnType<typeof vi.fn<(py: number) => Promise<OfficialFile | null>>>;
let panel: { rerender: () => void };
let ids: number;

beforeEach(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  ids = 0;
  store = createSettingsStore();
  probe = vi.fn(async () => null);
  panel = setupHolidaySettings({
    store, service: { probe }, getLang: () => lang,
    now: () => new Date(2026, 9, 15, 12), newId: () => `id-${++ids}`,
  });
  clickOn(byId('settings-toggle'));
});

describe('holiday settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupHolidaySettings({ store, service: { probe }, getLang: () => lang, now: () => new Date() }))
      .toThrow('#set-view-persian');
  });

  it('shows the stored view and source choices', () => {
    expect(byId<HTMLInputElement>('set-view-persian').checked).toBe(true);
    expect(byId<HTMLInputElement>('set-src-nuremberg').checked).toBe(true);
    expect(entries()).toEqual(['None yet']);
  });

  it('writes view and source checkboxes, keeping everything else', () => {
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    check('set-view-gregorian', false);
    check('set-src-ir', false);
    expect(store.get().views.gregorian.enabled).toBe(false);
    expect(store.get().holidays.sources).toEqual(['nuremberg', 'user']);
    expect(store.get().time.source).toBe('device');
  });

  it('offers the chosen calendar\'s month names, in the current language', () => {
    const options = () => [...byId<HTMLSelectElement>('set-uh-month').options].map((o) => o.textContent);
    expect(options()[0]).toBe('Farvardin');
    setValue('set-uh-calendar', 'gregorian');
    expect(options()[0]).toBe('January');
    lang = 'fa';
    panel.rerender();
    expect(options()[0]).toBe('ژانویه');
  });

  it('adds a yearly holiday, accepting Persian digits, and clears the form', () => {
    setValue('set-uh-name', 'Birthday');
    setValue('set-uh-month', '7');
    setValue('set-uh-day', '۲۲');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user).toEqual([{ id: 'id-1', name: 'Birthday', calendar: 'persian', month: 7, day: 22 }]);
    expect(entries()).toEqual(['Birthday 22 Mehr · every year Edit Delete']);
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('');
  });

  it('adds a one-off holiday with a year', () => {
    setValue('set-uh-name', 'Trip');
    setValue('set-uh-calendar', 'gregorian');
    setValue('set-uh-month', '2');
    setValue('set-uh-day', '29');
    setValue('set-uh-year', '2028');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user[0]).toMatchObject({ calendar: 'gregorian', month: 2, day: 29, year: 2028 });
    expect(entries()[0]).toContain('29 February 2028');
  });

  it('refuses a day that does not exist, and stores nothing', () => {
    setValue('set-uh-name', 'Nope');
    setValue('set-uh-month', '12');
    setValue('set-uh-day', '30');
    setValue('set-uh-year', '1405'); // not a leap year
    clickOn(byId('set-uh-save'));
    expect(byId('set-uh-error').hidden).toBe(false);
    expect(text('set-uh-error')).toBe('Enter a name and a date that exists');
    expect(store.get().holidays.user).toEqual([]);
    setValue('set-uh-year', '');
    clickOn(byId('set-uh-save'));
    expect(byId('set-uh-error').hidden).toBe(true);
    expect(store.get().holidays.user).toHaveLength(1);
  });

  it('edits in place and cancels', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [
      { id: 'a', name: 'One', calendar: 'persian', month: 1, day: 1 },
      { id: 'b', name: 'Two', calendar: 'persian', month: 2, day: 2 },
    ] } }));
    clickOn(byId('set-user-holidays').querySelectorAll('li')[0]!.querySelector('button')!);
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('One');
    expect(text('set-uh-save')).toBe('Save');
    expect(byId('set-uh-cancel').hidden).toBe(false);
    setValue('set-uh-name', 'First');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user.map((u) => `${u.id}:${u.name}`)).toEqual(['a:First', 'b:Two']);
    clickOn(byId('set-user-holidays').querySelectorAll('li')[1]!.querySelector('button')!);
    clickOn(byId('set-uh-cancel'));
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('');
    expect(text('set-uh-save')).toBe('Add');
  });

  it('deletes, and names each button after its holiday', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [{ id: 'a', name: 'One', calendar: 'persian', month: 1, day: 1 }] } }));
    const buttons = byId('set-user-holidays').querySelectorAll('button');
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Edit One');
    expect(buttons[1]!.getAttribute('aria-label')).toBe('Delete One');
    clickOn(buttons[1]!);
    expect(store.get().holidays.user).toEqual([]);
  });

  it('enforces the list limit for new holidays', () => {
    const user = Array.from({ length: MAX_USER_HOLIDAYS }, (_, i) => ({
      id: `h${i}`, name: `H${i}`, calendar: 'persian' as const, month: 1, day: 1,
    }));
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user } }));
    setValue('set-uh-name', 'One more');
    setValue('set-uh-day', '5');
    clickOn(byId('set-uh-save'));
    expect(text('set-uh-error')).toBe(`You can keep up to ${MAX_USER_HOLIDAYS} holidays`);
    expect(store.get().holidays.user).toHaveLength(MAX_USER_HOLIDAYS);
  });

  it('tests the official data for the current Persian year', async () => {
    probe.mockResolvedValueOnce({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [] });
    clickOn(byId('set-holidays-test'));
    expect(byId('set-holidays-test').getAttribute('aria-disabled')).toBe('true');
    expect(text('set-holidays-test-result')).toBe('Testing…');
    clickOn(byId('set-holidays-test'));
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(1405);
    await vi.waitFor(() => { expect(text('set-holidays-test-result')).toBe('OK · 1405 official data · updated 2026-10-12'); });
    expect(byId('set-holidays-test').hasAttribute('aria-disabled')).toBe(false);
    clickOn(byId('set-holidays-test'));
    await vi.waitFor(() => { expect(text('set-holidays-test-result')).toBe('No official data for 1405 — using estimates'); });
    lang = 'fa';
    panel.rerender();
    expect(text('set-holidays-test-result')).toBe('داده رسمی برای ۱۴۰۵ نیست — تخمین‌ها استفاده می‌شوند');
  });

  it('renders user names as text only', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [{ id: 'x', name: '<img src=x>', calendar: 'persian', month: 1, day: 1 }] } }));
    expect(byId('set-user-holidays').querySelector('img')).toBeNull();
    expect(byId('set-user-holidays').querySelector('.uh-name')?.textContent).toBe('<img src=x>');
  });
});
```

Run: `npx vitest run tests/dom/holidays-panel.test.ts`. It should FAIL, because the module doesn't exist yet.

- [ ] **Step 3: Implement `Site/src/holidays/holidays-panel.ts`**

Implement the behaviour list above. Constraints:
- Every element is looked up with a `byId` that throws `Missing element #<id>`, and `#set-view-persian` comes first.
- Every visible string comes from `STRINGS`, and every user string is set through `textContent`.
- The Edit/Delete buttons get `textContent` = Edit/Delete and an `aria-label` of `${Edit} ${name}` / `${Delete} ${name}`.
- Separate the parts of each list item (name, when, Edit, Delete) with real `' '` text nodes, so that `li.textContent` reads 'Birthday 22 Mehr · every year Edit Delete', as the test expects.
- The `.uh-when` text is `${day} ${monthName}` followed by either ` · ${everyYear}` or ` ${year}`, in locale digits. For example "22 Mehr · every year" and "29 February 2028".
- After a successful save, restore the month select to month 1 of the current calendar.
- After a successful save or delete, re-render from the store subscription, not by hand.
- The test's `aria-disabled` handling mirrors `time/time-panel.ts`. Read that file and copy its shape.
- Keep the file under ~250 lines. If it grows past that, split the user-holiday form into `holidays/user-holiday-form.ts`, and note the split in the report.

Run the DOM test until it passes, then run `npx vitest run --coverage` and `npx tsc --noEmit`. Coverage must stay 100%, so add a test for any branch the list above does not reach.

- [ ] **Step 4: Wire into `main.ts`**

```ts
import { setupHolidaySettings } from './holidays/holidays-panel';
```
```ts
const holidaySettings = setupHolidaySettings({ store: settings, service: holidayService, getLang: () => lang, now: time.now });
```
Add `holidaySettings.rerender();` to `renderAll`.

- [ ] **Step 5: E2E**

```ts
// Site/e2e/holiday-settings.spec.ts
import { expect, test, type Page } from '@playwright/test';

const NOWRUZ_NOON = Date.UTC(2026, 2, 21, 8, 30) / 1000;

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/time', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ epochSec: NOWRUZ_NOON }),
  }));
  await page.route('**/api/holidays/ir/*.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('#view-persian .mv-title')).toHaveText('Farvardin 1405');
});

const openSettings = (page: Page) => page.getByRole('button', { name: /Settings|تنظیمات/ }).click();

test('add, edit and delete a holiday of my own; it shows in the month view and survives a reload', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-uh-name').fill('Family day');
  await page.locator('#set-uh-day').fill('5');
  await page.locator('#set-uh-save').click();
  await expect(page.locator('#set-user-holidays')).toContainText('Family day');
  await page.keyboard.press('Escape');
  const mine = page.locator('#view-persian .mv-holidays li', { hasText: 'Family day' });
  await expect(mine).toContainText('Mine');
  await expect(page.locator('#view-persian .mv-day[data-day="5"]')).toHaveClass(/holiday/);

  await page.reload();
  await expect(mine).toHaveCount(1);

  await openSettings(page);
  await page.getByRole('button', { name: 'Edit Family day' }).click();
  await page.locator('#set-uh-name').fill('Family reunion');
  await page.locator('#set-uh-save').click();
  await page.getByRole('button', { name: 'Delete Family reunion' }).click();
  await expect(page.locator('#set-user-holidays')).toHaveText('None yet');
});

test('a date that does not exist is refused', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-uh-name').fill('Leap');
  await page.locator('#set-uh-month').selectOption('12');
  await page.locator('#set-uh-day').fill('30');
  await page.locator('#set-uh-year').fill('1405');
  await page.locator('#set-uh-save').click();
  await expect(page.locator('#set-uh-error')).toHaveText('Enter a name and a date that exists');
});

test('turning sources and views off', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-src-ir').uncheck();
  await page.locator('#set-view-gregorian').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-persian .mv-day.holiday')).toHaveCount(0);
  await expect(page.locator('#view-gregorian')).toBeHidden();
});

test('test connection reports missing, then present, official data', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-holidays-test').click();
  await expect(page.locator('#set-holidays-test-result')).toHaveText('No official data for 1405 — using estimates');
  await page.unroute('**/api/holidays/ir/*.json');
  await page.route('**/api/holidays/ir/1405.json', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [] }),
  }));
  await page.locator('#set-holidays-test').click();
  await expect(page.locator('#set-holidays-test-result')).toHaveText('OK · 1405 official data · updated 2026-10-12');
});

test('the group is translated and right to left in Persian', async ({ page }) => {
  await page.locator('#lang-toggle').click();
  await openSettings(page);
  await expect(page.locator('.settings-holidays legend')).toHaveText('تقویم‌ها و تعطیلات');
  await expect(page.locator('#set-uh-save')).toHaveText('افزودن');
  await expect(page.locator('#set-uh-month option').first()).toHaveText('فروردین');
});
```

Run (with port 4173 free): `npm run build && npx playwright test e2e/holiday-settings.spec.ts && npx playwright test`. All tests must pass.

- [ ] **Step 6: Commit**

```bash
git status --short
git add Site/index.html Site/src/holidays/holidays-panel.ts Site/src/i18n/strings.ts Site/src/styles/components.css Site/src/main.ts Site/tests/dom/holidays-panel.test.ts Site/e2e/holiday-settings.spec.ts
git commit -m "feat(site): Settings — calendar views, holiday sources, my holidays, data check"
```

---
### Task 7: Holiday crawler, weekly workflow, and the data endpoint

**Files:**
- Create: `tools/holidays-crawler/holidayapi.ts` (logic), `tools/holidays-crawler/crawl.ts` (CLI), `.github/workflows/holidays-ir.yml`
- Create: `Site/tests/fixtures/holidayapi-1405-holidays.json` (copy of `.superpowers/sdd/2026-10-15-calendar-views-and-holidays/fixtures/holidays-1405-raw.json`: every 1405 day on which holidayapi.ir reported `is_holiday`, recorded 2026-10-15, keeping only the `is_holiday` events of each day)
- Modify: `Site/package.json` (devDependency `tsx`), `deploy/nginx.conf` (`/api/holidays/` location)
- Test: `Site/tests/crawler.test.ts`

**Interfaces:**
- Consumes: `IrLunarKey` (Task 1); `parseOfficialFile`, `OfficialFile` (Task 2, used to self-check the output); `daysInPersianMonth`, `toPersian`; `gregorianPartsIn` (`calendar/now.ts`). All are imported from `../../Site/src/…`.
- Produces:

```ts
export const SOURCE = 'holidayapi.ir';
export const dayUrl: (py: number, pm: number, pd: number) => string;    // https://holidayapi.ir/jalali/1405/04/04
export const DESCRIPTION_KEYS: Readonly<Record<string, IrLunarKey>>;
export class UnknownHolidayError extends Error {}
export function lunarHolidayDescriptions(body: unknown): string[];     // throws on a malformed body
export function keyFor(description: string): IrLunarKey;              // throws UnknownHolidayError
export interface CrawlDeps { fetchJson(url: string): Promise<unknown>; delay(ms: number): Promise<void> }
export function crawlYear(py: number, deps: CrawlDeps): Promise<{ key: IrLunarKey; p: string }[]>;
export function buildFile(py: number, holidays: readonly { key: IrLunarKey; p: string }[], fetched: string): { year: number; source: string; fetched: string; holidays: { key: IrLunarKey; p: string }[] };
export function sameHolidays(existing: unknown, holidays: readonly { key: IrLunarKey; p: string }[]): boolean;
```

**Ruling carried from planning (deviates from the spec's filter):** holidayapi.ir reports Fatimah's martyrdom (3 Jumada II, an official holiday) with `is_holiday: true` but `is_religious: false`, so the spec's literal `is_holiday && is_religious` filter would silently drop it. The crawler therefore keeps an event when `is_holiday && (is_religious || additional_description names a Hijri month)`.

I checked this against every 1405 holiday row. It keeps exactly the 17 lunar descriptions below, and no solar holiday, because those carry solar month names. Fridays (`جمعه`) carry an empty `additional_description` and `is_religious: false`, so they are excluded. An unknown description still fails the job, as the spec requires.

Description → key (descriptions normalised by collapsing whitespace and trimming; generated from the recorded bytes, copy exactly):

```ts
export const DESCRIPTION_KEYS: Readonly<Record<string, IrLunarKey>> = {
  "عید سعید فطر": 'ir.fitr',
  "تعطیل به مناسبت عید سعید فطر": 'ir.fitr',
  "شهادت امام جعفر صادق (ع)": 'ir.sadiq',
  "عید سعید قربان": 'ir.adha',
  "عید سعید غدیر خم": 'ir.ghadir',
  "تاسوعای حسینی": 'ir.tasua',
  "عاشورای حسینی": 'ir.ashura',
  "اربعین حسینی": 'ir.arbaeen',
  "رحلت رسول اکرم؛شهادت امام حسن مجتبی (ع)": 'ir.prophet',
  "شهادت امام رضا (ع)": 'ir.reza',
  "شهادت امام حسن عسکری (ع)": 'ir.askari',
  "میلاد رسول اکرم و امام جعفر صادق (ع)": 'ir.mawlid',
  "شهادت حضرت فاطمه زهرا (س)": 'ir.fatima',
  "ولادت امام علی (ع) و روز پدر": 'ir.ali-birth',
  "مبعث رسول اکرم (ص)": 'ir.mabath',
  "ولادت حضرت قائم عجل الله تعالی فرجه و جشن نیمه شعبان": 'ir.mahdi',
  "شهادت حضرت علی (ع)": 'ir.ali-martyrdom',
};
```

- [ ] **Step 1: Write the failing tests**

```ts
// Site/tests/crawler.test.ts
import { describe, expect, it, vi } from 'vitest';
import RAW_1405 from './fixtures/holidayapi-1405-holidays.json';
import OFFICIAL_1405 from './fixtures/ir-official-1405.json';
import {
  buildFile, crawlYear, dayUrl, DESCRIPTION_KEYS, keyFor, lunarHolidayDescriptions, sameHolidays,
  SOURCE, UnknownHolidayError,
} from '../../tools/holidays-crawler/holidayapi';
import { parseOfficialFile } from '../src/holidays/holiday-data';

const raw = RAW_1405 as Record<string, unknown>;
const NOT_A_HOLIDAY = { is_holiday: false, events: [] };

/** Serves the recording: recorded days as recorded, every other day as an ordinary day. */
const recorded = (): ((url: string) => Promise<unknown>) => async (url: string) => {
  const date = url.replace('https://holidayapi.ir/jalali/', '');
  return raw[date] ?? NOT_A_HOLIDAY;
};

describe('dayUrl', () => {
  it('pads month and day', () => {
    expect(dayUrl(1405, 4, 4)).toBe('https://holidayapi.ir/jalali/1405/04/04');
  });
});

describe('lunarHolidayDescriptions', () => {
  it('keeps religious holidays, and lunar ones the API forgot to flag religious', () => {
    expect(lunarHolidayDescriptions(raw['1405/04/04'])).toEqual(['عاشورای حسینی']);
    expect(lunarHolidayDescriptions(raw['1405/08/22'])).toEqual(['شهادت حضرت فاطمه زهرا (س)']);
  });

  it('drops Fridays and solar holidays', () => {
    expect(lunarHolidayDescriptions(raw['1405/01/12'])).toEqual([]);
    expect(lunarHolidayDescriptions(raw['1405/11/22'])).toEqual([]);
    expect(lunarHolidayDescriptions({ is_holiday: true, events: [{ description: 'جمعه', additional_description: '', is_holiday: true, is_religious: false }] })).toEqual([]);
  });

  it('normalises whitespace', () => {
    expect(lunarHolidayDescriptions(raw['1405/01/25'])).toEqual(['شهادت امام جعفر صادق (ع)']);
  });

  it('throws on a body that is not the API\'s shape', () => {
    for (const body of [null, 'x', {}, { events: 'x' }, { events: [null] }, { events: [{ description: 3 }] }]) {
      expect(() => lunarHolidayDescriptions(body), JSON.stringify(body)).toThrow();
    }
  });
});

describe('keyFor', () => {
  it('knows every lunar holiday the API reported for 1405', () => {
    for (const day of Object.values(raw)) {
      for (const d of lunarHolidayDescriptions(day)) expect(DESCRIPTION_KEYS[d], d).toBeDefined();
    }
  });

  it('fails loudly on a holiday it does not know', () => {
    expect(() => keyFor('عید جدید')).toThrow(UnknownHolidayError);
    expect(() => keyFor('عید جدید')).toThrow('عید جدید');
  });
});

describe('crawlYear', () => {
  it('turns the 1405 recording into exactly the official 1405 holidays, asking for every day once, in order', async () => {
    const fetchJson = vi.fn(recorded());
    const delay = vi.fn(async () => {});
    const holidays = await crawlYear(1405, { fetchJson, delay });
    expect(holidays).toEqual(OFFICIAL_1405.holidays);
    expect(fetchJson).toHaveBeenCalledTimes(365);              // one request per day of 1405 (not a leap year: no Esfand 30)
    expect(fetchJson.mock.calls[0]![0]).toBe(dayUrl(1405, 1, 1));
    expect(fetchJson.mock.calls.at(-1)![0]).toBe(dayUrl(1405, 12, 29));
    expect(delay).toHaveBeenCalledTimes(364);
  });

  it('fails on any fetch failure', async () => {
    const fetchJson = vi.fn(async () => { throw new Error('HTTP 500 for 1405/04/04'); });
    await expect(crawlYear(1405, { fetchJson, delay: async () => {} })).rejects.toThrow('HTTP 500');
  });

  it('fails on an unknown holiday', async () => {
    const fetchJson = vi.fn(async () => ({
      is_holiday: true,
      events: [{ description: 'عید جدید', additional_description: '۱ رجب', is_holiday: true, is_religious: true }],
    }));
    await expect(crawlYear(1405, { fetchJson, delay: async () => {} })).rejects.toThrow(UnknownHolidayError);
  });
});

describe('buildFile and sameHolidays', () => {
  it('builds a file the site accepts', () => {
    const file = buildFile(1405, OFFICIAL_1405.holidays as never, '2026-10-15');
    expect(file).toEqual({ year: 1405, source: SOURCE, fetched: '2026-10-15', holidays: OFFICIAL_1405.holidays });
    expect(parseOfficialFile(file, 1405)).not.toBeNull();
  });

  it('ignores the fetched date, so an unchanged crawl changes no file', () => {
    const holidays = OFFICIAL_1405.holidays as never;
    expect(sameHolidays({ ...OFFICIAL_1405, fetched: '1999-01-01' }, holidays)).toBe(true);
    expect(sameHolidays({ ...OFFICIAL_1405, holidays: [] }, holidays)).toBe(false);
    expect(sameHolidays(undefined, holidays)).toBe(false);
    expect(sameHolidays('garbage', holidays)).toBe(false);
  });
});
```

Run: `npx vitest run tests/crawler.test.ts`. Expected: FAIL, because the module does not exist yet.

- [ ] **Step 2: Implement `tools/holidays-crawler/holidayapi.ts`**

- `HIJRI_MONTH = /(محرم|صفر|ربیع|جمادی|رجب|شعبان|رمضان|شوال|ذوالقعده|ذوالحجه)/`.
- `lunarHolidayDescriptions` validates the body shape. It throws `Error('Unexpected response shape')` if `events` is not an array, or if any event's `description`, `additional_description`, `is_holiday` or `is_religious` has the wrong type. It then keeps events where `is_holiday && (is_religious || HIJRI_MONTH.test(additional_description))` and returns their normalised descriptions.
- `crawlYear` iterates `pm = 1..12`, `pd = 1..daysInPersianMonth(py, pm)`, awaiting `fetchJson(dayUrl(…))`. It calls `delay(200)` *between* requests (not after the last) and maps every description through `keyFor`. It returns `{ key, p: 'YYYY-MM-DD' }` in date order.
- `sameHolidays(existing, holidays)` is true when `existing` is a record whose `holidays` array deep-equals `holidays` (compare with `JSON.stringify`).
- `buildFile` returns exactly the shape the test shows.

Do not use `console.log` in this module; logging belongs in the CLI.

- [ ] **Step 3: Implement the CLI `tools/holidays-crawler/crawl.ts`**

```ts
// Usage (from Site/): npx tsx ../tools/holidays-crawler/crawl.ts public/api/holidays/ir
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gregorianPartsIn } from '../../Site/src/calendar/now';
import { toPersian } from '../../Site/src/calendar/persian';
import { parseOfficialFile } from '../../Site/src/holidays/holiday-data';
import { buildFile, crawlYear, sameHolidays } from './holidayapi';

const ATTEMPTS = 3;

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => { setTimeout(resolve, 2000 * attempt); });
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('Usage: crawl.ts <output directory>');
  const todayInTehran = gregorianPartsIn('Asia/Tehran', new Date());
  const fetched = `${todayInTehran.gy}-${String(todayInTehran.gm).padStart(2, '0')}-${String(todayInTehran.gd).padStart(2, '0')}`;
  const currentYear = toPersian(todayInTehran).py;
  mkdirSync(outDir, { recursive: true });
  for (const py of [currentYear, currentYear + 1]) {
    const holidays = await crawlYear(py, { fetchJson, delay: (ms) => new Promise((r) => { setTimeout(r, ms); }) });
    const path = join(outDir, `${py}.json`);
    const existing: unknown = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
    if (sameHolidays(existing, holidays)) {
      console.log(`${py}: unchanged (${holidays.length} holidays)`);
      continue;
    }
    const file = buildFile(py, holidays, fetched);
    if (parseOfficialFile(file, py) === null) throw new Error(`${py}: the site would reject this file`);
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`${py}: wrote ${holidays.length} holidays`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

Add `tsx` to `Site/package.json` devDependencies: run `npm install -D tsx` from `Site/`, which also updates `package-lock.json`. Choose a release at least two weeks old; `npm install -D tsx@4` is fine.

- [ ] **Step 4: The workflow `.github/workflows/holidays-ir.yml`**

```yaml
name: Iranian holidays

# Weekly: crawl holidayapi.ir for this Persian year and next, and open a PR when the
# lunar holiday dates change. A person checks the PR against the official calendar.
on:
  schedule:
    - cron: '23 4 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: holidays-ir
  cancel-in-progress: false

jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: Site/package-lock.json
      - run: npm ci
        working-directory: Site
      - name: Crawler tests
        run: npx vitest run tests/crawler.test.ts
        working-directory: Site
      - name: Crawl
        run: npx tsx ../tools/holidays-crawler/crawl.ts public/api/holidays/ir
        working-directory: Site
      - uses: peter-evans/create-pull-request@v7
        with:
          branch: holidays/ir-update
          delete-branch: true
          add-paths: Site/public/api/holidays/ir/*.json
          commit-message: 'chore(data): Iranian holiday dates from holidayapi.ir'
          title: 'Iranian holiday dates — please verify before merging'
          body: |
            The weekly crawl of holidayapi.ir changed the Iranian lunar holiday dates.

            Before merging, check each date against the official calendar of the
            Islamic Republic of Iran. Moon sighting can move a lunar holiday by a day,
            and dates for next year may still be provisional.

            Until this is merged the site keeps showing the previous data, or its
            own estimates, labelled "estimated".
```

(Check the `ci.yml` setup-node step and mirror its inputs: if it doesn't use `cache`, drop `cache` and `cache-dependency-path` here too.)

- [ ] **Step 5: nginx — a missing year must be a 404, not the SPA fallback**

In `deploy/nginx.conf`, add this before `location /`:

```nginx
    # Official holiday data, one file per Persian year. A year with no file is a
    # 404 rather than index.html, so the client falls back to its estimates.
    location ^~ /api/holidays/ {
        include /etc/nginx/security-headers.conf;
        default_type application/json;
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }
```

- [ ] **Step 6: Run tests, type-check, and a short live smoke test of the CLI**

```bash
npx vitest run tests/crawler.test.ts && npx vitest run --coverage && npx tsc --noEmit
```

The full live crawl takes about 5 minutes and is exercised by the workflow's manual dispatch after push, per the spec. Do **not** run it locally, and do **not** commit any `Site/public/api/holidays/ir/*.json` (Decision 4). Instead, check that the CLI starts and fails cleanly without an argument: `npx tsx ../tools/holidays-crawler/crawl.ts; echo exit=$?` must print the usage error and `exit=1`.

- [ ] **Step 7: Commit**

```bash
git status --short
git add tools/holidays-crawler .github/workflows/holidays-ir.yml deploy/nginx.conf Site/package.json Site/package-lock.json Site/tests/crawler.test.ts Site/tests/fixtures/holidayapi-1405-holidays.json
git commit -m "feat: weekly holidayapi.ir crawler that proposes holiday data as a PR"
```

---
### Task 8: Docs and a carried-over test

**Files:**
- Modify: `README.md`, `docs/SECURITY.md`
- Modify: `Site/tests/dom/time-source.test.ts` (carried over from the time-sync plan's final review: there is no isolated test for "a device known to be off resyncs on every return, even after a short absence")

- [ ] **Step 1: The carried test.** Add it to `time-source.test.ts`, in the schedule `describe`. Read the existing visibility tests first and reuse their helpers.

```ts
    it('resyncs on any return while the device is known to be off, even after a short absence', async () => {
      const fetchImpl = serverAhead(5_000);            // offset +5 s, outside the dead band
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
      setHidden(true);
      vi.setSystemTime(Date.now() + 60_000);           // one minute away, clock moving forward
      setHidden(false);
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });
    });
```

Before keeping the test, check that it fails when the `knownOff` clause in `onVisibility` is temporarily removed, then restore the clause. Record that red run in the report.

- [ ] **Step 2: README.md**
- **Features**, in "Design and behaviour notes", after **Time source**, add a **Month views and holidays** bullet. It should cover:
  - the two panels, their defaults, paging, Today, and clicking a day to fill the converter;
  - holiday marking and the list with Iran / Nuremberg / Mine tags and "estimated";
  - what each source covers (Iranian solar and lunar; Nuremberg = Bavaria without Assumption Day);
  - the official data file and its fallback to the Umm al-Qura estimate;
  - user holidays (yearly or one-off; Esfand 30 and Feb 29 only shown in years that have them).
- **Settings**: mention the Calendars & holidays group, including its Test connection.
- **Repo layout**: add `src/holidays/`, `src/views/`, `tools/holidays-crawler/`, `.github/workflows/holidays-ir.yml`, `public/api/holidays/ir/` (data files, added by reviewed PRs), and the new E2E specs.
- **PWA strategy table**: note that `/api/holidays/ir/*.json` is served stale-while-revalidate by the existing catch-all row.
- **Serving configuration**: add the `/api/holidays/` location (404 for a missing year, `no-cache`).
- **Holiday data**: a new short section describing the weekly workflow.
  - What it crawls, the filter (and why Fatimah's martyrdom needs the Hijri-month rule), and that unknown descriptions fail the job.
  - That a run only opens a PR when the dates change, and that the PR must be checked against the official calendar before merging.
  - That opening the PR requires the repository setting **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"**.
- **Privacy**: holiday data is fetched from this same site only. holidayapi.ir is contacted by the GitHub Action, never by a visitor's browser.
- **Test counts, coverage totals and bundle sizes**: real numbers from this run (`npx vitest run --coverage`, the full Playwright suite, `npm run build`), in every place the README states them.

- [ ] **Step 3: docs/SECURITY.md**
- Wherever SECURITY.md describes what visitors' browsers request, add `/api/holidays/ir/{year}.json` (same origin, static, no personal data).
- Add a row to the change-management/CI table for the holidays workflow.
  - Its token permissions are `contents: write` and `pull-requests: write`, limited to that workflow.
  - It runs on a schedule and on manual dispatch only, never on pull requests, so untrusted code never gets the write token.
  - Its output reaches `master` only through a human-reviewed PR.
- Third-party data: holidayapi.ir is unofficial and has no SLA. Its data is validated twice: by the crawler (`parseOfficialFile` self-check) and by the client (all-or-nothing validation). A bad or missing file degrades to labelled estimates.
- Update the `localStorage` description: `settings.v1` now also holds view and holiday preferences, including user-entered holiday names. These are entered by the user, never leave the browser, and are rendered as text only.
- Update the test counts.

- [ ] **Step 4: Check every claim**

```bash
grep -n "holiday\|api/holidays\|holidayapi" README.md docs/SECURITY.md
```
Check each claim against the code and config it describes (`Site/src/holidays/*`, `deploy/nginx.conf`, `.github/workflows/holidays-ir.yml`, `Site/public/sw.js`).

- [ ] **Step 5: Commit**

```bash
git status --short
git add README.md docs/SECURITY.md Site/tests/dom/time-source.test.ts
git commit -m "docs: month views, holidays and the holiday-data workflow"
```

---

## After the tasks (controller)

1. Run the whole-branch final review and its single fix wave.
2. Build the Docker image and check it.
   - `/api/holidays/ir/1405.json` → 404 with the security headers and `no-cache`.
   - `/api/time` is unchanged.
   - Drive the container in Chrome: both panels, holidays, a day click, user holiday CRUD, Test connection, and FA.
3. Push to `master`, wait for CI and the deploy, and verify the live site the same way.
4. Dispatch `Iranian holidays` once (`gh workflow run holidays-ir.yml`) and wait for it.
   - Report the outcome.
   - If the repository setting blocks PR creation, the branch `holidays/ir-update` will still have been pushed. Report the compare URL and the one-checkbox fix (Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"); do not change repository settings.
   - If `peter-evans/create-pull-request@v7` is rejected (deprecated runtime, removed), bump to its next major. Do not switch to `gh pr create`, which has the same token restriction.
5. Do not merge the data PR. Its dates must be checked against the official calendar by the user (spec).

## Not in this plan (surfaced, not done)

- Weekend shading (Friday in the Persian view, Sat/Sun in the Gregorian view): not in the spec.
- Import/export of user holidays and other countries: out of scope per the spec.
- A visible "data from holidayapi.ir, updated …" line under the panels: the source date is reachable through Settings → Test connection.

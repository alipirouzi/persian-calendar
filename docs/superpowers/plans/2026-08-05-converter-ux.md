# Converter UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Month-name dropdowns, digit-tolerant inputs, a weekday/copy/today status row, URL-shareable dates, and an above-the-fold desktop layout for the PersianCalendar static site.

**Architecture:** All changes live in `Site/` (Vite + vanilla TypeScript, zero runtime framework). Pure logic goes in framework-free modules (`converter-core.ts`, `url-state.ts`, `i18n/format.ts`) tested with Vitest; DOM wiring stays in `converter.ts`/`main.ts` tested with Playwright. Spec: `docs/superpowers/specs/2026-08-05-converter-ux-design.md`.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (chromium, port 4173).

## Global Constraints

- **No new runtime dependencies.** The shipped bundle is ~9.9 kB JS; keep additions to plain TypeScript.
- **Both languages always.** Every user-visible string comes from `STRINGS`/month/weekday tables in `src/i18n/strings.ts` — never hardcode display text in markup or logic.
- **`<option>` values are ASCII digit strings `"1"`–`"12"`**; only option *labels* are localized.
- **Do not touch** `Lib/`, `Console/`, `Tests/` (C#), `Site/sw.js` caching logic, or `deploy/`.
- **Never rewrite the field the user is typing in** — conversion writes only the opposite side.
- **Working dir:** all `npm` commands run in `Site/`.
- **Commits:** commit exactly the files your task lists, conventional-commit messages, never push, never commit unrelated files.
- **Phases:** Tasks 1–3 are parallel-safe (disjoint files). Task 4 requires 1–3 done. Tasks 5–6 are parallel-safe after 4. Task 7 runs last.

---

## Task 1: Digit-tolerant parsing in converter-core

**Files:**
- Modify: `Site/src/converter/converter-core.ts` (function `parseField`, ~line 22)
- Test: `Site/tests/converter-core.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function normalizeDigits(raw: string): string` in `converter-core.ts`. `convertFrom` signature unchanged; it now accepts Persian-Indic (۰–۹, U+06F0–U+06F9) and Arabic-Indic (٠–٩, U+0660–U+0669) digits in any field. The `errMonth` branch is **kept** (URL params reach `convertFrom` unvalidated — see spec §2).

- [ ] **Step 1: Write the failing tests** — append to `Site/tests/converter-core.test.ts`:

```typescript
import { convertFrom, normalizeDigits } from '../src/converter/converter-core';
// (replace the existing import line — normalizeDigits is new)

describe('normalizeDigits', () => {
  it('maps Persian-Indic digits to ASCII', () => {
    expect(normalizeDigits('۱۴۰۵')).toBe('1405');
  });
  it('maps Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('١٤٠٥')).toBe('1405');
  });
  it('handles mixed digits and leaves ASCII/other chars alone', () => {
    expect(normalizeDigits('1۴0٥')).toBe('1405');
    expect(normalizeDigits('abc')).toBe('abc');
    expect(normalizeDigits('')).toBe('');
  });
});

describe('convertFrom with non-ASCII digits', () => {
  it('converts Persian-digit input identically to ASCII', () => {
    expect(convertFrom('persian', { y: '۱۴۰۳', m: '۱۰', d: '۲۲' }))
      .toEqual(convertFrom('persian', { y: '1403', m: '10', d: '22' }));
  });
  it('converts Arabic-digit Gregorian input', () => {
    expect(convertFrom('gregorian', { y: '٢٠٢٦', m: '7', d: '31' }))
      .toMatchObject({ status: 'ok', persian: { py: 1405, pm: 5, pd: 9 } });
  });
  it('still rejects out-of-range months (URL-injection path)', () => {
    expect(convertFrom('persian', { y: '1404', m: '13', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errMonth' });
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd Site && npx vitest run tests/converter-core.test.ts`
Expected: FAIL — `normalizeDigits` is not exported; Persian-digit conversion returns `incomplete`.

- [ ] **Step 3: Implement** — in `Site/src/converter/converter-core.ts`, add above `parseField` and modify `parseField`:

```typescript
const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/** Map Persian-Indic (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII. */
export function normalizeDigits(raw: string): string {
  return raw.replace(/[۰-۹٠-٩]/g, (ch) => {
    const cp = ch.codePointAt(0) as number;
    return String(cp >= PERSIAN_ZERO ? cp - PERSIAN_ZERO : cp - ARABIC_ZERO);
  });
}

function parseField(raw: string): number | null {
  const cleaned = normalizeDigits(raw.trim());
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isInteger(n) ? n : null;
}
```

- [ ] **Step 4: Run the full Vitest suite**

Run: `cd Site && npm test`
Expected: all tests PASS (existing 42 + new 6).

- [ ] **Step 5: Commit**

```bash
git add Site/src/converter/converter-core.ts Site/tests/converter-core.test.ts
git commit -m "feat(site): accept Persian and Arabic digits in converter fields"
```

---

## Task 2: i18n — weekdays, action labels, date formatters

**Files:**
- Modify: `Site/src/i18n/strings.ts` (add keys/tables — do NOT remove anything)
- Create: `Site/src/i18n/format.ts`
- Test: `Site/tests/format.test.ts` (new)

**Interfaces:**
- Consumes: `PersianDateParts`/`GregorianDateParts` from `src/calendar/persian.ts`; `toLocaleDigits`, month tables from `strings.ts`.
- Produces (Task 4 depends on these exact names):
  - `strings.ts`: `WEEKDAYS: Record<Lang, readonly string[]>` (index = JS `Date.getDay()`, 0 = Sunday); new `StringKey`s `today`, `copy`, `copied`.
  - `format.ts`: `weekdayName(g: GregorianDateParts, lang: Lang): string`, `formatPersianDate(p: PersianDateParts, lang: Lang): string`, `formatGregorianDate(g: GregorianDateParts, lang: Lang): string`, `copySentence(p: PersianDateParts, g: GregorianDateParts, lang: Lang): string`.

- [ ] **Step 1: Write the failing tests** — create `Site/tests/format.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { copySentence, formatGregorianDate, formatPersianDate, weekdayName } from '../src/i18n/format';
import { WEEKDAYS } from '../src/i18n/strings';

// Fixed vector shared with converter-core tests: 1403-10-22 ↔ 2025-01-11 (a Saturday).
const P = { py: 1403, pm: 10, pd: 22 };
const G = { gy: 2025, gm: 1, gd: 11 };

describe('weekdays', () => {
  it('tables are complete and getDay-ordered', () => {
    expect(WEEKDAYS.en).toHaveLength(7);
    expect(WEEKDAYS.fa).toHaveLength(7);
    expect(WEEKDAYS.en[0]).toBe('Sunday');   // Date.getDay() === 0
    expect(WEEKDAYS.fa[6]).toBe('شنبه');     // Saturday
  });
  it('resolves a known date in both languages', () => {
    expect(weekdayName(G, 'en')).toBe('Saturday');
    expect(weekdayName(G, 'fa')).toBe('شنبه');
  });
});

describe('date formatting', () => {
  it('formats the Persian date', () => {
    expect(formatPersianDate(P, 'en')).toBe('22 Dey 1403');
    expect(formatPersianDate(P, 'fa')).toBe('۲۲ دی ۱۴۰۳');
  });
  it('formats the Gregorian date per language convention', () => {
    expect(formatGregorianDate(G, 'en')).toBe('January 11, 2025');
    expect(formatGregorianDate(G, 'fa')).toBe('۱۱ ژانویه ۲۰۲۵');
  });
  it('builds the copy sentence', () => {
    expect(copySentence(P, G, 'en')).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
    expect(copySentence(P, G, 'fa')).toBe('شنبه ۲۲ دی ۱۴۰۳ — ۱۱ ژانویه ۲۰۲۵');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Site && npx vitest run tests/format.test.ts`
Expected: FAIL — `src/i18n/format.ts` does not exist; `WEEKDAYS` not exported.

- [ ] **Step 3: Extend `strings.ts`** — three additive edits:

Extend the `StringKey` union:

```typescript
export type StringKey =
  | 'pageTitle' | 'persianLabel' | 'gregorianLabel'
  | 'year' | 'month' | 'day' | 'tehranLabel' | 'langToggle'
  | 'today' | 'copy' | 'copied'
  | 'errYearRange' | 'errMonth' | 'errDay';
```

Add to `STRINGS.en`: `today: 'Today', copy: 'Copy', copied: 'Copied',`
Add to `STRINGS.fa`: `today: 'امروز', copy: 'کپی', copied: 'کپی شد',`

Add after `GREGORIAN_MONTHS`:

```typescript
/** Indexed by JS Date.getDay(): 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
};
```

- [ ] **Step 4: Create `Site/src/i18n/format.ts`:**

```typescript
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, WEEKDAYS, type Lang,
} from './strings';

export function weekdayName(g: GregorianDateParts, lang: Lang): string {
  const day = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return WEEKDAYS[lang][day] as string;
}

export function formatPersianDate(p: PersianDateParts, lang: Lang): string {
  return `${toLocaleDigits(p.pd, lang)} ${PERSIAN_MONTHS[lang][p.pm - 1]} ${toLocaleDigits(p.py, lang)}`;
}

export function formatGregorianDate(g: GregorianDateParts, lang: Lang): string {
  return lang === 'fa'
    ? `${toLocaleDigits(g.gd, lang)} ${GREGORIAN_MONTHS[lang][g.gm - 1]} ${toLocaleDigits(g.gy, lang)}`
    : `${GREGORIAN_MONTHS[lang][g.gm - 1]} ${g.gd}, ${g.gy}`;
}

/** Full shareable sentence, e.g. "Saturday, 22 Dey 1403 — January 11, 2025". */
export function copySentence(p: PersianDateParts, g: GregorianDateParts, lang: Lang): string {
  const w = weekdayName(g, lang);
  const sep = lang === 'fa' ? ' ' : ', ';
  return `${w}${sep}${formatPersianDate(p, lang)} — ${formatGregorianDate(g, lang)}`;
}
```

- [ ] **Step 5: Run the full Vitest suite**

Run: `cd Site && npm test`
Expected: all PASS (the existing `i18n.test.ts` key-parity test must still pass — you added `today`/`copy`/`copied` to **both** languages).

- [ ] **Step 6: Commit**

```bash
git add Site/src/i18n/strings.ts Site/src/i18n/format.ts Site/tests/format.test.ts
git commit -m "feat(site): weekday names, action labels, and date formatters"
```

---

## Task 3: URL state module

**Files:**
- Create: `Site/src/converter/url-state.ts`
- Test: `Site/tests/url-state.test.ts` (new)

**Interfaces:**
- Consumes: `type Side = 'persian' | 'gregorian'` from `./converter-core` (already exported today — no dependency on Task 1's changes).
- Produces (Task 4 depends on these exact names):
  - `parseUrlDate(search: string): UrlDate | null` where `interface UrlDate { side: Side; y: number; m: number; d: number }`
  - `formatUrlQuery(side: Side, y: number, m: number, d: number): string` → `"?p=1403-10-22"` / `"?g=2025-1-11"`
  - Structural validation only (exactly one of `p`/`g`, `N-N-N` integers). **Range validation is the caller's job via `convertFrom`.**

- [ ] **Step 1: Write the failing tests** — create `Site/tests/url-state.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { formatUrlQuery, parseUrlDate } from '../src/converter/url-state';

describe('parseUrlDate', () => {
  it('parses a Persian param', () => {
    expect(parseUrlDate('?p=1403-10-22'))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
  it('parses a Gregorian param', () => {
    expect(parseUrlDate('?g=2025-1-11'))
      .toEqual({ side: 'gregorian', y: 2025, m: 1, d: 11 });
  });
  it('ignores unrelated params around the date', () => {
    expect(parseUrlDate('?utm_source=x&p=1403-10-22'))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
  it('rejects empty, missing, or ambiguous input', () => {
    expect(parseUrlDate('')).toBeNull();
    expect(parseUrlDate('?')).toBeNull();
    expect(parseUrlDate('?p=1403-10-22&g=2025-1-11')).toBeNull(); // both sides
  });
  it('rejects malformed values', () => {
    expect(parseUrlDate('?p=1403-10')).toBeNull();
    expect(parseUrlDate('?p=1403/10/22')).toBeNull();
    expect(parseUrlDate('?p=abc-de-fg')).toBeNull();
    expect(parseUrlDate('?p=1403-10-22-5')).toBeNull();
    expect(parseUrlDate('?p=')).toBeNull();
  });
});

describe('formatUrlQuery', () => {
  it('round-trips with parseUrlDate', () => {
    expect(formatUrlQuery('persian', 1403, 10, 22)).toBe('?p=1403-10-22');
    expect(formatUrlQuery('gregorian', 2025, 1, 11)).toBe('?g=2025-1-11');
    expect(parseUrlDate(formatUrlQuery('persian', 1403, 10, 22)))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Site && npx vitest run tests/url-state.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `Site/src/converter/url-state.ts`:**

```typescript
import type { Side } from './converter-core';

export interface UrlDate { side: Side; y: number; m: number; d: number }

const DATE_RE = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Structural parse of ?p=Y-M-D or ?g=Y-M-D. Exactly one of p/g must be
 * present. Range validation is deliberately left to convertFrom.
 */
export function parseUrlDate(search: string): UrlDate | null {
  const params = new URLSearchParams(search);
  const p = params.get('p');
  const g = params.get('g');
  if ((p === null) === (g === null)) return null; // need exactly one side
  const match = DATE_RE.exec((p ?? g) as string);
  if (!match) return null;
  return {
    side: p !== null ? 'persian' : 'gregorian',
    y: Number(match[1]), m: Number(match[2]), d: Number(match[3]),
  };
}

export function formatUrlQuery(side: Side, y: number, m: number, d: number): string {
  return `?${side === 'persian' ? 'p' : 'g'}=${y}-${m}-${d}`;
}
```

- [ ] **Step 4: Run the full Vitest suite**

Run: `cd Site && npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add Site/src/converter/url-state.ts Site/tests/url-state.test.ts
git commit -m "feat(site): URL query state parser and formatter"
```

---

## Task 4: DOM integration — dropdowns, status row, URL wiring (after Tasks 1–3)

**Files:**
- Modify: `Site/index.html` (converter section)
- Modify: `Site/src/converter/converter.ts` (substantial rework)
- Modify: `Site/src/main.ts` (today panel weekday, URL prefill)
- Modify: `Site/src/styles/components.css` (select + status-row styles, touch targets)
- Modify: `Site/e2e/site.spec.ts` (month fills → selectOption; touch-target coverage for selects)

**Interfaces:**
- Consumes: `normalizeDigits`/`convertFrom` (Task 1), `WEEKDAYS`/`today`/`copy`/`copied` strings and `weekdayName`/`formatPersianDate`/`formatGregorianDate`/`copySentence` (Task 2), `parseUrlDate`/`formatUrlQuery` (Task 3), existing `nowSnapshot`.
- Produces: `setupConverter(getLang)` keeps its return shape `{ prefill, rerender }`. New DOM ids: `#status-row`, `#btn-today`, `#weekday`, `#btn-copy`. Month fields become `<select id="p-m">` / `<select id="g-m">` with option values `"1"`–`"12"`.

This task is DOM wiring — E2E-tested (Step 8), no new Vitest.

- [ ] **Step 1: Update `Site/index.html`** — replace both month `<label>`s and add the status row.

Persian month label (Gregorian side analogous, id `g-m`):

```html
<label><span data-str="month"></span>
  <select id="p-m"></select></label>
```

Between `</form>` and the error line, insert:

```html
<div id="status-row">
  <button id="btn-today" type="button" data-str="today"></button>
  <span id="weekday"></span>
  <button id="btn-copy" type="button" data-str="copy"></button>
</div>
```

(`data-str` labels are filled by `renderStatic()` in `main.ts` — no extra wiring needed.)

- [ ] **Step 2: Rework `Site/src/converter/converter.ts`.** Reference implementation — keep exported names exactly:

```typescript
import { convertFrom, type Side } from './converter-core';
import { formatUrlQuery } from './url-state';
import { nowSnapshot } from '../calendar/now';
import { copySentence, weekdayName } from '../i18n/format';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';

const COPIED_RESET_MS = 1500;

interface Refs {
  persian: { y: HTMLInputElement; m: HTMLSelectElement; d: HTMLInputElement };
  gregorian: { y: HTMLInputElement; m: HTMLSelectElement; d: HTMLInputElement };
  error: HTMLElement;
  weekday: HTMLElement;
  btnToday: HTMLButtonElement;
  btnCopy: HTMLButtonElement;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function populateMonths(select: HTMLSelectElement, names: readonly string[]): void {
  const current = select.value;
  select.replaceChildren(...names.map((name, i) => {
    const option = document.createElement('option');
    option.value = String(i + 1);
    option.textContent = name;
    return option;
  }));
  select.value = current !== '' ? current : '1';
}

export function setupConverter(getLang: () => Lang): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
} {
  const refs: Refs = {
    persian: { y: byId('p-y'), m: byId('p-m'), d: byId('p-d') },
    gregorian: { y: byId('g-y'), m: byId('g-m'), d: byId('g-d') },
    error: byId('converter-error'),
    weekday: byId('weekday'),
    btnToday: byId('btn-today'),
    btnCopy: byId('btn-copy'),
  };
  let lastEdited: Side = 'persian';
  let lastOk: { p: PersianDateParts; g: GregorianDateParts } | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const setSide = (side: Side, p: PersianDateParts, g: GregorianDateParts): void => {
    const lang = getLang();
    if (side === 'persian') {
      refs.persian.y.value = toLocaleDigits(p.py, lang);
      refs.persian.m.value = String(p.pm);
      refs.persian.d.value = toLocaleDigits(p.pd, lang);
    } else {
      refs.gregorian.y.value = toLocaleDigits(g.gy, lang);
      refs.gregorian.m.value = String(g.gm);
      refs.gregorian.d.value = toLocaleDigits(g.gd, lang);
    }
  };

  const showError = (message: string | null): void => {
    refs.error.hidden = message === null;
    refs.error.textContent = message ?? '';
  };

  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    refs.weekday.textContent = ok ? weekdayName(ok.g, getLang()) : '';
    refs.btnCopy.disabled = ok === null;
  };

  const run = (source: Side, updateUrl: boolean): void => {
    lastEdited = source;
    const lang = getLang();
    const f = refs[source];
    const outcome = convertFrom(source, { y: f.y.value, m: f.m.value, d: f.d.value });
    if (outcome.status === 'ok') {
      setSide(source === 'persian' ? 'gregorian' : 'persian', outcome.persian, outcome.gregorian);
      showError(null);
      setStatus({ p: outcome.persian, g: outcome.gregorian });
      if (updateUrl) {
        const { p, g } = { p: outcome.persian, g: outcome.gregorian };
        const query = source === 'persian'
          ? formatUrlQuery('persian', p.py, p.pm, p.pd)
          : formatUrlQuery('gregorian', g.gy, g.gm, g.gd);
        history.replaceState(null, '', query);
      }
      return;
    }
    setStatus(null);
    if (outcome.status === 'incomplete') {
      showError(null);
      return;
    }
    const params = { ...outcome.params };
    if (outcome.errorKey === 'errDay') {
      const months = outcome.side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      (params as Record<string, string | number>)['month'] = months[(outcome.params['month'] as number) - 1] as string;
    }
    showError(formatTemplate(STRINGS[lang][outcome.errorKey], params, lang));
  };

  const prefill = (p: PersianDateParts, g: GregorianDateParts): void => {
    setSide('persian', p, g);
    setSide('gregorian', p, g);
    showError(null);
    setStatus({ p, g });
  };

  const renderMonths = (): void => {
    const lang = getLang();
    populateMonths(refs.persian.m, PERSIAN_MONTHS[lang]);
    populateMonths(refs.gregorian.m, GREGORIAN_MONTHS[lang]);
  };
  renderMonths();

  for (const side of ['persian', 'gregorian'] as const) {
    refs[side].y.addEventListener('input', () => run(side, true));
    refs[side].d.addEventListener('input', () => run(side, true));
    refs[side].m.addEventListener('change', () => run(side, true));
  }

  refs.btnToday.addEventListener('click', () => {
    const snap = nowSnapshot();
    prefill(snap.local.p, snap.local.g);
    history.replaceState(null, '', window.location.pathname);
  });

  refs.btnCopy.addEventListener('click', () => {
    if (lastOk === null) return;
    const lang = getLang();
    void navigator.clipboard.writeText(copySentence(lastOk.p, lastOk.g, lang)).then(() => {
      refs.btnCopy.textContent = STRINGS[lang].copied;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        refs.btnCopy.textContent = STRINGS[getLang()].copy;
      }, COPIED_RESET_MS);
    });
  });

  return {
    prefill,
    rerender: () => {
      renderMonths();
      // Language switch: refresh digits/labels on BOTH sides from the last
      // valid state (the user is not mid-typing during a toggle).
      if (lastOk !== null) {
        setSide('persian', lastOk.p, lastOk.g);
        setSide('gregorian', lastOk.p, lastOk.g);
        setStatus(lastOk);
        showError(null);
      } else {
        run(lastEdited, false);
      }
    },
  };
}
```

Note on inputs: change the four `<input type="number">` (ids `p-y`, `p-d`, `g-y`, `g-d`) in `index.html` to `type="text" inputmode="numeric"`. Keep the `min`/`max` attributes off text inputs (remove them); range enforcement lives in `convertFrom`.

- [ ] **Step 3: Update `Site/src/main.ts`.**

Add imports: `import { formatGregorianDate, formatPersianDate, weekdayName } from './i18n/format';` and `import { parseUrlDate } from './converter/url-state';` and `import { convertFrom } from './converter/converter-core';`

Replace the two date lines in `renderToday()`:

```typescript
  const w = weekdayName(g, lang);
  const sep = lang === 'fa' ? ' ' : ', ';
  text('today-persian', `${w}${sep}${formatPersianDate(p, lang)}`);
  text('today-gregorian', `${w}${sep}${formatGregorianDate(g, lang)}`);
```

Replace the startup prefill block (`const today = nowSnapshot(); converter.prefill(...)`) with:

```typescript
const urlDate = parseUrlDate(window.location.search);
const urlOutcome = urlDate === null ? null : convertFrom(urlDate.side, {
  y: String(urlDate.y), m: String(urlDate.m), d: String(urlDate.d),
});
if (urlOutcome?.status === 'ok') {
  converter.prefill(urlOutcome.persian, urlOutcome.gregorian);
} else {
  // No param, or an invalid one — ignore silently and show today.
  const today = nowSnapshot();
  converter.prefill(today.local.p, today.local.g);
}
```

- [ ] **Step 4: Style the new elements in `Site/src/styles/components.css`.**

Extend the input rule to cover selects — change the `.fields input` selector to `.fields input, .fields select` (both the base rule and the `:focus` rule). Add after the exchange/error rules:

```css
.fields select { width: auto; min-width: 7rem; }
#status-row {
  display: flex; gap: 1.75rem; justify-content: center; align-items: baseline;
  margin-top: 1.25rem;
}
#weekday { color: var(--accent); min-width: 5.5rem; text-align: center; }
#status-row button {
  position: relative; background: none; border: 0; padding: 0;
  font-family: var(--font-ui); font-size: 0.85rem; color: var(--text-muted);
  border-bottom: 1px dotted var(--text-muted); cursor: pointer;
  transition: color var(--duration) var(--ease);
}
#status-row button:hover:not(:disabled) { color: var(--accent); }
#status-row button:disabled { opacity: 0.4; cursor: default; }
/* Invisible hit-area extension, same pattern as #lang-toggle (WCAG 2.5.8). */
#status-row button::after { content: ''; position: absolute; inset: -12px; }
```

In the existing touch-target media block (`@media (max-width: 1024px), (pointer: coarse)`), change the selector `.fields input` to `.fields input, .fields select`.

- [ ] **Step 5: Build and type-check**

Run: `cd Site && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 6: Update existing E2E tests in `Site/e2e/site.spec.ts`** — month fields are now selects:

- In `persian → gregorian live conversion`: `await page.locator('#p-m').fill('10')` → `await page.locator('#p-m').selectOption('10')`.
- In `gregorian → persian live conversion`: same change for `#g-m` (`selectOption('7')`).
- In `invalid day shows localized month-aware error`: `#p-m` fill `'12'` → `selectOption('12')`.
- In `loads with today prefilled…`: `inputValue()` works on selects — no change needed.
- In both touch-target tests: change the locator `.fields input` to `.fields input, .fields select` so the six controls per form are all checked.

- [ ] **Step 7: Run the E2E suite**

Run: `cd Site && npx playwright test`
Expected: all PASS. (New-feature E2E coverage is Task 6; this step proves no regressions.)

- [ ] **Step 8: Commit**

```bash
git add Site/index.html Site/src/converter/converter.ts Site/src/main.ts Site/src/styles/components.css Site/e2e/site.spec.ts
git commit -m "feat(site): month dropdowns, status row with weekday/copy/today, URL date state"
```

---

## Task 5: Above-the-fold desktop layout (after Task 4; parallel with Task 6)

**Files:**
- Modify: `Site/src/styles/tokens.css`, `Site/src/styles/components.css`
- Modify: `Site/e2e/site.spec.ts` (desktop invariant numbers + new fold test)

**Interfaces:**
- Consumes: final DOM from Task 4 (status row adds ~3 rem to the converter section).
- Produces: the invariant below. No API surface.

**The contract:** at any desktop viewport (width ≥ 1025 px) with height ≥ 700 px, the bottom of `#converter` (including `#status-row`) sits inside the viewport with no scrolling. Phone/tablet layouts (≤ 1024 px) must not change — the existing screenshot tests guard that.

- [ ] **Step 1: Write the failing E2E test** — add to `Site/e2e/site.spec.ts`:

```typescript
test('desktop: converter incl. status row is fully above the fold', async ({ page }) => {
  for (const [width, height] of [[1440, 700], [1280, 720], [1920, 700]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const converter = await page.locator('#converter').boundingBox();
    expect(converter, `viewport ${width}x${height}`).not.toBeNull();
    expect(converter!.y + converter!.height, `viewport ${width}x${height}`)
      .toBeLessThanOrEqual(height);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd Site && npx playwright test -g "above the fold"`
Expected: FAIL — converter bottom exceeds 700.

- [ ] **Step 3: Tighten the desktop layout.** Add a desktop-only override; do not touch the base tokens (phones keep current rhythm):

In `tokens.css`, after the dark-mode block:

```css
/* Desktop: the whole product — clock, today, converter — fits one viewport. */
@media (min-width: 1025px) {
  :root {
    --space-section: clamp(1.75rem, 1rem + 1.5vw, 2.75rem);
    --text-date: clamp(1.5rem, 1rem + 1.6vw, 2.1rem);
  }
}
```

In `components.css`, add a desktop clock cap next to the existing clock media rules:

```css
/* Desktop: smaller dial so the converter fits above the fold (≥700px tall). */
@media (min-width: 1025px) { .clock { width: 210px; height: 210px; } }
```

Tune these three values until Step 4 passes with margin (aim for ≥ 30 px of slack at 1440×700); keep the page visually balanced — check `test-results/screens/*-1440.png` afterwards.

- [ ] **Step 4: Update the existing desktop invariants in `site.spec.ts`:**

- `desktop stays pixel-identical regardless of short viewport height` asserts `clock.height` — update `260` to the final desktop size chosen in Step 3 (e.g. `210`).
- `tablet clock is larger than phone clock` (≥ 300 at tablet) still passes — tablets are unaffected. Verify, don't change.

- [ ] **Step 5: Run the full E2E suite and inspect screenshots**

Run: `cd Site && npx playwright test`
Expected: all PASS. Open `Site/test-results/screens/light-1440.png` and `dark-1440.png` — the layout must look intentional, not cramped.

- [ ] **Step 6: Commit**

```bash
git add Site/src/styles/tokens.css Site/src/styles/components.css Site/e2e/site.spec.ts
git commit -m "feat(site): above-the-fold desktop layout with tightened rhythm"
```

---

## Task 6: E2E coverage for the new features (after Task 4; parallel with Task 5)

**Files:**
- Create: `Site/e2e/converter-ux.spec.ts`

**Interfaces:**
- Consumes: DOM ids from Task 4 (`#btn-today`, `#btn-copy`, `#weekday`, month selects), copy-sentence format from Task 2, URL format from Task 3.
- Produces: test file only.

- [ ] **Step 1: Create `Site/e2e/converter-ux.spec.ts`:**

```typescript
import { expect, test } from '@playwright/test';

// Fixed vector: 1403-10-22 ↔ 2025-01-11 (Saturday), shared with unit tests.
async function enterPersianDate(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').selectOption('10');
  await page.locator('#p-d').fill('22');
}

test('month dropdowns carry localized labels and survive the language toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#p-m option[value="5"]')).toHaveText('Mordad');
  await expect(page.locator('#g-m option[value="8"]')).toHaveText('August');
  await page.locator('#p-m').selectOption('5');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-m option[value="5"]')).toHaveText('مرداد');
  await expect(page.locator('#p-m')).toHaveValue('5'); // selection preserved
});

test('persian digits typed into fields convert identically to ASCII', async ({ page }) => {
  await page.goto('/');
  await page.locator('#g-y').fill('۲۰۲۶');
  await page.locator('#g-m').selectOption('7');
  await page.locator('#g-d').fill('31');
  await expect(page.locator('#p-y')).toHaveValue('1405');
  await expect(page.locator('#p-d')).toHaveValue('9');
});

test('weekday appears for a valid date', async ({ page }) => {
  await page.goto('/');
  await enterPersianDate(page);
  await expect(page.locator('#weekday')).toHaveText('Saturday');
});

test('weekday clears and copy disables on invalid date', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1404');
  await page.locator('#p-m').selectOption('12');
  await page.locator('#p-d').fill('30'); // 1404 is not a leap year
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#weekday')).toHaveText('');
  await expect(page.locator('#btn-copy')).toBeDisabled();
});

test('valid conversion updates the URL via replaceState', async ({ page }) => {
  await page.goto('/');
  await enterPersianDate(page);
  await expect(page).toHaveURL(/\?p=1403-10-22$/);
});

test('URL param prefills both sides on load', async ({ page }) => {
  await page.goto('/?p=1403-10-22');
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-m')).toHaveValue('1');
  await expect(page.locator('#g-d')).toHaveValue('11');
  await expect(page.locator('#weekday')).toHaveText('Saturday');
});

test('invalid URL param is ignored and today is shown', async ({ page }) => {
  await page.goto('/?p=1404-13-1');
  await expect(page.locator('#converter-error')).toBeHidden();
  const now = new Date();
  await expect(page.locator('#g-y')).toHaveValue(String(now.getFullYear()));
});

test('today button resets the converter and clears the query', async ({ page }) => {
  await page.goto('/?p=1403-10-22');
  await page.locator('#btn-today').click();
  const now = new Date();
  await expect(page.locator('#g-y')).toHaveValue(String(now.getFullYear()));
  await expect(page.locator('#g-d')).toHaveValue(String(now.getDate()));
  expect(new URL(page.url()).search).toBe('');
});

test('copy button puts the full sentence on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await enterPersianDate(page);
  await page.locator('#btn-copy').click();
  await expect(page.locator('#btn-copy')).toHaveText('Copied');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  await expect(page.locator('#btn-copy')).toHaveText('Copy'); // reverts after 1.5s
});

test('today panel shows the weekday', async ({ page }) => {
  await page.goto('/');
  const now = new Date();
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  await expect(page.locator('#today-persian')).toContainText(weekday as string);
  await expect(page.locator('#today-gregorian')).toContainText(weekday as string);
});
```

- [ ] **Step 2: Run the new spec**

Run: `cd Site && npx playwright test e2e/converter-ux.spec.ts`
Expected: all PASS (Task 4 already implemented the behavior; if something fails, the *implementation* is the suspect — report it rather than bending the test).

- [ ] **Step 3: Run the full E2E suite**

Run: `cd Site && npx playwright test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add Site/e2e/converter-ux.spec.ts
git commit -m "test(site): E2E coverage for dropdowns, digits, URL state, status row"
```

---

## Task 7: README + full verification (last)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`:**

- Feature list: month-name dropdowns, weekday display, digit-tolerant input (`۱۴۰۵` = `1405`), copy-to-clipboard sentence, shareable URLs (`?p=1403-10-22`), everything above the fold on desktop.
- Update Vitest/Playwright test counts to the real numbers (run the suites and count — do not guess).
- Repo-layout tree: add `src/converter/url-state.ts` and `src/i18n/format.ts`.

- [ ] **Step 2: Full verification**

Run: `cd Site && npm test && npx tsc --noEmit && npm run build && npx playwright test`
Expected: everything green. Record the exact test counts in the README.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: converter UX features, updated test counts and layout"
```

---

## Amendments (2026-08-05, during execution)

- **Task 4 reference code amendments** (from task review findings):
  1. The copy button's `navigator.clipboard.writeText(...)` must handle rejection: on failure, swap the label to a new `copyFailed` string key (en `'Copy failed'`, fa `'کپی نشد'`, added to `strings.ts` — scope extension) using the same timed-swap pattern as `copied`.
  2. `rerender()` must itself clear any pending `copiedTimer` and restore the copy label from `STRINGS` — no reliance on `renderStatic()` call order in `main.ts`.

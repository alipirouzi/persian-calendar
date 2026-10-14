# Settings panel and copy format — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A gear button opens a settings dialog whose first group configures what the Copy button writes (default: Persian date as `yyyy-mm-dd`, Latin digits).

**Architecture:** Pure `settings-model.ts` (types, defaults, per-field validation) + `settings-store.ts` (localStorage key `settings.v1`, subscribe) + pure `copy-format.ts` (pattern tokenizer/formatter). The converter reads copy settings through a getter; a DOM-only `settings-panel.ts` drives a native `<dialog>`. `main.ts` wires the three.

**Tech Stack:** Vite 7, vanilla TypeScript (strict, `noUncheckedIndexedAccess`), Vitest 3 + jsdom (DOM tests under `tests/dom/`), Playwright, v8 coverage at a 100% threshold.

**Spec:** `docs/superpowers/specs/2026-10-14-settings-time-holidays-design.md` (section "A — Settings panel and copy format")

**Deviation from the spec, for review:** the spec says the panel is "built on `ui/popup.ts`". `popup.ts` calls `preventDefault()` on `mousedown` anywhere in its surface (`Site/src/ui/popup.ts:137-140`), which stops a click from focusing a text field or opening a `<select>` inside it, and it positions an anchored box rather than a panel of form controls. This plan uses a native modal `<dialog>` instead: it gives the focus trap, Escape and focus return the spec asks for, with no new popup machinery. jsdom 30 has no `showModal`, so the DOM tests install a two-line stand-in; Playwright covers the real element.

## Global Constraints

- All commands run from `Site/` unless stated.
- `npm test -- --coverage` must stay at **100% lines/branches/functions/statements** (`vite.config.ts` thresholds). `src/main.ts` is excluded from coverage and covered by Playwright.
- Every user-visible string goes through `STRINGS` in `src/i18n/strings.ts` with both `en` and `fa` entries (`tests/i18n.test.ts` checks key parity).
- Storage key: `settings.v1`. Unreadable/corrupt storage or an invalid field ⇒ that field's default; storage write failure ⇒ silent, in-memory for the session (same as `persistLang`).
- Copy defaults: `calendar: 'persian'`, `pattern: 'yyyy-mm-dd'`, `digits: 'latin'`.
- Presets: `yyyy-mm-dd`, `yyyy/mm/dd`, `dd.mm.yyyy`, `sentence`. Custom pattern max 64 chars; empty/whitespace-only ⇒ `yyyy-mm-dd`.
- Tokens: `yyyy`, `mm`, `m`, `dd`, `d`, `MMMM`, `dddd`; longest match wins; anything else is literal; text inside single quotes is literal (quotes removed). `both` joins Persian then Gregorian with `" / "`. `sentence` = today's `copySentence` output exactly.
- The on-screen `#full-date` line is unchanged; only the clipboard output and the Copy button's `title` change.
- No CSP change, no network, no new dependency.
- Do NOT commit unless the user asked; this plan's commit steps apply because the user asked Claude to run it. Never commit `.superpowers/`.

## Review Focus

1. A custom pattern containing ordinary words ("Today is dddd") — the `d` in "Today" would become a day number; quoting (`'Today is' dddd`) must work and the hint must say so. Test in Task 2.
2. Storage holding valid JSON of the wrong shape (`"[]"`, `"null"`, `{"copy":"x"}`) or a pattern over 64 chars — must load defaults per field, not throw. Test in Task 1.
3. Clearing the custom field while typing — the store falls back to `yyyy-mm-dd`, but the panel must not yank the select back to the preset under the user's fingers. Test in Task 4.
4. Language toggle while settings are non-default — month/weekday names in the copy output follow the UI language, digits follow the setting. Test in Task 2 and Task 5 E2E.
5. Copy with no valid date — still a no-op; preview shows `—`. Test in Task 3 and Task 4.

---

### Task 1: Settings model and store

**Files:**
- Create: `Site/src/settings/settings-model.ts`
- Create: `Site/src/settings/settings-store.ts`
- Test: `Site/tests/settings-model.test.ts`
- Test: `Site/tests/dom/settings-store.test.ts` (dom folder: needs the `localStorage` global swap used by `lang-preference.test.ts`)

**Interfaces:**
- Produces: `CopyCalendar`, `CopyDigits`, `CopySettings`, `Settings`, `SENTENCE`, `COPY_PRESETS`, `MAX_PATTERN_LENGTH`, `DEFAULT_SETTINGS`, `parseSettings(raw: unknown): Settings`; `SettingsStore { get(): Settings; update(change: (s: Settings) => Settings): void; subscribe(listener: (s: Settings) => void): () => void }`, `createSettingsStore(): SettingsStore`, `SETTINGS_STORAGE_KEY`.

- [ ] **Step 1: Write the failing model test** — `Site/tests/settings-model.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, MAX_PATTERN_LENGTH, parseSettings,
} from '../src/settings/settings-model';

describe('parseSettings', () => {
  it('defaults everything when given nothing usable', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}, { copy: 'x' }, { copy: [] }]) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps every valid field', () => {
    const raw = { copy: { calendar: 'both', pattern: 'dd.mm.yyyy', digits: 'persian' } };
    expect(parseSettings(raw)).toEqual(raw);
  });

  it('replaces only the invalid fields', () => {
    const parsed = parseSettings({ copy: { calendar: 'julian', pattern: 'yyyy', digits: 7 } });
    expect(parsed.copy).toEqual({ calendar: 'persian', pattern: 'yyyy', digits: 'latin' });
  });

  it('falls back to the default pattern when it is empty, blank, too long or not a string', () => {
    for (const pattern of ['', '   ', 'y'.repeat(MAX_PATTERN_LENGTH + 1), 5, null]) {
      expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe('yyyy-mm-dd');
    }
  });

  it('keeps a pattern exactly at the length limit, spaces included', () => {
    const pattern = ` ${'d'.repeat(MAX_PATTERN_LENGTH - 2)} `;
    expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe(pattern);
  });

  it('ignores unknown keys', () => {
    expect(parseSettings({ copy: {}, extra: 1 })).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/settings-model.test.ts`
Expected: FAIL — cannot resolve `../src/settings/settings-model`.

- [ ] **Step 3: Implement the model** — `Site/src/settings/settings-model.ts`

```ts
export type CopyCalendar = 'persian' | 'gregorian' | 'both';
export type CopyDigits = 'latin' | 'persian';

/** The pattern value that means "the full sentence", not a token pattern. */
export const SENTENCE = 'sentence';
export const COPY_PRESETS = ['yyyy-mm-dd', 'yyyy/mm/dd', 'dd.mm.yyyy', SENTENCE] as const;
export const MAX_PATTERN_LENGTH = 64;

export interface CopySettings {
  readonly calendar: CopyCalendar;
  readonly pattern: string;
  readonly digits: CopyDigits;
}

export interface Settings {
  readonly copy: CopySettings;
}

export const DEFAULT_SETTINGS: Settings = {
  copy: { calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin' },
};

const CALENDARS: readonly CopyCalendar[] = ['persian', 'gregorian', 'both'];
const DIGITS: readonly CopyDigits[] = ['latin', 'persian'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.find((candidate) => candidate === value) ?? fallback;

const parsePattern = (value: unknown): string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= MAX_PATTERN_LENGTH
    ? value
    : DEFAULT_SETTINGS.copy.pattern;

/**
 * Whatever storage hands back — another version's shape, a hand edit, garbage —
 * becomes a complete Settings. Each field is judged on its own, so one bad value
 * costs only itself.
 */
export function parseSettings(raw: unknown): Settings {
  const copy = isRecord(raw) && isRecord(raw['copy']) ? raw['copy'] : {};
  const fallback = DEFAULT_SETTINGS.copy;
  return {
    copy: {
      calendar: oneOf(copy['calendar'], CALENDARS, fallback.calendar),
      pattern: parsePattern(copy['pattern']),
      digits: oneOf(copy['digits'], DIGITS, fallback.digits),
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/settings-model.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing store test** — `Site/tests/dom/settings-store.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings/settings-model';
import { createSettingsStore, SETTINGS_STORAGE_KEY } from '../../src/settings/settings-store';

/** Same approach as lang-preference.test.ts: the module reads the bare global. */
const useStorage = (storage: Partial<Storage> | undefined): void => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
};

const memoryStorage = (seed: Record<string, string> = {}): Partial<Storage> & {
  entries: Map<string, string>;
} => {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
};

const denyingStorage = (): Partial<Storage> => ({
  getItem: () => { throw new DOMException('denied'); },
  setItem: () => { throw new DOMException('quota'); },
});

afterEach(() => { useStorage(undefined); });

describe('createSettingsStore', () => {
  it('starts from defaults when nothing is stored', () => {
    useStorage(memoryStorage());
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('loads what was stored, validated', () => {
    useStorage(memoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ copy: { calendar: 'both', digits: 'nope' } }),
    }));
    expect(createSettingsStore().get().copy).toEqual({
      calendar: 'both', pattern: 'yyyy-mm-dd', digits: 'latin',
    });
  });

  it('starts from defaults when the stored value is not JSON', () => {
    useStorage(memoryStorage({ [SETTINGS_STORAGE_KEY]: '{oops' }));
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('starts from defaults when storage is unreadable', () => {
    useStorage(denyingStorage());
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists, validates and announces an update', () => {
    const storage = memoryStorage();
    useStorage(storage);
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((s) => ({ copy: { ...s.copy, calendar: 'gregorian', pattern: '' } }));

    const expected = { copy: { calendar: 'gregorian', pattern: 'yyyy-mm-dd', digits: 'latin' } };
    expect(store.get()).toEqual(expected);
    expect(listener).toHaveBeenCalledWith(expected);
    expect(JSON.parse(storage.entries.get(SETTINGS_STORAGE_KEY) as string)).toEqual(expected);
  });

  it('keeps the update for the session when storage refuses the write', () => {
    useStorage(denyingStorage());
    const store = createSettingsStore();

    expect(() => store.update((s) => ({ copy: { ...s.copy, digits: 'persian' } }))).not.toThrow();
    expect(store.get().copy.digits).toBe('persian');
  });

  it('stops announcing after unsubscribe', () => {
    useStorage(memoryStorage());
    const store = createSettingsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update((s) => s);

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/dom/settings-store.test.ts`
Expected: FAIL — cannot resolve `settings-store`.

- [ ] **Step 7: Implement the store** — `Site/src/settings/settings-store.ts`

```ts
import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings-model';

export const SETTINGS_STORAGE_KEY = 'settings.v1';

export interface SettingsStore {
  get(): Settings;
  /** Validated before it is kept, so a caller cannot store an invalid value. */
  update(change: (current: Settings) => Settings): void;
  /** Returns the unsubscribe function. */
  subscribe(listener: (settings: Settings) => void): () => void;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return parseSettings(raw === null ? null : JSON.parse(raw));
  } catch {
    // Private mode or a value that is not JSON: start clean rather than fail.
    return DEFAULT_SETTINGS;
  }
}

function save(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* private mode or quota — session-only */ }
}

export function createSettingsStore(): SettingsStore {
  let current = load();
  const listeners = new Set<(settings: Settings) => void>();
  return {
    get: () => current,
    update(change) {
      current = parseSettings(change(current));
      save(current);
      for (const listener of listeners) listener(current);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

- [ ] **Step 8: Run both tests to verify they pass**

Run: `npx vitest run tests/settings-model.test.ts tests/dom/settings-store.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 9: Commit**

```bash
git add src/settings tests/settings-model.test.ts tests/dom/settings-store.test.ts
git commit -m "feat(site): settings model and persisted store"
```

---

### Task 2: Copy pattern formatter

**Files:**
- Create: `Site/src/copy/copy-format.ts`
- Modify: `Site/src/i18n/strings.ts` (add the `patternSentence` key only; Task 4 adds the rest)
- Test: `Site/tests/copy-format.test.ts`

**Interfaces:**
- Consumes: `CopySettings`, `SENTENCE` (Task 1); `copySentence`, `weekdayName` (`src/i18n/format.ts`); `PERSIAN_MONTHS`, `GREGORIAN_MONTHS`, `STRINGS`, `toLocaleDigits`, `Lang` (`src/i18n/strings.ts`).
- Produces: `formatCopy(p: PersianDateParts, g: GregorianDateParts, copy: CopySettings, lang: Lang): string`; `patternLabel(copy: CopySettings, lang: Lang): string`; `tokenize(pattern: string): Token[]`.

- [ ] **Step 1: Write the failing test** — `Site/tests/copy-format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { formatCopy, patternLabel, tokenize } from '../src/copy/copy-format';
import type { CopySettings } from '../src/settings/settings-model';

// 1403-10-22 AP ↔ 2025-01-11 CE, a Saturday; single-digit Gregorian month.
const P = { py: 1403, pm: 10, pd: 22 };
const G = { gy: 2025, gm: 1, gd: 11 };

const copy = (over: Partial<CopySettings> = {}): CopySettings => ({
  calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin', ...over,
});

describe('tokenize', () => {
  it('takes the longest token and leaves everything else literal', () => {
    expect(tokenize('yyyy-mm-dd')).toEqual([
      { kind: 'field', field: 'yyyy' }, { kind: 'literal', text: '-' },
      { kind: 'field', field: 'mm' }, { kind: 'literal', text: '-' },
      { kind: 'field', field: 'dd' },
    ]);
    expect(tokenize('MMMM dddd')).toEqual([
      { kind: 'field', field: 'MMMM' }, { kind: 'literal', text: ' ' },
      { kind: 'field', field: 'dddd' },
    ]);
  });

  it('treats quoted text as literal and drops the quotes', () => {
    expect(tokenize("'Today is' d")).toEqual([
      { kind: 'literal', text: 'Today is ' }, { kind: 'field', field: 'd' },
    ]);
  });

  it('runs an unterminated quote to the end of the pattern', () => {
    expect(tokenize("d 'dd")).toEqual([
      { kind: 'field', field: 'd' }, { kind: 'literal', text: ' dd' },
    ]);
  });

  it('leaves partial tokens and other letters literal', () => {
    expect(tokenize('yy MM x')).toEqual([{ kind: 'literal', text: 'yy MM x' }]);
  });
});

describe('formatCopy', () => {
  it('defaults to the Persian date as yyyy-mm-dd', () => {
    expect(formatCopy(P, G, copy(), 'en')).toBe('1403-10-22');
  });

  it('formats the Gregorian date with zero padding', () => {
    expect(formatCopy(P, G, copy({ calendar: 'gregorian' }), 'en')).toBe('2025-01-11');
    expect(formatCopy(P, G, copy({ calendar: 'gregorian', pattern: 'd.m.yyyy' }), 'en'))
      .toBe('11.1.2025');
  });

  it('joins both calendars, Persian first', () => {
    expect(formatCopy(P, G, copy({ calendar: 'both', pattern: 'yyyy/mm/dd' }), 'en'))
      .toBe('1403/10/22 / 2025/01/11');
  });

  it('writes Persian-Indic digits when asked, in either UI language', () => {
    expect(formatCopy(P, G, copy({ digits: 'persian' }), 'en')).toBe('۱۴۰۳-۱۰-۲۲');
    expect(formatCopy(P, G, copy({ digits: 'latin' }), 'fa')).toBe('1403-10-22');
  });

  it('names the month and weekday in the UI language', () => {
    const named = copy({ pattern: 'dddd d MMMM yyyy' });
    expect(formatCopy(P, G, named, 'en')).toBe('Saturday 22 Dey 1403');
    expect(formatCopy(P, G, { ...named, calendar: 'gregorian' }, 'fa'))
      .toBe('شنبه 11 ژانویه 2025');
  });

  it('keeps quoted words intact', () => {
    expect(formatCopy(P, G, copy({ pattern: "'Today is' dddd" }), 'en'))
      .toBe('Today is Saturday');
  });

  it('reproduces the full sentence for the sentence preset', () => {
    expect(formatCopy(P, G, copy({ pattern: 'sentence', calendar: 'gregorian' }), 'en'))
      .toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  });
});

describe('patternLabel', () => {
  it('shows the pattern, or the localized name of the sentence preset', () => {
    expect(patternLabel(copy(), 'en')).toBe('yyyy-mm-dd');
    expect(patternLabel(copy({ pattern: 'sentence' }), 'en')).toBe('Full sentence');
    expect(patternLabel(copy({ pattern: 'sentence' }), 'fa')).toBe('جمله کامل');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/copy-format.test.ts`
Expected: FAIL — cannot resolve `../src/copy/copy-format`.

- [ ] **Step 3: Add the `patternSentence` string** — in `Site/src/i18n/strings.ts` extend `StringKey` with `| 'patternSentence'`, add `patternSentence: 'Full sentence',` to `en` and `patternSentence: 'جمله کامل',` to `fa`.

- [ ] **Step 4: Implement the formatter** — `Site/src/copy/copy-format.ts`

```ts
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import { copySentence, weekdayName } from '../i18n/format';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import { SENTENCE, type CopyDigits, type CopySettings } from '../settings/settings-model';

type Field = 'yyyy' | 'MMMM' | 'dddd' | 'mm' | 'dd' | 'm' | 'd';
export type Token = { kind: 'literal'; text: string } | { kind: 'field'; field: Field };

/** Longest first, so `mm` is never read as two `m`s. */
const FIELDS: readonly Field[] = ['yyyy', 'MMMM', 'dddd', 'mm', 'dd', 'm', 'd'];
const QUOTE = "'";

export function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  let literal = '';
  const flush = (): void => {
    if (literal !== '') tokens.push({ kind: 'literal', text: literal });
    literal = '';
  };
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === QUOTE) {
      // Quoted text is copied as typed; an unterminated quote runs to the end.
      const close = pattern.indexOf(QUOTE, i + 1);
      const end = close === -1 ? pattern.length : close;
      literal += pattern.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    const field = FIELDS.find((candidate) => pattern.startsWith(candidate, i));
    if (field === undefined) {
      literal += pattern.charAt(i);
      i += 1;
      continue;
    }
    flush();
    tokens.push({ kind: 'field', field });
    i += field.length;
  }
  flush();
  return tokens;
}

interface DateFields { year: number; month: number; day: number; monthName: string; weekday: string }

function render(tokens: readonly Token[], date: DateFields, digits: CopyDigits): string {
  const number = (value: number, width: number): string =>
    toLocaleDigits(String(value).padStart(width, '0'), digits === 'persian' ? 'fa' : 'en');
  const fields: Record<Field, () => string> = {
    yyyy: () => number(date.year, 4),
    mm: () => number(date.month, 2),
    m: () => number(date.month, 1),
    dd: () => number(date.day, 2),
    d: () => number(date.day, 1),
    MMMM: () => date.monthName,
    dddd: () => date.weekday,
  };
  return tokens.map((t) => (t.kind === 'literal' ? t.text : fields[t.field]())).join('');
}

/** What the Copy button writes for this date under these settings. */
export function formatCopy(
  p: PersianDateParts, g: GregorianDateParts, copy: CopySettings, lang: Lang,
): string {
  if (copy.pattern === SENTENCE) return copySentence(p, g, lang);
  const tokens = tokenize(copy.pattern);
  const weekday = weekdayName(g, lang);
  const persian = render(tokens, {
    year: p.py, month: p.pm, day: p.pd, monthName: PERSIAN_MONTHS[lang][p.pm - 1] as string, weekday,
  }, copy.digits);
  const gregorian = render(tokens, {
    year: g.gy, month: g.gm, day: g.gd, monthName: GREGORIAN_MONTHS[lang][g.gm - 1] as string, weekday,
  }, copy.digits);
  if (copy.calendar === 'persian') return persian;
  if (copy.calendar === 'gregorian') return gregorian;
  return `${persian} / ${gregorian}`;
}

/** Short description of the active format, for the Copy button's tooltip. */
export function patternLabel(copy: CopySettings, lang: Lang): string {
  return copy.pattern === SENTENCE ? STRINGS[lang].patternSentence : copy.pattern;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/copy-format.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/copy src/i18n/strings.ts tests/copy-format.test.ts
git commit -m "feat(site): copy pattern tokenizer and formatter"
```

---

### Task 3: Converter copies with the configured format

**Files:**
- Modify: `Site/src/converter/converter.ts` (signature, copy click handler at ~line 290, `rerender`, return value)
- Modify: `Site/src/main.ts` (temporary: pass `() => DEFAULT_SETTINGS.copy` so the build stays green until Task 5)
- Test: `Site/tests/dom/converter.test.ts`

**Interfaces:**
- Consumes: `formatCopy`, `patternLabel` (Task 2); `CopySettings`, `DEFAULT_SETTINGS` (Task 1).
- Produces: `setupConverter(getLang: () => Lang, getCopy: () => CopySettings)` returning `{ prefill, rerender, current: () => { p: PersianDateParts; g: GregorianDateParts } | null }`. `rerender()` also refreshes `#btn-copy`'s `title`.

- [ ] **Step 1: Update the converter DOM tests (failing).** In `Site/tests/dom/converter.test.ts`:

  - Add imports: `import type { CopySettings } from '../../src/settings/settings-model';` and `import { DEFAULT_SETTINGS } from '../../src/settings/settings-model';`
  - Add `let copySettings: CopySettings;` beside `let lang: Lang;`; in `beforeEach` set `copySettings = DEFAULT_SETTINGS.copy;` and change setup to `converter = setupConverter(() => lang, () => copySettings);`.
  - Change the one other call, `setupConverter(() => 'en')` in the "refuses to run against a page missing its markup" test, to `setupConverter(() => 'en', () => DEFAULT_SETTINGS.copy)`.
  - **Intentional expectation change (behaviour changed by the spec, not to make code pass):** in `'copies the sentence and says so, then goes back to Copy'`, rename it to `'copies in the configured format and says so, then goes back to Copy'` and change the expectation to `expect(writeText).toHaveBeenCalledWith('1403-10-22');`.
  - Add to `describe('Today and Copy', …)`:

```ts
  it('copies the full sentence when that is the configured format', async () => {
    copySettings = { ...DEFAULT_SETTINGS.copy, pattern: 'sentence' };
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    clickOn(byId('btn-copy'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());

    expect(writeText).toHaveBeenCalledWith('Saturday, 22 Dey 1403 — January 11, 2025');
  });

  it('reads the settings at click time, not at setup', async () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });
    copySettings = { calendar: 'gregorian', pattern: 'dd.mm.yyyy', digits: 'latin' };

    clickOn(byId('btn-copy'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());

    expect(writeText).toHaveBeenCalledWith('11.01.2025');
  });

  it('names the active format in the Copy tooltip and refreshes it on rerender', () => {
    expect(byId('btn-copy').title).toBe('yyyy-mm-dd');
    copySettings = { ...DEFAULT_SETTINGS.copy, pattern: 'sentence' };
    lang = 'fa';

    converter.rerender();

    expect(byId('btn-copy').title).toBe('جمله کامل');
  });

  it('exposes the current valid date, and null when there is none', () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });
    expect(converter.current()).toEqual({
      p: { py: 1403, pm: 10, pd: 22 }, g: { gy: 2025, gm: 1, gd: 11 },
    });

    typeInto('p-m', '13');

    expect(converter.current()).toBeNull();
  });
```

  (Check the existing `'does nothing without a valid date to copy'` test still passes unchanged — Review Focus 5.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/dom/converter.test.ts`
Expected: FAIL — `'1403-10-22'` vs sentence, `title` empty, `converter.current is not a function`.

- [ ] **Step 3: Implement in `Site/src/converter/converter.ts`**

  - Imports: replace `import { copySentence } from '../i18n/format';` with
    `import { formatCopy, patternLabel } from '../copy/copy-format';` and add
    `import type { CopySettings } from '../settings/settings-model';`.
  - Signature:

```ts
export function setupConverter(getLang: () => Lang, getCopy: () => CopySettings): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
  /** The last valid date on screen, or null while the input is invalid. */
  current: () => { p: PersianDateParts; g: GregorianDateParts } | null;
} {
```

  - Copy click handler:

```ts
  btnCopy.addEventListener('click', () => {
    if (lastOk === null) return;
    navigator.clipboard.writeText(formatCopy(lastOk.p, lastOk.g, getCopy(), getLang()))
      .then(() => flashCopyLabel('copied'))
      .catch(() => flashCopyLabel('copyFailed'));
  });
```

  - Add near the copy handler, and call it once right after it is defined:

```ts
  const renderCopyTitle = (): void => {
    btnCopy.title = patternLabel(getCopy(), getLang());
  };
  renderCopyTitle();
```

  - In the returned `rerender`, after `btnCopy.textContent = STRINGS[getLang()].copy;` add `renderCopyTitle();`.
  - Add `current: () => lastOk,` to the returned object.
  - Confirm `lastOk` is set to `null` on an invalid input (it already is — that is what disables Copy); the `current()` test pins it.

- [ ] **Step 4: Keep `main.ts` compiling.** In `Site/src/main.ts` add `import { DEFAULT_SETTINGS } from './settings/settings-model';` and change `setupConverter(() => lang)` to `setupConverter(() => lang, () => DEFAULT_SETTINGS.copy)`. (Task 5 replaces this with the store.)

- [ ] **Step 5: Run the whole unit suite with coverage**

Run: `npm test -- --coverage`
Expected: all pass, coverage 100% on all four metrics. If `copySentence` is now only used by `copy-format.ts`, it is still covered by `tests/format.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/converter/converter.ts src/main.ts tests/dom/converter.test.ts
git commit -m "feat(site): copy uses the configured format; tooltip names it"
```

---

### Task 4: Settings dialog

**Files:**
- Modify: `Site/index.html` (gear button after `#lang-toggle`; `<dialog>` before `</main>`)
- Modify: `Site/src/i18n/strings.ts` (new keys)
- Modify: `Site/src/styles/components.css` (gear + dialog styles)
- Create: `Site/src/settings/settings-panel.ts`
- Test: `Site/tests/dom/settings-panel.test.ts`

**Interfaces:**
- Consumes: `SettingsStore` (Task 1); `COPY_PRESETS`, `CopySettings` (Task 1); `formatCopy` (Task 2); `converter.current` shape (Task 3).
- Produces: `setupSettingsPanel(deps: { store: SettingsStore; getLang: () => Lang; getDate: () => { p: PersianDateParts; g: GregorianDateParts } | null }): { rerender(): void }`.

- [ ] **Step 1: Add the strings** — in `Site/src/i18n/strings.ts` extend `StringKey` with
`| 'settings' | 'close' | 'copySection' | 'copyCalendar' | 'calPersian' | 'calGregorian' | 'calBoth' | 'copyPattern' | 'patternCustom' | 'patternCustomLabel' | 'patternHint' | 'copyDigits' | 'digitsLatin' | 'digitsPersian' | 'copyPreview'` and add:

```ts
// en
    settings: 'Settings',
    close: 'Close',
    copySection: 'Copy format',
    copyCalendar: 'Calendar',
    calPersian: 'Persian',
    calGregorian: 'Gregorian',
    calBoth: 'Both',
    copyPattern: 'Format',
    patternCustom: 'Custom…',
    patternCustomLabel: 'Custom format',
    patternHint: "yyyy year · mm / m month · dd / d day · MMMM month name · dddd weekday · 'text' as typed",
    copyDigits: 'Digits',
    digitsLatin: 'Latin (0–9)',
    digitsPersian: 'Persian (۰–۹)',
    copyPreview: 'Copies as',
// fa
    settings: 'تنظیمات',
    close: 'بستن',
    copySection: 'قالب کپی',
    copyCalendar: 'تقویم',
    calPersian: 'شمسی',
    calGregorian: 'میلادی',
    calBoth: 'هر دو',
    copyPattern: 'قالب',
    patternCustom: 'دلخواه…',
    patternCustomLabel: 'قالب دلخواه',
    patternHint: "yyyy سال · mm / m ماه · dd / d روز · MMMM نام ماه · dddd نام روز · 'متن' بدون تغییر",
    copyDigits: 'ارقام',
    digitsLatin: 'لاتین (0–9)',
    digitsPersian: 'فارسی (۰–۹)',
    copyPreview: 'کپی به صورت',
```

- [ ] **Step 2: Add the markup** — in `Site/index.html`, directly after the `#lang-toggle` button:

```html
  <!-- The glyph is decorative; the accessible name is set from STRINGS.settings. -->
  <button id="settings-toggle" type="button" aria-haspopup="dialog"
          aria-controls="settings-dialog"><span aria-hidden="true">⚙︎</span></button>
```

and directly before `</main>`:

```html
    <dialog id="settings-dialog" aria-labelledby="settings-title">
      <div class="settings-head">
        <h2 id="settings-title" data-str="settings"></h2>
        <button id="settings-close" type="button" data-str="close"></button>
      </div>
      <fieldset class="settings-group">
        <legend data-str="copySection"></legend>
        <label for="set-copy-calendar" data-str="copyCalendar"></label>
        <select id="set-copy-calendar">
          <option value="persian" data-str="calPersian"></option>
          <option value="gregorian" data-str="calGregorian"></option>
          <option value="both" data-str="calBoth"></option>
        </select>
        <label for="set-copy-pattern" data-str="copyPattern"></label>
        <select id="set-copy-pattern">
          <option value="yyyy-mm-dd">yyyy-mm-dd</option>
          <option value="yyyy/mm/dd">yyyy/mm/dd</option>
          <option value="dd.mm.yyyy">dd.mm.yyyy</option>
          <option value="sentence" data-str="patternSentence"></option>
          <option value="custom" data-str="patternCustom"></option>
        </select>
        <div id="set-copy-custom-row" class="settings-custom" hidden>
          <label for="set-copy-custom" data-str="patternCustomLabel"></label>
          <input id="set-copy-custom" type="text" maxlength="64" dir="ltr"
                 autocomplete="off" spellcheck="false" aria-describedby="set-copy-hint" />
          <p id="set-copy-hint" class="settings-hint" data-str="patternHint"></p>
        </div>
        <label for="set-copy-digits" data-str="copyDigits"></label>
        <select id="set-copy-digits">
          <option value="latin" data-str="digitsLatin"></option>
          <option value="persian" data-str="digitsPersian"></option>
        </select>
        <p class="settings-preview"><span data-str="copyPreview"></span>
          <output id="set-copy-preview" for="set-copy-calendar set-copy-pattern set-copy-custom set-copy-digits"></output></p>
      </fieldset>
    </dialog>
```

(`renderStatic` in `main.ts` already fills every `[data-str]`, including `<option>`s.)

- [ ] **Step 3: Write the failing panel test** — `Site/tests/dom/settings-panel.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import { setupSettingsPanel } from '../../src/settings/settings-panel';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import type { Lang } from '../../src/i18n/strings';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const DATE = { p: { py: 1403, pm: 10, pd: 22 }, g: { gy: 2025, gm: 1, gd: 11 } };

let lang: Lang;
let date: typeof DATE | null;
let store: SettingsStore;
let panel: ReturnType<typeof setupSettingsPanel>;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const dialog = (): HTMLDialogElement => byId<HTMLDialogElement>('settings-dialog');
const preview = (): string => byId('set-copy-preview').textContent ?? '';

const choose = (id: string, value: string): void => {
  const select = byId<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const typeCustom = (value: string): void => {
  const input = byId<HTMLInputElement>('set-copy-custom');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeEach(() => {
  // jsdom 30 has no modal dialog; Playwright covers the real one.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  date = DATE;
  store = createSettingsStore();
  panel = setupSettingsPanel({ store, getLang: () => lang, getDate: () => date });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('settings panel', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupSettingsPanel({ store, getLang: () => 'en', getDate: () => null }))
      .toThrow(/Missing element #settings-toggle/);
  });

  it('gives the gear an accessible name in the current language', () => {
    expect(byId('settings-toggle').getAttribute('aria-label')).toBe('Settings');
    lang = 'fa';
    panel.rerender();
    expect(byId('settings-toggle').getAttribute('aria-label')).toBe('تنظیمات');
  });

  it('opens on the gear showing the stored settings and a preview', () => {
    store.update(() => ({ copy: { calendar: 'gregorian', pattern: 'dd.mm.yyyy', digits: 'persian' } }));

    clickOn(byId('settings-toggle'));

    expect(dialog().open).toBe(true);
    expect(byId<HTMLSelectElement>('set-copy-calendar').value).toBe('gregorian');
    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('dd.mm.yyyy');
    expect(byId<HTMLSelectElement>('set-copy-digits').value).toBe('persian');
    expect(byId('set-copy-custom-row').hidden).toBe(true);
    expect(preview()).toBe('۱۱.۰۱.۲۰۲۵');
  });

  it('shows a stored custom pattern in the custom field', () => {
    store.update((s) => ({ copy: { ...s.copy, pattern: 'yyyy.m.d' } }));

    clickOn(byId('settings-toggle'));

    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);
    expect(byId<HTMLInputElement>('set-copy-custom').value).toBe('yyyy.m.d');
  });

  it('stores each change and updates the preview', () => {
    clickOn(byId('settings-toggle'));

    choose('set-copy-calendar', 'both');
    expect(store.get().copy.calendar).toBe('both');
    expect(preview()).toBe('1403-10-22 / 2025-01-11');

    choose('set-copy-digits', 'persian');
    expect(store.get().copy.digits).toBe('persian');

    choose('set-copy-pattern', 'sentence');
    expect(store.get().copy.pattern).toBe('sentence');
    expect(preview()).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  });

  it('switches to a custom pattern and stores what is typed', () => {
    clickOn(byId('settings-toggle'));

    choose('set-copy-pattern', 'custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);
    expect(document.activeElement).toBe(byId('set-copy-custom'));

    typeCustom("'Day' d");
    expect(store.get().copy.pattern).toBe("'Day' d");
    expect(preview()).toBe('Day 22');
  });

  it('reuses a custom pattern already typed when Custom is chosen again', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');
    typeCustom('d/m');
    choose('set-copy-pattern', 'yyyy-mm-dd');
    expect(byId('set-copy-custom-row').hidden).toBe(true);

    choose('set-copy-pattern', 'custom');

    expect(store.get().copy.pattern).toBe('d/m');
  });

  it('keeps Custom selected while the custom field is cleared', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');
    typeCustom('d');

    typeCustom('');

    expect(store.get().copy.pattern).toBe('yyyy-mm-dd');
    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);
  });

  it('previews a dash when there is no valid date', () => {
    date = null;
    clickOn(byId('settings-toggle'));
    expect(preview()).toBe('—');
  });

  it('closes on the close button and on a backdrop click, not on a click inside', () => {
    clickOn(byId('settings-toggle'));
    clickOn(byId('set-copy-calendar'));
    expect(dialog().open).toBe(true);

    clickOn(dialog());
    expect(dialog().open).toBe(false);

    clickOn(byId('settings-toggle'));
    clickOn(byId('settings-close'));
    expect(dialog().open).toBe(false);
  });

  it('refreshes the preview language on rerender', () => {
    store.update((s) => ({ copy: { ...s.copy, pattern: 'MMMM' } }));
    clickOn(byId('settings-toggle'));
    expect(preview()).toBe('Dey');

    lang = 'fa';
    panel.rerender();

    expect(preview()).toBe('دی');
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run tests/dom/settings-panel.test.ts`
Expected: FAIL — cannot resolve `settings-panel`.

- [ ] **Step 5: Implement** — `Site/src/settings/settings-panel.ts`

```ts
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import { formatCopy } from '../copy/copy-format';
import { STRINGS, type Lang } from '../i18n/strings';
import { COPY_PRESETS, type CopyCalendar, type CopyDigits } from './settings-model';
import type { SettingsStore } from './settings-store';

const CUSTOM = 'custom';
const NO_DATE = '—';

interface Deps {
  store: SettingsStore;
  getLang: () => Lang;
  getDate: () => { p: PersianDateParts; g: GregorianDateParts } | null;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const isPreset = (pattern: string): boolean =>
  (COPY_PRESETS as readonly string[]).includes(pattern);

export function setupSettingsPanel({ store, getLang, getDate }: Deps): { rerender: () => void } {
  const toggle = byId<HTMLButtonElement>('settings-toggle');
  const dialog = byId<HTMLDialogElement>('settings-dialog');
  const closeButton = byId<HTMLButtonElement>('settings-close');
  const calendar = byId<HTMLSelectElement>('set-copy-calendar');
  const pattern = byId<HTMLSelectElement>('set-copy-pattern');
  const customRow = byId<HTMLElement>('set-copy-custom-row');
  const custom = byId<HTMLInputElement>('set-copy-custom');
  const digits = byId<HTMLSelectElement>('set-copy-digits');
  const preview = byId<HTMLOutputElement>('set-copy-preview');

  const renderPreview = (): void => {
    const date = getDate();
    preview.textContent = date === null
      ? NO_DATE
      : formatCopy(date.p, date.g, store.get().copy, getLang());
  };

  /** Controls follow the store only on open: while editing, the user owns them. */
  const syncControls = (): void => {
    const copy = store.get().copy;
    calendar.value = copy.calendar;
    digits.value = copy.digits;
    const preset = isPreset(copy.pattern);
    pattern.value = preset ? copy.pattern : CUSTOM;
    if (!preset) custom.value = copy.pattern;
    customRow.hidden = preset;
  };

  const setPattern = (value: string): void => {
    store.update((s) => ({ copy: { ...s.copy, pattern: value } }));
  };

  toggle.addEventListener('click', () => {
    syncControls();
    renderPreview();
    dialog.showModal();
  });
  closeButton.addEventListener('click', () => { dialog.close(); });
  // A click that lands on the dialog element itself is on the backdrop: the
  // content is all inside child elements.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  calendar.addEventListener('change', () => {
    store.update((s) => ({ copy: { ...s.copy, calendar: calendar.value as CopyCalendar } }));
  });
  digits.addEventListener('change', () => {
    store.update((s) => ({ copy: { ...s.copy, digits: digits.value as CopyDigits } }));
  });
  pattern.addEventListener('change', () => {
    const isCustom = pattern.value === CUSTOM;
    customRow.hidden = !isCustom;
    if (!isCustom) {
      setPattern(pattern.value);
      return;
    }
    custom.focus();
    // An empty field stores nothing new; the parser would only turn it into the default.
    if (custom.value !== '') setPattern(custom.value);
  });
  custom.addEventListener('input', () => { setPattern(custom.value); });

  store.subscribe(renderPreview);

  const rerender = (): void => {
    const label = STRINGS[getLang()].settings;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    renderPreview();
  };
  rerender();
  return { rerender };
}
```

(`parseSettings` validates `calendar`/`digits`, so the casts cannot store an unknown value.)

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run tests/dom/settings-panel.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 7: Style** — append to `Site/src/styles/components.css`:

```css
/* Settings: a second pill beside the language toggle, same geometry. */
#settings-toggle {
  position: fixed;
  inset-block-start: max(1rem, env(safe-area-inset-top));
  inset-inline-start: max(1.25rem, env(safe-area-inset-left));
  background: none; border: 1px solid var(--hairline); color: var(--text-muted);
  font-size: 1rem; line-height: 1; padding: 0.35rem 0.6rem;
  border-radius: 999px; cursor: pointer;
  transition: color var(--duration) var(--ease), border-color var(--duration) var(--ease);
}
#settings-toggle:hover { color: var(--accent); border-color: var(--accent); }
#settings-toggle::after { content: ''; position: absolute; inset: -10px; }

#settings-dialog {
  inline-size: min(26rem, calc(100vw - 2rem));
  border: 1px solid var(--hairline); border-radius: 12px;
  background: var(--surface-raised); color: var(--text);
  padding: 1.25rem 1.25rem 1.5rem;
  font-family: var(--font-ui);
}
#settings-dialog::backdrop { background: oklch(0% 0 0 / 0.35); }
.settings-head { display: flex; justify-content: space-between; align-items: center; margin-block-end: 1rem; }
.settings-head h2 { font-size: 1.05rem; font-weight: 600; margin: 0; }
#settings-close {
  background: none; border: 1px solid var(--hairline); color: var(--text-muted);
  border-radius: 999px; padding: 0.25rem 0.8rem; cursor: pointer; font: inherit; font-size: 0.85rem;
}
.settings-group { display: grid; grid-template-columns: auto 1fr; gap: 0.6rem 0.9rem; align-items: center; }
.settings-group legend { grid-column: 1 / -1; }
.settings-group select, .settings-group input {
  font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--hairline); border-radius: 6px; padding: 0.35rem 0.5rem; min-inline-size: 0;
}
.settings-group select:focus-visible, .settings-group input:focus-visible,
#settings-close:focus-visible, #settings-toggle:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.settings-custom { grid-column: 1 / -1; display: grid; grid-template-columns: auto 1fr; gap: 0.4rem 0.9rem; align-items: center; }
.settings-custom[hidden] { display: none; }
.settings-hint { grid-column: 1 / -1; margin: 0; font-size: 0.78rem; color: var(--text-muted); }
.settings-preview { grid-column: 1 / -1; margin: 0.4rem 0 0; color: var(--text-muted); font-size: 0.9rem; }
#set-copy-preview { color: var(--text); font-weight: 600; margin-inline-start: 0.4rem; unicode-bidi: isolate; }
```

- [ ] **Step 8: Run the whole unit suite with coverage**

Run: `npm test -- --coverage`
Expected: all pass; 100% on all four metrics.

- [ ] **Step 9: Commit**

```bash
git add index.html src/settings/settings-panel.ts src/i18n/strings.ts src/styles/components.css tests/dom/settings-panel.test.ts
git commit -m "feat(site): settings dialog with the copy format group"
```

---

### Task 5: Wire it up, end-to-end tests, docs

**Files:**
- Modify: `Site/src/main.ts`
- Modify: `Site/e2e/converter-ux.spec.ts` (copy test at ~line 84)
- Create: `Site/e2e/settings.spec.ts`
- Modify: `README.md` (features, "Full date line" bullet, repo layout, test counts)

**Interfaces:**
- Consumes: `createSettingsStore` (Task 1), `setupSettingsPanel` (Task 4), `setupConverter(getLang, getCopy)` and `converter.current` (Task 3).

- [ ] **Step 1: Wire `main.ts`.** Replace the temporary `DEFAULT_SETTINGS` import from Task 3 with:

```ts
import { createSettingsStore } from './settings/settings-store';
import { setupSettingsPanel } from './settings/settings-panel';
```

  and change the setup block to:

```ts
const settings = createSettingsStore();
const converter = setupConverter(() => lang, () => settings.get().copy);
const settingsPanel = setupSettingsPanel({
  store: settings, getLang: () => lang, getDate: () => converter.current(),
});
// The Copy tooltip names the active format; keep it in step with the settings.
settings.subscribe(() => { converter.rerender(); });
```

  and in `renderAll` add `settingsPanel.rerender();` after `converterRerender();` (pass it in or call it directly — `renderAll` is module-local, so call `settingsPanel.rerender()` directly; declare `settingsPanel` before `renderAll` is first invoked, which it already is since `renderAll` only runs from the language toggle).

- [ ] **Step 2: Update the existing copy E2E (intentional, behaviour changed by the spec).** In `Site/e2e/converter-ux.spec.ts` rename `'copy button puts the full sentence on the clipboard'` to `'copy button writes the default yyyy-mm-dd Persian date'` and change the expectation to `expect(clipboard).toBe('1403-10-22');`.

- [ ] **Step 3: Write the E2E spec** — `Site/e2e/settings.spec.ts`

```ts
import { expect, test, type Page } from '@playwright/test';

const enter = async (page: Page): Promise<void> => {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#g-d')).toHaveValue('11');
};

const copyAndRead = async (page: Page): Promise<string> => {
  await page.locator('#btn-copy').click();
  await expect(page.locator('#btn-copy')).toHaveText(/Copied|کپی شد/);
  return page.evaluate(() => navigator.clipboard.readText());
};

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('gear opens a modal settings dialog; Escape closes it and returns focus', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Settings' });
  await gear.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
});

test('changing the format changes what Copy writes, and survives a reload', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-calendar').selectOption('both');
  await page.locator('#set-copy-pattern').selectOption('dd.mm.yyyy');
  await expect(page.locator('#set-copy-preview')).toHaveText('22.10.1403 / 11.01.2025');
  await page.locator('#settings-close').click();

  expect(await copyAndRead(page)).toBe('22.10.1403 / 11.01.2025');
  await expect(page.locator('#btn-copy')).toHaveAttribute('title', 'dd.mm.yyyy');

  await page.reload();
  await enter(page);
  expect(await copyAndRead(page)).toBe('22.10.1403 / 11.01.2025');
});

test('a custom format with quoted words and Persian digits', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-pattern').selectOption('custom');
  await expect(page.locator('#set-copy-custom')).toBeFocused();
  await page.locator('#set-copy-custom').fill("'Today is' dddd d MMMM");
  await page.locator('#set-copy-digits').selectOption('persian');
  await expect(page.locator('#set-copy-preview')).toHaveText('Today is Saturday ۲۲ Dey');
  await page.keyboard.press('Escape');

  expect(await copyAndRead(page)).toBe('Today is Saturday ۲۲ Dey');
});

test('names follow the UI language; the dialog is translated and RTL', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-pattern').selectOption('custom');
  await page.locator('#set-copy-custom').fill('MMMM');
  await page.locator('#settings-close').click();
  await page.locator('#lang-toggle').click();

  await page.getByRole('button', { name: 'تنظیمات' }).click();
  await expect(page.getByRole('dialog', { name: 'تنظیمات' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#set-copy-preview')).toHaveText('دی');
  await page.locator('#settings-close').click();
  expect(await copyAndRead(page)).toBe('دی');
});

test('a corrupt stored value falls back to the default format', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('settings.v1', '{oops'));
  await page.reload();
  await enter(page);
  expect(await copyAndRead(page)).toBe('1403-10-22');
});
```

- [ ] **Step 4: Build and run everything**

Run: `npm run build && npm test -- --coverage && npm run e2e`
Expected: build OK; Vitest all pass at 100%; Playwright all pass. Record the actual counts for the README.

- [ ] **Step 5: Drive the real app** (evidence, not just tests): `npm run preview`, open `http://localhost:4173` in Chrome (claude-in-chrome), open Settings in EN and FA, change each control, copy, and screenshot the dialog in light and dark at 400 px and desktop width. Stop the preview server afterwards.

- [ ] **Step 6: Update `README.md`.**
  - "What it is" → add a **Settings** bullet: gear button, native modal dialog, Copy format group (calendar / format presets + custom tokens incl. quoting / digits, live preview), stored in `localStorage` under `settings.v1`, invalid fields fall back to defaults.
  - Replace the **Full date line** bullet's claim "so what is on screen is exactly what lands on the clipboard" with: the line always shows the full sentence; what Copy writes is set in Settings (default: the Persian date as `yyyy-mm-dd`), and the Copy button's tooltip names the active format.
  - **Status row** bullet: "puts the full shareable sentence on the clipboard" → "puts the date on the clipboard in the configured format".
  - Repo layout: add `settings/` (settings-model.ts, settings-store.ts, settings-panel.ts) and `copy/` (copy-format.ts).
  - Update the Vitest and Playwright test counts everywhere they appear (lines ~60, ~62, ~112, ~138, ~204) with the numbers from Step 4.
  - Remove the comment in `components.css` above `#full-date` that says on-screen equals clipboard, replacing it with "the full sentence for the date in the form".

- [ ] **Step 7: Commit**

```bash
git status --short   # scan for ?? — every new file must be staged; never stage .superpowers/
git add src/main.ts e2e/converter-ux.spec.ts e2e/settings.spec.ts ../README.md src/styles/components.css
git commit -m "feat(site): wire settings into the page; e2e and docs"
```

# Time Sync and Midnight Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app takes its time from our own server (falling back to the device clock), shows in Settings where its time comes from, and the today panel turns over at midnight while the PWA stays open.

**Architecture:** nginx answers `GET /api/time` with `{"epochSec":<msec>}` (no new process). A pure model (`time-sync-model.ts`) does the offset maths; a DOM-level `time-source.ts` fetches, schedules and exposes `now()`, which becomes the single time source for the clock, the today panel and the converter's "today". The clock's existing render tick feeds a minute gate that re-renders the today panel, so no long timer is involved.

**Tech Stack:** Vite 7 + vanilla TypeScript, Vitest 3 (+ jsdom 30 under `tests/dom/`), Playwright 1.62, nginx 1.27, hand-rolled service worker.

**Spec:** `docs/superpowers/specs/2026-10-14-settings-time-holidays-design.md` — section "B — Time fetching" plus the "Architecture", "Error handling summary", "Testing" and "Docs" sections where they mention time.

## Global Constraints

- Endpoint: `location = /api/time { default_type application/json; add_header Cache-Control "no-store" always; return 200 '{"epochSec":$msec}'; }`, and it must `include /etc/nginx/security-headers.conf` like every other location.
- CSP gains `connect-src 'self'`; no third-party origin is ever allowed.
- Service worker: `/api/time` bypasses the SW entirely (network-only, never cached).
- Setting: `time.source` = `server` (default) · `device`, stored inside `settings.v1`.
- Sample: `t0 = performance.now()`, fetch, `t1`; `offset = server + rtt/2 − deviceNow`.
- Sync = 3 samples, keep the one with the smallest RTT. Dead band `|offset| < 250 ms` → 0.
- Triggers: load; `visibilitychange` to visible after ≥ 5 min hidden; every 6 h while visible. Timeout 3 s per sample.
- Failure (network, timeout, non-200, invalid body): keep the last good offset until it is 24 h old, then offset 0. No banner; status line only.
- Offset applies immediately (no slewing).
- `now()` is the single time source for the clock, the today panel and the converter's Today button / calendar "today".
- Midnight fix: no long timer. The clock's render tick drives the check; `visibilitychange` (the clock restarts on visible) and each completed sync also trigger it.
- Nothing blocks first paint; the app works fully offline (device clock).
- Coverage stays 100% on `src/**/*.ts` (only `src/main.ts` and `src/clock/**` excluded).
- No `console.log`, no secrets, no personal data. Commit messages `<type>: <description>`; never stage `.superpowers/` or `.DS_Store`.

## Decisions this plan makes (beyond the spec's wording)

1. **Minute gate instead of a y-m-d comparison.** The today panel re-renders whenever the wall-clock minute changes. That covers local midnight, *Tehran* midnight (the Persian line follows Tehran when the two days diverge, `today-lines.ts`) and the Tehran `HH:MM` line, which is stale today for the same reason. One `renderToday()` per minute is negligible; the per-frame cost is one division.
2. **A Vite dev/preview middleware for `/api/time`** in `vite.config.ts`, mirroring the nginx location. It is not a server process and never ships; without it `npm run dev`, `npm run preview` and the whole E2E suite would never exercise a successful sync, and the SW-bypass test could not be red.
3. **In-memory last offset**, not persisted: the left-open-for-days case is covered, and a cold start offline is the device clock, as the spec's airplane-mode criterion asks.
4. **Status wording says "slow/fast"** rather than a signed offset, because `+0.3 s` does not say which clock is ahead. `offset = server − device`, so a positive offset means the device is slow.
5. **The server option is labelled with `location.host`** (`time.automated.ink` in production, `localhost:4173` locally), so the label is never wrong.
6. **Test connection adopts a successful sample** when the source is `server`, so the status line agrees with the test result the user just saw.

## Review Focus

1. **A 200 response that is not our JSON** (captive-portal Wi-Fi login page, an SPA fallback serving `index.html`): the app must use the device clock, not crash or adopt `NaN`. Pinned in Task 1 (`parseTimeBody`) and Task 3 (`res.json()` throws → sample discarded).
2. **Changing the copy format must not reset the time source** (every `store.update` in `settings-panel.ts` currently rebuilds the object from `copy` only). Pinned in Task 2.
3. **Switching source while a sync is in flight**: a late result must not be applied after the user chose "device". Pinned in Task 3 (generation counter).
4. **The service worker caching `/api/time`**: a stale cached timestamp would be adopted as "server time" with a huge offset. Pinned in Task 5 (E2E checks the cache after a sync, SW active).
5. **The device clock jumping backwards** (user fixes the time by hand): a last-sync timestamp in the "future" must count as expired, not as fresh for a day. Pinned in Task 1 (`isFresh`).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `Site/src/time/time-sync-model.ts` | create | Pure: constants, body validation, sample maths, best-of-N, dead band, freshness |
| `Site/src/time/time-text.ts` | create | Pure: status / test-result / drift text in EN and FA |
| `Site/src/time/minute-gate.ts` | create | Pure: calls back once per new wall-clock minute |
| `Site/src/time/time-source.ts` | create | Fetch, scheduling, `now()`, `status()`, `probe()`, `subscribe()` |
| `Site/src/time/time-panel.ts` | create | DOM: the Settings "Time" group |
| `Site/src/settings/settings-model.ts` | modify | `time.source` in `Settings`, defaults, parsing |
| `Site/src/settings/settings-panel.ts` | modify | Keep other groups when updating `copy` |
| `Site/src/converter/converter.ts` | modify | Injected `now` for Today / calendar today |
| `Site/src/clock/clock.ts` | modify | Injected `now` and `onTick` |
| `Site/src/main.ts` | modify | Wiring |
| `Site/src/i18n/strings.ts` | modify | Time strings EN/FA |
| `Site/index.html` | modify | Time fieldset |
| `Site/src/styles/components.css` | modify | Time group styles |
| `Site/public/sw.js` | modify | `/api/time` bypass |
| `Site/vite.config.ts` | modify | Dev/preview `/api/time` middleware |
| `deploy/nginx.conf`, `deploy/security-headers.conf` | modify | Endpoint, `connect-src` |
| `Site/tests/time-sync-model.test.ts`, `Site/tests/time-text.test.ts`, `Site/tests/minute-gate.test.ts` | create | Pure tests |
| `Site/tests/dom/time-source.test.ts`, `Site/tests/dom/time-panel.test.ts` | create | DOM tests |
| `Site/tests/settings-model.test.ts`, `Site/tests/dom/settings-store.test.ts`, `Site/tests/dom/settings-panel.test.ts`, `Site/tests/dom/converter.test.ts` | modify | New field / injected `now` |
| `Site/e2e/time-sync.spec.ts` | create | E2E |
| `README.md`, `docs/SECURITY.md` | modify | Docs |

All commands below run from `Site/` unless stated otherwise.

---

### Task 1: Pure sync model

**Files:**
- Create: `Site/src/time/time-sync-model.ts`
- Test: `Site/tests/time-sync-model.test.ts`

**Interfaces:**
- Produces:
  - constants `TIME_ENDPOINT = '/api/time'`, `SAMPLES_PER_SYNC = 3`, `DEAD_BAND_MS = 250`, `SAMPLE_TIMEOUT_MS = 3_000`, `OFFSET_TTL_MS = 86_400_000`, `RESYNC_AFTER_HIDDEN_MS = 300_000`, `RESYNC_INTERVAL_MS = 21_600_000`
  - `interface Sample { readonly offsetMs: number; readonly rttMs: number }`
  - `interface LastSync { readonly offsetMs: number; readonly atDeviceMs: number }`
  - `parseTimeBody(raw: unknown): number | null` — epoch **milliseconds** or null
  - `sampleOffset(serverMs: number, t0: number, t1: number, deviceAtT1Ms: number): Sample`
  - `bestSample(samples: readonly Sample[]): Sample | null`
  - `applyDeadBand(offsetMs: number): number`
  - `isFresh(last: LastSync | null, deviceNowMs: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// Site/tests/time-sync-model.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyDeadBand, bestSample, DEAD_BAND_MS, isFresh, OFFSET_TTL_MS, parseTimeBody, sampleOffset,
} from '../src/time/time-sync-model';

describe('parseTimeBody', () => {
  it('reads nginx $msec — seconds with a millisecond fraction — as epoch milliseconds', () => {
    expect(parseTimeBody({ epochSec: 1792043370.981 })).toBe(1792043370981);
  });

  it('rejects anything that is not our JSON', () => {
    const junk = [
      null, undefined, 42, 'x', [], {}, { epochSec: '1792043370.981' }, { epochSec: Infinity },
      { epochSec: Number.NaN }, { epochsec: 1792043370 },
    ];
    for (const raw of junk) expect(parseTimeBody(raw)).toBeNull();
  });

  it('rejects timestamps outside 2020–2100, which no healthy server sends', () => {
    expect(parseTimeBody({ epochSec: 0 })).toBeNull();
    expect(parseTimeBody({ epochSec: 1_577_836_799 })).toBeNull();
    expect(parseTimeBody({ epochSec: 4_102_444_801 })).toBeNull();
    expect(parseTimeBody({ epochSec: 1_577_836_800 })).toBe(1_577_836_800_000);
  });
});

describe('sampleOffset', () => {
  it('credits the server with half the round trip', () => {
    // Request left at perf 1000, answer back at perf 1100: rtt 100 ms.
    // Server stamped 50 000; by the time we read it, it is 50 050 on the server.
    // The device reads 49 000 at that moment, so it is 1 050 ms slow.
    expect(sampleOffset(50_000, 1_000, 1_100, 49_000)).toEqual({ rttMs: 100, offsetMs: 1_050 });
  });

  it('is negative when the device is fast', () => {
    expect(sampleOffset(50_000, 0, 0, 52_000).offsetMs).toBe(-2_000);
  });
});

describe('bestSample', () => {
  it('keeps the sample with the smallest round trip', () => {
    const samples = [
      { offsetMs: 900, rttMs: 300 }, { offsetMs: 1_000, rttMs: 40 }, { offsetMs: 1_100, rttMs: 90 },
    ];
    expect(bestSample(samples)).toEqual({ offsetMs: 1_000, rttMs: 40 });
  });

  it('has nothing to offer when every sample failed', () => {
    expect(bestSample([])).toBeNull();
  });
});

describe('applyDeadBand', () => {
  it('treats anything under the dead band as no offset at all', () => {
    expect(applyDeadBand(DEAD_BAND_MS - 1)).toBe(0);
    expect(applyDeadBand(-(DEAD_BAND_MS - 1))).toBe(0);
  });

  it('keeps offsets at or beyond the dead band, rounded to whole milliseconds', () => {
    expect(applyDeadBand(DEAD_BAND_MS)).toBe(DEAD_BAND_MS);
    expect(applyDeadBand(-1_234.6)).toBe(-1_235);
  });
});

describe('isFresh', () => {
  const last = { offsetMs: 500, atDeviceMs: 1_000_000 };

  it('is fresh until it is a day old', () => {
    expect(isFresh(last, last.atDeviceMs)).toBe(true);
    expect(isFresh(last, last.atDeviceMs + OFFSET_TTL_MS - 1)).toBe(true);
    expect(isFresh(last, last.atDeviceMs + OFFSET_TTL_MS)).toBe(false);
  });

  it('is not fresh when there was never a sync', () => {
    expect(isFresh(null, 1_000_000)).toBe(false);
  });

  it('is not fresh when the device clock has gone back past the sync', () => {
    expect(isFresh(last, last.atDeviceMs - 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/time-sync-model.test.ts`
Expected: FAIL — `Failed to resolve import "../src/time/time-sync-model"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Site/src/time/time-sync-model.ts
export const TIME_ENDPOINT = '/api/time';
export const SAMPLES_PER_SYNC = 3;
export const DEAD_BAND_MS = 250;
export const SAMPLE_TIMEOUT_MS = 3_000;
export const OFFSET_TTL_MS = 24 * 60 * 60 * 1000;
export const RESYNC_AFTER_HIDDEN_MS = 5 * 60 * 1000;
export const RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

// A body outside these bounds is not a clock reading — it is a bug or someone else's JSON.
const MIN_EPOCH_SEC = 1_577_836_800; // 2020-01-01T00:00:00Z
const MAX_EPOCH_SEC = 4_102_444_800; // 2100-01-01T00:00:00Z

/** One round trip: how far the device is behind the server, and how long the trip took. */
export interface Sample { readonly offsetMs: number; readonly rttMs: number }

/** The offset in force and when (by the device clock) it was measured. */
export interface LastSync { readonly offsetMs: number; readonly atDeviceMs: number }

/** `{"epochSec": 1792043370.981}` → epoch milliseconds; anything else → null. */
export function parseTimeBody(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const sec = (raw as Record<string, unknown>)['epochSec'];
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  if (sec < MIN_EPOCH_SEC || sec > MAX_EPOCH_SEC) return null;
  return Math.round(sec * 1000);
}

/**
 * The server stamped its time somewhere in the round trip; half-way is the best guess,
 * so by the time the answer is read the server is `rtt / 2` further on.
 */
export function sampleOffset(serverMs: number, t0: number, t1: number, deviceAtT1Ms: number): Sample {
  const rttMs = t1 - t0;
  return { rttMs, offsetMs: serverMs + rttMs / 2 - deviceAtT1Ms };
}

/** The shortest trip has the least room for asymmetric delay, so its offset is the most trustworthy. */
export function bestSample(samples: readonly Sample[]): Sample | null {
  let best: Sample | null = null;
  for (const sample of samples) {
    if (best === null || sample.rttMs < best.rttMs) best = sample;
  }
  return best;
}

/** Under a quarter of a second is network noise, not a wrong clock: leave the device alone. */
export function applyDeadBand(offsetMs: number): number {
  return Math.abs(offsetMs) < DEAD_BAND_MS ? 0 : Math.round(offsetMs);
}

/** A sync older than a day, or "newer" than now because the device clock went back, is not trusted. */
export function isFresh(last: LastSync | null, deviceNowMs: number): boolean {
  if (last === null) return false;
  const age = deviceNowMs - last.atDeviceMs;
  return age >= 0 && age < OFFSET_TTL_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/time-sync-model.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git status --short   # scan for ?? — only .superpowers/ may stay untracked
git add Site/src/time/time-sync-model.ts Site/tests/time-sync-model.test.ts
git commit -m "feat(site): pure time-sync model (offset, best-of-N, dead band, expiry)"
```

---

### Task 2: `time.source` setting

**Files:**
- Modify: `Site/src/settings/settings-model.ts`
- Modify: `Site/src/settings/settings-panel.ts:80-110` (the three `store.update` calls)
- Test: `Site/tests/settings-model.test.ts`, `Site/tests/dom/settings-store.test.ts`, `Site/tests/dom/settings-panel.test.ts`

**Interfaces:**
- Produces: `type TimeSourceSetting = 'server' | 'device'`; `interface TimeSettings { readonly source: TimeSourceSetting }`; `Settings` gains `readonly time: TimeSettings`; `DEFAULT_SETTINGS.time = { source: 'server' }`.

The `Settings` type gaining a required field means every `store.update(() => ({ copy: … }))` in tests and source no longer type-checks. That is the point: the existing panel code silently drops every group other than `copy` on each change. The test edits below are required by the new type, not by the implementation.

- [ ] **Step 1: Write the failing tests**

Append to `Site/tests/settings-model.test.ts` inside `describe('parseSettings', …)`:

```ts
  it('defaults the time source to the server', () => {
    expect(parseSettings(undefined).time).toEqual({ source: 'server' });
  });

  it('keeps a valid time source and replaces an invalid one, independently of copy', () => {
    expect(parseSettings({ time: { source: 'device' } }).time.source).toBe('device');
    for (const source of ['ntp', 1, null, undefined]) {
      expect(parseSettings({ time: { source }, copy: { digits: 'persian' } })).toEqual({
        ...DEFAULT_SETTINGS, copy: { ...DEFAULT_SETTINGS.copy, digits: 'persian' },
      });
    }
    for (const time of ['device', [], 3]) {
      expect(parseSettings({ time }).time.source).toBe('server');
    }
  });
```

and change the existing `'keeps every valid field'` test's input to include the new group:

```ts
  it('keeps every valid field', () => {
    const raw = {
      copy: { calendar: 'both', pattern: 'dd.mm.yyyy', digits: 'persian' },
      time: { source: 'device' },
    };
    expect(parseSettings(raw)).toEqual(raw);
  });
```

In `Site/tests/dom/settings-store.test.ts`, change the update test's expectation (line ~60) and the update calls to spread the whole settings object:

```ts
    store.update((s) => ({ ...s, copy: { ...s.copy, calendar: 'gregorian', pattern: '' } }));

    const expected = {
      copy: { calendar: 'gregorian', pattern: 'yyyy-mm-dd', digits: 'latin' },
      time: { source: 'server' },
    };
```

```ts
    expect(() => store.update((s) => ({ ...s, copy: { ...s.copy, digits: 'persian' } }))).not.toThrow();
```

In `Site/tests/dom/settings-panel.test.ts`, change the three `store.update` calls to spread `s`:

```ts
    store.update((s) => ({ ...s, copy: { calendar: 'gregorian', pattern: 'dd.mm.yyyy', digits: 'persian' } }));
```
```ts
    store.update((s) => ({ ...s, copy: { ...s.copy, pattern: 'yyyy.m.d' } }));
```
```ts
    store.update((s) => ({ ...s, copy: { ...s.copy, pattern: 'MMMM' } }));
```

and add, inside `describe('settings panel', …)`:

```ts
  it('changing the copy format leaves the other settings alone', () => {
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    clickOn(byId('settings-toggle'));

    choose('set-copy-calendar', 'both');
    choose('set-copy-digits', 'persian');
    choose('set-copy-pattern', 'dd.mm.yyyy');
    choose('set-copy-pattern', 'custom');
    typeCustom('yyyy');

    expect(store.get().time.source).toBe('device');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/settings-model.test.ts tests/dom/settings-panel.test.ts tests/dom/settings-store.test.ts`
Expected: FAIL — `parseSettings(undefined).time` is `undefined`; the panel test reports `store.get().time` undefined.

- [ ] **Step 3: Write minimal implementation**

In `Site/src/settings/settings-model.ts`:

```ts
export type CopyCalendar = 'persian' | 'gregorian' | 'both';
export type CopyDigits = 'latin' | 'persian';
export type TimeSourceSetting = 'server' | 'device';
```

```ts
export interface TimeSettings {
  readonly source: TimeSourceSetting;
}

export interface Settings {
  readonly copy: CopySettings;
  readonly time: TimeSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  copy: { calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin' },
  time: { source: 'server' },
};

const CALENDARS: readonly CopyCalendar[] = ['persian', 'gregorian', 'both'];
const DIGITS: readonly CopyDigits[] = ['latin', 'persian'];
const TIME_SOURCES: readonly TimeSourceSetting[] = ['server', 'device'];
```

```ts
export function parseSettings(raw: unknown): Settings {
  const group = (key: string): Record<string, unknown> =>
    isRecord(raw) && isRecord(raw[key]) ? raw[key] : {};
  const copy = group('copy');
  const time = group('time');
  const fallback = DEFAULT_SETTINGS;
  return {
    copy: {
      calendar: oneOf(copy['calendar'], CALENDARS, fallback.copy.calendar),
      pattern: parsePattern(copy['pattern']),
      digits: oneOf(copy['digits'], DIGITS, fallback.copy.digits),
    },
    time: {
      source: oneOf(time['source'], TIME_SOURCES, fallback.time.source),
    },
  };
}
```

The `group` helper must read the value into a local before testing it. TypeScript does not narrow an indexed access such as `raw[key]` through `isRecord`:

```ts
  const group = (key: string): Record<string, unknown> => {
    const value = isRecord(raw) ? raw[key] : undefined;
    return isRecord(value) ? value : {};
  };
```

In `Site/src/settings/settings-panel.ts`, every update keeps the other groups:

```ts
  const setPattern = (value: string): void => {
    store.update((s) => ({ ...s, copy: { ...s.copy, pattern: value } }));
  };
```
```ts
  calendar.addEventListener('change', () => {
    store.update((s) => ({ ...s, copy: { ...s.copy, calendar: calendar.value as CopyCalendar } }));
  });
  digits.addEventListener('change', () => {
    store.update((s) => ({ ...s, copy: { ...s.copy, digits: digits.value as CopyDigits } }));
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all Vitest tests PASS; `tsc` reports no errors.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/settings Site/tests/settings-model.test.ts Site/tests/dom/settings-store.test.ts Site/tests/dom/settings-panel.test.ts
git commit -m "feat(site): time.source setting; copy changes keep the other groups"
```

---

### Task 3: Time source (fetch, schedule, `now()`)

**Files:**
- Create: `Site/src/time/time-source.ts`
- Test: `Site/tests/dom/time-source.test.ts`

**Interfaces:**
- Consumes: everything from Task 1; `SettingsStore` (`get`, `subscribe`) from `settings-store.ts`; `Settings.time.source` from Task 2.
- Produces:

```ts
export type TimeStatus =
  | { readonly kind: 'device' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced'; readonly atMs: number; readonly offsetMs: number }
  | { readonly kind: 'unsynced' };

export type ProbeResult =
  | { readonly ok: true; readonly rttMs: number; readonly offsetMs: number }
  | { readonly ok: false };

export interface TimeSourceDeps {
  readonly store: Pick<SettingsStore, 'get' | 'subscribe'>;
  readonly fetchImpl?: typeof fetch;   // default: globalThis.fetch
  readonly dateNow?: () => number;      // default: Date.now
  readonly perfNow?: () => number;      // default: performance.now
}

export interface TimeSource {
  now(): Date;
  status(): TimeStatus;
  subscribe(listener: () => void): () => void;
  sync(): Promise<void>;
  probe(): Promise<ProbeResult>;
  start(): void;
  dispose(): void;
}

export function createTimeSource(deps: TimeSourceDeps): TimeSource;
```

`now`, `status`, etc. are closures, so `time.now` can be passed around unbound.

Behaviour:
- `now()` = device time + the last offset, when the source is `server` and `isFresh`; otherwise device time.
- `status()`: `device` when the source is `device`; `synced` (with `atMs = last.atDeviceMs + last.offsetMs`) when fresh; else `syncing` while a sync runs; else `unsynced`.
- `sync()` does nothing for `device`. Otherwise it takes 3 sequential samples, keeps the best, applies the dead band and stores it. A failed sample (reject, timeout, non-2xx, `res.json()` throws, invalid body) is skipped. When all fail, the last offset is kept and expires on its own. Concurrent calls share the in-flight run.
- A **generation** counter increments on every source change; a run started under an old generation discards its result.
- `probe()` takes one sample. On success, when the source is `server`, it also becomes the stored offset.
- `start()`: listen for `visibilitychange`; sync when the page becomes visible after ≥ 5 min hidden. A 60 s interval syncs when the page is visible and the last attempt is ≥ 6 h old. Then sync once.
- The store subscription syncs on a switch to `server` and notifies listeners on any switch.
- Listeners are notified when a sync starts and when it ends, after a probe that changed the offset, and on a source switch.

- [ ] **Step 1: Write the failing test**

```ts
// Site/tests/dom/time-source.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../src/settings/settings-model';
import { createTimeSource, type TimeSource } from '../../src/time/time-source';
import {
  OFFSET_TTL_MS, RESYNC_AFTER_HIDDEN_MS, RESYNC_INTERVAL_MS, SAMPLE_TIMEOUT_MS,
} from '../../src/time/time-sync-model';

const DEVICE_START = Date.UTC(2026, 9, 15, 12, 0, 0);

/** A settings store reduced to what the time source reads, with a switch for the source. */
const fakeStore = (source: Settings['time']['source'] = 'server') => {
  let settings: Settings = { ...DEFAULT_SETTINGS, time: { source } };
  const listeners = new Set<(s: Settings) => void>();
  return {
    get: () => settings,
    subscribe: (listener: (s: Settings) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setSource(next: Settings['time']['source']) {
      settings = { ...settings, time: { source: next } };
      for (const listener of listeners) listener(settings);
    },
  };
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers as a server whose clock is `skewMs` ahead of the (fake) device clock. */
const serverAhead = (skewMs: number) =>
  vi.fn<typeof fetch>(async () => json({ epochSec: (Date.now() + skewMs) / 1000 }));

let hidden = false;
const setHidden = (value: boolean): void => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

let time: TimeSource | undefined;
const make = (fetchImpl: typeof fetch, store = fakeStore()): TimeSource => {
  time = createTimeSource({ store, fetchImpl, perfNow: () => Date.now() });
  return time;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEVICE_START);
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});

afterEach(() => {
  time?.dispose();
  time = undefined;
  vi.useRealTimers();
});

describe('time source', () => {
  it('uses the device clock until a sync has succeeded', () => {
    const t = make(serverAhead(5_000));
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('applies the server offset after a sync and reports when it synced', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl);
    await t.sync();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith('/api/time', expect.objectContaining({ cache: 'no-store' }));
    expect(t.now().getTime()).toBe(DEVICE_START + 5_000);
    expect(t.status()).toEqual({ kind: 'synced', atMs: DEVICE_START + 5_000, offsetMs: 5_000 });
  });

  it('ignores an offset inside the dead band', async () => {
    const t = make(serverAhead(200));
    await t.sync();
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 0 });
  });

  it('keeps the sample with the shortest round trip', async () => {
    let call = 0;
    // Each answer takes a different time; the 10 ms one says +2 s, the slow ones disagree.
    const plan = [{ delay: 400, skew: 9_000 }, { delay: 10, skew: 2_000 }, { delay: 200, skew: -3_000 }];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const { delay, skew } = plan[call++]!;
      await new Promise((resolve) => { setTimeout(resolve, delay); });
      return json({ epochSec: (Date.now() + skew - delay / 2) / 1000 });
    });
    const t = make(fetchImpl);
    const done = t.sync();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;
    expect(t.status()).toMatchObject({ offsetMs: 2_000 });
  });

  it('skips failed samples and uses the rest', async () => {
    let call = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      call += 1;
      if (call === 1) throw new TypeError('offline');
      if (call === 2) return new Response('<!doctype html><title>Wi-Fi login</title>', { status: 200 });
      return json({ epochSec: (Date.now() + 4_000) / 1000 });
    });
    const t = make(fetchImpl);
    await t.sync();
    expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 4_000 });
  });

  it.each([
    ['a network error', async () => { throw new TypeError('offline'); }],
    ['a non-200 answer', async () => json({ epochSec: Date.now() / 1000 }, 503)],
    ['an HTML page', async () => new Response('<!doctype html>', { status: 200 })],
    ['JSON that is not ours', async () => json({ time: 'now' })],
  ])('falls back to the device clock on %s', async (_label, answer) => {
    const t = make(vi.fn<typeof fetch>(answer as () => Promise<Response>));
    await t.sync();
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('gives up on a sample after the timeout', async () => {
    const hanging = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
    }));
    const t = make(hanging);
    const done = t.sync();
    await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS * 4);
    await done;
    expect(hanging).toHaveBeenCalledTimes(3);
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('keeps the last good offset through failures until it is a day old', async () => {
    let up = true;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (!up) throw new TypeError('offline');
      return json({ epochSec: (Date.now() + 5_000) / 1000 });
    });
    const t = make(fetchImpl);
    await t.sync();
    up = false;
    vi.advanceTimersByTime(OFFSET_TTL_MS - 1);
    await t.sync();
    expect(t.now().getTime() - Date.now()).toBe(5_000);
    vi.advanceTimersByTime(1);
    expect(t.now().getTime()).toBe(Date.now());
    expect(t.status()).toEqual({ kind: 'unsynced' });
  });

  it('says syncing to listeners while it runs, and the outcome when it ends', async () => {
    const t = make(vi.fn<typeof fetch>(async () => { throw new TypeError('offline'); }));
    const seen: string[] = [];
    t.subscribe(() => { seen.push(t.status().kind); });
    const done = t.sync();
    expect(t.status()).toEqual({ kind: 'syncing' });
    await done;
    expect(seen).toEqual(['syncing', 'unsynced']);
  });

  it('shares one run between overlapping sync calls', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl);
    await Promise.all([t.sync(), t.sync()]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never fetches when the source is the device', async () => {
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl, fakeStore('device'));
    t.start();
    await t.sync();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(t.status()).toEqual({ kind: 'device' });
    expect(t.now().getTime()).toBe(DEVICE_START);
  });

  it('drops the offset on a switch to the device and syncs on a switch back', async () => {
    const store = fakeStore();
    const fetchImpl = serverAhead(5_000);
    const t = make(fetchImpl, store);
    const listener = vi.fn();
    t.subscribe(listener);
    await t.sync();

    store.setSource('device');
    expect(t.now().getTime()).toBe(DEVICE_START);
    expect(t.status()).toEqual({ kind: 'device' });

    store.setSource('server');
    await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });
    await vi.waitFor(() => { expect(t.status()).toMatchObject({ kind: 'synced' }); });
    expect(listener).toHaveBeenCalled();
  });

  it('ignores an unrelated settings change', async () => {
    const store = fakeStore();
    const fetchImpl = serverAhead(5_000);
    make(fetchImpl, store);
    store.setSource('server');
    await Promise.resolve();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('discards a result that arrives after the user switched to the device clock', async () => {
    const store = fakeStore();
    // Only the very first request answers (after 100 ms); every later one hangs until its timeout.
    const answersOnce = vi.fn<typeof fetch>(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      return json({ epochSec: (Date.now() + 5_000) / 1000 });
    });
    const t = make(answersOnce, store);
    const stale = t.sync();                 // its first sample is now in flight
    answersOnce.mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
    }));
    store.setSource('device');
    store.setSource('server');              // starts a fresh run, which only ever times out

    await vi.advanceTimersByTimeAsync(SAMPLE_TIMEOUT_MS * 4);
    await stale;

    // The stale run did get a good sample (+5 s), but it belongs to the old generation.
    expect(t.status()).toEqual({ kind: 'unsynced' });
    expect(t.now().getTime()).toBe(Date.now());
  });

  describe('probe', () => {
    it('reports the round trip and the offset, and adopts it for the server source', async () => {
      const t = make(serverAhead(5_000));
      const listener = vi.fn();
      t.subscribe(listener);
      await expect(t.probe()).resolves.toEqual({ ok: true, rttMs: 0, offsetMs: 5_000 });
      expect(t.status()).toMatchObject({ kind: 'synced', offsetMs: 5_000 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reports without adopting when the source is the device', async () => {
      const t = make(serverAhead(5_000), fakeStore('device'));
      await expect(t.probe()).resolves.toMatchObject({ ok: true, offsetMs: 5_000 });
      expect(t.status()).toEqual({ kind: 'device' });
    });

    it('reports failure', async () => {
      const t = make(vi.fn<typeof fetch>(async () => { throw new TypeError('offline'); }));
      await expect(t.probe()).resolves.toEqual({ ok: false });
    });
  });

  describe('schedule', () => {
    it('syncs on start', async () => {
      const fetchImpl = serverAhead(5_000);
      make(fetchImpl).start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
    });

    it('resyncs on return after at least five minutes hidden, not sooner', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });

      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_AFTER_HIDDEN_MS - 1);
      setHidden(false);
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(3);

      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_AFTER_HIDDEN_MS);
      setHidden(false);
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });
    });

    it('ignores a visible event that was not preceded by hiding', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
      setHidden(false);
      await Promise.resolve();
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('resyncs every six hours while visible, and not while hidden', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });

      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS - 60_000);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(6); });

      hidden = true;
      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(6);
    });

    it('stops listening and polling after dispose', async () => {
      const fetchImpl = serverAhead(5_000);
      const t = make(fetchImpl);
      t.start();
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(3); });
      t.dispose();
      setHidden(true);
      vi.setSystemTime(Date.now() + RESYNC_INTERVAL_MS);
      setHidden(false);
      await vi.advanceTimersByTimeAsync(RESYNC_INTERVAL_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('unsubscribes a listener', async () => {
      const t = make(serverAhead(5_000));
      const listener = vi.fn();
      t.subscribe(listener)();
      await t.sync();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('uses the real clocks and fetch when none are injected', async () => {
    const realFetch = vi.fn<typeof fetch>(async () => json({ epochSec: (Date.now() + 5_000) / 1000 }));
    vi.stubGlobal('fetch', realFetch);
    try {
      time = createTimeSource({ store: fakeStore() });
      await time.sync();
      expect(realFetch).toHaveBeenCalled();
      expect(time.status()).toMatchObject({ kind: 'synced' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dom/time-source.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/time/time-source"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Site/src/time/time-source.ts
import type { SettingsStore } from '../settings/settings-store';
import {
  applyDeadBand, bestSample, isFresh, parseTimeBody, RESYNC_AFTER_HIDDEN_MS, RESYNC_INTERVAL_MS,
  SAMPLE_TIMEOUT_MS, sampleOffset, SAMPLES_PER_SYNC, TIME_ENDPOINT, type LastSync, type Sample,
} from './time-sync-model';

export type TimeStatus =
  | { readonly kind: 'device' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced'; readonly atMs: number; readonly offsetMs: number }
  | { readonly kind: 'unsynced' };

export type ProbeResult =
  | { readonly ok: true; readonly rttMs: number; readonly offsetMs: number }
  | { readonly ok: false };

export interface TimeSourceDeps {
  readonly store: Pick<SettingsStore, 'get' | 'subscribe'>;
  readonly fetchImpl?: typeof fetch;
  readonly dateNow?: () => number;
  readonly perfNow?: () => number;
}

export interface TimeSource {
  now(): Date;
  status(): TimeStatus;
  subscribe(listener: () => void): () => void;
  sync(): Promise<void>;
  probe(): Promise<ProbeResult>;
  start(): void;
  dispose(): void;
}

/** How often the six-hour rule is checked; a throttled tick only delays the check. */
const SCHEDULE_CHECK_MS = 60_000;

export function createTimeSource({
  store,
  fetchImpl = (input, init) => fetch(input, init),
  dateNow = () => Date.now(),
  perfNow = () => performance.now(),
}: TimeSourceDeps): TimeSource {
  let last: LastSync | null = null;
  let running: { generation: number; done: Promise<void> } | null = null;
  // Bumped on every source switch: a run started before the switch must not land after it.
  let generation = 0;
  let source = store.get().time.source;
  let lastAttemptMs = Number.NEGATIVE_INFINITY;
  let hiddenSinceMs: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  const notify = (): void => { for (const listener of listeners) listener(); };
  const usingServer = (): boolean => source === 'server';
  const offsetNow = (): number => (usingServer() && isFresh(last, dateNow()) ? last!.offsetMs : 0);

  const takeSample = async (): Promise<Sample | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, SAMPLE_TIMEOUT_MS);
    try {
      const t0 = perfNow();
      const response = await fetchImpl(TIME_ENDPOINT, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return null;
      const serverMs = parseTimeBody(await response.json());
      const t1 = perfNow();
      return serverMs === null ? null : sampleOffset(serverMs, t0, t1, dateNow());
    } catch {
      // Offline, timed out, or a body that is not JSON (a Wi-Fi login page): no sample.
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const adopt = (sample: Sample): void => {
    last = { offsetMs: applyDeadBand(sample.offsetMs), atDeviceMs: dateNow() };
  };

  const sync = (): Promise<void> => {
    if (!usingServer()) return Promise.resolve();
    if (running?.generation === generation) return running.done;
    // `running` is set before the first notify and cleared before the last, so a listener
    // reading status() sees "syncing" while it runs and the outcome once it has finished.
    const mine = { generation, done: Promise.resolve() };
    running = mine;
    mine.done = (async () => {
      lastAttemptMs = dateNow();
      notify();
      const samples: Sample[] = [];
      for (let i = 0; i < SAMPLES_PER_SYNC; i += 1) {
        const sample = await takeSample();
        if (sample !== null) samples.push(sample);
      }
      const best = bestSample(samples);
      if (best !== null && mine.generation === generation) adopt(best);
      if (running === mine) running = null;
      notify();
    })();
    return mine.done;
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      hiddenSinceMs = dateNow();
      return;
    }
    const hiddenFor = hiddenSinceMs === null ? 0 : dateNow() - hiddenSinceMs;
    hiddenSinceMs = null;
    if (hiddenFor >= RESYNC_AFTER_HIDDEN_MS) void sync();
  };

  const onScheduleCheck = (): void => {
    if (!document.hidden && dateNow() - lastAttemptMs >= RESYNC_INTERVAL_MS) void sync();
  };

  const unsubscribeStore = store.subscribe((settings) => {
    if (settings.time.source === source) return;
    source = settings.time.source;
    generation += 1;
    notify();
    void sync();
  });

  return {
    now: () => new Date(dateNow() + offsetNow()),
    status(): TimeStatus {
      if (!usingServer()) return { kind: 'device' };
      if (isFresh(last, dateNow())) {
        return { kind: 'synced', atMs: last!.atDeviceMs + last!.offsetMs, offsetMs: last!.offsetMs };
      }
      return running === null ? { kind: 'unsynced' } : { kind: 'syncing' };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    sync,
    async probe(): Promise<ProbeResult> {
      const sample = await takeSample();
      if (sample === null) return { ok: false };
      if (usingServer()) {
        adopt(sample);
        notify();
      }
      return { ok: true, rttMs: Math.round(sample.rttMs), offsetMs: applyDeadBand(sample.offsetMs) };
    },
    start() {
      document.addEventListener('visibilitychange', onVisibility);
      intervalId = setInterval(onScheduleCheck, SCHEDULE_CHECK_MS);
      void sync();
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(intervalId);
      unsubscribeStore();
      listeners.clear();
    },
  };
}
```

Notes for the implementer:
- `last!` is safe where `isFresh(last, …)` returned true (it returns false for `null`). If the project's style forbids `!`, assign `const current = last;` and test `current !== null && isFresh(current, …)`. Either form must keep 100% branch coverage.
- If a test exposes a branch the plan's tests do not reach, add a test. Do not drop the branch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dom/time-source.test.ts && npx vitest run --coverage 2>&1 | tail -8`
Expected: PASS. Coverage for `src/time/time-source.ts` is 100% on all four measures. If a branch is uncovered, add the missing test case and do not change the threshold.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/time/time-source.ts Site/tests/dom/time-source.test.ts
git commit -m "feat(site): time source — best-of-3 sync, schedule, 24 h fallback"
```

---

### Task 4: Settings "Time" group (text, markup, panel)

**Files:**
- Create: `Site/src/time/time-text.ts`, `Site/src/time/time-panel.ts`
- Modify: `Site/src/i18n/strings.ts`, `Site/index.html` (inside `#settings-dialog`, after the copy `</fieldset>`), `Site/src/styles/components.css`
- Test: `Site/tests/time-text.test.ts`, `Site/tests/dom/time-panel.test.ts`, `Site/tests/i18n.test.ts` (no change expected; it already checks every key exists in both languages — confirm by running it)

**Interfaces:**
- Consumes: `TimeStatus`, `ProbeResult`, `TimeSource` from Task 3; `SettingsStore` and `TimeSourceSetting` from Task 2; `STRINGS`, `formatTemplate`, `toLocaleDigits`, `Lang` from `i18n/strings.ts`.
- Produces:
  - `driftText(offsetMs: number, lang: Lang): string`
  - `statusText(status: TimeStatus, lang: Lang, timeZone?: string): string`
  - `probeText(result: ProbeResult, lang: Lang): string`
  - `setupTimeSettings(deps: { store: SettingsStore; time: Pick<TimeSource, 'status' | 'probe' | 'subscribe'>; getLang: () => Lang }): { rerender: () => void }`

New string keys: `timeSection`, `timeSourceLabel`, `sourceDevice`, `testConnection`, `testing`, `testOk`, `testFail`, `statusDevice`, `statusSyncing`, `statusSynced`, `statusUnsynced`, `driftNone`, `driftSlow`, `driftFast`.

- [ ] **Step 1: Write the failing tests**

```ts
// Site/tests/time-text.test.ts
import { describe, expect, it } from 'vitest';
import { driftText, probeText, statusText } from '../src/time/time-text';

const AT = Date.UTC(2026, 9, 15, 14, 2, 30);

describe('driftText', () => {
  it('says which way the device is off, to a tenth of a second', () => {
    expect(driftText(0, 'en')).toBe('device clock accurate');
    expect(driftText(300, 'en')).toBe('device 0.3 s slow');
    expect(driftText(-1_250, 'en')).toBe('device 1.3 s fast');
  });

  it('uses Persian digits and the Persian decimal separator', () => {
    expect(driftText(300, 'fa')).toBe('ساعت دستگاه ۰٫۳ ثانیه عقب است');
    expect(driftText(-1_250, 'fa')).toBe('ساعت دستگاه ۱٫۳ ثانیه جلو است');
    expect(driftText(0, 'fa')).toBe('ساعت دستگاه دقیق است');
  });
});

describe('statusText', () => {
  it('names each state', () => {
    expect(statusText({ kind: 'device' }, 'en')).toBe("Using this device's clock");
    expect(statusText({ kind: 'syncing' }, 'en')).toBe('Syncing…');
    expect(statusText({ kind: 'unsynced' }, 'en')).toBe("Not synced — using this device's clock");
  });

  it('gives the sync time in 24-hour wall-clock time and the drift', () => {
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 300 }, 'en', 'UTC'))
      .toBe('Synced 14:02 · device 0.3 s slow');
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 0 }, 'fa', 'UTC'))
      .toBe('همگام‌شده ۱۴:۰۲ · ساعت دستگاه دقیق است');
  });

  it('defaults to the viewer\'s time zone', () => {
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 0 }, 'en')).toMatch(/^Synced \d\d:\d\d · /);
  });
});

describe('probeText', () => {
  it('reports success with the round trip and the drift, or failure', () => {
    expect(probeText({ ok: true, rttMs: 84, offsetMs: 300 }, 'en')).toBe('OK · 84 ms · device 0.3 s slow');
    expect(probeText({ ok: true, rttMs: 84, offsetMs: 0 }, 'fa')).toBe('برقرار · ۸۴ میلی‌ثانیه · ساعت دستگاه دقیق است');
    expect(probeText({ ok: false }, 'en')).toBe('Unreachable');
    expect(probeText({ ok: false }, 'fa')).toBe('در دسترس نیست');
  });
});
```

```ts
// Site/tests/dom/time-panel.test.ts
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { setupTimeSettings } from '../../src/time/time-panel';
import type { ProbeResult, TimeStatus } from '../../src/time/time-source';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string): string => byId(id).textContent ?? '';

let lang: Lang;
let store: SettingsStore;
let status: TimeStatus;
let listeners: Set<() => void>;
let probe: Mock<() => Promise<ProbeResult>>;
let panel: { rerender: () => void };

const emit = (): void => { for (const listener of listeners) listener(); };

beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  store = createSettingsStore();
  status = { kind: 'unsynced' };
  listeners = new Set();
  probe = vi.fn<() => Promise<ProbeResult>>(async () => ({ ok: true, rttMs: 84, offsetMs: 0 }));
  panel = setupTimeSettings({
    store,
    getLang: () => lang,
    time: {
      status: () => status,
      probe,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
  });
});

describe('time settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupTimeSettings({
      store, getLang: () => lang, time: { status: () => status, probe, subscribe: () => () => {} },
    })).toThrow('#set-time-source');
  });

  it('labels the server option with this site\'s host', () => {
    const option = byId<HTMLSelectElement>('set-time-source').options[0]!;
    expect(option.value).toBe('server');
    expect(option.textContent).toBe(window.location.host);
  });

  it('shows the stored source and the current status when the dialog opens', () => {
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    status = { kind: 'device' };
    clickOn(byId('settings-toggle'));
    expect(byId<HTMLSelectElement>('set-time-source').value).toBe('device');
    expect(text('set-time-status')).toBe("Using this device's clock");
  });

  it('stores a new source and keeps the copy settings', () => {
    store.update((s) => ({ ...s, copy: { ...s.copy, digits: 'persian' } }));
    const select = byId<HTMLSelectElement>('set-time-source');
    select.value = 'device';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().time.source).toBe('device');
    expect(store.get().copy.digits).toBe('persian');
  });

  it('follows the time source as it syncs', () => {
    expect(text('set-time-status')).toBe("Not synced — using this device's clock");
    status = { kind: 'syncing' };
    emit();
    expect(text('set-time-status')).toBe('Syncing…');
  });

  it('runs a test, disabling the button meanwhile, and reports the result', async () => {
    let answer: (result: ProbeResult) => void = () => {};
    probe.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const button = byId<HTMLButtonElement>('set-time-test');

    clickOn(button);
    expect(button.disabled).toBe(true);
    expect(text('set-time-test-result')).toBe('Testing…');

    answer({ ok: true, rttMs: 84, offsetMs: 300 });
    await vi.waitFor(() => { expect(button.disabled).toBe(false); });
    expect(text('set-time-test-result')).toBe('OK · 84 ms · device 0.3 s slow');
  });

  it('reports a failed test', async () => {
    probe.mockResolvedValue({ ok: false });
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).toBe('Unreachable'); });
  });

  it('clears the last test result when the dialog reopens', async () => {
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).not.toBe(''); });
    clickOn(byId('settings-toggle'));
    expect(text('set-time-test-result')).toBe('');
  });

  it('re-renders the status and the last result in the new language', async () => {
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).toMatch(/^OK/); });
    lang = 'fa';
    panel.rerender();
    expect(text('set-time-status')).toBe('همگام نشد — ساعت همین دستگاه');
    expect(text('set-time-test-result')).toBe('برقرار · ۸۴ میلی‌ثانیه · ساعت دستگاه دقیق است');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/time-text.test.ts tests/dom/time-panel.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Write the implementation**

`Site/src/i18n/strings.ts`: extend `StringKey`:

```ts
  | 'copyDigits' | 'digitsLatin' | 'digitsPersian' | 'copyPreview'
  | 'timeSection' | 'timeSourceLabel' | 'sourceDevice' | 'testConnection' | 'testing'
  | 'testOk' | 'testFail' | 'statusDevice' | 'statusSyncing' | 'statusSynced' | 'statusUnsynced'
  | 'driftNone' | 'driftSlow' | 'driftFast';
```

`en` additions (after `copyPreview`):

```ts
    timeSection: 'Time',
    timeSourceLabel: 'Source',
    sourceDevice: 'This device only',
    testConnection: 'Test connection',
    testing: 'Testing…',
    testOk: 'OK · {rtt} ms · {drift}',
    testFail: 'Unreachable',
    statusDevice: "Using this device's clock",
    statusSyncing: 'Syncing…',
    statusSynced: 'Synced {time} · {drift}',
    statusUnsynced: "Not synced — using this device's clock",
    driftNone: 'device clock accurate',
    driftSlow: 'device {s} s slow',
    driftFast: 'device {s} s fast',
```

`fa` additions:

```ts
    timeSection: 'زمان',
    timeSourceLabel: 'منبع',
    sourceDevice: 'فقط همین دستگاه',
    testConnection: 'آزمایش اتصال',
    testing: 'در حال آزمایش…',
    testOk: 'برقرار · {rtt} میلی‌ثانیه · {drift}',
    testFail: 'در دسترس نیست',
    statusDevice: 'ساعت همین دستگاه',
    statusSyncing: 'در حال همگام‌سازی…',
    statusSynced: 'همگام‌شده {time} · {drift}',
    statusUnsynced: 'همگام نشد — ساعت همین دستگاه',
    driftNone: 'ساعت دستگاه دقیق است',
    driftSlow: 'ساعت دستگاه {s} ثانیه عقب است',
    driftFast: 'ساعت دستگاه {s} ثانیه جلو است',
```

```ts
// Site/src/time/time-text.ts
import { formatTemplate, STRINGS, toLocaleDigits, type Lang } from '../i18n/strings';
import type { ProbeResult, TimeStatus } from './time-source';

const seconds = (ms: number, lang: Lang): string => {
  const value = (Math.abs(ms) / 1000).toFixed(1);
  // formatTemplate localizes the digits; Persian also has its own decimal separator.
  return lang === 'fa' ? value.replace('.', '٫') : value;
};

/** offset = server − device, so a positive offset means the device is behind. */
export function driftText(offsetMs: number, lang: Lang): string {
  const strings = STRINGS[lang];
  if (offsetMs === 0) return strings.driftNone;
  const template = offsetMs > 0 ? strings.driftSlow : strings.driftFast;
  return formatTemplate(template, { s: seconds(offsetMs, lang) }, lang);
}

const clockTime = (ms: number, lang: Lang, timeZone: string | undefined): string =>
  toLocaleDigits(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(ms), lang);

export function statusText(status: TimeStatus, lang: Lang, timeZone?: string): string {
  const strings = STRINGS[lang];
  switch (status.kind) {
    case 'device': return strings.statusDevice;
    case 'syncing': return strings.statusSyncing;
    case 'unsynced': return strings.statusUnsynced;
    case 'synced': return formatTemplate(strings.statusSynced, {
      time: clockTime(status.atMs, lang, timeZone), drift: driftText(status.offsetMs, lang),
    }, lang);
  }
}

export function probeText(result: ProbeResult, lang: Lang): string {
  const strings = STRINGS[lang];
  return result.ok
    ? formatTemplate(strings.testOk, { rtt: result.rttMs, drift: driftText(result.offsetMs, lang) }, lang)
    : strings.testFail;
}
```

`Site/index.html`: insert after the copy group's `</fieldset>` and before `</dialog>`:

```html
      <fieldset class="settings-group">
        <legend data-str="timeSection"></legend>
        <label for="set-time-source" data-str="timeSourceLabel"></label>
        <select id="set-time-source">
          <option value="server"></option>
          <option value="device" data-str="sourceDevice"></option>
        </select>
        <p id="set-time-status" class="settings-status"></p>
        <div class="settings-test">
          <button id="set-time-test" type="button" data-str="testConnection"></button>
          <output id="set-time-test-result" aria-live="polite" dir="auto"></output>
        </div>
      </fieldset>
```

```ts
// Site/src/time/time-panel.ts
import { STRINGS, type Lang } from '../i18n/strings';
import type { TimeSourceSetting } from '../settings/settings-model';
import type { SettingsStore } from '../settings/settings-store';
import { probeText, statusText } from './time-text';
import type { ProbeResult, TimeSource } from './time-source';

interface Deps {
  store: SettingsStore;
  time: Pick<TimeSource, 'status' | 'probe' | 'subscribe'>;
  getLang: () => Lang;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** The Settings dialog's Time group: where the time comes from, and a way to check it. */
export function setupTimeSettings({ store, time, getLang }: Deps): { rerender: () => void } {
  const source = byId<HTMLSelectElement>('set-time-source');
  const statusLine = byId<HTMLElement>('set-time-status');
  const testButton = byId<HTMLButtonElement>('set-time-test');
  const testResult = byId<HTMLOutputElement>('set-time-test-result');
  const toggle = byId<HTMLButtonElement>('settings-toggle');

  // Kept so a language switch can re-render the result rather than leave it in the old language.
  let lastResult: ProbeResult | 'testing' | null = null;

  const renderStatus = (): void => { statusLine.textContent = statusText(time.status(), getLang()); };
  const renderResult = (): void => {
    const lang = getLang();
    testResult.textContent = lastResult === null ? ''
      : lastResult === 'testing' ? STRINGS[lang].testing
      : probeText(lastResult, lang);
  };

  source.options[0]!.textContent = window.location.host;

  toggle.addEventListener('click', () => {
    source.value = store.get().time.source;
    lastResult = null;
    renderResult();
    renderStatus();
  });
  source.addEventListener('change', () => {
    store.update((s) => ({ ...s, time: { source: source.value as TimeSourceSetting } }));
  });
  testButton.addEventListener('click', () => {
    testButton.disabled = true;
    lastResult = 'testing';
    renderResult();
    void time.probe().then((result) => {
      lastResult = result;
      testButton.disabled = false;
      renderResult();
    });
  });
  time.subscribe(renderStatus);

  const rerender = (): void => {
    renderStatus();
    renderResult();
  };
  rerender();
  return { rerender };
}
```

(`probe()` never rejects — `takeSample` catches everything — so there is no `.catch` branch to cover. If the implementer adds one anyway, it needs a test.)

`Site/src/styles/components.css`: after `.settings-preview { … }`:

```css
.settings-group + .settings-group { margin-block-start: 1.25rem; }
.settings-status { grid-column: 1 / -1; margin: 0; font-size: 0.85rem; color: var(--text-muted); }
.settings-test { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
#set-time-test {
  background: none; border: 1px solid var(--control-border); color: var(--text);
  border-radius: 999px; padding: 0.25rem 0.8rem; cursor: pointer; font: inherit; font-size: 0.85rem;
}
#set-time-test:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
#set-time-test:disabled { cursor: progress; opacity: 0.6; }
#set-time-test:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#set-time-test-result { font-size: 0.85rem; color: var(--text-muted); unicode-bidi: isolate; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS. This includes `i18n.test.ts`, which must still find every key in both dictionaries.

- [ ] **Step 5: Commit**

```bash
git status --short
git add Site/src/time/time-text.ts Site/src/time/time-panel.ts Site/src/i18n/strings.ts Site/index.html Site/src/styles/components.css Site/tests/time-text.test.ts Site/tests/dom/time-panel.test.ts
git commit -m "feat(site): Settings Time group — source, status line, test connection"
```

---

### Task 5: Endpoint, SW bypass, wiring, midnight fix

**Files:**
- Create: `Site/src/time/minute-gate.ts`, `Site/tests/minute-gate.test.ts`, `Site/e2e/time-sync.spec.ts`
- Modify: `deploy/nginx.conf`, `deploy/security-headers.conf`, `Site/public/sw.js`, `Site/vite.config.ts`, `Site/src/clock/clock.ts`, `Site/src/converter/converter.ts` (signature and lines ~139, ~280), `Site/src/main.ts`
- Test: `Site/tests/dom/converter.test.ts` (one new test)

**Interfaces:**
- Consumes: `createTimeSource` (Task 3), `setupTimeSettings` (Task 4).
- Produces: `createMinuteGate(onChange: (date: Date) => void): (date: Date) => void`; `createClock(mount: HTMLElement, options?: { now?: () => Date; onTick?: (date: Date) => void }): () => void`; `setupConverter(getLang, getCopy, now?: () => Date)`.

- [ ] **Step 1: Write the failing unit tests**

```ts
// Site/tests/minute-gate.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createMinuteGate } from '../src/time/minute-gate';

const at = (iso: string): Date => new Date(iso);

describe('createMinuteGate', () => {
  it('passes the first date and then only the first date of each new minute', () => {
    const onChange = vi.fn();
    const tick = createMinuteGate(onChange);

    tick(at('2026-03-20T20:29:57.000Z'));
    tick(at('2026-03-20T20:29:59.999Z'));
    tick(at('2026-03-20T20:30:00.000Z'));
    tick(at('2026-03-20T20:30:30.000Z'));

    expect(onChange.mock.calls.map(([d]) => (d as Date).toISOString())).toEqual([
      '2026-03-20T20:29:57.000Z', '2026-03-20T20:30:00.000Z',
    ]);
  });

  it('passes a jump backwards too, as after a sync corrects a fast clock', () => {
    const onChange = vi.fn();
    const tick = createMinuteGate(onChange);
    tick(at('2026-03-21T00:00:05.000Z'));
    tick(at('2026-03-20T23:59:58.000Z'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
```

Add to `Site/tests/dom/converter.test.ts`, inside `describe('Today and Copy', …)` (the file's `beforeEach` pins the device clock to 2025-01-11 and builds a converter; this test rebuilds the page so only its own converter is listening):

```ts
  it('Today uses the injected clock, not the device clock', () => {
    document.body.innerHTML = BODY;
    // The server says it is Nowruz 1405; the device still thinks it is 2025-01-11.
    converter = setupConverter(() => lang, () => copySettings, () => new Date('2026-03-21T09:00:00Z'));

    clickOn(byId('btn-today'));

    expect(values('p')).toEqual(['1405', '1', '1']);
    expect(values('g')).toEqual(['2026', '3', '21']);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/minute-gate.test.ts tests/dom/converter.test.ts`
Expected: FAIL. `minute-gate` does not exist, and the converter test sees today's real date.

- [ ] **Step 3: Implement the unit-level pieces**

```ts
// Site/src/time/minute-gate.ts
const MS_PER_MINUTE = 60_000;

/**
 * Lets through the first date of each wall-clock minute — cheap enough to call on
 * every animation frame. Every time zone's offset is a whole number of minutes, so
 * a new UTC minute is a new local minute, Tehran's included.
 */
export function createMinuteGate(onChange: (date: Date) => void): (date: Date) => void {
  let lastMinute: number | null = null;
  return (date) => {
    const minute = Math.floor(date.getTime() / MS_PER_MINUTE);
    if (minute === lastMinute) return;
    lastMinute = minute;
    onChange(date);
  };
}
```

`Site/src/converter/converter.ts`: add the parameter and use it at both `nowSnapshot()` call sites:

```ts
export function setupConverter(
  getLang: () => Lang,
  getCopy: () => CopySettings,
  now: () => Date = () => new Date(),
) {
```
```ts
          const snap = nowSnapshot(now()).local;
```
```ts
    const snap = nowSnapshot(now());
```

(Keep the existing return type annotation, if there is one. Only the parameter list changes.)

Run: `npx vitest run tests/minute-gate.test.ts tests/dom/converter.test.ts` → PASS.

- [ ] **Step 4: Write the failing E2E spec**

```ts
// Site/e2e/time-sync.spec.ts
import { expect, test, type Page, type Route } from '@playwright/test';

// One second before Nowruz 1405 in Tehran: 2026-03-20 23:59:57 +03:30.
const BEFORE_NOWRUZ_SEC = Date.UTC(2026, 2, 20, 20, 29, 57) / 1000;

const answerWith = (body: string, contentType = 'application/json') => (route: Route) =>
  route.fulfill({ status: 200, contentType, headers: { 'Cache-Control': 'no-store' }, body });

const serverAhead = (skewMs: number) => (route: Route) =>
  route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ epochSec: (Date.now() + skewMs) / 1000 }),
  });

const openSettings = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /Settings|تنظیمات/ }).click();
};

test.describe('with the service worker blocked, so page.route sees every request', () => {
  test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`the today panel turns over at midnight without a reload (${reducedMotion} motion)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.route('**/api/time', answerWith(JSON.stringify({ epochSec: BEFORE_NOWRUZ_SEC })));
      await page.goto('/');

      await expect(page.locator('#today-persian')).toContainText('29 Esfand 1404');
      await expect(page.locator('#today-gregorian')).toContainText('March 20, 2026');

      await expect(page.locator('#today-persian')).toContainText('1 Farvardin 1405', { timeout: 10_000 });
      await expect(page.locator('#today-gregorian')).toContainText('March 21, 2026');
    });
  }

  test('a slow device clock is reported and corrected', async ({ page }) => {
    await page.route('**/api/time', serverAhead(5_000));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText(/^Synced \d\d:\d\d · device 5\.0 s slow$/);
  });

  test('a page that is not our JSON falls back to the device clock', async ({ page }) => {
    await page.route('**/api/time', answerWith('<!doctype html><title>Wi-Fi login</title>', 'text/html'));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock");
  });

  test('an unreachable server falls back to the device clock', async ({ page }) => {
    await page.route('**/api/time', (route) => route.abort('internetdisconnected'));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock");
    await page.locator('#set-time-test').click();
    await expect(page.locator('#set-time-test-result')).toHaveText('Unreachable');
  });

  test('device-only makes no request, and the choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.locator('#set-time-source').selectOption('device');
    await expect(page.locator('#set-time-status')).toHaveText("Using this device's clock");

    let requests = 0;
    await page.route('**/api/time', (route) => { requests += 1; return serverAhead(0)(route); });
    await page.reload();
    await openSettings(page);
    await expect(page.locator('#set-time-source')).toHaveValue('device');
    await expect(page.locator('#set-time-status')).toHaveText("Using this device's clock");
    expect(requests).toBe(0);
  });

  test('Test connection reports the round trip', async ({ page }) => {
    await page.route('**/api/time', serverAhead(0));
    await page.goto('/');
    await openSettings(page);
    await page.locator('#set-time-test').click();
    await expect(page.locator('#set-time-test-result')).toHaveText(/^OK · \d+ ms · device clock accurate$/);
  });

  test('the Time group is translated and right-to-left in Persian', async ({ page }) => {
    await page.route('**/api/time', serverAhead(0));
    await page.goto('/');
    await page.locator('#lang-toggle').click();
    await openSettings(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#set-time-test')).toHaveText('آزمایش اتصال');
    await expect(page.locator('#set-time-status')).toHaveText(/^همگام‌شده در [۰-۹]{2}:[۰-۹]{2} · ساعت دستگاه دقیق است$/);
  });
});

test('the service worker never caches /api/time, so offline means the device clock', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The second load is controlled by the worker, so its /api/time requests pass through it.
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await openSettings(page);
  await expect(page.locator('#set-time-status')).toHaveText(/^Synced /);

  const cached = await page.evaluate(async () =>
    (await (await caches.open('time-app-v1')).match('/api/time')) !== undefined);
  expect(cached).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await openSettings(page);
  await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock", { timeout: 15_000 });
  await context.setOffline(false);
});
```

Run: `npm run build && npx playwright test e2e/time-sync.spec.ts`
Expected: FAIL. Nothing is wired yet, so the today panel never shows Esfand and `#set-time-status` stays empty.

- [ ] **Step 5: Implement the endpoint, the SW bypass and the wiring**

`deploy/security-headers.conf`: change the CSP line:

```nginx
add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
```

`deploy/nginx.conf`: after the `/health` location:

```nginx
    # Server time for the client's clock sync: $msec is the request time in seconds
    # with millisecond precision. Never cached — a stored timestamp is a wrong one.
    location = /api/time {
        include /etc/nginx/security-headers.conf;
        default_type application/json;
        add_header Cache-Control "no-store" always;
        return 200 '{"epochSec":$msec}';
    }
```

`Site/public/sw.js`: in the header comment add `//   /api/time → not handled: network-only, never cached`, and in the fetch handler, directly after the origin check:

```js
  // A cached timestamp is a wrong one: the clock sync must always reach the network.
  if (url.pathname === '/api/time') return;
```

`Site/vite.config.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

/**
 * Mirrors deploy/nginx.conf's `location = /api/time` so `npm run dev`, `npm run preview`
 * and the E2E suite exercise a real sync. Dev tooling only — never part of the build.
 */
const apiTime = (): Plugin => {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url?.split('?')[0] !== '/api/time') { next(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ epochSec: Date.now() / 1000 }));
  };
  return {
    name: 'api-time',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
};

export default defineConfig({
  plugins: [apiTime()],
  build: { target: 'es2022' },
  // …test block unchanged…
});
```

`Site/src/clock/clock.ts`:

```ts
export interface ClockOptions {
  /** The time to draw; defaults to the device clock. */
  readonly now?: () => Date;
  /** Called with the drawn time on every frame (every second under reduced motion). */
  readonly onTick?: (date: Date) => void;
}

export function createClock(mount: HTMLElement, { now = () => new Date(), onTick }: ClockOptions = {}): () => void {
```
```ts
  const render = (): void => {
    const date = now();
    const a = handAngles(msSinceLocalMidnight(date));
    hour.setAttribute('transform', `rotate(${a.hour} 100 100)`);
    minute.setAttribute('transform', `rotate(${a.minute} 100 100)`);
    second.setAttribute('transform', `rotate(${a.second} 100 100)`);
    onTick?.(date);
  };
```

`Site/src/main.ts`, the changes:

```ts
import { createTimeSource } from './time/time-source';
import { setupTimeSettings } from './time/time-panel';
import { createMinuteGate } from './time/minute-gate';
```
```ts
function renderToday(): void {
  const snapshot = nowSnapshot(time.now());
  // …rest unchanged…
}

function renderAll(converterRerender: () => void): void {
  renderStatic();
  renderToday();
  converterRerender();
  settingsPanel.rerender();
  timeSettings.rerender();
}

const settings = createSettingsStore();
const time = createTimeSource({ store: settings });
const converter = setupConverter(() => lang, () => settings.get().copy, time.now);
const settingsPanel = setupSettingsPanel({
  store: settings, getLang: () => lang, getDate: () => converter.current(),
});
const timeSettings = setupTimeSettings({ store: settings, time, getLang: () => lang });
```
```ts
} else {
  // No param, or an invalid one — ignore silently and show today.
  const today = nowSnapshot(time.now());
  converter.prefill(today.local.p, today.local.g);
}
renderStatic();
renderToday();

// The today panel is re-rendered once a minute from the clock's own frames: that covers
// local midnight, Tehran midnight and the Tehran time line, with no long timer for iOS to
// throttle. A clock that was hidden restarts on visible and ticks straight away.
const refreshToday = createMinuteGate(() => { renderToday(); });
const clockMount = document.getElementById('clock-mount');
if (clockMount) createClock(clockMount, { now: time.now, onTick: refreshToday });
// A sync can move "now" across a minute or a day; re-check as soon as it lands.
time.subscribe(() => { refreshToday(time.now()); });
time.start();
```

`renderToday` and `time` are both module-level. `renderToday` runs only after `time` is assigned, because the first call comes after `createTimeSource`. Keep the existing order of `renderStatic(); renderToday();` after that assignment.

- [ ] **Step 6: Run the E2E spec and the full suites**

Run:
```bash
lsof -i :4173 -sTCP:LISTEN   # must print nothing: Playwright reuses a running preview,
                             # and an old one has no /api/time middleware
npm run build && npx playwright test e2e/time-sync.spec.ts
npx vitest run --coverage 2>&1 | tail -8
npx playwright test
grep -rn "new Date()\|nowSnapshot()" src/
```
For the `grep`, the only expected hits are the default parameters in `clock/clock.ts`, `converter/converter.ts` and `calendar/now.ts`, plus `time-source.ts`'s `Date.now` default. Any other hit reads the device clock behind `now()`'s back.

If the Nowruz test fails on its *first* assertion ("29 Esfand 1404"), check the date conversion before the wiring. Persian 1405-01-01 is 2026-03-21, and the parity suite covers that range.
Expected:
- `time-sync.spec.ts` passes (9 tests).
- Vitest passes with coverage still 100/100/100/100.
- The full Playwright suite passes, including every existing spec. Existing specs now sync against the Vite middleware; their dates must not change.

If the SW test passes *before* the `sw.js` change (that is, it was not red), stop and report. In that case the test is not proving the bypass.

- [ ] **Step 7: Commit**

```bash
git status --short
git add deploy/nginx.conf deploy/security-headers.conf Site/public/sw.js Site/vite.config.ts \
  Site/src/clock/clock.ts Site/src/converter/converter.ts Site/src/main.ts \
  Site/src/time/minute-gate.ts Site/tests/minute-gate.test.ts Site/tests/dom/converter.test.ts \
  Site/e2e/time-sync.spec.ts
git commit -m "feat: /api/time endpoint, SW bypass, server-synced now(), midnight refresh"
```

---

### Task 6: Docs

**Files:**
- Modify: `README.md`, `docs/SECURITY.md`

- [ ] **Step 1: Update README.md**

- Line 12, replace "After first paint there are zero network round-trips." with:
  "After first paint the only requests are a small same-origin clock sync (`/api/time`, at load and every few hours), which the app does without when offline."
- Repo layout: under `src/`, add
  ```
  │   │   ├── time/           time-sync-model.ts (offset maths, pure), time-source.ts (fetch,
  │   │   │                     schedule, now()), time-text.ts (status text, pure),
  │   │   │                     time-panel.ts (Settings Time group, DOM), minute-gate.ts (pure)
  ```
  and change the `deploy/nginx.conf` line to `static serving, caching, /health, /api/time`.
- "Design and behaviour notes": add a bullet after **Settings**:
  "- **Time source** — the clock, the today panel and the converter's Today take their time from `/api/time` on this site (best of three round trips, half the round trip credited to the server, offsets under 250 ms ignored), re-synced at load, on return after five minutes away and every six hours. Settings → Time shows where the time comes from and when it last synced, has a Test connection button, and can switch to this device's clock only. Unreachable or invalid answers keep the last good offset for up to 24 hours, then use the device clock. The today panel refreshes every minute from the clock's own frames, so it turns over at midnight (local and Tehran) even when the app is left open."
- **Settings** bullet: append "The Time group is described below."
- **Privacy** bullet: replace with
  "- **Privacy** — no cookies, no analytics, no third-party requests, no personal data processed. The only request after load is `GET /api/time` to this same site; it carries nothing about you and its answer is the server's clock. The browser keeps only your language and settings in `localStorage`; they never leave it. See `docs/SECURITY.md`."
- PWA strategy table: add a first row
  `| `/api/time` | Not handled (network-only) | Never cached: a stored timestamp is a wrong one. Offline, the sync fails and the app uses the device clock. |`
- Serving configuration: add `- `/api/time` → `{"epochSec":<seconds.millis>}` (an nginx `return` of `$msec`), `Cache-Control: no-store``, and change the CSP text to `CSP (`default-src 'self'`, `connect-src 'self'`, no external origins …`.
- Running locally: after the preview block add one line: "Both servers answer `/api/time` themselves (a Vite middleware mirroring the nginx location), so the clock sync works locally too."
- Test counts and coverage numbers: replace them with the numbers from the final run, at all three places (layout, Vitest heading, Playwright heading) and in the coverage sentence. Add `time-sync.spec.ts` to the e2e list in the layout. Update the bundle sizes from `npm run build` output.

- [ ] **Step 2: Update docs/SECURITY.md**

- Line ~26, change "no forms submitted anywhere, no cookies, no analytics, no third-party requests, no server-side state, no database." to keep the same list and add after it: "Its only dynamic answer is the server clock at `/api/time` — an nginx `return`, no application code."
- Line ~60, "Browser-side hardening": CSP becomes "`default-src 'self'; connect-src 'self'` with no external origins".
- Line ~111: replace "(`default-src 'self'`, no `connect-src` escape hatch)" with "(`default-src 'self'`, and an explicit `connect-src 'self'` that allows only the same-origin `/api/time`)".

- [ ] **Step 3: Check the wording against the code**

Run: `grep -n "api/time\|connect-src" README.md docs/SECURITY.md deploy/*.conf Site/public/sw.js`
Expected: every claim in the docs matches a line in the config or code.

- [ ] **Step 4: Commit**

```bash
git status --short
git add README.md docs/SECURITY.md
git commit -m "docs: time sync — endpoint, SW strategy, privacy, CSP"
```

---

### Task 7: Verify on the real server stack (no commit)

The plan's E2E runs against Vite. This task runs the shipped image, the only place where the nginx location exists before deploy.

- [ ] **Step 1: Build and run the production image** (from the repo root)

```bash
lsof -i :8080 -sTCP:LISTEN   # must print nothing
docker build -t time-app:b-verify .
docker run -d --rm --name time-b-verify -p 8080:8080 time-app:b-verify
```

- [ ] **Step 2: Check the endpoint and headers**

```bash
curl -si http://localhost:8080/api/time
curl -sI http://localhost:8080/ | grep -i content-security-policy
```
Expected:
- `/api/time` returns `HTTP/1.1 200`, `Content-Type: application/json`, `Cache-Control: no-store`, the full CSP header including `connect-src 'self'`, and a body like `{"epochSec":1792043370.981}`.
- `/` carries the CSP with `connect-src 'self'`.

- [ ] **Step 3: Drive it in Chrome** (Claude in Chrome MCP), at `http://localhost:8080/`
- The page loads, and the network panel shows three `GET /api/time` returning 200.
- Settings → Time shows `localhost:8080` as the server option and `Synced HH:MM · device clock accurate`.
- Test connection shows `OK · N ms · …`.
- Switch to "This device only": the status says so, and a reload makes no `/api/time` request.
- Switch back: it syncs again.
- FA: the group is translated and right-to-left.
- Screenshot the dialog in both languages.

- [ ] **Step 4: Clean up**

```bash
docker stop time-b-verify
docker rmi time-app:b-verify
lsof -i :8080 -i :4173 -sTCP:LISTEN || true   # expect nothing
```

- [ ] **Step 5: After a deploy (only if the user asks to push):** `curl -si https://time.automated.ink/api/time` with the same expectations as Step 2. Then drive the live site's Settings → Time in Chrome.

---

## Not in this plan (surfaced, not done)

- Adding `/api/time` to the CI "Verify deployment" curl loop in `.github/workflows/ci.yml`.
- The converter keeps the date it was prefilled with: if the app stays open across midnight with the converter untouched, the converter still shows yesterday, while the today panel shows the new day. The spec only requires the today panel to refresh.
- The iPhone left-open-across-midnight check is user-performed.

# Settings, time fetching, calendar views and holidays — design

Date: 2026-10-14 · Status: approved in brainstorming, pending written-spec review

## Intent

Three features for the installed PWA (used daily as an iPhone app left open for days):

1. A settings panel, and a configurable clipboard format (default `yyyy-mm-dd`).
2. Time fetched from our server (UTC), falling back to the device clock.
3. Collapsible calendar views under the clock, marked with official holidays (Iran,
   Nuremberg) and user-defined ones.

**Success:** the app behaves identically in airplane mode (device clock, last cached
holidays, estimates); the settings panel shows where each piece of data came from; the
today panel is never stale after midnight.

**Delivery order:** A (settings + copy) → B (time, includes the midnight fix) → C (views +
holidays). Each is a separate plan and can ship on its own.

## Root-cause note: the "out of sync after a day" symptom

The clock hands read `new Date()` every frame (`Site/src/clock/clock.ts`) and are always as
correct as the device clock. The **today panel** is the stale part: `renderToday()` runs only
at load and on language toggle (`Site/src/main.ts`), so after midnight it keeps showing
yesterday. B fixes this independently of the server fetch.

## Architecture

Still a static bundle behind nginx. **No new server process.**

```
browser ──same-origin only──► nginx
  ├─ /api/time                    exact-match location, `return 200`, Cache-Control: no-store
  ├─ /api/holidays/ir/{year}.json static file, committed under Site/public/
  └─ everything else              unchanged static bundle
```

- **CSP:** same-origin `fetch` is already permitted (`connect-src` falls back to
  `default-src 'self'`). `connect-src 'self'` is added to `deploy/security-headers.conf` to
  make that explicit. No third-party origin is ever allowed.
- **Service worker:** `/api/time` bypasses the SW entirely (network-only, never cached).
  `/api/holidays/**` is stale-while-revalidate.
- **Degradation:** nothing blocks first paint. Network results only refine already-rendered
  values. Time → device clock; holidays → SW cache → computed estimate.
- **Privacy:** requests go only to our own origin and carry no personal data. Settings and
  user holidays stay in `localStorage`. README "Privacy" and `docs/SECURITY.md` are updated
  to drop "zero network round-trips" and describe the two same-origin endpoints.

New client modules (same split as the existing code: pure logic files are DOM-free and
100%-covered; DOM wiring is separate):

| Module | Responsibility |
|---|---|
| `src/settings/settings-model.ts` | Pure: `Settings` type, defaults, `parseSettings(unknown) → Settings` (per-field fallback) |
| `src/settings/settings-store.ts` | localStorage read/write of key `settings.v1`, change subscription |
| `src/settings/settings-panel.ts` | DOM: gear button + panel on top of `ui/popup.ts` |
| `src/copy/copy-format.ts` | Pure: pattern tokenizer + formatter |
| `src/time/time-sync-model.ts` | Pure: offset maths, best-of-N, dead band, expiry, body validation |
| `src/time/time-source.ts` | Fetch + scheduling; exposes `now(): Date`, status, `subscribe` |
| `src/holidays/rules-ir.ts` | Pure: Iranian solar holidays |
| `src/holidays/rules-by.ts` | Pure: Easter computus + Bavarian rules, Nuremberg variant |
| `src/holidays/lunar-estimate.ts` | Pure: Iranian lunar holidays estimated via `Intl` `islamic-umalqura` |
| `src/holidays/holiday-data.ts` | Fetch + validate `/api/holidays/ir/{y}.json` |
| `src/holidays/merge.ts` | Pure: official ∪ estimated ∪ user → per-month holiday list |
| `src/views/calendar-panels.ts` | DOM: `<details>` panels under the clock, reusing `calendar-grid-model.ts` |

## A — Settings panel and copy format

**Entry point:** a gear button in the header beside the EN/FA toggle, opening a panel built
on `ui/popup.ts` (focus trap, Escape, focus return, RTL). Groups: **Copy**, **Time**,
**Calendars & holidays**. A group is only rendered once its feature ships.

**Storage:** one key `settings.v1`, JSON. `parseSettings` validates each field separately;
an invalid or missing field takes its default, and the rest are kept. Write failures
(private mode, quota) are swallowed: the session keeps its in-memory settings.

**Copy settings**

| Field | Values | Default |
|---|---|---|
| `copy.calendar` | `persian` · `gregorian` · `both` | `persian` |
| `copy.pattern` | presets `yyyy-mm-dd`, `yyyy/mm/dd`, `dd.mm.yyyy`, `sentence`, or a custom string | `yyyy-mm-dd` |
| `copy.digits` | `latin` · `persian` | `latin` |

- Tokens: `yyyy`, `mm` (2-digit), `m`, `dd` (2-digit), `d`, `MMMM` (month name in the
  current UI language), `dddd` (weekday name). Longest token wins; any other text is copied
  literally. An empty custom pattern falls back to `yyyy-mm-dd`.
- `both` joins Persian then Gregorian with ` / ` (e.g. `1405-07-22 / 2026-10-14`).
- `sentence` reproduces today's `copySentence` output exactly (calendar/digits ignored).
- Live preview under the field shows what Copy will produce for the converter's current
  date.
- The on-screen "Full date line" is unchanged; only the clipboard output is configurable.
  The Copy button's `title` shows the active pattern.

## B — Time fetching

**Endpoint:** `deploy/nginx.conf`
`location = /api/time { default_type application/json; add_header Cache-Control "no-store" always; return 200 '{"epochSec":$msec}'; }`
(security headers must still be included in that location, since nginx `add_header` does not
inherit when a location defines its own).

**Settings → Time:** `time.source` = `server` (label "time.automated.ink", default) ·
`device`. A **Test connection** button runs one sample and reports inline
(`OK · 84 ms · device is +0.3 s off` / `Unreachable — using device clock`). A status line
shows `Last synced 14:02 · offset +0.3 s` or `Device clock`.

**Algorithm**
- Sample: `t0 = performance.now()`, fetch, `t1`; `offset = server + rtt/2 − deviceNow`.
- Sync = 3 samples, keep the one with the smallest RTT.
- Dead band: `|offset| < 250 ms` → offset 0.
- Triggers: load; `visibilitychange` to visible after ≥ 5 min hidden; every 6 h while
  visible. Timeout 3 s per sample.
- Failure (network, timeout, non-200, invalid body): keep last good offset until it is 24 h
  old, then offset 0 (device clock). No banner; status line only.
- Offset applies immediately (one possible second-hand jump; no slewing).
- `now()` is the single time source for the clock, the today panel, the converter's
  "Today" button and the calendar views' today marker.

**Midnight fix:** no long timer (iOS WebKit throttles or suspends them, which is exactly
the left-open-for-a-day case). The clock's existing render tick (rAF, or the 1 s interval
under reduced motion) compares `now()`'s local `y-m-d` with the last rendered date and
re-renders the today panel when it changes. `visibilitychange` to visible and each completed
sync also trigger the check.

## C — Calendar views and holidays

**Views:** stack of `<details>` panels under the clock — **Persian month** (Sat-first) and
**Gregorian month** (Mon-first), laid out with `calendar-grid-model.ts` and the existing
grid styles. Each has ‹ › month paging and a Today control. Clicking a day prefills the
converter on that day (same path as the calendar popup's pick). Today outlined; holidays
get a dot and holiday colour. Below each grid, the month's holidays: date, name, source tag
(Iran / Nuremberg / Mine), and "estimated" where applicable.

**Settings → Calendars & holidays**

| Field | Default |
|---|---|
| `views.persian.enabled` / `.open` | `true` / `true` |
| `views.gregorian.enabled` / `.open` | `true` / `false` |
| `holidays.sources` (multi-select: `ir`, `nuremberg`, `user`) | `ir`, `nuremberg`, `user` |
| `holidays.user[]` `{ id, name, calendar: persian\|gregorian, month, day, year?: number }` | `[]` |

User holidays: add/edit/delete in the panel; no `year` means every year. Name max 60 chars,
stored and rendered as text only. A user holiday dated Esfand 30 or Feb 29 appears only in
years where that day exists.

**Test connection (holidays):** fetches `/api/holidays/ir/{current Persian year}.json`;
reports `OK · 1405 official data · updated 2026-10-12` or
`No official data for 1406 — using estimates`.

**Rules**

- Iran, solar: 1–4 Farvardin (Nowruz), 12 Farvardin, 13 Farvardin, 14 Khordad, 15 Khordad,
  22 Bahman, 29 Esfand.
- Iran, lunar (Hijri day → key): 9 Muharram Tasua, 10 Muharram Ashura, 20 Safar Arbaeen,
  28 Safar, last day of Safar, 8 Rabi I, 17 Rabi I, 3 Jumada II, 13 Rajab, 27 Rajab,
  15 Sha'ban, 21 Ramadan, 1–2 Shawwal, 25 Shawwal, 10 Dhu al-Hijjah, 18 Dhu al-Hijjah.
  The crawler is the check on this list: an official holiday whose description has no key
  fails the Action.
- Nuremberg (Bavaria without Assumption Day): 1 Jan, 6 Jan, Good Friday, Easter Monday,
  1 May, Ascension, Whit Monday, Corpus Christi, 3 Oct, 1 Nov, 25 Dec, 26 Dec. Easter via
  the anonymous Gregorian computus.

**Lunar estimate shape:** `Intl` formats a Gregorian `Date` as `islamic-umalqura` but cannot
convert Hijri → Gregorian, so `lunar-estimate.ts` iterates the days of the Persian year and
collects the days whose Hijri month/day match the rule list (memoized per year). Iranian
moon sighting can differ from Umm al-Qura by a day either way.

**Merge precedence (Iran lunar):** official file for that Persian year if present and valid →
otherwise `lunar-estimate.ts`, flagged `estimated`. A Gregorian month spans two Persian
years at most; both are looked up.

**Data file** `Site/public/api/holidays/ir/{year}.json`:
```json
{ "year": 1405, "source": "holidayapi.ir", "fetched": "2026-10-12",
  "holidays": [{ "key": "ir.ashura", "p": "1405-04-04" }] }
```
Validation: `year` matches the URL, every `key` known, every `p` a valid date in that year.
Any failure → whole file ignored → estimates.

**Names:** every holiday key has EN and FA strings in `i18n/strings.ts`.

**Crawler Action** `.github/workflows/holidays-ir.yml`, weekly + manual dispatch:
- Script (TypeScript, run with `tsx`, under `tools/holidays-crawler/`) queries
  `https://holidayapi.ir/jalali/{y}/{m}/{d}` for the current and next Persian year,
  sequentially with a short delay, keeps rows where `is_holiday && is_religious`, maps
  descriptions to keys, writes the JSON files.
- Unknown description or HTTP failure → job fails, no PR.
- Changes → a PR via `peter-evans/create-pull-request`; no change → nothing.
- The user verifies a PR against the official calendar before merging.

## Error handling summary

| Failure | Behaviour |
|---|---|
| `settings.v1` corrupt / partially invalid | Per-field defaults; valid fields kept |
| localStorage unavailable | In-memory settings for the session |
| `/api/time` fails or is invalid | Last good offset ≤ 24 h, then device clock; status line |
| Holiday file missing / invalid / offline uncached | Estimates, labelled "estimated" |
| Clipboard write rejected | Existing "Copy failed" state |
| Crawler upstream down or unknown holiday | Action fails visibly; site unaffected |

## Testing

- **Vitest, pure modules at 100%:** settings parsing, copy tokenizer/formatter, time
  offset/best-of-N/dead band/expiry/body validation, Easter computus against an independent
  table for 2000–2100, Bavarian and Iranian solar rules, lunar estimate within ±1 day of each
  committed official file (an acceptance check per year as files are added, not a fixed
  assertion; no file exists until C's first crawl), merge precedence, data-file validation.
- **Vitest + DOM:** settings panel, calendar panels, time-source scheduling with fake
  timers.
- **Playwright:** the service worker is active in the existing E2E suite, and `page.route`
  does not intercept fetches the SW makes itself; tests that mock `/api/holidays/**` must
  block the SW (`serviceWorkers: 'block'`) or mock at the network level, decided in C's
  plan. Settings persist across reload; copy uses the chosen pattern; `/api/time`
  route-mocked success / skew / failure / offline; panel toggles, paging, day click →
  converter, holiday marking, add/delete a user holiday; offline with SW cache; EN/FA + RTL
  for every new surface.
- **Crawler:** unit tests for parsing and mapping against recorded responses; the live
  crawl is only exercised by manual dispatch.
- **Deployed check (Claude):** `/api/time` and a holiday file return 200 with correct
  headers and CSP on time.automated.ink.
- **Device check (user-performed):** the installed iPhone PWA left open across midnight
  shows the new date. Claude cannot run this.

## Docs

README: features, settings, endpoints, privacy, test counts, repo layout, and the
"Full date line" bullet, which currently says the on-screen line equals the clipboard (no
longer true with a configurable copy format). `docs/SECURITY.md`:
CSP change and same-origin requests. "Not implemented" keeps additional calendars as not
planned.

## Out of scope

User-entered server URLs; accounts or server-side user data; import/export of user
holidays; other countries; clock slewing; notifications.

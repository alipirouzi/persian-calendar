# Persian Calendar

Persian (Shamsi / Solar Hijri) ↔ Gregorian date conversion and a live watch —
bilingual EN/FA with full RTL, installable as an offline PWA.

**Live:** <https://time.automated.ink/>

## What it is

A **fully static, client-side site**. There is no application server: nginx serves a
handful of hashed files, and every conversion, watch frame, and language switch happens
in the visitor's browser. After first paint the only requests are a small same-origin clock sync (`/api/time`, at load and every few hours), which the app does without when offline.

### Why static

The previous version of this project was Blazor Server. That meant every keystroke in the
converter was a SignalR round-trip, a server-side timer re-rendered and pushed the clock
to every connected client once per second, and each visitor held an open websocket plus a
server-side circuit. The conversion arithmetic itself takes microseconds — effectively all
of the perceived latency was transport. Moving to a static bundle removes the transport,
the per-visitor server state, and the server-side scaling concern in one step.

The shipped bundle is **63.9 kB of JavaScript (23.8 kB gzipped)** and **25.5 kB of CSS
(5.4 kB gzipped)**, with no runtime framework. The Bodoni Moda face adds a 14.5 kB woff2
(Latin subset, one weight).

## Repo layout

Two things live here: a **C# reference implementation** (which also generates the test
vectors that prove the TypeScript port correct) and the **static site** (the product).

```
PersianCalendar/
├── Lib/                    C# reference implementation
│   ├── PersianDate.cs        record struct
│   ├── CalendarConverter.cs  Convert(PersianDate) / Convert(DateTime),
│   │                         backed by System.Globalization.PersianCalendar
│   └── VectorGenerator.cs    emits parity vectors as JSON, via CalendarConverter
├── Console/                CLI
│   └── Program.cs          prints today's Persian date; --generate-vectors mode
├── Tests/                  NUnit tests for Lib + the vector generator (19 tests)
│
├── Site/                   THE PRODUCT — static site, Vite + vanilla TypeScript
│   ├── index.html          single page, semantic markup
│   ├── src/
│   │   ├── calendar/       persian.ts (algorithm port), now.ts (today snapshot)
│   │   ├── watch/          hands.ts (pure: time → hand angles, beat), face.ts (face interface + ids),
│   │   │                     analog.ts / digital.ts (the two faces),
│   │   │                     watch-settings.ts (Settings Watch group),
│   │   │                     watch.ts (driver: frames, visibility, reduced motion)
│   │   ├── converter/      converter-core.ts (pure), converter.ts (DOM wiring),
│   │   │                     field-options.ts (pure year/month/day option lists),
│   │   │                     calendar-grid-model.ts (pure day/month/year page layout),
│   │   │                     calendar-views.ts (pure strategy per calendar view),
│   │   │                     url-state.ts (parse/format ?p=/?g= query params)
│   │   ├── ui/             popup.ts — open/close, ARIA, dismissal, focus, placement,
│   │   │                     grid-navigation.ts — pure key → intent for any grid,
│   │   │                     number-picker.ts — ARIA listbox popup, DOM only,
│   │   │                     calendar-grid.ts — ARIA grid date wizard, DOM only,
│   │   │                     numeric-input.ts — digit-only field filter (pure + DOM)
│   │   ├── copy/           copy-format.ts — pattern tokenizer and clipboard formatter (pure),
│   │   ├── holidays/       holiday-data.ts (official-file parse + fetch, all-or-nothing),
│   │   │                     holiday-service.ts (per-year cache, hourly retry), merge.ts (sources → days),
│   │   │                     rules-ir.ts / rules-by.ts / lunar-estimate.ts (fixed and estimated rules),
│   │   │                     holiday-keys.ts, holidays-panel.ts + user-holiday-form.ts (Settings group)
│   │   ├── views/          calendar-panels.ts — the two month views and their holiday lists
│   │   ├── settings/       settings-model.ts (types, defaults, validation, pure),
│   │   │                     settings-store.ts (localStorage `settings.v1`, subscribe),
│   │   │                     settings-panel.ts (native modal dialog, DOM only),
│   │   ├── time/           time-sync-model.ts (offset maths, pure), time-source.ts (fetch,
│   │   │                     schedule, now()), time-text.ts (status text, pure),
│   │   │                     time-panel.ts (Settings Time group, DOM), minute-gate.ts (pure)
│   │   ├── i18n/           strings.ts — EN/FA dictionaries + Persian-Indic digits,
│   │   │                     format.ts — weekday name + shareable copy sentence
│   │   └── styles/         tokens.css, base.css, components.css
│   ├── public/api/holidays/ir/   official holiday data, one {year}.json per Persian year
│   │                         (added by reviewed PRs from the crawler; absent until the first one merges)
│   ├── tests/              Vitest (588 tests at 100% coverage, incl. .NET parity and the crawler;
│   │                         tests/dom/ runs the DOM units under jsdom)
│   └── e2e/                Playwright (172 tests, incl. converter-ux.spec.ts, watch.spec.ts,
│                             picker.spec.ts, calendar.spec.ts, settings.spec.ts,
│                             time-sync.spec.ts, calendar-views.spec.ts, holiday-settings.spec.ts
│                             and the screenshot matrix)
├── tools/holidays-crawler/ crawl.ts (CLI) + holidayapi.ts — builds the holiday data files
│
├── deploy/
│   ├── nginx.conf             static serving, caching, /health, /api/time, /api/holidays/
│   └── security-headers.conf  CSP and friends
├── Dockerfile              node:22-alpine build → nginx:1.27-alpine runtime
└── .github/workflows/
    ├── ci.yml              dotnet → site → deploy
    └── holidays-ir.yml     weekly holiday-data crawl → pull request
```

The C# side is **not** dead code and is not shipped to users. It is the correctness oracle:
`Console --generate-vectors` walks every day in range through
`Lib.CalendarConverter` — the same conversion path the .NET app uses, itself backed by
`System.Globalization.PersianCalendar` — and emits the vectors that the TypeScript parity
test asserts against. If a .NET version ever
changes its Persian calendar behaviour, CI fails.

## Running locally

The site needs only Node 22+:

```bash
cd Site
npm install
npm run dev          # http://localhost:5173
```

Production build and a local preview of exactly what ships:

```bash
cd Site
npm run build        # tsc --noEmit + vite build → Site/dist
npm run preview      # http://localhost:4173
```

Both servers answer `/api/time` themselves (a Vite middleware mirroring the nginx location), so the clock sync works locally too.

The C# side needs the .NET 10 SDK:

```bash
dotnet run --project Console     # prints today's Persian date
```

## Testing

### C# (NUnit) — 19 tests

```bash
dotnet build -warnaserror
dotnet test
```

### Site unit tests (Vitest) — 588 tests, 100% coverage

The parity suite reads `Site/tests/fixtures/vectors.json`, which is **generated, not
committed**. Generate it first (requires the .NET 10 SDK):

```bash
cd Site
npm run gen:vectors   # dotnet run --project ../Console -- --generate-vectors ... 1200 1500
npm test
npm run test:coverage  # the same suite, with v8 coverage and 100% thresholds
```

`npm run gen:vectors` only has to be re-run if the vectors file is missing or the range
changes. Without it the parity test cannot run.

Coverage is enforced, not merely reported: `vite.config.ts` sets a **100% threshold on
lines, statements, branches and functions**, and the suite currently meets all four
(3624/3624 lines, 3624/3624 statements, 1427/1427 branches, 376/376 functions). Only
`src/main.ts` (the bootstrap) is excluded; `src/watch/**` is covered. Tests under `tests/dom/` run
in jsdom — that is where `popup.ts`, `number-picker.ts`, `calendar-grid.ts`,
`numeric-input.ts` and `converter.ts` are exercised, the last of them against the real
`index.html` body rather than a hand-copied fixture. Everything else runs in the faster
node environment. CI runs `npm run test:coverage`, so the threshold gates the pipeline as well as local
runs.

### E2E (Playwright) — 171 tests (171 passed in the last full run; one test may skip itself)

The one self-skipping test (`an above-anchored popup keeps its head still between views`, `e2e/calendar.spec.ts`) skips when the Gregorian calendar popup does not open upward at 375×812.

```bash
cd Site
npx playwright install --with-deps chromium   # first time only
npm run e2e
```

Playwright starts `npm run preview` itself and tests the real production build. Coverage:
today prefilled and cross-checked against ICU's Persian calendar, live conversion in both
directions, month-aware localized validation errors, FA toggle → RTL + Persian digits,
watch hands actually moving, the `prefers-reduced-motion` interval fallback
still advancing them, a light/dark × 320/375/430/768/820/1024/1440 screenshot matrix
written to `Site/test-results/screens/`, and the PWA/mobile checks described below.
`e2e/converter-ux.spec.ts` covers the converter UX work specifically: localized month
options surviving the language toggle, Persian-Indic digit input, the full date line and the
Today/Copy status row (including the copy-failed state), `?p=`/`?g=` URL round-tripping
via `replaceState`, and invalid URL params falling back to today.
`e2e/picker.spec.ts` covers the year, month and day pickers: chevron and keyboard opening,
arrow/Home/End/Enter/Escape/Tab handling, click-outside dismissal, day lists that follow
the real month length (including leap Esfand) and fall back to a plain 1–31 list without a
usable year, weekday-labelled day options, the year list spanning the whole supported range
and only being built once opened, fields refusing non-numeric characters (typed and pasted),
`maxlength` caps, ARIA state (`aria-expanded`, `aria-activedescendant`, `aria-selected`),
localized toggle names, and touch-target sizes for the options on a phone.
`e2e/calendar.spec.ts` covers the calendar: Persian weeks starting Saturday and Gregorian
weeks starting Monday, the grid opening on the entered month with today and the selection
marked, picking a day driving the conversion, month navigation across a year boundary and
stopping at a range bound, full keyboard operation (arrows, `PageUp`/`PageDown`, `Enter`,
`Escape` with focus returned to the button), a single popup open at a time across pickers and
calendars, the grid following the language toggle, and touch-target sizes on a phone. It also
covers the drill-down: the title stepping up to years and back down through months to days,
a shorter month clamping the day, paging that means a month, a year or twelve years
depending on the view, the grid hugging its rows instead of reserving a sixth, every view
fitting a 320 px viewport in both languages, and the popup never switching sides mid-flow.

## PWA

The site installs as a Progressive Web App: `site.webmanifest` (name, `display: standalone`,
theme colors) plus generated icons — `192`, `512`, `512 maskable`, and a `180` apple-touch-icon —
served from `/icons/`. Regenerate the icons after changing the source artwork with:

```bash
cd Site
npm run gen:icons     # node scripts/gen-icons.mjs
```

Offline support comes from a hand-rolled service worker at `Site/public/sw.js` (no Workbox,
no build-time injection), registered against a single cache, `time-app-v1`. The strategy
differs by request type:

| Request | Strategy | Notes |
|---|---|---|
| `/api/time` | Not handled (network-only) | Never cached: a stored timestamp is a wrong one. Offline, the sync fails and the app uses the device clock. |
| Navigations (`mode: 'navigate'`) | Network-first | Falls back to the cached `/` shell when the network is unreachable; `/` is the only navigation cache key. |
| `/assets/*` (hashed, immutable) | Cache-first | Fetched once and never revalidated — matches the `immutable` `Cache-Control` these paths already ship with. |
| Everything else same-origin (e.g. the manifest, icons, `/api/holidays/ir/*.json`) | Stale-while-revalidate | The cached copy is served immediately while a background fetch (extended via `event.waitUntil`) refreshes the cache for next time. |

Partial responses (HTTP 206) are never written to the cache by any of the three strategies. To
invalidate everything that's cached — after a breaking change to a cached asset, for example —
bump the `CACHE` constant in `sw.js`; the `activate` handler deletes any cache whose name no
longer matches.

The Playwright suite's viewport and locale matrix was widened alongside this work: light/dark
screenshots at 320, 375, 430, 768, 820, 1024, and 1440 px; a landscape-phone case (844×390)
asserting the watch shrinks so the today panel stays reachable; FA/RTL screenshots at 375 and
820; and dedicated tests confirming the manifest and icons resolve and that the service worker
actually serves the app while offline (172 tests total across the whole E2E suite, including
the later converter UX additions in `converter-ux.spec.ts`, `picker.spec.ts` and
`calendar.spec.ts`, `time-sync.spec.ts` for the clock sync, and `calendar-views.spec.ts` and
`holiday-settings.spec.ts` for the month views and holidays, and `watch.spec.ts` for the faces
and the wide-screen layout, with the `watch-*` screenshots in `Site/test-results/screens/`).

## Supported conversion range: Persian years 1200–1500 AP

The UI accepts and the algorithm guarantees **1200–1500 AP**, and nothing outside it. The
Gregorian side accepts **1821–2122 CE**: exactly the image of that Persian range
(1200-01-01 AP is 1821-03-21 CE, 1500-12-30 AP is 2122-03-20 CE), so every date the app
converts in one direction is a date it also accepts in the other.

This is not an arbitrary limit — it is exactly the range where correctness is *proven*.
The parity suite asserts the TypeScript port is bit-exact against
`System.Globalization.PersianCalendar` for every single day in that range (~110,000 days),
in both directions, including every leap year and 30 Esfand. At 1502 AP the arithmetic
(Birashk-style) algorithm and the astronomical calendar begin to diverge, so beyond 1500
the two implementations no longer agree and correctness could not be asserted. Rather than
ship dates we cannot prove, the range is capped where the proof holds.

## Licensing

The project code is MIT licensed (see `LICENSE`). Fonts are self-hosted via npm:
Inter, Cormorant Garamond, Bodoni Moda and Vazirmatn, all under the SIL Open Font License.

## Design and behaviour notes

- **Watch** — two faces chosen in Settings → Watch: **Analog** (default) and
  **Digital**. Both always use Latin digits, also in the Persian UI.
  - **Analog:** inline SVG, a Breguet-style dial with a railway minute track, twelve Cormorant Garamond
    numerals, blued leaf hands that reach their scales, and a seconds hand that ticks 8 times a
    second.
  - **Digital:** HTML text (not SVG), HH:MM in Bodoni Moda with small blued seconds; it always reads left-to-right.
  - Colours are CSS custom properties (`--wa-*` for Analog, `--wd-*` for Digital) that follow the system light/dark setting and
    restyle live (there is deliberately no manual override). Every colour is applied through
    classes, never `style` attributes, so the watch works under `style-src 'self'`.
  - **Battery:** the watch redraws only when the 125 ms beat changes (about 8 fps); everything
    stops while the page is hidden. `prefers-reduced-motion: reduce` steps the hands once a
    second.
  - **Layout:** on phones the watch fills the width (`min(92vw, 62vh)`), unchanged. From 1024 px
    the watch is at most 360 px and sits, with the today lines, in a sticky, vertically centred
    left column, while the converter and month views scroll on the right; RTL mirrors the
    columns.
- **Converter** — prefilled with today, no Convert button; editing either side converts on
  input, last-edited side wins. All six fields are plain text inputs (`inputmode="numeric"`)
  and digit-tolerant: Persian-Indic (`۱۴۰۵`), Arabic-Indic (`١٤٠٥`), and ASCII digits are all
  accepted interchangeably. Anything that is not a digit in one of those three scripts is
  rejected at the keystroke — typing or pasting `1403-10-22` into a field leaves digits only —
  and each field is length-capped (`maxlength` 4 on the year, 2 on month and day). Out-of-range
  *numbers* still reach the converter and still raise the localized range errors, because
  blocking those at the keystroke would break typing `3` on the way to `30`.
  All six fields are **type-or-pick**: type the number for speed, or open the chevron for an
  ARIA listbox of options — years as a plain numeral list spanning the whole supported range,
  months labelled with their localized name ("5 Mordad"), days labelled with their weekday
  ("22 Saturday", computed from the year and month currently entered, falling back to a plain
  1–31 list when either is unusable). Option DOM is built on first open rather than up front,
  so the ~600 year rows never land on the page unless someone asks for them.
  Year, month and day share one cell geometry — the same width and the same padding reserved
  on both sides — so every value stays optically centred and the chevron sits in whitespace
  the cell already had rather than making the picker fields narrower than the year. Popup rows
  are a two-column grid (a tabular numeral column, then the name), so numerals and names each
  line up down the list instead of sitting ragged; logical alignment mirrors it under RTL.
  Validation messages are localized and month-aware ("Esfand has 29 days
  in 1404"). On desktop the converter, including the status row below, sits entirely above
  the fold (it sits in the right column beside the sticky watch).
- **Calendar** — each side's legend carries a calendar button that opens a browsable month
  grid for that calendar: **Persian weeks start on Saturday, Gregorian weeks start on Monday**,
  headers and month title localized. The grid opens on the month currently in the fields
  (today when they are unusable), outlines today and fills the selected day, and steps a month
  at a time with the ‹ / › buttons or `PageUp`/`PageDown` — disabled at the ends of the
  supported range. It is an ARIA grid: arrows move a day or a week and roll into the adjacent
  month, `Home`/`End` jump to the ends of the displayed week, `Enter`/`Space` picks, `Escape`
  closes and returns focus to the button. Picking a day fills that side and converts. Only one
  popup — picker or calendar — is open at a time.
  The title is itself a button and the grid is a **three-step wizard**: press it to step up to
  a page of twelve years, choose a year to get that year's twelve months, choose a month to
  get its days, and choose a day to pick the date. The title is disabled at the years view,
  which is the top. Paging means whatever the view means — a month, a year, or twelve years —
  and coming into a shorter month brings the day back inside it, so Farvardin 31 → Esfand
  lands on 29 rather than nowhere. The months and years views lay twelve cells out in three
  columns at the same total width as the seven-column day grid, so the popup never resizes
  under the pointer.
  The grid **hugs its rows**: about 79% of months need five, so reserving a sixth left a dead
  band in the common case to smooth a transition that happens in the other ~21%.
- **Full date line** — under the form, the converter prints the full sentence for the date
  (e.g. "Saturday, 22 Dey 1403 — January 11, 2025"). What Copy writes is set in Settings
  (default: the Persian date as `yyyy-mm-dd`), and the Copy button's tooltip names the active
  format. The line hides itself when the current input is not a valid date.
- **Status row** — a «Today» / «امروز» button that resets both sides to today, closes every
  popup and clears the query string, and a «Copy» / «کپی» button that puts the date on the
  clipboard in the configured format, swapping its own label to a localized "Copied" state on success
  or a "Copy failed" state if the clipboard write is rejected.
- **Settings** — a gear button opens a native modal `<dialog>` (focus trap, `Escape` closes,
  focus returns to the gear). The Copy format group chooses the calendar (Persian, Gregorian
  or both), the format (presets `yyyy-mm-dd`, `yyyy/mm/dd`, `dd.mm.yyyy`, a sentence, or a
  custom pattern with the tokens `yyyy`, `mm`, `m`, `dd`, `d`, `MMMM`, `dddd`; quote literal
  words, e.g. `'Today is' dddd`) and the digits (Latin or Persian), with a live preview.
  Settings are stored in `localStorage` under `settings.v1`; an unreadable value or an invalid
  field falls back to that field's default (`settings.v1` also holds the view and holiday
  preferences, and the watch face). The Watch group chooses the face (Analog or Digital). The Calendars & holidays group (views, sources, my holidays, Test connection) is described under Month views and holidays.
- **Time source** — the clock, the today panel and the converter's Today take their time from `/api/time` on this site (best of three round trips, half the round trip credited to the server, offsets under 250 ms ignored), re-synced at load, on return after five minutes away and every six hours. Settings → Time shows where the time comes from and when it last synced, has a Test connection button, and can switch to this device's clock only. Unreachable or invalid answers keep the last good offset for up to 24 hours, then use the device clock. The today panel refreshes every minute from the watch's own frames, so it turns over at midnight (local and Tehran) even when the app is left open.
- **Month views and holidays** — below the converter (so it stays above the fold on desktop) sit
  two month panels, Persian (open by default) and Gregorian (closed), each hideable in Settings.
  Each has ‹ / › paging, a Today button that returns to the current month, and a list of that
  month's holidays; clicking a day fills the converter with that date. Holiday days are marked
  and carry the holiday names in their accessible name. In the list, consecutive days of one
  holiday are one entry ("1–4 Farvardin Nowruz"), tagged **Iran**, **Nuremberg** or **Mine**,
  and **estimated** where the date is an estimate rather than official. The panels refresh once
  a minute, and only when the date changes, so they follow midnight without losing keyboard focus.
  Sources, chosen in Settings → Calendars & holidays: **Iran (official)** — the fixed solar holidays
  plus the lunar ones; **Nuremberg (Bavaria)** — the Bavarian public holidays without Assumption
  Day, which applies only in Catholic-majority municipalities; and **My holidays**. The lunar
  Iranian dates come from an official data file per Persian year (`/api/holidays/ir/{year}.json`,
  see Holiday data). A year without a file, or with an invalid or empty one, falls back to an
  estimate from the Umm al-Qura calendar, labelled "estimated". My holidays: a name (up to 60
  characters), a Persian or Gregorian date and an optional year (without it the holiday
  repeats yearly; with it, once); Esfand 30 and Feb 29 are accepted and shown only in years that
  have them; up to 200, with add, edit and delete. **Test connection** in that group reports the
  official file found for the current Persian year, or that estimates are in use.
- **Shareable URLs** — a valid conversion updates the address bar via `history.replaceState`
  (`?p=1403-10-22` or `?g=2025-1-11`, never a full navigation) and loading either query
  param prefills both sides on load; an invalid or malformed param is ignored and today is
  shown instead.
- **Timezones** — visitor's local zone, auto-detected. A quiet secondary line shows Tehran
  time when the visitor is not in `Asia/Tehran`. No dropdowns.
- **Dark mode** — driven purely by `prefers-color-scheme`; both themes designed
  deliberately. There is no manual toggle, by design.
- **Language** — EN ⇄ FA toggle persisted in `localStorage`, defaulting to `fa` when
  `navigator.language` starts with `fa`. FA sets `<html lang="fa" dir="rtl">` and switches
  every numeral in **rendered text** — the two date lines, the Tehran time line, the
  converter fields, and the picker option labels — to Persian-Indic digits. The converter
  fields are `type="text"` rather than `type="number"` precisely so they can hold localized
  digits: a native numeric input only accepts ASCII digits, so localizing it would break
  typing and validation. Digits typed in any of the three scripts are normalized before
  conversion, so nothing is lost either way.
- **Privacy** — no cookies, no analytics, no third-party requests, no personal data processed. The only requests after load are `GET /api/time` to this same site (three per sync, plus one when you press Test connection) and `GET /api/holidays/ir/{year}.json`, also this same site (a static file); they carry no personal data beyond what any page request does. holidayapi.ir is contacted by the GitHub Action, never by a visitor's browser. The browser keeps only your language and settings (including any holiday names you enter) in `localStorage`; they never leave it. See `docs/SECURITY.md`.

## Holiday data

Official Iranian lunar holiday dates live in `Site/public/api/holidays/ir/{year}.json` (one file
per Persian year) and are served as static files. The workflow `.github/workflows/holidays-ir.yml`
("Iranian holidays") maintains them: weekly (Monday 04:23 UTC) and on manual dispatch it runs the
crawler tests, then `tools/holidays-crawler/crawl.ts`, which asks holidayapi.ir for every day of the
current and next Persian year.

- **Filter** — an event counts when `is_holiday` is true and either `is_religious` is true or
  its `additional_description` names a Hijri month. The second rule exists because holidayapi.ir
  flags Fatimah's martyrdom as `is_religious: false`. A description the crawler does not know
  fails the job rather than being dropped.
- **Completeness** — a year with no lunar holidays (not published yet) is skipped. A year missing
  any of the 16 lunar holidays is skipped with a workflow warning, and the existing file is kept.
- **Pull request** — only a change in the holiday list writes a file (the `fetched` date alone does
  not), and then `peter-evans/create-pull-request@v7` opens a PR on the branch `holidays/ir-update`.
  **Check the dates against the official calendar before merging**: moon sighting can move a
  lunar holiday, and next year's dates may be provisional. Until a PR is merged the site keeps its
  previous data or its labelled estimates.
- **Acceptance test** — PRs opened by the workflow with the default token do not trigger CI, so
  `Site/tests/official-files.test.ts` (each file parses and every date is within a day of its
  estimate) runs on `master` after merge, and locally on the PR branch.
- **Repository setting** — opening the PR needs **Settings → Actions → General → Workflow
  permissions → "Allow GitHub Actions to create and approve pull requests"**. Without it the branch
  is pushed but the PR is not created.

## Deployment

```
push to master
   │
   ▼
GitHub Actions (.github/workflows/ci.yml)
   ├─ dotnet   build -warnaserror → NUnit → Console --generate-vectors → vectors artifact
   ├─ site     npm ci → build → Vitest (with vectors) → Playwright E2E → screenshots
   └─ deploy   (master push only, needs both)
        docker build -t time-app:current .
        docker save | gzip | ssh deploy@HOST      ← forced-command key, no shell
                                                  ← environment: production (master only)
        curl https://time.automated.ink/health    ← polled up to 3 min, run fails if unhealthy
   │
   ▼
Hetzner host
   ├─ sshd runs /usr/local/bin/time-app-deploy for that key only:
   │     gunzip | docker load
   │     docker compose -f /opt/time/docker-compose.yml up -d
   │     docker image prune -f
   ├─ Caddy terminates TLS and reverse-proxies
   │     time.automated.ink → time-app:8080  (external `edge` docker network)
   └─ time-app container: nginx:1.27-alpine serving Site/dist on :8080
```

No container registry is involved — the image is streamed straight from the runner to the
host over SSH and loaded locally as `time-app:current`.

**Deploy secrets** — `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` — are never in
the repo. They live in the GitHub **`production` environment**, whose deployment branch
policy allows only `master`, and the deploy job declares `environment: production`. The
workflow's `GITHUB_TOKEN` is `contents: read`. Secrets are passed to steps via `env:` rather
than interpolated into shell command lines, and the SSH call uses
`-o StrictHostKeyChecking=yes` against the pinned `DEPLOY_KNOWN_HOSTS` entry.

### Serving configuration

- Hashed assets under `/assets/`: `Cache-Control: public, max-age=31536000, immutable`
- `index.html`: `Cache-Control: no-cache`
- `/health` → `200 ok` (an nginx `return`, not a file)
- `/api/time` → `{"epochSec":<seconds.millis>}` (an nginx `return` of `$msec`), `Cache-Control: no-store`
- `/api/holidays/` (`location ^~`) → the static data files in `Site/dist/api/holidays/`; a year with no file is a `404` (not `index.html`), `Cache-Control: no-cache`, security headers included
- Security headers on every response: CSP (`default-src 'self'`, `connect-src 'self'`, no external origins —
  every asset is self-hosted), `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`. **HSTS is set by nginx at the origin** — Caddy
  does not add it automatically, contrary to what this file previously claimed.
- `server_tokens off`, so no nginx version is advertised.
- A 404 under `/assets/` deliberately does *not* get the immutable `Cache-Control` (the
  `add_header` there omits `always`), so a mistyped asset path is not cached for a year.

### Rolling back

Images are host-local and tagged. To roll back, retag a previous image as
`time-app:current` on the host and bring the stack up again:

```bash
ssh root@HOST 'docker images time-app'                       # find the previous image id
ssh root@HOST 'docker tag <previous-image-id> time-app:current && \
               docker compose -f /opt/time/docker-compose.yml up -d'
```

Note that the deploy script runs `docker image prune -f`, which reaps *untagged* images —
tag anything you want to keep as a rollback target.

## Security posture

See **[docs/SECURITY.md](docs/SECURITY.md)** for the control inventory (host hardening,
least-privilege deploy identity, change management, data privacy) and an honest list of
known gaps.

## Documentation

- `docs/SECURITY.md` — security controls and known gaps
- `docs/superpowers/specs/2026-07-31-static-rewrite-design.md` — design decisions
- `docs/superpowers/plans/2026-07-31-static-rewrite.md` — implementation plan
- `docs/superpowers/specs/2026-08-02-mobile-pwa-and-quotes-design.md` — mobile/PWA polish design (its quote-roster section was abandoned; the quote feature was removed)
- `docs/superpowers/plans/2026-08-02-mobile-pwa.md` — mobile/PWA implementation plan
- `docs/superpowers/plans/2026-08-02-quote-roster.md` — quote roster plan (abandoned)
- `docs/superpowers/specs/2026-08-05-converter-ux-design.md` — converter UX design (status row, URL state)
- `docs/superpowers/plans/2026-08-05-converter-ux.md` — converter UX implementation plan
- `docs/superpowers/specs/2026-08-07-converter-pickers-design.md` — type-or-pick month/day picker design
- `docs/superpowers/plans/2026-08-07-converter-pickers.md` — picker implementation plan
- `docs/superpowers/specs/2026-08-08-calendar-and-year-picker-design.md` — calendar grid and year picker design
- `docs/superpowers/plans/2026-08-08-calendar-and-year-picker.md` — calendar and year picker implementation plan
- `docs/superpowers/plans/2026-08-08-calendar-hug-content.md` — hug-content decision for the calendar grid
- `docs/superpowers/plans/2026-08-08-calendar-wizard.md` — calendar wizard, hug-content, and the SOLID refactor (`popup.ts`, `grid-navigation.ts`, `calendar-views.ts`)

## Not implemented

- Additional calendars (Hijri lunar, Hebrew) — not planned.

## License

MIT — © 2026 Ali Pirouzi

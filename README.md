# Persian Calendar

Persian (Shamsi / Solar Hijri) ↔ Gregorian date conversion and a live analog clock —
bilingual EN/FA with full RTL, installable as an offline PWA.

**Live:** <https://time.automated.ink/>

## What it is

A **fully static, client-side site**. There is no application server: nginx serves a
handful of hashed files, and every conversion, clock frame, and language switch happens
in the visitor's browser. After first paint there are zero network round-trips.

### Why static

The previous version of this project was Blazor Server. That meant every keystroke in the
converter was a SignalR round-trip, a server-side timer re-rendered and pushed the clock
to every connected client once per second, and each visitor held an open websocket plus a
server-side circuit. The conversion arithmetic itself takes microseconds — effectively all
of the perceived latency was transport. Moving to a static bundle removes the transport,
the per-visitor server state, and the server-side scaling concern in one step.

The shipped bundle is **29.4 kB of JavaScript (11.3 kB gzipped)** and **15.6 kB of CSS
(3.5 kB gzipped)**, with no runtime framework.

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
│   │   ├── clock/          clock-math.ts (hand angles), clock.ts (SVG + rAF driver)
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
│   │   ├── settings/       settings-model.ts (types, defaults, validation, pure),
│   │   │                     settings-store.ts (localStorage `settings.v1`, subscribe),
│   │   │                     settings-panel.ts (native modal dialog, DOM only),
│   │   ├── i18n/           strings.ts — EN/FA dictionaries + Persian-Indic digits,
│   │   │                     format.ts — weekday name + shareable copy sentence
│   │   └── styles/         tokens.css, base.css, components.css
│   ├── tests/              Vitest (357 tests at 100% coverage, incl. .NET parity;
│   │                         tests/dom/ runs the DOM units under jsdom)
│   └── e2e/                Playwright (128 tests, incl. converter-ux.spec.ts,
│                             picker.spec.ts, calendar.spec.ts, settings.spec.ts and the
│                             screenshot matrix)
│
├── deploy/
│   ├── nginx.conf             static serving, caching, /health
│   └── security-headers.conf  CSP and friends
├── Dockerfile              node:22-alpine build → nginx:1.27-alpine runtime
└── .github/workflows/ci.yml   dotnet → site → deploy
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

### Site unit tests (Vitest) — 357 tests, 100% coverage

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
(1427/1427 lines, 1427/1427 statements, 593/593 branches, 133/133 functions). Only
`src/main.ts` (the bootstrap)
and `src/clock/**` (visual, screenshot-tested) are excluded. Tests under `tests/dom/` run
in jsdom — that is where `popup.ts`, `number-picker.ts`, `calendar-grid.ts`,
`numeric-input.ts` and `converter.ts` are exercised, the last of them against the real
`index.html` body rather than a hand-copied fixture. Everything else runs in the faster
node environment. CI runs `npm test`, not `npm run test:coverage`, so the threshold is a
local gate rather than a pipeline one.

### E2E (Playwright) — 128 tests

```bash
cd Site
npx playwright install --with-deps chromium   # first time only
npm run e2e
```

Playwright starts `npm run preview` itself and tests the real production build. Coverage:
today prefilled and cross-checked against ICU's Persian calendar, live conversion in both
directions, month-aware localized validation errors, FA toggle → RTL + Persian digits,
clock hands actually moving, the `prefers-reduced-motion` interval fallback
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
| Navigations (`mode: 'navigate'`) | Network-first | Falls back to the cached `/` shell when the network is unreachable; `/` is the only navigation cache key. |
| `/assets/*` (hashed, immutable) | Cache-first | Fetched once and never revalidated — matches the `immutable` `Cache-Control` these paths already ship with. |
| Everything else same-origin (e.g. the manifest, icons) | Stale-while-revalidate | The cached copy is served immediately while a background fetch (extended via `event.waitUntil`) refreshes the cache for next time. |

Partial responses (HTTP 206) are never written to the cache by any of the three strategies. To
invalidate everything that's cached — after a breaking change to a cached asset, for example —
bump the `CACHE` constant in `sw.js`; the `activate` handler deletes any cache whose name no
longer matches.

The Playwright suite's viewport and locale matrix was widened alongside this work: light/dark
screenshots at 320, 375, 430, 768, 820, 1024, and 1440 px; a landscape-phone case (844×390)
asserting the clock shrinks so the today panel stays reachable; FA/RTL screenshots at 375 and
820; and dedicated tests confirming the manifest and icons resolve and that the service worker
actually serves the app while offline (128 tests total across the whole E2E suite, including
the later converter UX additions in `converter-ux.spec.ts`, `picker.spec.ts` and
`calendar.spec.ts`).

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
Inter and Cormorant Garamond and Vazirmatn, all under the SIL Open Font License.

## Design and behaviour notes

- **Clock** — inline SVG; the seconds hand glides continuously (angle recomputed from
  `Date.now()` every `requestAnimationFrame`, Spring-Drive style) rather than ticking.
  `prefers-reduced-motion: reduce` steps the hands once per second instead. The rAF loop
  pauses on `visibilitychange`.
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
  the fold (the clock is 210px at that breakpoint).
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
  field falls back to that field's default.
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
- **Privacy** — no cookies, no analytics, no third-party requests, no personal data
  processed. The browser keeps only your language and copy-format preferences in
  `localStorage`; they never leave it. See `docs/SECURITY.md`.

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
- Security headers on every response: CSP (`default-src 'self'`, no external origins —
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

# Persian Calendar

Persian (Shamsi / Solar Hijri) ↔ Gregorian date conversion, a live analog clock, and a
daily Stoic thought — bilingual EN/FA with full RTL.

**Live:** <https://time.automated.ink/>

## What it is

A **fully static, client-side site**. There is no application server: nginx serves a
handful of hashed files, and every conversion, clock frame, and language switch happens
in the visitor's browser. After first paint there are zero network round-trips (the only
deferred fetch is `quotes.json`).

### Why static

The previous version of this project was Blazor Server. That meant every keystroke in the
converter was a SignalR round-trip, a server-side timer re-rendered and pushed the clock
to every connected client once per second, and each visitor held an open websocket plus a
server-side circuit. The conversion arithmetic itself takes microseconds — effectively all
of the perceived latency was transport. Moving to a static bundle removes the transport,
the per-visitor server state, and the server-side scaling concern in one step.

The shipped bundle is **10.3 kB of JavaScript (4.6 kB gzipped)** and **9.9 kB of CSS
(2.2 kB gzipped)**, with no runtime framework.

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
│   │   ├── converter/      converter-core.ts (pure), converter.ts (DOM wiring)
│   │   ├── i18n/           strings.ts — EN/FA dictionaries + Persian-Indic digits
│   │   ├── quotes/         quotes.ts — day-of-year selection
│   │   └── styles/         tokens.css, base.css, components.css
│   ├── public/quotes.json  366 bilingual quotes
│   ├── tests/              Vitest (46 tests, incl. .NET parity)
│   └── e2e/                Playwright (34 tests, incl. screenshot matrix)
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

### Site unit tests (Vitest) — 46 tests

The parity suite reads `Site/tests/fixtures/vectors.json`, which is **generated, not
committed**. Generate it first (requires the .NET 10 SDK):

```bash
cd Site
npm run gen:vectors   # dotnet run --project ../Console -- --generate-vectors ... 1200 1500
npm test
```

`npm run gen:vectors` only has to be re-run if the vectors file is missing or the range
changes. Without it the parity test cannot run.

### E2E (Playwright) — 34 tests

```bash
cd Site
npx playwright install --with-deps chromium   # first time only
npm run e2e
```

Playwright starts `npm run preview` itself and tests the real production build. Coverage:
today prefilled and cross-checked against ICU's Persian calendar, live conversion in both
directions, month-aware localized validation errors, FA toggle → RTL + Persian digits,
daily quote, clock hands actually moving, the `prefers-reduced-motion` interval fallback
still advancing them, a light/dark × 320/375/430/768/820/1024/1440 screenshot matrix
written to `Site/test-results/screens/`, and the PWA/mobile checks described below.

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
| Everything else same-origin (e.g. `quotes.json`) | Stale-while-revalidate | The cached copy is served immediately while a background fetch (extended via `event.waitUntil`) refreshes the cache for next time. |

Partial responses (HTTP 206) are never written to the cache by any of the three strategies. To
invalidate everything that's cached — after a breaking change to a cached asset, for example —
bump the `CACHE` constant in `sw.js`; the `activate` handler deletes any cache whose name no
longer matches.

The Playwright suite's viewport and locale matrix was widened alongside this work (34 tests
total): light/dark screenshots at 320, 375, 430, 768, 820, 1024, and 1440 px; a landscape-phone
case (844×390) asserting the clock shrinks so the today panel stays reachable; FA/RTL
screenshots at 375 and 820; and dedicated tests confirming the manifest and icons resolve and
that the service worker actually serves the app while offline.

## Supported conversion range: Persian years 1200–1500 AP

The UI accepts and the algorithm guarantees **1200–1500 AP** (roughly 1821–2121 CE), and
nothing outside it.

This is not an arbitrary limit — it is exactly the range where correctness is *proven*.
The parity suite asserts the TypeScript port is bit-exact against
`System.Globalization.PersianCalendar` for every single day in that range (~110,000 days),
in both directions, including every leap year and 30 Esfand. At 1502 AP the arithmetic
(Birashk-style) algorithm and the astronomical calendar begin to diverge, so beyond 1500
the two implementations no longer agree and correctness could not be asserted. Rather than
ship dates we cannot prove, the range is capped where the proof holds.

## Quotes and licensing

`Site/public/quotes.json` holds 366 entries keyed to Persian day-of-year (1 Farvardin = 1,
30 Esfand = 366, used only in leap years). Each entry carries EN and FA text, author in
both languages, and a source citation.

- **English texts** are drawn from **public-domain translations**: Marcus Aurelius
  (*Meditations*, George Long), Seneca (*Moral Letters*, Richard Gummere), Epictetus
  (Higginson / Carter). These translations are out of copyright.
- **Farsi texts** were written for this project as translations of those public-domain
  English texts. They have **not** been proofread by a native Farsi speaker — treat them
  as best-effort.

The project code is MIT licensed (see `LICENSE`). Fonts are self-hosted via npm:
Inter and Cormorant Garamond and Vazirmatn, all under the SIL Open Font License.

## Design and behaviour notes

- **Clock** — inline SVG; the seconds hand glides continuously (angle recomputed from
  `Date.now()` every `requestAnimationFrame`, Spring-Drive style) rather than ticking.
  `prefers-reduced-motion: reduce` steps the hands once per second instead. The rAF loop
  pauses on `visibilitychange`.
- **Converter** — prefilled with today, no Convert button; editing either side converts on
  input, last-edited side wins. Validation messages are localized and month-aware
  ("Esfand has 29 days in 1404").
- **Timezones** — visitor's local zone, auto-detected. A quiet secondary line shows Tehran
  time when the visitor is not in `Asia/Tehran`. No dropdowns.
- **Dark mode** — driven purely by `prefers-color-scheme`; both themes designed
  deliberately. There is no manual toggle, by design.
- **Language** — EN ⇄ FA toggle persisted in `localStorage`, defaulting to `fa` when
  `navigator.language` starts with `fa`. FA sets `<html lang="fa" dir="rtl">` and switches
  every numeral in **rendered text** — the two date lines and the Tehran time line — to
  Persian-Indic digits. The converter's `<input type="number">` fields keep Western digits
  on purpose: a native numeric input only accepts ASCII digits, so localizing them would
  break typing, the spinner, `min`/`max` validation, and mobile numeric keypads.
- **Privacy** — no cookies, no analytics, no third-party requests, no personal data
  processed or stored anywhere. See `docs/SECURITY.md`.

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
- `quotes.json`: `Cache-Control: public, max-age=86400`
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
- `docs/superpowers/specs/2026-08-02-mobile-pwa-and-quotes-design.md` — mobile/PWA polish and quote roster design
- `docs/superpowers/plans/2026-08-02-mobile-pwa.md` — mobile/PWA implementation plan
- `docs/superpowers/plans/2026-08-02-quote-roster.md` — 366-thinker quote roster implementation plan

## Not implemented

- Additional calendars (Hijri lunar, Hebrew) — not planned.

## License

MIT — © 2026 Ali Pirouzi

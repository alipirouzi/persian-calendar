# Persian Calendar — Static Rewrite Design

**Date:** 2026-07-31
**Status:** Approved by Ali (design conversation, 2026-07-31)
**Deployed at:** https://time.automated.ink/

## 1. Goal

Rebuild the web app as the fastest possible Persian↔Gregorian calendar converter:
a fully static, client-side site with zero server round-trips after first paint,
an elegant horological-minimal design with system-driven dark mode, a daily stoic
quote (366, bilingual), current-date defaults, and an analog clock with a
Spring-Drive-style continuous sweep.

## 2. Why (problems with the current app)

- Blazor Server: every interaction is a SignalR round-trip; a server-side timer
  re-renders and pushes the clock to every client once per second; each visitor
  holds a websocket and a server circuit. All perceived latency is transport —
  the conversion itself is microseconds.
- Bootstrap CSS ships but styling is custom — dead weight.
- Converter defaults are hardcoded (1403/10/22, 2025/1/11), not today.
- Generic visual design, no dark mode.
- CI deploy job fires the Coolify webhook without verifying the deployment came up.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Architecture | Static HTML + vanilla TypeScript (Vite build, no runtime framework) |
| Languages | Bilingual EN/FA with full RTL; quotes in both languages |
| Quote mapping | Persian day-of-year (1 Farvardin = quote 1; 30 Esfand = quote 366) |
| Visual direction | Horological minimal (Grand-Seiko-inspired) |
| Timezones | Visitor local + Tehran, auto-detected; no dropdowns |
| Dark mode | `prefers-color-scheme` only; no manual toggle |
| C# code | `Lib`/`Tests` stay as reference implementation; `Console` generates test vectors; `Web` (Blazor) deleted after cutover |

## 4. Architecture

### 4.1 Repo layout

```
PersianCalendar/
├── Lib/                 # C# reference implementation (unchanged)
├── Console/             # CLI + new `--generate-vectors` mode → vectors JSON
├── Tests/               # NUnit tests for Lib (unchanged)
├── Site/                # NEW: static web app
│   ├── index.html
│   ├── src/
│   │   ├── calendar/    # persian.ts (algorithm), convert.ts
│   │   ├── clock/       # analog clock (SVG + rAF driver)
│   │   ├── quotes/      # quote-of-day selection
│   │   ├── i18n/        # dictionaries EN/FA, digit formatting
│   │   └── ui/          # converter, date panel, language toggle
│   ├── public/quotes.json
│   ├── tests/           # Vitest unit tests (incl. vector parity)
│   └── e2e/             # Playwright tests
├── Dockerfile           # multi-stage: node build → nginx:alpine
└── .github/workflows/ci.yml
```

- `Web/` (Blazor) is deleted in the final implementation step, after the static
  site is verified live at time.automated.ink.

### 4.2 Serving

- `nginx:alpine` serving `Site/dist/`.
- gzip on; hashed assets get `Cache-Control: public, max-age=31536000, immutable`;
  `index.html` gets `no-cache`.
- Security headers: CSP (`default-src 'self'`; no external origins — all assets
  self-hosted), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Strict-Transport-Security`.
- `/health` returns 200 `ok` (nginx location, no file).
- Coolify deployment flow unchanged (same webhook, same host).

### 4.3 Performance budget

- JS < 20 KB gzipped (hard ceiling 80 KB per microsite budget).
- CSS < 15 KB gzipped.
- Fonts: subset woff2, `font-display: swap`, preload only the primary text face.
- `quotes.json` fetched separately (async, long-cached); not in the JS bundle.
- Lighthouse targets: 100 performance / 100 a11y / 100 best-practices / 100 SEO;
  LCP < 1 s on broadband, CLS < 0.1.

## 5. Persian calendar algorithm (TS port)

- Port the arithmetic Persian calendar algorithm to `Site/src/calendar/persian.ts`
  with `toGregorian(py, pm, pd)`, `toPersian(gy, gm, gd)`, `isLeapPersianYear(py)`,
  `daysInPersianMonth(py, pm)`, `persianDayOfYear(py, pm, pd)`.
- **Parity is proven, not assumed:** `Console --generate-vectors` uses
  `System.Globalization.PersianCalendar` to emit `vectors.json` covering every day
  of Persian years 1300–1500 (~73 000 days) plus boundary edges (year 1, month
  boundaries, 30 Esfand leap days). A Vitest suite asserts the TS port is
  bit-exact against the vectors in both directions. Any mismatch fails the build.
- Vectors are generated in CI (not committed) so drift between .NET versions is
  caught automatically.

## 6. Page design (single page)

### 6.1 Components

1. **Analog clock** (visual centerpiece) — inline SVG, shows visitor local time.
   - Seconds hand: continuous glide via `requestAnimationFrame`, angle computed
     from `Date.now()` each frame — no ticks (Spring Drive motion). Hour/minute
     hands sweep smoothly too.
   - Rotation via `transform: rotate(...)` on SVG hand groups (compositor-friendly).
   - `prefers-reduced-motion: reduce` → hands step once per second.
   - Page hidden (`visibilitychange`) → rAF loop pauses.
2. **Date panel** — today in both calendars, e.g. "۹ مرداد ۱۴۰۵ — July 31, 2026".
   When the visitor's timezone is not Asia/Tehran, a quiet secondary line shows
   Tehran time (via `Intl.DateTimeFormat` with `timeZone: 'Asia/Tehran'`).
3. **Converter** — one bidirectional card: Persian Y/M/D fields on one side,
   Gregorian Y/M/D on the other. **Prefilled with today on load.** Editing either
   side converts live on input — no Convert button. Last-edited side is the
   source of truth. Inline, localized validation (e.g. "Esfand has 29 days in 1404").
   Supported range: Persian years 1–9999 (matching Lib).
4. **Daily stoic quote** — selected by Persian day-of-year from `quotes.json`.
   Rendered in the active language with author attribution.
5. **Language toggle** — EN ⇄ FA, persisted in `localStorage`. Default: `fa` if
   `navigator.language` starts with `fa`, else `en`. FA mode sets
   `<html lang="fa" dir="rtl">` and uses Persian-Indic digits throughout
   (dates, clock numerals, converter values via `Intl.NumberFormat('fa')`).

### 6.2 Visual direction — horological minimal

- Surfaces: warm off-white (light) / deep charcoal (dark), defined as CSS custom
  properties; both themes designed intentionally, switched purely by
  `@media (prefers-color-scheme: dark)`.
- One accent: Seiko-blue steel, used semantically (active states, seconds hand).
- Typography: Cormorant Garamond (serif display — dates, quote) + Inter (UI),
  Vazirmatn for FA mode (display and UI). All self-hosted, subset, max ~3 woff2
  files loaded per language.
- Hairline rules, generous whitespace, no card shadows; hierarchy through scale
  contrast. Hover/focus states designed (accent underlines, focus rings).
- Semantic HTML (`main`, `section`, `time`, proper labels), WCAG AA contrast in
  both themes, full keyboard operability.
- SEO/meta: title, description, OpenGraph tags, favicon (existing icon reused or
  refined).

## 7. Quotes data

- `Site/public/quotes.json`: array of 366 entries
  `{ "d": 1-366, "en": "...", "fa": "...", "author_en": "...", "author_fa": "...", "source": "Meditations 4.7" }`.
- Curated from public-domain Stoic sources (Marcus Aurelius — Long translation,
  Seneca — Gummere, Epictetus — Higginson/Carter), each ≤ ~40 words. FA texts are
  curated translations written for this project. Entry 366 (30 Esfand, leap years
  only) is a quote on rarity/time.
- A Vitest test validates the file: exactly 366 entries, unique `d` 1–366, all
  fields non-empty.
- Fetch failure or invalid JSON → quote block stays hidden; no error surface,
  no console noise beyond a single `console.warn`.

## 8. Error handling

- Converter: per-field validation with localized messages; out-of-range or
  impossible dates never throw — the opposite side simply shows the last valid
  result dimmed plus the message.
- Timezone detection failure (`Intl` missing zone): Tehran line hidden.
- `localStorage` unavailable (private mode): toggle still works for the session.

## 9. Testing

| Layer | Tool | Coverage |
|---|---|---|
| Calendar parity | Vitest + generated vectors | every day 1300–1500 AP, both directions, leap years |
| Quote selection | Vitest | day-of-year mapping, 30 Esfand → 366, quotes.json shape |
| i18n/digits | Vitest | EN/FA strings, Persian digit formatting |
| Lib (C#) | NUnit (existing) | unchanged |
| E2E | Playwright | loads with today prefilled; live conversion both directions; EN↔FA + RTL; light + dark screenshots at 320/768/1440; reduced-motion clock |

- TS module coverage target: 80%+ (calendar module effectively 100% via vectors).
- E2E runs against the production build (`vite preview`) in CI.

## 10. CI/CD

Extend `.github/workflows/ci.yml`:

1. **dotnet job** — restore, build `-warnaserror`, NUnit tests, run
   `Console --generate-vectors` → upload `vectors.json` artifact. Add NuGet cache.
2. **site job** (needs dotnet) — download vectors; `npm ci`, typecheck, Vitest
   (incl. parity), build, Playwright E2E. Node modules cached.
3. **deploy job** (master push only, needs both) — trigger Coolify webhook, then
   **poll `https://time.automated.ink/health` (up to 3 min)** and fail the run if
   the site doesn't come up healthy.

Docker: multi-stage — `node:22-alpine` builds `Site/dist`, final stage
`nginx:alpine` with config + dist. `curl`-based container HEALTHCHECK retained.

## 11. Migration & cleanup

1. Build `Site/` to feature parity + new features; verify locally in a real browser.
2. Swap Dockerfile to the static build; deploy; verify live at time.automated.ink
   (clock sweep, conversion, quote, dark mode, FA/RTL).
3. Delete `Web/` project and its solution entry.
4. Update `README.md`: new architecture, how to run (`npm run dev`), how to test
   (dotnet + vitest + playwright), deployment notes.

## 12. Out of scope (future)

- Service worker / full offline PWA *(planned)* — repeat visits are already
  near-instant via immutable caching.
- Manual dark-mode toggle (system-driven by explicit decision).
- Additional calendars (Hijri lunar, Hebrew).

# Mobile-Perfect PWA + 366-Thinker Quote Roster — Design

Date: 2026-08-02
Status: approved by Ali (sections approved in-session)
Scope: `Site/` only. The .NET Lib/Console/Tests and the deploy pipeline are untouched
except where noted (nginx config for SW/manifest caching, Playwright matrix).

## Goals

1. The site at https://time.automated.ink/ is *perfect* on phones (320–430 px) and
   tablets (768–1024 px), both orientations, and installs to the home screen as an
   offline-capable PWA.
2. The daily quote pool becomes 366 distinct thinkers — one quote per person — global,
   wisest-only, strictly secular, every quote verified against a primary source and
   displayed with its reference.

## Non-goals

- No framework adoption, no Workbox/vite-plugin-pwa dependency.
- No two-column tablet re-architecture; the single centered column is the site's character.
- No change to the converter's supported range (Persian 1200–1500) or conversion logic.
- No push notifications or background sync; "PWA" here means installable + offline.

---

## Section 1 — Mobile polish + installable PWA

### 1.1 Responsive polish

| Item | Change |
|---|---|
| Touch targets | Date inputs and `#lang-toggle` reach ≥44 px hit area (padding, not font inflation). |
| iOS focus zoom | Inputs keep computed font-size ≥16 px so mobile Safari never zoom-jumps on focus. |
| Exchange glyph | When `#converter-form` stacks vertically, the ⇄ glyph rotates to read vertically (CSS transform at the stacking breakpoint; `aria-hidden` already set). |
| Safe areas | `viewport-fit=cover` on the viewport meta; `env(safe-area-inset-*)` padding on `main` and the fixed `#lang-toggle`. |
| Short viewports | `@media (max-height: 480px)` shrinks the clock on landscape phones so the today panel is visible without scrolling past the dial. |
| Tablet rhythm | Tune clock size and `--space-section` steps for 768–1024 so spacing reads designed, not desktop-shrunk. |
| RTL | All of the above verified in `fa` (RTL) mode as well as `en`. |

### 1.2 PWA

- **Manifest**: `site.webmanifest` — name, short name (en), `display: standalone`,
  theme/background colors matching the light token surface, maskable icons 192/512
  generated from the existing favicon mark.
- **Metas**: `theme-color` (light + dark via `media`), `apple-touch-icon` 180 px.
- **Service worker** (hand-rolled, ~50 lines, TypeScript compiled by Vite):
  - Navigations: network-first, fall back to cached `index.html` offline.
  - Hashed `/assets/*`: cache-first (immutable by construction).
  - `quotes.json`, favicon, manifest: stale-while-revalidate.
  - Old caches pruned on `activate` by cache-name version bump.
- **nginx**: `Service-Worker-Allowed` not needed (SW at root). `sw.js` and
  `site.webmanifest` served with `Cache-Control: no-cache` (they are the update
  channel); existing immutable caching for hashed assets unchanged. CSP unchanged —
  SW and manifest are same-origin.

### 1.3 Verification

- Playwright screenshot matrix extends from {320, 768, 1440} to
  {320, 375, 430, 768, 820, 1024, 1440} plus one landscape phone viewport
  (844×390), light + dark, en + fa.
- E2E assertions: no horizontal overflow at any matrix width; input/toggle bounding
  boxes ≥44 px; manifest and SW register successfully (Playwright `serviceworker`
  target); offline reload of `/` succeeds.
- Post-deploy: live check of https://time.automated.ink/ on real Chrome device
  emulation, Lighthouse PWA-installability pass.

---

## Section 2 — 366 thinkers, one verified quote each

### 2.1 Content rules

- Exactly 366 entries, `d` = 1…366, exactly one quote per thinker, 366 unique authors.
- Global roster, curated **before** quote research (roster-first), balanced across:
  Greek/Roman antiquity, Persian & Islamic golden age (well represented — Rumi,
  Khayyam, Saadi, Ferdowsi, Avicenna, Biruni…), East/South Asia, Enlightenment,
  and 19th–21st-century philosophers, scientists, and writers. Both the famous and
  the under-quoted; selection criterion is wisdom density, not fame.
- **Strictly secular content**: no scripture, no devotional or doctrinal material.
  Mystic poets qualify only through humanist verses. The filter is on the *quote's
  content*, not the author's faith.
- Length ≤200 characters (en) so the blockquote stays one–two lines on phones.

### 2.2 Verification (primary source required)

- Every quote must be traceable to a citable work — book, letter, essay, lecture,
  speech — with section/letter/chapter in `source` where the work has one.
- Checked against the actual text or a scholarly/Wikiquote-*sourced* record.
  Untraceable or disputed → discarded, regardless of fame.
- Ancients surviving only through doxography cite the transmitting work
  (e.g. Diogenes Laertius, *Lives* VI).
- `docs/quotes-audit.json` records per-day verification evidence
  (`{d, author_en, source, evidence_url_or_edition}`) — repo-only, not shipped.

### 2.3 Schema & UI

- Schema: existing fields unchanged; add `source_fa` (Farsi rendering of the source)
  so `fa` mode no longer shows a mixed-script "author — English source" line.
- `quotes.ts` validator and `Quote` interface extended for `source_fa`;
  `renderQuote` uses it in `fa` mode.
- Farsi quote translations produced fresh for all 366; the existing open item
  "native-speaker proofread of the Farsi quotes" carries over to the new set.

### 2.4 Validation & execution

- Automated check (extends `quotes.test.ts`): 366 days covered exactly once,
  366 unique `author_en`, all fields non-empty, en length ≤200, `d` 1–366.
- Execution note: research/verification runs as batched parallel agents at
  implementation time (roster → per-batch quote research with verification →
  Farsi translation pass → automated validation → sampled human spot-check).

---

## Error handling

- SW registration failure is silent-degrade (site works exactly as today).
- `loadQuotes` keeps its all-or-nothing rule: one malformed entry rejects the file
  and hides the quote block. The new validator includes `source_fa`.

## Rollout

- Two independent tracks; mobile/PWA can ship before the quote roster.
- Deploy path unchanged (CI on master push → image → Hetzner). Post-deploy health
  check already exists; add manifest/SW reachability to it.

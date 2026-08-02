# Mobile Polish + Installable PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make https://time.automated.ink/ perfect on phones (320–430 px) and tablets (768–1024 px), both orientations, and installable as an offline-capable PWA.

**Architecture:** Pure CSS/markup refinement of the existing static Vite/TS site plus a hand-rolled ~55-line service worker (`public/sw.js`, plain JS) with network-first navigations, cache-first hashed assets, and stale-while-revalidate for everything else. Icons are rasterized from an inline SVG mark by a Playwright script. nginx gets a manifest content-type block and icon caching.

**Tech Stack:** Vite 7, TypeScript 5.9, Playwright (already a devDependency — also used for icon generation), nginx (Alpine, Docker).

## Global Constraints

- No new npm dependencies, runtime or dev.
- CSP is `default-src 'self'; …` (deploy/security-headers.conf) — no inline scripts/styles anywhere.
- Desktop (≥1025 px) must be pixel-identical to today; the user considers it done.
- All existing tests (vitest `npm test`, Playwright `npm run e2e`) stay green after every task.
- Working directory for npm commands: `Site/`.
- Commit after each task; never commit untracked files unintentionally — run `git status --short` and stage explicitly.
- Spec: `docs/superpowers/specs/2026-08-02-mobile-pwa-and-quotes-design.md` (Section 1).

---

### Task 1: Touch ergonomics, safe areas, vertical exchange glyph

**Files:**
- Modify: `Site/index.html` (viewport meta, line 5)
- Modify: `Site/src/styles/base.css` (main padding, safe areas)
- Modify: `Site/src/styles/components.css` (inputs, lang toggle, converter stacking)
- Test: `Site/e2e/site.spec.ts` (append new tests)

**Interfaces:**
- Consumes: existing DOM ids `#p-y…#g-d`, `#lang-toggle`, `#converter-form`, `.exchange`.
- Produces: converter stacks explicitly at ≤560 px (later tasks' screenshots rely on this breakpoint); inputs ≥44 px tall.

- [ ] **Step 1: Write the failing e2e tests** — append to `Site/e2e/site.spec.ts`:

```ts
test('no horizontal overflow at phone widths', async ({ page }) => {
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `width=${width}`).toBeLessThanOrEqual(0);
  }
});

test('date inputs are comfortable touch targets (≥44px, ≥16px font)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  for (const id of ['#p-y', '#p-m', '#p-d', '#g-y', '#g-m', '#g-d']) {
    const box = await page.locator(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.height, id).toBeGreaterThanOrEqual(44);
    const fontPx = await page.locator(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontPx, id).toBeGreaterThanOrEqual(16);
  }
});

test('lang toggle hit area extends beyond the visual pill', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const box = await page.locator('#lang-toggle').boundingBox();
  // Click 8px BELOW the pill's bottom edge — must still toggle via the ::after hit extension.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height + 8);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
});

test('exchange glyph reads vertically when the converter stacks', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const transform = await page.locator('.exchange').evaluate((el) => getComputedStyle(el).transform);
  expect(transform).not.toBe('none'); // rotate(90deg) → matrix(0, 1, -1, 0, 0, 0)
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd Site && npx playwright test -g "touch targets|hit area|exchange glyph|horizontal overflow"`
Expected: FAIL (heights < 44, transform === 'none', toggle click misses).

- [ ] **Step 3: Implement**

`Site/index.html` line 5 — replace the viewport meta:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`Site/src/styles/base.css` — replace the `main` padding line inside the existing rule:

```css
main {
  max-width: 44rem;
  margin-inline: auto;
  padding: var(--space-section)
    max(1.25rem, env(safe-area-inset-right))
    calc(var(--space-section) + env(safe-area-inset-bottom))
    max(1.25rem, env(safe-area-inset-left));
  display: grid;
  gap: var(--space-section);
  justify-items: center;
}
```

`Site/src/styles/components.css` — three edits:

1. In the `#lang-toggle` rule, replace the `inset-*` lines and add the hit-area extension:

```css
#lang-toggle {
  position: fixed;
  inset-block-start: max(1rem, env(safe-area-inset-top));
  inset-inline-end: max(1.25rem, env(safe-area-inset-right));
  /* …existing declarations unchanged… */
}
/* Invisible hit-area extension: keeps the small pill aesthetic while
   giving fingers a ≥44px effective target (WCAG 2.5.8). */
#lang-toggle::after { content: ''; position: absolute; inset: -10px; }
```

2. In `.fields input`, add `min-height: 44px;` (keep every existing declaration).

3. Append the stacking breakpoint at the end of the file:

```css
@media (max-width: 560px) {
  #converter-form { flex-direction: column; align-items: center; gap: 1.1rem; }
  .exchange { transform: rotate(90deg); }
}
```

- [ ] **Step 4: Run the new tests + full e2e**

Run: `cd Site && npm run e2e`
Expected: ALL PASS (including pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add Site/index.html Site/src/styles/base.css Site/src/styles/components.css Site/e2e/site.spec.ts
git commit -m "feat(site): touch targets, safe-area insets, vertical exchange glyph on phones"
```

---

### Task 2: Clock sizing for short viewports and tablets; extended screenshot matrix

**Files:**
- Modify: `Site/src/styles/components.css` (clock media queries, last line of file area)
- Test: `Site/e2e/site.spec.ts` (replace the screenshot loop)

**Interfaces:**
- Consumes: `.clock` class on the SVG (attrs `width="260" height="260"`; CSS overrides win).
- Produces: screenshot set under `test-results/screens/` at 7 widths × light/dark + fa subset + landscape — the human-review artifact for this plan.

- [ ] **Step 1: Write the failing e2e tests** — in `Site/e2e/site.spec.ts`, replace the existing `for (const scheme …)` screenshot block with:

```ts
for (const scheme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 430, 768, 820, 1024, 1440]) {
    test(`screenshot ${scheme} @${width}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.screenshot({ path: `test-results/screens/${scheme}-${width}.png`, fullPage: true });
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).not.toBe(scheme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
    });
  }
}

for (const width of [375, 820]) {
  test(`screenshot fa rtl @${width}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang', 'fa'));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: `test-results/screens/fa-${width}.png`, fullPage: true });
  });
}

test('landscape phone: clock shrinks so today panel is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const clock = await page.locator('.clock').boundingBox();
  expect(clock!.height).toBeLessThanOrEqual(150);
  await page.screenshot({ path: 'test-results/screens/landscape-844x390.png', fullPage: true });
});

test('tablet clock is larger than phone clock', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  const clock = await page.locator('.clock').boundingBox();
  expect(clock!.height).toBeGreaterThanOrEqual(300);
});
```

- [ ] **Step 2: Run to verify the two sizing tests fail**

Run: `cd Site && npx playwright test -g "landscape phone|tablet clock"`
Expected: FAIL (clock is 260px in both cases).

- [ ] **Step 3: Implement** — in `Site/src/styles/components.css`, replace the existing single clock media query line with:

```css
@media (max-width: 480px) { .clock { width: 200px; height: 200px; } }
/* Tablet portrait: the tall centered column earns a larger dial. Range-capped
   so desktop (≥1025px) stays exactly as shipped. */
@media (min-width: 768px) and (max-width: 1024px) { .clock { width: 300px; height: 300px; } }
/* Landscape phones: keep the today panel visible without scrolling past the dial. */
@media (max-height: 480px) { .clock { width: 150px; height: 150px; } }
```

Note the order: `max-height` last so it wins over the width rules on short-and-wide viewports.

- [ ] **Step 4: Run full e2e; eyeball every screenshot**

Run: `cd Site && npm run e2e`
Expected: ALL PASS. Then open each PNG under `Site/test-results/screens/` and check: no clipped toggle, no cramped sections, RTL mirrored correctly, dark surfaces intentional. Fix any visual defect found before committing (spacing values live in `tokens.css` `--space-section`).

- [ ] **Step 5: Commit**

```bash
git add Site/src/styles/components.css Site/e2e/site.spec.ts
git commit -m "feat(site): clock sizing for landscape phones and tablets; widen screenshot matrix"
```

---

### Task 3: Icons, web manifest, theme-color metas

**Files:**
- Create: `Site/scripts/gen-icons.mjs`
- Create: `Site/public/icons/icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (generated, committed)
- Create: `Site/public/site.webmanifest`
- Modify: `Site/index.html` (head metas)
- Modify: `Site/package.json` (add `gen:icons` script)
- Test: `Site/e2e/site.spec.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `/site.webmanifest` and `/icons/icon-*.png` URLs (Task 4's SW treats them as stale-while-revalidate; Task 5 adds nginx caching for `/icons/`).

- [ ] **Step 1: Write the failing e2e test** — append to `Site/e2e/site.spec.ts`:

```ts
test('web manifest and icons are served', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
  const res = await request.get('/site.webmanifest');
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy();
  }
  expect((await request.get('/icons/icon-180.png')).ok()).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd Site && npx playwright test -g "web manifest"`
Expected: FAIL (no manifest link).

- [ ] **Step 3: Create the icon generator** — `Site/scripts/gen-icons.mjs`:

```js
// Rasterizes the site's clock mark to PWA icons using Playwright's bundled
// Chromium — no image-processing dependency needed. Rerun: npm run gen:icons
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

// safe=1 → full-bleed background with the mark inside the 80% maskable safe zone.
const page_html = (size, safe) => `<!doctype html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#f7f5f0"/>
  <g transform="${safe ? 'translate(50 50) scale(0.72) translate(-50 -50)' : ''}">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#2b3446" stroke-width="3.5"/>
    <line x1="50" y1="50" x2="50" y2="27" stroke="#2b3446" stroke-width="5" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="67" y2="50" stroke="#4a6a99" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="2.5" fill="#2b3446"/>
  </g>
</svg></body>`;

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const targets = [
  { file: 'icon-180.png', size: 180, safe: false },
  { file: 'icon-192.png', size: 192, safe: false },
  { file: 'icon-512.png', size: 512, safe: false },
  { file: 'icon-512-maskable.png', size: 512, safe: true },
];
for (const { file, size, safe } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(page_html(size, safe));
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
console.log('icons written to Site/public/icons/');
```

Add to `Site/package.json` scripts: `"gen:icons": "node scripts/gen-icons.mjs"`.

Run: `cd Site && npm run gen:icons` — then open the four PNGs and verify they render as a clean clock mark (no cut-offs; maskable variant has visible margin).

- [ ] **Step 4: Create `Site/public/site.webmanifest`**

```json
{
  "name": "Persian Calendar",
  "short_name": "Persian Cal",
  "description": "Persian ↔ Gregorian date conversion, a live clock, and a daily thought — fully offline.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f7f5f0",
  "theme_color": "#f7f5f0",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 5: Add head metas** — in `Site/index.html`, after the `<link rel="icon" …>` line insert:

```html
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f5f0" />
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1c22" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
  <link rel="manifest" href="/site.webmanifest" />
```

(`#f7f5f0` ≈ light `--surface` oklch(97.5% 0.006 85); `#1a1c22` ≈ dark `--surface` oklch(19% 0.01 260).)

- [ ] **Step 6: Run the test**

Run: `cd Site && npx playwright test -g "web manifest"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Site/scripts/gen-icons.mjs Site/public/icons Site/public/site.webmanifest Site/index.html Site/package.json
git commit -m "feat(site): PWA manifest, generated icons, theme-color metas"
```

---

### Task 4: Service worker + registration

**Files:**
- Create: `Site/public/sw.js`
- Modify: `Site/src/main.ts` (registration at end of file)
- Test: `Site/e2e/site.spec.ts` (append)

**Interfaces:**
- Consumes: `/site.webmanifest`, `/icons/*` from Task 3 (cached via SWR).
- Produces: offline capability; cache name `time-app-v1` (bump the suffix to invalidate all caches in future changes).

- [ ] **Step 1: Write the failing e2e tests** — append to `Site/e2e/site.spec.ts`:

```ts
test('service worker registers and serves the site offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Second load lets the SW's runtime caching capture CSS/JS/font assets.
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#today-persian')).not.toBeEmpty();
  await expect(page.locator('#quote')).toBeVisible();
  await context.setOffline(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd Site && npx playwright test -g "service worker"`
Expected: FAIL (`navigator.serviceWorker.ready` never resolves — nothing registered).

- [ ] **Step 3: Create `Site/public/sw.js`**

```js
// Hand-rolled service worker — see spec §1.2. Strategies:
//   navigations      → network-first, offline fallback to cached '/'
//   /assets/* (hashed, immutable) → cache-first
//   everything else same-origin   → stale-while-revalidate
// Bump CACHE to invalidate every cached response at once.
const CACHE = 'time-app-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put('/', fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match('/');
    return hit ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => undefined);
  if (hit) return hit;
  return (await refresh) ?? Response.error();
}
```

- [ ] **Step 4: Register it** — append to `Site/src/main.ts`:

```ts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registration failure is silent-degrade: the site works exactly as before.
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
```

- [ ] **Step 5: Run the test, then the full suites**

Run: `cd Site && npx playwright test -g "service worker" && npm test && npm run e2e`
Expected: ALL PASS. Caveat: `vite preview` serves `public/` files verbatim, so `/sw.js` resolves; scope is `/` because the file sits at the root.

- [ ] **Step 6: Commit**

```bash
git add Site/public/sw.js Site/src/main.ts Site/e2e/site.spec.ts
git commit -m "feat(site): offline service worker — network-first nav, cache-first assets, SWR data"
```

---

### Task 5: nginx caching for the new routes + container verification

**Files:**
- Modify: `deploy/nginx.conf`

**Interfaces:**
- Consumes: `/sw.js`, `/site.webmanifest`, `/icons/*` from Tasks 3–4.
- Produces: production headers; the deployed update channel (`sw.js`, manifest, `/`) is `no-cache`.

- [ ] **Step 1: Edit `deploy/nginx.conf`** — after the `location = /quotes.json` block insert:

```nginx
    # sw.js and index.html are the PWA update channel: both fall through to
    # `location /` and inherit its `no-cache` — declared here as documentation.
    location = /site.webmanifest {
        include /etc/nginx/security-headers.conf;
        default_type application/manifest+json;
        add_header Cache-Control "no-cache" always;
    }

    location ^~ /icons/ {
        include /etc/nginx/security-headers.conf;
        add_header Cache-Control "public, max-age=604800" always;
        try_files $uri =404;
    }
```

And extend the gzip line: `gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;`

- [ ] **Step 2: Verify in the real container**

```bash
docker build -t time-app:test /Users/ali/Projects/PersianCalendar
docker run -d --rm --name time-app-test -p 8081:8080 time-app:test
sleep 2
curl -sI http://127.0.0.1:8081/sw.js | grep -iE 'cache-control|content-type'          # expect no-cache, application/javascript
curl -sI http://127.0.0.1:8081/site.webmanifest | grep -iE 'cache-control|content-type' # expect no-cache, application/manifest+json
curl -sI http://127.0.0.1:8081/icons/icon-192.png | grep -i cache-control              # expect max-age=604800
curl -s http://127.0.0.1:8081/health                                                    # expect ok
docker stop time-app-test
```

Expected: headers exactly as annotated. If `content-type` for the manifest is wrong, the `default_type` line above fixes it — re-check the block was placed inside the `server` context.

- [ ] **Step 3: Commit**

```bash
git add deploy/nginx.conf
git commit -m "ci(deploy): nginx routes for manifest and icons; gzip manifest json"
```

---

### Task 6: README, full verification, deploy gate

**Files:**
- Modify: `README.md` (PWA/mobile section)

- [ ] **Step 1: Update `README.md`** — add a `### PWA` subsection under the Site docs describing: installable (manifest + icons via `npm run gen:icons`), offline via hand-rolled `public/sw.js` (strategy table: navigate=network-first, assets=cache-first, rest=SWR), cache invalidation by bumping `CACHE` in `sw.js`, and the extended Playwright matrix (320–1440 + landscape + fa/RTL).

- [ ] **Step 2: Full local verification**

```bash
cd Site && npm run build && npm test && npm run e2e
```

Expected: build clean, all vitest + Playwright tests pass. Review the final screenshot set once more.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: PWA and mobile verification notes"
```

- [ ] **Step 4: Deploy + live verification (requires user go-ahead to push)**

After `git push` (CI deploys master to Hetzner automatically):

```bash
curl -sI https://time.automated.ink/site.webmanifest | grep -iE 'HTTP|cache-control|content-type'
curl -sI https://time.automated.ink/sw.js | grep -iE 'HTTP|cache-control'
```

Then in Chrome (device emulation, e.g. iPhone 14 + iPad Air): load the site, confirm installability (Application → Manifest shows no warnings), toggle offline in DevTools and reload, check safe-area rendering and both orientations. Run a Lighthouse audit against https://time.automated.ink/ and confirm the PWA-installability checks pass. Report findings with screenshots.

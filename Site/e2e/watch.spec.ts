import { expect, test } from '@playwright/test';

test('Analog is the default; Digital can be chosen and survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.clock.watch-face--analog')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-watch-face').selectOption('digital');
  await page.keyboard.press('Escape');
  await expect(page.locator('.clock.watch-face--digital')).toBeVisible();
  await expect(page.locator('.watch-face--analog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.clock.watch-face--digital')).toBeVisible();
});

test('light and dark: the dial follows the system scheme, live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const fill = () => page.locator('.wa-num').first().evaluate((el) => getComputedStyle(el).fill);
  const light = await fill();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(fill).not.toBe(light);
});

test('Persian page: Latin digits on the dial, Persian label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'fa'));
  await page.goto('/');
  await expect(page.locator('.wa-num')).toHaveText(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  await expect(page.locator('.clock')).toHaveAttribute('aria-label', /^ساعت، [۰-۹]{2}:[۰-۹]{2}$/);
  await page.locator('#settings-toggle').click();
  await page.locator('#set-watch-face').selectOption('digital');
  await page.keyboard.press('Escape');
  await expect(page.locator('.wd-hm')).toHaveText(/^\d\d:\d\d$/);
});

const openMonthViews = (page: import('@playwright/test').Page) =>
  page.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = true; });

test('wide screens: the watch is a sticky left half; phones stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await openMonthViews(page);                  // fix round 1: the page must really scroll
  const box = await page.locator('.clock').boundingBox();
  expect(box!.x + box!.width / 2).toBeLessThan(720);
  await page.mouse.move(1000, 450);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const after = await page.locator('.clock').boundingBox();
  expect(Math.abs(after!.y - box!.y)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 400, height: 860 });
  await page.reload();
  const phone = await page.locator('.clock').boundingBox();
  expect(phone!.width).toBeGreaterThan(340);
});

// Fix round 1: the sticky column must fit short wide screens, or its foot is never reachable.
for (const [w, h] of [[1366, 768], [1280, 720]] as const) {
  test(`wide screens: the watch column fits ${w}x${h}, scrolled to the end`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await openMonthViews(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const inView = async (sel: string) => {
      const r = await page.locator(sel).boundingBox();
      expect(r, sel).not.toBeNull();
      expect(r!.y, sel).toBeGreaterThanOrEqual(0);
      expect(r!.y + r!.height, sel).toBeLessThanOrEqual(h);
    };
    await inView('#watch-box');
    await inView('#today-gregorian');
    if (await page.locator('#tehran-line').isVisible()) await inView('#tehran-line');
  });
}

for (const [w, h] of [[1440, 900], [1280, 800], [1280, 720]] as const) {
  test(`wide screens: the watch is at most 360 px and the column fits at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const box = (await page.locator('#watch-box').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(360.5);
    expect(box.width).toBeGreaterThanOrEqual(200);
    expect(box.x + box.width / 2).toBeLessThan(w / 2);            // in the left column
    await expect(page.locator('#today-persian')).toBeInViewport();
    await expect(page.locator('#today-gregorian')).toBeInViewport();
  });
}

test('phones: the watch size is unchanged (min(92vw, 62vh))', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto('/');
  const box = (await page.locator('#watch-box').boundingBox())!;
  expect(box.width).toBeCloseTo(Math.min(0.92 * 400, 0.62 * 860), 0);
});

test('the analog hands reach their scales on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const r = await page.evaluate(() => {
    const svg = document.querySelector('.watch-face--analog') as SVGSVGElement;
    const ctm = svg.getScreenCTM()!;
    const unit = Math.hypot(ctm.a, ctm.b);                      // px per viewBox unit
    const c = new DOMPoint(100, 100).matrixTransform(ctm);
    const reach = (id: string) => {
      const g = document.getElementById(id) as unknown as SVGGraphicsElement;
      const path = g.querySelector('path') as SVGPathElement;
      const m = path.getScreenCTM()!;
      let best = 0;
      for (let i = 0; i <= 400; i++) {
        const p = path.getPointAtLength((path.getTotalLength() * i) / 400).matrixTransform(m);
        best = Math.max(best, Math.hypot(p.x - c.x, p.y - c.y));
      }
      return best / unit;
    };
    return { hour: reach('hand-hour'), minute: reach('hand-minute'), second: reach('hand-second') };
  });
  expect(r.hour).toBeGreaterThan(67); expect(r.hour).toBeLessThan(72.5);       // stops at the numerals
  expect(r.minute).toBeGreaterThan(91.5); expect(r.minute).toBeLessThanOrEqual(96); // inside the track
  expect(r.second).toBeGreaterThan(94); expect(r.second).toBeLessThanOrEqual(96);
});

test('digital fits a 320 px phone, in Persian, with Latin digits', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'fa');
    localStorage.setItem('settings.v1', JSON.stringify({ watch: { face: 'digital' } }));
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const hm = page.locator('.wd-hm');
  await expect(hm).toHaveText(/^\d\d:\d\d$/);
  const fit = await page.evaluate(() => {
    const face = document.querySelector('.watch-face--digital') as HTMLElement;
    const box = document.getElementById('watch-box')!.getBoundingClientRect();
    const r = face.getBoundingClientRect();
    const hmRect = face.querySelector('.wd-hm')!.getBoundingClientRect();
    return { overflow: face.scrollWidth - face.clientWidth, inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5, oneLine: hmRect.height < 1.6 * parseFloat(getComputedStyle(face.querySelector('.wd-hm')!).fontSize) };
  });
  expect(fit.overflow).toBeLessThanOrEqual(0);
  expect(fit.inside).toBe(true);
  expect(fit.oneLine).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('dark mode restyles the analog dial live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const look = () => page.evaluate(() => [
    getComputedStyle(document.querySelector('.wa-num')!).fill,
    getComputedStyle(document.querySelector('.wa-ring')!).stroke,
    getComputedStyle(document.querySelector('.wa-blue-1')!).stopColor,
  ].join('|'));
  const light = await look();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(look).not.toBe(light);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const w of [400, 1440] as const) {
    for (const face of ['analog', 'digital'] as const) {
      test(`screenshot watch ${scheme} ${w} ${face}`, async ({ page }) => {
        await page.addInitScript((f) => localStorage.setItem('settings.v1', JSON.stringify({ watch: { face: f } })), face);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: w, height: w === 400 ? 860 : 900 });
        await page.goto('/');
        await expect(page.locator(`.watch-face--${face}`)).toBeVisible();
        await page.locator('#clock-section').screenshot({ path: `test-results/screens/watch-${scheme}-${w}-${face}.png` });
      });
    }
  }
}

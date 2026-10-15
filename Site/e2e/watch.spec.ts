import { expect, test } from '@playwright/test';

const angle = async (page: import('@playwright/test').Page, sel: string) =>
  Number(/rotate\((-?[\d.e-]+)/.exec((await page.locator(sel).getAttribute('transform')) ?? '')?.[1]);

test('Full bleed is the default; Classic can be chosen and survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.clock.watch-face--fullbleed')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-watch-face').selectOption('classic');
  await page.keyboard.press('Escape');
  await expect(page.locator('.clock.watch-face--classic')).toBeVisible();
  await expect(page.locator('#movement-toggle')).toBeHidden();
  await page.reload();
  await expect(page.locator('.clock.watch-face--classic')).toBeVisible();
});

test('Show movement reveals a train geared to the hands; Show time returns', async ({ page }) => {
  await page.goto('/');
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount svg')).toBeVisible();
  await expect(page.locator('#movement-toggle')).toHaveText('Show time');
  await expect(page.locator('#watch-digital')).toHaveText(/^\d\d:\d\d$/);
  // the centre wheel turns with the minute hand (within one beat)
  const minute = await angle(page, '#hand-minute');
  const centre = await angle(page, '#movement-mount [data-part="centre"]');
  // Mechanics: the wheel is beat-quantised and the hand continuous, so the wheel can trail the
  // hand by a hair; measure the gap both ways round the dial, not only forward.
  const gap = (((centre - minute) % 360) + 360) % 360;
  expect(Math.min(gap, 360 - gap)).toBeLessThan(1);
  // the balance is actually swinging
  const a = await angle(page, '#movement-mount [data-part="balance"]');
  await page.waitForTimeout(60);
  expect(await angle(page, '#movement-mount [data-part="balance"]')).not.toBe(a);
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount svg')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('#movement-toggle')).toBeFocused();
});

test('reduced motion: the movement shows but the balance stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount [data-part="balance"]')).toHaveAttribute('transform', /^rotate\(0 /);
});

test('light and dark: the dial follows the system scheme, live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const fill = () => page.locator('.wf-num').first().evaluate((el) => getComputedStyle(el).fill);
  const light = await fill();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(fill).not.toBe(light);
});

test('Persian page: Latin digits on the dial, Persian label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'fa'));
  await page.goto('/');
  await expect(page.locator('.wf-num')).toHaveText(['12', '3', '6', '9']);
  await expect(page.locator('.clock')).toHaveAttribute('aria-label', /^ساعت، [۰-۹]{2}:[۰-۹]{2}$/);
  await expect(page.locator('#movement-toggle')).toHaveText('نمایش موتور');
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
  test(`wide screens: the watch column fits ${w}x${h}, movement open, scrolled to the end`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await openMonthViews(page);
    await page.locator('#movement-toggle').click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const inView = async (sel: string) => {
      const r = await page.locator(sel).boundingBox();
      expect(r, sel).not.toBeNull();
      expect(r!.y, sel).toBeGreaterThanOrEqual(0);
      expect(r!.y + r!.height, sel).toBeLessThanOrEqual(h);
    };
    await inView('#watch-box');
    await inView('#movement-toggle');
    await inView('#today-gregorian');
    if (await page.locator('#tehran-line').isVisible()) await inView('#tehran-line');
  });
}

// Fix round 1: Show movement must not move the dial or the toggle.
for (const [w, h] of [[1440, 900], [400, 860]] as const) {
  test(`Show movement keeps the dial in place at ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const dial = await page.locator('#clock-mount').boundingBox();
    const toggle = await page.locator('#movement-toggle').boundingBox();
    await page.locator('#movement-toggle').click();
    await expect(page.locator('#watch-digital')).toHaveText(/^\d\d:\d\d$/);
    expect((await page.locator('#clock-mount').boundingBox())!.y).toBe(dial!.y);
    expect((await page.locator('#movement-toggle').boundingBox())!.y).toBe(toggle!.y);
    await page.locator('#movement-toggle').click();
    await expect(page.locator('#movement-mount svg')).toHaveCount(0, { timeout: 3000 });
    expect((await page.locator('#clock-mount').boundingBox())!.y).toBe(dial!.y);
  });
}

// Added beyond the brief (controller ruling): wide-screen part labels must be legible.
test('wide screens: movement labels render at a legible size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#movement-toggle').click();
  await expect(page.locator('#movement-mount .mv-label').first()).toBeVisible();
  const sizes = await page.locator('#movement-mount .mv-label').evaluateAll((els) =>
    els.map((el) => parseFloat(getComputedStyle(el).fontSize) * (el as SVGGraphicsElement).getScreenCTM()!.a));
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const [w, h] of [[400, 860], [1440, 900]] as const) {
    for (const view of ['dial', 'movement'] as const) {
      test(`screenshot watch ${scheme} ${w} ${view}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        if (view === 'movement') { await page.locator('#movement-toggle').click(); await page.waitForTimeout(1100); }
        await page.locator('#clock-section').screenshot({ path: `test-results/screens/watch-${scheme}-${w}-${view}.png` });
      });
    }
  }
}

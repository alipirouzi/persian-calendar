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

test('wide screens: the watch is a sticky left half; phones stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const box = await page.locator('.clock').boundingBox();
  expect(box!.x + box!.width / 2).toBeLessThan(720);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  const after = await page.locator('.clock').boundingBox();
  expect(after!.y).toBeCloseTo(box!.y, 0);
  await page.setViewportSize({ width: 400, height: 860 });
  await page.reload();
  const phone = await page.locator('.clock').boundingBox();
  expect(phone!.width).toBeGreaterThan(340);
});

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

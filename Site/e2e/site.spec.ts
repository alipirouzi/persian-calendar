import { expect, test } from '@playwright/test';

test('loads with today prefilled and consistent across calendars', async ({ page }) => {
  await page.goto('/');
  const gy = await page.locator('#g-y').inputValue();
  const now = new Date();
  expect(Number(gy)).toBe(now.getFullYear());
  expect(Number(await page.locator('#g-m').inputValue())).toBe(now.getMonth() + 1);
  expect(Number(await page.locator('#g-d').inputValue())).toBe(now.getDate());
  // Persian side must agree with ICU's persian calendar for today
  const expected = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const part = (type: string): number =>
    Number(expected.find((p) => p.type === type)?.value);
  expect(Number(await page.locator('#p-y').inputValue())).toBe(part('year'));
  expect(Number(await page.locator('#p-m').inputValue())).toBe(part('month'));
  expect(Number(await page.locator('#p-d').inputValue())).toBe(part('day'));
});

test('persian → gregorian live conversion', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-m')).toHaveValue('1');
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('gregorian → persian live conversion', async ({ page }) => {
  await page.goto('/');
  await page.locator('#g-y').fill('2026');
  await page.locator('#g-m').fill('7');
  await page.locator('#g-d').fill('31');
  await expect(page.locator('#p-y')).toHaveValue('1405');
  await expect(page.locator('#p-m')).toHaveValue('5');
  await expect(page.locator('#p-d')).toHaveValue('9');
});

test('invalid day shows localized month-aware error', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1404');
  await page.locator('#p-m').fill('12');
  await page.locator('#p-d').fill('30');
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#converter-error')).toContainText('Esfand');
});

test('language toggle switches to FA with RTL and Persian digits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('#today-persian')).toContainText('۱۴');
});

test('daily quote appears', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#quote')).toBeVisible();
  await expect(page.locator('#quote-text')).not.toBeEmpty();
});

test('clock hands are driven', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#hand-second').getAttribute('transform');
  await page.waitForTimeout(1200);
  const after = await page.locator('#hand-second').getAttribute('transform');
  expect(after).not.toBe(before);
});

test('reduced motion still advances the clock via the interval fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const second = page.locator('#hand-second');
  // The hand is positioned immediately, before any tick fires.
  await expect(second).toHaveAttribute('transform', /^rotate\([\d.]+ 100 100\)$/);
  const before = await second.getAttribute('transform');
  // The 1 s interval fallback must keep it moving even with rAF disabled.
  await expect
    .poll(async () => (await second.getAttribute('transform')) !== before, {
      timeout: 5000,
      intervals: [250, 250, 250, 250],
    })
    .toBe(true);
});

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

test('date inputs stay comfortable touch targets on tablets (768, 1024)', async ({ page }) => {
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    for (const id of ['#p-y', '#p-m', '#p-d', '#g-y', '#g-m', '#g-d']) {
      const box = await page.locator(id).boundingBox();
      expect(box, `${id} @${width}`).not.toBeNull();
      expect(box!.height, `${id} @${width}`).toBeGreaterThanOrEqual(44);
      const fontPx = await page.locator(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontPx, `${id} @${width}`).toBeGreaterThanOrEqual(16);
    }
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

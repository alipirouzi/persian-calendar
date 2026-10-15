import { expect, test, type Page, type Route } from '@playwright/test';

// Ten seconds before Nowruz 1405 in Tehran: 2026-03-20 23:59:50 +03:30.
const BEFORE_NOWRUZ_SEC = Date.UTC(2026, 2, 20, 20, 29, 50) / 1000;

const answerWith = (body: string, contentType = 'application/json') => (route: Route) =>
  route.fulfill({ status: 200, contentType, headers: { 'Cache-Control': 'no-store' }, body });

const serverAhead = (skewMs: number) => (route: Route) =>
  route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ epochSec: (Date.now() + skewMs) / 1000 }),
  });

const openSettings = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /Settings|تنظیمات/ }).click();
};

test.describe('with the service worker blocked, so page.route sees every request', () => {
  test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`the today panel turns over at midnight without a reload (${reducedMotion} motion)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.route('**/api/time', answerWith(JSON.stringify({ epochSec: BEFORE_NOWRUZ_SEC })));
      await page.goto('/');

      await expect(page.locator('#today-persian')).toContainText('29 Esfand 1404');
      await expect(page.locator('#today-gregorian')).toContainText('March 20, 2026');

      await expect(page.locator('#today-persian')).toContainText('1 Farvardin 1405', { timeout: 20_000 });
      await expect(page.locator('#today-gregorian')).toContainText('March 21, 2026');
    });
  }

  test('a slow device clock is reported and corrected', async ({ page }) => {
    await page.route('**/api/time', serverAhead(5_000));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText(/^Synced \d\d:\d\d · device 5\.0 s slow$/);
  });

  test('a page that is not our JSON falls back to the device clock', async ({ page }) => {
    await page.route('**/api/time', answerWith('<!doctype html><title>Wi-Fi login</title>', 'text/html'));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock");
  });

  test('an unreachable server falls back to the device clock', async ({ page }) => {
    await page.route('**/api/time', (route) => route.abort('internetdisconnected'));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock");
    await page.locator('#set-time-test').click();
    await expect(page.locator('#set-time-test-result')).toHaveText('Unreachable');
  });

  test('device-only makes no request, and the choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.locator('#set-time-source').selectOption('device');
    await expect(page.locator('#set-time-status')).toHaveText("Using this device's clock");

    let requests = 0;
    await page.route('**/api/time', (route) => { requests += 1; return serverAhead(0)(route); });
    await page.reload();
    await openSettings(page);
    await expect(page.locator('#set-time-source')).toHaveValue('device');
    await expect(page.locator('#set-time-status')).toHaveText("Using this device's clock");
    expect(requests).toBe(0);
  });

  test('Test connection reports the round trip', async ({ page }) => {
    await page.route('**/api/time', serverAhead(0));
    await page.goto('/');
    await openSettings(page);
    await page.locator('#set-time-test').click();
    await expect(page.locator('#set-time-test-result')).toHaveText(/^OK · \d+ ms · device clock accurate$/);
  });

  test('the Time group is translated and right-to-left in Persian', async ({ page }) => {
    await page.route('**/api/time', serverAhead(0));
    await page.goto('/');
    await page.locator('#lang-toggle').click();
    await openSettings(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#set-time-test')).toHaveText('آزمایش اتصال');
    await expect(page.locator('#set-time-status')).toHaveText(/^همگام‌شده در [۰-۹]{2}:[۰-۹]{2} · ساعت دستگاه دقیق است$/);
  });
});

test('the service worker never caches /api/time, so offline means the device clock', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The second load is controlled by the worker, so its /api/time requests pass through it.
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await openSettings(page);
  await expect(page.locator('#set-time-status')).toHaveText(/^Synced /);

  const cached = await page.evaluate(async () =>
    (await (await caches.open('time-app-v1')).match('/api/time')) !== undefined);
  expect(cached).toBe(false);

  await context.setOffline(true);
  await page.reload();
  await openSettings(page);
  await expect(page.locator('#set-time-status')).toHaveText("Not synced — using this device's clock", { timeout: 15_000 });
  await context.setOffline(false);
});

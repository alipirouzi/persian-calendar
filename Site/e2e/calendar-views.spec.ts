// Site/e2e/calendar-views.spec.ts
import { expect, test, type Page } from '@playwright/test';

// 1 Farvardin 1405, 12:00 in Tehran.
const NOWRUZ_NOON = Date.UTC(2026, 2, 21, 8, 30) / 1000;

const fixTime = (page: Page) => page.route('**/api/time', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ epochSec: NOWRUZ_NOON }),
}));
const noOfficialData = (page: Page) => page.route('**/api/holidays/ir/*.json', (route) => route.fulfill({ status: 404, body: '' }));
const persian = (page: Page) => page.locator('#view-persian');
const gregorian = (page: Page) => page.locator('#view-gregorian');

test.describe('with a fixed clock and the service worker blocked', () => {
  test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

  test.beforeEach(async ({ page }) => {
    await fixTime(page);
    await noOfficialData(page);
    await page.goto('/');
    await expect(persian(page).locator('.mv-title')).toHaveText('Farvardin 1405');
  });

  test('Persian month is open on today, with Nowruz and an estimated Eid al-Fitr', async ({ page }) => {
    await expect(persian(page)).toHaveAttribute('open', '');
    await expect(gregorian(page)).not.toHaveAttribute('open', '');
    const today = persian(page).locator('.mv-day[aria-current="date"]');
    await expect(today).toHaveText('1');
    await expect(today).toHaveClass(/holiday/);
    await expect(persian(page).locator('.mv-holidays')).toContainText('Nowruz');
    await expect(persian(page).locator('.mv-holidays li', { hasText: 'Eid al-Fitr' }).first()).toContainText('estimated');
  });

  test('official data replaces the estimate', async ({ page }) => {
    await page.unroute('**/api/holidays/ir/*.json');
    await page.route('**/api/holidays/ir/1405.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [{ key: 'ir.ashura', p: '1405-04-05' }] }),
    }));
    await page.reload();
    for (let i = 0; i < 3; i += 1) await persian(page).locator('.mv-next').click();
    await expect(persian(page).locator('.mv-title')).toHaveText('Tir 1405');
    const ashura = persian(page).locator('.mv-holidays li', { hasText: 'Ashura' });
    await expect(ashura).toHaveCount(1);
    await expect(ashura).toContainText('5 Tir');
    await expect(ashura).not.toContainText('estimated');
  });

  test('Gregorian month shows Nuremberg holidays; paging and Today', async ({ page }) => {
    await gregorian(page).locator('summary').click();
    await expect(gregorian(page).locator('.mv-title')).toHaveText('March 2026');
    await gregorian(page).locator('.mv-next').click();
    const list = gregorian(page).locator('.mv-holidays');
    await expect(list).toContainText('Good Friday');
    await expect(list).toContainText('Easter Monday');
    await expect(list.locator('li', { hasText: 'Easter Monday' })).toContainText('Nuremberg');
    await gregorian(page).locator('.mv-today').click();
    await expect(gregorian(page).locator('.mv-title')).toHaveText('March 2026');
  });

  test('clicking a day fills the converter', async ({ page }) => {
    await persian(page).locator('.mv-day[data-day="13"]').click();
    await expect(page.locator('#p-d')).toHaveValue('13');
    await expect(page.locator('#g-m')).toHaveValue('4');
    await expect(page.locator('#g-d')).toHaveValue('2');
  });

  test('the open state survives a reload', async ({ page }) => {
    await persian(page).locator('summary').click();
    await expect(persian(page)).not.toHaveAttribute('open', '');
    // The toggle event is queued, so wait for it to be stored before reloading.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('settings.v1')))
      .toContain('"persian":{"enabled":true,"open":false}');
    await page.reload();
    await expect(persian(page).locator('.mv-title')).toHaveText('Farvardin 1405');
    await expect(persian(page)).not.toHaveAttribute('open', '');
  });

  test('Persian: translated, right to left, Persian digits', async ({ page }) => {
    await page.locator('#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(persian(page).locator('.mv-title')).toHaveText('فروردین ۱۴۰۵');
    await expect(persian(page).locator('summary')).toHaveText('ماه شمسی');
    await expect(persian(page).locator('.mv-holidays')).toContainText('عید نوروز');
  });
});

test.describe('offline, with the service worker active', () => {
  test.use({ timezoneId: 'Asia/Tehran' });

  // sw.js returns early for /api/time, so the route still pins the clock to Nowruz.
  // Nothing is routed for holidays: there is no official file, so only estimates can show.
  test('offline, the month view still renders with estimated holidays', async ({ page, context }) => {
    await fixTime(page);
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await page.reload();
    await expect(persian(page).locator('.mv-title')).toHaveText('Farvardin 1405');
    await expect(persian(page).locator('.mv-holidays li', { hasText: 'estimated' }).first()).toBeVisible();
    await expect(persian(page).locator('.mv-day.holiday')).not.toHaveCount(0);
    await context.setOffline(false);
  });
});

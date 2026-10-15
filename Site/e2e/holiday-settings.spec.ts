import { expect, test, type Page } from '@playwright/test';

const NOWRUZ_NOON = Date.UTC(2026, 2, 21, 8, 30) / 1000;

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Tehran' });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/time', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ epochSec: NOWRUZ_NOON }),
  }));
  await page.route('**/api/holidays/ir/*.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('#view-persian .mv-title')).toHaveText('Farvardin 1405');
});

const openSettings = (page: Page) => page.getByRole('button', { name: /Settings|تنظیمات/ }).click();

test('add, edit and delete a holiday of my own; it shows in the month view and survives a reload', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-uh-name').fill('Family day');
  await page.locator('#set-uh-day').fill('5');
  await page.locator('#set-uh-save').click();
  await expect(page.locator('#set-user-holidays')).toContainText('Family day');
  await page.keyboard.press('Escape');
  const mine = page.locator('#view-persian .mv-holidays li', { hasText: 'Family day' });
  await expect(mine).toContainText('Mine');
  await expect(page.locator('#view-persian .mv-day[data-day="5"]')).toHaveClass(/holiday/);

  await page.reload();
  await expect(mine).toHaveCount(1);

  await openSettings(page);
  await page.getByRole('button', { name: 'Edit Family day' }).click();
  await page.locator('#set-uh-name').fill('Family reunion');
  await page.locator('#set-uh-save').click();
  await page.getByRole('button', { name: 'Delete Family reunion' }).click();
  await expect(page.locator('#set-user-holidays')).toHaveText('None yet');
});

test('a date that does not exist is refused', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-uh-name').fill('Leap');
  await page.locator('#set-uh-month').selectOption('12');
  await page.locator('#set-uh-day').fill('30');
  await page.locator('#set-uh-year').fill('1405');
  await page.locator('#set-uh-save').click();
  await expect(page.locator('#set-uh-error')).toHaveText('Enter a name and a date that exists');
});

test('turning sources and views off', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-src-ir').uncheck();
  await page.locator('#set-src-nuremberg').uncheck();
  await page.locator('#set-src-user').uncheck();
  await page.locator('#set-view-gregorian').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-persian .mv-day.holiday')).toHaveCount(0);
  await expect(page.locator('#view-persian .mv-holidays')).toHaveText('No holidays this month');
  await expect(page.locator('#view-gregorian')).toBeHidden();
});

test('test connection reports missing, then present, official data', async ({ page }) => {
  await openSettings(page);
  await page.locator('#set-holidays-test').click();
  await expect(page.locator('#set-holidays-test-result')).toHaveText('No official data for 1405 — using estimates');
  await page.unroute('**/api/holidays/ir/*.json');
  await page.route('**/api/holidays/ir/1405.json', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    // A file needs at least one holiday to count as official data.
    body: JSON.stringify({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [{ key: 'ir.ashura', p: '1405-04-04' }] }),
  }));
  await page.locator('#set-holidays-test').click();
  await expect(page.locator('#set-holidays-test-result')).toHaveText('OK · 1405 official data · updated 2026-10-12');
});

test('the group is translated and right to left in Persian', async ({ page }) => {
  await page.locator('#lang-toggle').click();
  await openSettings(page);
  await expect(page.locator('.settings-holidays legend')).toHaveText('تقویم‌ها و تعطیلات');
  await expect(page.locator('#set-uh-save')).toHaveText('افزودن');
  await expect(page.locator('#set-uh-month option').first()).toHaveText('فروردین');
});

import { expect, test } from '@playwright/test';

// Fixed vector: 1403-10-22 ↔ 2025-01-11 (Saturday), shared with unit tests.
async function enterPersianDate(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
}

test('month options carry localized labels and survive the language toggle', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('5 Mordad');
  await page.locator('#p-m-list li[data-value="5"]').click();
  await expect(page.locator('#p-m')).toHaveValue('5');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('۵ مرداد');
  await expect(page.locator('#p-m')).toHaveValue('۵'); // value preserved, digits localized
});

test('persian digits typed into fields convert identically to ASCII', async ({ page }) => {
  await page.goto('/');
  await page.locator('#g-y').fill('۲۰۲۶');
  await page.locator('#g-m').fill('7');
  await page.locator('#g-d').fill('31');
  await expect(page.locator('#p-y')).toHaveValue('1405');
  await expect(page.locator('#p-d')).toHaveValue('9');
});

test('weekday appears for a valid date', async ({ page }) => {
  await page.goto('/');
  await enterPersianDate(page);
  await expect(page.locator('#weekday')).toHaveText('Saturday');
});

test('weekday clears and copy disables on invalid date', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1404');
  await page.locator('#p-m').fill('12');
  await page.locator('#p-d').fill('30'); // 1404 is not a leap year
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#weekday')).toHaveText('');
  await expect(page.locator('#btn-copy')).toBeDisabled();
});

test('valid conversion updates the URL via replaceState', async ({ page }) => {
  await page.goto('/');
  await enterPersianDate(page);
  await expect(page).toHaveURL(/\?p=1403-10-22$/);
});

test('URL param prefills both sides on load', async ({ page }) => {
  await page.goto('/?p=1403-10-22');
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-m')).toHaveValue('1');
  await expect(page.locator('#g-d')).toHaveValue('11');
  await expect(page.locator('#weekday')).toHaveText('Saturday');
});

test('invalid URL param is ignored and today is shown', async ({ page }) => {
  await page.goto('/?p=1404-13-1');
  await expect(page.locator('#converter-error')).toBeHidden();
  const now = new Date();
  await expect(page.locator('#g-y')).toHaveValue(String(now.getFullYear()));
});

test('today button resets the converter and clears the query', async ({ page }) => {
  await page.goto('/?p=1403-10-22');
  await page.locator('#btn-today').click();
  const now = new Date();
  await expect(page.locator('#g-y')).toHaveValue(String(now.getFullYear()));
  await expect(page.locator('#g-d')).toHaveValue(String(now.getDate()));
  expect(new URL(page.url()).search).toBe('');
});

test('copy button puts the full sentence on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await enterPersianDate(page);
  await page.locator('#btn-copy').click();
  await expect(page.locator('#btn-copy')).toHaveText('Copied');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  await expect(page.locator('#btn-copy')).toHaveText('Copy'); // reverts after 1.5s
});

test('today panel shows the weekday', async ({ page }) => {
  await page.goto('/');
  const now = new Date();
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  await expect(page.locator('#today-persian')).toContainText(weekday as string);
  await expect(page.locator('#today-gregorian')).toContainText(weekday as string);
});

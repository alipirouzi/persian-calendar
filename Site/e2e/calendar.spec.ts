import { expect, test } from '@playwright/test';

async function openPersianCalendar(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
}

test('the Persian calendar opens on the current month, Saturday first', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-title')).toHaveText('Dey 1403');
  const heads = await page.locator('#p-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(30); // Dey
  await expect(page.locator('#p-cal-grid .cal-cell.active')).toHaveText('22');
});

test('the Gregorian calendar starts weeks on Monday', async ({ page }) => {
  await page.goto('/');
  await page.locator('#g-cal').click();
  const heads = await page.locator('#g-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('picking a day drives the conversion and closes', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await page.locator('#p-cal-grid .cal-cell[data-day="1"]').click();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-d')).toHaveValue('1');
  // 1403-10-01 is 2024-12-21.
  await expect(page.locator('#g-y')).toHaveValue('2024');
  await expect(page.locator('#g-m')).toHaveValue('12');
  await expect(page.locator('#g-d')).toHaveValue('21');
});

test('month navigation rolls across the year boundary', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  for (let i = 0; i < 3; i++) await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Farvardin 1404');
  await page.locator('#p-cal-prev').click();
  await expect(page.locator('#p-cal-title')).toHaveText('Esfand 1403');
  await expect(page.locator('#p-cal-grid .cal-cell')).toHaveCount(30); // 1403 is leap
});

test('navigation stops at the supported range bound', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1200');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d').fill('1');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-prev')).toBeDisabled();
  await expect(page.locator('#p-cal-next')).toBeEnabled();
});

test('the calendar is keyboard operable', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-grid')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d23');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d30');
  await page.keyboard.press('PageUp');
  await expect(page.locator('#p-cal-title')).toHaveText('Azar 1403');
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-cal')).toBeFocused();
});

test('Enter picks the focused day', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-d')).toHaveValue('21');
});

test('only one popup is open across pickers and calendars', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  // Keyboard-activated: the converter sits low enough that the option list
  // always opens upward on a desktop viewport, and it covers the legend the
  // calendar button lives in, so a pointer cannot reach the button from here.
  await page.locator('#p-cal').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  // The other direction is a plain pointer press, and the day list must really
  // open: the calendar closing must not move the page out from under the click.
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-d-list')).toBeVisible();
});

test('opening the calendar does not scroll the page', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  // The popup grows the document; if focusing the grid scrolled to it, closing
  // it would snap the page back and eat whatever the user pressed next.
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test('the calendar follows the language toggle', async ({ page }) => {
  await page.goto('/');
  await openPersianCalendar(page);
  await expect(page.locator('#p-cal-title')).toHaveText('Dey 1403');
  // Activated from the keyboard on purpose: a pointer press outside the popup
  // dismisses it, which is the documented dismissal rule, and a closed calendar
  // renders fresh on its next open — so only the keyboard path can reach the
  // in-place re-render this test is about.
  await page.locator('#lang-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  await expect(page.locator('#p-cal-title')).toHaveText('دی ۱۴۰۳');
  const heads = await page.locator('#p-cal-grid .cal-wd').allTextContents();
  expect(heads).toEqual(['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']);
});

test('calendar cells are comfortable touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-cal').click();
  const cell = await page.locator('#p-cal-grid .cal-cell').first().boundingBox();
  expect(cell!.width).toBeGreaterThanOrEqual(24);
  expect(cell!.height).toBeGreaterThanOrEqual(24);
});

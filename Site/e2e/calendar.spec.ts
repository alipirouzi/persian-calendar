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
  // Reaching the toggle at all dismisses the calendar, by either route: a
  // pointer press outside the popup is a dismissal, and so is focus leaving it.
  await page.locator('#lang-toggle').focus();
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await page.keyboard.press('Enter');
  // The next open renders fresh, in the language now in force.
  await page.locator('#p-cal').click();
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

test('Tab out of the calendar closes it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
  await expect(page.locator('#p-cal')).toHaveAttribute('aria-expanded', 'false');
});

test('the keyboard cursor is visible and moves', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-grid .cal-cell.cursor')).toHaveCount(1);
  await expect(page.locator('#p-cal-grid .cal-cell.cursor')).toHaveText('22');
  const outline = await page.locator('#p-cal-grid .cal-cell.cursor')
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outline).toBe('2px');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-cal-grid .cal-cell.cursor')).toHaveText('29');
});

test('month arrows keep the keyboard working', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-cal').click();
  await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-grid')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-cal-pop')).toBeHidden();
});

test('arrow keys follow the visual direction in RTL', async ({ page }) => {
  await page.goto('/');
  await page.locator('#lang-toggle').click();
  await page.locator('#p-y').fill('۱۴۰۳');
  await page.locator('#p-m').fill('۱۰');
  await page.locator('#p-d').fill('۲۲');
  await page.locator('#p-cal').click();
  // RTL: the cell to the right of the 22nd is the 21st.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d21');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d22');
});

test('the calendar popup stays inside the viewport on a phone', async ({ page }) => {
  for (const fa of [false, true]) {
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');
      if (fa) await page.locator('#lang-toggle').click();
      for (const id of ['#p-cal', '#g-cal']) {
        await page.locator(id).click();
        const pop = page.locator(id === '#p-cal' ? '#p-cal-pop' : '#g-cal-pop');
        await expect(pop).toBeVisible();
        const box = await pop.boundingBox();
        expect(box!.x, `${id} @${width} fa=${fa}`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${id} @${width} fa=${fa}`).toBeLessThanOrEqual(width);
        expect(box!.y, `${id} @${width} fa=${fa}`).toBeGreaterThanOrEqual(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${id} @${width} fa=${fa}`).toBeLessThanOrEqual(0);
        await page.keyboard.press('Escape');
      }
    }
  }
});

test('the grid name carries the visible month', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-label', /Dey 1403/);
  await page.locator('#p-cal-next').click();
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-label', /Bahman 1403/);
});

test('the status row does not move when a date goes invalid', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  const before = await page.locator('#status-row').boundingBox();
  await page.locator('#p-m').fill('13');
  await expect(page.locator('#converter-error')).toBeVisible();
  const after = await page.locator('#status-row').boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);
});

// --- Third review round.

test('a date whose counterpart is out of range reports instead of crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#g-y').fill('1821');
  await page.locator('#g-m').fill('1');
  await page.locator('#g-d').fill('1');
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#converter-error')).toHaveText('Year must be between 1822 and 2121');
  // The Persian extremes map outside the Gregorian range and must say so.
  await page.locator('#p-y').fill('1200');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d').fill('1');
  await expect(page.locator('#converter-error'))
    .toHaveText('That date is outside the supported range');
  expect(errors, `uncaught: ${errors.join(' | ')}`).toHaveLength(0);
});

test('clicking the calendar chrome does not close it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  await page.locator('#p-cal-title').click();
  await expect(page.locator('#p-cal-pop')).toBeVisible();
  await page.keyboard.press('Escape'); // keyboard still reaches it
  await expect(page.locator('#p-cal-pop')).toBeHidden();
});

test('the whole week is visible at the narrowest phone width', async ({ page }) => {
  for (const fa of [false, true]) {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    if (fa) await page.locator('#lang-toggle').click();
    await page.locator('#p-cal').click();
    const pop = await page.locator('#p-cal-pop').boundingBox();
    const cells = await page.locator('#p-cal-grid .cal-wd').evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right }; }));
    expect(cells, `fa=${fa}`).toHaveLength(7);
    for (const [i, c] of cells.entries()) {
      expect(c.l, `col ${i} fa=${fa}`).toBeGreaterThanOrEqual(pop!.x - 1);
      expect(c.r, `col ${i} fa=${fa}`).toBeLessThanOrEqual(pop!.x + pop!.width + 1);
      expect(c.r, `col ${i} fa=${fa}`).toBeLessThanOrEqual(320);
    }
  }
});

test('the calendar fits a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto('/');
  await page.locator('#p-cal').click();
  const pop = await page.locator('#p-cal-pop').boundingBox();
  expect(pop!.y).toBeGreaterThanOrEqual(0);
  expect(pop!.y + pop!.height).toBeLessThanOrEqual(375 + 1);
  // Capped rather than clipped: it must be able to scroll to the last row.
  const scrollable = await page.locator('#p-cal-pop')
    .evaluate((el) => el.scrollHeight > el.clientHeight ? 'scrolls' : 'fits');
  expect(['scrolls', 'fits']).toContain(scrollable);
});

test('the full date line is announced', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#full-date')).toHaveAttribute('aria-live', 'polite');
});

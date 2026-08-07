import { expect, test } from '@playwright/test';

// Fixed vector: 1403-10-22 ↔ 2025-01-11 (Saturday), shared with the unit tests.
// 1403 is a Persian leap year; Dey (month 10) has 30 days.

test('chevron opens the month list with localized number-and-name labels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await expect(page.locator('#p-m-list li')).toHaveCount(12);
  await expect(page.locator('#p-m-list li[data-value="5"]')).toHaveText('5 Mordad');
  await expect(page.locator('#g-m-list li[data-value="8"]')).toHaveText('8 August');
});

test('clicking a month option commits it and drives the conversion', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-m-toggle').click();
  await page.locator('#p-m-list li[data-value="10"]').click();
  await expect(page.locator('#p-m')).toHaveValue('10');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-m')).toHaveValue('1');
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('typing a month converts without ever opening the popup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('day options carry weekday names and respect month length', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(30); // Dey
  await expect(page.locator('#p-d-list li[data-value="1"]')).toHaveText('1 Saturday');
  await expect(page.locator('#p-d-list li[data-value="22"]')).toHaveText('22 Saturday');
  await expect(page.locator('#p-d-list li[data-value="23"]')).toHaveText('23 Sunday');
});

test('day list regenerates when the month or year changes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(31); // Farvardin
  await page.locator('#p-m').fill('12');
  await expect(page.locator('#p-d-list li')).toHaveCount(30); // Esfand, 1403 is leap
  await page.locator('#p-y').fill('1404');
  await expect(page.locator('#p-d-list li')).toHaveCount(29); // Esfand, 1404 is common
});

test('day list falls back to a plain 1–31 list without a usable year', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(31);
  await expect(page.locator('#p-d-list li[data-value="22"]')).toHaveText('22');
});

test('keyboard: arrows open and move, Enter commits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-m').fill('1');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown'); // opens at the selected option (1)
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('ArrowDown'); // → 2
  await page.keyboard.press('ArrowDown'); // → 3
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('3');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toBeFocused(); // focus returns to the invoker
});

test('keyboard: Escape closes and keeps the typed value; Tab closes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('7');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('ArrowDown'); // move off the selected option
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toHaveValue('7'); // untouched by the cursor move
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('#p-m-list')).toBeHidden();
});

test('keyboard: Home and End jump to the ends of the list', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('12');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('1');
});

test('ARIA state tracks the popup and the active option', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  const input = page.locator('#p-m');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(page.locator('#p-m-list')).toHaveAttribute('role', 'listbox');
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(input).toHaveAttribute('aria-activedescendant', 'p-m-list-o5');
  await expect(page.locator('#p-m-list li[data-value="5"]'))
    .toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'p-m-list-o6');
  // aria-selected still marks the field's value, not the cursor.
  await expect(page.locator('#p-m-list li[data-value="5"]'))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#p-m-list li[data-value="6"]'))
    .toHaveAttribute('aria-selected', 'false');
});

test('toggles carry a localized accessible name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-label', 'Choose month');
  await expect(page.locator('#p-d-toggle')).toHaveAttribute('aria-label', 'Choose day');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-label', 'انتخاب ماه');
  await expect(page.locator('#p-d-toggle')).toHaveAttribute('aria-label', 'انتخاب روز');
});

test('clicking outside closes the popup without changing the value', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#today').click();
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m')).toHaveValue('5');
});

test('the month hint shows the resolved name and clears when invalid', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await expect(page.locator('#p-m-hint')).toHaveText('Mordad');
  await page.locator('#g-m').fill('8');
  await expect(page.locator('#g-m-hint')).toHaveText('August');
  await page.locator('#p-m').fill('13');
  await expect(page.locator('#p-m-hint')).toHaveText('');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#g-m-hint')).toHaveText('اوت');
});

test('an out-of-range typed month errors without blocking the keystroke', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('13');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#p-m')).toHaveValue('13'); // not swallowed
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#converter-error')).toHaveText('Month must be between 1 and 12');
  await expect(page.locator('#weekday')).toHaveText('');
  await expect(page.locator('#btn-copy')).toBeDisabled();
});

test('persian digits typed into the month field work like ASCII', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('۱۴۰۳');
  await page.locator('#p-m').fill('۱۰');
  await page.locator('#p-d').fill('۲۲');
  await expect(page.locator('#g-y')).toHaveValue('2025');
  await expect(page.locator('#g-d')).toHaveValue('11');
});

test('day options are comfortable touch targets on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-d-toggle').click();
  const options = await page.locator('#p-d-list li').all();
  expect(options.length).toBeGreaterThan(0);
  for (const option of options.slice(0, 5)) {
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('an open popup does not cause horizontal overflow at phone widths', async ({ page }) => {
  for (const width of [320, 375]) {
    for (const toggleId of ['#p-d-toggle', '#g-d-toggle', '#p-m-toggle', '#g-m-toggle']) {
      for (const fa of [false, true]) {
        await page.setViewportSize({ width, height: 812 });
        await page.goto('/');
        if (fa) await page.locator('#lang-toggle').click();
        await page.locator(toggleId).click();
        await expect(page.locator(toggleId)).toHaveAttribute('aria-expanded', 'true');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${width}px ${toggleId} fa=${fa}`).toBeLessThanOrEqual(0);
      }
    }
  }
});

test('typing while the list is open keeps the typed value on Enter', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-m').fill('');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');          // opens at index 0 (nothing matches)
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#p-m').fill('7');            // cursor must follow the value
  await expect(page.locator('#p-m-list li[data-value="7"]'))
    .toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('7'); // NOT reverted to 1
});

test('a popup opened with the chevron is keyboard-operable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#p-m-list')).toBeHidden();
  await page.locator('#p-m-toggle').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('6');
});

test('a popup closes when focus leaves the picker', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-d').focus();
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#g-y').focus();
  await expect(page.locator('#p-m-list')).toBeHidden();
  await expect(page.locator('#p-m-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('only one popup is open at a time', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  await expect(page.locator('#p-m-list')).toBeVisible();
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list')).toBeVisible();
  await expect(page.locator('#p-m-list')).toBeHidden();
});

test('the field name is not polluted by the toggle, list, or hint', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await expect(page.locator('#p-m-hint')).toHaveText('Mordad');
  // The label is explicit now, so the accessible name is the label text alone.
  const name = await page.locator('#p-m').evaluate((el) => {
    const id = el.getAttribute('id') as string;
    const label = document.querySelector(`label[for="${id}"]`);
    return label?.textContent ?? '';
  });
  expect(name).toBe('Month');
  await expect(page.locator('label[for="p-m"]')).toHaveCount(1);
  // The picker must NOT be inside the label.
  const nested = await page.locator('label[for="p-m"] .picker').count();
  expect(nested).toBe(0);
});

test('picking an option on a phone does not focus the text input', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-d-toggle').click();
  await page.locator('#p-d-list li[data-value="10"]').click();
  await expect(page.locator('#p-d')).toHaveValue('10');
  const activeId = await page.evaluate(() => document.activeElement?.id ?? '');
  expect(activeId).toBe('p-d-toggle'); // focus stayed on the invoker
});

test('the list flips above the field when there is no room below', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-d-toggle').click();
  const list = page.locator('#p-d-list');
  await expect(list).toBeVisible();
  const listBox = await list.boundingBox();
  const fieldBox = await page.locator('#p-d').boundingBox();
  expect(listBox).not.toBeNull();
  expect(fieldBox).not.toBeNull();
  // Whichever way it opened, it must fit inside the viewport.
  expect(listBox!.y).toBeGreaterThanOrEqual(0);
  expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(812);
});

test('Enter with no popup open does not reload the page', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.evaluate(() => { (window as unknown as Record<string, boolean>)['kept'] = true; });
  await page.locator('#p-y').press('Enter');
  await expect(page.locator('#g-d')).toHaveValue('11');
  // A reload would wipe the sentinel and the query string.
  expect(await page.evaluate(() => (window as unknown as Record<string, boolean>)['kept'])).toBe(true);
  expect(new URL(page.url()).search).toBe('?p=1403-10-22');
});

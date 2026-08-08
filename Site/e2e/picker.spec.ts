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
  // Option DOM is built on first open, so the Gregorian list has to be opened
  // before it holds anything.
  await page.locator('#g-m-toggle').click();
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
  // Editing another field takes focus, which closes the list; the rebuilt DOM
  // arrives on the next open, so each count is read from a freshly opened list.
  await page.locator('#p-m').fill('12');
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list li')).toHaveCount(30); // Esfand, 1403 is leap
  await page.locator('#p-y').fill('1404');
  await page.locator('#p-d-toggle').click();
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

test('the full date line tracks the converter in both languages', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#full-date'))
    .toHaveText('Saturday, 22 Dey 1403 — January 11, 2025');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#full-date'))
    .toHaveText('شنبه ۲۲ دی ۱۴۰۳ — ۱۱ ژانویه ۲۰۲۵');
  // The line is the caption of a *valid* converter, so an invalid date blanks
  // its text and lets the error line speak instead. The box itself stays in
  // flow, so the Today/Copy row below it cannot move.
  await page.locator('#p-m').fill('۱۳');
  await expect(page.locator('#full-date')).toBeVisible();
  await expect(page.locator('#full-date')).toHaveText('');
});

test('an out-of-range typed month errors without blocking the keystroke', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('13');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#p-m')).toHaveValue('13'); // not swallowed
  await expect(page.locator('#converter-error')).toBeVisible();
  await expect(page.locator('#converter-error')).toHaveText('Month must be between 1 and 12');
  await expect(page.locator('#full-date')).toBeVisible();
  await expect(page.locator('#full-date')).toHaveText('');
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

test('the field name is not polluted by the toggle or the list', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
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

// --- Second review round: the four findings that survived adversarial verification.

test('aria-activedescendant sits on the element that actually has focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#p-d-toggle').click();
  // Touch path: focus goes to the listbox, not the text input, so the keypad
  // stays down — and ARIA requires the cursor on the focused element.
  expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe('p-d-list');
  await expect(page.locator('#p-d-list')).toHaveAttribute('aria-activedescendant', /^p-d-list-o\d+$/);
  expect(await page.locator('#p-d').getAttribute('aria-activedescendant')).toBeNull();
  // Arrows must work from there.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe('p-d-toggle');
});

test('desktop keeps the cursor on the input, where focus is', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m-toggle').click();
  expect(await page.evaluate(() => document.activeElement?.id ?? '')).toBe('p-m');
  await expect(page.locator('#p-m')).toHaveAttribute('aria-activedescendant', 'p-m-list-o5');
  expect(await page.locator('#p-m-list').getAttribute('aria-activedescendant')).toBeNull();
});

test('the keyboard cursor is marked by more than a faint background', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  await page.locator('#p-m').focus();
  await page.keyboard.press('ArrowDown');
  const active = page.locator('#p-m-list li.active');
  await expect(active).toHaveCount(1);
  const bar = await active.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.borderInlineStartColor, width: s.borderInlineStartWidth };
  });
  expect(bar.width).toBe('3px');
  expect(bar.color).not.toBe('rgba(0, 0, 0, 0)'); // not transparent
  // A non-active row keeps the reserved-but-invisible bar, so nothing shifts.
  const idle = await page.locator('#p-m-list li:not(.active)').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.borderInlineStartColor, width: s.borderInlineStartWidth };
  });
  expect(idle.width).toBe('3px');
  expect(idle.color).toBe('rgba(0, 0, 0, 0)');
});

test('selection is not conveyed by colour alone', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m').fill('5');
  // aria-selected is painted when the popup opens, which always precedes it
  // being visible, so open it before asserting the rendered style.
  await page.locator('#p-m-toggle').click();
  const selected = page.locator('#p-m-list li[data-value="5"]');
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  const weight = await selected.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(weight)).toBeGreaterThanOrEqual(600);
});

test('the list never renders off the top, at any viewport height', async ({ page }) => {
  for (const height of [360, 420, 560, 700, 812]) {
    await page.setViewportSize({ width: 375, height });
    await page.goto('/');
    await page.locator('#p-d-toggle').click();
    const box = await page.locator('#p-d-list').boundingBox();
    expect(box, `height=${height}`).not.toBeNull();
    // Flipping above is only allowed when the list genuinely fits there; when it
    // fits neither way it must stay below, where page scroll can reach it.
    expect(box!.y, `height=${height}`).toBeGreaterThanOrEqual(0);
  }
});

test('opening a popup does not scroll the page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#p-d-toggle').click();
  await expect(page.locator('#p-d-list')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  // Moving the cursor deep into the list scrolls the list, not the document.
  await page.keyboard.press('End');
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect(await page.locator('#p-d-list').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

// --- Design coherence: year, month and day must read as one system.

test('year, month and day are the same cell at every breakpoint', async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const boxes = await page.locator('.fields input').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          id: el.id,
          w: Math.round(r.width),
          h: Math.round(r.height),
          padStart: s.paddingInlineStart,
          padEnd: s.paddingInlineEnd,
        };
      }));
    expect(boxes, `@${width}`).toHaveLength(6);
    const widths = new Set(boxes.map((b) => b.w));
    const heights = new Set(boxes.map((b) => b.h));
    expect([...widths], `widths @${width}`).toHaveLength(1);
    expect([...heights], `heights @${width}`).toHaveLength(1);
    // Symmetric padding is what keeps every value optically centred: the year has
    // no chevron but reserves the same space, so it is not wider or off-centre.
    for (const b of boxes) {
      expect(b.padStart, `${b.id} @${width}`).toBe(b.padEnd);
    }
  }
});

test('the chevron sits inside the reserved padding, not beside the field', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const monthInput = await page.locator('#p-m').boundingBox();
    const yearInput = await page.locator('#p-y').boundingBox();
    const toggle = await page.locator('#p-m-toggle').boundingBox();
    expect(monthInput!.width, `@${width}`).toBeCloseTo(yearInput!.width, 0);
    // Chevron is contained by the month cell rather than adding width to it.
    expect(toggle!.x, `@${width}`).toBeGreaterThanOrEqual(monthInput!.x - 1);
    expect(toggle!.x + toggle!.width, `@${width}`)
      .toBeLessThanOrEqual(monthInput!.x + monthInput!.width + 1);
    expect(toggle!.width, `@${width}`).toBeGreaterThanOrEqual(24);
    expect(toggle!.height, `@${width}`).toBeGreaterThanOrEqual(24);
  }
});

test('option numerals and names line up in columns', async ({ page }) => {
  for (const [width, fa] of [[375, false], [375, true], [1440, false], [1440, true]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (fa) await page.locator('#lang-toggle').click();
    await page.locator('#p-y').fill(fa ? '۱۴۰۳' : '1403');
    await page.locator('#p-m').fill(fa ? '۱۰' : '10');
    await page.locator('#p-d-toggle').click();
    await expect(page.locator('#p-d-list')).toBeVisible();
    const cols = await page.locator('#p-d-list li').evaluateAll((rows) =>
      rows.map((row) => {
        const num = row.querySelector('.opt-num')!.getBoundingClientRect();
        const name = row.querySelector('.opt-name')!.getBoundingClientRect();
        return { numRight: Math.round(num.right), nameStart: Math.round(name.left) };
      }));
    expect(cols.length, `@${width} fa=${fa}`).toBe(30); // Dey
    // Numerals share a right edge (1 and 22 do not stagger), and every name
    // starts at the same x — that is the whole point of the two columns.
    expect([...new Set(cols.map((c) => c.numRight))], `numerals @${width} fa=${fa}`).toHaveLength(1);
    expect([...new Set(cols.map((c) => c.nameStart))], `names @${width} fa=${fa}`).toHaveLength(1);
  }
});

test('month options align the same way, with the number still readable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-m-toggle').click();
  const cols = await page.locator('#p-m-list li').evaluateAll((rows) =>
    rows.map((row) => ({
      num: row.querySelector('.opt-num')!.textContent,
      name: row.querySelector('.opt-name')!.textContent,
      numRight: Math.round(row.querySelector('.opt-num')!.getBoundingClientRect().right),
      nameStart: Math.round(row.querySelector('.opt-name')!.getBoundingClientRect().left),
    })));
  expect(cols).toHaveLength(12);
  expect(cols[0]).toMatchObject({ num: '1', name: 'Farvardin' });
  expect(cols[11]).toMatchObject({ num: '12', name: 'Esfand' });
  expect([...new Set(cols.map((c) => c.numRight))]).toHaveLength(1);
  expect([...new Set(cols.map((c) => c.nameStart))]).toHaveLength(1);
});

// --- Numeric-only fields and the year picker.

test('fields refuse non-numeric characters', async ({ page }) => {
  await page.goto('/');
  for (const id of ['#p-y', '#p-m', '#p-d', '#g-y', '#g-m', '#g-d']) {
    await page.locator(id).fill('');
    await page.locator(id).pressSequentially('a1b2');
    await expect(page.locator(id), id).toHaveValue('12');
  }
});

test('pasted text is filtered to digits', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.locator('#p-y').fill('');
  await page.evaluate(() => navigator.clipboard.writeText('1403-10-22'));
  await page.locator('#p-y').press('ControlOrMeta+V');
  await expect(page.locator('#p-y')).toHaveValue('1403'); // maxlength 4 then holds
  // A paste that fits inside maxlength arrives intact, so this is the case that
  // proves paste goes through the same digit filter as typing.
  await page.locator('#p-y').fill('');
  await page.evaluate(() => navigator.clipboard.writeText('a1b2'));
  await page.locator('#p-y').press('ControlOrMeta+V');
  await expect(page.locator('#p-y')).toHaveValue('12');
});

test('maxlength caps each field', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('');
  await page.locator('#p-y').pressSequentially('123456');
  await expect(page.locator('#p-y')).toHaveValue('1234');
  await page.locator('#p-m').fill('');
  await page.locator('#p-m').pressSequentially('123');
  await expect(page.locator('#p-m')).toHaveValue('12');
});

test('the year picker lists the supported range and commits', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y-toggle').click();
  await expect(page.locator('#p-y-list')).toBeVisible();
  await expect(page.locator('#p-y-list li')).toHaveCount(301);
  await expect(page.locator('#p-y-list li[data-value="1200"]')).toHaveText('1200');
  await expect(page.locator('#p-y-list li[data-value="1500"]')).toHaveText('1500');
  await page.locator('#p-y-list li[data-value="1403"]').click();
  await expect(page.locator('#p-y')).toHaveValue('1403');
  await expect(page.locator('#g-y-list li')).toHaveCount(0); // not rendered until opened
  await page.locator('#g-y-toggle').click();
  await expect(page.locator('#g-y-list li')).toHaveCount(302);
});

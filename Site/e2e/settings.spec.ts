import { expect, test, type Page } from '@playwright/test';

const enter = async (page: Page): Promise<void> => {
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await expect(page.locator('#g-d')).toHaveValue('11');
};

const copyAndRead = async (page: Page): Promise<string> => {
  await page.locator('#btn-copy').click();
  await expect(page.locator('#btn-copy')).toHaveText(/Copied|کپی شد/);
  return page.evaluate(() => navigator.clipboard.readText());
};

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('gear opens a modal settings dialog; Escape closes it and returns focus', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Settings' });
  await gear.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
});

test('only the backdrop closes the dialog: not its padding, not a drag that ends outside', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-pattern').selectOption('custom');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const box = (await dialog.boundingBox())!;
  const input = (await page.locator('#set-copy-custom').boundingBox())!;
  const backdrop = { x: box.x + box.width + 20, y: box.y + box.height + 20 };

  await page.mouse.click(box.x + 4, box.y + 4);
  await expect(dialog).toBeVisible();

  await page.mouse.move(input.x + input.width / 2, input.y + input.height / 2);
  await page.mouse.down();
  await page.mouse.move(backdrop.x, backdrop.y);
  await page.mouse.up();
  await expect(dialog).toBeVisible();

  await page.mouse.click(backdrop.x, backdrop.y);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
});

test('changing the format changes what Copy writes, and survives a reload', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-calendar').selectOption('both');
  await page.locator('#set-copy-pattern').selectOption('dd.mm.yyyy');
  await expect(page.locator('#set-copy-preview')).toHaveText('22.10.1403 / 11.01.2025');
  await page.locator('#settings-close').click();

  expect(await copyAndRead(page)).toBe('22.10.1403 / 11.01.2025');
  await expect(page.locator('#btn-copy')).toHaveAttribute('title', 'dd.mm.yyyy');

  await page.reload();
  await enter(page);
  expect(await copyAndRead(page)).toBe('22.10.1403 / 11.01.2025');
});

test('a custom format with quoted words and Persian digits', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-pattern').selectOption('custom');
  await expect(page.locator('#set-copy-custom')).toBeVisible();
  await page.locator('#set-copy-custom').fill("'Today is' dddd d MMMM");
  await page.locator('#set-copy-digits').selectOption('persian');
  await expect(page.locator('#set-copy-preview')).toHaveText('Today is Saturday ۲۲ Dey');
  await page.keyboard.press('Escape');

  expect(await copyAndRead(page)).toBe('Today is Saturday ۲۲ Dey');
});

test('names follow the UI language; the dialog is translated and RTL', async ({ page }) => {
  await page.goto('/');
  await enter(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#set-copy-pattern').selectOption('custom');
  await page.locator('#set-copy-custom').fill('MMMM');
  await page.locator('#settings-close').click();
  await page.locator('#lang-toggle').click();

  await page.getByRole('button', { name: 'تنظیمات' }).click();
  await expect(page.getByRole('dialog', { name: 'تنظیمات' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#set-copy-preview')).toHaveText('دی');
  await page.locator('#settings-close').click();
  expect(await copyAndRead(page)).toBe('دی');
});

test('a corrupt stored value falls back to the default format', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('settings.v1', '{oops'));
  await page.reload();
  await enter(page);
  expect(await copyAndRead(page)).toBe('1403-10-22');
});

test('the dialog opens centred in the viewport, at desktop and phone widths', async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 400, height: 760 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    const box = await page.locator('#settings-dialog').boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box as { x: number; y: number; width: number; height: number };
    // Equal space either side, within a pixel of rounding.
    expect(Math.abs(x - (size.width - x - width))).toBeLessThanOrEqual(1);
    expect(Math.abs(y - (size.height - y - height))).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
  }
});

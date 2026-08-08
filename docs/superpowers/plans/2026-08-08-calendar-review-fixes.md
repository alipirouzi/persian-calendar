# Calendar Review Fixes

**Date:** 2026-08-08
**Status:** Approved (follow-up to `2026-08-08-calendar-and-year-picker.md`)
**Origin:** A four-lens adversarial review of `1b5ac8c..5003270`. Sixteen findings,
**twelve confirmed** by independent verification, two refuted (nav-button target
size, and `paint()` cost on the 301-row year list), two duplicates.

The tree is green at 88 Vitest / 94 Playwright before these fixes; it must stay
green after them.

Almost every confirmed defect is the same story: **`calendar-grid.ts` was written
to the plan's prose instead of being modelled on `number-picker.ts`**, so the
dismissal, positioning and focus rules the picker already solved were not carried
across. The fixes bring it into line.

## Shared contract

| Item | Value |
|---|---|
| Keyboard cursor class on a day cell | `cursor` (distinct from `active` = the converter's date, and `today`) |
| Flipped popup class | `above` on `.cal-pop`, mirroring `.picker-list.above` |
| Full date line | keeps its box when empty — no `hidden` toggling in normal flow |

**Phases:** Fixes A–D are parallel-safe (disjoint files). Fix E runs last.

---

## Fix A — `Site/src/ui/calendar-grid.ts` (parallel)

Read `Site/src/ui/number-picker.ts` first and follow it. Six confirmed defects:

- [ ] **A1: Close when focus leaves the popup** (HIGH, found by three lenses)

Tabbing out of the grid leaves the calendar open and floating over whatever
received focus, and once focus is outside, `Escape` no longer reaches it either.
The picker already solves this with `focusout` + `relatedTarget`. Add the same,
bound to the popup so it covers the grid and both nav buttons:

```typescript
  popup.addEventListener('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (next !== null && (popup.contains(next) || next === button)) return;
    close(false);
  });
```

`close(false)` must not restore focus here — focus has already moved on.

- [ ] **A2: Render the keyboard cursor** (HIGH)

Arrow keys move `aria-activedescendant` but nothing on screen changes, so a
sighted keyboard user cannot see what `Enter` will pick. In `render()`, add the
class `cursor` to the cell whose day equals the focused day, alongside the
existing `active`/`today` marking. Fix B styles it.

- [ ] **A3: Position the popup inside the viewport** (HIGH)

The popup only ever opens downward and is never measured, so on a phone most of
the grid sits below the fold. Port `positionList()` from `number-picker.ts`
verbatim in shape — same `GAP`, same `visualViewport` preference, same
fits-above-or-stay-below rule — as `positionPopup()`, and call it from `open()`
after the popup is un-hidden and before focus moves. Clear the `above` class in
`close()`. Re-run it on `window.visualViewport` `resize` while open, exactly as
the picker does.

- [ ] **A4: Keep focus on the grid when navigating months** (MEDIUM, two lenses)

Clicking `‹` or `›` moves focus to that button, after which the arrow keys and
`Escape` do nothing and there is no route back to the grid. Cancel the focus
shift the way the picker's toggle does, and put focus back:

```typescript
  for (const nav of [prev, next]) {
    nav.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }
```

and after a nav click re-renders, call `grid.focus()`.

Also bind the existing keydown handler to `popup` rather than only `grid`, so
`Escape` works even if focus does reach a nav button.

- [ ] **A5: Mirror the horizontal arrows under RTL** (MEDIUM)

`ArrowRight` currently always moves to the next day, so in Persian — where the
grid renders right-to-left — the cursor moves visually backwards. The WAI-ARIA
grid pattern is visual, not logical: `ArrowRight` moves to the cell on the right.
Derive the step from the document direction:

```typescript
  const rtl = (): boolean => document.documentElement.dir === 'rtl';
  // ArrowRight moves right on screen, which is the previous day in RTL.
  const horizontal = (key: string): number =>
    (key === 'ArrowRight' ? 1 : -1) * (rtl() ? -1 : 1);
```

- [ ] **A6: Give the grid an accessible name that carries the month** (MEDIUM)

Month navigation is silent to a screen reader: the grid has no name and the title
is a plain `<span>`. Set `grid.setAttribute('aria-label', grid_title)` on every
render so the visible month is part of the grid's name and a fresh name is
announced when the month changes.

- [ ] **A7: Verify** — `cd Site && npx tsc --noEmit`. Expected: clean.

- [ ] **A8: Commit**

```bash
git add Site/src/ui/calendar-grid.ts
git commit -m "fix(site): calendar dismissal, cursor, positioning, RTL arrows, and name"
```

---

## Fix B — `Site/src/styles/components.css` (parallel)

- [ ] **B1: Stop the popup overflowing narrow viewports** (HIGH)

`.cal-pop` has no anchoring or width clamp, so at 320px it runs past the edge in
both writing directions — the same defect `.picker-list` had and already fixed.
Give it the same treatment: position it relative to the fieldset, anchor to the
inline-end edge, and clamp:

```css
.cal-pop {
  position: absolute; z-index: 20;
  inset-inline-end: 0; inset-block-start: calc(100% + 4px);
  width: max-content; max-width: calc(100vw - 1.5rem);
  max-height: min(70vh, 26rem); overflow-y: auto; overscroll-behavior: contain;
  padding: 0.6rem; background: var(--surface-raised);
  border: 1px solid var(--hairline); border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
}
/* Set by the component when the popup would not fit below. */
.cal-pop.above {
  inset-block-start: auto; inset-block-end: calc(100% + 4px);
  box-shadow: 0 -8px 24px rgb(0 0 0 / 0.14);
}
```

`.cal-pop` is absolutely positioned, so its containing block must be positioned:
add `fieldset { position: relative; }` to the existing `fieldset` rule.

- [ ] **B2: Style the keyboard cursor** (HIGH, pairs with A2)

An outline rather than a fill, so it stays visible on top of the accent-filled
selected cell:

```css
/* The keyboard cursor, distinct from selection (fill) and today (inset ring).
   An outline reads on top of both. */
.cal-cell.cursor { outline: 2px solid var(--accent); outline-offset: 1px; }
```

- [ ] **B3: Stop the full date line collapsing the layout** (MEDIUM, two lenses)

`#full-date` toggles `hidden`, so the Today/Copy row jumps roughly 39px every
time a keystroke crosses valid↔invalid — under the user's thumb on a phone.
Reserve the line's height so only its text changes:

```css
#full-date {
  margin-top: 1rem; text-align: center;
  font-size: 0.9rem; color: var(--text-muted);
  min-height: 1.3em;
}
```

- [ ] **B4: Verify** — `cd Site && npx tsc --noEmit && npm run build`. Expected: clean.

- [ ] **B5: Commit**

```bash
git add Site/src/styles/components.css
git commit -m "fix(site): keep the calendar popup on screen and the layout stable"
```

---

## Fix C — `Site/src/converter/converter.ts` (parallel)

- [ ] **C1: Stop toggling `hidden` on the full date line** (MEDIUM, pairs with B3)

Fix B reserves the line's height; the JS must stop removing it from flow. In
`setStatus`, replace the `hidden` toggle with a text swap so the box is always
present:

```typescript
  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    // The box keeps its height either way: hiding it shifted the Today/Copy row
    // under the user's thumb on every invalid keystroke.
    fullDate.textContent = ok === null ? '' : copySentence(ok.p, ok.g, getLang());
    btnCopy.disabled = ok === null;
  };
```

Remove `fullDate.hidden = …` and delete the `hidden` attribute from `#full-date`
in `Site/index.html` — **that one line in index.html is the only edit you may
make outside converter.ts.**

- [ ] **C2: Verify** — `cd Site && npx tsc --noEmit && npm test`. Expected: clean, 88 passing.

- [ ] **C3: Commit**

```bash
git add Site/src/converter/converter.ts Site/index.html
git commit -m "fix(site): keep the full date line in flow so the status row cannot jump"
```

---

## Fix D — Gregorian range must cover the Persian range's image (parallel)

**Files:** `Site/src/converter/converter-core.ts`, plus every test that asserts
the old bounds.

- [ ] **D1: Measure the real bounds first**

`GREGORIAN_YEAR_MIN`/`MAX` are 1822/2121, but the Persian range 1200–1500 maps
outside that at both ends, so the converter can produce a Gregorian date its own
range rejects: convert Persian 1200-01-01 and the Gregorian side shows a year the
Gregorian side would refuse if you typed it.

Write a throwaway vitest that prints the true image, run it, then delete it:

```typescript
import { it } from 'vitest';
import { toGregorian, daysInPersianMonth, PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX } from '../src/calendar/persian';
it('probe', () => {
  const lo = toGregorian({ py: PERSIAN_YEAR_MIN, pm: 1, pd: 1 });
  const hiDay = daysInPersianMonth(PERSIAN_YEAR_MAX, 12);
  const hi = toGregorian({ py: PERSIAN_YEAR_MAX, pm: 12, pd: hiDay });
  console.log('IMAGE', JSON.stringify(lo), JSON.stringify(hi));
});
```

- [ ] **D2: Widen the Gregorian bounds to exactly that image**

Set `GREGORIAN_YEAR_MIN` and `GREGORIAN_YEAR_MAX` in
`Site/src/converter/converter-core.ts` to the `gy` values you measured, so every
Persian date the app supports has a Gregorian counterpart the app also supports.
Do **not** touch `PERSIAN_YEAR_MIN`/`MAX` — 1200–1500 is the documented core and
the C# parity vectors are generated for exactly that span.

- [ ] **D3: Update every dependent assertion**

Search and fix all of them — do not guess which exist:

```bash
cd Site && grep -rn "1822\|2121" src tests e2e ../README.md
```

At minimum this includes `tests/converter-core.test.ts`'s year-range expectations,
`tests/field-options.test.ts`'s `yearOptions` Gregorian length and endpoints, and
`e2e/picker.spec.ts`'s `#g-y-list` count. Update the README if it states the range.

- [ ] **D4: Verify** — `cd Site && npm test && npx tsc --noEmit`. Expected: all green.

- [ ] **D5: Commit**

```bash
git add Site/src/converter/converter-core.ts Site/tests Site/e2e ../README.md
git commit -m "fix(site): Gregorian range now covers the whole Persian range"
```

---

## Fix E — E2E coverage for every fix (after A–D)

**Files:** `Site/e2e/calendar.spec.ts`, and any spec a fix invalidated.

- [ ] **E1: Add these tests** to `Site/e2e/calendar.spec.ts`:

```typescript
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
```

- [ ] **E2: Run everything** — `cd Site && npm test && npx tsc --noEmit && npm run build && npx playwright test`.

Expected: **fully green, zero failures.** If a test fails, the implementation is
the suspect: diagnose it, report the exact assertion and actual value, and fix the
source. You may edit any file from Fixes A–D. Never weaken an assertion.

- [ ] **E3: Report the real Vitest count, Playwright count, and gzipped bundle
sizes, then commit**

```bash
git add Site/e2e Site/src README.md docs/SECURITY.md
git commit -m "test(site): cover calendar dismissal, cursor, RTL arrows, and viewport fit"
```

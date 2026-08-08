# Wizard Review Fixes

**Status:** Approved. Follow-up to `2026-08-08-calendar-wizard.md`.
**Origin:** Four-lens review of `c66dca6..HEAD`. Nine confirmed, three refuted.

The tree is green before these fixes — 287 Vitest, 113 Playwright, **100% coverage
on all four metrics** — and must be green after them. **Coverage thresholds are
enforced at 100%, so any branch you add needs a test or `npm run test:coverage`
fails.** That is deliberate: it is the forcing function for this round.

## Contract changes to `RenderedView` (Fix A owns all of them)

| Field | Change | Why |
|---|---|---|
| `columns` | derived as `rows[0]?.length ?? 0`, never a literal | three unlinked copies of the column count could silently desync |
| `titleActionable: boolean` | replaced by `titleTarget: CalendarMode \| null` | the drill-*up* target was hardcoded in the consumer while the drill-*down* target lived in the strategy |
| `layout: 'week' \| 'page'` | new | lets the view name its shape without naming a CSS class |
| `selected: number \| null` | null when the committed date is not on this page | the mark was following the browsing state |
| `prevLabel` / `nextLabel` | new `StringKey`s | the step buttons mean three different things |

---

## Fix A — the view contract (`calendar-views.ts`, `calendar-grid.ts`, `strings.ts`, `converter.ts`)

- [ ] **A1: Mark the committed date, not the browsed one** (HIGH)

`daysView.render` sets `selected: state.day`, and `state` carries the day forward
across every month step, so paging to Bahman marks 22 Bahman as selected while the
converter still holds 22 Dey — and a screen reader announces it.

Add a fourth parameter to `CalendarView.render(side, state, lang, committed)`
where `committed: ViewState | null`, and compute `selected` by asking whether the
page being rendered actually contains it:

- days — `committed?.year === state.year && committed.month === state.month ? committed.day : null`
- months — `committed?.year === state.year ? committed.month : null`
- years — `committed !== null && the rendered page contains committed.year ? committed.year : null`

`calendar-grid.ts` passes `getCurrent()` on every render, not just at open, and
writes `aria-selected`/`.active` only when `selected !== null`.

- [ ] **A2: Carry the keyboard cursor across a page step** (HIGH)

`goTo` re-seeds the cursor from `render(...).selected`, so every prev/next and
PageUp/PageDown throws away wherever the arrows had moved it: open on 22, ArrowDown
to 29, PageDown, Enter — and it picks 22, not 29.

Keep `goTo` as-is for drill-down transitions. In the **step** path, capture the
cursor's current *value* before calling `CALENDAR_VIEWS[mode].step(...)`, then
after re-rendering put the cursor on that value; if the new page does not contain
it (day 31 into a 30-day month), clamp to the last non-null cell.

- [ ] **A3: Give the header buttons their focus back** (HIGH)

`fromButton` focuses the grid before acting — needed so disabling the pressed
button cannot blur into a dismissal — but never returns focus. On the keyboard
path that silently moves the user to the grid, where the *next* Enter selects a
cell: Enter on the title cascades years → months → days → picked, and a held Enter
runs the whole cascade from one press.

```typescript
  const fromButton = (btn: HTMLButtonElement, act: () => void): void => {
    grid.focus({ preventScroll: true });
    act();
    // Back to where the user actually is, unless the action disabled it — then
    // the grid is the right place and Escape still works from there.
    if (!btn.disabled) btn.focus({ preventScroll: true });
  };
```

- [ ] **A4: Name the step buttons after what they step** (MEDIUM, two lenses)

They are `‹` / `›` with no visible text, so `aria-label` is the whole accessible
name, and `converter.ts` sets it once to "Previous month"/"Next month" — wrong in
two of three views. Fails WCAG 4.1.2.

Add to `strings.ts` (both languages): `prevYear`/`nextYear`, `prevYears`/`nextYears`.
Suggested `fa`: `سال قبل`/`سال بعد`, `۱۲ سال قبل`/`۱۲ سال بعد`.

Put `prevLabel`/`nextLabel` (as `StringKey`s) on `RenderedView` — `prevMonth`/
`nextMonth` for days, `prevYear`/`nextYear` for months, `prevYears`/`nextYears` for
years — and set the two `aria-label`s inside `render()` next to the existing
`prev.disabled`/`next.disabled` writes. **Delete the two `aria-label` writes for
these buttons from `converter.ts`'s `renderLabels()`**; leave the calendar
button's own label there. A language toggle already re-renders the calendar, so
the labels still follow the language.

- [ ] **A5: Derive the column count from the rows** (MEDIUM, design)

`columns` is a literal in `calendar-views.ts` with no link to the rows, which are
chunked by `calendar-grid-model.ts`'s own constants, and `calendar-grid.ts` keeps a
third copy. Changing the page to 4-up would desync all three and put the cursor on
the wrong cell.

Set `columns: rows[0]?.length ?? 0` in every view. Add `layout: 'week' | 'page'`.
In `calendar-grid.ts`, map `layout === 'page'` to the `cal-grid--wide` class and
set `grid.style.setProperty('--cal-cols', String(view.columns))`; Fix C makes the
CSS read that variable. Delete the local column literal.

- [ ] **A6: Move the drill-up target into the strategy** (MEDIUM, design)

Replace `titleActionable: boolean` with `titleTarget: CalendarMode | null` — `'years'`
for days and months, `null` for years. `calendar-grid.ts` derives the title
button's `disabled` from `view.titleTarget === null` and its click from
`goTo(view.titleTarget, state)`. Also drop the `DATA_KEY` map and use `view.key`
directly for the `data-*` attribute name. A fourth view then needs one new entry in
`CALENDAR_VIEWS` and nothing here.

- [ ] **A7: Verify** — `cd Site && npx tsc --noEmit && npm run test:coverage`.
Expected: clean, and **still 100% on all four metrics** — add unit tests for the
new branches (each view's `selected` null path, the cursor-carry clamp, the
`titleTarget` null path).

- [ ] **A8: Commit**

```bash
git add Site/src/converter/calendar-views.ts Site/src/ui/calendar-grid.ts \
        Site/src/i18n/strings.ts Site/src/converter/converter.ts Site/tests
git commit -m "fix(site): mark the committed date, keep the cursor, and label the step buttons"
```

---

## Fix B — `popup.ts`: hold the top edge when anchored above (parallel)

- [ ] **B1** (MEDIUM)

`.cal-pop.above` anchors by its bottom edge, so when the grid hugs its rows and the
wizard swaps a 7-column day grid for a 3-column page, the head row — with the title
button under the user's finger — drops 45px, or 89px from a 6-row month. Measured
at 375×812 with the converter at its normal resting position.

While `above`, hold the surface's **top** stable across a content change: record
the top offset when the side is chosen, and have `reposition()` re-assert it so the
box grows or shrinks downward instead of dragging the head. The near edge to the
field may move; the head must not.

Do not change the below-anchored path — it already pins the top.

- [ ] **B2: Verify** — `cd Site && npx tsc --noEmit && npm run test:coverage`.
Still 100%: extend `tests/dom/popup.test.ts` for the new branch, stubbing rects as
that file already does.

- [ ] **B3: Commit**

```bash
git add Site/src/ui/popup.ts Site/tests/dom/popup.test.ts
git commit -m "fix(site): keep an above-anchored popup's head still when its content resizes"
```

---

## Fix C — `components.css`: make the wide cells fit their type (parallel)

- [ ] **C1** (MEDIUM)

`.cal-grid--wide` derives a 3-column track from the day grid's width — 77.33px on
desktop, 88px at 320px — but nothing constrains the label. "Ordibehesht" measures
79px normal and 81px bold on desktop, 93/95px at 320px. When it is the selected
month the accent fill is narrower than the text, so the leading "O" and trailing
"t" are painted surface-on-surface and disappear.

Lower `.cal-grid--wide .cal-cell` to `font-size: 0.75rem` in the base rule and
`0.9rem` in the touch block, and add `white-space: nowrap; overflow: hidden;
text-overflow: ellipsis;` plus a small inline padding so a long label truncates
visibly rather than bleeding.

- [ ] **C2: Read the column count from the grid** (pairs with A5)

Change `.cal-grid` and `.cal-grid--wide` to `grid-template-columns: repeat(var(--cal-cols, 7), <track>)`,
keeping each rule's existing track size. The count then comes from the data.

- [ ] **C3: Verify** — `cd Site && npx tsc --noEmit && npm run build`.

- [ ] **C4: Commit**

```bash
git add Site/src/styles/components.css
git commit -m "fix(site): fit long month names and drive the grid column count from the view"
```

---

## Fix D — E2E and the green gate (after A, B and C)

- [ ] **D1: Add to `Site/e2e/calendar.spec.ts`:**

```typescript
test('the selected mark stays on the committed date while browsing', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-grid .cal-cell.active')).toHaveText('22');
  await page.locator('#p-cal-next').click();          // Bahman
  await expect(page.locator('#p-cal-grid .cal-cell.active')).toHaveCount(0);
  await page.locator('#p-cal-prev').click();          // back to Dey
  await expect(page.locator('#p-cal-grid .cal-cell.active')).toHaveText('22');
});

test('paging keeps the keyboard cursor where the arrows left it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await page.keyboard.press('ArrowDown');             // 22 -> 29
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d29');
  await page.keyboard.press('PageDown');              // Bahman, cursor must stay on 29
  await expect(page.locator('#p-cal-grid')).toHaveAttribute('aria-activedescendant', 'p-cal-grid-d29');
  await page.keyboard.press('Enter');
  await expect(page.locator('#p-m')).toHaveValue('11');
  await expect(page.locator('#p-d')).toHaveValue('29');
});

test('Enter on the title does not cascade into picking a date', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-y').fill('1403');
  await page.locator('#p-m').fill('10');
  await page.locator('#p-d').fill('22');
  await page.locator('#p-cal').click();
  await page.locator('#p-cal-title').focus();
  await page.keyboard.press('Enter');                 // -> years, title now disabled
  await expect(page.locator('#p-cal-title')).toHaveText('1392 – 1403');
  await page.keyboard.press('Enter');                 // must NOT select a year
  await expect(page.locator('#p-cal-title')).toHaveText('1392 – 1403');
  await expect(page.locator('#p-cal-pop')).toBeVisible();
});

test('the step buttons say what they step', async ({ page }) => {
  await page.goto('/');
  await page.locator('#p-cal').click();
  await expect(page.locator('#p-cal-next')).toHaveAttribute('aria-label', 'Next month');
  await page.locator('#p-cal-title').click();
  await expect(page.locator('#p-cal-next')).toHaveAttribute('aria-label', 'Next 12 years');
  await page.locator('#p-cal-grid .cal-cell').first().click();
  await expect(page.locator('#p-cal-next')).toHaveAttribute('aria-label', 'Next year');
});

test('a long month name stays inside its cell', async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#p-cal').click();
    await page.locator('#p-cal-title').click();
    await page.locator('#p-cal-grid .cal-cell').first().click();
    const cell = page.locator('#p-cal-grid .cal-cell[data-month="2"]');
    await expect(cell).toHaveText('Ordibehesht');
    const fits = await cell.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits, `@${width}`).toBe(true);
  }
});

test('an above-anchored popup keeps its head still between views', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('#g-cal').click();
  const pop = page.locator('#g-cal-pop');
  if (!(await pop.evaluate((el) => el.classList.contains('above')))) test.skip();
  const before = (await page.locator('#g-cal-title').boundingBox())!.y;
  await page.locator('#g-cal-title').click();
  const after = (await page.locator('#g-cal-title').boundingBox())!.y;
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
});
```

Adjust the three English step-button labels to whatever wording Fix A actually put
in `strings.ts`, if it differs.

- [ ] **D2: Full gate** — `cd Site && npm run test:coverage && npx tsc --noEmit && npm run build && npx playwright test`.

Expected: 100% coverage on all four metrics, tsc clean, build clean, **every**
Playwright test passing including all pre-existing ones. Build before Playwright.

- [ ] **D3: Report** the real coverage percentages, Vitest count, Playwright count
and gzipped bundle sizes, then update them in `README.md` and `docs/SECURITY.md`.

- [ ] **D4: Commit**

```bash
git add Site/e2e Site/tests README.md docs/SECURITY.md
git commit -m "test(site): cover committed-date marking, cursor carry, and step labels"
```

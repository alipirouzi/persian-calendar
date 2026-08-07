# Converter Pickers — Review Fixes

**Date:** 2026-08-07
**Status:** Approved (follow-up to `2026-08-07-converter-pickers.md`)
**Origin:** A four-lens adversarial review of commits `03755a1..cb8757b` produced ten
findings. Every one was independently verified and **none was refuted** — several were
reproduced in a live browser. The `performance` lens returned clean.

The ten findings collapse into three root causes and six fixes. Two of the root causes
are defects in the original plan's own reference code, not in its execution.

## Root cause 1 — the listbox lives inside the `<label>`

`index.html` uses an implicit `<label>` that wraps `.picker` (input + toggle + `<ul>`)
and `.hint`. Two consequences, both confirmed in a real browser:

- **Accessible name poisoning.** Name computation walks the label's whole subtree and
  honours descendants' `aria-label`, so `#p-m`'s name becomes
  `"Month Choose month Mordad"` — and gains a second `"Choose month"` once the list is
  un-hidden. The name changes as the user types and stops identifying the field.
- **Focus hijacking.** An `<li>` is not interactive content, so clicking an option runs
  the label's *activation behaviour*: a synthetic click is forwarded to the labelled
  input, which takes focus. This runs after the list's own click handler, so
  `close(true) → invoker.focus()` is overridden every time. Measured: after tapping a
  day option, `document.activeElement` is `#p-d`, not the toggle. On a phone the OS
  keypad therefore opens directly on top of the converter the user just finished with —
  the exact outcome the invoker-restore rule exists to prevent.

## Root cause 2 — a pointer-opened popup has no focus at all

`toggle`'s `mousedown` handler calls `preventDefault()`, and `open()` only *records*
`invoker` without moving focus. So after a chevron click `document.activeElement` is
whatever it was — usually `<body>`. Every key binding lives on the input's `keydown`
listener, so Escape, the arrows, Enter, Home and End are all dead, and
`aria-activedescendant` is set on an unfocused element so assistive tech announces
nothing. Worse, with focus already in another field, a chevron click opens a second
listbox: two popups visible at once, and typed digits land in the wrong field.

## Root cause 3 — the popup is positioned without regard to the viewport

`inset-inline-start: 0` anchors the list to the field's *start* edge, so in LTR the day
list (the last field in the row) grows outward past the viewport. Measured at 320px: the
list spans x 186→325 against a 320px viewport, giving **33px of horizontal overflow**;
5px at 375px. `max-width: 60vw` never engages because the list is only 139px wide. This
is the one defect the E2E suite already catches (`picker.spec.ts` "an open popup does not
cause horizontal overflow at phone widths").

Vertically the list only ever opens downward. Measured at 375×812 with `#p-d` focused:
list top 534, height 320, bottom 854 — already 42px below the viewport before any
keyboard appears, and a mobile keypad occupies roughly the bottom 260–300px.

## Shared contract

Fix A and Fix B run in parallel against disjoint files. They must agree on exactly this:

| Item | Value |
|---|---|
| Field wrapper element | `<div class="field">`, replacing the implicit `<label>` wrapper |
| Label association | `<label for="<inputId>" data-str="…">` — explicit, no nesting |
| Month hint association | `aria-describedby="<p\|g>-m-hint"` on the month inputs |
| Flip-upward state | class `above` on the `<ul class="picker-list">`, set and cleared by the picker |
| Touch-ish media query | `(max-width: 1024px), (pointer: coarse)` — identical string in CSS and in `matchMedia` |

**The `font: inherit` chain is load-bearing.** `.fields input` uses `font: inherit`, and
today it inherits `0.75rem` from `.fields label`. After the restructure the input's
ancestor is `.field`, so `.field` must carry `font-size: 0.75rem` or the desktop
invariant test (`#p-y` computed font-size `< 16px` at 1440×900) breaks. Verify this
explicitly.

---

## Fix A — `Site/src/ui/number-picker.ts` (parallel with Fix B)

**Files:** Modify `Site/src/ui/number-picker.ts` only.

- [ ] **A1: Re-sync the cursor when the user types while the list is open** (HIGH)

Today `activeIndex` is recomputed only in `open()`, `move()`, `Home`/`End` and
`setOptions()`. Typing leaves it stale, so Enter commits the *old* option and silently
discards what was typed: with `#p-m` empty, ArrowDown (opens at index 0), type `7`, press
Enter → the field is rewritten to `1`.

Add, next to the other listeners:

```typescript
  // Typing is an explicitly supported path while the list is open, so the cursor
  // and the ARIA state must follow the value the field actually holds. With
  // activeIndex === -1 the Enter branch falls through to close(true), which keeps
  // the typed value instead of overwriting it.
  input.addEventListener('input', () => {
    if (!isOpen) return;
    activeIndex = selectedIndex();
    paint();
  });
```

- [ ] **A2: Make a pointer-opened popup keyboard-operable** (HIGH)

Extract the existing `input.addEventListener('keydown', …)` callback into a named
`const onKeyDown = (event: KeyboardEvent): void => { … }` and bind it to **both**
`input` and `toggle`:

```typescript
  for (const el of [input, toggle] as const) {
    el.addEventListener('keydown', onKeyDown);
  }
```

Inside `onKeyDown`, add a `' '` (Space) case that only acts when the event came from the
toggle — a focused `<button>` treats Space as activation, which would otherwise close the
list the user just opened, and Space in the input must remain an ordinary character:

```typescript
      case ' ':
        if (!isOpen || event.currentTarget !== toggle) return;
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        return;
```

- [ ] **A3: Move focus on pointer-open, respecting touch** (HIGH / MEDIUM)

Replace the `toggle` `click` handler. On a fine pointer the input keeps focus (typing
stays available); on a narrow or coarse-pointer device focus goes to the toggle and the
input is blurred, so the OS keypad retracts before the list paints.

```typescript
  /** Matches the CSS touch-target block exactly — see the shared contract. */
  const isTouchish = (): boolean =>
    window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;

  toggle.addEventListener('click', () => {
    if (isOpen) { close(true); return; }
    if (isTouchish()) {
      // Blur first so the on-screen keypad is already retracting when the list
      // is measured and positioned.
      input.blur();
      open(toggle, 'first');
      toggle.focus();
      return;
    }
    open(input, 'first');
    input.focus();
  });
```

- [ ] **A4: Close when focus leaves the picker** (HIGH, part of root cause 2)

Without this, a popup opened by pointer while another field had focus stays open and
orphaned after the user Tabs or types elsewhere. `relatedTarget` is `null` when focus goes
nowhere, which should also close.

```typescript
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null
      && (next === input || toggle.contains(next) || list.contains(next))) return;
    close(false);
  };
  for (const el of [input, toggle] as const) {
    el.addEventListener('focusout', onFocusOut);
  }
```

This is re-entrancy-safe: `close()` returns early when `isOpen` is already false.

- [ ] **A5: Cancel the click on an option** (HIGH)

Belt-and-braces alongside Fix B's restructure: cancelling the click cancels any label
activation behaviour, so focus stays where `close(true)` put it. In the `list` `click`
handler, before committing:

```typescript
  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest('li');
    if (li === null || li.parentElement !== list) return;
    // Cancel activation behaviour so focus stays where close(true) put it.
    event.preventDefault();
    const index = [...list.children].indexOf(li);
    if (index >= 0) commit(index);
  });
```

- [ ] **A6: Flip the list above the field when there is no room below** (MEDIUM)

Add, and call it from `open()` immediately after `setExpanded(true)` and `paint()`:

```typescript
  /**
   * Open downward by default; flip above the field when the list would not fit
   * below and there is more room above. visualViewport is what shrinks when a
   * mobile keypad is showing, so prefer it when available.
   */
  const positionList = (): void => {
    list.classList.remove('above');
    const field = input.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const spaceBelow = viewportHeight - field.bottom;
    const spaceAbove = field.top;
    if (list.getBoundingClientRect().height > spaceBelow && spaceAbove > spaceBelow) {
      list.classList.add('above');
    }
  };
```

`close()` must clear it: add `list.classList.remove('above');` alongside the other
teardown in `close`.

- [ ] **A7: Verify**

Run: `cd Site && npx tsc --noEmit && npm test`
Expected: clean; 72 Vitest tests still pass (this module has no unit tests — E2E is Fix C).

- [ ] **A8: Commit**

```bash
git add Site/src/ui/number-picker.ts
git commit -m "fix(site): picker keyboard reach, typed-value cursor sync, touch focus, viewport flip"
```

---

## Fix B — `Site/index.html` + `Site/src/styles/components.css` (parallel with Fix A)

**Files:** Modify `Site/index.html` and `Site/src/styles/components.css` only.

- [ ] **B1: Restructure both fieldsets to explicit labels**

Replace the Persian `<div class="fields">` block with exactly this. The `<label>` now
carries `data-str` directly (`renderStatic()` writes to any `[data-str]` element, so this
keeps working), and `.picker` / `.hint` are siblings of the label rather than its
children:

```html
          <div class="fields">
            <div class="field">
              <label for="p-y" data-str="year"></label>
              <input id="p-y" type="text" inputmode="numeric" />
              <span class="hint"></span>
            </div>
            <div class="field">
              <label for="p-m" data-str="month"></label>
              <div class="picker">
                <input id="p-m" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="p-m-list"
                       aria-autocomplete="none" aria-describedby="p-m-hint" />
                <button id="p-m-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-m-list">▾</button>
                <ul id="p-m-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint" id="p-m-hint"></span>
            </div>
            <div class="field">
              <label for="p-d" data-str="day"></label>
              <div class="picker">
                <input id="p-d" type="text" inputmode="numeric" autocomplete="off"
                       role="combobox" aria-expanded="false" aria-controls="p-d-list"
                       aria-autocomplete="none" />
                <button id="p-d-toggle" class="picker-toggle" type="button" tabindex="-1"
                        aria-expanded="false" aria-controls="p-d-list">▾</button>
                <ul id="p-d-list" class="picker-list" role="listbox" hidden></ul>
              </div>
              <span class="hint"></span>
            </div>
          </div>
```

Apply the identical structure to the Gregorian fieldset with every `p-` id replaced by
`g-` (so `for="g-y"`, `id="g-m"`, `aria-describedby="g-m-hint"`, `id="g-d-list"`, and so
on).

- [ ] **B2: Move the grid and the font chain from `label` to `.field`**

In `components.css`, replace the single `.fields label` rule with two rules. **The
`font-size` must live on `.field`**, because `.fields input` uses `font: inherit` and the
desktop invariant test asserts `#p-y`'s computed font-size is under 16px:

```css
.fields .field { display: grid; gap: 0.25rem; font-size: 0.75rem; color: var(--text-muted); }
.fields label { font-size: inherit; color: inherit; }
```

- [ ] **B3: Anchor the list to the field's end edge**

Replace the `.picker-list` rule's comment and its two inset/​sizing lines. End-anchoring
grows the list toward the page centre in **both** writing directions, which is what the
old comment incorrectly claimed start-anchoring did:

```css
/* Anchored to the field's END edge: in LTR the day field is last in the row and in
   RTL it is first, so end-anchoring is what actually grows the list toward the page
   centre in both directions. Start-anchoring overflowed 320px viewports by 33px.
   width:max-content lets "۲۲ چهارشنبه" breathe past the 4.5rem field. */
.picker-list {
  position: absolute; z-index: 10;
  inset-inline-end: 0; inset-block-start: calc(100% + 4px);
  min-width: 100%; width: max-content;
  max-width: min(60vw, calc(100vw - 1.5rem));
  max-height: min(50vh, 20rem); overflow-y: auto; overscroll-behavior: contain;
  margin: 0; padding: 0.25rem; list-style: none;
  background: var(--surface-raised); border: 1px solid var(--hairline);
  border-radius: 6px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
  font-size: 0.85rem; color: var(--text); text-align: start;
}
/* Set by the picker when the list would not fit below the field. */
.picker-list.above {
  inset-block-start: auto; inset-block-end: calc(100% + 4px);
  box-shadow: 0 -8px 24px rgb(0 0 0 / 0.14);
}
```

- [ ] **B4: Widen the chevron on touch**

In the touch-target media block, change the chevron from `2rem` to `2.5rem` so a mis-tap
does not land on the input and raise the keypad. Keep the input's end padding matched:

```css
@media (max-width: 1024px), (pointer: coarse) {
  .fields input { min-height: 44px; font-size: 1rem; }
  .picker-toggle { width: 2.5rem; }
  .picker input { padding-inline-end: 2.5rem; }
  .picker-list li { min-height: 44px; display: flex; align-items: center; font-size: 1rem; }
}
```

- [ ] **B5: Verify**

Run: `cd Site && npx tsc --noEmit && npm run build`
Expected: clean.

Then confirm the font chain survived, because this is the single riskiest part of the
restructure:

```bash
cd Site && grep -n "fields .field" src/styles/components.css
```
Expected: a `font-size: 0.75rem` on `.fields .field`. Fix C's suite run is the real proof.

- [ ] **B6: Commit**

```bash
git add Site/index.html Site/src/styles/components.css
git commit -m "fix(site): explicit field labels and viewport-safe picker popup"
```

---

## Fix C — E2E coverage for every fixed defect (after Fix A and Fix B)

**Files:** Modify `Site/e2e/picker.spec.ts`. Modify `Site/e2e/site.spec.ts` only if a
selector genuinely broke.

- [ ] **C1: Broaden the overflow test to both sides and both directions**

The existing test only covers `#p-d` in English. The review measured RTL as clean by
1px, which is not margin. Replace the test `an open popup does not cause horizontal
overflow at phone widths` with:

```typescript
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
```

- [ ] **C2: Add a test per fixed defect**

Append to `Site/e2e/picker.spec.ts`:

```typescript
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
```

- [ ] **C3: Run everything**

Run: `cd Site && npm test && npx tsc --noEmit && npm run build && npx playwright test`

Expected: **all green, zero failures.** In particular the pre-existing
`desktop stays pixel-identical regardless of short viewport height` must still pass —
it asserts `#p-y`'s computed font-size is under 16px, which proves Fix B's `font:
inherit` chain survived the restructure.

If anything fails, diagnose and fix the implementation. Do not weaken an assertion to
make it pass. Report the exact failing assertion and the actual value.

- [ ] **C4: Record the real numbers and commit**

Report the exact Vitest total, the exact Playwright total, and the gzipped JS/CSS sizes
from the build output.

```bash
git add Site/e2e/picker.spec.ts Site/e2e/site.spec.ts
git commit -m "test(site): cover keyboard reach, focus, accessible name, and popup fit"
```

---

## Fix D — Enter must not reload the page (parallel with Fix A and Fix B)

**Files:** Modify `Site/src/converter/converter.ts` only.

Reported by the Task 4 agent as pre-existing since phase 1: pressing Enter in any
converter field with no popup open triggers the form's implicit submission. `#converter-form`
has no `action`, so the browser reloads the current URL and the user loses the state they
were editing. The pickers neither introduce nor worsen this, but it is live in production
right now and it is a one-line fix, so it ships here rather than waiting.

- [ ] **D1: Suppress implicit submission**

In `setupConverter`, next to the other element lookups, add:

```typescript
  // The form exists for grouping and labelling only — there is nothing to submit,
  // and the default action reloads the page and discards the user's date.
  byId<HTMLFormElement>('converter-form').addEventListener('submit', (event) => {
    event.preventDefault();
  });
```

- [ ] **D2: Verify**

Run: `cd Site && npx tsc --noEmit`
Expected: clean. Fix C adds the E2E test.

- [ ] **D3: Commit**

```bash
git add Site/src/converter/converter.ts
git commit -m "fix(site): Enter in a converter field no longer reloads the page"
```

Fix C additionally appends this test to `Site/e2e/picker.spec.ts`:

```typescript
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
```

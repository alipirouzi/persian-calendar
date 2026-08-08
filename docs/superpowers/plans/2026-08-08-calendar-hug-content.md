# Calendar Grid: Hug the Content

**Date:** 2026-08-08
**Status:** Approved
**Scope:** `Site/` only.

## Decision

The grid reserved six rows' height so the popup would not resize while paging
between months. Measured over twenty years in each calendar:

| Rows needed | Persian | Gregorian |
|---|---|---|
| 4 | — | 2 |
| 5 | 200 | 196 |
| 6 | 52 (20.6%) | 54 (21.4%) |

So roughly **79% of months show a permanently empty row** to smooth a transition
that happens in the other 21%. That is the common case made to look unfinished
for the sake of the rare one, and a visible dead band is exactly the kind of
thing a deliberately spare interface cannot carry.

The grid now **hugs its content**. Two supporting facts:

- The popup is pinned to the edge nearest its fieldset, so growth happens away
  from the field — the edge the eye is anchored on does not move.
- The touch block already sets `min-block-size: auto`, so phones and tablets have
  been hugging all along while desktop reserved. This also removes that split.

Rejected: filling the blanks with greyed neighbouring-month days. It would give
stable height and no dead space, but it adds a second class of number to a grid
whose blank cells are deliberately unambiguous, and it invites clicks on days
that belong to another month.

## Consequence to handle

With a fixed height, the side-and-cap decision could be taken once at open. Now
the height changes while the popup is open, so the cap must be re-applied after
every render or a month that grows to six rows can overflow the viewport.

**The chosen side must stay sticky for the lifetime of the open popup.**
Re-deciding it per render would let the popup jump from below the fieldset to
above it mid-navigation, which is far more jarring than the resize this change
introduces. Split the current `positionPopup` into:

- `chooseSide()` — sets or clears `above`. Called once, from `open()`.
- `applyHeightCap()` — sets or clears the inline `max-height` against the space
  on the already-chosen side. Called from `open()` after `chooseSide()`, and
  after every render while open.

The `visualViewport` `resize` listener keeps calling both, since a keyboard
retracting genuinely changes which side is right.

## Testing

**Vitest:** the row-count distribution above is already implied by
`calendar-grid-model`'s existing tests; add one asserting a known 5-row and a
known 6-row month so the premise is pinned.

**Playwright:** the popup's height differs between a 5-row and a 6-row month;
the chosen side does not change when navigating months; the popup still fits the
viewport after navigating from a 5-row to a 6-row month at a phone height; and no
empty trailing row is rendered.

**Live verification** across 320/375/768/1440 and landscape, both themes and
both writing directions, before deploying.

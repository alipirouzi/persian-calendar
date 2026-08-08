export interface Popup {
  readonly isOpen: boolean;
  /** `focusTarget` receives DOM focus; `invoker` receives it back on close. */
  open(options: { invoker: HTMLElement; focusTarget: HTMLElement }): void;
  close(restoreFocus: boolean): void;
  /** Re-apply the height cap after the surface's content changes size. */
  reposition(): void;
}

interface Parts {
  /** Gets `aria-expanded`, and counts as "inside" for dismissal. */
  trigger: HTMLElement;
  /** The popup itself; gets `hidden`, `above` and the inline height cap. */
  surface: HTMLElement;
  /** Element the surface is positioned against. Defaults to surface.offsetParent. */
  anchor?: () => HTMLElement | null;
  /** Extra elements that count as "inside" for dismissal. */
  within?: readonly HTMLElement[];
}

/** Vertical gap between the anchor and the surface — mirrors CSS `calc(100% + 4px)`. */
const GAP = 4;
/** Below this the cap would leave a uselessly short box, so it is skipped. */
const MIN_SURFACE_HEIGHT = 120;

/**
 * The popup mechanics every anchored popup in this app shares: open and close,
 * `aria-expanded`, dismissal by pointer or by focus leaving, focus return to
 * whatever opened it, and keeping the surface on screen.
 *
 * Deliberately ignorant of what the surface contains — it never reads or writes
 * the content, so a listbox and a calendar grid can both sit inside one.
 */
export function createPopup({ trigger, surface, anchor, within = [] }: Parts): Popup {
  let isOpen = false;
  /** Where focus returns when the popup closes: whatever opened it. */
  let invoker: HTMLElement = trigger;
  /**
   * Distance from the anchor's bottom edge to the surface's top edge, taken when
   * the side is chosen; null while anchored below.
   *
   * The `above` rule anchors the surface by its bottom, so a content change of h
   * pixels drags the head — and the title button under the user's finger — by the
   * same h. Measured against the anchor rather than the viewport so page scroll
   * between renders cannot smear it.
   */
  let aboveTopOffset: number | null = null;

  const isInside = (node: Node): boolean =>
    trigger.contains(node) || surface.contains(node) || within.some((el) => el.contains(node));

  /**
   * The box the CSS anchors the surface to: its containing block. Measuring the
   * trigger instead would read the space below whatever wraps it, which can be a
   * whole fieldset taller than the space below the surface's real top edge.
   */
  const anchorRect = (): DOMRect =>
    (anchor?.() ?? (surface.offsetParent as HTMLElement | null) ?? trigger).getBoundingClientRect();

  /**
   * Room on either side of the anchor. visualViewport is what shrinks when a
   * mobile keypad is showing, so prefer it over the layout viewport.
   */
  const roomAround = (): { above: number; below: number } => {
    const box = anchorRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return { above: box.top, below: viewportHeight - box.bottom };
  };

  /** Lift any previous cap and measure what the surface wants to be. */
  const measureUncapped = (): number => {
    surface.style.removeProperty('max-height');
    return surface.getBoundingClientRect().height;
  };

  /**
   * Cap the surface to the room on the side it is on, so it scrolls internally
   * instead of running off-screen. Below the floor the cap is skipped: a box that
   * short is worse than the overflow, and the surface is in normal flow, so page
   * scroll still reaches it.
   *
   * Returns the height the surface will actually occupy, which is what the
   * above-anchored top hold has to measure its bottom inset from.
   */
  const applyCap = (height: number): number => {
    const room = roomAround();
    const available = (surface.classList.contains('above') ? room.above : room.below) - GAP * 2;
    if (height > available && available >= MIN_SURFACE_HEIGHT) {
      const capped = Math.floor(available);
      surface.style.maxHeight = `${capped}px`;
      return capped;
    }
    return height;
  };

  /**
   * Open downward by default; flip above only when the surface does not fit below
   * AND genuinely fits above. When it fits neither way — a landscape phone — take
   * whichever side has more room rather than defaulting downward, which opened
   * the surface most of a screen past the fold.
   *
   * Taken once per open, so a render that changes the content's size cannot make
   * the popup jump sides under the user; `reposition()` only re-caps and, above,
   * re-asserts the top.
   */
  const position = (): void => {
    surface.classList.remove('above');
    // Before measuring, not after: a held bottom inset left over from the last
    // side, against the block-start inset the base rule has just come back to,
    // stretches the box between the two and reports that instead of the content.
    surface.style.removeProperty('inset-block-end');
    aboveTopOffset = null;
    const height = measureUncapped();
    const room = roomAround();
    const fitsBelow = height + GAP <= room.below;
    const fitsAbove = height + GAP <= room.above;
    if (!fitsBelow && (fitsAbove || room.above > room.below)) {
      surface.classList.add('above');
    }
    applyCap(height);
    // Read back rather than derive: the top the CSS actually landed on is the one
    // worth holding, whatever the rule's own gap turns out to be.
    if (surface.classList.contains('above')) {
      aboveTopOffset = anchorRect().bottom - surface.getBoundingClientRect().top;
    }
  };

  const setExpanded = (value: boolean): void => {
    isOpen = value;
    surface.hidden = !value;
    trigger.setAttribute('aria-expanded', String(value));
  };

  // The keypad is what makes visualViewport shrink, so a side chosen while it was
  // still retracting is corrected once it has gone — the one case where the side
  // is allowed to change without a fresh open.
  window.visualViewport?.addEventListener('resize', () => {
    if (isOpen) position();
  });

  // Keep the browser from moving focus on press: the popup decides where focus
  // belongs. Not on `within` — the picker's text field must still accept a click.
  for (const el of [trigger, surface]) {
    el.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  const close = (restoreFocus: boolean): void => {
    if (!isOpen) return;
    setExpanded(false);
    surface.classList.remove('above');
    surface.style.removeProperty('max-height');
    surface.style.removeProperty('inset-block-end');
    if (restoreFocus) invoker.focus();
  };

  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null && isInside(next)) return;
    // No focus restore: focus has already moved on.
    close(false);
  };
  for (const el of [trigger, surface, ...within]) {
    el.addEventListener('focusout', onFocusOut);
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen) return;
    if (isInside(event.target as Node)) return;
    // No focus restore: the pointer is already on its way somewhere else.
    close(false);
  });

  return {
    get isOpen() { return isOpen; },

    open({ invoker: from, focusTarget }) {
      invoker = from;
      // Un-hide first: a hidden surface measures zero, so the side and the cap
      // would both be decided against a box of no height.
      setExpanded(true);
      position();
      // preventScroll because the surface grows the document: focusing it would
      // scroll the page under the user, and the snap back on close would swallow
      // their next click.
      if (document.activeElement !== focusTarget) focusTarget.focus({ preventScroll: true });
    },

    close,

    reposition() {
      if (!isOpen) return;
      const shown = applyCap(measureUncapped());
      // Anchored above, re-derive the bottom inset from the height the surface
      // now occupies, so it grows and shrinks away from the head instead of
      // dragging it. Anchored below the top is already pinned by the base rule.
      if (aboveTopOffset !== null) {
        surface.style.insetBlockEnd = `${aboveTopOffset - shown}px`;
      }
    },
  };
}

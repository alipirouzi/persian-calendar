import {
  CALENDAR_VIEWS,
  type CalendarMode, type RenderedView, type ViewCell, type ViewState,
} from '../converter/calendar-views';
import { STRINGS, type Lang } from '../i18n/strings';
import type { Side } from '../converter/converter-core';
import { gridIntent } from './grid-navigation';
import { createPopup } from './popup';

export interface CalendarGrid {
  /** Re-read language and re-render if open. */
  rerender(): void;
  close(): void;
}

interface Parts {
  side: Side;
  button: HTMLButtonElement;
  popup: HTMLElement;
  /** It steps up a view, and is disabled once at the top. */
  title: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  grid: HTMLElement;
  getLang: () => Lang;
  /** The date the converter currently holds for this side, or null. */
  getCurrent: () => ViewState | null;
  /** Today's date in this side's calendar. */
  getToday: () => ViewState;
  onPick: (year: number, month: number, day: number) => void;
}

/** Keys that belong to the grid even when they turn out not to move anything. */
const MOVE_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
]);

/**
 * The WAI-ARIA grid pattern is visual, not logical: ArrowRight moves to the cell
 * on the right, which under RTL is the previous one.
 */
const isRtl = (): boolean => document.documentElement.dir === 'rtl';

/**
 * A date picker that drills down through years, months and days, opened from the
 * button in its fieldset legend.
 *
 * This module owns only the current mode, the working date, the keyboard cursor
 * and the DOM. What each view shows, what a step means and what choosing a cell
 * does all live in `CALENDAR_VIEWS`; keys live in `gridIntent`; open, close,
 * dismissal and positioning live in `createPopup`. Adding a fourth view should
 * not require an edit here.
 */
export function createCalendarGrid({
  side, button, popup: surface, title, prev, next, grid,
  getLang, getCurrent, getToday, onPick,
}: Parts): CalendarGrid {
  const popup = createPopup({ trigger: button, surface });

  let mode: CalendarMode = 'days';
  /** The date being browsed. Only a step or a selection moves it. */
  let state: ViewState = getToday();
  /** Index into the flattened cells of the view on screen. */
  let cursor = 0;
  /** The last view built. Seeded so every handler has a shape to read. */
  let view: RenderedView = CALENDAR_VIEWS[mode].render(side, state, getLang(), getCurrent());
  let cells: readonly (ViewCell | null)[] = view.rows.flat();

  const cellId = (value: number): string => `${grid.id}-${view.key}${value}`;

  /**
   * Where `value` sits on the page now on screen. A page that has not got it —
   * day 31 after a step into a 30-day month — falls back to the edge `missing`
   * names: the far end for a step, which is the shorter month's last day, and
   * the near end for an arrival, which is where reading starts.
   */
  const indexOfValue = (value: number, missing: 'first' | 'last'): number => {
    const found = cells.findIndex((cell) => cell?.value === value);
    if (found >= 0) return found;
    const real = cells.flatMap((cell, index) => (cell === null ? [] : [index]));
    return (missing === 'first' ? real[0] : real.at(-1)) ?? -1;
  };

  /**
   * Rows carry `role="row"`, but the columns are declared on `.cal-grid`, so a
   * row that generated a box would swallow a whole column and collapse the
   * layout. `display: contents` hands the cells straight to the parent grid
   * while keeping the row in the accessibility tree.
   */
  const makeRow = (): HTMLDivElement => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.style.display = 'contents';
    return row;
  };

  /**
   * Keep the cursor visible once the popup has been capped and scrolls. Scrolls
   * the POPUP only — `scrollIntoView` would take the page with it, which is the
   * lurch the picker already had to unlearn.
   */
  const revealCursor = (): void => {
    const cell = document.getElementById(grid.getAttribute('aria-activedescendant') ?? '');
    if (cell === null) return;
    const box = surface.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    if (rect.top < box.top) {
      surface.scrollTop -= box.top - rect.top;
    } else if (rect.bottom > box.bottom) {
      surface.scrollTop += rect.bottom - box.bottom;
    }
  };

  /**
   * Today, when it falls on the page being shown. Asking the same strategy to
   * render today's date answers both halves at once — whether this is today's
   * page, and which of its cells today is — without this module having to know
   * that a day page is a month and a year page is twelve years.
   */
  const todayValue = (lang: Lang): number | null => {
    const today = getToday();
    const forToday = CALENDAR_VIEWS[mode].render(side, today, lang, null);
    return forToday.title === view.title ? CALENDAR_VIEWS[mode].cursorValue(today) : null;
  };

  const makeCell = (cell: ViewCell | null, index: number, today: number | null): HTMLElement => {
    const el = document.createElement('div');
    el.setAttribute('role', 'gridcell');
    if (cell === null) {
      el.className = 'cal-blank';
      return el;
    }
    el.className = 'cal-cell';
    el.id = cellId(cell.value);
    el.dataset[view.unit] = String(cell.value);
    el.textContent = cell.label;
    // A page without the committed date reports a null selection, and null is
    // equal to no cell's value, so nothing on it is marked.
    el.setAttribute('aria-selected', String(cell.value === view.selected));
    // Today is an outline and the selection is a fill, so one cell can wear both
    // without either mark being lost.
    el.classList.toggle('active', cell.value === view.selected);
    el.classList.toggle('today', cell.value === today);
    // aria-activedescendant alone tells assistive tech where Enter will land but
    // leaves a sighted keyboard user with nothing on screen, so the cell under
    // the cursor wears an outline as well.
    el.classList.toggle('cursor', index === cursor);
    return el;
  };

  /**
   * Re-derive the view from the mode and the date, and rebuild the grid.
   * `cursorValue` moves the cursor onto that cell first; without it the cursor
   * index stands, which is what a plain cursor move or a language change want.
   */
  const render = (cursorValue?: number, missing: 'first' | 'last' = 'first'): void => {
    const lang = getLang();
    // The mark belongs to the committed date, so it is re-read every render: a
    // date picked, cleared or typed while the popup is open moves it.
    view = CALENDAR_VIEWS[mode].render(side, state, lang, getCurrent());
    cells = view.rows.flat();
    if (cursorValue !== undefined) cursor = Math.max(indexOfValue(cursorValue, missing), 0);

    const today = todayValue(lang);
    const rows = view.rows.map((row, rowIndex) => {
      const el = makeRow();
      el.append(...row.map(
        (cell, column) => makeCell(cell, rowIndex * view.columns + column, today)));
      return el;
    });
    const header = makeRow();
    header.append(...view.headers.map((label) => {
      const cell = document.createElement('div');
      cell.className = 'cal-wd';
      cell.setAttribute('role', 'columnheader');
      cell.textContent = label;
      return cell;
    }));

    grid.classList.toggle('cal-grid--wide', view.layout === 'page');
    // The CSS lays the track out from the data rather than from a second copy of
    // the column count kept here.
    grid.style.setProperty('--cal-cols', String(view.columns));
    grid.replaceChildren(...(view.headers.length > 0 ? [header] : []), ...rows);
    const active = cells[cursor];
    if (active === undefined || active === null) {
      grid.removeAttribute('aria-activedescendant');
    } else {
      grid.setAttribute('aria-activedescendant', cellId(active.value));
    }
    revealCursor();
    // The title is a plain button, so a step would otherwise be silent: naming
    // the grid after what is on screen makes the change announce.
    grid.setAttribute('aria-label', view.title);
    title.textContent = view.title;
    title.disabled = view.titleTarget === null;
    prev.disabled = !view.canGoPrev;
    next.disabled = !view.canGoNext;
    // ‹ and › carry no text, so the label is the whole accessible name, and a
    // step means something different in each view.
    prev.setAttribute('aria-label', STRINGS[lang][view.prevLabel]);
    next.setAttribute('aria-label', STRINGS[lang][view.nextLabel]);
    // The views differ in height, so the cap taken when the popup opened has to
    // be re-applied to whatever it now holds.
    popup.reposition();
  };

  /** Show `next`, with the cursor on the cell the arriving date occupies. */
  const goTo = (next: CalendarMode, to: ViewState): void => {
    mode = next;
    state = to;
    render(CALENDAR_VIEWS[mode].cursorValue(state));
  };

  /** Prev/next and PageUp/PageDown. A step past a range bound is a no-op. */
  const step = (delta: -1 | 1): void => {
    const next = CALENDAR_VIEWS[mode].step(side, state, delta);
    if (next === null) return;
    // Paging is browsing, not arriving: the cursor keeps the value the arrows
    // gave it instead of snapping back to the date the state carries.
    const carried = cells[cursor]?.value;
    state = next;
    render(carried, 'last');
  };

  const close = (restoreFocus: boolean): void => {
    popup.close(restoreFocus);
    grid.removeAttribute('aria-activedescendant');
  };

  /** Drill down one view, or pick the date when there is nowhere further down. */
  const choose = (value: number): void => {
    const outcome = CALENDAR_VIEWS[mode].select(side, state, value);
    if (outcome.next !== 'pick') {
      goTo(outcome.next, outcome.state);
      return;
    }
    const { year, month, day } = outcome.state;
    close(true);
    onPick(year, month, day);
  };

  /**
   * Blanks pad a month that does not start on the first column, and the cursor
   * must never land on one. The nearest real cell in the target's own row is the
   * answer for every key at once: Home on a short first week reaches day 1, End
   * on a short last week reaches the last day, and an arrow that walks off the
   * month falls back to where it started.
   */
  const resolve = (target: number): number | null => {
    const rowStart = target - (target % view.columns);
    const row = cells.slice(rowStart, rowStart + view.columns);
    const offsets = row
      .map((cell, i) => (cell === null ? -1 : i))
      .filter((i) => i >= 0)
      .sort((a, b) => Math.abs(a - (target - rowStart)) - Math.abs(b - (target - rowStart)));
    const nearest = offsets[0];
    return nearest === undefined ? null : rowStart + nearest;
  };

  const moveCursor = (target: number): void => {
    const landing = resolve(target);
    if (landing === null) return;
    cursor = landing;
    render();
  };

  const open = (): void => {
    // Always from the top of the date the fields hold: a wizard that reopened
    // three levels deep would be answering a question nobody asked.
    mode = 'days';
    state = getCurrent() ?? getToday();
    render(CALENDAR_VIEWS[mode].cursorValue(state));
    popup.open({ invoker: button, focusTarget: grid });
    // Positioning happened while the grid was still hidden and unmeasurable, so
    // the reveal only means anything now.
    revealCursor();
  };

  // Bound to the popup, not the grid: Escape must still close if focus has
  // reached one of the buttons.
  surface.addEventListener('keydown', (event) => {
    const shape = { columns: view.columns, count: cells.length, rtl: isRtl() };
    const intent = gridIntent(event.key, cursor, shape, popup.isOpen);
    if (intent === null) {
      // A move that cannot land is still the grid's key: left to the browser,
      // the arrow that does nothing scrolls the page instead.
      if (MOVE_KEYS.has(event.key)) event.preventDefault();
      return;
    }
    switch (intent.kind) {
      case 'move':
        event.preventDefault();
        moveCursor(intent.index);
        return;
      case 'page':
        event.preventDefault();
        step(intent.delta);
        return;
      case 'select': {
        // Only from the grid itself: on a button these keys are that button's
        // own activation, and choosing a cell out from under it is a surprise.
        if (event.target !== grid) return;
        event.preventDefault();
        const cell = cells[cursor];
        if (cell !== undefined && cell !== null) choose(cell.value);
        return;
      }
      case 'dismiss':
        event.preventDefault();
        close(true);
        return;
      case 'open':
        // Unreachable: the surface only sees keys while it is open.
        return;
    }
  });

  button.addEventListener('click', () => {
    if (popup.isOpen) { close(true); return; }
    open();
  });

  /**
   * Focus first, then navigate — navigating can disable the very button that was
   * pressed, and disabling a focused element blurs it, which reads as focus
   * leaving the popup and dismisses it. Then focus goes back where the user
   * actually is, or a keyboard press would silently leave them on the grid,
   * where the next Enter picks a cell.
   */
  const fromButton = (btn: HTMLButtonElement, act: () => void): void => {
    grid.focus({ preventScroll: true });
    act();
    // Unless the action disabled it: then the grid is the right place to be, and
    // Escape still closes from there.
    if (!btn.disabled) btn.focus({ preventScroll: true });
  };

  prev.addEventListener('click', () => { fromButton(prev, () => { step(-1); }); });
  next.addEventListener('click', () => { fromButton(next, () => { step(1); }); });
  // The title drills up to wherever this view says it leads.
  title.addEventListener('click', () => {
    fromButton(title, () => {
      const target = view.titleTarget;
      if (target !== null) goTo(target, state);
    });
  });

  grid.addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    if (cell === null || !grid.contains(cell)) return;
    // Cancel activation behaviour so focus stays where the popup put it.
    event.preventDefault();
    const value = Number(cell.dataset[view.unit]);
    if (!Number.isInteger(value)) return;
    choose(value);
  });

  // The popup dismisses itself on an outside pointerdown or on focus leaving,
  // and reports no callback, so the grid mirrors those closes — exactly as the
  // picker does. Registered after createPopup, so its handler has already run
  // and `popup.isOpen` is settled.
  const syncAfterDismissal = (): void => {
    if (!popup.isOpen) grid.removeAttribute('aria-activedescendant');
  };
  document.addEventListener('pointerdown', syncAfterDismissal);
  for (const el of [button, surface]) el.addEventListener('focusout', syncAfterDismissal);

  return {
    rerender() {
      // Closed popups need nothing: the next open renders from scratch.
      if (popup.isOpen) render();
    },
    close() { close(false); },
  };
}

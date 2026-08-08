import { buildMonthGrid, stepMonth, type MonthGrid } from '../converter/calendar-grid-model';
import { toLocaleDigits, type Lang } from '../i18n/strings';
import type { Side } from '../converter/converter-core';

export interface CalendarGrid {
  /** Re-read language and re-render if open. */
  rerender(): void;
  close(): void;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface Parts {
  side: Side;
  button: HTMLButtonElement;
  popup: HTMLElement;
  title: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  grid: HTMLElement;
  getLang: () => Lang;
  /** The date the converter currently holds for this side, or null. */
  getCurrent: () => DateParts | null;
  /** Today's date in this side's calendar. */
  getToday: () => DateParts;
  onPick: (year: number, month: number, day: number) => void;
}

const DAYS_IN_WEEK = 7;

/**
 * How many real days a month holds, read back off the model's grid rather than
 * from `daysIn*`: this component stays ignorant of calendars, exactly as the
 * number picker stays ignorant of languages and digits.
 */
const monthLength = (model: MonthGrid): number =>
  model.weeks.flat().filter((day) => day !== null).length;

/**
 * A browsable month grid for one calendar, opened from the button in its
 * fieldset legend.
 *
 * Focus works the way the number picker's does: one element holds DOM focus —
 * here the grid — and `aria-activedescendant` names the cell the keyboard
 * cursor is on, so there is a single focus story in this codebase. Dismissal
 * matches too: a pointerdown outside, or Escape, and nothing else.
 */
export function createCalendarGrid({
  side, button, popup, title, prev, next, grid,
  getLang, getCurrent, getToday, onPick,
}: Parts): CalendarGrid {
  let isOpen = false;
  /** The month on screen. Navigation moves this; the fields do not. */
  let viewYear = 1;
  let viewMonth = 1;
  /** The day under the keyboard cursor, always inside the month on screen. */
  let focusDay = 1;
  /** Last rendered month, kept for Home/End's "the displayed week" question. */
  let view: MonthGrid | null = null;
  /** Days in the month on screen, so a step knows where the month ends. */
  let viewLength = 1;

  const cellId = (day: number): string => `${grid.id}-d${day}`;

  /** The day of `date` when it falls in the month on screen, else -1. */
  const dayInView = (date: DateParts | null): number =>
    date !== null && date.year === viewYear && date.month === viewMonth ? date.day : -1;

  /**
   * Rows carry `role="row"`, but the seven columns are declared on `.cal-grid`,
   * so a row that generated a box would swallow a whole column and collapse the
   * layout. `display: contents` hands the cells straight to the parent grid
   * while keeping the row in the accessibility tree.
   */
  const makeRow = (): HTMLDivElement => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.style.display = 'contents';
    return row;
  };

  const render = (): void => {
    const lang = getLang();
    const model = buildMonthGrid(side, viewYear, viewMonth, lang);
    view = model;

    // A month narrower than the one we came from must not strand the cursor
    // past its end — Esfand 30 → Farvardin 30 is fine, but 31 → Esfand is not.
    viewLength = monthLength(model);
    focusDay = Math.min(Math.max(focusDay, 1), viewLength);

    const selectedDay = dayInView(getCurrent());
    const todayDay = dayInView(getToday());

    const header = makeRow();
    header.append(...model.weekdayHeaders.map((label) => {
      const cell = document.createElement('div');
      cell.className = 'cal-wd';
      cell.setAttribute('role', 'columnheader');
      cell.textContent = label;
      return cell;
    }));

    const rows = model.weeks.map((week) => {
      const row = makeRow();
      row.append(...week.map((day) => {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'gridcell');
        if (day === null) {
          cell.className = 'cal-blank';
          return cell;
        }
        cell.className = 'cal-cell';
        cell.id = cellId(day);
        cell.dataset['day'] = String(day);
        cell.textContent = toLocaleDigits(day, lang);
        cell.setAttribute('aria-selected', String(day === selectedDay));
        // Today is an outline and the selection is a fill, so one cell can wear
        // both without either mark being lost.
        cell.classList.toggle('active', day === selectedDay);
        cell.classList.toggle('today', day === todayDay);
        return cell;
      }));
      return row;
    });

    grid.replaceChildren(header, ...rows);
    grid.setAttribute('aria-activedescendant', cellId(focusDay));
    title.textContent = model.title;
    prev.disabled = !model.canGoPrev;
    next.disabled = !model.canGoNext;
  };

  const setView = (year: number, month: number, day: number): void => {
    viewYear = year;
    viewMonth = month;
    focusDay = day;
    render();
  };

  /**
   * Move the cursor by whole days, crossing into the neighbouring month when
   * the step runs off the end of this one. A step past a supported range bound
   * is a no-op — `stepMonth` returning null is the whole answer.
   */
  const shiftFocus = (delta: number): void => {
    const target = focusDay + delta;
    if (target >= 1 && target <= viewLength) {
      setView(viewYear, viewMonth, target);
      return;
    }
    const step = stepMonth(side, viewYear, viewMonth, target < 1 ? -1 : 1);
    if (step === null) return;
    const before = viewLength;
    const after = monthLength(buildMonthGrid(side, step.year, step.month, getLang()));
    // A day step never spans a whole month: the shortest is 28, the step is 7.
    setView(step.year, step.month, target < 1 ? after + target : target - before);
  };

  /** PageUp/PageDown and the header arrows. render() clamps the day. */
  const shiftMonth = (delta: number): void => {
    const step = stepMonth(side, viewYear, viewMonth, delta);
    if (step === null) return;
    setView(step.year, step.month, focusDay);
  };

  /**
   * Home/End land on the first and last day of the row the cursor is in, so a
   * partial first or last week stops inside the month rather than on a blank.
   */
  const weekEdge = (edge: 'first' | 'last'): void => {
    const week = view?.weeks.find((row) => row.includes(focusDay));
    if (week === undefined) return;
    const days = week.filter((day): day is number => day !== null);
    const day = edge === 'first' ? days[0] : days[days.length - 1];
    if (day === undefined) return;
    setView(viewYear, viewMonth, day);
  };

  const setExpanded = (value: boolean): void => {
    isOpen = value;
    popup.hidden = !value;
    button.setAttribute('aria-expanded', String(value));
  };

  const open = (): void => {
    const start = getCurrent() ?? getToday();
    viewYear = start.year;
    viewMonth = start.month;
    focusDay = start.day;
    setExpanded(true);
    render();
    // preventScroll for the same reason the picker avoids scrollIntoView: the
    // popup grows the document, so focusing it would scroll the page under the
    // user — and the snap back when it closes swallows their next click.
    grid.focus({ preventScroll: true });
  };

  const close = (restoreFocus: boolean): void => {
    if (!isOpen) return;
    setExpanded(false);
    grid.removeAttribute('aria-activedescendant');
    if (restoreFocus) button.focus();
  };

  const pick = (day: number): void => {
    close(true);
    onPick(viewYear, viewMonth, day);
  };

  grid.addEventListener('keydown', (event) => {
    // Every handled key is prevented before it is acted on, including the ones
    // that turn out to be no-ops at a range bound — otherwise the arrow that
    // cannot move the cursor scrolls the page instead.
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        shiftFocus(-1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        shiftFocus(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        shiftFocus(-DAYS_IN_WEEK);
        return;
      case 'ArrowDown':
        event.preventDefault();
        shiftFocus(DAYS_IN_WEEK);
        return;
      case 'Home':
        event.preventDefault();
        weekEdge('first');
        return;
      case 'End':
        event.preventDefault();
        weekEdge('last');
        return;
      case 'PageUp':
        event.preventDefault();
        shiftMonth(-1);
        return;
      case 'PageDown':
        event.preventDefault();
        shiftMonth(1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(focusDay);
        return;
      case 'Escape':
        event.preventDefault();
        close(true);
        return;
      default:
        return;
    }
  });

  button.addEventListener('click', () => {
    if (isOpen) {
      close(true);
      return;
    }
    open();
  });

  prev.addEventListener('click', () => { shiftMonth(-1); });
  next.addEventListener('click', () => { shiftMonth(1); });

  // Keep the browser from moving focus on press, the way the picker's list
  // does: the grid holds focus until close(true) hands it back to the button.
  grid.addEventListener('mousedown', (event) => { event.preventDefault(); });
  grid.addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    if (cell === null || !grid.contains(cell)) return;
    event.preventDefault();
    const day = Number(cell.dataset['day']);
    if (!Number.isInteger(day)) return;
    pick(day);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen) return;
    const target = event.target as Node;
    if (button.contains(target) || popup.contains(target)) return;
    // No focus restore: the pointer is already on its way somewhere else.
    close(false);
  });

  return {
    rerender() {
      // Closed popups need nothing: the next open renders from scratch.
      if (isOpen) render();
    },
    close() { close(false); },
  };
}

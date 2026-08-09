import { daysInGregorianMonth, daysInPersianMonth } from '../calendar/persian';
import { toLocaleDigits, type Lang, type StringKey } from '../i18n/strings';
import {
  buildMonthGrid, buildMonthPage, buildYearPage, PAGE_SIZE,
  stepMonth, stepYear, stepYearPage, yearPageStart,
} from './calendar-grid-model';
import type { Side } from './converter-core';

export type CalendarMode = 'days' | 'months' | 'years';

export interface ViewState { year: number; month: number; day: number }

export interface ViewCell { value: number; label: string }

export interface RenderedView {
  /** Taken from the rows, never declared: the two cannot then disagree. */
  columns: number;
  /** Rows of cells; null is a blank slot. */
  rows: readonly (readonly (ViewCell | null)[])[];
  /** Extra header row for the day grid's weekday labels; empty otherwise. */
  headers: readonly string[];
  title: string;
  /** Where the title button drills up to, or null at the top of the drill-down. */
  titleTarget: CalendarMode | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** What a step moves — a month, a year, or a page of years. */
  prevLabel: StringKey;
  nextLabel: StringKey;
  /** A week of days, or a page of twelve. The consumer maps it to a class. */
  layout: 'week' | 'page';
  /**
   * The `data-*` attribute a cell carries its value in, and the discriminator
   * in its id. One field, so a new view cannot make the two disagree.
   */
  unit: 'day' | 'month' | 'year';
  /**
   * The committed date's cell, or null when this page does not hold it. Null
   * equals no number, so no cell is marked.
   */
  selected: number | null;
}

export interface CalendarView {
  /**
   * `committed` is the date the converter holds — the one the mark belongs to.
   * It is not `state`: `state` is where the user has browsed to, and browsing
   * must not move a mark that stands for a decision already made.
   */
  render(side: Side, state: ViewState, lang: Lang, committed: ViewState | null): RenderedView;
  /** Which cell `state` itself occupies — where a cursor arriving here lands. */
  cursorValue(state: ViewState): number;
  /**
   * What a page step does with the cursor. `value` keeps the number the arrows
   * gave it, which is right where values recur across pages (day 22 exists in
   * most months, month 5 in every year). `index` keeps the slot instead, which
   * is the only sensible answer where pages are disjoint: a year page never
   * contains the year you came from, so carrying the value would clamp every
   * single step to the page's last cell.
   */
  readonly carry: 'value' | 'index';
  /** Prev/next: a month, a year, or twelve years. Null at a range bound. */
  step(side: Side, state: ViewState, delta: -1 | 1): ViewState | null;
  /** What choosing `value` does: move to another view, or pick the date. */
  select(
    side: Side, state: ViewState, value: number,
  ): { state: ViewState; next: CalendarMode | 'pick' };
}

const NO_HEADERS: readonly string[] = [];

function monthLength(side: Side, year: number, month: number): number {
  return side === 'persian'
    ? daysInPersianMonth(year, month)
    : daysInGregorianMonth(year, month);
}

/**
 * The page's width, read back off the rows the model chunked. Declaring it
 * separately let three copies of the same number drift apart.
 */
function columnsOf(rows: readonly (readonly unknown[])[]): number {
  return rows[0]?.length ?? 0;
}

/** Turn a model's rows into view cells, keeping its null padding as blanks. */
function toRows<T>(
  rows: readonly (readonly (T | null)[])[],
  toCell: (value: T) => ViewCell,
): readonly (readonly (ViewCell | null)[])[] {
  return rows.map((row) => row.map((value) => (value === null ? null : toCell(value))));
}

/**
 * Days: the month on screen, one cell per day. This is the only view that picks
 * a date; the other two exist to get here.
 */
const daysView: CalendarView = {
  render(side, state, lang, committed) {
    const model = buildMonthGrid(side, state.year, state.month, lang);
    const rows = toRows(model.weeks, (day) => ({ value: day, label: toLocaleDigits(day, lang) }));
    return {
      columns: columnsOf(rows),
      rows,
      headers: model.weekdayHeaders,
      title: model.title,
      titleTarget: 'years',
      canGoPrev: model.canGoPrev,
      canGoNext: model.canGoNext,
      prevLabel: 'prevMonth',
      nextLabel: 'nextMonth',
      layout: 'week',
      unit: 'day',
      selected: committed !== null
        && committed.year === state.year
        && committed.month === state.month
        ? committed.day : null,
    };
  },
  carry: 'value',
  cursorValue(state) {
    return state.day;
  },
  step(side, state, delta) {
    const next = stepMonth(side, state.year, state.month, delta);
    if (next === null) return null;
    // A shorter neighbour must not strand the day past its end — Esfand 30 →
    // Farvardin 30 is fine, but Shahrivar 31 → Mehr is not.
    return {
      ...state, ...next,
      day: Math.min(state.day, monthLength(side, next.year, next.month)),
    };
  },
  select(_side, state, value) {
    // No clamp: the value came from a cell this month really rendered.
    return { state: { ...state, day: value }, next: 'pick' };
  },
};

/** Months: the twelve months of the year on screen, named in the current language. */
const monthsView: CalendarView = {
  render(side, state, lang, committed) {
    const page = buildMonthPage(side, state.year, lang);
    const rows = toRows(page.cells, (month) => ({ value: month.value, label: month.label }));
    return {
      columns: columnsOf(rows),
      rows,
      headers: NO_HEADERS,
      title: page.title,
      titleTarget: 'years',
      canGoPrev: page.canGoPrev,
      canGoNext: page.canGoNext,
      prevLabel: 'prevYear',
      nextLabel: 'nextYear',
      layout: 'page',
      unit: 'month',
      selected: committed !== null && committed.year === state.year ? committed.month : null,
    };
  },
  carry: 'value',
  cursorValue(state) {
    return state.month;
  },
  step(side, state, delta) {
    const year = stepYear(side, state.year, delta);
    return year === null ? null : { ...state, year };
  },
  select(side, state, value) {
    // Unlike a day cell, a month cell says nothing about how long it is: coming
    // from a 31-day month into Esfand has to bring the day back inside it.
    return {
      state: { ...state, month: value, day: Math.min(state.day, monthLength(side, state.year, value)) },
      next: 'days',
    };
  },
};

/** Years: a page of twelve, aligned to the start of the supported range. */
const yearsView: CalendarView = {
  render(side, state, lang, committed) {
    const page = buildYearPage(side, state.year, lang);
    const rows = toRows(page.cells, (year) => ({ value: year, label: toLocaleDigits(year, lang) }));
    return {
      columns: columnsOf(rows),
      rows,
      headers: NO_HEADERS,
      title: page.title,
      // The top of the drill-down: there is nothing above the years.
      titleTarget: null,
      canGoPrev: page.canGoPrev,
      canGoNext: page.canGoNext,
      prevLabel: 'prevYears',
      nextLabel: 'nextYears',
      layout: 'page',
      unit: 'year',
      // Pages are aligned to the range's start, so sharing a start is sharing a page.
      selected: committed !== null
        && yearPageStart(side, committed.year) === yearPageStart(side, state.year)
        ? committed.year : null,
    };
  },
  carry: 'index',
  cursorValue(state) {
    return state.year;
  },
  step(side, state, delta) {
    const start = stepYearPage(side, yearPageStart(side, state.year), delta);
    if (start === null) return null;
    // Stepping the year by a whole page keeps it in the same slot — except on
    // the range's last, short page, where that slot does not exist.
    return { ...state, year: stepYear(side, state.year, delta * PAGE_SIZE) ?? start };
  },
  select(_side, state, value) {
    return { state: { ...state, year: value }, next: 'months' };
  },
};

export const CALENDAR_VIEWS: Readonly<Record<CalendarMode, CalendarView>> = {
  days: daysView,
  months: monthsView,
  years: yearsView,
};

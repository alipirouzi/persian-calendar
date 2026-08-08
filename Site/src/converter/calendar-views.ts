import { daysInGregorianMonth, daysInPersianMonth } from '../calendar/persian';
import { toLocaleDigits, type Lang } from '../i18n/strings';
import {
  buildMonthGrid, buildMonthPage, buildYearPage,
  stepMonth, stepYear, stepYearPage, yearPageStart,
} from './calendar-grid-model';
import type { Side } from './converter-core';

export type CalendarMode = 'days' | 'months' | 'years';

export interface ViewState { year: number; month: number; day: number }

export interface ViewCell { value: number; label: string }

export interface RenderedView {
  columns: number;
  /** Rows of cells; null is a blank slot. */
  rows: readonly (readonly (ViewCell | null)[])[];
  /** Extra header row for the day grid's weekday labels; empty otherwise. */
  headers: readonly string[];
  title: string;
  /** False in the years view — there is nothing above it. */
  titleActionable: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** 'd' | 'm' | 'y' — the cell id and data-attribute discriminator. */
  key: 'd' | 'm' | 'y';
  /** The value this view considers selected, for aria-selected. */
  selected: number;
}

export interface CalendarView {
  render(side: Side, state: ViewState, lang: Lang): RenderedView;
  /** Prev/next: a month, a year, or twelve years. Null at a range bound. */
  step(side: Side, state: ViewState, delta: -1 | 1): ViewState | null;
  /** What choosing `value` does: move to another view, or pick the date. */
  select(
    side: Side, state: ViewState, value: number,
  ): { state: ViewState; next: CalendarMode | 'pick' };
}

const DAY_COLUMNS = 7;
const PAGE_COLUMNS = 3;
/** Years page twelve at a time, so a year step and a page step differ by this. */
const PAGE_SIZE = 12;
const NO_HEADERS: readonly string[] = [];

function monthLength(side: Side, year: number, month: number): number {
  return side === 'persian'
    ? daysInPersianMonth(year, month)
    : daysInGregorianMonth(year, month);
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
  render(side, state, lang) {
    const model = buildMonthGrid(side, state.year, state.month, lang);
    return {
      columns: DAY_COLUMNS,
      rows: toRows(model.weeks, (day) => ({ value: day, label: toLocaleDigits(day, lang) })),
      headers: model.weekdayHeaders,
      title: model.title,
      titleActionable: true,
      canGoPrev: model.canGoPrev,
      canGoNext: model.canGoNext,
      key: 'd',
      selected: state.day,
    };
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
  render(side, state, lang) {
    const page = buildMonthPage(side, state.year, lang);
    return {
      columns: PAGE_COLUMNS,
      rows: toRows(page.cells, (month) => ({ value: month.value, label: month.label })),
      headers: NO_HEADERS,
      title: page.title,
      titleActionable: true,
      canGoPrev: page.canGoPrev,
      canGoNext: page.canGoNext,
      key: 'm',
      selected: state.month,
    };
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
  render(side, state, lang) {
    const page = buildYearPage(side, state.year, lang);
    return {
      columns: PAGE_COLUMNS,
      rows: toRows(page.cells, (year) => ({ value: year, label: toLocaleDigits(year, lang) })),
      headers: NO_HEADERS,
      title: page.title,
      titleActionable: false,
      canGoPrev: page.canGoPrev,
      canGoNext: page.canGoNext,
      key: 'y',
      selected: state.year,
    };
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

import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian,
} from '../calendar/persian';
import {
  GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN, type Side,
} from './converter-core';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, WEEKDAYS_SHORT, type Lang,
} from '../i18n/strings';

export interface MonthGrid {
  year: number;
  month: number;
  /** e.g. "Mordad 1405" / "مرداد ۱۴۰۵". */
  title: string;
  /** Seven labels in this calendar's week order. */
  weekdayHeaders: readonly string[];
  /** Rows of seven; null is a cell outside the month. */
  weeks: readonly (readonly (number | null)[])[];
  canGoPrev: boolean;
  canGoNext: boolean;
}

const DAYS_IN_WEEK = 7;

/**
 * Persian weeks start Saturday, Gregorian weeks start Monday. Both are
 * expressed as an offset applied to the JS getDay() index (0 = Sunday).
 */
const WEEK_START_OFFSET: Record<Side, number> = { persian: 1, gregorian: 6 };

function yearBounds(side: Side): readonly [number, number] {
  return side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
}

function monthLength(side: Side, year: number, month: number): number {
  return side === 'persian'
    ? daysInPersianMonth(year, month)
    : daysInGregorianMonth(year, month);
}

/** Column of the first of the month, in this calendar's week order. */
function firstColumn(side: Side, year: number, month: number): number {
  const g = side === 'persian'
    ? toGregorian({ py: year, pm: month, pd: 1 })
    : { gy: year, gm: month, gd: 1 };
  const weekday = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return (weekday + WEEK_START_OFFSET[side]) % DAYS_IN_WEEK;
}

export function stepMonth(
  side: Side, year: number, month: number, delta: number,
): { year: number; month: number } | null {
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const [min, max] = yearBounds(side);
  if (nextYear < min || nextYear > max) return null;
  return { year: nextYear, month: nextMonth };
}

export function buildMonthGrid(
  side: Side, year: number, month: number, lang: Lang,
): MonthGrid {
  const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  const short = WEEKDAYS_SHORT[lang];
  const offset = WEEK_START_OFFSET[side];
  const weekdayHeaders = Array.from({ length: DAYS_IN_WEEK }, (_, col) =>
    short[(col - offset + DAYS_IN_WEEK * 2) % DAYS_IN_WEEK] as string);

  const length = monthLength(side, year, month);
  const lead = firstColumn(side, year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);
  const weeks = Array.from(
    { length: cells.length / DAYS_IN_WEEK },
    (_, row) => cells.slice(row * DAYS_IN_WEEK, (row + 1) * DAYS_IN_WEEK),
  );

  return {
    year, month,
    title: `${names[month - 1] as string} ${toLocaleDigits(year, lang)}`,
    weekdayHeaders,
    weeks,
    canGoPrev: stepMonth(side, year, month, -1) !== null,
    canGoNext: stepMonth(side, year, month, 1) !== null,
  };
}

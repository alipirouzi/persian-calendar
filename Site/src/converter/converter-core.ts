import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian, toPersian,
  type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';

export type Side = 'persian' | 'gregorian';
export interface RawFields { y: string; m: string; d: string }

export const GREGORIAN_YEAR_MIN = 1822;
export const GREGORIAN_YEAR_MAX = 2121;

export type ConversionOutcome =
  | { status: 'ok'; persian: PersianDateParts; gregorian: GregorianDateParts }
  | { status: 'incomplete' }
  | { status: 'error'; errorKey: 'errYearRange' | 'errMonth' | 'errDay';
      params: Record<string, number>; side: Side };

function parseField(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function convertFrom(side: Side, fields: RawFields): ConversionOutcome {
  const y = parseField(fields.y);
  const m = parseField(fields.m);
  const d = parseField(fields.d);
  if (y === null || m === null || d === null) return { status: 'incomplete' };

  const [yearMin, yearMax] = side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  if (y < yearMin || y > yearMax) {
    return { status: 'error', errorKey: 'errYearRange', params: { min: yearMin, max: yearMax }, side };
  }
  if (m < 1 || m > 12) {
    return { status: 'error', errorKey: 'errMonth', params: {}, side };
  }
  const daysInMonth = side === 'persian' ? daysInPersianMonth(y, m) : daysInGregorianMonth(y, m);
  if (d < 1 || d > daysInMonth) {
    return { status: 'error', errorKey: 'errDay', params: { month: m, days: daysInMonth, year: y }, side };
  }

  if (side === 'persian') {
    const persian = { py: y, pm: m, pd: d };
    return { status: 'ok', persian, gregorian: toGregorian(persian) };
  }
  const gregorian = { gy: y, gm: m, gd: d };
  return { status: 'ok', persian: toPersian(gregorian), gregorian };
}

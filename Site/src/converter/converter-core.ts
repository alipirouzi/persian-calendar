import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian, toPersian,
  type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';

export type Side = 'persian' | 'gregorian';
export interface RawFields { y: string; m: string; d: string }

/**
 * Chosen so every Gregorian date the app accepts maps back inside the supported
 * Persian range: 1822-01-01 CE is 1200-10-11 AP and 2121-12-31 CE is
 * 1500-10-10 AP, both comfortably inside 1200–1500.
 *
 * The containment only holds in that direction. The two calendars' year
 * boundaries do not align — Persian years begin around 21 March — so no pair of
 * whole-year ranges is closed both ways: the Persian range's image runs from
 * 1821-03-21 to 2122-03-20 and spills past these bounds at both ends. Widening
 * this range to cover that image is a trap, because `toPersian` throws for
 * Gregorian dates before 1822-01-01, which is a crash rather than a message.
 * The spill is handled by the range check in `convertFrom` instead.
 */
export const GREGORIAN_YEAR_MIN = 1822;
export const GREGORIAN_YEAR_MAX = 2121;

export type ConversionOutcome =
  | { status: 'ok'; persian: PersianDateParts; gregorian: GregorianDateParts }
  | { status: 'incomplete' }
  | { status: 'error'; errorKey: 'errYearRange' | 'errMonth' | 'errDay' | 'errUnsupported';
      params: Record<string, number>; side: Side };

const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/** Map Persian-Indic (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII. */
export function normalizeDigits(raw: string): string {
  return raw.replace(/[۰-۹٠-٩]/g, (ch) => {
    const cp = ch.codePointAt(0) as number;
    return String(cp >= PERSIAN_ZERO ? cp - PERSIAN_ZERO : cp - ARABIC_ZERO);
  });
}

function parseField(raw: string): number | null {
  const cleaned = normalizeDigits(raw.trim());
  if (cleaned === '') return null;
  const n = Number(cleaned);
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

  // The counterpart may fall outside the other calendar's supported range even
  // though this side's date is valid — the year boundaries do not align. Report
  // that as a message. The try/catch makes convertFrom total: the calendar
  // functions throw RangeError, and this is called straight from an input
  // handler where an exception would take the page down.
  try {
    if (side === 'persian') {
      const persian = { py: y, pm: m, pd: d };
      const gregorian = toGregorian(persian);
      if (gregorian.gy < GREGORIAN_YEAR_MIN || gregorian.gy > GREGORIAN_YEAR_MAX) {
        return { status: 'error', errorKey: 'errUnsupported', params: {}, side };
      }
      return { status: 'ok', persian, gregorian };
    }
    const gregorian = { gy: y, gm: m, gd: d };
    const persian = toPersian(gregorian);
    if (persian.py < PERSIAN_YEAR_MIN || persian.py > PERSIAN_YEAR_MAX) {
      return { status: 'error', errorKey: 'errUnsupported', params: {}, side };
    }
    return { status: 'ok', persian, gregorian };
  } catch {
    return { status: 'error', errorKey: 'errUnsupported', params: {}, side };
  }
}

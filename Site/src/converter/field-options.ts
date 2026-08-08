import {
  daysInGregorianMonth, daysInPersianMonth,
  PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
  toGregorian,
  type GregorianDateParts,
} from '../calendar/persian';
import {
  GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN, normalizeDigits, type Side,
} from './converter-core';
import { weekdayName } from '../i18n/format';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, type Lang,
} from '../i18n/strings';

/**
 * One entry in a NumberPicker popup.
 *
 * `num` and `name` are kept apart rather than pre-joined into one string so the
 * popup can lay them out as two aligned columns — ragged numerals beside ragged
 * names read as noise at a glance. `name` is empty for the no-context day list.
 * `value` is always an ASCII integer.
 */
export interface FieldOption { value: number; num: string; name: string }

/** Longest month in either calendar — the length of the no-context fallback list. */
const MAX_DAYS = 31;

/**
 * Parse a raw field to an integer within [min, max], or null.
 *
 * Stricter than converter-core's `parseField`: an all-digits test rejects
 * `1.5` and `1e3`, which `Number()` would happily accept. Option lists must
 * never be built from a value the user did not type as a plain integer.
 */
export function parseInRange(raw: string, min: number, max: number): number | null {
  const cleaned = normalizeDigits(raw.trim());
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= min && n <= max ? n : null;
}

export function monthOptions(side: Side, lang: Lang): readonly FieldOption[] {
  const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  return names.map((name, i) => ({
    value: i + 1,
    num: toLocaleDigits(i + 1, lang),
    name,
  }));
}

/**
 * Day options for one side. With a usable year and month, every day of that
 * month is labelled with its weekday; otherwise a plain 1–31 list keeps the
 * popup useful without ever showing a weekday that would be wrong.
 */
export function dayOptions(
  side: Side, rawYear: string, rawMonth: string, lang: Lang,
): readonly FieldOption[] {
  const [yearMin, yearMax] = side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  const y = parseInRange(rawYear, yearMin, yearMax);
  const m = parseInRange(rawMonth, 1, 12);
  if (y === null || m === null) return plainDays(lang);

  const count = side === 'persian'
    ? daysInPersianMonth(y, m)
    : daysInGregorianMonth(y, m);
  return Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    const g: GregorianDateParts = side === 'persian'
      ? toGregorian({ py: y, pm: m, pd: d })
      : { gy: y, gm: m, gd: d };
    return { value: d, num: toLocaleDigits(d, lang), name: weekdayName(g, lang) };
  });
}

function plainDays(lang: Lang): readonly FieldOption[] {
  return Array.from({ length: MAX_DAYS }, (_, i) => ({
    value: i + 1,
    num: toLocaleDigits(i + 1, lang),
    name: '',
  }));
}

/**
 * Every supported year for one side. Numerals only: a year has no name, so the
 * popup renders these as a single column, like the no-context day list.
 */
export function yearOptions(side: Side, lang: Lang): readonly FieldOption[] {
  const [min, max] = side === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX]
    : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  return Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    num: toLocaleDigits(min + i, lang),
    name: '',
  }));
}

import type { GregorianDateParts } from '../calendar/persian';
import type { ByKey } from './holiday-keys';

export interface GregorianHoliday {
  readonly g: GregorianDateParts;
  readonly key: ByKey;
}

/** The anonymous Gregorian computus (Meeus/Jones/Butcher). */
export function easterSunday(gy: number): GregorianDateParts {
  const a = gy % 19;
  const b = Math.floor(gy / 100);
  const c = gy % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { gy, gm: month, gd: day };
}

const MS_PER_DAY = 86_400_000;

const plusDays = (g: GregorianDateParts, days: number): GregorianDateParts => {
  const date = new Date(Date.UTC(g.gy, g.gm - 1, g.gd) + days * MS_PER_DAY);
  return { gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() };
};

/**
 * Bavaria's public holidays as observed in Nuremberg: Assumption Day (15 August)
 * is a holiday only in Catholic-majority municipalities, and Nuremberg is not one.
 */
export function nurembergHolidays(gy: number): readonly GregorianHoliday[] {
  const easter = easterSunday(gy);
  const fixed = (gm: number, gd: number, key: ByKey): GregorianHoliday => ({ g: { gy, gm, gd }, key });
  const moving = (offset: number, key: ByKey): GregorianHoliday => ({ g: plusDays(easter, offset), key });
  return [
    fixed(1, 1, 'by.new-year'),
    fixed(1, 6, 'by.epiphany'),
    moving(-2, 'by.good-friday'),
    moving(1, 'by.easter-monday'),
    fixed(5, 1, 'by.labour'),
    moving(39, 'by.ascension'),
    moving(50, 'by.whit-monday'),
    moving(60, 'by.corpus-christi'),
    fixed(10, 3, 'by.unity'),
    fixed(11, 1, 'by.all-saints'),
    fixed(12, 25, 'by.christmas'),
    fixed(12, 26, 'by.boxing'),
  ];
}

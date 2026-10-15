import {
  daysInPersianMonth, PERSIAN_YEAR_MAX, toGregorian, type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import type { IrLunarKey } from './holiday-keys';
import type { PersianHoliday } from './rules-ir';

/** Hijri month and day of a Gregorian date, or null when the runtime cannot say. */
export type HijriOf = (g: GregorianDateParts) => { hm: number; hd: number } | null;

const SAFAR = 2;
const RABI_I = 3;

/** Hijri "month-day" → holiday. The last day of Safar is found separately. */
const RULES: Readonly<Record<string, IrLunarKey>> = {
  '1-9': 'ir.tasua', '1-10': 'ir.ashura', '2-20': 'ir.arbaeen', '2-28': 'ir.prophet',
  '3-8': 'ir.askari', '3-17': 'ir.mawlid', '6-3': 'ir.fatima', '7-13': 'ir.ali-birth',
  '7-27': 'ir.mabath', '8-15': 'ir.mahdi', '9-21': 'ir.ali-martyrdom', '10-1': 'ir.fitr',
  '10-2': 'ir.fitr', '10-25': 'ir.sadiq', '12-10': 'ir.adha', '12-18': 'ir.ghadir',
};

const UMALQURA = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', month: 'numeric', day: 'numeric',
});
const HAS_UMALQURA = UMALQURA.resolvedOptions().calendar === 'islamic-umalqura';

/**
 * `Intl` can format a date in the Umm al-Qura calendar but cannot convert back,
 * which is why the estimate walks the solar year a day at a time.
 */
export const umalquraHijri: HijriOf = (g) => {
  // Node always ships this calendar, so the fallback cannot be reached in tests.
  /* v8 ignore next */
  if (!HAS_UMALQURA) return null;
  const parts = UMALQURA.formatToParts(new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12)));
  const value = (type: 'month' | 'day'): number => Number(parts.find((x) => x.type === type)?.value);
  return { hm: value('month'), hd: value('day') };
};

function daysOf(py: number): PersianDateParts[] {
  const days: PersianDateParts[] = [];
  for (let pm = 1; pm <= 12; pm += 1) {
    for (let pd = 1; pd <= daysInPersianMonth(py, pm); pd += 1) days.push({ py, pm, pd });
  }
  return days;
}

function compute(py: number, hijri: HijriOf): readonly PersianHoliday[] {
  // One day past the year's end, so the year's last day can be checked for "last day of Safar".
  // The last supported year has no next day to convert: its final day is simply left unmarked.
  const year = daysOf(py);
  const days = py < PERSIAN_YEAR_MAX ? [...year, { py: py + 1, pm: 1, pd: 1 }] : year;
  const dates = days.map((p) => hijri(toGregorian(p)));
  const holidays: PersianHoliday[] = [];
  for (let i = 0; i < year.length; i += 1) {
    const h = dates[i];
    if (!h) continue;
    const key = RULES[`${h.hm}-${h.hd}`];
    if (key) holidays.push({ p: days[i]!, key });
    if (h.hm === SAFAR && dates[i + 1]?.hm === RABI_I) holidays.push({ p: days[i]!, key: 'ir.reza' });
  }
  return holidays;
}

const memo = new Map<number, readonly PersianHoliday[]>();

/**
 * Iranian lunar holidays for a Persian year, estimated with the Umm al-Qura
 * calendar. Iran fixes them by moon sighting, which can differ by a day either way.
 */
export function estimateIrLunar(py: number, hijri: HijriOf = umalquraHijri): readonly PersianHoliday[] {
  if (hijri !== umalquraHijri) return compute(py, hijri);
  let cached = memo.get(py);
  if (!cached) {
    cached = compute(py, hijri);
    memo.set(py, cached);
  }
  return cached;
}

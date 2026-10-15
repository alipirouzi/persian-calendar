// Site/src/holidays/merge.ts
import {
  daysInGregorianMonth, daysInPersianMonth, toGregorian, toPersian,
  type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import type { Side } from '../converter/converter-core';
import type { HolidaySource, UserHoliday } from '../settings/settings-model';
import type { OfficialFile } from './holiday-data';
import type { HolidayKey } from './holiday-keys';
import { estimateIrLunar } from './lunar-estimate';
import { nurembergHolidays } from './rules-by';
import { irSolarHolidays, type PersianHoliday } from './rules-ir';

export type DayHoliday =
  | { readonly source: 'ir' | 'nuremberg'; readonly key: HolidayKey; readonly estimated: boolean }
  | { readonly source: 'user'; readonly id: string; readonly name: string; readonly estimated: false };

export type MonthHolidays = ReadonlyMap<number, readonly DayHoliday[]>;

export interface MergeInput {
  readonly sources: readonly HolidaySource[];
  readonly user: readonly UserHoliday[];
  readonly official: (py: number) => OfficialFile | null;
  readonly estimate?: (py: number) => readonly PersianHoliday[];
}

interface Day { readonly p: PersianDateParts; readonly g: GregorianDateParts }

const pKey = (p: PersianDateParts): string => `${p.py}-${p.pm}-${p.pd}`;
const gKey = (g: GregorianDateParts): string => `${g.gy}-${g.gm}-${g.gd}`;

function daysOfMonth(side: Side, year: number, month: number): Day[] {
  if (side === 'persian') {
    return Array.from({ length: daysInPersianMonth(year, month) }, (_, i) => {
      const p = { py: year, pm: month, pd: i + 1 };
      return { p, g: toGregorian(p) };
    });
  }
  return Array.from({ length: daysInGregorianMonth(year, month) }, (_, i) => {
    const g = { gy: year, gm: month, gd: i + 1 };
    return { p: toPersian(g), g };
  });
}

const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

function iranByDay(years: ReadonlySet<number>, input: MergeInput): Map<string, DayHoliday[]> {
  const byDay = new Map<string, DayHoliday[]>();
  const estimate = input.estimate ?? estimateIrLunar;
  for (const py of years) {
    for (const h of irSolarHolidays(py)) push(byDay, pKey(h.p), { source: 'ir', key: h.key, estimated: false });
    const file = input.official(py);
    const lunar = file ? file.holidays : estimate(py);
    for (const h of lunar) push(byDay, pKey(h.p), { source: 'ir', key: h.key, estimated: file === null });
  }
  return byDay;
}

function nurembergByDay(years: ReadonlySet<number>): Map<string, DayHoliday[]> {
  const byDay = new Map<string, DayHoliday[]>();
  for (const gy of years) {
    for (const h of nurembergHolidays(gy)) push(byDay, gKey(h.g), { source: 'nuremberg', key: h.key, estimated: false });
  }
  return byDay;
}

const userMatches = (u: UserHoliday, day: Day): boolean => {
  const [y, m, d] = u.calendar === 'persian' ? [day.p.py, day.p.pm, day.p.pd] : [day.g.gy, day.g.gm, day.g.gd];
  return u.month === m && u.day === d && (u.year === undefined || u.year === y);
};

/** Every holiday on each day of one displayed month, whichever calendar shows it. */
export function holidaysForMonth(side: Side, year: number, month: number, input: MergeInput): MonthHolidays {
  const days = daysOfMonth(side, year, month);
  const on = (source: HolidaySource): boolean => input.sources.includes(source);
  const iran = on('ir') ? iranByDay(new Set(days.map((d) => d.p.py)), input) : new Map<string, DayHoliday[]>();
  const nuremberg = on('nuremberg') ? nurembergByDay(new Set(days.map((d) => d.g.gy))) : new Map<string, DayHoliday[]>();
  const user = on('user') ? input.user : [];
  const result = new Map<number, readonly DayHoliday[]>();
  days.forEach((day, index) => {
    const list: DayHoliday[] = [
      ...(iran.get(pKey(day.p)) ?? []),
      ...(nuremberg.get(gKey(day.g)) ?? []),
      ...user.filter((u) => userMatches(u, day))
        .map((u): DayHoliday => ({ source: 'user', id: u.id, name: u.name, estimated: false })),
    ];
    if (list.length > 0) result.set(index + 1, list);
  });
  return result;
}

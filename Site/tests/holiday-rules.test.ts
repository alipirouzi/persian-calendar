import { describe, expect, it } from 'vitest';
import EASTER from './fixtures/easter-2000-2100.json';
import {
  ALL_HOLIDAY_KEYS, BY_KEYS, IR_LUNAR_KEYS, IR_SOLAR_KEYS, isIrLunarKey,
} from '../src/holidays/holiday-keys';
import { irSolarHolidays } from '../src/holidays/rules-ir';
import { easterSunday, nurembergHolidays } from '../src/holidays/rules-by';

const iso = (g: { gy: number; gm: number; gd: number }): string =>
  `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;

describe('holiday keys', () => {
  it('lists every key once, in three disjoint groups', () => {
    expect(new Set(ALL_HOLIDAY_KEYS).size).toBe(ALL_HOLIDAY_KEYS.length);
    expect(ALL_HOLIDAY_KEYS.length).toBe(IR_SOLAR_KEYS.length + IR_LUNAR_KEYS.length + BY_KEYS.length);
    expect(IR_LUNAR_KEYS).toHaveLength(16);
  });

  it('recognises lunar keys only', () => {
    expect(isIrLunarKey('ir.ashura')).toBe(true);
    for (const value of ['ir.nowruz', 'by.christmas', 'nope', 3, null]) expect(isIrLunarKey(value)).toBe(false);
  });
});

describe('irSolarHolidays', () => {
  it('gives the fixed Iranian holidays of a year, Nowruz as four days', () => {
    const days = irSolarHolidays(1405).map((h) => `${h.p.pm}-${h.p.pd} ${h.key}`);
    expect(days).toEqual([
      '1-1 ir.nowruz', '1-2 ir.nowruz', '1-3 ir.nowruz', '1-4 ir.nowruz',
      '1-12 ir.republic', '1-13 ir.nature', '3-14 ir.khomeini', '3-15 ir.uprising',
      '11-22 ir.revolution', '12-29 ir.oil',
    ]);
    expect(irSolarHolidays(1405).every((h) => h.p.py === 1405)).toBe(true);
  });
});

describe('easterSunday', () => {
  it('matches an independently computed table for every year 2000–2100', () => {
    for (const [year, expected] of Object.entries(EASTER)) {
      expect(iso(easterSunday(Number(year))), year).toBe(expected);
    }
  });
});

describe('nurembergHolidays', () => {
  it('gives the twelve public holidays of 2026 in date order, without Assumption Day', () => {
    expect(nurembergHolidays(2026).map((h) => `${iso(h.g)} ${h.key}`)).toEqual([
      '2026-01-01 by.new-year', '2026-01-06 by.epiphany', '2026-04-03 by.good-friday',
      '2026-04-06 by.easter-monday', '2026-05-01 by.labour', '2026-05-14 by.ascension',
      '2026-05-25 by.whit-monday', '2026-06-04 by.corpus-christi', '2026-10-03 by.unity',
      '2026-11-01 by.all-saints', '2026-12-25 by.christmas', '2026-12-26 by.boxing',
    ]);
  });

  it('moves the Easter-based days across a month boundary correctly', () => {
    // Easter 2038 is 25 April: Ascension 3 June, Whit Monday 14 June, Corpus Christi 24 June.
    const byKey = new Map(nurembergHolidays(2038).map((h) => [h.key, iso(h.g)]));
    expect(byKey.get('by.good-friday')).toBe('2038-04-23');
    expect(byKey.get('by.ascension')).toBe('2038-06-03');
    expect(byKey.get('by.whit-monday')).toBe('2038-06-14');
    expect(byKey.get('by.corpus-christi')).toBe('2038-06-24');
  });
});

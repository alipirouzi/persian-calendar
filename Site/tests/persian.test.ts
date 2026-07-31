import { describe, expect, it } from 'vitest';
import {
  daysInGregorianMonth, daysInPersianMonth, isLeapPersianYear,
  persianDayOfYear, toGregorian, toPersian,
} from '../src/calendar/persian';

// Known pairs: first two verified against the deployed .NET app itself.
const PAIRS: Array<[number, number, number, number, number, number]> = [
  [1403, 10, 22, 2025, 1, 11],
  [1405, 5, 9, 2026, 7, 31],
  [1404, 1, 1, 2025, 3, 21],
  [1403, 12, 30, 2025, 3, 20], // leap day of leap year 1403
  [1357, 11, 22, 1979, 2, 11],
];

describe('toGregorian', () => {
  it.each(PAIRS)('%i/%i/%i → %i-%i-%i', (py, pm, pd, gy, gm, gd) => {
    expect(toGregorian({ py, pm, pd })).toEqual({ gy, gm, gd });
  });
  it('rejects years outside the supported range', () => {
    expect(() => toGregorian({ py: 1199, pm: 1, pd: 1 })).toThrow(RangeError);
    expect(() => toGregorian({ py: 1501, pm: 1, pd: 1 })).toThrow(RangeError);
  });
  it('rejects invalid month and day', () => {
    expect(() => toGregorian({ py: 1404, pm: 13, pd: 1 })).toThrow(RangeError);
    expect(() => toGregorian({ py: 1404, pm: 12, pd: 30 })).toThrow(RangeError); // 1404 not leap
  });
});

describe('toPersian', () => {
  it.each(PAIRS)('%i/%i/%i ← %i-%i-%i', (py, pm, pd, gy, gm, gd) => {
    expect(toPersian({ gy, gm, gd })).toEqual({ py, pm, pd });
  });
  it('rejects dates converting outside the supported Persian range', () => {
    expect(() => toPersian({ gy: 1820, gm: 1, gd: 1 })).toThrow(RangeError);
    expect(() => toPersian({ gy: 2300, gm: 1, gd: 1 })).toThrow(RangeError);
  });
});

describe('leap years and month lengths', () => {
  it('knows recent leap years', () => {
    expect(isLeapPersianYear(1403)).toBe(true);
    expect(isLeapPersianYear(1404)).toBe(false);
    expect(isLeapPersianYear(1405)).toBe(false);
    expect(isLeapPersianYear(1408)).toBe(true);
  });
  it('month lengths', () => {
    expect(daysInPersianMonth(1404, 1)).toBe(31);
    expect(daysInPersianMonth(1404, 7)).toBe(30);
    expect(daysInPersianMonth(1404, 12)).toBe(29);
    expect(daysInPersianMonth(1403, 12)).toBe(30);
    expect(daysInGregorianMonth(2024, 2)).toBe(29);
    expect(daysInGregorianMonth(2025, 2)).toBe(28);
  });
});

describe('persianDayOfYear', () => {
  it('maps correctly', () => {
    expect(persianDayOfYear({ py: 1404, pm: 1, pd: 1 })).toBe(1);
    expect(persianDayOfYear({ py: 1404, pm: 7, pd: 1 })).toBe(187);
    expect(persianDayOfYear({ py: 1404, pm: 12, pd: 29 })).toBe(365);
    expect(persianDayOfYear({ py: 1403, pm: 12, pd: 30 })).toBe(366);
  });
});

describe('round-trip', () => {
  it('every day of 1200–1500 survives P→G→P', () => {
    for (let py = 1200; py <= 1500; py += 1) {
      for (let pm = 1; pm <= 12; pm += 1) {
        const days = daysInPersianMonth(py, pm);
        for (let pd = 1; pd <= days; pd += 1) {
          expect(toPersian(toGregorian({ py, pm, pd }))).toEqual({ py, pm, pd });
        }
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildMonthGrid, stepMonth } from '../src/converter/calendar-grid-model';

describe('weekday headers', () => {
  it('starts Persian weeks on Saturday', () => {
    expect(buildMonthGrid('persian', 1403, 10, 'en').weekdayHeaders)
      .toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(buildMonthGrid('persian', 1403, 10, 'fa').weekdayHeaders)
      .toEqual(['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']);
  });
  it('starts Gregorian weeks on Monday', () => {
    expect(buildMonthGrid('gregorian', 2025, 1, 'en').weekdayHeaders)
      .toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('grid layout', () => {
  it('places Dey 1403 day 1 in the Saturday column', () => {
    // 1403-10-01 is 2024-12-21, a Saturday → column 0 in a Saturday-first week.
    const grid = buildMonthGrid('persian', 1403, 10, 'en');
    expect(grid.weeks[0]?.[0]).toBe(1);
    expect(grid.weeks[0]?.[6]).toBe(7);
    // 1403-10-22 is also a Saturday, so it starts a row.
    expect(grid.weeks[3]?.[0]).toBe(22);
  });
  it('pads the leading blanks and never the trailing row beyond the month', () => {
    const grid = buildMonthGrid('gregorian', 2025, 1, 'en');
    // 2025-01-01 is a Wednesday → column 2 in a Monday-first week.
    expect(grid.weeks[0]?.slice(0, 3)).toEqual([null, null, 1]);
    const flat = grid.weeks.flat().filter((d) => d !== null);
    expect(flat).toHaveLength(31);
    expect(flat[0]).toBe(1);
    expect(flat[30]).toBe(31);
  });
  it('uses the real month length, leap years included', () => {
    const count = (s: 'persian' | 'gregorian', y: number, m: number): number =>
      buildMonthGrid(s, y, m, 'en').weeks.flat().filter((d) => d !== null).length;
    expect(count('persian', 1403, 12)).toBe(30); // leap
    expect(count('persian', 1404, 12)).toBe(29); // common
    expect(count('gregorian', 2024, 2)).toBe(29);
    expect(count('gregorian', 2025, 2)).toBe(28);
  });
  it('every row has exactly seven cells', () => {
    for (const [s, y, m] of [['persian', 1403, 1], ['gregorian', 2025, 2]] as const) {
      for (const week of buildMonthGrid(s, y, m, 'en').weeks) {
        expect(week).toHaveLength(7);
      }
    }
  });
  it('titles the month in the current language', () => {
    expect(buildMonthGrid('persian', 1405, 5, 'en').title).toBe('Mordad 1405');
    expect(buildMonthGrid('persian', 1405, 5, 'fa').title).toBe('مرداد ۱۴۰۵');
    expect(buildMonthGrid('gregorian', 2026, 8, 'en').title).toBe('August 2026');
  });
});

describe('stepMonth', () => {
  it('rolls over year boundaries', () => {
    expect(stepMonth('persian', 1403, 12, 1)).toEqual({ year: 1404, month: 1 });
    expect(stepMonth('persian', 1403, 1, -1)).toEqual({ year: 1402, month: 12 });
    expect(stepMonth('gregorian', 2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });
  it('returns null at the supported range bounds', () => {
    expect(stepMonth('persian', 1200, 1, -1)).toBeNull();
    expect(stepMonth('persian', 1500, 12, 1)).toBeNull();
    expect(stepMonth('gregorian', 1822, 1, -1)).toBeNull();
    expect(stepMonth('gregorian', 2121, 12, 1)).toBeNull();
  });
  it('feeds canGoPrev and canGoNext', () => {
    expect(buildMonthGrid('persian', 1200, 1, 'en').canGoPrev).toBe(false);
    expect(buildMonthGrid('persian', 1200, 1, 'en').canGoNext).toBe(true);
    expect(buildMonthGrid('persian', 1500, 12, 'en').canGoNext).toBe(false);
  });
});

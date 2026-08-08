import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid, buildMonthPage, buildYearPage,
  stepMonth, stepYear, stepYearPage, yearPageStart,
} from '../src/converter/calendar-grid-model';

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

describe('year pages', () => {
  it('aligns pages to the start of the supported range', () => {
    expect(yearPageStart('persian', 1200)).toBe(1200);
    expect(yearPageStart('persian', 1211)).toBe(1200);
    expect(yearPageStart('persian', 1212)).toBe(1212);
    expect(yearPageStart('persian', 1403)).toBe(1392);
  });
  it('lays 12 years out in 4 rows of 3', () => {
    const page = buildYearPage('persian', 1403, 'en');
    expect(page.cells).toHaveLength(4);
    for (const row of page.cells) expect(row).toHaveLength(3);
    expect(page.cells.flat()).toEqual([
      1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403,
    ]);
    expect(page.title).toBe('1392 – 1403');
  });
  it('pads the final short page with nulls', () => {
    const page = buildYearPage('persian', 1500, 'en');
    expect(page.cells.flat().filter((y) => y !== null)).toEqual([1500]);
    expect(page.title).toBe('1500 – 1500');
    expect(page.canGoNext).toBe(false);
    expect(page.canGoPrev).toBe(true);
  });
  it('localizes the range title', () => {
    expect(buildYearPage('persian', 1403, 'fa').title).toBe('۱۳۹۲ – ۱۴۰۳');
  });
  it('stops paging at the range bounds', () => {
    expect(stepYearPage('persian', 1200, -1)).toBeNull();
    expect(stepYearPage('persian', 1200, 1)).toBe(1212);
    expect(buildYearPage('persian', 1200, 'en').canGoPrev).toBe(false);
    expect(buildYearPage('gregorian', 1822, 'en').canGoPrev).toBe(false);
  });
});

describe('month pages', () => {
  it('lays 12 months out in 4 rows of 3 with localized names', () => {
    const page = buildMonthPage('persian', 1403, 'en');
    expect(page.cells).toHaveLength(4);
    expect(page.cells.flat()[0]).toEqual({ value: 1, label: 'Farvardin' });
    expect(page.cells.flat()[11]).toEqual({ value: 12, label: 'Esfand' });
    expect(page.title).toBe('1403');
  });
  it('uses the other calendar and language', () => {
    const page = buildMonthPage('gregorian', 2026, 'fa');
    expect(page.cells.flat()[7]).toEqual({ value: 8, label: 'اوت' });
    expect(page.title).toBe('۲۰۲۶');
  });
  it('steps years within the range', () => {
    expect(stepYear('persian', 1403, 1)).toBe(1404);
    expect(stepYear('persian', 1500, 1)).toBeNull();
    expect(stepYear('gregorian', 1822, -1)).toBeNull();
    expect(buildMonthPage('persian', 1500, 'en').canGoNext).toBe(false);
  });
});

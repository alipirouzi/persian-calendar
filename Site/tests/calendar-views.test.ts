import { describe, expect, it } from 'vitest';
import {
  CALENDAR_VIEWS, type CalendarMode, type ViewState,
} from '../src/converter/calendar-views';

const at = (year: number, month: number, day: number): ViewState => ({ year, month, day });

const days = CALENDAR_VIEWS.days;
const months = CALENDAR_VIEWS.months;
const years = CALENDAR_VIEWS.years;

describe('the view registry', () => {
  it('holds one strategy per mode', () => {
    const modes: readonly CalendarMode[] = ['days', 'months', 'years'];
    for (const mode of modes) expect(CALENDAR_VIEWS[mode]).toBeDefined();
  });
});

describe('the days view', () => {
  it('renders a seven-column month with weekday headers', () => {
    const view = days.render('persian', at(1403, 10, 22), 'en');
    expect(view.columns).toBe(7);
    expect(view.headers).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(view.title).toBe('Dey 1403');
    expect(view.titleActionable).toBe(true);
    expect(view.key).toBe('d');
    expect(view.selected).toBe(22);
    expect(view.canGoPrev).toBe(true);
    expect(view.canGoNext).toBe(true);
    // 1403-10-01 is a Saturday, so the month opens the first row with no blanks.
    expect(view.rows[0]?.[0]).toEqual({ value: 1, label: '1' });
    expect(view.rows.flat().filter((cell) => cell !== null)).toHaveLength(30);
  });
  it('keeps the model\'s blank slots and localizes the numerals', () => {
    const view = days.render('gregorian', at(2025, 1, 1), 'fa');
    // 2025-01-01 is a Wednesday: two blanks lead a Monday-first week.
    expect(view.rows[0]?.slice(0, 3)).toEqual([null, null, { value: 1, label: '۱' }]);
    expect(view.title).toBe('ژانویه ۲۰۲۵');
  });
  it('steps by a whole month', () => {
    expect(days.step('persian', at(1403, 10, 5), 1)).toEqual(at(1403, 11, 5));
    expect(days.step('persian', at(1403, 1, 5), -1)).toEqual(at(1402, 12, 5));
  });
  it('clamps the day when the next month is shorter', () => {
    // Shahrivar has 31 days, Mehr 30: the cursor cannot survive the step intact.
    expect(days.step('persian', at(1403, 6, 31), 1)).toEqual(at(1403, 7, 30));
    expect(days.step('gregorian', at(2025, 3, 31), -1)).toEqual(at(2025, 2, 28));
  });
  it('refuses to step past a range bound', () => {
    expect(days.step('persian', at(1200, 1, 1), -1)).toBeNull();
    expect(days.step('gregorian', at(2121, 12, 1), 1)).toBeNull();
  });
  it('picks the day it is given, without clamping', () => {
    expect(days.select('persian', at(1403, 10, 22), 3))
      .toEqual({ state: at(1403, 10, 3), next: 'pick' });
    // The value comes from a rendered cell, so the view takes it as given rather
    // than second-guessing it against a month length.
    expect(days.select('persian', at(1404, 12, 1), 31).state).toEqual(at(1404, 12, 31));
  });
});

describe('the months view', () => {
  it('renders twelve named months in three columns', () => {
    const view = months.render('persian', at(1403, 10, 22), 'en');
    expect(view.columns).toBe(3);
    expect(view.headers).toEqual([]);
    expect(view.rows).toHaveLength(4);
    for (const row of view.rows) expect(row).toHaveLength(3);
    expect(view.rows[0]?.[0]).toEqual({ value: 1, label: 'Farvardin' });
    expect(view.rows[3]?.[2]).toEqual({ value: 12, label: 'Esfand' });
    expect(view.title).toBe('1403');
    expect(view.titleActionable).toBe(true);
    expect(view.key).toBe('m');
    expect(view.selected).toBe(10);
  });
  it('uses the other calendar and language', () => {
    const view = months.render('gregorian', at(2026, 8, 1), 'fa');
    expect(view.rows[2]?.[1]).toEqual({ value: 8, label: 'اوت' });
    expect(view.title).toBe('۲۰۲۶');
  });
  it('steps by a whole year, keeping the month and day', () => {
    expect(months.step('persian', at(1403, 10, 22), 1)).toEqual(at(1404, 10, 22));
    expect(months.step('gregorian', at(2026, 8, 3), -1)).toEqual(at(2025, 8, 3));
  });
  it('refuses to step past a range bound', () => {
    expect(months.step('persian', at(1500, 1, 1), 1)).toBeNull();
    expect(months.step('gregorian', at(1822, 1, 1), -1)).toBeNull();
  });
  it('drills into the days of the chosen month', () => {
    expect(months.select('persian', at(1403, 10, 22), 5))
      .toEqual({ state: at(1403, 5, 22), next: 'days' });
  });
  it('clamps the day into the chosen month', () => {
    // Esfand 1404 has 29 days, Esfand 1403 has 30: day 31 survives neither.
    expect(months.select('persian', at(1404, 1, 31), 12).state).toEqual(at(1404, 12, 29));
    expect(months.select('persian', at(1403, 1, 31), 12).state).toEqual(at(1403, 12, 30));
    expect(months.select('gregorian', at(2025, 1, 31), 2).state).toEqual(at(2025, 2, 28));
  });
});

describe('the years view', () => {
  it('renders a twelve-year page in three columns', () => {
    const view = years.render('persian', at(1403, 10, 22), 'en');
    expect(view.columns).toBe(3);
    expect(view.headers).toEqual([]);
    expect(view.rows).toHaveLength(4);
    expect(view.rows.flat()).toEqual(
      [1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403]
        .map((value) => ({ value, label: String(value) })),
    );
    expect(view.title).toBe('1392 – 1403');
    // There is nothing above the years, so the title has nowhere left to go.
    expect(view.titleActionable).toBe(false);
    expect(view.key).toBe('y');
    expect(view.selected).toBe(1403);
    expect(view.canGoPrev).toBe(true);
    expect(view.canGoNext).toBe(true);
  });
  it('pads the last short page and localizes its labels', () => {
    const view = years.render('persian', at(1500, 1, 1), 'fa');
    expect(view.rows[0]?.[0]).toEqual({ value: 1500, label: '۱۵۰۰' });
    expect(view.rows[0]?.[1]).toBeNull();
    expect(view.title).toBe('۱۵۰۰ – ۱۵۰۰');
    expect(view.canGoNext).toBe(false);
  });
  it('steps a whole page, keeping the year in the same slot', () => {
    expect(years.step('persian', at(1403, 10, 22), 1)).toEqual(at(1415, 10, 22));
    expect(years.step('persian', at(1403, 10, 22), -1)).toEqual(at(1391, 10, 22));
  });
  it('falls back to the page start when the slot is past the range', () => {
    // 1493 sits eleventh on the 1488 page; the 1500 page holds only 1500.
    expect(years.step('persian', at(1493, 10, 22), 1)).toEqual(at(1500, 10, 22));
  });
  it('refuses to step past a range bound', () => {
    expect(years.step('persian', at(1200, 1, 1), -1)).toBeNull();
    expect(years.step('gregorian', at(2121, 1, 1), 1)).toBeNull();
  });
  it('drills into the months of the chosen year', () => {
    expect(years.select('persian', at(1403, 10, 22), 1400))
      .toEqual({ state: at(1400, 10, 22), next: 'months' });
  });
});

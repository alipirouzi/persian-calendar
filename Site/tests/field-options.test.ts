import { describe, expect, it } from 'vitest';
import { dayOptions, monthOptions, parseInRange, yearOptions } from '../src/converter/field-options';

describe('parseInRange', () => {
  it('accepts in-range ASCII, Persian, and Arabic digits', () => {
    expect(parseInRange('5', 1, 12)).toBe(5);
    expect(parseInRange('۵', 1, 12)).toBe(5);
    expect(parseInRange('٥', 1, 12)).toBe(5);
    expect(parseInRange(' 12 ', 1, 12)).toBe(12);
    expect(parseInRange('05', 1, 12)).toBe(5);
  });
  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parseInRange('', 1, 12)).toBeNull();
    expect(parseInRange('abc', 1, 12)).toBeNull();
    expect(parseInRange('1.5', 1, 12)).toBeNull();
    expect(parseInRange('1e3', 1, 12)).toBeNull();
    expect(parseInRange('-1', 1, 12)).toBeNull();
    expect(parseInRange('0', 1, 12)).toBeNull();
    expect(parseInRange('13', 1, 12)).toBeNull();
  });
});

describe('monthOptions', () => {
  it('labels Persian months with number and name', () => {
    const en = monthOptions('persian', 'en');
    expect(en).toHaveLength(12);
    expect(en[4]).toEqual({ value: 5, num: '5', name: 'Mordad' });
    expect(en[11]).toEqual({ value: 12, num: '12', name: 'Esfand' });
  });
  it('localizes digits and names in Persian', () => {
    expect(monthOptions('persian', 'fa')[4]).toEqual({ value: 5, num: '۵', name: 'مرداد' });
  });
  it('labels Gregorian months', () => {
    expect(monthOptions('gregorian', 'en')[7]).toEqual({ value: 8, num: '8', name: 'August' });
    expect(monthOptions('gregorian', 'fa')[7]).toEqual({ value: 8, num: '۸', name: 'اوت' });
  });
});

describe('dayOptions — valid year and month', () => {
  it('uses the real month length', () => {
    expect(dayOptions('persian', '1403', '1', 'en')).toHaveLength(31);  // Farvardin
    expect(dayOptions('persian', '1403', '10', 'en')).toHaveLength(30); // Dey
    expect(dayOptions('persian', '1403', '12', 'en')).toHaveLength(30); // Esfand, leap
    expect(dayOptions('persian', '1404', '12', 'en')).toHaveLength(29); // Esfand, common
    expect(dayOptions('gregorian', '2024', '2', 'en')).toHaveLength(29);
    expect(dayOptions('gregorian', '2025', '2', 'en')).toHaveLength(28);
  });
  it('labels each Persian day with its weekday', () => {
    const options = dayOptions('persian', '1403', '10', 'en');
    // 1403-10-01 → 2024-12-21 (Saturday); 1403-10-22 → 2025-01-11 (Saturday).
    expect(options[0]).toEqual({ value: 1, num: '1', name: 'Saturday' });
    expect(options[21]).toEqual({ value: 22, num: '22', name: 'Saturday' });
    expect(options[22]).toEqual({ value: 23, num: '23', name: 'Sunday' });
  });
  it('labels each Gregorian day with its weekday', () => {
    const options = dayOptions('gregorian', '2025', '1', 'en');
    expect(options[10]).toEqual({ value: 11, num: '11', name: 'Saturday' });
  });
  it('localizes digits and weekday names in Persian', () => {
    const options = dayOptions('persian', '1403', '10', 'fa');
    expect(options[21]).toEqual({ value: 22, num: '۲۲', name: 'شنبه' });
  });
  it('treats non-ASCII digit input the same as ASCII', () => {
    expect(dayOptions('persian', '۱۴۰۳', '۱۰', 'en'))
      .toEqual(dayOptions('persian', '1403', '10', 'en'));
  });
});

describe('dayOptions — fallback', () => {
  it('returns 31 plain options when the year or month is unusable', () => {
    for (const [y, m] of [['', ''], ['1403', ''], ['', '10'], ['abc', '10'],
      ['1403', '13'], ['1403', '0'], ['1199', '10'], ['1501', '10']] as const) {
      const options = dayOptions('persian', y, m, 'en');
      expect(options, `year="${y}" month="${m}"`).toHaveLength(31);
      expect(options[0], `year="${y}" month="${m}"`).toEqual({ value: 1, num: '1', name: '' });
      expect(options[30], `year="${y}" month="${m}"`).toEqual({ value: 31, num: '31', name: '' });
    }
  });
  it('respects the Gregorian year range in the fallback', () => {
    expect(dayOptions('gregorian', '1820', '1', 'en')).toHaveLength(31);
    expect(dayOptions('gregorian', '2123', '1', 'en')).toHaveLength(31);
    expect(dayOptions('gregorian', '1822', '2', 'en')).toHaveLength(28);
  });
  it('localizes fallback digits', () => {
    expect(dayOptions('persian', '', '', 'fa')[21]).toEqual({ value: 22, num: '۲۲', name: '' });
  });
});

describe('yearOptions', () => {
  it('covers the Persian supported range', () => {
    const opts = yearOptions('persian', 'en');
    expect(opts).toHaveLength(301);
    expect(opts[0]).toEqual({ value: 1200, num: '1200', name: '' });
    expect(opts[300]).toEqual({ value: 1500, num: '1500', name: '' });
  });
  it('covers the Gregorian supported range', () => {
    const opts = yearOptions('gregorian', 'en');
    expect(opts).toHaveLength(300);
    expect(opts[0]).toEqual({ value: 1822, num: '1822', name: '' });
    expect(opts[299]).toEqual({ value: 2121, num: '2121', name: '' });
  });
  it('localizes the numerals and carries no name', () => {
    const opts = yearOptions('persian', 'fa');
    expect(opts[205]).toEqual({ value: 1405, num: '۱۴۰۵', name: '' });
    expect(opts.every((o) => o.name === '')).toBe(true);
  });
});

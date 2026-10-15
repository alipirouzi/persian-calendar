import { describe, expect, it } from 'vitest';
import {
  formatTemplate, GREGORIAN_MONTHS, HOLIDAY_NAMES, PERSIAN_MONTHS, STRINGS, toLocaleDigits,
} from '../src/i18n/strings';
import { ALL_HOLIDAY_KEYS } from '../src/holidays/holiday-keys';

describe('i18n', () => {
  it('month tables are complete', () => {
    expect(PERSIAN_MONTHS.en).toHaveLength(12);
    expect(PERSIAN_MONTHS.fa).toHaveLength(12);
    expect(GREGORIAN_MONTHS.en).toHaveLength(12);
    expect(GREGORIAN_MONTHS.fa).toHaveLength(12);
    expect(PERSIAN_MONTHS.fa[4]).toBe('مرداد');
    expect(PERSIAN_MONTHS.en[0]).toBe('Farvardin');
  });
  it('both languages define the same string keys', () => {
    expect(Object.keys(STRINGS.fa).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('converts digits for fa, leaves en unchanged', () => {
    expect(toLocaleDigits(1403, 'fa')).toBe('۱۴۰۳');
    expect(toLocaleDigits('12:30:05', 'fa')).toBe('۱۲:۳۰:۰۵');
    expect(toLocaleDigits(1403, 'en')).toBe('1403');
  });
  it('formatTemplate substitutes and localizes params', () => {
    expect(formatTemplate('{month} has {days} days', { month: 'Esfand', days: 29 }, 'en'))
      .toBe('Esfand has 29 days');
    expect(formatTemplate('{days} روز', { days: 29 }, 'fa')).toBe('۲۹ روز');
  });
  it('leaves a placeholder nobody supplied standing', () => {
    // Better a visible {days} than a sentence that silently lost its number.
    expect(formatTemplate('{month} has {days} days', { month: 'Esfand' }, 'en'))
      .toBe('Esfand has {days} days');
  });
  it('names every holiday in both languages', () => {
    for (const lang of ['en', 'fa'] as const) {
      expect(Object.keys(HOLIDAY_NAMES[lang]).sort()).toEqual([...ALL_HOLIDAY_KEYS].sort());
      for (const key of ALL_HOLIDAY_KEYS) expect(HOLIDAY_NAMES[lang][key].trim(), `${lang} ${key}`).not.toBe('');
    }
  });
});

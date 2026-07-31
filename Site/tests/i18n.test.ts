import { describe, expect, it } from 'vitest';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits,
} from '../src/i18n/strings';

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
});

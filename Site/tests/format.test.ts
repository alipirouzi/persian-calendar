import { describe, expect, it } from 'vitest';
import { copySentence, formatGregorianDate, formatPersianDate, weekdayName } from '../src/i18n/format';
import { WEEKDAYS } from '../src/i18n/strings';

// Fixed vector shared with converter-core tests: 1403-10-22 ↔ 2025-01-11 (a Saturday).
const P = { py: 1403, pm: 10, pd: 22 };
const G = { gy: 2025, gm: 1, gd: 11 };

describe('weekdays', () => {
  it('tables are complete and getDay-ordered', () => {
    expect(WEEKDAYS.en).toHaveLength(7);
    expect(WEEKDAYS.fa).toHaveLength(7);
    expect(WEEKDAYS.en[0]).toBe('Sunday');   // Date.getDay() === 0
    expect(WEEKDAYS.fa[6]).toBe('شنبه');     // Saturday
  });
  it('resolves a known date in both languages', () => {
    expect(weekdayName(G, 'en')).toBe('Saturday');
    expect(weekdayName(G, 'fa')).toBe('شنبه');
  });
});

describe('date formatting', () => {
  it('formats the Persian date', () => {
    expect(formatPersianDate(P, 'en')).toBe('22 Dey 1403');
    expect(formatPersianDate(P, 'fa')).toBe('۲۲ دی ۱۴۰۳');
  });
  it('formats the Gregorian date per language convention', () => {
    expect(formatGregorianDate(G, 'en')).toBe('January 11, 2025');
    expect(formatGregorianDate(G, 'fa')).toBe('۱۱ ژانویه ۲۰۲۵');
  });
  it('builds the copy sentence', () => {
    expect(copySentence(P, G, 'en')).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
    expect(copySentence(P, G, 'fa')).toBe('شنبه ۲۲ دی ۱۴۰۳ — ۱۱ ژانویه ۲۰۲۵');
  });
});

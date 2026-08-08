import { describe, expect, it } from 'vitest';
import { convertFrom, normalizeDigits } from '../src/converter/converter-core';

describe('convertFrom persian', () => {
  it('converts a valid date', () => {
    const r = convertFrom('persian', { y: '1403', m: '10', d: '22' });
    expect(r).toEqual({
      status: 'ok',
      persian: { py: 1403, pm: 10, pd: 22 },
      gregorian: { gy: 2025, gm: 1, gd: 11 },
    });
  });
  it('flags empty fields as incomplete', () => {
    expect(convertFrom('persian', { y: '1403', m: '', d: '22' }).status).toBe('incomplete');
    expect(convertFrom('persian', { y: 'abc', m: '1', d: '1' }).status).toBe('incomplete');
  });
  it('rejects out-of-range year with bounds in params', () => {
    const r = convertFrom('persian', { y: '1150', m: '1', d: '1' });
    expect(r).toMatchObject({ status: 'error', errorKey: 'errYearRange', params: { min: 1200, max: 1500 } });
  });
  it('rejects bad month', () => {
    expect(convertFrom('persian', { y: '1404', m: '13', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errMonth' });
  });
  it('rejects 30 Esfand in a non-leap year with month context', () => {
    const r = convertFrom('persian', { y: '1404', m: '12', d: '30' });
    expect(r).toMatchObject({
      status: 'error', errorKey: 'errDay',
      params: { month: 12, days: 29, year: 1404 }, side: 'persian',
    });
  });
});

describe('convertFrom gregorian', () => {
  it('converts a valid date', () => {
    const r = convertFrom('gregorian', { y: '2026', m: '7', d: '31' });
    expect(r).toMatchObject({ status: 'ok', persian: { py: 1405, pm: 5, pd: 9 } });
  });
  it('rejects Feb 29 in a non-leap year', () => {
    expect(convertFrom('gregorian', { y: '2025', m: '2', d: '29' }))
      .toMatchObject({ status: 'error', errorKey: 'errDay', params: { month: 2, days: 28, year: 2025 } });
  });
  it('rejects out-of-range Gregorian years', () => {
    expect(convertFrom('gregorian', { y: '1500', m: '1', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errYearRange', params: { min: 1822, max: 2121 } });
  });
});

describe('normalizeDigits', () => {
  it('maps Persian-Indic digits to ASCII', () => {
    expect(normalizeDigits('۱۴۰۵')).toBe('1405');
  });
  it('maps Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('١٤٠٥')).toBe('1405');
  });
  it('handles mixed digits and leaves ASCII/other chars alone', () => {
    expect(normalizeDigits('1۴0٥')).toBe('1405');
    expect(normalizeDigits('abc')).toBe('abc');
    expect(normalizeDigits('')).toBe('');
  });
});

describe('convertFrom with non-ASCII digits', () => {
  it('converts Persian-digit input identically to ASCII', () => {
    expect(convertFrom('persian', { y: '۱۴۰۳', m: '۱۰', d: '۲۲' }))
      .toEqual(convertFrom('persian', { y: '1403', m: '10', d: '22' }));
  });
  it('converts Arabic-digit Gregorian input', () => {
    expect(convertFrom('gregorian', { y: '٢٠٢٦', m: '7', d: '31' }))
      .toMatchObject({ status: 'ok', persian: { py: 1405, pm: 5, pd: 9 } });
  });
  it('still rejects out-of-range months (URL-injection path)', () => {
    expect(convertFrom('persian', { y: '1404', m: '13', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errMonth' });
  });
});

describe('counterpart outside the other calendar range', () => {
  it('reports rather than throwing when a Persian date maps before 1822', () => {
    // 1200-01-01 AP is 1821-03-21 CE, below GREGORIAN_YEAR_MIN.
    expect(convertFrom('persian', { y: '1200', m: '1', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errUnsupported', side: 'persian' });
  });
  it('reports rather than throwing when a Persian date maps past 2121', () => {
    expect(convertFrom('persian', { y: '1500', m: '12', d: '29' }))
      .toMatchObject({ status: 'error', errorKey: 'errUnsupported', side: 'persian' });
  });
  it('still converts the interior of the range', () => {
    expect(convertFrom('persian', { y: '1200', m: '11', d: '1' }))
      .toMatchObject({ status: 'ok' });
    expect(convertFrom('gregorian', { y: '1822', m: '1', d: '1' }))
      .toMatchObject({ status: 'ok' });
    expect(convertFrom('gregorian', { y: '2121', m: '12', d: '31' }))
      .toMatchObject({ status: 'ok' });
  });
  it('never throws anywhere in either declared range', () => {
    for (let py = 1200; py <= 1500; py += 1) {
      expect(() => convertFrom('persian', { y: String(py), m: '1', d: '1' })).not.toThrow();
      expect(() => convertFrom('persian', { y: String(py), m: '12', d: '29' })).not.toThrow();
    }
    for (let gy = 1822; gy <= 2121; gy += 1) {
      expect(() => convertFrom('gregorian', { y: String(gy), m: '1', d: '1' })).not.toThrow();
      expect(() => convertFrom('gregorian', { y: String(gy), m: '12', d: '31' })).not.toThrow();
    }
  });
});

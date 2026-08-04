import { describe, expect, it } from 'vitest';
import { formatUrlQuery, parseUrlDate } from '../src/converter/url-state';

describe('parseUrlDate', () => {
  it('parses a Persian param', () => {
    expect(parseUrlDate('?p=1403-10-22'))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
  it('parses a Gregorian param', () => {
    expect(parseUrlDate('?g=2025-1-11'))
      .toEqual({ side: 'gregorian', y: 2025, m: 1, d: 11 });
  });
  it('ignores unrelated params around the date', () => {
    expect(parseUrlDate('?utm_source=x&p=1403-10-22'))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
  it('rejects empty, missing, or ambiguous input', () => {
    expect(parseUrlDate('')).toBeNull();
    expect(parseUrlDate('?')).toBeNull();
    expect(parseUrlDate('?p=1403-10-22&g=2025-1-11')).toBeNull(); // both sides
  });
  it('rejects malformed values', () => {
    expect(parseUrlDate('?p=1403-10')).toBeNull();
    expect(parseUrlDate('?p=1403/10/22')).toBeNull();
    expect(parseUrlDate('?p=abc-de-fg')).toBeNull();
    expect(parseUrlDate('?p=1403-10-22-5')).toBeNull();
    expect(parseUrlDate('?p=')).toBeNull();
  });
});

describe('formatUrlQuery', () => {
  it('round-trips with parseUrlDate', () => {
    expect(formatUrlQuery('persian', 1403, 10, 22)).toBe('?p=1403-10-22');
    expect(formatUrlQuery('gregorian', 2025, 1, 11)).toBe('?g=2025-1-11');
    expect(parseUrlDate(formatUrlQuery('persian', 1403, 10, 22)))
      .toEqual({ side: 'persian', y: 1403, m: 10, d: 22 });
  });
});

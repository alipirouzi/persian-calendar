import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { quoteForPersianDay, type Quote } from '../src/quotes/quotes';

const quotes = JSON.parse(
  readFileSync(join(__dirname, '..', 'public', 'quotes.json'), 'utf8'),
) as Quote[];

describe('quotes.json contract', () => {
  it('has exactly 366 entries with unique d 1..366', () => {
    expect(quotes).toHaveLength(366);
    const ds = new Set(quotes.map((q) => q.d));
    expect(ds.size).toBe(366);
    expect(Math.min(...ds)).toBe(1);
    expect(Math.max(...ds)).toBe(366);
  });
  it('every entry has non-empty bilingual fields', () => {
    for (const q of quotes) {
      for (const field of [q.en, q.fa, q.author_en, q.author_fa, q.source] as const) {
        expect(field.trim().length, `d=${q.d}`).toBeGreaterThan(0);
      }
      expect(q.en.length, `d=${q.d} too long`).toBeLessThanOrEqual(300);
    }
  });
});

describe('quoteForPersianDay', () => {
  it('selects by day', () => {
    expect(quoteForPersianDay(1, quotes)?.d).toBe(1);
    expect(quoteForPersianDay(366, quotes)?.d).toBe(366);
  });
  it('returns null for out-of-range days', () => {
    expect(quoteForPersianDay(0, quotes)).toBeNull();
    expect(quoteForPersianDay(367, quotes)).toBeNull();
  });
});

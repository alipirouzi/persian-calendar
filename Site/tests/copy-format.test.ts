import { describe, expect, it } from 'vitest';
import { formatCopy, patternLabel, tokenize } from '../src/copy/copy-format';
import type { CopySettings } from '../src/settings/settings-model';

// 1403-10-22 AP ↔ 2025-01-11 CE, a Saturday; single-digit Gregorian month.
const P = { py: 1403, pm: 10, pd: 22 };
const G = { gy: 2025, gm: 1, gd: 11 };

const copy = (over: Partial<CopySettings> = {}): CopySettings => ({
  calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin', ...over,
});

describe('tokenize', () => {
  it('takes the longest token and leaves everything else literal', () => {
    expect(tokenize('yyyy-mm-dd')).toEqual([
      { kind: 'field', field: 'yyyy' }, { kind: 'literal', text: '-' },
      { kind: 'field', field: 'mm' }, { kind: 'literal', text: '-' },
      { kind: 'field', field: 'dd' },
    ]);
    expect(tokenize('MMMM dddd')).toEqual([
      { kind: 'field', field: 'MMMM' }, { kind: 'literal', text: ' ' },
      { kind: 'field', field: 'dddd' },
    ]);
  });

  it('treats quoted text as literal and drops the quotes', () => {
    expect(tokenize("'Today is' d")).toEqual([
      { kind: 'literal', text: 'Today is ' }, { kind: 'field', field: 'd' },
    ]);
  });

  it('runs an unterminated quote to the end of the pattern', () => {
    expect(tokenize("d 'dd")).toEqual([
      { kind: 'field', field: 'd' }, { kind: 'literal', text: ' dd' },
    ]);
  });

  it('leaves partial tokens and other letters literal', () => {
    expect(tokenize('yy MM x')).toEqual([{ kind: 'literal', text: 'yy MM x' }]);
  });
});

describe('formatCopy', () => {
  it('defaults to the Persian date as yyyy-mm-dd', () => {
    expect(formatCopy(P, G, copy(), 'en')).toBe('1403-10-22');
  });

  it('formats the Gregorian date with zero padding', () => {
    expect(formatCopy(P, G, copy({ calendar: 'gregorian' }), 'en')).toBe('2025-01-11');
    expect(formatCopy(P, G, copy({ calendar: 'gregorian', pattern: 'd.m.yyyy' }), 'en'))
      .toBe('11.1.2025');
  });

  it('joins both calendars, Persian first', () => {
    expect(formatCopy(P, G, copy({ calendar: 'both', pattern: 'yyyy/mm/dd' }), 'en'))
      .toBe('1403/10/22 / 2025/01/11');
  });

  it('writes Persian-Indic digits when asked, in either UI language', () => {
    expect(formatCopy(P, G, copy({ digits: 'persian' }), 'en')).toBe('۱۴۰۳-۱۰-۲۲');
    expect(formatCopy(P, G, copy({ digits: 'latin' }), 'fa')).toBe('1403-10-22');
  });

  it('names the month and weekday in the UI language', () => {
    const named = copy({ pattern: 'dddd d MMMM yyyy' });
    expect(formatCopy(P, G, named, 'en')).toBe('Saturday 22 Dey 1403');
    expect(formatCopy(P, G, { ...named, calendar: 'gregorian' }, 'fa'))
      .toBe('شنبه 11 ژانویه 2025');
  });

  it('keeps quoted words intact', () => {
    expect(formatCopy(P, G, copy({ pattern: "'Today is' dddd" }), 'en'))
      .toBe('Today is Saturday');
  });

  it('reproduces the full sentence for the sentence preset', () => {
    expect(formatCopy(P, G, copy({ pattern: 'sentence', calendar: 'gregorian' }), 'en'))
      .toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  });
});

describe('patternLabel', () => {
  it('shows the pattern, or the localized name of the sentence preset', () => {
    expect(patternLabel(copy(), 'en')).toBe('yyyy-mm-dd');
    expect(patternLabel(copy({ pattern: 'sentence' }), 'en')).toBe('Full sentence');
    expect(patternLabel(copy({ pattern: 'sentence' }), 'fa')).toBe('جمله کامل');
  });
});

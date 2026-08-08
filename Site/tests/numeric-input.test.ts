import { describe, expect, it } from 'vitest';
import { filterDigits } from '../src/ui/numeric-input';

describe('filterDigits', () => {
  it('keeps every digit script the converter accepts', () => {
    expect(filterDigits('1405')).toBe('1405');
    expect(filterDigits('۱۴۰۵')).toBe('۱۴۰۵');
    expect(filterDigits('١٤٠٥')).toBe('١٤٠٥');
  });
  it('strips letters, punctuation, and whitespace', () => {
    expect(filterDigits('abc')).toBe('');
    expect(filterDigits('14o5')).toBe('145');
    expect(filterDigits('1405-10-22')).toBe('14051022');
    expect(filterDigits(' 14 05 ')).toBe('1405');
    expect(filterDigits('١٤!٠٥')).toBe('١٤٠٥');
    expect(filterDigits('12.5')).toBe('125');
    expect(filterDigits('-1')).toBe('1');
    expect(filterDigits('1e3')).toBe('13');
  });
  it('leaves an already-clean or empty value untouched', () => {
    expect(filterDigits('')).toBe('');
    expect(filterDigits('7')).toBe('7');
  });
});

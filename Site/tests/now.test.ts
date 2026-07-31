import { describe, expect, it } from 'vitest';
import { gregorianPartsIn, nowSnapshot } from '../src/calendar/now';

describe('gregorianPartsIn', () => {
  it('resolves a UTC instant into Tehran wall-clock date (+03:30)', () => {
    // 2026-07-30T21:30:00Z is already 2026-07-31 01:00 in Tehran
    const d = new Date(Date.UTC(2026, 6, 30, 21, 30));
    expect(gregorianPartsIn('Asia/Tehran', d)).toEqual({ gy: 2026, gm: 7, gd: 31 });
    expect(gregorianPartsIn('UTC', d)).toEqual({ gy: 2026, gm: 7, gd: 30 });
  });
});

describe('nowSnapshot', () => {
  it('carries consistent Persian dates for both zones', () => {
    const d = new Date(Date.UTC(2026, 6, 31, 12, 0));
    const s = nowSnapshot(d);
    expect(s.local.p.py).toBe(1405);
    expect(s.tehran.p).toEqual({ py: 1405, pm: 5, pd: 9 });
    expect(s.tehran.hhmm).toBe('15:30');
  });
});

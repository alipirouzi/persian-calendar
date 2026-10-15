import { describe, expect, it } from 'vitest';
import { BEAT_MS, handState, hhmm, msSinceLocalMidnight, pad2 } from '../src/watch/hands';

const at = (h: number, m: number, s: number, ms = 0) => msSinceLocalMidnight(new Date(2026, 9, 15, h, m, s, ms));

describe('hand state', () => {
  it('points the hands at 10:09:36', () => {
    const s = handState(at(10, 9, 36), false);
    expect(s.hour).toBeCloseTo(304.8, 6);
    expect(s.minute).toBeCloseTo(57.6, 6);
    expect(s.second).toBeCloseTo(216, 6);
  });

  it('ticks the seconds hand in 125 ms steps; hour and minute move continuously', () => {
    expect(BEAT_MS).toBe(125);
    const a = handState(at(10, 9, 36, 124), false);
    const b = handState(at(10, 9, 36, 125), false);
    expect(a.second).toBeCloseTo(216, 6);
    expect(b.second).toBeCloseTo(216.75, 6);
    expect(b.beat).toBe(a.beat + 1);
    expect(a.minute).toBeGreaterThan(57.6);
  });

  it('steps once a second under reduced motion', () => {
    const a = handState(at(10, 9, 36, 0), true);
    const b = handState(at(10, 9, 36, 999), true);
    expect(b.second).toBe(a.second);
    expect(b.beat).toBe(a.beat);
    expect(handState(at(10, 9, 37), true).beat).toBe(a.beat + 8);
  });

  it('wraps at noon and midnight', () => {
    expect(handState(at(0, 0, 0), false)).toEqual({ hour: 0, minute: 0, second: 0, beat: 0 });
    expect(handState(at(12, 0, 0), false).hour).toBe(0);
    expect(handState(at(23, 59, 59, 875), false).second).toBeCloseTo(359.25, 6);
  });

  it('formats HH:MM with Latin digits and pads', () => {
    expect(hhmm(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(pad2(3)).toBe('03');
    expect(pad2(42)).toBe('42');
  });
});

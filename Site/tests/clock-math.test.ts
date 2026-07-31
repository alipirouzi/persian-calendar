import { describe, expect, it } from 'vitest';
import { handAngles, msSinceLocalMidnight } from '../src/clock/clock-math';

describe('handAngles', () => {
  it('midnight → all hands at 12', () => {
    expect(handAngles(0)).toEqual({ hour: 0, minute: 0, second: 0 });
  });
  it('15 s → second hand at 90°', () => {
    expect(handAngles(15_000).second).toBe(90);
  });
  it('10:30:00 → hour 315°, minute 180°', () => {
    const ms = ((10 * 60 + 30) * 60) * 1000;
    const a = handAngles(ms);
    expect(a.hour).toBe(315);
    expect(a.minute).toBe(180);
    expect(a.second).toBe(0);
  });
  it('12 h wraps to 0', () => {
    expect(handAngles(12 * 3_600_000).hour).toBe(0);
  });
  it('is continuous: 500 ms → second 3°', () => {
    expect(handAngles(500).second).toBe(3);
  });
});

describe('msSinceLocalMidnight', () => {
  it('computes from local wall-clock fields', () => {
    const d = new Date(2026, 6, 31, 1, 2, 3, 400);
    expect(msSinceLocalMidnight(d)).toBe(((1 * 60 + 2) * 60 + 3) * 1000 + 400);
  });
});

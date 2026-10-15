import { describe, expect, it } from 'vitest';
import {
  BALANCE_AMPLITUDE_DEG, BEAT_MS, handAngles, hhmm, msSinceLocalMidnight, PALLET_DEG, watchState,
} from '../src/watch/movement-model';

const mod = (x: number) => ((x % 360) + 360) % 360;
const at = (h: number, m: number, s: number, ms = 0) => ((h * 60 + m) * 60 + s) * 1000 + ms;

describe('handAngles (continuous, as the old clock-math)', () => {
  it('midnight → all hands at 12', () => { expect(handAngles(0)).toEqual({ hour: 0, minute: 0, second: 0 }); });
  it('10:30:00 → hour 315°, minute 180°', () => {
    const a = handAngles(at(10, 30, 0));
    expect(a.hour).toBe(315); expect(a.minute).toBe(180); expect(a.second).toBe(0);
  });
  it('12 h wraps to 0', () => { expect(handAngles(12 * 3_600_000).hour).toBe(0); });
  it('is continuous: 500 ms → second 3°', () => { expect(handAngles(500).second).toBe(3); });
});

describe('msSinceLocalMidnight and hhmm', () => {
  it('reads local wall-clock fields', () => {
    const d = new Date(2026, 6, 31, 1, 2, 3, 400);
    expect(msSinceLocalMidnight(d)).toBe(at(1, 2, 3, 400));
    expect(hhmm(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(hhmm(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('watchState', () => {
  it('ticks the seconds hand 8 times a second', () => {
    expect(watchState(at(0, 0, 1, 0), false).second).toBe(6);
    expect(watchState(at(0, 0, 1, 124), false).second).toBe(6);
    expect(watchState(at(0, 0, 1, 125), false).second).toBe(6.75);
  });

  it('steps once a second under reduced motion', () => {
    expect(watchState(at(0, 0, 1, 900), true).second).toBe(6);
    expect(watchState(at(0, 0, 2, 0), true).second).toBe(12);
  });

  it('moves hour and minute hands continuously', () => {
    const s = watchState(at(10, 30, 30), false);
    expect(s.minute).toBeCloseTo(183);
    expect(s.hour).toBeCloseTo(315.25);
  });

  it('steps the escape wheel 12° per beat, counter-clockwise', () => {
    const a = watchState(at(3, 0, 0), false), b = watchState(at(3, 0, 0, BEAT_MS), false);
    expect(a.escape - b.escape).toBeCloseTo(12);
  });

  it('gears the whole train to the hands at any time of day', () => {
    for (let ms = 0; ms < 86_400_000; ms += 7_777_777) {
      const s = watchState(ms, false);
      expect(mod(s.fourth)).toBeCloseTo(mod(s.second), 6);           // fourth wheel carries the seconds
      expect(Math.abs(mod(s.centre) - mod(s.minute))).toBeLessThan(0.02); // centre carries the minutes (within one beat)
      expect(s.fourth).toBeCloseTo(-s.escape / 16, 6);
      expect(s.third).toBeCloseTo(-s.fourth / 7.5, 6);
      expect(s.centre).toBeCloseTo(-s.third / 8, 6);
      expect(s.barrel).toBeCloseTo(-s.centre / 8, 6);
    }
  });

  it('turns the centre wheel once an hour and the barrel once in eight', () => {
    const a = watchState(at(1, 0, 0), false), b = watchState(at(2, 0, 0), false);
    expect(b.centre - a.centre).toBeCloseTo(360, 6);
    expect(a.barrel - b.barrel).toBeCloseTo(45, 6);
  });

  it('passes the balance through zero exactly on every beat, at full swing between', () => {
    for (let k = 0; k < 16; k += 1) expect(watchState(k * BEAT_MS, false).balance).toBeCloseTo(0, 6);
    expect(Math.abs(watchState(BEAT_MS / 2, false).balance)).toBeCloseTo(BALANCE_AMPLITUDE_DEG, 6);
  });

  it('rocks the pallet to the opposite side on each beat', () => {
    const end = (beat: number) => watchState(beat * BEAT_MS + BEAT_MS - 1, false).pallet;
    expect(end(0)).toBeCloseTo(-end(1), 6);
    expect(Math.abs(end(0))).toBeCloseTo(PALLET_DEG, 6);
  });

  it('keeps the balance and pallet still under reduced motion', () => {
    const s = watchState(at(5, 5, 5, 60), true);
    expect(s.balance).toBe(0);
    expect(s.pallet).toBe(0);
  });

  it('is a pure function of time, so a backwards jump just shows the earlier state', () => {
    const later = watchState(at(12, 0, 0), false), earlier = watchState(at(11, 59, 0), false);
    expect(watchState(at(11, 59, 0), false)).toEqual(earlier);
    expect(later.minute).not.toBe(earlier.minute);
  });
});

import { describe, expect, it } from 'vitest';
import { todayLines } from '../src/calendar/today-lines';
import { nowSnapshot } from '../src/calendar/now';
import type { NowSnapshot } from '../src/calendar/now';

/** A snapshot with the two zones on the same calendar day. */
function aligned(): NowSnapshot {
  return {
    local: { g: { gy: 2026, gm: 8, gd: 8 }, p: { py: 1405, pm: 5, pd: 17 } },
    tehran: { g: { gy: 2026, gm: 8, gd: 8 }, p: { py: 1405, pm: 5, pd: 17 }, hhmm: '20:40' },
    tehranIsLocal: false,
  };
}

/** Berlin is still on the 8th while Tehran has already turned over to the 9th. */
function diverged(): NowSnapshot {
  return {
    local: { g: { gy: 2026, gm: 8, gd: 8 }, p: { py: 1405, pm: 5, pd: 17 } },
    tehran: { g: { gy: 2026, gm: 8, gd: 9 }, p: { py: 1405, pm: 5, pd: 18 }, hhmm: '00:40' },
    tehranIsLocal: false,
  };
}

describe('todayLines', () => {
  it('shows the viewer their own date on both lines while the zones agree', () => {
    const lines = todayLines(aligned());
    expect(lines.daysDiverge).toBe(false);
    expect(lines.persian).toEqual({ py: 1405, pm: 5, pd: 17 });
    expect(lines.persianWeekdaySource).toEqual({ gy: 2026, gm: 8, gd: 8 });
    expect(lines.gregorian).toEqual({ gy: 2026, gm: 8, gd: 8 });
  });

  it('moves the Persian line to Tehran when the day has turned over there', () => {
    const lines = todayLines(diverged());
    expect(lines.daysDiverge).toBe(true);
    expect(lines.persian).toEqual({ py: 1405, pm: 5, pd: 18 });
    expect(lines.persianWeekdaySource).toEqual({ gy: 2026, gm: 8, gd: 9 });
    // The Gregorian line is the viewer's, always.
    expect(lines.gregorian).toEqual({ gy: 2026, gm: 8, gd: 8 });
  });

  it('detects divergence across a month and a year boundary', () => {
    const acrossMonth = diverged();
    acrossMonth.local.g = { gy: 2026, gm: 8, gd: 31 };
    acrossMonth.tehran.g = { gy: 2026, gm: 9, gd: 1 };
    expect(todayLines(acrossMonth).daysDiverge).toBe(true);

    const acrossYear = diverged();
    acrossYear.local.g = { gy: 2026, gm: 12, gd: 31 };
    acrossYear.tehran.g = { gy: 2027, gm: 1, gd: 1 };
    expect(todayLines(acrossYear).daysDiverge).toBe(true);
  });

  it('never diverges when Tehran is the viewer\'s own zone', () => {
    const local = aligned();
    local.tehranIsLocal = true;
    expect(todayLines(local).daysDiverge).toBe(false);
  });

  it('accepts a real snapshot', () => {
    // 2026-08-08T18:00Z is 20:00 in Tehran and 20:00 in Berlin — same day either way.
    const lines = todayLines(nowSnapshot(new Date('2026-08-08T18:00:00Z')));
    expect(lines.daysDiverge).toBe(false);
    expect(lines.gregorian).toEqual({ gy: 2026, gm: 8, gd: 8 });
  });
});

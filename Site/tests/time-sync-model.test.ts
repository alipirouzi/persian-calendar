// Site/tests/time-sync-model.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyDeadBand, bestSample, DEAD_BAND_MS, isFresh, OFFSET_TTL_MS, parseTimeBody, sampleOffset,
} from '../src/time/time-sync-model';

describe('parseTimeBody', () => {
  it('reads nginx $msec — seconds with a millisecond fraction — as epoch milliseconds', () => {
    expect(parseTimeBody({ epochSec: 1792043370.981 })).toBe(1792043370981);
  });

  it('rejects anything that is not our JSON', () => {
    const junk = [
      null, undefined, 42, 'x', [], {}, { epochSec: '1792043370.981' }, { epochSec: Infinity },
      { epochSec: Number.NaN }, { epochsec: 1792043370 },
    ];
    for (const raw of junk) expect(parseTimeBody(raw)).toBeNull();
  });

  it('rejects timestamps outside 2020–2100, which no healthy server sends', () => {
    expect(parseTimeBody({ epochSec: 0 })).toBeNull();
    expect(parseTimeBody({ epochSec: 1_577_836_799 })).toBeNull();
    expect(parseTimeBody({ epochSec: 4_102_444_801 })).toBeNull();
    expect(parseTimeBody({ epochSec: 1_577_836_800 })).toBe(1_577_836_800_000);
  });
});

describe('sampleOffset', () => {
  it('credits the server with half the round trip', () => {
    // Request left at perf 1000, answer back at perf 1100: rtt 100 ms.
    // Server stamped 50 000; by the time we read it, it is 50 050 on the server.
    // The device reads 49 000 at that moment, so it is 1 050 ms slow.
    expect(sampleOffset(50_000, 1_000, 1_100, 49_000)).toEqual({ rttMs: 100, offsetMs: 1_050 });
  });

  it('is negative when the device is fast', () => {
    expect(sampleOffset(50_000, 0, 0, 52_000).offsetMs).toBe(-2_000);
  });
});

describe('bestSample', () => {
  it('keeps the sample with the smallest round trip', () => {
    const samples = [
      { offsetMs: 900, rttMs: 300 }, { offsetMs: 1_000, rttMs: 40 }, { offsetMs: 1_100, rttMs: 90 },
    ];
    expect(bestSample(samples)).toEqual({ offsetMs: 1_000, rttMs: 40 });
  });

  it('has nothing to offer when every sample failed', () => {
    expect(bestSample([])).toBeNull();
  });
});

describe('applyDeadBand', () => {
  it('treats anything under the dead band as no offset at all', () => {
    expect(applyDeadBand(DEAD_BAND_MS - 1)).toBe(0);
    expect(applyDeadBand(-(DEAD_BAND_MS - 1))).toBe(0);
  });

  it('keeps offsets at or beyond the dead band, rounded to whole milliseconds', () => {
    expect(applyDeadBand(DEAD_BAND_MS)).toBe(DEAD_BAND_MS);
    expect(applyDeadBand(-1_234.6)).toBe(-1_235);
  });
});

describe('isFresh', () => {
  const last = { offsetMs: 500, atDeviceMs: 1_000_000 };

  it('is fresh until it is a day old', () => {
    expect(isFresh(last, last.atDeviceMs)).toBe(true);
    expect(isFresh(last, last.atDeviceMs + OFFSET_TTL_MS - 1)).toBe(true);
    expect(isFresh(last, last.atDeviceMs + OFFSET_TTL_MS)).toBe(false);
  });

  it('is not fresh when there was never a sync', () => {
    expect(isFresh(null, 1_000_000)).toBe(false);
  });

  it('is not fresh when the device clock has gone back past the sync', () => {
    expect(isFresh(last, last.atDeviceMs - 1)).toBe(false);
  });
});

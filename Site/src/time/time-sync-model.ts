export const TIME_ENDPOINT = '/api/time';
export const SAMPLES_PER_SYNC = 3;
export const DEAD_BAND_MS = 250;
export const SAMPLE_TIMEOUT_MS = 3_000;
export const OFFSET_TTL_MS = 24 * 60 * 60 * 1000;
export const RESYNC_AFTER_HIDDEN_MS = 5 * 60 * 1000;
export const RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

// A body outside these bounds is not a clock reading — it is a bug or someone else's JSON.
const MIN_EPOCH_SEC = 1_577_836_800; // 2020-01-01T00:00:00Z
const MAX_EPOCH_SEC = 4_102_444_800; // 2100-01-01T00:00:00Z

/** One round trip: how far the device is behind the server, and how long the trip took. */
export interface Sample { readonly offsetMs: number; readonly rttMs: number }

/** The offset in force and when (by the device clock) it was measured. */
export interface LastSync { readonly offsetMs: number; readonly atDeviceMs: number }

/** `{"epochSec": 1792043370.981}` → epoch milliseconds; anything else → null. */
export function parseTimeBody(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const sec = (raw as Record<string, unknown>)['epochSec'];
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  if (sec < MIN_EPOCH_SEC || sec > MAX_EPOCH_SEC) return null;
  return Math.round(sec * 1000);
}

/**
 * The server stamped its time somewhere in the round trip; half-way is the best guess,
 * so by the time the answer is read the server is `rtt / 2` further on.
 */
export function sampleOffset(serverMs: number, t0: number, t1: number, deviceAtT1Ms: number): Sample {
  const rttMs = t1 - t0;
  return { rttMs, offsetMs: serverMs + rttMs / 2 - deviceAtT1Ms };
}

/** The shortest trip has the least room for asymmetric delay, so its offset is the most trustworthy. */
export function bestSample(samples: readonly Sample[]): Sample | null {
  let best: Sample | null = null;
  for (const sample of samples) {
    if (best === null || sample.rttMs < best.rttMs) best = sample;
  }
  return best;
}

/** Under a quarter of a second is network noise, not a wrong clock: leave the device alone. */
export function applyDeadBand(offsetMs: number): number {
  return Math.abs(offsetMs) < DEAD_BAND_MS ? 0 : Math.round(offsetMs);
}

/** A sync older than a day, or "newer" than now because the device clock went back, is not trusted. */
export function isFresh(last: LastSync | null, deviceNowMs: number): boolean {
  if (last === null) return false;
  const age = deviceNowMs - last.atDeviceMs;
  return age >= 0 && age < OFFSET_TTL_MS;
}

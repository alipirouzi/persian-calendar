export const BEAT_MS = 125;                       // 4 Hz: the seconds hand ticks 8 times a second

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_HALF_DAY = 43_200_000;
const BEATS_PER_SECOND = MS_PER_SECOND / BEAT_MS;

export interface HandState { readonly hour: number; readonly minute: number; readonly second: number; readonly beat: number }

export function msSinceLocalMidnight(date: Date): number {
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

/**
 * The hands at `ms` past local midnight. Hour and minute move continuously; the seconds hand
 * ticks once a beat (once a second under reduced motion). `beat` changes exactly when the
 * seconds hand moves, so the driver can skip frames in between.
 */
export function handState(ms: number, reduced: boolean): HandState {
  const beat = reduced ? Math.floor(ms / MS_PER_SECOND) * BEATS_PER_SECOND : Math.floor(ms / BEAT_MS);
  const ticked = beat * BEAT_MS;
  return {
    hour: ((ms % MS_PER_HALF_DAY) / MS_PER_HALF_DAY) * 360,
    minute: ((ms % MS_PER_HOUR) / MS_PER_HOUR) * 360,
    second: ((ticked % MS_PER_MINUTE) / MS_PER_MINUTE) * 360,
    beat,
  };
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const hhmm = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

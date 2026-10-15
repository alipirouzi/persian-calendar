export const BEAT_MS = 125;                       // 4 Hz: 28 800 vibrations an hour
export const ESCAPE_STEP_DEG = 12;               // half a tooth of a 15-tooth escape wheel per beat
export const TRAIN_RATIOS = { escapeToFourth: 16, fourthToThird: 7.5, thirdToCentre: 8, centreToBarrel: 8 } as const;
export const BALANCE_AMPLITUDE_DEG = 220;
export const PALLET_DEG = 9;
const PALLET_SNAP = 0.18;                         // share of a beat the fork takes to cross over

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_HALF_DAY = 43_200_000;
const BEATS_PER_SECOND = MS_PER_SECOND / BEAT_MS;

export interface HandAngles { readonly hour: number; readonly minute: number; readonly second: number }

export interface WatchState extends HandAngles {
  readonly beat: number;
  readonly escape: number;
  readonly fourth: number;
  readonly third: number;
  readonly centre: number;
  readonly barrel: number;
  readonly pallet: number;
  readonly balance: number;
  /** The continuous seconds angle, for faces that sweep rather than tick. */
  readonly smoothSecond: number;
}

export function msSinceLocalMidnight(date: Date): number {
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

export function handAngles(ms: number): HandAngles {
  return {
    hour: ((ms % MS_PER_HALF_DAY) / MS_PER_HALF_DAY) * 360,
    minute: ((ms % MS_PER_HOUR) / MS_PER_HOUR) * 360,
    second: ((ms % MS_PER_MINUTE) / MS_PER_MINUTE) * 360,
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');
export const hhmm = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Every moving part as an angle, all derived from the escapement's beats through the train's
 * ratios — so the centre wheel *is* the minute hand and the fourth wheel *is* the seconds.
 * A pure function of the time: a clock correction simply shows the corrected state.
 */
export function watchState(ms: number, reduced: boolean): WatchState {
  const beat = reduced
    ? Math.floor(ms / MS_PER_SECOND) * BEATS_PER_SECOND
    : Math.floor(ms / BEAT_MS);
  const escapeTurn = beat * ESCAPE_STEP_DEG;
  const fourth = escapeTurn / TRAIN_RATIOS.escapeToFourth;
  const third = fourth / TRAIN_RATIOS.fourthToThird;
  const centre = third / TRAIN_RATIOS.thirdToCentre;
  const barrel = centre / TRAIN_RATIOS.centreToBarrel;
  const { hour, minute, second: smoothSecond } = handAngles(ms);
  const second = (fourth % 360 + 360) % 360;

  let pallet = 0;
  let balance = 0;
  if (!reduced) {
    const progress = Math.min(1, (ms % BEAT_MS) / BEAT_MS / PALLET_SNAP);
    const side = beat % 2 === 0 ? -1 : 1;
    pallet = side * PALLET_DEG * (2 * progress - 1);
    balance = Math.sin(((ms % MS_PER_SECOND) / MS_PER_SECOND) * 2 * Math.PI * BEATS_PER_SECOND / 2) * BALANCE_AMPLITUDE_DEG;
  }

  return { hour, minute, second, beat, escape: -escapeTurn, fourth, third: -third, centre, barrel: -barrel, pallet, balance, smoothSecond };
}

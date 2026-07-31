export interface HandAngles { hour: number; minute: number; second: number }

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_HALF_DAY = 43_200_000;

export function msSinceLocalMidnight(date: Date): number {
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000
    + date.getMilliseconds();
}

export function handAngles(ms: number): HandAngles {
  return {
    hour: ((ms % MS_PER_HALF_DAY) / MS_PER_HALF_DAY) * 360,
    minute: ((ms % MS_PER_HOUR) / MS_PER_HOUR) * 360,
    second: ((ms % MS_PER_MINUTE) / MS_PER_MINUTE) * 360,
  };
}

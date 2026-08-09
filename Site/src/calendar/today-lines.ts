import type { GregorianDateParts, PersianDateParts } from './persian';
import type { NowSnapshot } from './now';

export interface TodayLines {
  /**
   * The Persian date to show. Shamsi is Iran's civil calendar, so it follows
   * Tehran — which matters only when Tehran and the viewer are on different
   * calendar days, and is the viewer's own date the rest of the time.
   */
  persian: PersianDateParts;
  /** The Gregorian date the Persian line's weekday is derived from. */
  persianWeekdaySource: GregorianDateParts;
  /** Always the viewer's local date. */
  gregorian: GregorianDateParts;
  /**
   * True when Tehran and the viewer are on different calendar days — one is past
   * midnight and the other is not. Only then do the two lines describe different
   * days, and only then does the second line need a weekday of its own.
   */
  daysDiverge: boolean;
}

function sameDay(a: GregorianDateParts, b: GregorianDateParts): boolean {
  return a.gy === b.gy && a.gm === b.gm && a.gd === b.gd;
}

export function todayLines(snapshot: NowSnapshot): TodayLines {
  const daysDiverge = !sameDay(snapshot.local.g, snapshot.tehran.g);
  return {
    persian: daysDiverge ? snapshot.tehran.p : snapshot.local.p,
    persianWeekdaySource: daysDiverge ? snapshot.tehran.g : snapshot.local.g,
    gregorian: snapshot.local.g,
    daysDiverge,
  };
}

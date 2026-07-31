import { toPersian, type GregorianDateParts, type PersianDateParts } from './persian';

export interface NowSnapshot {
  local: { g: GregorianDateParts; p: PersianDateParts };
  tehran: { g: GregorianDateParts; p: PersianDateParts; hhmm: string };
  tehranIsLocal: boolean;
}

const TEHRAN = 'Asia/Tehran';

export function gregorianPartsIn(timeZone: string | undefined, date: Date): GregorianDateParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date); // → YYYY-MM-DD
  const [gy, gm, gd] = formatted.split('-').map(Number) as [number, number, number];
  return { gy, gm, gd };
}

function tehranHhmm(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TEHRAN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export function nowSnapshot(date: Date = new Date()): NowSnapshot {
  const localG = gregorianPartsIn(undefined, date);
  const tehranG = gregorianPartsIn(TEHRAN, date);
  return {
    local: { g: localG, p: toPersian(localG) },
    tehran: { g: tehranG, p: toPersian(tehranG), hhmm: tehranHhmm(date) },
    tehranIsLocal: Intl.DateTimeFormat().resolvedOptions().timeZone === TEHRAN,
  };
}

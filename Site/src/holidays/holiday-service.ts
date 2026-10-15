// Site/src/holidays/holiday-service.ts
import type { Side } from '../converter/converter-core';
import type { SettingsStore } from '../settings/settings-store';
import { fetchOfficialFile, type OfficialFile } from './holiday-data';
import { holidaysForMonth, type MonthHolidays } from './merge';
import { daysInGregorianMonth, toPersian } from '../calendar/persian';

export const OFFICIAL_RETRY_MS = 60 * 60 * 1000;

export interface HolidayService {
  forMonth(side: Side, year: number, month: number): MonthHolidays;
  probe(py: number): Promise<OfficialFile | null>;
  subscribe(listener: () => void): () => void;
}

export interface HolidayServiceDeps {
  readonly store: Pick<SettingsStore, 'get'>;
  readonly fetchFile?: (py: number) => Promise<OfficialFile | null>;
  readonly dateNow?: () => number;
}

/** The Persian years a displayed month touches: one for a Persian month, one or two for a Gregorian one. */
const persianYearsOf = (side: Side, year: number, month: number): number[] => {
  if (side === 'persian') return [year];
  const first = toPersian({ gy: year, gm: month, gd: 1 }).py;
  const last = toPersian({ gy: year, gm: month, gd: daysInGregorianMonth(year, month) }).py;
  return first === last ? [first] : [first, last];
};

export function createHolidayService({
  store,
  fetchFile = (py) => fetchOfficialFile(py),
  dateNow = () => Date.now(),
}: HolidayServiceDeps): HolidayService {
  const files = new Map<number, OfficialFile>();
  const failedAt = new Map<number, number>();
  const inFlight = new Set<number>();
  const listeners = new Set<() => void>();
  const notify = (): void => { for (const listener of listeners) listener(); };

  const load = (py: number): void => {
    if (files.has(py) || inFlight.has(py)) return;
    const failed = failedAt.get(py);
    if (failed !== undefined && dateNow() - failed < OFFICIAL_RETRY_MS) return;
    inFlight.add(py);
    void fetchFile(py).then((file) => {
      inFlight.delete(py);
      if (file === null) {
        failedAt.set(py, dateNow());
        return;
      }
      files.set(py, file);
      notify();
    });
  };

  return {
    forMonth(side, year, month) {
      const { sources, user } = store.get().holidays;
      if (sources.includes('ir')) for (const py of persianYearsOf(side, year, month)) load(py);
      return holidaysForMonth(side, year, month, { sources, user, official: (py) => files.get(py) ?? null });
    },
    async probe(py) {
      const file = await fetchFile(py);
      if (file !== null) {
        files.set(py, file);
        notify();
      }
      return file;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

import { daysInPersianMonth, type PersianDateParts } from '../calendar/persian';
import { isIrLunarKey, type IrLunarKey } from './holiday-keys';

export interface OfficialHoliday {
  readonly key: IrLunarKey;
  readonly p: PersianDateParts;
}

export interface OfficialFile {
  readonly year: number;
  readonly source: string;
  readonly fetched: string;
  readonly holidays: readonly OfficialHoliday[];
}

export const holidayFileUrl = (py: number): string => `/api/holidays/ir/${py}.json`;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseDay(value: unknown, year: number): PersianDateParts | null {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [py, pm, pd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (py !== year || pm < 1 || pm > 12 || pd < 1 || pd > daysInPersianMonth(py, pm)) return null;
  return { py, pm, pd };
}

function parseHoliday(value: unknown, year: number): OfficialHoliday | null {
  if (!isRecord(value) || !isIrLunarKey(value['key'])) return null;
  const p = parseDay(value['p'], year);
  return p === null ? null : { key: value['key'], p };
}

/** All or nothing: a file with any defect is ignored and the estimates stand in. */
export function parseOfficialFile(raw: unknown, year: number): OfficialFile | null {
  if (!isRecord(raw) || raw['year'] !== year) return null;
  const { source, fetched, holidays } = raw;
  if (typeof source !== 'string' || source === '') return null;
  if (typeof fetched !== 'string' || !ISO_DATE.test(fetched)) return null;
  if (!Array.isArray(holidays)) return null;
  const parsed = holidays.map((h) => parseHoliday(h, year));
  if (parsed.some((h) => h === null)) return null;
  return { year, source, fetched, holidays: parsed as OfficialHoliday[] };
}

/** Never rejects: no file, no network or a bad file all mean "use the estimates". */
export async function fetchOfficialFile(
  year: number,
  fetchImpl: (url: string) => Promise<Response> = (url) => fetch(url),
): Promise<OfficialFile | null> {
  try {
    const response = await fetchImpl(holidayFileUrl(year));
    if (!response.ok) return null;
    return parseOfficialFile(await response.json(), year);
  } catch {
    return null;
  }
}

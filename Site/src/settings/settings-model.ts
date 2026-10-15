import {
  daysInGregorianMonth, daysInPersianMonth, PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN,
} from '../calendar/persian';
import { GREGORIAN_YEAR_MAX, GREGORIAN_YEAR_MIN } from '../converter/converter-core';
import { FACE_IDS, type FaceId } from '../watch/face';

export type CopyCalendar = 'persian' | 'gregorian' | 'both';
export type CopyDigits = 'latin' | 'persian';
export type TimeSourceSetting = 'server' | 'device';

/** The pattern value that means "the full sentence", not a token pattern. */
export const SENTENCE = 'sentence';
export const COPY_PRESETS = ['yyyy-mm-dd', 'yyyy/mm/dd', 'dd.mm.yyyy', SENTENCE] as const;
export const MAX_PATTERN_LENGTH = 64;

export interface CopySettings {
  readonly calendar: CopyCalendar;
  readonly pattern: string;
  readonly digits: CopyDigits;
}

export interface TimeSettings {
  readonly source: TimeSourceSetting;
}

export type HolidaySource = 'ir' | 'nuremberg' | 'user';
export const HOLIDAY_SOURCES: readonly HolidaySource[] = ['ir', 'nuremberg', 'user'];
export type UserHolidayCalendar = 'persian' | 'gregorian';

export interface UserHoliday {
  readonly id: string;
  readonly name: string;
  readonly calendar: UserHolidayCalendar;
  readonly month: number;
  readonly day: number;
  /** Absent: every year. */
  readonly year?: number;
}

export interface ViewSettings {
  readonly enabled: boolean;
  readonly open: boolean;
}

export const MAX_HOLIDAY_NAME_LENGTH = 60;
export const MAX_USER_HOLIDAYS = 200;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const GREGORIAN_MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export interface Settings {
  readonly copy: CopySettings;
  readonly time: TimeSettings;
  readonly views: { readonly persian: ViewSettings; readonly gregorian: ViewSettings };
  readonly holidays: { readonly sources: readonly HolidaySource[]; readonly user: readonly UserHoliday[] };
  readonly watch: { readonly face: FaceId };
}

export const DEFAULT_SETTINGS: Settings = {
  copy: { calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin' },
  time: { source: 'server' },
  views: { persian: { enabled: true, open: true }, gregorian: { enabled: true, open: false } },
  holidays: { sources: HOLIDAY_SOURCES, user: [] },
  watch: { face: 'fullbleed' },
};

const CALENDARS: readonly CopyCalendar[] = ['persian', 'gregorian', 'both'];
const DIGITS: readonly CopyDigits[] = ['latin', 'persian'];
const TIME_SOURCES: readonly TimeSourceSetting[] = ['server', 'device'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.find((candidate) => candidate === value) ?? fallback;

const parsePattern = (value: unknown): string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= MAX_PATTERN_LENGTH
    ? value
    : DEFAULT_SETTINGS.copy.pattern;

/** The longest the month can be in any year: Esfand 30 and Feb 29 count. */
export function maxDayOfMonth(calendar: UserHolidayCalendar, month: number): number {
  if (calendar === 'gregorian') return GREGORIAN_MAX_DAYS[month - 1] as number;
  return month <= 6 ? 31 : 30;
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** One user holiday, or null. With a year, the day must exist in that year. */
export function parseUserHoliday(raw: unknown): UserHoliday | null {
  if (!isRecord(raw)) return null;
  const { id, name, calendar, month, day, year } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_HOLIDAY_NAME_LENGTH) return null;
  if (calendar !== 'persian' && calendar !== 'gregorian') return null;
  const kind: UserHolidayCalendar = calendar;
  if (!isInt(month, 1, 12) || !isInt(day, 1, maxDayOfMonth(kind, month))) return null;
  const base = { id, name: trimmed, calendar: kind, month, day };
  if (year === undefined) return base;
  const [min, max] = kind === 'persian'
    ? [PERSIAN_YEAR_MIN, PERSIAN_YEAR_MAX] : [GREGORIAN_YEAR_MIN, GREGORIAN_YEAR_MAX];
  if (!isInt(year, min, max)) return null;
  const length = kind === 'persian' ? daysInPersianMonth(year, month) : daysInGregorianMonth(year, month);
  return day <= length ? { ...base, year } : null;
}

const parseView = (raw: unknown, fallback: ViewSettings): ViewSettings => {
  const view = isRecord(raw) ? raw : {};
  return {
    enabled: typeof view['enabled'] === 'boolean' ? view['enabled'] : fallback.enabled,
    open: typeof view['open'] === 'boolean' ? view['open'] : fallback.open,
  };
};

const parseSources = (raw: unknown): readonly HolidaySource[] =>
  Array.isArray(raw) ? HOLIDAY_SOURCES.filter((s) => raw.includes(s)) : DEFAULT_SETTINGS.holidays.sources;

const parseUserHolidays = (raw: unknown): readonly UserHoliday[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const kept: UserHoliday[] = [];
  for (const entry of raw) {
    const holiday = parseUserHoliday(entry);
    if (holiday === null || seen.has(holiday.id)) continue;
    seen.add(holiday.id);
    kept.push(holiday);
    if (kept.length === MAX_USER_HOLIDAYS) break;
  }
  return kept;
};

/**
 * Whatever storage hands back — another version's shape, a hand edit, garbage —
 * becomes a complete Settings. Each field is judged on its own, so one bad value
 * costs only itself.
 */
export function parseSettings(raw: unknown): Settings {
  const group = (key: string): Record<string, unknown> => {
    const value = isRecord(raw) ? raw[key] : undefined;
    return isRecord(value) ? value : {};
  };
  const copy = group('copy');
  const time = group('time');
  const views = group('views');
  const holidays = group('holidays');
  const fallback = DEFAULT_SETTINGS;
  return {
    copy: {
      calendar: oneOf(copy['calendar'], CALENDARS, fallback.copy.calendar),
      pattern: parsePattern(copy['pattern']),
      digits: oneOf(copy['digits'], DIGITS, fallback.copy.digits),
    },
    time: {
      source: oneOf(time['source'], TIME_SOURCES, fallback.time.source),
    },
    views: {
      persian: parseView(views['persian'], fallback.views.persian),
      gregorian: parseView(views['gregorian'], fallback.views.gregorian),
    },
    holidays: {
      sources: parseSources(holidays['sources']),
      user: parseUserHolidays(holidays['user']),
    },
    watch: { face: oneOf(group('watch')['face'], FACE_IDS, fallback.watch.face) },
  };
}

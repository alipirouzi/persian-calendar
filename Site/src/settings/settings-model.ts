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

export interface Settings {
  readonly copy: CopySettings;
  readonly time: TimeSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  copy: { calendar: 'persian', pattern: 'yyyy-mm-dd', digits: 'latin' },
  time: { source: 'server' },
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
  };
}

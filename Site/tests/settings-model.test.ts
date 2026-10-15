import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, HOLIDAY_SOURCES, MAX_HOLIDAY_NAME_LENGTH, MAX_PATTERN_LENGTH, MAX_USER_HOLIDAYS,
  maxDayOfMonth, parseSettings, parseUserHoliday,
} from '../src/settings/settings-model';

describe('parseSettings', () => {
  it('defaults everything when given nothing usable', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}, { copy: 'x' }, { copy: [] }]) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps every valid field', () => {
    const raw = {
      copy: { calendar: 'both', pattern: 'dd.mm.yyyy', digits: 'persian' },
      time: { source: 'device' },
      views: { persian: { enabled: false, open: false }, gregorian: { enabled: true, open: true } },
      holidays: { sources: ['nuremberg'], user: [{ id: 'a', name: 'N', calendar: 'persian', month: 1, day: 1 }] },
    };
    expect(parseSettings(raw)).toEqual(raw);
  });

  it('replaces only the invalid fields', () => {
    const parsed = parseSettings({ copy: { calendar: 'julian', pattern: 'yyyy', digits: 7 } });
    expect(parsed.copy).toEqual({ calendar: 'persian', pattern: 'yyyy', digits: 'latin' });
  });

  it('falls back to the default pattern when it is empty, blank, too long or not a string', () => {
    for (const pattern of ['', '   ', 'y'.repeat(MAX_PATTERN_LENGTH + 1), 5, null]) {
      expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe('yyyy-mm-dd');
    }
  });

  it('keeps a pattern exactly at the length limit, spaces included', () => {
    const pattern = ` ${'d'.repeat(MAX_PATTERN_LENGTH - 2)} `;
    expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe(pattern);
  });

  it('defaults the time source to the server', () => {
    expect(parseSettings(undefined).time).toEqual({ source: 'server' });
  });

  it('keeps a valid time source and replaces an invalid one, independently of copy', () => {
    expect(parseSettings({ time: { source: 'device' } }).time.source).toBe('device');
    for (const source of ['ntp', 1, null, undefined]) {
      expect(parseSettings({ time: { source }, copy: { digits: 'persian' } })).toEqual({
        ...DEFAULT_SETTINGS, copy: { ...DEFAULT_SETTINGS.copy, digits: 'persian' },
      });
    }
    for (const time of ['device', [], 3]) {
      expect(parseSettings({ time }).time.source).toBe('server');
    }
  });

  it('ignores unknown keys', () => {
    expect(parseSettings({ copy: {}, extra: 1 })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('views and holidays groups', () => {
  it('defaults: both views on, Persian open, every holiday source, no user holidays', () => {
    const s = parseSettings(undefined);
    expect(s.views).toEqual({ persian: { enabled: true, open: true }, gregorian: { enabled: true, open: false } });
    expect(s.holidays).toEqual({ sources: ['ir', 'nuremberg', 'user'], user: [] });
  });

  it('keeps valid view flags and replaces invalid ones field by field', () => {
    const s = parseSettings({ views: { persian: { enabled: false, open: 'yes' }, gregorian: { open: true } } });
    expect(s.views).toEqual({ persian: { enabled: false, open: true }, gregorian: { enabled: true, open: true } });
  });

  it('keeps known sources once each, in canonical order; an empty list is a valid choice', () => {
    expect(parseSettings({ holidays: { sources: ['user', 'x', 'ir', 'ir'] } }).holidays.sources).toEqual(['ir', 'user']);
    expect(parseSettings({ holidays: { sources: [] } }).holidays.sources).toEqual([]);
    expect(parseSettings({ holidays: { sources: 'ir' } }).holidays.sources).toEqual(HOLIDAY_SOURCES);
  });

  it('drops invalid user holidays one by one and keeps the rest', () => {
    const good = { id: 'a1', name: 'Birthday', calendar: 'persian', month: 7, day: 22 };
    const user = [
      good,
      { ...good, id: 'a1' },                              // duplicate id
      { ...good, id: 'b', name: '   ' },
      { ...good, id: 'c', calendar: 'hijri' },
      { ...good, id: 'd', month: 13 },
      { ...good, id: 'e', month: 7, day: 31 },            // Mehr has 30 days
      { ...good, id: 'f', year: 1.5 },
      'nope',
    ];
    expect(parseSettings({ holidays: { user } }).holidays.user).toEqual([good]);
    expect(parseSettings({ holidays: { user: 'x' } }).holidays.user).toEqual([]);
  });

  it('caps the list', () => {
    const user = Array.from({ length: MAX_USER_HOLIDAYS + 5 }, (_, i) => ({
      id: `id${i}`, name: `H${i}`, calendar: 'gregorian', month: 1, day: 1,
    }));
    expect(parseSettings({ holidays: { user } }).holidays.user).toHaveLength(MAX_USER_HOLIDAYS);
  });
});

describe('parseUserHoliday', () => {
  const base = { id: 'x-1', name: 'Name', calendar: 'gregorian', month: 2, day: 29 };

  it('accepts Feb 29 and Esfand 30 as yearly days', () => {
    expect(parseUserHoliday(base)).toEqual(base);
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30 })).not.toBeNull();
  });

  it('accepts them with a year only when that year has the day', () => {
    expect(parseUserHoliday({ ...base, year: 2028 })).toEqual({ ...base, year: 2028 });
    expect(parseUserHoliday({ ...base, year: 2027 })).toBeNull();
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30, year: 1403 })).not.toBeNull();
    expect(parseUserHoliday({ ...base, calendar: 'persian', month: 12, day: 30, year: 1405 })).toBeNull();
  });

  it('trims the name and enforces its length', () => {
    expect(parseUserHoliday({ ...base, name: '  Party  ' })?.name).toBe('Party');
    expect(parseUserHoliday({ ...base, name: 'x'.repeat(MAX_HOLIDAY_NAME_LENGTH) })).not.toBeNull();
    expect(parseUserHoliday({ ...base, name: 'x'.repeat(MAX_HOLIDAY_NAME_LENGTH + 1) })).toBeNull();
  });

  it('rejects malformed ids, years out of range and non-integers', () => {
    for (const bad of [
      { ...base, id: '' }, { ...base, id: 'a b' }, { ...base, id: 7 }, { ...base, name: 7 },
      { ...base, year: 1000 }, { ...base, calendar: 'persian', month: 1, day: 1, year: 1600 },
      { ...base, day: 0 }, { ...base, month: 2.5 }, null,
    ]) expect(parseUserHoliday(bad), JSON.stringify(bad)).toBeNull();
  });

  it('knows the longest each month can be', () => {
    expect([1, 6, 7, 11, 12].map((m) => maxDayOfMonth('persian', m))).toEqual([31, 31, 30, 30, 30]);
    expect([1, 2, 4, 12].map((m) => maxDayOfMonth('gregorian', m))).toEqual([31, 29, 30, 31]);
  });
});

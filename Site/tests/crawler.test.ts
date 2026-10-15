import { describe, expect, it, vi } from 'vitest';
import RAW_1405 from './fixtures/holidayapi-1405-holidays.json';
import OFFICIAL_1405 from './fixtures/ir-official-1405.json';
import {
  buildFile, crawlYear, dayUrl, DESCRIPTION_KEYS, keyFor, lunarHolidayDescriptions, sameHolidays,
  SOURCE, UnknownHolidayError,
} from '../../tools/holidays-crawler/holidayapi';
import { parseOfficialFile } from '../src/holidays/holiday-data';

const raw = RAW_1405 as Record<string, unknown>;
const NOT_A_HOLIDAY = { is_holiday: false, events: [] };

/** Serves the recording: recorded days as recorded, every other day as an ordinary day. */
const recorded = (): ((url: string) => Promise<unknown>) => async (url: string) => {
  const date = url.replace('https://holidayapi.ir/jalali/', '');
  return raw[date] ?? NOT_A_HOLIDAY;
};

describe('dayUrl', () => {
  it('pads month and day', () => {
    expect(dayUrl(1405, 4, 4)).toBe('https://holidayapi.ir/jalali/1405/04/04');
  });
});

describe('lunarHolidayDescriptions', () => {
  it('keeps religious holidays, and lunar ones the API forgot to flag religious', () => {
    expect(lunarHolidayDescriptions(raw['1405/04/04'])).toEqual(['عاشورای حسینی']);
    expect(lunarHolidayDescriptions(raw['1405/08/22'])).toEqual(['شهادت حضرت فاطمه زهرا (س)']);
  });

  it('drops Fridays and solar holidays', () => {
    expect(lunarHolidayDescriptions(raw['1405/01/12'])).toEqual([]);
    expect(lunarHolidayDescriptions(raw['1405/11/22'])).toEqual([]);
    expect(lunarHolidayDescriptions({ is_holiday: true, events: [{ description: 'جمعه', additional_description: '', is_holiday: true, is_religious: false }] })).toEqual([]);
  });

  it('normalises whitespace', () => {
    expect(lunarHolidayDescriptions(raw['1405/01/25'])).toEqual(['شهادت امام جعفر صادق (ع)']);
  });

  it('throws on a body that is not the API\'s shape', () => {
    for (const body of [null, 'x', {}, { events: 'x' }, { events: [null] }, { events: [{ description: 3 }] }]) {
      expect(() => lunarHolidayDescriptions(body), JSON.stringify(body)).toThrow();
    }
  });
});

describe('keyFor', () => {
  it('knows every lunar holiday the API reported for 1405', () => {
    for (const day of Object.values(raw)) {
      for (const d of lunarHolidayDescriptions(day)) expect(DESCRIPTION_KEYS[d], d).toBeDefined();
    }
  });

  it('fails loudly on a holiday it does not know', () => {
    expect(() => keyFor('عید جدید')).toThrow(UnknownHolidayError);
    expect(() => keyFor('عید جدید')).toThrow('عید جدید');
  });
});

describe('crawlYear', () => {
  it('turns the 1405 recording into exactly the official 1405 holidays, asking for every day once, in order', async () => {
    const fetchJson = vi.fn(recorded());
    const delay = vi.fn(async () => {});
    const holidays = await crawlYear(1405, { fetchJson, delay });
    expect(holidays).toEqual(OFFICIAL_1405.holidays);
    expect(fetchJson).toHaveBeenCalledTimes(365);              // one request per day of 1405 (not a leap year: no Esfand 30)
    expect(fetchJson.mock.calls[0]![0]).toBe(dayUrl(1405, 1, 1));
    expect(fetchJson.mock.calls.at(-1)![0]).toBe(dayUrl(1405, 12, 29));
    expect(delay).toHaveBeenCalledTimes(364);
  });

  it('fails on any fetch failure', async () => {
    const fetchJson = vi.fn(async () => { throw new Error('HTTP 500 for 1405/04/04'); });
    await expect(crawlYear(1405, { fetchJson, delay: async () => {} })).rejects.toThrow('HTTP 500');
  });

  it('fails on an unknown holiday', async () => {
    const fetchJson = vi.fn(async () => ({
      is_holiday: true,
      events: [{ description: 'عید جدید', additional_description: '۱ رجب', is_holiday: true, is_religious: true }],
    }));
    await expect(crawlYear(1405, { fetchJson, delay: async () => {} })).rejects.toThrow(UnknownHolidayError);
  });
});

describe('buildFile and sameHolidays', () => {
  it('builds a file the site accepts', () => {
    const file = buildFile(1405, OFFICIAL_1405.holidays as never, '2026-10-15');
    expect(file).toEqual({ year: 1405, source: SOURCE, fetched: '2026-10-15', holidays: OFFICIAL_1405.holidays });
    expect(parseOfficialFile(file, 1405)).not.toBeNull();
  });

  it('ignores the fetched date, so an unchanged crawl changes no file', () => {
    const holidays = OFFICIAL_1405.holidays as never;
    expect(sameHolidays({ ...OFFICIAL_1405, fetched: '1999-01-01' }, holidays)).toBe(true);
    expect(sameHolidays({ ...OFFICIAL_1405, holidays: [] }, holidays)).toBe(false);
    expect(sameHolidays(undefined, holidays)).toBe(false);
    expect(sameHolidays('garbage', holidays)).toBe(false);
  });
});

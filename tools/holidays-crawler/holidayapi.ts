import { daysInPersianMonth } from '../../Site/src/calendar/persian';
import type { IrLunarKey } from '../../Site/src/holidays/holiday-keys';

export const SOURCE = 'holidayapi.ir';

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const dayUrl = (py: number, pm: number, pd: number): string =>
  `https://holidayapi.ir/jalali/${py}/${pad2(pm)}/${pad2(pd)}`;

/** Pause between two requests, so the crawl stays polite to a free API. */
const REQUEST_GAP_MS = 200;

/**
 * Every lunar holiday holidayapi.ir reported for 1405, mapped to the site's key.
 * Descriptions are normalised (whitespace collapsed, trimmed) before lookup.
 */
export const DESCRIPTION_KEYS: Readonly<Record<string, IrLunarKey>> = {
  "عید سعید فطر": 'ir.fitr',
  "تعطیل به مناسبت عید سعید فطر": 'ir.fitr',
  "شهادت امام جعفر صادق (ع)": 'ir.sadiq',
  "عید سعید قربان": 'ir.adha',
  "عید سعید غدیر خم": 'ir.ghadir',
  "تاسوعای حسینی": 'ir.tasua',
  "عاشورای حسینی": 'ir.ashura',
  "اربعین حسینی": 'ir.arbaeen',
  "رحلت رسول اکرم؛شهادت امام حسن مجتبی (ع)": 'ir.prophet',
  "شهادت امام رضا (ع)": 'ir.reza',
  "شهادت امام حسن عسکری (ع)": 'ir.askari',
  "میلاد رسول اکرم و امام جعفر صادق (ع)": 'ir.mawlid',
  "شهادت حضرت فاطمه زهرا (س)": 'ir.fatima',
  "ولادت امام علی (ع) و روز پدر": 'ir.ali-birth',
  "مبعث رسول اکرم (ص)": 'ir.mabath',
  "ولادت حضرت قائم عجل الله تعالی فرجه و جشن نیمه شعبان": 'ir.mahdi',
  "شهادت حضرت علی (ع)": 'ir.ali-martyrdom',
};

export class UnknownHolidayError extends Error {
  constructor(description: string) {
    super(`Unknown holiday description from ${SOURCE}: "${description}"`);
    this.name = 'UnknownHolidayError';
  }
}

/**
 * Hijri month names as they appear in `additional_description`. The API leaves
 * `is_religious` false on some lunar holidays (Fatimah's martyrdom), so a Hijri
 * date there is the second signal that a holiday is lunar.
 */
const HIJRI_MONTH = /(محرم|صفر|ربیع|جمادی|رجب|شعبان|رمضان|شوال|ذوالقعده|ذوالحجه)/;

const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

interface ApiEvent { description: string; additional_description: string; is_holiday: boolean; is_religious: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isApiEvent = (value: unknown): value is ApiEvent =>
  isRecord(value)
  && typeof value.description === 'string'
  && typeof value.additional_description === 'string'
  && typeof value.is_holiday === 'boolean'
  && typeof value.is_religious === 'boolean';

/** The normalised descriptions of the lunar holidays in one day's response. */
export function lunarHolidayDescriptions(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.events) || !body.events.every(isApiEvent)) {
    throw new Error('Unexpected response shape');
  }
  return body.events
    .filter((e) => e.is_holiday && (e.is_religious || HIJRI_MONTH.test(e.additional_description)))
    .map((e) => normalise(e.description));
}

export function keyFor(description: string): IrLunarKey {
  const key = DESCRIPTION_KEYS[description];
  if (key === undefined) throw new UnknownHolidayError(description);
  return key;
}

export interface CrawlDeps { fetchJson(url: string): Promise<unknown>; delay(ms: number): Promise<void> }

/** Asks for every day of `py` in order and returns its lunar holidays in date order. */
export async function crawlYear(py: number, deps: CrawlDeps): Promise<{ key: IrLunarKey; p: string }[]> {
  const holidays: { key: IrLunarKey; p: string }[] = [];
  let first = true;
  for (let pm = 1; pm <= 12; pm += 1) {
    for (let pd = 1; pd <= daysInPersianMonth(py, pm); pd += 1) {
      if (!first) await deps.delay(REQUEST_GAP_MS);
      first = false;
      const body = await deps.fetchJson(dayUrl(py, pm, pd));
      for (const description of lunarHolidayDescriptions(body)) {
        holidays.push({ key: keyFor(description), p: `${py}-${pad2(pm)}-${pad2(pd)}` });
      }
    }
  }
  return holidays;
}

export function buildFile(
  py: number,
  holidays: readonly { key: IrLunarKey; p: string }[],
  fetched: string,
): { year: number; source: string; fetched: string; holidays: { key: IrLunarKey; p: string }[] } {
  return { year: py, source: SOURCE, fetched, holidays: holidays.map((h) => ({ key: h.key, p: h.p })) };
}

/** True when `existing` already holds exactly these holidays; the fetched date is ignored. */
export function sameHolidays(existing: unknown, holidays: readonly { key: IrLunarKey; p: string }[]): boolean {
  return isRecord(existing) && Array.isArray(existing.holidays)
    && JSON.stringify(existing.holidays) === JSON.stringify(holidays);
}

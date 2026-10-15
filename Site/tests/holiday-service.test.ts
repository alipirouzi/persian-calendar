// Site/tests/holiday-service.test.ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings/settings-model';
import { createHolidayService, OFFICIAL_RETRY_MS } from '../src/holidays/holiday-service';
import type { OfficialFile } from '../src/holidays/holiday-data';

const FILE_1405: OfficialFile = {
  year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
  holidays: [{ key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 5 } }],
};
const storeWith = (settings: Settings = DEFAULT_SETTINGS) => ({ get: () => settings });
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('holiday service', () => {
  it('shows estimates at once, then the official file once it arrives, and notifies', async () => {
    const fetchFile = vi.fn(async (py: number) => (py === 1405 ? FILE_1405 : null));
    const service = createHolidayService({ store: storeWith(), fetchFile });
    const listener = vi.fn();
    service.subscribe(listener);

    expect(service.forMonth('persian', 1405, 4).get(4)?.[0]).toMatchObject({ key: 'ir.ashura', estimated: true });
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.forMonth('persian', 1405, 4).get(5)?.[0]).toMatchObject({ key: 'ir.ashura', estimated: false });
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('fetches each Persian year the month touches, once', async () => {
    const fetchFile = vi.fn(async (_py: number): Promise<OfficialFile | null> => null);
    const service = createHolidayService({ store: storeWith(), fetchFile });
    service.forMonth('gregorian', 2026, 3);
    service.forMonth('gregorian', 2026, 3);
    expect(fetchFile.mock.calls.map(([py]) => py).sort()).toEqual([1404, 1405]);
  });

  it('fetches a single Persian year for a Gregorian month inside one year', () => {
    const fetchFile = vi.fn(async (_py: number): Promise<OfficialFile | null> => null);
    createHolidayService({ store: storeWith(), fetchFile }).forMonth('gregorian', 2026, 10);
    expect(fetchFile.mock.calls.map(([py]) => py)).toEqual([1405]);
  });

  it('retries a failed year only after an hour', async () => {
    let now = 0;
    const fetchFile = vi.fn(async () => null);
    const service = createHolidayService({ store: storeWith(), fetchFile, dateNow: () => now });
    service.forMonth('persian', 1405, 1);
    await flush();
    service.forMonth('persian', 1405, 1);
    expect(fetchFile).toHaveBeenCalledTimes(1);
    now = OFFICIAL_RETRY_MS;
    service.forMonth('persian', 1405, 1);
    expect(fetchFile).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when Iranian holidays are off', () => {
    const fetchFile = vi.fn(async () => FILE_1405);
    const settings = { ...DEFAULT_SETTINGS, holidays: { ...DEFAULT_SETTINGS.holidays, sources: ['nuremberg'] as const } };
    createHolidayService({ store: storeWith(settings), fetchFile }).forMonth('persian', 1405, 4);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('probe refetches and updates, but an empty probe keeps good data', async () => {
    let answer: OfficialFile | null = FILE_1405;
    const fetchFile = vi.fn(async () => answer);
    const service = createHolidayService({ store: storeWith(), fetchFile });
    const listener = vi.fn();
    service.subscribe(listener);
    await expect(service.probe(1405)).resolves.toBe(FILE_1405);
    expect(listener).toHaveBeenCalledTimes(1);
    answer = null;
    await expect(service.probe(1405)).resolves.toBeNull();
    expect(service.forMonth('persian', 1405, 4).get(5)?.[0]).toMatchObject({ estimated: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes', async () => {
    const service = createHolidayService({ store: storeWith(), fetchFile: async () => FILE_1405 });
    const listener = vi.fn();
    service.subscribe(listener)();
    service.forMonth('persian', 1405, 4);
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('uses the real fetch and clock by default', async () => {
    const realFetch = vi.fn<typeof fetch>(async () => new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', realFetch);
    try {
      createHolidayService({ store: storeWith() }).forMonth('persian', 1405, 1);
      await flush();
      expect(realFetch).toHaveBeenCalledWith('/api/holidays/ir/1405.json');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

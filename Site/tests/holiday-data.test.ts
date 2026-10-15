import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOfficialFile, holidayFileUrl, parseOfficialFile } from '../src/holidays/holiday-data';

const VALID = {
  year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
  holidays: [{ key: 'ir.ashura', p: '1405-04-04' }, { key: 'ir.tasua', p: '1405-04-03' }],
};

describe('parseOfficialFile', () => {
  it('accepts a valid file and parses the dates', () => {
    expect(parseOfficialFile(VALID, 1405)).toEqual({
      year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12',
      holidays: [
        { key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 4 } },
        { key: 'ir.tasua', p: { py: 1405, pm: 4, pd: 3 } },
      ],
    });
  });

  it('accepts Esfand 30 only in a leap year', () => {
    // 1403 is a leap year; 1405 is not.
    const leap = { ...VALID, year: 1403, holidays: [{ key: 'ir.fitr', p: '1403-12-30' }] };
    expect(parseOfficialFile(leap, 1403)).not.toBeNull();
    const notLeap = { ...VALID, holidays: [{ key: 'ir.fitr', p: '1405-12-30' }] };
    expect(parseOfficialFile(notLeap, 1405)).toBeNull();
  });

  it('rejects the whole file for any defect', () => {
    const broken: unknown[] = [
      null, 'x', [], {},
      { ...VALID, year: 1406 },                                   // not the requested year
      { ...VALID, year: '1405' },
      { ...VALID, source: '' },
      { ...VALID, fetched: '12.10.2026' },
      { ...VALID, holidays: 'none' },
      { ...VALID, holidays: [null] },
      { ...VALID, holidays: [{ key: 'ir.nowruz', p: '1405-01-01' }] },  // solar keys are not official-file keys
      { ...VALID, holidays: [{ key: 'ir.unknown', p: '1405-04-04' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1406-04-04' }] },  // date outside the year
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-13-01' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-07-31' }] },  // Mehr has 30 days
      { ...VALID, holidays: [{ key: 'ir.ashura', p: '1405-4-4' }] },
      { ...VALID, holidays: [{ key: 'ir.ashura', p: 14050404 }] },
    ];
    for (const raw of broken) expect(parseOfficialFile(raw, 1405), JSON.stringify(raw)).toBeNull();
  });
});

describe('fetchOfficialFile', () => {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('fetches the year\'s file from our own origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(VALID));
    await expect(fetchOfficialFile(1405, fetchImpl)).resolves.toMatchObject({ year: 1405 });
    expect(fetchImpl).toHaveBeenCalledWith(holidayFileUrl(1405));
    expect(holidayFileUrl(1405)).toBe('/api/holidays/ir/1405.json');
  });

  describe('with the global fetch', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('calls fetch with the URL alone', async () => {
      const globalFetch = vi.fn<typeof fetch>(async () => json(VALID));
      vi.stubGlobal('fetch', globalFetch);
      await expect(fetchOfficialFile(1405)).resolves.toMatchObject({ year: 1405 });
      expect(globalFetch).toHaveBeenCalledWith(holidayFileUrl(1405));
    });
  });

  it.each([
    ['a 404', async () => new Response('Not found', { status: 404 })],
    ['a network error', async () => { throw new TypeError('offline'); }],
    ['an HTML page', async () => new Response('<!doctype html>', { status: 200 })],
    ['an invalid file', async () => json({ ...VALID, year: 1406 })],
  ])('gives null for %s', async (_label, answer) => {
    await expect(fetchOfficialFile(1405, vi.fn<typeof fetch>(answer as () => Promise<Response>))).resolves.toBeNull();
  });
});

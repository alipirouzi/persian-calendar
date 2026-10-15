// Site/tests/merge.test.ts
import { describe, expect, it } from 'vitest';
import { holidaysForMonth, type MergeInput } from '../src/holidays/merge';
import type { OfficialFile } from '../src/holidays/holiday-data';

const NO_FILE = (): OfficialFile | null => null;
const ALL: MergeInput = { sources: ['ir', 'nuremberg', 'user'], user: [], official: NO_FILE };
const summary = (map: ReadonlyMap<number, readonly { source: string; estimated: boolean; key?: string; name?: string }[]>) =>
  [...map].map(([day, list]) => `${day}:${list.map((h) => `${h.source}/${h.key ?? h.name}${h.estimated ? '*' : ''}`).join(',')}`);

describe('holidaysForMonth', () => {
  it('Farvardin 1405: Nowruz, Eid al-Fitr estimated, Sizdah Bedar; nothing from Nuremberg', () => {
    const days = summary(holidaysForMonth('persian', 1405, 1, ALL));
    expect(days).toContain('1:ir/ir.nowruz,ir/ir.fitr*');
    expect(days).toContain('13:ir/ir.nature');
    expect(days.find((d) => d.startsWith('24:'))).toBe('24:ir/ir.sadiq*');
  });

  it('a Gregorian month that straddles Nowruz shows both Persian years', () => {
    const days = summary(holidaysForMonth('gregorian', 2026, 3, ALL));
    expect(days).toContain('20:ir/ir.oil,ir/ir.fitr*');      // 29 Esfand 1404 + 1 Shawwal 1447
    expect(days).toContain('21:ir/ir.nowruz,ir/ir.fitr*');   // 1 Farvardin 1405
  });

  it('Nuremberg holidays by Gregorian date, in either view', () => {
    expect(summary(holidaysForMonth('gregorian', 2026, 4, ALL))).toEqual(
      expect.arrayContaining(['3:nuremberg/by.good-friday', '6:nuremberg/by.easter-monday']),
    );
    // 3 April 2026 is 14 Farvardin 1405.
    expect(summary(holidaysForMonth('persian', 1405, 1, ALL))).toContain('14:nuremberg/by.good-friday');
  });

  it('uses the official file for lunar dates when there is one, unflagged', () => {
    const official = (py: number): OfficialFile | null => (py === 1405
      ? { year: 1405, source: 's', fetched: '2026-10-12', holidays: [{ key: 'ir.ashura', p: { py: 1405, pm: 4, pd: 5 } }] }
      : null);
    const days = summary(holidaysForMonth('persian', 1405, 4, { ...ALL, official }));
    expect(days).toEqual(['5:ir/ir.ashura']);   // the estimate's Tasua/Ashura on 3–4 Tir are gone
  });

  it('shows only the enabled sources; none at all gives an empty map', () => {
    expect(summary(holidaysForMonth('gregorian', 2026, 4, { ...ALL, sources: ['nuremberg'] })))
      .toEqual(['3:nuremberg/by.good-friday', '6:nuremberg/by.easter-monday']);
    expect(holidaysForMonth('persian', 1405, 1, { ...ALL, sources: [] }).size).toBe(0);
  });

  it('places yearly and one-off user holidays in either calendar', () => {
    const user = [
      { id: 'a', name: 'Yearly', calendar: 'persian' as const, month: 7, day: 22 },
      { id: 'b', name: 'Once', calendar: 'gregorian' as const, month: 10, day: 14, year: 2026 },
      { id: 'c', name: 'Other year', calendar: 'gregorian' as const, month: 10, day: 14, year: 2027 },
    ];
    // Mehr 1405 also holds German Unity Day (3 Oct = 11 Mehr), so look at user holidays only.
    expect(summary(holidaysForMonth('persian', 1405, 7, { ...ALL, sources: ['user'], user }))).toEqual(['22:user/Yearly,user/Once']);
    expect(summary(holidaysForMonth('gregorian', 2026, 10, { ...ALL, sources: ['user'], user }))).toEqual(['14:user/Yearly,user/Once']);
  });

  it('shows Esfand 30 and Feb 29 only in years that have them', () => {
    const user = [
      { id: 'e', name: 'Esfand 30', calendar: 'persian' as const, month: 12, day: 30 },
      { id: 'f', name: 'Feb 29', calendar: 'gregorian' as const, month: 2, day: 29 },
    ];
    const only = { ...ALL, sources: ['user'] as const, user };
    expect(summary(holidaysForMonth('persian', 1403, 12, only))).toEqual(['30:user/Esfand 30']); // leap
    expect(holidaysForMonth('persian', 1405, 12, only).size).toBe(0);
    expect(summary(holidaysForMonth('gregorian', 2028, 2, only))).toEqual(['29:user/Feb 29']);
    expect(holidaysForMonth('gregorian', 2026, 2, only).size).toBe(0);
  });
});

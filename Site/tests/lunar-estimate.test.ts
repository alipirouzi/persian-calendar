import { describe, expect, it } from 'vitest';
import OFFICIAL_1405 from './fixtures/ir-official-1405.json';
import { toGregorian } from '../src/calendar/persian';
import { estimateIrLunar, umalquraHijri, type HijriOf } from '../src/holidays/lunar-estimate';

const day = (p: { py: number; pm: number; pd: number }): number => {
  const g = toGregorian(p);
  return Date.UTC(g.gy, g.gm - 1, g.gd) / 86_400_000;
};
const parse = (s: string) => {
  const [py, pm, pd] = s.split('-').map(Number) as [number, number, number];
  return { py, pm, pd };
};

describe('umalquraHijri', () => {
  it('reads Umm al-Qura month and day for a Gregorian date', () => {
    expect(umalquraHijri({ gy: 2026, gm: 6, gd: 25 })).toEqual({ hm: 1, hd: 10 }); // Ashura 1448
  });
});

describe('estimateIrLunar', () => {
  it('estimates 1405 in date order, Tasua and Ashura on 3–4 Tir', () => {
    const list = estimateIrLunar(1405).map((h) => `${h.p.pm}-${h.p.pd} ${h.key}`);
    expect(list).toContain('4-3 ir.tasua');
    expect(list).toContain('4-4 ir.ashura');
    expect(list[0]).toBe('1-1 ir.fitr'); // 2 Shawwal 1447 is Nowruz (1 Shawwal is 29 Esfand 1404) — correct as written
    const order = estimateIrLunar(1405).map((h) => day(h.p));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('marks the last day of Safar, whether Safar has 29 or 30 days', () => {
    const reza = estimateIrLunar(1405).filter((h) => h.key === 'ir.reza');
    expect(reza.map((h) => `${h.p.pm}-${h.p.pd}`)).toEqual(['5-22']);
  });

  it('keeps both occurrences of a Hijri date that falls twice in one Persian year', () => {
    const aliMartyrdom = estimateIrLunar(1404).filter((h) => h.key === 'ir.ali-martyrdom');
    expect(aliMartyrdom.map((h) => `${h.p.pm}-${h.p.pd}`)).toEqual(['1-1', '12-19']);
    expect(estimateIrLunar(1404).filter((h) => h.key === 'ir.fitr')).toHaveLength(3);
  });

  it('is within a day of every official 1405 holiday', () => {
    const estimates = estimateIrLunar(1405);
    for (const official of OFFICIAL_1405.holidays) {
      const near = estimates.some((e) => e.key === official.key
        && Math.abs(day(e.p) - day(parse(official.p))) <= 1);
      expect(near, `${official.key} ${official.p}`).toBe(true);
    }
  });

  it('memoizes per year', () => {
    expect(estimateIrLunar(1405)).toBe(estimateIrLunar(1405));
  });

  it('estimates nothing when the runtime has no Umm al-Qura calendar', () => {
    const none: HijriOf = () => null;
    expect(estimateIrLunar(1405, none)).toEqual([]);
  });
});

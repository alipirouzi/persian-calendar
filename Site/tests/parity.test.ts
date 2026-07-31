import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLeapPersianYear, toGregorian, toPersian } from '../src/calendar/persian';

interface Vector { py: number; pm: number; pd: number; gy: number; gm: number; gd: number }

const VECTORS_PATH = join(__dirname, 'fixtures', 'vectors.json');

function loadVectors(): Vector[] {
  try {
    return JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as Vector[];
  } catch {
    throw new Error(
      `Missing or unreadable ${VECTORS_PATH}. Run \`npm run gen:vectors\` first (requires the .NET SDK).`,
    );
  }
}

describe('parity with System.Globalization.PersianCalendar', () => {
  const vectors = loadVectors();

  it('covers the full supported range', () => {
    expect(vectors[0]).toMatchObject({ py: 1200, pm: 1, pd: 1 });
    expect(vectors[vectors.length - 1]).toMatchObject({ py: 1500, pm: 12 });
    expect(vectors.length).toBeGreaterThan(109_000);
  });

  it('toGregorian matches .NET for every day 1200–1500', () => {
    for (const v of vectors) {
      const g = toGregorian({ py: v.py, pm: v.pm, pd: v.pd });
      if (g.gy !== v.gy || g.gm !== v.gm || g.gd !== v.gd) {
        expect.fail(`P ${v.py}/${v.pm}/${v.pd}: TS→${g.gy}-${g.gm}-${g.gd}, .NET→${v.gy}-${v.gm}-${v.gd}`);
      }
    }
  });

  it('toPersian matches .NET for every day 1200–1500', () => {
    for (const v of vectors) {
      const p = toPersian({ gy: v.gy, gm: v.gm, gd: v.gd });
      if (p.py !== v.py || p.pm !== v.pm || p.pd !== v.pd) {
        expect.fail(`G ${v.gy}-${v.gm}-${v.gd}: TS→${p.py}/${p.pm}/${p.pd}, .NET→${v.py}/${v.pm}/${v.pd}`);
      }
    }
  });

  it('leap years match .NET (year has 366 vector days ⇔ isLeapPersianYear)', () => {
    const daysPerYear = new Map<number, number>();
    for (const v of vectors) daysPerYear.set(v.py, (daysPerYear.get(v.py) ?? 0) + 1);
    for (const [py, days] of daysPerYear) {
      expect(isLeapPersianYear(py), `year ${py}`).toBe(days === 366);
    }
  });
});

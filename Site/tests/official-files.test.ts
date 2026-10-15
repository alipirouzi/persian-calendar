import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERSIAN_YEAR_MAX, PERSIAN_YEAR_MIN, toGregorian, type PersianDateParts } from '../src/calendar/persian';
import { parseOfficialFile } from '../src/holidays/holiday-data';
import { estimateIrLunar } from '../src/holidays/lunar-estimate';

// Acceptance check for the data files the holiday workflow proposes. Its PRs are opened with the
// default token, which does not trigger CI, so this runs on master after merge (and locally on the PR branch).
const PUBLIC_DIR = join(__dirname, '..', 'public');
const DATA_DIR = join(PUBLIC_DIR, 'api', 'holidays', 'ir');
const FILE_NAME = /^(\d{4})\.json$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const files: [string, number][] = existsSync(DATA_DIR)
  ? readdirSync(DATA_DIR).flatMap((name) => {
    const match = FILE_NAME.exec(name);
    return match ? [[name, Number(match[1])] as [string, number]] : [];
  })
  : [];

const epochDay = (p: PersianDateParts): number => {
  const g = toGregorian(p);
  return Date.UTC(g.gy, g.gm - 1, g.gd) / DAY_MS;
};

describe('official Iranian holiday files', () => {
  it(`finds the data directory from the test's location (${files.length} file(s) found; passes vacuously when none)`, () => {
    // A wrong path would also find no files, so prove the path resolves to the real public/ directory.
    expect(existsSync(join(PUBLIC_DIR, 'sw.js'))).toBe(true);
    expect(files.every(([name]) => FILE_NAME.test(name))).toBe(true);
  });

  it.each(files)('%s parses and every date is within a day of the estimate', (name, year) => {
    const raw: unknown = JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
    const file = parseOfficialFile(raw, year);
    expect(file, `${name} is not a valid official file`).not.toBeNull();
    // A holiday near Nowruz can be estimated in the neighbouring year.
    const estimates = [year - 1, year, year + 1]
      .filter((py) => py >= PERSIAN_YEAR_MIN && py <= PERSIAN_YEAR_MAX)
      .flatMap((py) => estimateIrLunar(py));
    for (const holiday of file!.holidays) {
      const day = epochDay(holiday.p);
      const near = estimates.some((e) => e.key === holiday.key && Math.abs(epochDay(e.p) - day) <= 1);
      expect(near, `${holiday.key} on ${holiday.p.py}-${holiday.p.pm}-${holiday.p.pd} is more than a day from its estimate`).toBe(true);
    }
  });
});

// Usage (from Site/): npx tsx ../tools/holidays-crawler/crawl.ts public/api/holidays/ir
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gregorianPartsIn } from '../../Site/src/calendar/now';
import { toPersian } from '../../Site/src/calendar/persian';
import { parseOfficialFile } from '../../Site/src/holidays/holiday-data';
import { buildFile, crawlYear, sameHolidays } from './holidayapi';

const ATTEMPTS = 3;

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => { setTimeout(resolve, 2000 * attempt); });
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('Usage: crawl.ts <output directory>');
  const todayInTehran = gregorianPartsIn('Asia/Tehran', new Date());
  const fetched = `${todayInTehran.gy}-${String(todayInTehran.gm).padStart(2, '0')}-${String(todayInTehran.gd).padStart(2, '0')}`;
  const currentYear = toPersian(todayInTehran).py;
  mkdirSync(outDir, { recursive: true });
  for (const py of [currentYear, currentYear + 1]) {
    const holidays = await crawlYear(py, { fetchJson, delay: (ms) => new Promise((r) => { setTimeout(r, ms); }) });
    const path = join(outDir, `${py}.json`);
    if (holidays.length === 0) {
      // Not published yet: an empty file would read as "no official data" anyway (the client
      // keeps its estimates), so writing one would only churn the repository.
      console.log(`${py}: no lunar holidays published yet; skipped`);
      continue;
    }
    const existing: unknown = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
    if (sameHolidays(existing, holidays)) {
      console.log(`${py}: unchanged (${holidays.length} holidays)`);
      continue;
    }
    const file = buildFile(py, holidays, fetched);
    if (parseOfficialFile(file, py) === null) throw new Error(`${py}: the site would reject this file`);
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`${py}: wrote ${holidays.length} holidays`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

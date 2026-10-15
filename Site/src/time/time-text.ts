import { formatTemplate, STRINGS, toLocaleDigits, type Lang } from '../i18n/strings';
import type { ProbeResult, TimeStatus } from './time-source';

const seconds = (ms: number, lang: Lang): string => {
  const value = (Math.abs(ms) / 1000).toFixed(1);
  // formatTemplate localizes the digits; Persian also has its own decimal separator.
  return lang === 'fa' ? value.replace('.', '٫') : value;
};

const MINUTE_MS = 60_000;

/** offset = server − device, so a positive offset means the device is behind. */
export function driftText(offsetMs: number, lang: Lang): string {
  const strings = STRINGS[lang];
  // Below 50 ms the one-decimal value would read 0.0, so call it accurate.
  if (Math.abs(offsetMs) < 50) return strings.driftNone;
  if (Math.abs(offsetMs) >= MINUTE_MS) {
    const template = offsetMs > 0 ? strings.driftSlowMin : strings.driftFastMin;
    return formatTemplate(template, { m: Math.round(Math.abs(offsetMs) / MINUTE_MS) }, lang);
  }
  const template = offsetMs > 0 ? strings.driftSlow : strings.driftFast;
  return formatTemplate(template, { s: seconds(offsetMs, lang) }, lang);
}

const clockTime = (ms: number, lang: Lang, timeZone: string | undefined): string =>
  toLocaleDigits(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(ms), lang);

export function statusText(status: TimeStatus, lang: Lang, timeZone?: string): string {
  const strings = STRINGS[lang];
  switch (status.kind) {
    case 'device': return strings.statusDevice;
    case 'syncing': return strings.statusSyncing;
    case 'unsynced': return strings.statusUnsynced;
    case 'synced': return formatTemplate(strings.statusSynced, {
      time: clockTime(status.atMs, lang, timeZone), drift: driftText(status.offsetMs, lang),
    }, lang);
  }
}

export function probeText(result: ProbeResult, lang: Lang): string {
  const strings = STRINGS[lang];
  return result.ok
    ? formatTemplate(strings.testOk, { rtt: result.rttMs, drift: driftText(result.offsetMs, lang) }, lang)
    : strings.testFail;
}

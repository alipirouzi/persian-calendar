import { describe, expect, it } from 'vitest';
import { driftText, probeText, statusText } from '../src/time/time-text';

const AT = Date.UTC(2026, 9, 15, 14, 2, 30);

describe('driftText', () => {
  it('says which way the device is off, to a tenth of a second', () => {
    expect(driftText(0, 'en')).toBe('device clock accurate');
    expect(driftText(300, 'en')).toBe('device 0.3 s slow');
    expect(driftText(-1_250, 'en')).toBe('device 1.3 s fast');
  });

  it('uses Persian digits and the Persian decimal separator', () => {
    expect(driftText(300, 'fa')).toBe('ساعت دستگاه ۰٫۳ ثانیه عقب است');
    expect(driftText(-1_250, 'fa')).toBe('ساعت دستگاه ۱٫۳ ثانیه جلو است');
    expect(driftText(0, 'fa')).toBe('ساعت دستگاه دقیق است');
  });
});

describe('statusText', () => {
  it('names each state', () => {
    expect(statusText({ kind: 'device' }, 'en')).toBe("Using this device's clock");
    expect(statusText({ kind: 'syncing' }, 'en')).toBe('Syncing…');
    expect(statusText({ kind: 'unsynced' }, 'en')).toBe("Not synced — using this device's clock");
  });

  it('gives the sync time in 24-hour wall-clock time and the drift', () => {
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 300 }, 'en', 'UTC'))
      .toBe('Synced 14:02 · device 0.3 s slow');
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 0 }, 'fa', 'UTC'))
      .toBe('همگام‌شده ۱۴:۰۲ · ساعت دستگاه دقیق است');
  });

  it('defaults to the viewer\'s time zone', () => {
    expect(statusText({ kind: 'synced', atMs: AT, offsetMs: 0 }, 'en')).toMatch(/^Synced \d\d:\d\d · /);
  });
});

describe('probeText', () => {
  it('reports success with the round trip and the drift, or failure', () => {
    expect(probeText({ ok: true, rttMs: 84, offsetMs: 300 }, 'en')).toBe('OK · 84 ms · device 0.3 s slow');
    expect(probeText({ ok: true, rttMs: 84, offsetMs: 0 }, 'fa')).toBe('برقرار · ۸۴ میلی‌ثانیه · ساعت دستگاه دقیق است');
    expect(probeText({ ok: false }, 'en')).toBe('Unreachable');
    expect(probeText({ ok: false }, 'fa')).toBe('در دسترس نیست');
  });
});

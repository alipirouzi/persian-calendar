import { describe, expect, it } from 'vitest';
import { driftText, probeText, statusText } from '../src/time/time-text';

const AT = Date.UTC(2026, 9, 15, 14, 2, 30);

describe('driftText', () => {
  it('says which way the device is off, to a tenth of a second', () => {
    expect(driftText(0, 'en')).toBe('device clock accurate');
    expect(driftText(300, 'en')).toBe('device 0.3 s slow');
    expect(driftText(-1_250, 'en')).toBe('device 1.3 s fast');
  });

  it('calls anything that would round to 0.0 s accurate', () => {
    expect(driftText(49, 'en')).toBe('device clock accurate');
    expect(driftText(-49, 'en')).toBe('device clock accurate');
    expect(driftText(50, 'en')).toBe('device 0.1 s slow');
  });

  it('uses Persian digits and the Persian decimal separator', () => {
    expect(driftText(300, 'fa')).toBe('ساعت دستگاه ۰٫۳ ثانیه عقب است');
    expect(driftText(-1_250, 'fa')).toBe('ساعت دستگاه ۱٫۳ ثانیه جلو است');
    expect(driftText(0, 'fa')).toBe('ساعت دستگاه دقیق است');
  });
});

describe('driftText for large drifts', () => {
  it('switches to whole minutes from one minute up', () => {
    expect(driftText(59_949, 'en')).toBe('device 59.9 s slow');
    expect(driftText(60_000, 'en')).toBe('device 1 min slow');
    expect(driftText(180_000, 'en')).toBe('device 3 min slow');
    expect(driftText(-3_600_000, 'en')).toBe('device 60 min fast');
  });

  it('uses Persian digits for minutes', () => {
    expect(driftText(180_000, 'fa')).toBe('ساعت دستگاه ۳ دقیقه عقب است');
    expect(driftText(-3_600_000, 'fa')).toBe('ساعت دستگاه ۶۰ دقیقه جلو است');
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
      .toBe('همگام‌شده در ۱۴:۰۲ · ساعت دستگاه دقیق است');
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

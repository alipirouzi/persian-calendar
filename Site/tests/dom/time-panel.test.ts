import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { setupTimeSettings } from '../../src/time/time-panel';
import type { ProbeResult, TimeStatus } from '../../src/time/time-source';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string): string => byId(id).textContent ?? '';

let lang: Lang;
let store: SettingsStore;
let status: TimeStatus;
let listeners: Set<() => void>;
let probe: Mock<() => Promise<ProbeResult>>;
let panel: { rerender: () => void };

const emit = (): void => { for (const listener of listeners) listener(); };

beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  store = createSettingsStore();
  status = { kind: 'unsynced' };
  listeners = new Set();
  probe = vi.fn<() => Promise<ProbeResult>>(async () => ({ ok: true, rttMs: 84, offsetMs: 0 }));
  panel = setupTimeSettings({
    store,
    getLang: () => lang,
    time: {
      status: () => status,
      probe,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
  });
});

describe('time settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupTimeSettings({
      store, getLang: () => lang, time: { status: () => status, probe, subscribe: () => () => {} },
    })).toThrow('#set-time-source');
  });

  it('labels the server option with this site\'s host', () => {
    const option = byId<HTMLSelectElement>('set-time-source').options[0]!;
    expect(option.value).toBe('server');
    expect(option.textContent).toBe(window.location.host);
  });

  it('shows the stored source and the current status when the dialog opens', () => {
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    status = { kind: 'device' };
    clickOn(byId('settings-toggle'));
    expect(byId<HTMLSelectElement>('set-time-source').value).toBe('device');
    expect(text('set-time-status')).toBe("Using this device's clock");
  });

  it('stores a new source and keeps the copy settings', () => {
    store.update((s) => ({ ...s, copy: { ...s.copy, digits: 'persian' } }));
    const select = byId<HTMLSelectElement>('set-time-source');
    select.value = 'device';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().time.source).toBe('device');
    expect(store.get().copy.digits).toBe('persian');
  });

  it('follows the time source as it syncs', () => {
    expect(text('set-time-status')).toBe("Not synced — using this device's clock");
    status = { kind: 'syncing' };
    emit();
    expect(text('set-time-status')).toBe('Syncing…');
  });

  it('runs a test, marking the button aria-disabled meanwhile, and reports the result', async () => {
    let answer: (result: ProbeResult) => void = () => {};
    probe.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const button = byId<HTMLButtonElement>('set-time-test');

    clickOn(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(text('set-time-test-result')).toBe('Testing…');
    clickOn(button);
    expect(probe).toHaveBeenCalledTimes(1);

    answer({ ok: true, rttMs: 84, offsetMs: 300 });
    await vi.waitFor(() => { expect(button.hasAttribute('aria-disabled')).toBe(false); });
    expect(text('set-time-test-result')).toBe('OK · 84 ms · device 0.3 s slow');
  });

  it('reports a failed test', async () => {
    probe.mockResolvedValue({ ok: false });
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).toBe('Unreachable'); });
  });

  it('clears the last test result when the dialog reopens', async () => {
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).not.toBe(''); });
    clickOn(byId('settings-toggle'));
    expect(text('set-time-test-result')).toBe('');
  });

  it('keeps "Testing…" when the dialog reopens mid-test', async () => {
    let answer: (result: ProbeResult) => void = () => {};
    probe.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    clickOn(byId('set-time-test'));
    clickOn(byId('settings-toggle'));
    expect(text('set-time-test-result')).toBe('Testing…');
    answer({ ok: false });
    await vi.waitFor(() => { expect(text('set-time-test-result')).toBe('Unreachable'); });
  });

  it('re-renders the status and the last result in the new language', async () => {
    clickOn(byId('set-time-test'));
    await vi.waitFor(() => { expect(text('set-time-test-result')).toMatch(/^OK/); });
    lang = 'fa';
    panel.rerender();
    expect(text('set-time-status')).toBe('همگام نشد — از ساعت همین دستگاه استفاده می‌شود');
    expect(text('set-time-test-result')).toBe('برقرار · ۸۴ میلی‌ثانیه · ساعت دستگاه دقیق است');
  });
});

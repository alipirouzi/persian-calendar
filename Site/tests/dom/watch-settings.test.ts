import { beforeEach, describe, expect, it } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { setupWatchSettings } from '../../src/watch/watch-settings';
import { clickOn } from './dom-helpers';

const BODY = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const select = () => document.getElementById('set-watch-face') as HTMLSelectElement;
let store: SettingsStore;
let lang: Lang;

beforeEach(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } } });
  document.body.innerHTML = BODY;
  lang = 'en';
  store = createSettingsStore();
});

describe('watch settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupWatchSettings({ store, getLang: () => lang })).toThrow('#set-watch-face');
  });

  it('shows the stored face when the dialog opens', () => {
    setupWatchSettings({ store, getLang: () => lang });
    store.update((s) => ({ ...s, watch: { face: 'classic' } }));
    clickOn(document.getElementById('settings-toggle')!);
    expect(select().value).toBe('classic');
  });

  it('stores a new face and keeps the other groups', () => {
    setupWatchSettings({ store, getLang: () => lang });
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    select().value = 'classic';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.get().watch.face).toBe('classic');
    expect(store.get().time.source).toBe('device');
  });

  it('rerender leaves the selection alone', () => {
    const { rerender } = setupWatchSettings({ store, getLang: () => lang });
    select().value = 'classic';
    rerender();
    expect(select().value).toBe('classic');
  });
});

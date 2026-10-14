import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import { setupSettingsPanel } from '../../src/settings/settings-panel';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import type { Lang } from '../../src/i18n/strings';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const DATE = { p: { py: 1403, pm: 10, pd: 22 }, g: { gy: 2025, gm: 1, gd: 11 } };

let lang: Lang;
let date: typeof DATE | null;
let store: SettingsStore;
let panel: ReturnType<typeof setupSettingsPanel>;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const dialog = (): HTMLDialogElement => byId<HTMLDialogElement>('settings-dialog');
const preview = (): string => byId('set-copy-preview').textContent ?? '';

const choose = (id: string, value: string): void => {
  const select = byId<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const BOX = { left: 100, right: 400, top: 100, bottom: 300 };
const INSIDE_PADDING = { x: 104, y: 104 };
const BACKDROP = { x: 20, y: 20 };

const stubDialogBox = (): void => {
  dialog().getBoundingClientRect = (): DOMRect => ({
    ...BOX, x: BOX.left, y: BOX.top, width: BOX.right - BOX.left, height: BOX.bottom - BOX.top, toJSON: () => ({}),
  });
};

const mouse = (el: Element, type: 'pointerdown' | 'click', at: { x: number; y: number }): MouseEvent => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y });
  el.dispatchEvent(event);
  return event;
};

const tap = (el: Element, at: { x: number; y: number }): void => {
  mouse(el, 'pointerdown', at);
  mouse(el, 'click', at);
};

const typeCustom = (value: string): void => {
  const input = byId<HTMLInputElement>('set-copy-custom');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeEach(() => {
  // jsdom 30 has no modal dialog; Playwright covers the real one.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  date = DATE;
  store = createSettingsStore();
  panel = setupSettingsPanel({ store, getLang: () => lang, getDate: () => date });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('settings panel', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupSettingsPanel({ store, getLang: () => 'en', getDate: () => null }))
      .toThrow(/Missing element #settings-toggle/);
  });

  it('gives the gear an accessible name in the current language', () => {
    expect(byId('settings-toggle').getAttribute('aria-label')).toBe('Settings');
    lang = 'fa';
    panel.rerender();
    expect(byId('settings-toggle').getAttribute('aria-label')).toBe('تنظیمات');
  });

  it('opens on the gear showing the stored settings and a preview', () => {
    store.update(() => ({ copy: { calendar: 'gregorian', pattern: 'dd.mm.yyyy', digits: 'persian' } }));

    clickOn(byId('settings-toggle'));

    expect(dialog().open).toBe(true);
    expect(byId<HTMLSelectElement>('set-copy-calendar').value).toBe('gregorian');
    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('dd.mm.yyyy');
    expect(byId<HTMLSelectElement>('set-copy-digits').value).toBe('persian');
    expect(byId('set-copy-custom-row').hidden).toBe(true);
    expect(preview()).toBe('۱۱.۰۱.۲۰۲۵');
  });

  it('shows a stored custom pattern in the custom field', () => {
    store.update((s) => ({ copy: { ...s.copy, pattern: 'yyyy.m.d' } }));

    clickOn(byId('settings-toggle'));

    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);
    expect(byId<HTMLInputElement>('set-copy-custom').value).toBe('yyyy.m.d');
  });

  it('stores each change and updates the preview', () => {
    clickOn(byId('settings-toggle'));

    choose('set-copy-calendar', 'both');
    expect(store.get().copy.calendar).toBe('both');
    expect(preview()).toBe('1403-10-22 / 2025-01-11');

    choose('set-copy-digits', 'persian');
    expect(store.get().copy.digits).toBe('persian');

    choose('set-copy-pattern', 'sentence');
    expect(store.get().copy.pattern).toBe('sentence');
    expect(preview()).toBe('Saturday, 22 Dey 1403 — January 11, 2025');
  });

  it('switches to a custom pattern and stores what is typed', () => {
    clickOn(byId('settings-toggle'));

    choose('set-copy-pattern', 'custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);

    typeCustom("'Day' d");
    expect(store.get().copy.pattern).toBe("'Day' d");
    expect(preview()).toBe('Day 22');
  });

  it('keeps focus on the select when Custom is chosen, so the choice can be reviewed', () => {
    clickOn(byId('settings-toggle'));
    const select = byId<HTMLSelectElement>('set-copy-pattern');
    select.focus();

    choose('set-copy-pattern', 'custom');

    expect(document.activeElement).toBe(select);
  });

  it('reuses a custom pattern already typed when Custom is chosen again', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');
    typeCustom('d/m');
    choose('set-copy-pattern', 'yyyy-mm-dd');
    expect(byId('set-copy-custom-row').hidden).toBe(true);

    choose('set-copy-pattern', 'custom');

    expect(store.get().copy.pattern).toBe('d/m');
  });

  it('keeps Custom selected while the custom field is cleared', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');
    typeCustom('d');

    typeCustom('');

    expect(store.get().copy.pattern).toBe('yyyy-mm-dd');
    expect(byId<HTMLSelectElement>('set-copy-pattern').value).toBe('custom');
    expect(byId('set-copy-custom-row').hidden).toBe(false);
  });

  it('previews a dash when there is no valid date', () => {
    date = null;
    clickOn(byId('settings-toggle'));
    expect(preview()).toBe('—');
  });

  it('closes on the close button', () => {
    clickOn(byId('settings-toggle'));

    clickOn(byId('settings-close'));

    expect(dialog().open).toBe(false);
  });

  it('closes when the backdrop is pressed and released outside the dialog box', () => {
    stubDialogBox();
    clickOn(byId('settings-toggle'));

    tap(dialog(), BACKDROP);

    expect(dialog().open).toBe(false);
  });

  it('stays open for clicks on its own padding and on its controls', () => {
    stubDialogBox();
    clickOn(byId('settings-toggle'));

    tap(dialog(), INSIDE_PADDING);
    tap(byId('set-copy-calendar'), BACKDROP);

    expect(dialog().open).toBe(true);
  });

  it('stays open when a drag that began inside ends on the backdrop', () => {
    stubDialogBox();
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');

    mouse(byId('set-copy-custom'), 'pointerdown', INSIDE_PADDING);
    mouse(dialog(), 'click', BACKDROP);

    expect(dialog().open).toBe(true);
  });

  it('stays open when a press on the backdrop is released inside the dialog box', () => {
    stubDialogBox();
    clickOn(byId('settings-toggle'));

    mouse(dialog(), 'pointerdown', BACKDROP);
    mouse(dialog(), 'click', INSIDE_PADDING);

    expect(dialog().open).toBe(true);
  });

  it('returns focus to the gear whenever the dialog closes', () => {
    clickOn(byId('settings-toggle'));
    byId('set-copy-calendar').focus();

    dialog().close();

    expect(document.activeElement).toBe(byId('settings-toggle'));
  });

  it('refreshes the preview language on rerender', () => {
    store.update((s) => ({ copy: { ...s.copy, pattern: 'MMMM' } }));
    clickOn(byId('settings-toggle'));
    expect(preview()).toBe('Dey');

    lang = 'fa';
    panel.rerender();

    expect(preview()).toBe('دی');
  });
});

describe('settings panel live preview', () => {
  const ANNOUNCE_DELAY_MS = 600;
  const announcement = (): string => byId('set-copy-announce').textContent ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    byId('set-copy-preview-label').textContent = 'Copies as';
  });
  afterEach(() => { vi.useRealTimers(); });

  it('names the preview by its visible label and keeps the output itself silent', () => {
    const output = byId('set-copy-preview');

    expect(byId(output.getAttribute('aria-labelledby') as string).textContent).toBe('Copies as');
    expect(output.getAttribute('aria-live')).toBe('off');
  });

  it('announces the labelled preview once typing has paused, not per keystroke', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-pattern', 'custom');

    typeCustom('y');
    typeCustom('yy');
    typeCustom('yyyy-mm-dd');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1);
    expect(announcement()).toBe('');
    expect(preview()).toBe('1403-10-22');

    vi.advanceTimersByTime(1);
    expect(announcement()).toBe('Copies as 1403-10-22');
  });

  it('does not announce when the dialog merely opens', () => {
    clickOn(byId('settings-toggle'));

    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(announcement()).toBe('');
  });

  it('drops a pending announcement and clears the last one when the dialog closes', () => {
    clickOn(byId('settings-toggle'));
    choose('set-copy-calendar', 'both');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(announcement()).not.toBe('');
    choose('set-copy-calendar', 'gregorian');

    dialog().close();
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);

    expect(announcement()).toBe('');
  });
});

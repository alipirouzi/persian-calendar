import { beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { OfficialFile } from '../../src/holidays/holiday-data';
import { setupHolidaySettings } from '../../src/holidays/holidays-panel';
import { setupUserHolidayForm } from '../../src/holidays/user-holiday-form';
import { MAX_USER_HOLIDAYS, parseUserHoliday } from '../../src/settings/settings-model';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const text = (id: string): string => byId(id).textContent ?? '';
const setValue = (id: string, value: string): void => {
  const el = byId<HTMLInputElement | HTMLSelectElement>(id);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};
const check = (id: string, on: boolean): void => {
  const box = byId<HTMLInputElement>(id);
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const entries = (): string[] =>
  [...byId('set-user-holidays').querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim() ?? '');

let lang: Lang;
let store: SettingsStore;
let probe: ReturnType<typeof vi.fn<(py: number) => Promise<OfficialFile | null>>>;
let panel: { rerender: () => void };
let ids: number;

beforeEach(() => {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  lang = 'en';
  ids = 0;
  store = createSettingsStore();
  probe = vi.fn(async () => null);
  panel = setupHolidaySettings({
    store, service: { probe }, getLang: () => lang,
    now: () => new Date(2026, 9, 15, 12), newId: () => `id-${++ids}`,
  });
  clickOn(byId('settings-toggle'));
});

describe('holiday settings', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';
    expect(() => setupHolidaySettings({ store, service: { probe }, getLang: () => lang, now: () => new Date() }))
      .toThrow('#set-view-persian');
  });

  it('the user-holiday form refuses to run without its markup either', () => {
    document.body.innerHTML = '';
    expect(() => setupUserHolidayForm({ store, getLang: () => lang, newId: () => 'x' })).toThrow('#set-user-holidays');
  });

  it('shows the stored view and source choices', () => {
    expect(byId<HTMLInputElement>('set-view-persian').checked).toBe(true);
    expect(byId<HTMLInputElement>('set-src-nuremberg').checked).toBe(true);
    expect(entries()).toEqual(['None yet']);
  });

  it('writes view and source checkboxes, keeping everything else', () => {
    store.update((s) => ({ ...s, time: { source: 'device' } }));
    check('set-view-gregorian', false);
    check('set-src-ir', false);
    expect(store.get().views.gregorian.enabled).toBe(false);
    expect(store.get().holidays.sources).toEqual(['nuremberg', 'user']);
    expect(store.get().time.source).toBe('device');
  });

  it('offers the chosen calendar\'s month names, in the current language', () => {
    const options = () => [...byId<HTMLSelectElement>('set-uh-month').options].map((o) => o.textContent);
    expect(options()[0]).toBe('Farvardin');
    setValue('set-uh-calendar', 'gregorian');
    expect(options()[0]).toBe('January');
    lang = 'fa';
    panel.rerender();
    expect(options()[0]).toBe('ژانویه');
  });

  it('adds a yearly holiday, accepting Persian digits, and clears the form', () => {
    setValue('set-uh-name', 'Birthday');
    setValue('set-uh-month', '7');
    setValue('set-uh-day', '۲۲');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user).toEqual([{ id: 'id-1', name: 'Birthday', calendar: 'persian', month: 7, day: 22 }]);
    expect(entries()).toEqual(['Birthday 22 Mehr · every year Edit Delete']);
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('');
  });

  it('adds a one-off holiday with a year', () => {
    setValue('set-uh-name', 'Trip');
    setValue('set-uh-calendar', 'gregorian');
    setValue('set-uh-month', '2');
    setValue('set-uh-day', '29');
    setValue('set-uh-year', '2028');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user[0]).toMatchObject({ calendar: 'gregorian', month: 2, day: 29, year: 2028 });
    expect(entries()[0]).toContain('29 February 2028');
  });

  it('refuses a day that does not exist, and stores nothing', () => {
    setValue('set-uh-name', 'Nope');
    setValue('set-uh-month', '12');
    setValue('set-uh-day', '30');
    setValue('set-uh-year', '1405'); // not a leap year
    clickOn(byId('set-uh-save'));
    expect(byId('set-uh-error').hidden).toBe(false);
    expect(text('set-uh-error')).toBe('Enter a name and a date that exists');
    expect(store.get().holidays.user).toEqual([]);
    setValue('set-uh-year', '');
    clickOn(byId('set-uh-save'));
    expect(byId('set-uh-error').hidden).toBe(true);
    expect(store.get().holidays.user).toHaveLength(1);
  });

  it('edits in place and cancels', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [
      { id: 'a', name: 'One', calendar: 'persian', month: 1, day: 1 },
      { id: 'b', name: 'Two', calendar: 'persian', month: 2, day: 2 },
    ] } }));
    clickOn(byId('set-user-holidays').querySelectorAll('li')[0]!.querySelector('button')!);
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('One');
    expect(text('set-uh-save')).toBe('Save');
    expect(byId('set-uh-cancel').hidden).toBe(false);
    setValue('set-uh-name', 'First');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user.map((u) => `${u.id}:${u.name}`)).toEqual(['a:First', 'b:Two']);
    clickOn(byId('set-user-holidays').querySelectorAll('li')[1]!.querySelector('button')!);
    clickOn(byId('set-uh-cancel'));
    expect(byId<HTMLInputElement>('set-uh-name').value).toBe('');
    expect(text('set-uh-save')).toBe('Add');
  });

  it('edit fills a one-off holiday\'s calendar, month, day and year', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [
      { id: 'g', name: 'Trip', calendar: 'gregorian', month: 2, day: 29, year: 2028 },
    ] } }));
    clickOn(byId('set-user-holidays').querySelector('button')!);
    expect(byId<HTMLSelectElement>('set-uh-calendar').value).toBe('gregorian');
    expect(byId<HTMLSelectElement>('set-uh-month').selectedOptions[0]?.textContent).toBe('February');
    expect(byId<HTMLInputElement>('set-uh-day').value).toBe('29');
    expect(byId<HTMLInputElement>('set-uh-year').value).toBe('2028');
  });

  it('deletes, and names each button after its holiday', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [{ id: 'a', name: 'One', calendar: 'persian', month: 1, day: 1 }] } }));
    const buttons = byId('set-user-holidays').querySelectorAll('button');
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Edit One');
    expect(buttons[1]!.getAttribute('aria-label')).toBe('Delete One');
    clickOn(buttons[1]!);
    expect(store.get().holidays.user).toEqual([]);
  });

  it('enforces the list limit for new holidays', () => {
    const user = Array.from({ length: MAX_USER_HOLIDAYS }, (_, i) => ({
      id: `h${i}`, name: `H${i}`, calendar: 'persian' as const, month: 1, day: 1,
    }));
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user } }));
    setValue('set-uh-name', 'One more');
    setValue('set-uh-day', '5');
    clickOn(byId('set-uh-save'));
    expect(text('set-uh-error')).toBe(`You can keep up to ${MAX_USER_HOLIDAYS} holidays`);
    expect(store.get().holidays.user).toHaveLength(MAX_USER_HOLIDAYS);
  });

  it('tests the official data for the current Persian year', async () => {
    probe.mockResolvedValueOnce({ year: 1405, source: 'holidayapi.ir', fetched: '2026-10-12', holidays: [] });
    clickOn(byId('set-holidays-test'));
    expect(byId('set-holidays-test').getAttribute('aria-disabled')).toBe('true');
    expect(text('set-holidays-test-result')).toBe('Testing…');
    clickOn(byId('set-holidays-test'));
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(1405);
    await vi.waitFor(() => { expect(text('set-holidays-test-result')).toBe('OK · 1405 official data · updated 2026-10-12'); });
    expect(byId('set-holidays-test').hasAttribute('aria-disabled')).toBe(false);
    clickOn(byId('set-holidays-test'));
    await vi.waitFor(() => { expect(text('set-holidays-test-result')).toBe('No official data for 1405 — using estimates'); });
    lang = 'fa';
    panel.rerender();
    expect(text('set-holidays-test-result')).toBe('داده رسمی برای ۱۴۰۵ نیست — تخمین‌ها استفاده می‌شوند');
  });

  it('renders user names as text only', () => {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: [{ id: 'x', name: '<img src=x>', calendar: 'persian', month: 1, day: 1 }] } }));
    expect(byId('set-user-holidays').querySelector('img')).toBeNull();
    expect(byId('set-user-holidays').querySelector('.uh-name')?.textContent).toBe('<img src=x>');
  });

  it('by default gives a new holiday a crypto.randomUUID() id, which round-trips through the model', () => {
    document.body.innerHTML = BODY;
    setupHolidaySettings({ store, service: { probe }, getLang: () => lang, now: () => new Date() });
    setValue('set-uh-name', 'Real id');
    setValue('set-uh-day', '3');
    clickOn(byId('set-uh-save'));
    const [saved] = store.get().holidays.user;
    expect(saved?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(parseUserHoliday({ ...saved })).toEqual(saved);
  });

  describe('focus and stale edits', () => {
    const seed = (...names: string[]): void => {
      store.update((s) => ({ ...s, holidays: { ...s.holidays, user: names.map((name, i) => ({
        id: `s${i}`, name, calendar: 'persian' as const, month: 1, day: i + 1,
      })) } }));
    };
    const button = (label: string): HTMLButtonElement =>
      document.querySelector<HTMLButtonElement>(`#set-user-holidays button[aria-label="${label}"]`)!;

    it('Edit and Cancel put focus in the name field', () => {
      seed('A');
      clickOn(button('Edit A'));
      expect(document.activeElement).toBe(byId('set-uh-name'));
      byId('set-uh-save').focus();
      clickOn(byId('set-uh-cancel'));
      expect(document.activeElement).toBe(byId('set-uh-name'));
    });

    it('Delete of a middle row focuses the row that took its place', () => {
      seed('A', 'B', 'C');
      clickOn(button('Delete B'));
      expect(document.activeElement).toBe(button('Edit C'));
    });

    it('Delete of the last row focuses the row before it', () => {
      seed('A', 'B');
      clickOn(button('Delete B'));
      expect(document.activeElement).toBe(button('Edit A'));
    });

    it('Delete of the only row focuses the name field', () => {
      seed('A');
      clickOn(button('Delete A'));
      expect(document.activeElement).toBe(byId('set-uh-name'));
    });

    it('deleting the entry being edited drops the edit, so Save cannot bring it back', () => {
      seed('A');
      clickOn(button('Edit A'));
      clickOn(button('Delete A'));
      expect(text('set-uh-save')).toBe('Add');
      expect(byId<HTMLInputElement>('set-uh-name').value).toBe('');
      expect(byId('set-uh-cancel').hidden).toBe(true);
      clickOn(byId('set-uh-save'));
      expect(store.get().holidays.user).toEqual([]);
    });
  });

  describe('the form error', () => {
    const fields = ['set-uh-name', 'set-uh-day', 'set-uh-year'];

    it('points the fields at the error and marks them invalid only while it shows', () => {
      for (const id of fields) expect(byId(id).getAttribute('aria-describedby')).toBe('set-uh-error');
      clickOn(byId('set-uh-save'));
      for (const id of fields) expect(byId(id).getAttribute('aria-invalid')).toBe('true');
      setValue('set-uh-name', 'B');
      expect(byId('set-uh-error').hidden).toBe(true);
      for (const id of fields) expect(byId(id).hasAttribute('aria-invalid')).toBe(false);
    });

    it('clears when a select changes too', () => {
      clickOn(byId('set-uh-save'));
      setValue('set-uh-month', '3');
      expect(byId('set-uh-error').hidden).toBe(true);
    });

    it('is emptied and re-set on every failed save, so the alert speaks again', () => {
      clickOn(byId('set-uh-save'));
      const seen: string[] = [];
      const observer = new MutationObserver(() => undefined);
      observer.observe(byId('set-uh-error'), { childList: true, subtree: true, characterData: true });
      clickOn(byId('set-uh-save'));
      for (const record of observer.takeRecords()) {
        seen.push(record.type === 'childList' && record.addedNodes.length === 0 ? 'cleared' : 'set');
      }
      observer.disconnect();
      expect(seen[0]).toBe('cleared');
      expect(seen.at(-1)).toBe('set');
      expect(text('set-uh-error')).toBe('Enter a name and a date that exists');
    });
  });

  it('labels the checkbox groups by their subheads, and the list as My holidays', () => {
    const groups = [...document.querySelectorAll('.settings-holidays [role="group"]')];
    expect(groups.map((g) => byId(g.getAttribute('aria-labelledby')!).dataset['str'])).toEqual(['viewsLabel', 'holidaySourcesLabel']);
    expect(groups[0]!.querySelector('#set-view-persian')).not.toBeNull();
    expect(groups[1]!.querySelector('#set-src-user')).not.toBeNull();
    expect(byId('set-user-holidays').getAttribute('aria-label')).toBe('My holidays');
    lang = 'fa';
    panel.rerender();
    expect(byId('set-user-holidays').getAttribute('aria-label')).toBe('تعطیلات من');
  });

  it('keeps a Gregorian calendar choice after a save, with the month back at 1', () => {
    setValue('set-uh-name', 'G');
    setValue('set-uh-calendar', 'gregorian');
    setValue('set-uh-month', '5');
    setValue('set-uh-day', '1');
    clickOn(byId('set-uh-save'));
    expect(store.get().holidays.user[0]).toMatchObject({ calendar: 'gregorian', month: 5 });
    expect(byId<HTMLSelectElement>('set-uh-calendar').value).toBe('gregorian');
    expect(byId<HTMLSelectElement>('set-uh-month').value).toBe('1');
    expect(byId<HTMLSelectElement>('set-uh-month').selectedOptions[0]?.textContent).toBe('January');
  });
});

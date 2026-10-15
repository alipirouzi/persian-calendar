// Site/tests/dom/calendar-panels.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { DayHoliday, MonthHolidays } from '../../src/holidays/merge';
import { createSettingsStore, type SettingsStore } from '../../src/settings/settings-store';
import { groupHolidayRuns, setupCalendarPanels } from '../../src/views/calendar-panels';
import { clickOn } from './dom-helpers';

const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

// 2026-03-21 12:00 local = 1 Farvardin 1405 (a Saturday).
let now: Date;
let lang: Lang;
let store: SettingsStore;
let forMonth: ReturnType<typeof vi.fn<(side: string, y: number, m: number) => MonthHolidays>>;
let onPickDay: ReturnType<typeof vi.fn>;
let panels: { rerender: () => void; refreshToday: () => void };

const panel = (side: 'persian' | 'gregorian') => document.getElementById(`view-${side}`) as HTMLDetailsElement;
const q = <T extends Element>(side: 'persian' | 'gregorian', sel: string) => panel(side).querySelector(sel) as T;
const title = (side: 'persian' | 'gregorian') => q(side, '.mv-title').textContent;
const day = (side: 'persian' | 'gregorian', n: number) =>
  panel(side).querySelector<HTMLButtonElement>(`.mv-day[data-day="${n}"]`)!;
const items = (side: 'persian' | 'gregorian') =>
  [...panel(side).querySelectorAll('.mv-holidays li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());

const NOWRUZ: DayHoliday = { source: 'ir', key: 'ir.nowruz', estimated: false };
const FITR_EST: DayHoliday = { source: 'ir', key: 'ir.fitr', estimated: true };

beforeEach(() => {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } },
  });
  document.body.innerHTML = BODY;
  document.documentElement.dir = 'ltr';
  now = new Date(2026, 2, 21, 12);
  lang = 'en';
  store = createSettingsStore();
  forMonth = vi.fn((side: string, _y: number, m: number): MonthHolidays =>
    (side === 'persian' && m === 1 ? new Map([[1, [NOWRUZ, FITR_EST]]]) : new Map()));
  onPickDay = vi.fn();
  panels = setupCalendarPanels({ store, holidays: { forMonth }, getLang: () => lang, now: () => now, onPickDay });
});

describe('calendar panels', () => {
  it('opens on today\'s month in each calendar, with that calendar\'s week order', () => {
    expect(title('persian')).toBe('Farvardin 1405');
    expect(title('gregorian')).toBe('March 2026');
    const heads = (side: 'persian' | 'gregorian') => [...q(side, 'thead tr').children].map((th) => th.textContent);
    expect(heads('persian')[0]).toBe('Sat');
    expect(heads('gregorian')[0]).toBe('Mon');
  });

  it('starts Persian open and Gregorian closed, both visible', () => {
    expect(panel('persian').open).toBe(true);
    expect(panel('gregorian').open).toBe(false);
    expect(panel('persian').hidden || panel('gregorian').hidden).toBe(false);
  });

  it('outlines today and marks holidays with an accessible description', () => {
    expect(day('persian', 1).classList.contains('today')).toBe(true);
    expect(day('persian', 1).getAttribute('aria-current')).toBe('date');
    expect(day('persian', 1).classList.contains('holiday')).toBe(true);
    expect(day('persian', 1).getAttribute('aria-label')).toBe('1 Farvardin 1405 — Nowruz; Eid al-Fitr');
    expect(day('persian', 2).classList.contains('holiday')).toBe(false);
    expect(day('persian', 2).getAttribute('aria-label')).toBe('2 Farvardin 1405');
  });

  it('lists the month\'s holidays with source and estimate tags', () => {
    expect(items('persian')).toEqual(['1 Farvardin Nowruz Iran', '1 Farvardin Eid al-Fitr Iran estimated']);
    expect(items('gregorian')).toEqual(['No holidays this month']);
  });

  it('renders a user holiday name as text, never as markup', () => {
    forMonth.mockImplementation(() => new Map([[5, [{ source: 'user', id: 'x', name: '<b>Party</b>', estimated: false }]]]));
    panels.rerender();
    const name = panel('persian').querySelector('.mv-name')!;
    expect(name.textContent).toBe('<b>Party</b>');
    expect(name.querySelector('b')).toBeNull();
    expect(items('persian')[0]).toContain('Mine');
  });

  it('pages by month, stops following today, and Today brings it back', () => {
    clickOn(q('persian', '.mv-next'));
    expect(title('persian')).toBe('Ordibehesht 1405');
    expect(forMonth).toHaveBeenLastCalledWith('persian', 1405, 2);
    now = new Date(2026, 3, 25, 12); // a month later
    panels.refreshToday();
    expect(title('persian')).toBe('Ordibehesht 1405');
    clickOn(q('persian', '.mv-prev'));
    clickOn(q('persian', '.mv-prev'));
    expect(title('persian')).toBe('Esfand 1404');
    clickOn(q('persian', '.mv-today'));
    expect(title('persian')).toBe('Ordibehesht 1405');
  });

  it('follows today across a month change until the user pages', () => {
    now = new Date(2026, 3, 1, 0, 0, 30); // 1 April 2026
    panels.refreshToday();
    expect(title('gregorian')).toBe('April 2026');
    expect(day('gregorian', 1).classList.contains('today')).toBe(true);
  });

  it('labels the arrows and disables them at the edge of the range', () => {
    expect(q('persian', '.mv-prev').getAttribute('aria-label')).toBe('Previous month');
    expect(q('persian', '.mv-next').getAttribute('aria-label')).toBe('Next month');
    now = new Date(2121, 11, 15, 12); // the last supported Gregorian month
    panels.refreshToday();
    expect(q<HTMLButtonElement>('gregorian', '.mv-next').disabled).toBe(true);
  });

  it('picks a day for the converter, converting between calendars', () => {
    clickOn(day('persian', 13));
    expect(onPickDay).toHaveBeenCalledWith({ py: 1405, pm: 1, pd: 13 }, { gy: 2026, gm: 4, gd: 2 });
    clickOn(day('gregorian', 20));
    expect(onPickDay).toHaveBeenLastCalledWith({ py: 1404, pm: 12, pd: 29 }, { gy: 2026, gm: 3, gd: 20 });
  });

  it('stores a panel being opened or closed, and hides a disabled view', () => {
    panel('gregorian').open = true;
    panel('gregorian').dispatchEvent(new Event('toggle'));
    expect(store.get().views.gregorian.open).toBe(true);
    store.update((s) => ({ ...s, views: { ...s.views, persian: { enabled: false, open: true } } }));
    expect(panel('persian').hidden).toBe(true);
  });

  it('ignores a toggle event that matches what is stored', () => {
    const update = vi.spyOn(store, 'update');
    panel('persian').dispatchEvent(new Event('toggle'));
    expect(update).not.toHaveBeenCalled();
  });

  it('renders in Persian with Persian digits', () => {
    lang = 'fa';
    panels.rerender();
    expect(title('persian')).toBe('فروردین ۱۴۰۵');
    expect(day('persian', 13).textContent).toBe('۱۳');
    expect(items('persian')[1]).toBe('۱ فروردین عید سعید فطر ایران تخمینی');
  });

  it('ignores clicks between day buttons', () => {
    clickOn(q('persian', 'tbody'));
    expect(onPickDay).not.toHaveBeenCalled();
  });
  it('refuses to step past the range even if a disabled arrow is clicked', () => {
    now = new Date(2121, 11, 15, 12);
    panels.refreshToday();
    const next = q<HTMLButtonElement>('gregorian', '.mv-next');
    next.disabled = false;
    clickOn(next);
    expect(title('gregorian')).toBe('December 2121');
  });

  it('throws when the panel markup is missing', () => {
    const deps = { store, holidays: { forMonth }, getLang: () => lang, now: () => now, onPickDay };
    document.body.innerHTML = '';
    expect(() => setupCalendarPanels(deps)).toThrow('#view-persian');
    document.body.innerHTML = '<details id="view-persian"></details><details id="view-gregorian"></details>';
    expect(() => setupCalendarPanels(deps)).toThrow('.mv-prev');
  });
  it('lists consecutive days of one holiday as a single range', () => {
    const NOWRUZ_EST: DayHoliday = { source: 'ir', key: 'ir.nowruz', estimated: true };
    forMonth.mockImplementation(() => new Map([
      [1, [NOWRUZ, FITR_EST]], [2, [NOWRUZ]], [3, [NOWRUZ]], [4, [NOWRUZ_EST]], [12, [NOWRUZ]],
    ]));
    panels.rerender();
    expect(items('persian')).toEqual([
      '1–3 Farvardin Nowruz Iran',
      '1 Farvardin Eid al-Fitr Iran estimated',
      '4 Farvardin Nowruz Iran estimated',
      '12 Farvardin Nowruz Iran',
    ]);
    lang = 'fa';
    panels.rerender();
    expect(items('persian')[0]).toBe('۱–۳ فروردین عید نوروز ایران');
    expect(day('persian', 2).getAttribute('aria-label')).toBe('۲ فروردین ۱۴۰۵ — عید نوروز');
  });

  it('keeps user holidays apart by id, and a recurring holiday apart when days are not consecutive', () => {
    const a: DayHoliday = { source: 'user', id: 'a', name: 'Trip', estimated: false };
    const b: DayHoliday = { source: 'user', id: 'b', name: 'Trip', estimated: false };
    expect(groupHolidayRuns(new Map([[7, [a]], [5, [a, b]], [6, [a]], [9, [a]]]))).toEqual([
      { from: 5, to: 7, holiday: a },
      { from: 5, to: 5, holiday: b },
      { from: 9, to: 9, holiday: a },
    ]);
    expect(groupHolidayRuns(new Map())).toEqual([]);
  });
  it('ignores a holiday listed twice on one day', () => {
    expect(groupHolidayRuns(new Map([[1, [NOWRUZ, NOWRUZ]], [2, [NOWRUZ]]]))).toEqual([
      { from: 1, to: 2, holiday: NOWRUZ },
    ]);
  });

  it('keeps a focused day focused, without rebuilding, when the minute refresh finds the same date', () => {
    const before = day('persian', 13);
    before.focus();
    now = new Date(2026, 2, 21, 12, 1);
    panels.refreshToday();
    expect(day('persian', 13)).toBe(before);
    expect(document.activeElement).toBe(before);
  });

  it('puts focus back on the same day after a re-render rebuilds the grid', () => {
    const before = day('persian', 13);
    before.focus();
    store.update((s) => ({ ...s, holidays: { ...s.holidays, sources: ['ir'] } }));
    expect(day('persian', 13)).not.toBe(before);
    expect(document.activeElement).toBe(day('persian', 13));
  });

  it('moves focus to Today when the focused arrow becomes disabled', () => {
    now = new Date(2121, 11, 15, 12);
    panels.refreshToday();
    clickOn(q('gregorian', '.mv-prev'));
    expect(title('gregorian')).toBe('November 2121');
    const next = q<HTMLButtonElement>('gregorian', '.mv-next');
    next.focus();
    clickOn(next);
    expect(next.disabled).toBe(true);
    expect(document.activeElement).toBe(q('gregorian', '.mv-today'));
    // An arrow that stays enabled keeps its focus.
    const prev = q<HTMLButtonElement>('gregorian', '.mv-prev');
    prev.focus();
    clickOn(prev);
    expect(document.activeElement).toBe(prev);
  });

  it('names the Today buttons, the grids and the section', () => {
    expect(q('persian', '.mv-today').getAttribute('aria-label')).toBe('Today — go to this month');
    const table = q('gregorian', '.mv-grid');
    const labelId = table.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)?.textContent).toBe('March 2026');
    expect(document.getElementById('calendars')?.getAttribute('aria-label')).toBe('Calendars');
    lang = 'fa';
    panels.rerender();
    expect(q('persian', '.mv-today').getAttribute('aria-label')).toBe('امروز — رفتن به ماه جاری');
    expect(document.getElementById('calendars')?.getAttribute('aria-label')).toBe('تقویم‌ها');
  });

  it('hides the whole section when both views are disabled', () => {
    const section = document.getElementById('calendars')!;
    store.update((s) => ({ ...s, views: { ...s.views, persian: { enabled: false, open: true } } }));
    expect(section.hidden).toBe(false);
    store.update((s) => ({ ...s, views: { ...s.views, gregorian: { enabled: false, open: false } } }));
    expect(section.hidden).toBe(true);
  });

  it('throws when the section around the panels is missing', () => {
    const section = document.getElementById('calendars')!;
    section.replaceWith(...section.childNodes);
    expect(() => setupCalendarPanels({ store, holidays: { forMonth }, getLang: () => lang, now: () => now, onPickDay }))
      .toThrow('#calendars');
  });
});

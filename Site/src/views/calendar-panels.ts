// Site/src/views/calendar-panels.ts
import { nowSnapshot } from '../calendar/now';
import {
  toGregorian, toPersian, type GregorianDateParts, type PersianDateParts,
} from '../calendar/persian';
import { buildMonthGrid, stepMonth } from '../converter/calendar-grid-model';
import type { Side } from '../converter/converter-core';
import type { HolidayService } from '../holidays/holiday-service';
import type { DayHoliday, MonthHolidays } from '../holidays/merge';
import { formatGregorianDate, formatPersianDate } from '../i18n/format';
import {
  GREGORIAN_MONTHS, HOLIDAY_NAMES, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { SettingsStore } from '../settings/settings-store';

export interface CalendarPanelsDeps {
  readonly store: SettingsStore;
  readonly holidays: Pick<HolidayService, 'forMonth'>;
  readonly getLang: () => Lang;
  readonly now: () => Date;
  readonly onPickDay: (p: PersianDateParts, g: GregorianDateParts) => void;
}

const SIDES: readonly Side[] = ['persian', 'gregorian'];

interface Shown { year: number; month: number; following: boolean }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function partsOf(side: Side, year: number, month: number, day: number): { p: PersianDateParts; g: GregorianDateParts } {
  if (side === 'persian') {
    const p = { py: year, pm: month, pd: day };
    return { p, g: toGregorian(p) };
  }
  const g = { gy: year, gm: month, gd: day };
  return { p: toPersian(g), g };
}

const holidayName = (h: DayHoliday, lang: Lang): string =>
  h.source === 'user' ? h.name : HOLIDAY_NAMES[lang][h.key];

/** One list entry: a holiday that falls on every day from `from` to `to`. */
export interface HolidayRun { readonly from: number; readonly to: number; readonly holiday: DayHoliday }

const identity = (h: DayHoliday): string =>
  `${h.source}|${h.source === 'user' ? h.id : h.key}|${String(h.estimated)}`;

/**
 * Joins consecutive days of the same holiday (same source, key or user id, and
 * estimate flag) into one run. Runs are ordered by first day, then by the order
 * the holidays had within that day.
 */
export function groupHolidayRuns(marks: MonthHolidays): HolidayRun[] {
  const runs: { from: number; to: number; holiday: DayHoliday }[] = [];
  const open = new Map<string, { from: number; to: number; holiday: DayHoliday }>();
  for (const [day, list] of [...marks].sort(([a], [b]) => a - b)) {
    for (const holiday of list) {
      const id = identity(holiday);
      const run = open.get(id);
      if (run && run.to === day - 1) {
        run.to = day;
      } else {
        const fresh = { from: day, to: day, holiday };
        runs.push(fresh);
        open.set(id, fresh);
      }
    }
  }
  return runs;
}

const days = (from: number, to: number, lang: Lang): string =>
  (from === to ? toLocaleDigits(from, lang) : `${toLocaleDigits(from, lang)}–${toLocaleDigits(to, lang)}`);

const SOURCE_LABEL = { ir: 'sourceIr', nuremberg: 'sourceNuremberg', user: 'sourceUser' } as const;

export function setupCalendarPanels(deps: CalendarPanelsDeps): { rerender(): void; refreshToday(): void } {
  const { store, holidays, getLang, now, onPickDay } = deps;

  const today = (side: Side): { year: number; month: number; day: number } => {
    const local = nowSnapshot(now()).local;
    return side === 'persian'
      ? { year: local.p.py, month: local.p.pm, day: local.p.pd }
      : { year: local.g.gy, month: local.g.gm, day: local.g.gd };
  };

  const shown: Record<Side, Shown> = {
    persian: { ...today('persian'), following: true },
    gregorian: { ...today('gregorian'), following: true },
  };

  const details = (side: Side): HTMLDetailsElement => {
    const node = document.getElementById(`view-${side}`);
    if (!node) throw new Error(`Missing element #view-${side}`);
    return node as HTMLDetailsElement;
  };
  const part = <T extends Element>(side: Side, selector: string): T => {
    const node = details(side).querySelector(selector);
    if (!node) throw new Error(`Missing ${selector} in #view-${side}`);
    return node as T;
  };

  const render = (side: Side): void => {
    const lang = getLang();
    const strings = STRINGS[lang];
    const view = store.get().views[side];
    const box = details(side);
    box.hidden = !view.enabled;
    if (box.open !== view.open) box.open = view.open;

    const { year, month } = shown[side];
    const grid = buildMonthGrid(side, year, month, lang);
    const marks = holidays.forMonth(side, year, month);
    const now = today(side);
    const isToday = (d: number): boolean => now.year === year && now.month === month && now.day === d;

    part<HTMLElement>(side, '.mv-title').textContent = grid.title;
    const prev = part<HTMLButtonElement>(side, '.mv-prev');
    const next = part<HTMLButtonElement>(side, '.mv-next');
    prev.disabled = !grid.canGoPrev;
    next.disabled = !grid.canGoNext;
    prev.setAttribute('aria-label', strings.prevMonth);
    next.setAttribute('aria-label', strings.nextMonth);

    const head = part<HTMLTableRowElement>(side, 'thead tr');
    head.replaceChildren(...grid.weekdayHeaders.map((label) => {
      const th = el('th', undefined, label);
      th.scope = 'col';
      return th;
    }));

    const body = part<HTMLTableSectionElement>(side, 'tbody');
    body.replaceChildren(...grid.weeks.map((week) => {
      const row = el('tr');
      for (const d of week) {
        const cell = el('td');
        if (d !== null) {
          const button = el('button', 'mv-day', toLocaleDigits(d, lang));
          button.type = 'button';
          button.dataset['day'] = String(d);
          const { p, g } = partsOf(side, year, month, d);
          const date = side === 'persian' ? formatPersianDate(p, lang) : formatGregorianDate(g, lang);
          const list = marks.get(d) ?? [];
          button.setAttribute('aria-label', list.length === 0
            ? date
            : `${date} — ${list.map((h) => holidayName(h, lang)).join('; ')}`);
          if (list.length > 0) button.classList.add('holiday');
          if (isToday(d)) {
            button.classList.add('today');
            button.setAttribute('aria-current', 'date');
          }
          cell.append(button);
        }
        row.append(cell);
      }
      return row;
    }));

    const names = side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
    const listEl = part<HTMLUListElement>(side, '.mv-holidays');
    const entries = groupHolidayRuns(marks);
    listEl.replaceChildren(...(entries.length === 0
      ? [el('li', 'mv-none', strings.noHolidays)]
      : entries.map(({ from, to, holiday: h }) => {
        const li = el('li');
        // Real spaces between the parts, so copied or read-out text is not run together.
        li.append(
          el('span', 'mv-when', `${days(from, to, lang)} ${names[month - 1] as string}`), ' ',
          el('span', 'mv-name', holidayName(h, lang)), ' ',
          el('span', 'mv-tag', strings[SOURCE_LABEL[h.source]]),
        );
        if (h.estimated) li.append(' ', el('span', 'mv-est', strings.estimated));
        return li;
      })));
  };

  const rerender = (): void => { for (const side of SIDES) render(side); };

  for (const side of SIDES) {
    part<HTMLButtonElement>(side, '.mv-prev').addEventListener('click', () => { step(side, -1); });
    part<HTMLButtonElement>(side, '.mv-next').addEventListener('click', () => { step(side, 1); });
    part<HTMLButtonElement>(side, '.mv-today').addEventListener('click', () => {
      shown[side] = { ...today(side), following: true };
      render(side);
    });
    part<HTMLElement>(side, 'tbody').addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('.mv-day');
      if (!button) return;
      const { p, g } = partsOf(side, shown[side].year, shown[side].month, Number(button.dataset['day']));
      onPickDay(p, g);
    });
    details(side).addEventListener('toggle', () => {
      const open = details(side).open;
      if (open === store.get().views[side].open) return;
      store.update((s) => ({ ...s, views: { ...s.views, [side]: { ...s.views[side], open } } }));
    });
  }

  function step(side: Side, delta: number): void {
    const target = stepMonth(side, shown[side].year, shown[side].month, delta);
    if (target === null) return;
    shown[side] = { ...target, following: false };
    render(side);
  }

  store.subscribe(rerender);

  const refreshToday = (): void => {
    for (const side of SIDES) {
      if (shown[side].following) shown[side] = { ...today(side), following: true };
      render(side);
    }
  };

  rerender();
  return { rerender, refreshToday };
}

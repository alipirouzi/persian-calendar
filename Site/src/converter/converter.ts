import { convertFrom, type Side } from './converter-core';
import { dayOptions, monthOptions, parseInRange, yearOptions } from './field-options';
import { formatUrlQuery } from './url-state';
import { createNumberPicker, type NumberPicker } from '../ui/number-picker';
import { createCalendarGrid, type CalendarGrid } from '../ui/calendar-grid';
import { restrictToDigits } from '../ui/numeric-input';
import { nowSnapshot } from '../calendar/now';
import { copySentence } from '../i18n/format';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';

const COPIED_RESET_MS = 1500;
const SIDES = ['persian', 'gregorian'] as const;
const ID_PREFIX: Record<Side, 'p' | 'g'> = { persian: 'p', gregorian: 'g' };

interface SideRefs {
  y: HTMLInputElement;
  m: HTMLInputElement;
  d: HTMLInputElement;
  yearToggle: HTMLButtonElement;
  monthToggle: HTMLButtonElement;
  dayToggle: HTMLButtonElement;
  yearList: HTMLElement;
  monthList: HTMLElement;
  dayList: HTMLElement;
  calButton: HTMLButtonElement;
  calPrev: HTMLButtonElement;
  calNext: HTMLButtonElement;
  yearPicker: NumberPicker;
  monthPicker: NumberPicker;
  dayPicker: NumberPicker;
  calendar: CalendarGrid;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function setupConverter(getLang: () => Lang): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
} {
  const error = byId<HTMLElement>('converter-error');
  const fullDate = byId<HTMLElement>('full-date');
  const btnToday = byId<HTMLButtonElement>('btn-today');
  const btnCopy = byId<HTMLButtonElement>('btn-copy');
  // The form exists for grouping and labelling only — there is nothing to submit,
  // and the default action reloads the page and discards the user's date.
  byId<HTMLFormElement>('converter-form').addEventListener('submit', (event) => {
    event.preventDefault();
  });

  let lastEdited: Side = 'persian';
  let lastOk: { p: PersianDateParts; g: GregorianDateParts } | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  /** Last day-option signature per side: keystrokes that cannot change the
      list skip rebuilding up to 31 nodes. */
  const dayKey: Record<Side, string> = { persian: '', gregorian: '' };

  // `run` is referenced by the picker callbacks below and defined further down;
  // function declarations hoist, and nothing can fire before setup returns.
  const refs = Object.fromEntries(SIDES.map((side) => {
    const p = ID_PREFIX[side];
    const y = byId<HTMLInputElement>(`${p}-y`);
    const m = byId<HTMLInputElement>(`${p}-m`);
    const d = byId<HTMLInputElement>(`${p}-d`);
    // Register the digit filter FIRST, before the pickers and before the
    // conversion listener below: listeners on one element fire in registration
    // order, so every later reader sees an already-cleaned value.
    for (const field of [y, m, d]) restrictToDigits(field);

    const yearToggle = byId<HTMLButtonElement>(`${p}-y-toggle`);
    const monthToggle = byId<HTMLButtonElement>(`${p}-m-toggle`);
    const dayToggle = byId<HTMLButtonElement>(`${p}-d-toggle`);
    const yearList = byId<HTMLElement>(`${p}-y-list`);
    const monthList = byId<HTMLElement>(`${p}-m-list`);
    const dayList = byId<HTMLElement>(`${p}-d-list`);
    const calButton = byId<HTMLButtonElement>(`${p}-cal`);
    const calPrev = byId<HTMLButtonElement>(`${p}-cal-prev`);
    const calNext = byId<HTMLButtonElement>(`${p}-cal-next`);
    const entry: SideRefs = {
      y, m, d,
      yearToggle, monthToggle, dayToggle,
      yearList, monthList, dayList,
      calButton, calPrev, calNext,
      yearPicker: createNumberPicker({
        input: y, toggle: yearToggle, list: yearList,
        onCommit: (value) => {
          y.value = toLocaleDigits(value, getLang());
          run(side, true);
        },
      }),
      monthPicker: createNumberPicker({
        input: m, toggle: monthToggle, list: monthList,
        onCommit: (value) => {
          m.value = toLocaleDigits(value, getLang());
          run(side, true);
        },
      }),
      dayPicker: createNumberPicker({
        input: d, toggle: dayToggle, list: dayList,
        onCommit: (value) => {
          d.value = toLocaleDigits(value, getLang());
          run(side, true);
        },
      }),
      calendar: createCalendarGrid({
        side,
        button: calButton,
        popup: byId<HTMLElement>(`${p}-cal-pop`),
        title: byId<HTMLElement>(`${p}-cal-title`),
        prev: calPrev,
        next: calNext,
        grid: byId<HTMLElement>(`${p}-cal-grid`),
        getLang,
        getCurrent: () => {
          const year = parseInRange(y.value, ...(side === 'persian' ? [1200, 1500] : [1822, 2121]) as [number, number]);
          const month = parseInRange(m.value, 1, 12);
          const day = parseInRange(d.value, 1, 31);
          return year === null || month === null || day === null
            ? null : { year, month, day };
        },
        getToday: () => {
          const snap = nowSnapshot().local;
          return side === 'persian'
            ? { year: snap.p.py, month: snap.p.pm, day: snap.p.pd }
            : { year: snap.g.gy, month: snap.g.gm, day: snap.g.gd };
        },
        onPick: (year, month, day) => {
          const lang = getLang();
          y.value = toLocaleDigits(year, lang);
          m.value = toLocaleDigits(month, lang);
          d.value = toLocaleDigits(day, lang);
          run(side, true);
        },
      }),
    };
    return [side, entry] as const;
  })) as Record<Side, SideRefs>;

  const setSide = (side: Side, p: PersianDateParts, g: GregorianDateParts): void => {
    const lang = getLang();
    const r = refs[side];
    if (side === 'persian') {
      r.y.value = toLocaleDigits(p.py, lang);
      r.m.value = toLocaleDigits(p.pm, lang);
      r.d.value = toLocaleDigits(p.pd, lang);
    } else {
      r.y.value = toLocaleDigits(g.gy, lang);
      r.m.value = toLocaleDigits(g.gm, lang);
      r.d.value = toLocaleDigits(g.gd, lang);
    }
  };

  const showError = (message: string | null): void => {
    error.hidden = message === null;
    error.textContent = message ?? '';
  };

  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    fullDate.hidden = ok === null;
    fullDate.textContent = ok === null ? '' : copySentence(ok.p, ok.g, getLang());
    btnCopy.disabled = ok === null;
  };

  /** Day options for both sides, after any field changes. */
  const refreshOptions = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      const key = `${lang}|${r.y.value}|${r.m.value}`;
      if (key === dayKey[side]) continue;
      dayKey[side] = key;
      r.dayPicker.setOptions(dayOptions(side, r.y.value, r.m.value, lang));
    }
  };

  /** Option lists and accessible names that depend only on the language. */
  const renderLabels = (): void => {
    const lang = getLang();
    for (const side of SIDES) {
      const r = refs[side];
      r.yearPicker.setOptions(yearOptions(side, lang));
      r.monthPicker.setOptions(monthOptions(side, lang));
      for (const [el, key] of [
        [r.yearToggle, 'chooseYear'], [r.yearList, 'chooseYear'],
        [r.monthToggle, 'chooseMonth'], [r.monthList, 'chooseMonth'],
        [r.dayToggle, 'chooseDay'], [r.dayList, 'chooseDay'],
      ] as const) {
        el.setAttribute('aria-label', STRINGS[lang][key]);
      }
      r.calButton.setAttribute('aria-label', STRINGS[lang].openCalendar);
      r.calPrev.setAttribute('aria-label', STRINGS[lang].prevMonth);
      r.calNext.setAttribute('aria-label', STRINGS[lang].nextMonth);
      r.calendar.rerender();
    }
    // Every day label carries digits and a weekday name, so a language change
    // invalidates all of them.
    dayKey.persian = '';
    dayKey.gregorian = '';
  };

  function run(source: Side, updateUrl: boolean): void {
    lastEdited = source;
    const lang = getLang();
    const f = refs[source];
    const outcome = convertFrom(source, { y: f.y.value, m: f.m.value, d: f.d.value });
    if (outcome.status === 'ok') {
      setSide(source === 'persian' ? 'gregorian' : 'persian', outcome.persian, outcome.gregorian);
      showError(null);
      setStatus({ p: outcome.persian, g: outcome.gregorian });
      if (updateUrl) {
        const { persian: p, gregorian: g } = outcome;
        history.replaceState(null, '', source === 'persian'
          ? formatUrlQuery('persian', p.py, p.pm, p.pd)
          : formatUrlQuery('gregorian', g.gy, g.gm, g.gd));
      }
      refreshOptions();
      return;
    }
    setStatus(null);
    if (outcome.status === 'incomplete') {
      showError(null);
      refreshOptions();
      return;
    }
    const params = { ...outcome.params };
    if (outcome.errorKey === 'errDay') {
      const months = outcome.side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      (params as Record<string, string | number>)['month'] =
        months[(outcome.params['month'] as number) - 1] as string;
    }
    showError(formatTemplate(STRINGS[lang][outcome.errorKey], params, lang));
    refreshOptions();
  }

  const prefill = (p: PersianDateParts, g: GregorianDateParts): void => {
    setSide('persian', p, g);
    setSide('gregorian', p, g);
    showError(null);
    setStatus({ p, g });
    refreshOptions();
  };

  renderLabels();

  for (const side of SIDES) {
    const r = refs[side];
    // Year and month both feed the day list: month length and weekday names
    // depend on the year, so a year edit must regenerate the days too.
    for (const field of [r.y, r.m, r.d]) {
      field.addEventListener('input', () => run(side, true));
    }
  }

  btnToday.addEventListener('click', () => {
    for (const side of SIDES) {
      refs[side].yearPicker.close();
      refs[side].monthPicker.close();
      refs[side].dayPicker.close();
      refs[side].calendar.close();
    }
    const snap = nowSnapshot();
    prefill(snap.local.p, snap.local.g);
    history.replaceState(null, '', window.location.pathname);
  });

  const flashCopyLabel = (key: 'copied' | 'copyFailed'): void => {
    const lang = getLang();
    btnCopy.textContent = STRINGS[lang][key];
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      btnCopy.textContent = STRINGS[getLang()].copy;
    }, COPIED_RESET_MS);
  };

  btnCopy.addEventListener('click', () => {
    if (lastOk === null) return;
    navigator.clipboard.writeText(copySentence(lastOk.p, lastOk.g, getLang()))
      .then(() => flashCopyLabel('copied'))
      .catch(() => flashCopyLabel('copyFailed'));
  });

  return {
    prefill,
    rerender: () => {
      renderLabels();
      // Own the copy button's label regardless of caller ordering: a pending
      // "Copied"/"Copy failed" flash must not survive a language toggle.
      clearTimeout(copiedTimer);
      btnCopy.textContent = STRINGS[getLang()].copy;
      // Language switch: refresh digits/labels on BOTH sides from the last
      // valid state (the user is not mid-typing during a toggle).
      if (lastOk !== null) {
        setSide('persian', lastOk.p, lastOk.g);
        setSide('gregorian', lastOk.p, lastOk.g);
        setStatus(lastOk);
        showError(null);
        refreshOptions();
      } else {
        run(lastEdited, false);
      }
    },
  };
}

import { normalizeDigits } from '../converter/converter-core';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import {
  MAX_USER_HOLIDAYS, parseUserHoliday, type UserHoliday, type UserHolidayCalendar,
} from '../settings/settings-model';
import type { SettingsStore } from '../settings/settings-store';
import { restrictToDigits } from '../ui/numeric-input';

interface Deps {
  store: SettingsStore;
  getLang: () => Lang;
  newId: () => string;
}

type FormError = 'holidayInvalid' | 'holidayLimit';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const monthNames = (calendar: UserHolidayCalendar, lang: Lang): readonly string[] =>
  (calendar === 'persian' ? PERSIAN_MONTHS : GREGORIAN_MONTHS)[lang];

const whenText = (holiday: UserHoliday, lang: Lang): string => {
  const month = monthNames(holiday.calendar, lang)[holiday.month - 1] as string;
  const tail = holiday.year === undefined
    ? ` · ${STRINGS[lang].everyYear}` : ` ${toLocaleDigits(holiday.year, lang)}`;
  return `${toLocaleDigits(holiday.day, lang)} ${month}${tail}`;
};

const span = (className: string, value: string): HTMLSpanElement => {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = value;
  return el;
};

const button = (label: string, name: string, onClick: () => void): HTMLButtonElement => {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.setAttribute('aria-label', `${label} ${name}`);
  el.addEventListener('click', onClick);
  return el;
};

/** "My holidays": the list with Edit/Delete, and the form that adds or edits one. */
export function setupUserHolidayForm({ store, getLang, newId }: Deps): { reset: () => void; rerender: () => void } {
  const list = byId<HTMLUListElement>('set-user-holidays');
  const form = byId<HTMLElement>('set-uh-form');
  const nameInput = byId<HTMLInputElement>('set-uh-name');
  const calendarSelect = byId<HTMLSelectElement>('set-uh-calendar');
  const monthSelect = byId<HTMLSelectElement>('set-uh-month');
  const dayInput = byId<HTMLInputElement>('set-uh-day');
  const yearInput = byId<HTMLInputElement>('set-uh-year');
  const errorLine = byId<HTMLElement>('set-uh-error');
  const saveButton = byId<HTMLButtonElement>('set-uh-save');
  const cancelButton = byId<HTMLButtonElement>('set-uh-cancel');

  let formError: FormError | null = null;
  let editing: string | null = null;

  const calendar = (): UserHolidayCalendar => calendarSelect.value as UserHolidayCalendar;

  const renderMonths = (): void => {
    const keep = monthSelect.value || '1';
    monthSelect.replaceChildren(...monthNames(calendar(), getLang()).map((name, i) => {
      const option = document.createElement('option');
      option.value = String(i + 1);
      option.textContent = name;
      return option;
    }));
    monthSelect.value = keep;
  };

  const renderForm = (): void => {
    const strings = STRINGS[getLang()];
    saveButton.textContent = editing === null ? strings.holidayAdd : strings.holidaySave;
    cancelButton.hidden = editing === null;
    errorLine.hidden = formError === null;
    errorLine.textContent = formError === null ? ''
      : formatTemplate(strings[formError], { max: MAX_USER_HOLIDAYS }, getLang());
    for (const input of [nameInput, dayInput, yearInput]) {
      if (formError === null) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
    }
  };

  const renderList = (): void => {
    const lang = getLang();
    const strings = STRINGS[lang];
    const user = store.get().holidays.user;
    list.setAttribute('aria-label', strings.sourceUserLong);
    if (user.length === 0) {
      const none = document.createElement('li');
      none.className = 'settings-none';
      none.textContent = strings.noUserHolidays;
      list.replaceChildren(none);
      return;
    }
    list.replaceChildren(...user.map((holiday, index) => {
      const li = document.createElement('li');
      li.append(
        span('uh-name', holiday.name), ' ', span('uh-when', whenText(holiday, lang)), ' ',
        button(strings.holidayEdit, holiday.name, () => { startEdit(holiday); }), ' ',
        button(strings.holidayDelete, holiday.name, () => { remove(holiday.id, index); }),
      );
      return li;
    }));
  };

  const clearForm = (): void => {
    editing = null;
    formError = null;
    nameInput.value = '';
    dayInput.value = '';
    yearInput.value = '';
    monthSelect.value = '1';
    renderForm();
  };

  function startEdit(holiday: UserHoliday): void {
    editing = holiday.id;
    formError = null;
    nameInput.value = holiday.name;
    calendarSelect.value = holiday.calendar;
    renderMonths();
    monthSelect.value = String(holiday.month);
    dayInput.value = String(holiday.day);
    yearInput.value = holiday.year === undefined ? '' : String(holiday.year);
    renderForm();
    nameInput.focus();
  }

  function remove(id: string, index: number): void {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: s.holidays.user.filter((u) => u.id !== id) } }));
    // The row that took the deleted one's place, else the one before it, else the form.
    const rows = list.querySelectorAll('li:not(.settings-none)');
    const row = rows[Math.min(index, rows.length - 1)];
    if (row === undefined) nameInput.focus();
    else (row.querySelector('button') as HTMLButtonElement).focus();
  }

  const save = (): void => {
    const year = normalizeDigits(yearInput.value.trim());
    const holiday = parseUserHoliday({
      id: editing ?? newId(),
      name: nameInput.value,
      calendar: calendar(),
      month: Number(monthSelect.value),
      day: Number(normalizeDigits(dayInput.value.trim())),
      // "Every year" is the absence of the key, never year: undefined.
      ...(year === '' ? {} : { year: Number(year) }),
    });
    const user = store.get().holidays.user;
    const index = editing === null ? -1 : user.findIndex((u) => u.id === editing);
    if (holiday === null || (index < 0 && user.length >= MAX_USER_HOLIDAYS)) {
      formError = holiday === null ? 'holidayInvalid' : 'holidayLimit';
      // Emptied first, so role="alert" speaks again when the same message repeats.
      errorLine.textContent = '';
      renderForm();
      return;
    }
    const next = index < 0 ? [...user, holiday] : user.map((u, i) => (i === index ? holiday : u));
    clearForm();
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: next } }));
  };

  restrictToDigits(dayInput);
  restrictToDigits(yearInput);
  calendarSelect.addEventListener('change', renderMonths);
  saveButton.addEventListener('click', save);
  cancelButton.addEventListener('click', () => { clearForm(); nameInput.focus(); });
  // Any edit to the form retires the error until the next Save.
  for (const type of ['input', 'change']) {
    form.addEventListener(type, () => {
      if (formError === null) return;
      formError = null;
      renderForm();
    });
  }
  store.subscribe((settings) => {
    // The entry being edited is gone (deleted here or elsewhere): saving would bring it back.
    if (editing !== null && !settings.holidays.user.some((u) => u.id === editing)) clearForm();
    renderList();
  });

  const reset = (): void => {
    calendarSelect.value = 'persian';
    renderMonths();
    clearForm();
  };
  const rerender = (): void => {
    renderMonths();
    renderForm();
    renderList();
  };
  rerender();
  return { reset, rerender };
}

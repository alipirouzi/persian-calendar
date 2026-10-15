import { nowSnapshot } from '../calendar/now';
import { normalizeDigits } from '../converter/converter-core';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import {
  HOLIDAY_SOURCES, MAX_USER_HOLIDAYS, parseUserHoliday,
  type HolidaySource, type UserHoliday, type UserHolidayCalendar,
} from '../settings/settings-model';
import type { SettingsStore } from '../settings/settings-store';
import { restrictToDigits } from '../ui/numeric-input';
import type { OfficialFile } from './holiday-data';
import type { HolidayService } from './holiday-service';

interface Deps {
  store: SettingsStore;
  service: Pick<HolidayService, 'probe'>;
  getLang: () => Lang;
  now: () => Date;
  newId?: () => string;
}

type TestResult = { readonly year: number; readonly file: OfficialFile | null };
type FormError = 'holidayInvalid' | 'holidayLimit';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const monthNames = (calendar: UserHolidayCalendar, lang: Lang): readonly string[] =>
  (calendar === 'persian' ? PERSIAN_MONTHS : GREGORIAN_MONTHS)[lang];

/** The Settings dialog's "Calendars & holidays" group: views, sources, my holidays, a data check. */
export function setupHolidaySettings({
  store, service, getLang, now, newId = () => crypto.randomUUID(),
}: Deps): { rerender: () => void } {
  const views = { persian: byId<HTMLInputElement>('set-view-persian'), gregorian: byId<HTMLInputElement>('set-view-gregorian') };
  const sources: Record<HolidaySource, HTMLInputElement> = {
    ir: byId('set-src-ir'), nuremberg: byId('set-src-nuremberg'), user: byId('set-src-user'),
  };
  const list = byId<HTMLUListElement>('set-user-holidays');
  const nameInput = byId<HTMLInputElement>('set-uh-name');
  const calendarSelect = byId<HTMLSelectElement>('set-uh-calendar');
  const monthSelect = byId<HTMLSelectElement>('set-uh-month');
  const dayInput = byId<HTMLInputElement>('set-uh-day');
  const yearInput = byId<HTMLInputElement>('set-uh-year');
  const errorLine = byId<HTMLElement>('set-uh-error');
  const saveButton = byId<HTMLButtonElement>('set-uh-save');
  const cancelButton = byId<HTMLButtonElement>('set-uh-cancel');
  const testButton = byId<HTMLButtonElement>('set-holidays-test');
  const testResult = byId<HTMLOutputElement>('set-holidays-test-result');
  const toggle = byId<HTMLButtonElement>('settings-toggle');

  // Kept so a language switch re-renders them rather than leaving them in the old language.
  let lastResult: TestResult | 'testing' | null = null;
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
  };

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

  const renderList = (): void => {
    const lang = getLang();
    const strings = STRINGS[lang];
    const user = store.get().holidays.user;
    if (user.length === 0) {
      const none = document.createElement('li');
      none.className = 'settings-none';
      none.textContent = strings.noUserHolidays;
      list.replaceChildren(none);
      return;
    }
    list.replaceChildren(...user.map((holiday) => {
      const li = document.createElement('li');
      li.append(
        span('uh-name', holiday.name), ' ', span('uh-when', whenText(holiday, lang)), ' ',
        button(strings.holidayEdit, holiday.name, () => { startEdit(holiday); }), ' ',
        button(strings.holidayDelete, holiday.name, () => { remove(holiday.id); }),
      );
      return li;
    }));
  };

  const renderResult = (): void => {
    const lang = getLang();
    if (lastResult === null) { testResult.textContent = ''; return; }
    if (lastResult === 'testing') { testResult.textContent = STRINGS[lang].testing; return; }
    const { year, file } = lastResult;
    testResult.textContent = file === null
      ? formatTemplate(STRINGS[lang].holidaysTestNone, { year }, lang)
      : formatTemplate(STRINGS[lang].holidaysTestOk, { year, date: file.fetched }, lang);
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
  }

  function remove(id: string): void {
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: s.holidays.user.filter((u) => u.id !== id) } }));
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
      renderForm();
      return;
    }
    const next = index < 0 ? [...user, holiday] : user.map((u, i) => (i === index ? holiday : u));
    clearForm();
    store.update((s) => ({ ...s, holidays: { ...s.holidays, user: next } }));
  };

  const syncControls = (): void => {
    const settings = store.get();
    views.persian.checked = settings.views.persian.enabled;
    views.gregorian.checked = settings.views.gregorian.enabled;
    for (const source of HOLIDAY_SOURCES) sources[source].checked = settings.holidays.sources.includes(source);
  };

  restrictToDigits(dayInput);
  restrictToDigits(yearInput);

  toggle.addEventListener('click', () => {
    syncControls();
    calendarSelect.value = 'persian';
    renderMonths();
    clearForm();
    // A test still in flight keeps showing "Testing…" rather than blank and then a result.
    if (lastResult !== 'testing') lastResult = null;
    renderResult();
  });
  for (const side of ['persian', 'gregorian'] as const) {
    views[side].addEventListener('change', () => {
      const enabled = views[side].checked;
      store.update((s) => ({ ...s, views: { ...s.views, [side]: { ...s.views[side], enabled } } }));
    });
  }
  for (const source of HOLIDAY_SOURCES) {
    sources[source].addEventListener('change', () => {
      const chosen = HOLIDAY_SOURCES.filter((s) => sources[s].checked);
      store.update((s) => ({ ...s, holidays: { ...s.holidays, sources: chosen } }));
    });
  }
  calendarSelect.addEventListener('change', renderMonths);
  saveButton.addEventListener('click', save);
  cancelButton.addEventListener('click', clearForm);
  testButton.addEventListener('click', () => {
    // aria-disabled, not disabled: a disabled button would drop focus inside the modal.
    if (lastResult === 'testing') return;
    testButton.setAttribute('aria-disabled', 'true');
    lastResult = 'testing';
    renderResult();
    const year = nowSnapshot(now()).local.p.py;
    void service.probe(year).then((file) => {
      lastResult = { year, file };
      testButton.removeAttribute('aria-disabled');
      renderResult();
    });
  });
  store.subscribe(renderList);

  const rerender = (): void => {
    renderMonths();
    renderForm();
    renderList();
    renderResult();
  };
  syncControls();
  rerender();
  return { rerender };
}

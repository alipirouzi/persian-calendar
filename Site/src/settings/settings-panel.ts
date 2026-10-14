import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import { formatCopy } from '../copy/copy-format';
import { STRINGS, type Lang } from '../i18n/strings';
import { COPY_PRESETS, type CopyCalendar, type CopyDigits } from './settings-model';
import type { SettingsStore } from './settings-store';

const CUSTOM = 'custom';
const NO_DATE = '—';

interface Deps {
  store: SettingsStore;
  getLang: () => Lang;
  getDate: () => { p: PersianDateParts; g: GregorianDateParts } | null;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const isPreset = (pattern: string): boolean =>
  (COPY_PRESETS as readonly string[]).includes(pattern);

export function setupSettingsPanel({ store, getLang, getDate }: Deps): { rerender: () => void } {
  const toggle = byId<HTMLButtonElement>('settings-toggle');
  const dialog = byId<HTMLDialogElement>('settings-dialog');
  const closeButton = byId<HTMLButtonElement>('settings-close');
  const calendar = byId<HTMLSelectElement>('set-copy-calendar');
  const pattern = byId<HTMLSelectElement>('set-copy-pattern');
  const customRow = byId<HTMLElement>('set-copy-custom-row');
  const custom = byId<HTMLInputElement>('set-copy-custom');
  const digits = byId<HTMLSelectElement>('set-copy-digits');
  const preview = byId<HTMLOutputElement>('set-copy-preview');

  const renderPreview = (): void => {
    const date = getDate();
    preview.textContent = date === null
      ? NO_DATE
      : formatCopy(date.p, date.g, store.get().copy, getLang());
  };

  /** Controls follow the store only on open: while editing, the user owns them. */
  const syncControls = (): void => {
    const copy = store.get().copy;
    calendar.value = copy.calendar;
    digits.value = copy.digits;
    const preset = isPreset(copy.pattern);
    pattern.value = preset ? copy.pattern : CUSTOM;
    if (!preset) custom.value = copy.pattern;
    customRow.hidden = preset;
  };

  const setPattern = (value: string): void => {
    store.update((s) => ({ copy: { ...s.copy, pattern: value } }));
  };

  toggle.addEventListener('click', () => {
    syncControls();
    renderPreview();
    dialog.showModal();
  });
  closeButton.addEventListener('click', () => { dialog.close(); });
  // A click that lands on the dialog element itself is on the backdrop: the
  // content is all inside child elements.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  calendar.addEventListener('change', () => {
    store.update((s) => ({ copy: { ...s.copy, calendar: calendar.value as CopyCalendar } }));
  });
  digits.addEventListener('change', () => {
    store.update((s) => ({ copy: { ...s.copy, digits: digits.value as CopyDigits } }));
  });
  pattern.addEventListener('change', () => {
    const isCustom = pattern.value === CUSTOM;
    customRow.hidden = !isCustom;
    if (!isCustom) {
      setPattern(pattern.value);
      return;
    }
    custom.focus();
    // An empty field stores nothing new; the parser would only turn it into the default.
    if (custom.value !== '') setPattern(custom.value);
  });
  custom.addEventListener('input', () => { setPattern(custom.value); });

  store.subscribe(renderPreview);

  const rerender = (): void => {
    const label = STRINGS[getLang()].settings;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    renderPreview();
  };
  rerender();
  return { rerender };
}

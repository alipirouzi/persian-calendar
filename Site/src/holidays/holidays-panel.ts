import { nowSnapshot } from '../calendar/now';
import { formatTemplate, STRINGS, type Lang } from '../i18n/strings';
import { HOLIDAY_SOURCES, type HolidaySource } from '../settings/settings-model';
import type { SettingsStore } from '../settings/settings-store';
import type { OfficialFile } from './holiday-data';
import type { HolidayService } from './holiday-service';
import { setupUserHolidayForm } from './user-holiday-form';

interface Deps {
  store: SettingsStore;
  service: Pick<HolidayService, 'probe'>;
  getLang: () => Lang;
  now: () => Date;
  newId?: () => string;
}

type TestResult = { readonly year: number; readonly file: OfficialFile | null };

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** The Settings dialog's "Calendars & holidays" group: views, sources, my holidays, a data check. */
export function setupHolidaySettings({
  store, service, getLang, now, newId = () => crypto.randomUUID(),
}: Deps): { rerender: () => void } {
  const views = { persian: byId<HTMLInputElement>('set-view-persian'), gregorian: byId<HTMLInputElement>('set-view-gregorian') };
  const sources: Record<HolidaySource, HTMLInputElement> = {
    ir: byId('set-src-ir'), nuremberg: byId('set-src-nuremberg'), user: byId('set-src-user'),
  };
  const testButton = byId<HTMLButtonElement>('set-holidays-test');
  const testResult = byId<HTMLOutputElement>('set-holidays-test-result');
  const toggle = byId<HTMLButtonElement>('settings-toggle');
  const userForm = setupUserHolidayForm({ store, getLang, newId });

  // Kept so a language switch re-renders it rather than leaving it in the old language.
  let lastResult: TestResult | 'testing' | null = null;

  const renderResult = (): void => {
    const lang = getLang();
    if (lastResult === null) { testResult.textContent = ''; return; }
    if (lastResult === 'testing') { testResult.textContent = STRINGS[lang].testing; return; }
    const { year, file } = lastResult;
    testResult.textContent = file === null
      ? formatTemplate(STRINGS[lang].holidaysTestNone, { year }, lang)
      : formatTemplate(STRINGS[lang].holidaysTestOk, { year, date: file.fetched }, lang);
  };

  const syncControls = (): void => {
    const settings = store.get();
    views.persian.checked = settings.views.persian.enabled;
    views.gregorian.checked = settings.views.gregorian.enabled;
    for (const source of HOLIDAY_SOURCES) sources[source].checked = settings.holidays.sources.includes(source);
  };

  toggle.addEventListener('click', () => {
    syncControls();
    userForm.reset();
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

  const rerender = (): void => {
    userForm.rerender();
    renderResult();
  };
  syncControls();
  renderResult();
  return { rerender };
}

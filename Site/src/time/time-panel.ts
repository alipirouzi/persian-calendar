import { STRINGS, type Lang } from '../i18n/strings';
import type { TimeSourceSetting } from '../settings/settings-model';
import type { SettingsStore } from '../settings/settings-store';
import { probeText, statusText } from './time-text';
import type { ProbeResult, TimeSource } from './time-source';

interface Deps {
  store: SettingsStore;
  time: Pick<TimeSource, 'status' | 'probe' | 'subscribe'>;
  getLang: () => Lang;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** The Settings dialog's Time group: where the time comes from, and a way to check it. */
export function setupTimeSettings({ store, time, getLang }: Deps): { rerender: () => void } {
  const source = byId<HTMLSelectElement>('set-time-source');
  const statusLine = byId<HTMLElement>('set-time-status');
  const testButton = byId<HTMLButtonElement>('set-time-test');
  const testResult = byId<HTMLOutputElement>('set-time-test-result');
  const toggle = byId<HTMLButtonElement>('settings-toggle');

  // Kept so a language switch can re-render the result rather than leave it in the old language.
  let lastResult: ProbeResult | 'testing' | null = null;

  const renderStatus = (): void => { statusLine.textContent = statusText(time.status(), getLang()); };
  const renderResult = (): void => {
    const lang = getLang();
    testResult.textContent = lastResult === null ? ''
      : lastResult === 'testing' ? STRINGS[lang].testing
      : probeText(lastResult, lang);
  };

  source.options[0]!.textContent = window.location.host;

  toggle.addEventListener('click', () => {
    source.value = store.get().time.source;
    lastResult = null;
    renderResult();
    renderStatus();
  });
  source.addEventListener('change', () => {
    store.update((s) => ({ ...s, time: { source: source.value as TimeSourceSetting } }));
  });
  testButton.addEventListener('click', () => {
    testButton.disabled = true;
    lastResult = 'testing';
    renderResult();
    void time.probe().then((result) => {
      lastResult = result;
      testButton.disabled = false;
      renderResult();
    });
  });
  time.subscribe(renderStatus);

  const rerender = (): void => {
    renderStatus();
    renderResult();
  };
  rerender();
  return { rerender };
}

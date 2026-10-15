import type { Lang } from '../i18n/strings';
import type { FaceId } from './face';
import type { SettingsStore } from '../settings/settings-store';

interface Deps {
  store: SettingsStore;
  getLang: () => Lang;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** The Settings dialog's Watch group: which face the clock wears. */
export function setupWatchSettings({ store }: Deps): { rerender: () => void } {
  const face = byId<HTMLSelectElement>('set-watch-face');
  const toggle = byId<HTMLButtonElement>('settings-toggle');

  toggle.addEventListener('click', () => { face.value = store.get().watch.face; });
  face.addEventListener('change', () => {
    store.update((s) => ({ ...s, watch: { face: face.value as FaceId } }));
  });

  // The option labels carry data-str, which the page's own render covers.
  return { rerender: () => undefined };
}

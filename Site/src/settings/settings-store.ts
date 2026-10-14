import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings-model';

export const SETTINGS_STORAGE_KEY = 'settings.v1';

export interface SettingsStore {
  get(): Settings;
  /** Validated before it is kept, so a caller cannot store an invalid value. */
  update(change: (current: Settings) => Settings): void;
  /** Returns the unsubscribe function. */
  subscribe(listener: (settings: Settings) => void): () => void;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return parseSettings(raw === null ? null : JSON.parse(raw));
  } catch {
    // Private mode or a value that is not JSON: start clean rather than fail.
    return DEFAULT_SETTINGS;
  }
}

function save(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* private mode or quota — session-only */ }
}

export function createSettingsStore(): SettingsStore {
  let current = load();
  const listeners = new Set<(settings: Settings) => void>();
  return {
    get: () => current,
    update(change) {
      current = parseSettings(change(current));
      save(current);
      for (const listener of listeners) listener(current);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings/settings-model';
import { createSettingsStore, SETTINGS_STORAGE_KEY } from '../../src/settings/settings-store';

/** Same approach as lang-preference.test.ts: the module reads the bare global. */
const useStorage = (storage: Partial<Storage> | undefined): void => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
};

const memoryStorage = (seed: Record<string, string> = {}): Partial<Storage> & {
  entries: Map<string, string>;
} => {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
};

const denyingStorage = (): Partial<Storage> => ({
  getItem: () => { throw new DOMException('denied'); },
  setItem: () => { throw new DOMException('quota'); },
});

afterEach(() => { useStorage(undefined); });

describe('createSettingsStore', () => {
  it('starts from defaults when nothing is stored', () => {
    useStorage(memoryStorage());
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('loads what was stored, validated', () => {
    useStorage(memoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ copy: { calendar: 'both', digits: 'nope' } }),
    }));
    expect(createSettingsStore().get().copy).toEqual({
      calendar: 'both', pattern: 'yyyy-mm-dd', digits: 'latin',
    });
  });

  it('starts from defaults when the stored value is not JSON', () => {
    useStorage(memoryStorage({ [SETTINGS_STORAGE_KEY]: '{oops' }));
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('starts from defaults when storage is unreadable', () => {
    useStorage(denyingStorage());
    expect(createSettingsStore().get()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists, validates and announces an update', () => {
    const storage = memoryStorage();
    useStorage(storage);
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((s) => ({ copy: { ...s.copy, calendar: 'gregorian', pattern: '' } }));

    const expected = { copy: { calendar: 'gregorian', pattern: 'yyyy-mm-dd', digits: 'latin' } };
    expect(store.get()).toEqual(expected);
    expect(listener).toHaveBeenCalledWith(expected);
    expect(JSON.parse(storage.entries.get(SETTINGS_STORAGE_KEY) as string)).toEqual(expected);
  });

  it('keeps the update for the session when storage refuses the write', () => {
    useStorage(denyingStorage());
    const store = createSettingsStore();

    expect(() => store.update((s) => ({ copy: { ...s.copy, digits: 'persian' } }))).not.toThrow();
    expect(store.get().copy.digits).toBe('persian');
  });

  it('stops announcing after unsubscribe', () => {
    useStorage(memoryStorage());
    const store = createSettingsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update((s) => s);

    expect(listener).not.toHaveBeenCalled();
  });
});

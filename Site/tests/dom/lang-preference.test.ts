import { afterEach, describe, expect, it } from 'vitest';
import { initialLang, persistLang } from '../../src/i18n/strings';

/**
 * Neither jsdom nor Node supplies a `localStorage` here, and the module reads the
 * bare global, so each test installs the storage it wants to describe — including
 * the one that throws, which is what a private-mode browser does.
 */
const useStorage = (storage: Partial<Storage> | undefined): void => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
};

const memoryStorage = (seed: Record<string, string> = {}): Partial<Storage> => {
  const entries = new Map(Object.entries(seed));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
};

const denyingStorage = (): Partial<Storage> => ({
  getItem: () => { throw new DOMException('denied'); },
  setItem: () => { throw new DOMException('quota'); },
});

const setNavigatorLanguage = (value: string): void => {
  Object.defineProperty(navigator, 'language', { value, configurable: true });
};

afterEach(() => {
  useStorage(undefined);
  setNavigatorLanguage('en-US');
});

describe('initialLang', () => {
  it('prefers a stored choice over the browser', () => {
    setNavigatorLanguage('fa-IR');

    useStorage(memoryStorage({ lang: 'en' }));
    expect(initialLang()).toBe('en');

    useStorage(memoryStorage({ lang: 'fa' }));
    expect(initialLang()).toBe('fa');
  });

  it('falls back to the browser language when nothing is stored', () => {
    useStorage(memoryStorage());

    setNavigatorLanguage('fa-IR');
    expect(initialLang()).toBe('fa');

    setNavigatorLanguage('EN-gb');
    expect(initialLang()).toBe('en');
  });

  it('ignores a stored value that is not a language it speaks', () => {
    useStorage(memoryStorage({ lang: 'de' }));
    setNavigatorLanguage('fa');

    expect(initialLang()).toBe('fa');
  });

  it('falls back to the browser when storage is unreadable', () => {
    useStorage(denyingStorage());
    setNavigatorLanguage('fa-IR');

    expect(initialLang()).toBe('fa');
  });
});

describe('persistLang', () => {
  it('stores the choice', () => {
    const storage = memoryStorage();
    useStorage(storage);

    persistLang('fa');

    expect(storage.getItem!('lang')).toBe('fa');
  });

  it('stays silent when storage refuses the write', () => {
    useStorage(denyingStorage());

    expect(() => persistLang('fa')).not.toThrow();
  });
});

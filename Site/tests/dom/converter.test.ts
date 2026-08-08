import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import { setupConverter } from '../../src/converter/converter';
import type { Lang } from '../../src/i18n/strings';
import { clickOn, press, setMediaMatches } from './dom-helpers';

/**
 * The real page, minus its module script: a hand-copied fixture would drift from
 * the markup `setupConverter` actually reaches for.
 */
const BODY = PAGE
  .slice(PAGE.indexOf('<body>') + '<body>'.length, PAGE.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

/** 1403-10-22 AP is 2025-01-11 CE, a Saturday. */
const TODAY = new Date('2025-01-11T09:00:00Z');

let lang: Lang;
let writeText: ReturnType<typeof vi.fn>;
let converter: ReturnType<typeof setupConverter>;

const byId = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const field = (id: string): HTMLInputElement => byId<HTMLInputElement>(id);

/** Type into a field the way a keystroke does: value, then the input event. */
const typeInto = (id: string, value: string): void => {
  const input = field(id);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const values = (prefix: string): string[] =>
  ['y', 'm', 'd'].map((part) => field(`${prefix}-${part}`).value);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
  setMediaMatches(false);
  lang = 'en';
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  history.replaceState(null, '', '/');
  document.body.innerHTML = BODY;
  converter = setupConverter(() => lang);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('setup', () => {
  it('refuses to run against a page missing its markup', () => {
    document.body.innerHTML = '';

    expect(() => setupConverter(() => 'en')).toThrow(/Missing element #converter-error/);
  });

  it('names every control in the current language', () => {
    expect(byId('p-y-toggle').getAttribute('aria-label')).toBe('Choose year');
    expect(byId('p-cal').getAttribute('aria-label')).toBe('Open calendar');
    expect(byId('g-cal-prev').getAttribute('aria-label')).toBe('Previous month');
  });

  it('swallows the form submit that would reload the page', () => {
    const event = new Event('submit', { bubbles: true, cancelable: true });

    byId('converter-form').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('fills both sides from a prefilled date', () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    expect(values('p')).toEqual(['1403', '10', '22']);
    expect(values('g')).toEqual(['2025', '1', '11']);
    expect(byId('full-date').textContent)
      .toBe('Saturday, 22 Dey 1403 — January 11, 2025');
    expect(byId<HTMLButtonElement>('btn-copy').disabled).toBe(false);
    expect(byId('converter-error').hidden).toBe(true);
  });
});

describe('converting', () => {
  it('fills the Gregorian side and the URL from the Persian one', () => {
    typeInto('p-y', '1403');
    typeInto('p-m', '10');
    typeInto('p-d', '22');

    expect(values('g')).toEqual(['2025', '1', '11']);
    expect(window.location.search).toBe('?p=1403-10-22');
  });

  it('fills the Persian side and the URL from the Gregorian one', () => {
    typeInto('g-y', '2025');
    typeInto('g-m', '1');
    typeInto('g-d', '11');

    expect(values('p')).toEqual(['1403', '10', '22']);
    expect(window.location.search).toBe('?g=2025-1-11');
  });

  it('keeps the fields numeric', () => {
    typeInto('p-y', '14o3');

    expect(field('p-y').value).toBe('143');
  });

  it('says nothing while a date is still half typed', () => {
    typeInto('p-y', '1403');

    expect(byId('converter-error').hidden).toBe(true);
    expect(byId('full-date').textContent).toBe('');
    expect(byId<HTMLButtonElement>('btn-copy').disabled).toBe(true);
  });

  it('names the month when the day is past its end', () => {
    typeInto('p-y', '1404');
    typeInto('p-m', '12');
    typeInto('p-d', '30');

    expect(byId('converter-error').textContent).toBe('Esfand has 29 days in 1404');
    expect(byId('converter-error').hidden).toBe(false);
  });

  it('names the Gregorian month too', () => {
    typeInto('g-y', '2025');
    typeInto('g-m', '2');
    typeInto('g-d', '29');

    expect(byId('converter-error').textContent).toBe('February has 28 days in 2025');
  });

  it('reports a year outside the range with its bounds', () => {
    typeInto('p-y', '1100');
    typeInto('p-m', '1');
    typeInto('p-d', '1');

    expect(byId('converter-error').textContent).toBe('Year must be between 1200 and 1500');
  });

  it('reports a date whose counterpart is out of range', () => {
    typeInto('p-y', '1200');
    typeInto('p-m', '1');
    typeInto('p-d', '1');

    expect(byId('converter-error').textContent)
      .toBe('That date is outside the supported range');
  });
});

describe('the day options', () => {
  const dayLabels = (): string[] =>
    [...byId('p-d-list').children].map((li) => li.textContent ?? '');

  it('follow the month the fields hold', () => {
    typeInto('p-y', '1404');
    typeInto('p-m', '12');
    typeInto('p-d', '1');

    clickOn(byId('p-d-toggle'));

    expect(dayLabels()).toHaveLength(29);
    expect(dayLabels()[0]).toBe('1 Friday');
  });

  it('are rebuilt only when the month or the language changes', () => {
    typeInto('p-y', '1403');
    typeInto('p-m', '10');
    typeInto('p-d', '1');
    clickOn(byId('p-d-toggle'));
    const first = byId('p-d-list').firstElementChild;

    typeInto('p-d', '2');

    expect(byId('p-d-list').firstElementChild).toBe(first);
  });

  it('fall back to a plain 1–31 list without a usable month', () => {
    typeInto('p-y', '1403');

    clickOn(byId('p-d-toggle'));

    expect(dayLabels()).toHaveLength(31);
    expect(dayLabels()[0]).toBe('1');
  });
});

describe('the pickers', () => {
  it('write the chosen year, month and day back into the field', () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    clickOn(byId('p-y-toggle'));
    clickOn(byId('p-y-list').children[204]!); // 1200 + 204
    expect(field('p-y').value).toBe('1404');

    clickOn(byId('p-m-toggle'));
    clickOn(byId('p-m-list').children[4]!);
    expect(field('p-m').value).toBe('5');

    clickOn(byId('p-d-toggle'));
    clickOn(byId('p-d-list').children[2]!);
    expect(field('p-d').value).toBe('3');

    expect(values('g')).toEqual(['2025', '7', '25']);
  });

  it('write Persian digits when the page is in Persian', () => {
    lang = 'fa';
    converter.rerender();

    clickOn(byId('g-m-toggle'));
    clickOn(byId('g-m-list').children[7]!);

    expect(field('g-m').value).toBe('۸');
  });
});

describe('the calendar', () => {
  it('opens on the date the fields hold and writes back what was picked', () => {
    typeInto('p-y', '1403');
    typeInto('p-m', '10');
    typeInto('p-d', '22');

    clickOn(byId('p-cal'));
    expect(byId('p-cal-title').textContent).toBe('Dey 1403');
    clickOn(byId('p-cal-grid').querySelector('.cal-cell[data-day="3"]')!);

    expect(values('p')).toEqual(['1403', '10', '3']);
    expect(values('g')).toEqual(['2024', '12', '23']);
  });

  it('opens on today when the fields hold nothing usable', () => {
    typeInto('p-y', '');
    typeInto('p-m', '');
    typeInto('p-d', '');

    clickOn(byId('p-cal'));

    expect(byId('p-cal-title').textContent).toBe('Dey 1403');
  });

  it('opens the Gregorian side on its own calendar', () => {
    typeInto('g-y', '2026');
    typeInto('g-m', '8');
    typeInto('g-d', '7');

    clickOn(byId('g-cal'));

    expect(byId('g-cal-title').textContent).toBe('August 2026');
  });

  it('opens the Gregorian side on today when its fields are empty', () => {
    typeInto('g-y', '');

    clickOn(byId('g-cal'));

    expect(byId('g-cal-title').textContent).toBe('January 2025');
  });
});

describe('Today and Copy', () => {
  it('resets both sides to today and clears the URL', () => {
    typeInto('p-y', '1400');
    typeInto('p-m', '5');
    typeInto('p-d', '3');
    clickOn(byId('p-cal'));

    clickOn(byId('btn-today'));

    expect(values('p')).toEqual(['1403', '10', '22']);
    expect(values('g')).toEqual(['2025', '1', '11']);
    expect(window.location.search).toBe('');
    // Every popup the reset moved out from under is closed.
    expect(byId('p-cal-pop').hidden).toBe(true);
  });

  it('copies the sentence and says so, then goes back to Copy', async () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    clickOn(byId('btn-copy'));
    await vi.waitFor(() => expect(byId('btn-copy').textContent).toBe('Copied'));

    expect(writeText).toHaveBeenCalledWith('Saturday, 22 Dey 1403 — January 11, 2025');
    vi.advanceTimersByTime(1500);
    expect(byId('btn-copy').textContent).toBe('Copy');
  });

  it('says so when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    clickOn(byId('btn-copy'));

    await vi.waitFor(() => expect(byId('btn-copy').textContent).toBe('Copy failed'));
  });

  it('does nothing without a valid date to copy', () => {
    typeInto('p-y', '1403');

    clickOn(byId('btn-copy'));

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('switching language', () => {
  it('re-renders both sides and every label from the last valid date', () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });

    lang = 'fa';
    converter.rerender();

    expect(values('p')).toEqual(['۱۴۰۳', '۱۰', '۲۲']);
    expect(values('g')).toEqual(['۲۰۲۵', '۱', '۱۱']);
    expect(byId('p-y-toggle').getAttribute('aria-label')).toBe('انتخاب سال');
    expect(byId('full-date').textContent).toContain('۱۴۰۳');
    expect(byId('converter-error').hidden).toBe(true);
  });

  it('re-runs the half-typed date instead, leaving the URL alone', () => {
    typeInto('p-y', '1403');
    typeInto('p-m', '13');
    typeInto('p-d', '1');
    const url = window.location.search;

    lang = 'fa';
    converter.rerender();

    expect(byId('converter-error').textContent).toBe('ماه باید بین ۱ و ۱۲ باشد');
    expect(window.location.search).toBe(url);
  });

  it('takes back a pending Copied flash', () => {
    converter.prefill({ py: 1403, pm: 10, pd: 22 }, { gy: 2025, gm: 1, gd: 11 });
    byId('btn-copy').textContent = 'Copied';

    lang = 'fa';
    converter.rerender();

    expect(byId('btn-copy').textContent).toBe('کپی');
    vi.advanceTimersByTime(1500);
    expect(byId('btn-copy').textContent).toBe('کپی');
  });

  it('keeps the open calendar in the new language', () => {
    typeInto('p-y', '1403');
    typeInto('p-m', '10');
    typeInto('p-d', '22');
    clickOn(byId('p-cal'));

    lang = 'fa';
    converter.rerender();

    expect(byId('p-cal-title').textContent).toBe('دی ۱۴۰۳');
    press(byId('p-cal-grid'), 'Escape');
  });
});

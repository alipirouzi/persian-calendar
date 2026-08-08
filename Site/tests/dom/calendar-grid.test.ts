import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewState } from '../../src/converter/calendar-views';
import type { Side } from '../../src/converter/converter-core';
import type { Lang } from '../../src/i18n/strings';
import { createCalendarGrid, type CalendarGrid } from '../../src/ui/calendar-grid';
import { clickOn, focusOutOf, pointerDownOn, press, trackScroll } from './dom-helpers';

/** Dey 1403 starts on a Saturday and runs 30 days: five full rows, no lead. */
const DEY_1403: ViewState = { year: 1403, month: 10, day: 22 };
/** Tir 1403 needs six rows and starts mid-week, so it has leading blanks. */
const TIR_1403: ViewState = { year: 1403, month: 4, day: 20 };

interface Options {
  side?: Side;
  current?: ViewState | null;
  today?: ViewState;
  lang?: Lang;
}

interface Harness {
  button: HTMLButtonElement;
  pop: HTMLElement;
  title: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  grid: HTMLElement;
  outside: HTMLButtonElement;
  calendar: CalendarGrid;
  onPick: ReturnType<typeof vi.fn>;
  setLang: (lang: Lang) => void;
  setCurrent: (state: ViewState | null) => void;
}

let dom: Harness;

/** Grids keep document-level listeners for their lifetime; a closed one is inert. */
const built: CalendarGrid[] = [];

afterEach(() => {
  for (const calendar of built.splice(0)) calendar.close();
  document.documentElement.dir = '';
  vi.restoreAllMocks();
});

const mount = ({
  side = 'persian', current = DEY_1403, today = { year: 1403, month: 10, day: 1 }, lang = 'en',
}: Options = {}): Harness => {
  document.body.innerHTML = `
    <fieldset>
      <legend><button id="p-cal" type="button"></button></legend>
      <div id="p-cal-pop" hidden>
        <div class="cal-head">
          <button id="p-cal-prev" type="button"></button>
          <button id="p-cal-title" type="button"></button>
          <button id="p-cal-next" type="button"></button>
        </div>
        <div id="p-cal-grid" role="grid" tabindex="-1"></div>
      </div>
    </fieldset>
    <button id="outside" type="button"></button>`;
  const pick = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;
  let currentState = current;
  let language = lang;
  const onPick = vi.fn();
  const harness: Harness = {
    button: pick('#p-cal'),
    pop: pick('#p-cal-pop'),
    title: pick('#p-cal-title'),
    prev: pick('#p-cal-prev'),
    next: pick('#p-cal-next'),
    grid: pick('#p-cal-grid'),
    outside: pick('#outside'),
    onPick,
    setLang: (next) => { language = next; },
    setCurrent: (next) => { currentState = next; },
    calendar: undefined as unknown as CalendarGrid,
  };
  harness.calendar = createCalendarGrid({
    side,
    button: harness.button,
    popup: harness.pop,
    title: harness.title,
    prev: harness.prev,
    next: harness.next,
    grid: harness.grid,
    getLang: () => language,
    getCurrent: () => currentState,
    getToday: () => today,
    onPick,
  });
  built.push(harness.calendar);
  return harness;
};

const cells = (): HTMLElement[] => [...dom.grid.querySelectorAll<HTMLElement>('.cal-cell')];
const labels = (): string[] => cells().map((cell) => cell.textContent ?? '');
const cursorCell = (): HTMLElement | null => dom.grid.querySelector<HTMLElement>('.cal-cell.cursor');
const activeId = (): string | null => dom.grid.getAttribute('aria-activedescendant');
const cellFor = (attribute: string, value: number): HTMLElement =>
  dom.grid.querySelector<HTMLElement>(`.cal-cell[data-${attribute}="${value}"]`)!;

beforeEach(() => {
  dom = mount();
});

describe('the days view', () => {
  it('opens on the month the fields hold, with the cursor on their day', () => {
    clickOn(dom.button);

    expect(dom.pop.hidden).toBe(false);
    expect(dom.title.textContent).toBe('Dey 1403');
    expect(dom.grid.getAttribute('aria-label')).toBe('Dey 1403');
    expect(cells()).toHaveLength(30);
    expect(cursorCell()?.textContent).toBe('22');
    expect(activeId()).toBe('p-cal-grid-d22');
    expect(dom.grid.classList.contains('cal-grid--wide')).toBe(false);
  });

  it('lays the weekday headers out once, above the rows', () => {
    clickOn(dom.button);

    const headers = [...dom.grid.querySelectorAll('[role="columnheader"]')];
    expect(headers.map((el) => el.textContent)).toEqual(
      ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(dom.grid.querySelectorAll('[role="row"]')).toHaveLength(6); // header + 5 weeks
  });

  it('marks the selected day, and today when today is on screen', () => {
    clickOn(dom.button);

    expect(cellFor('day', 22).getAttribute('aria-selected')).toBe('true');
    expect(cellFor('day', 22).classList.contains('active')).toBe(true);
    expect(cellFor('day', 1).classList.contains('today')).toBe(true);
    expect(cellFor('day', 2).classList.contains('today')).toBe(false);
  });

  it('marks nothing as today on a month today does not fall in', () => {
    dom = mount({ today: { year: 1399, month: 3, day: 5 } });

    clickOn(dom.button);

    expect(dom.grid.querySelector('.today')).toBeNull();
  });

  it('pads a month that does not start on the first column with blanks', () => {
    dom = mount({ current: TIR_1403 });

    clickOn(dom.button);

    expect(dom.grid.querySelectorAll('.cal-blank').length).toBeGreaterThan(0);
    expect(dom.grid.querySelectorAll('[role="row"]')).toHaveLength(7); // header + 6 weeks
  });

  it('falls back to today when the fields hold no usable date', () => {
    dom = mount({ current: null, today: { year: 1400, month: 5, day: 3 } });

    clickOn(dom.button);

    expect(dom.title.textContent).toBe('Mordad 1400');
    expect(cursorCell()?.textContent).toBe('3');
  });

  it('puts the cursor on a real day when the field holds one the month has not got', () => {
    // The converter parses days as 1–31 without knowing the month's length.
    dom = mount({ current: { year: 1403, month: 10, day: 31 } });

    clickOn(dom.button);

    expect(cursorCell()?.textContent).toBe('1');
  });

  it('picks the day that was clicked and closes', () => {
    clickOn(dom.button);

    const event = clickOn(cellFor('day', 3));

    expect(event.defaultPrevented).toBe(true);
    expect(dom.onPick).toHaveBeenCalledWith(1403, 10, 3);
    expect(dom.pop.hidden).toBe(true);
    expect(activeId()).toBeNull();
  });

  it('ignores a click that lands on no cell', () => {
    clickOn(dom.button);

    clickOn(dom.grid.querySelector('.cal-blank')!);
    clickOn(dom.grid);

    expect(dom.onPick).not.toHaveBeenCalled();
    expect(dom.pop.hidden).toBe(false);
  });

  it('points at nothing when the state describes a month with no days', () => {
    // Nothing the converter parses produces a thirteenth month, but the grid is
    // handed its date by whoever wires it, and a grid it cannot fill must leave
    // aria-activedescendant off rather than name a cell that is not there.
    dom = mount({ side: 'gregorian', current: { year: 2000, month: 13, day: 1 } });

    clickOn(dom.button);

    expect(cells()).toHaveLength(0);
    expect(activeId()).toBeNull();
    expect(dom.pop.hidden).toBe(false);
  });

  it('ignores a cell that carries no value', () => {
    clickOn(dom.button);
    const stray = document.createElement('div');
    stray.className = 'cal-cell';
    dom.grid.append(stray);

    clickOn(stray);

    expect(dom.onPick).not.toHaveBeenCalled();
  });
});

describe('the other calendar and the other language', () => {
  it('renders Gregorian months in Persian digits', () => {
    dom = mount({
      side: 'gregorian', lang: 'fa',
      current: { year: 2026, month: 8, day: 7 },
      today: { year: 2026, month: 8, day: 7 },
    });

    clickOn(dom.button);

    expect(dom.title.textContent).toBe('اوت ۲۰۲۶');
    expect(cursorCell()?.textContent).toBe('۷');
  });

  it('re-renders in the new language while open, and does nothing while closed', () => {
    clickOn(dom.button);

    dom.setLang('fa');
    dom.calendar.rerender();
    expect(dom.title.textContent).toBe('دی ۱۴۰۳');
    expect(cursorCell()?.textContent).toBe('۲۲');

    dom.calendar.close();
    dom.setLang('en');
    dom.calendar.rerender();
    expect(dom.title.textContent).toBe('دی ۱۴۰۳'); // untouched: the next open rebuilds
  });
});

describe('drilling down', () => {
  it('goes year → months → days and finally picks', () => {
    clickOn(dom.button);

    clickOn(dom.title);
    expect(dom.title.textContent).toBe('1392 – 1403');
    expect(dom.title.hasAttribute('disabled')).toBe(true);
    expect(cells()).toHaveLength(12);
    expect(dom.grid.classList.contains('cal-grid--wide')).toBe(true);
    expect(cursorCell()?.textContent).toBe('1403');

    clickOn(cellFor('year', 1400));
    expect(dom.title.textContent).toBe('1400');
    expect(dom.title.hasAttribute('disabled')).toBe(false);
    expect(labels()[4]).toBe('Mordad');
    expect(cursorCell()?.textContent).toBe('Dey');

    clickOn(cellFor('month', 5));
    expect(dom.title.textContent).toBe('Mordad 1400');
    expect(dom.grid.classList.contains('cal-grid--wide')).toBe(false);
    expect(cells()).toHaveLength(31);

    clickOn(cellFor('day', 3));
    expect(dom.onPick).toHaveBeenCalledWith(1400, 5, 3);
  });

  it('brings the day back inside a shorter month', () => {
    dom = mount({ current: { year: 1404, month: 1, day: 31 } });
    clickOn(dom.button);

    clickOn(dom.title);
    clickOn(cellFor('year', 1404));
    clickOn(cellFor('month', 12)); // Esfand 1404 has 29 days

    expect(cells()).toHaveLength(29);
    expect(cursorCell()?.textContent).toBe('29');
  });

  it('always reopens on the days view', () => {
    clickOn(dom.button);
    clickOn(dom.title);
    clickOn(dom.button); // closes

    clickOn(dom.button);

    expect(dom.title.textContent).toBe('Dey 1403');
  });

  it('pads the last year page and refuses to page past it', () => {
    dom = mount({ current: { year: 1500, month: 1, day: 1 } });
    clickOn(dom.button);

    clickOn(dom.title);

    expect(dom.title.textContent).toBe('1500 – 1500');
    expect(cells()).toHaveLength(1);
    expect(dom.grid.querySelectorAll('.cal-blank')).toHaveLength(11);
    expect(dom.next.disabled).toBe(true);
    expect(dom.prev.disabled).toBe(false);
  });
});

describe('paging', () => {
  it('steps a month, then a year, then twelve years', () => {
    clickOn(dom.button);

    clickOn(dom.next);
    expect(dom.title.textContent).toBe('Bahman 1403');

    clickOn(dom.title);
    expect(dom.title.textContent).toBe('1392 – 1403');
    clickOn(dom.next);
    expect(dom.title.textContent).toBe('1404 – 1415');

    clickOn(cellFor('year', 1404));
    clickOn(dom.next);
    expect(dom.title.textContent).toBe('1405');
    clickOn(dom.prev);
    expect(dom.title.textContent).toBe('1404');
  });

  it('hands focus back to the button that was pressed', () => {
    clickOn(dom.button);

    clickOn(dom.next);

    // The grid is focused first so that disabling the button cannot blur into a
    // dismissal, but a keyboard user has to stay where they were.
    expect(document.activeElement).toBe(dom.next);
  });

  it('leaves focus on the grid when the step disabled the button', () => {
    dom = mount({ current: { year: 1500, month: 11, day: 1 } });
    clickOn(dom.button);

    clickOn(dom.next); // Esfand 1500 is the last month of the range

    expect(dom.next.disabled).toBe(true);
    expect(document.activeElement).toBe(dom.grid);
  });

  it('names each view\'s step buttons after what they step', () => {
    clickOn(dom.button);
    expect(dom.prev.getAttribute('aria-label')).toBe('Previous month');
    expect(dom.next.getAttribute('aria-label')).toBe('Next month');

    clickOn(dom.title);
    expect(dom.prev.getAttribute('aria-label')).toBe('Previous 12 years');
    expect(dom.next.getAttribute('aria-label')).toBe('Next 12 years');

    clickOn(cellFor('year', 1400));
    expect(dom.prev.getAttribute('aria-label')).toBe('Previous year');
    expect(dom.next.getAttribute('aria-label')).toBe('Next year');

    dom.setLang('fa');
    dom.calendar.rerender();
    expect(dom.next.getAttribute('aria-label')).toBe('سال بعد');
  });

  it('refuses to step past the end of the range', () => {
    dom = mount({ current: { year: 1500, month: 12, day: 1 } });
    clickOn(dom.button);
    expect(dom.next.disabled).toBe(true);

    press(dom.grid, 'PageDown');

    expect(dom.title.textContent).toBe('Esfand 1500');
  });
});

describe('the committed date', () => {
  it('marks it only on the page that holds it', () => {
    clickOn(dom.button);
    expect(cellFor('day', 22).classList.contains('active')).toBe(true);

    clickOn(dom.next); // Bahman: the converter still holds 22 Dey

    expect(dom.grid.querySelectorAll('.active')).toHaveLength(0);
    expect(dom.grid.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);

    clickOn(dom.prev);

    expect(cellFor('day', 22).classList.contains('active')).toBe(true);
  });

  it('follows the fields rather than the browsing, on every render', () => {
    clickOn(dom.button);

    dom.setCurrent({ year: 1403, month: 10, day: 5 });
    dom.calendar.rerender();

    expect(cellFor('day', 5).classList.contains('active')).toBe(true);
    expect(cellFor('day', 22).classList.contains('active')).toBe(false);
  });

  it('marks nothing at all when the fields hold no date', () => {
    dom = mount({ current: null, today: { year: 1403, month: 10, day: 1 } });

    clickOn(dom.button);

    expect(dom.grid.querySelectorAll('.active')).toHaveLength(0);
    // Today is still marked: the two are different marks.
    expect(cellFor('day', 1).classList.contains('today')).toBe(true);
  });
});

describe('the column count', () => {
  it('hands the grid its own width, so the CSS needs no second copy', () => {
    clickOn(dom.button);
    expect(dom.grid.style.getPropertyValue('--cal-cols')).toBe('7');

    clickOn(dom.title);

    expect(dom.grid.style.getPropertyValue('--cal-cols')).toBe('3');
  });
});

describe('the title', () => {
  it('does nothing at the top of the drill-down', () => {
    clickOn(dom.button);
    clickOn(dom.title); // years: nowhere further up

    clickOn(dom.title);

    expect(dom.title.textContent).toBe('1392 – 1403');
    expect(dom.pop.hidden).toBe(false);
    expect(dom.onPick).not.toHaveBeenCalled();
  });
});

describe('the keyboard', () => {
  it('walks the grid a day and a week at a time', () => {
    clickOn(dom.button);

    expect(press(dom.grid, 'ArrowRight').defaultPrevented).toBe(true);
    expect(activeId()).toBe('p-cal-grid-d23');
    press(dom.grid, 'ArrowLeft');
    expect(activeId()).toBe('p-cal-grid-d22');
    press(dom.grid, 'ArrowDown');
    expect(activeId()).toBe('p-cal-grid-d29');
    press(dom.grid, 'ArrowUp');
    expect(activeId()).toBe('p-cal-grid-d22');
  });

  it('mirrors the arrows when the page is right-to-left', () => {
    document.documentElement.dir = 'rtl';
    clickOn(dom.button);

    press(dom.grid, 'ArrowRight');

    expect(activeId()).toBe('p-cal-grid-d21');
  });

  it('reaches the ends of the week with Home and End', () => {
    clickOn(dom.button);

    press(dom.grid, 'Home');
    expect(activeId()).toBe('p-cal-grid-d22');
    press(dom.grid, 'End');
    expect(activeId()).toBe('p-cal-grid-d28');
  });

  it('lands on the nearest real day when the row is short', () => {
    dom = mount({ current: { ...TIR_1403, day: 30 } });
    clickOn(dom.button);

    // Tir 1403 runs out mid-row, so the end of that row is a blank: End settles
    // on the last day the month does have.
    press(dom.grid, 'End');

    expect(activeId()).toBe('p-cal-grid-d31');
  });

  it('keeps an arrow that cannot land from scrolling the page', () => {
    dom = mount({ current: { year: 1403, month: 10, day: 1 } });
    clickOn(dom.button);

    // Day 1 is the very first cell: there is nothing to its left, and left to
    // the browser the arrow would scroll the page instead of doing nothing.
    const event = press(dom.grid, 'ArrowLeft');

    expect(event.defaultPrevented).toBe(true);
    expect(activeId()).toBe('p-cal-grid-d1');
  });

  it('refuses to move into a row that is all padding', () => {
    dom = mount({ current: { year: 1500, month: 1, day: 1 } });
    clickOn(dom.button);
    clickOn(dom.title); // the last year page holds 1500 and eleven blanks

    press(dom.grid, 'ArrowDown');

    expect(activeId()).toBe('p-cal-grid-y1500');
  });

  it('leaves keys it has no use for to the browser', () => {
    clickOn(dom.button);

    expect(press(dom.grid, 'a').defaultPrevented).toBe(false);
    expect(dom.pop.hidden).toBe(false);
  });

  it('pages with PageUp and PageDown', () => {
    clickOn(dom.button);

    expect(press(dom.grid, 'PageDown').defaultPrevented).toBe(true);
    expect(dom.title.textContent).toBe('Bahman 1403');
    press(dom.grid, 'PageUp');
    expect(dom.title.textContent).toBe('Dey 1403');
  });

  it('carries the cursor across a page step', () => {
    clickOn(dom.button);
    press(dom.grid, 'ArrowDown');
    expect(activeId()).toBe('p-cal-grid-d29');

    press(dom.grid, 'PageDown');

    // Where the arrows left it, not where the state's own day sits.
    expect(dom.title.textContent).toBe('Bahman 1403');
    expect(activeId()).toBe('p-cal-grid-d29');
    press(dom.grid, 'Enter');
    expect(dom.onPick).toHaveBeenCalledWith(1403, 11, 29);
  });

  it('clamps a carried cursor the shorter page cannot hold', () => {
    // Shahrivar has 31 days and Mehr 30, so day 31 has nowhere to land.
    dom = mount({ current: { year: 1403, month: 6, day: 31 } });
    clickOn(dom.button);
    expect(activeId()).toBe('p-cal-grid-d31');

    press(dom.grid, 'PageDown');

    expect(dom.title.textContent).toBe('Mehr 1403');
    expect(activeId()).toBe('p-cal-grid-d30');
  });

  it('carries nothing when the page it steps off has no cells', () => {
    dom = mount({ side: 'gregorian', current: { year: 2000, month: 13, day: 1 } });
    clickOn(dom.button);
    expect(activeId()).toBeNull();

    press(dom.grid, 'PageDown');

    expect(dom.title.textContent).toBe('February 2001');
    expect(activeId()).toBeNull();
  });

  it('picks with Enter and with Space', () => {
    clickOn(dom.button);

    expect(press(dom.grid, 'Enter').defaultPrevented).toBe(true);
    expect(dom.onPick).toHaveBeenCalledWith(1403, 10, 22);

    clickOn(dom.button);
    press(dom.grid, ' ');
    expect(dom.onPick).toHaveBeenCalledTimes(2);
  });

  it('leaves Enter on a header button to that button', () => {
    clickOn(dom.button);

    press(dom.next, 'Enter');

    expect(dom.onPick).not.toHaveBeenCalled();
    expect(dom.pop.hidden).toBe(false);
  });

  it('closes on Escape from anywhere in the popup', () => {
    clickOn(dom.button);
    const focus = vi.spyOn(dom.button, 'focus');

    expect(press(dom.next, 'Escape').defaultPrevented).toBe(true);

    expect(dom.pop.hidden).toBe(true);
    expect(focus).toHaveBeenCalled();
  });

  it('ignores keys arriving while the popup is closed', () => {
    press(dom.grid, 'ArrowDown');
    press(dom.grid, 'Home');

    expect(dom.pop.hidden).toBe(true);
    expect(activeId()).toBeNull();
  });

  it('drills down from the years view with Enter', () => {
    clickOn(dom.button);
    clickOn(dom.title);
    expect(activeId()).toBe('p-cal-grid-y1403');

    press(dom.grid, 'ArrowUp');
    expect(activeId()).toBe('p-cal-grid-y1400');

    press(dom.grid, 'Enter');
    expect(dom.title.textContent).toBe('1400');
    press(dom.grid, 'Enter');
    expect(dom.title.textContent).toBe('Dey 1400');
  });
});

describe('dismissal', () => {
  it('closes on a pointer outside and keeps the grid pointing nowhere', () => {
    clickOn(dom.button);

    pointerDownOn(dom.outside);

    expect(dom.pop.hidden).toBe(true);
    expect(activeId()).toBeNull();
  });

  it('survives a pointer inside', () => {
    clickOn(dom.button);

    pointerDownOn(dom.grid);

    expect(dom.pop.hidden).toBe(false);
    expect(activeId()).toBe('p-cal-grid-d22');
  });

  it('closes when focus leaves the popup', () => {
    clickOn(dom.button);

    focusOutOf(dom.grid, dom.outside);

    expect(dom.pop.hidden).toBe(true);
    expect(activeId()).toBeNull();
  });

  it('stays put when focus moves inside the popup', () => {
    clickOn(dom.button);

    focusOutOf(dom.grid, dom.next);

    expect(dom.pop.hidden).toBe(false);
    expect(activeId()).toBe('p-cal-grid-d22');
  });

  it('closes from the outside without returning focus', () => {
    clickOn(dom.button);
    const focus = vi.spyOn(dom.button, 'focus');

    dom.calendar.close();

    expect(dom.pop.hidden).toBe(true);
    expect(focus).not.toHaveBeenCalled();
  });
});

describe('keeping the cursor in view', () => {
  /**
   * Every render rebuilds the cells, so a rect stubbed on one element would be
   * thrown away with it. Matching on what an element *is* survives the rebuild.
   */
  const openAndStub = (cursor: { top: number; bottom: number }): void => {
    clickOn(dom.button);
    trackScroll(dom.pop);
    const box = (top: number, bottom: number): DOMRect => ({
      x: 0, y: top, left: 0, right: 0, width: 0, top, bottom,
      height: bottom - top, toJSON: () => ({}),
    }) as DOMRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ): DOMRect {
      if (this === dom.pop) return box(100, 200);
      if (this instanceof HTMLElement && this.dataset['day'] === '23') {
        return box(cursor.top, cursor.bottom);
      }
      return box(0, 0);
    });
  };

  it('scrolls up to a cursor above the popup', () => {
    openAndStub({ top: 60, bottom: 90 });

    press(dom.grid, 'ArrowRight');

    expect(dom.pop.scrollTop).toBe(-40);
  });

  it('scrolls down to a cursor below the popup', () => {
    openAndStub({ top: 220, bottom: 250 });

    press(dom.grid, 'ArrowRight');

    expect(dom.pop.scrollTop).toBe(50);
  });

  it('leaves the scroll alone for a cursor already in view', () => {
    openAndStub({ top: 120, bottom: 150 });

    press(dom.grid, 'ArrowRight');

    expect(dom.pop.scrollTop).toBe(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldOption } from '../../src/converter/field-options';
import { createNumberPicker, type NumberPicker } from '../../src/ui/number-picker';
import {
  clickOn, focusOutOf, pointerDownOn, press, setMediaMatches, stubRect, trackScroll,
} from './dom-helpers';

const plain = (count: number): readonly FieldOption[] =>
  Array.from({ length: count }, (_, i) => ({ value: i + 1, num: String(i + 1), name: '' }));

const named = (...names: readonly string[]): readonly FieldOption[] =>
  names.map((name, i) => ({ value: i + 1, num: String(i + 1), name }));

interface Harness {
  input: HTMLInputElement;
  toggle: HTMLButtonElement;
  list: HTMLElement;
  outside: HTMLButtonElement;
  picker: NumberPicker;
  onCommit: ReturnType<typeof vi.fn>;
}

let dom: Harness;

/** Pickers keep document-level listeners for their lifetime; a closed one is inert. */
const built: NumberPicker[] = [];

afterEach(() => {
  for (const picker of built.splice(0)) picker.close();
});

const mount = (options: readonly FieldOption[] = plain(5)): Harness => {
  document.body.innerHTML = `
    <div class="picker">
      <input id="p-y" type="text" role="combobox" aria-expanded="false" />
      <button id="p-y-toggle" type="button"></button>
      <ul id="p-y-list" role="listbox" tabindex="-1" hidden></ul>
    </div>
    <button id="outside" type="button"></button>`;
  const onCommit = vi.fn();
  const harness: Harness = {
    input: document.querySelector<HTMLInputElement>('#p-y')!,
    toggle: document.querySelector<HTMLButtonElement>('#p-y-toggle')!,
    list: document.querySelector<HTMLElement>('#p-y-list')!,
    outside: document.querySelector<HTMLButtonElement>('#outside')!,
    onCommit,
    picker: undefined as unknown as NumberPicker,
  };
  harness.picker = createNumberPicker({
    input: harness.input, toggle: harness.toggle, list: harness.list, onCommit,
  });
  built.push(harness.picker);
  harness.picker.setOptions(options);
  return harness;
};

const rows = (): HTMLElement[] => [...dom.list.children] as HTMLElement[];
const activeId = (host: HTMLElement): string | null => host.getAttribute('aria-activedescendant');

beforeEach(() => {
  setMediaMatches(false);
  dom = mount();
});

describe('opening', () => {
  it('renders the options on the first open and reuses them afterwards', () => {
    clickOn(dom.toggle);

    expect(dom.list.hidden).toBe(false);
    expect(rows()).toHaveLength(5);
    expect(rows()[0]?.id).toBe('p-y-list-o1');
    expect(dom.input.getAttribute('aria-expanded')).toBe('true');
    expect(dom.toggle.getAttribute('aria-expanded')).toBe('true');

    const first = rows()[0];
    clickOn(dom.toggle);
    clickOn(dom.toggle);
    expect(rows()[0]).toBe(first);
  });

  it('lays a named option out as a number and a name, separated by a space', () => {
    dom = mount(named('Farvardin', 'Ordibehesht'));
    clickOn(dom.toggle);

    const row = rows()[0]!;
    expect(row.querySelector('.opt-num')?.textContent).toBe('1');
    expect(row.querySelector('.opt-name')?.textContent).toBe('Farvardin');
    expect(row.textContent).toBe('1 Farvardin');
  });

  it('refuses to open with nothing to show', () => {
    dom = mount([]);

    clickOn(dom.toggle);

    expect(dom.list.hidden).toBe(true);
    expect(dom.input.getAttribute('aria-expanded')).toBe('false');
  });

  it('starts on the option the field already holds, in any digit script', () => {
    dom.input.value = '۳';

    clickOn(dom.toggle);

    expect(rows()[2]?.classList.contains('active')).toBe(true);
    expect(rows()[2]?.getAttribute('aria-selected')).toBe('true');
    expect(activeId(dom.input)).toBe('p-y-list-o3');
  });

  it('starts at the first option when the field holds nothing usable', () => {
    dom.input.value = 'abc';

    clickOn(dom.toggle);

    expect(rows()[0]?.classList.contains('active')).toBe(true);
    expect(rows().every((row) => row.getAttribute('aria-selected') === 'false')).toBe(true);
  });

  it('starts at the first option when the number is not in the list', () => {
    dom.input.value = '99';

    clickOn(dom.toggle);

    expect(rows()[0]?.classList.contains('active')).toBe(true);
  });

  it('closes again when the toggle is pressed twice', () => {
    const focus = vi.spyOn(dom.input, 'focus');
    clickOn(dom.toggle);

    clickOn(dom.toggle);

    expect(dom.list.hidden).toBe(true);
    expect(dom.input.getAttribute('aria-expanded')).toBe('false');
    expect(activeId(dom.input)).toBeNull();
    expect(focus).toHaveBeenCalled();
  });

  it('hands focus to the listbox on a touch screen so no keypad appears', () => {
    setMediaMatches(true);
    const blur = vi.spyOn(dom.input, 'blur');
    const focus = vi.spyOn(dom.list, 'focus');

    clickOn(dom.toggle);

    expect(blur).toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    // ARIA wants the pointer on whatever holds DOM focus.
    expect(activeId(dom.list)).toBe('p-y-list-o1');
    expect(activeId(dom.input)).toBeNull();
  });
});

describe('keyboard', () => {
  it('opens downward from the first option and upward from the last', () => {
    press(dom.input, 'ArrowDown');
    expect(activeId(dom.input)).toBe('p-y-list-o1');

    dom.picker.close();
    press(dom.input, 'ArrowUp');
    expect(activeId(dom.input)).toBe('p-y-list-o5');
  });

  it('opens the listbox from the toggle on a touch screen', () => {
    setMediaMatches(true);

    press(dom.toggle, 'ArrowDown');

    expect(activeId(dom.list)).toBe('p-y-list-o1');
  });

  it('walks the list and stops at both ends', () => {
    clickOn(dom.toggle);

    press(dom.list, 'ArrowDown');
    expect(activeId(dom.input)).toBe('p-y-list-o2');
    press(dom.list, 'ArrowUp');
    expect(activeId(dom.input)).toBe('p-y-list-o1');

    // Already at the top: the key is still the list's, so the caret cannot move.
    expect(press(dom.list, 'ArrowUp').defaultPrevented).toBe(true);
    expect(activeId(dom.input)).toBe('p-y-list-o1');
  });

  it('jumps to the ends with Home and End', () => {
    clickOn(dom.toggle);

    press(dom.input, 'End');
    expect(activeId(dom.input)).toBe('p-y-list-o5');
    press(dom.input, 'Home');
    expect(activeId(dom.input)).toBe('p-y-list-o1');
  });

  it('leaves Home, End and the caret keys to the field while closed', () => {
    expect(press(dom.input, 'Home').defaultPrevented).toBe(false);
    expect(press(dom.input, 'ArrowLeft').defaultPrevented).toBe(false);
    expect(press(dom.input, 'ArrowRight').defaultPrevented).toBe(false);
    expect(dom.list.hidden).toBe(true);
  });

  it('leaves the caret keys alone while open', () => {
    clickOn(dom.toggle);

    expect(press(dom.input, 'ArrowLeft').defaultPrevented).toBe(false);
    expect(dom.list.hidden).toBe(false);
  });

  it('commits the active option on Enter', () => {
    clickOn(dom.toggle);
    press(dom.input, 'ArrowDown');

    expect(press(dom.input, 'Enter').defaultPrevented).toBe(true);
    expect(dom.onCommit).toHaveBeenCalledWith(2);
    expect(dom.list.hidden).toBe(true);
  });

  it('treats Space as activation on the toggle but as a character in the field', () => {
    clickOn(dom.toggle);

    expect(press(dom.input, ' ').defaultPrevented).toBe(false);
    expect(dom.list.hidden).toBe(false);

    press(dom.toggle, ' ');
    expect(dom.onCommit).toHaveBeenCalledWith(1);
  });

  it('keeps the typed value when Enter lands on no option', () => {
    dom.input.value = '99';
    clickOn(dom.toggle);
    dom.input.value = '';
    dom.input.dispatchEvent(new Event('input', { bubbles: true }));

    press(dom.input, 'Enter');

    expect(dom.onCommit).not.toHaveBeenCalled();
    expect(dom.list.hidden).toBe(true);
    expect(dom.input.value).toBe('');
  });

  it('closes on Escape and on Tab, and only Escape restores focus', () => {
    const focus = vi.spyOn(dom.input, 'focus');
    clickOn(dom.toggle);
    focus.mockClear();
    press(dom.input, 'Escape');
    expect(dom.list.hidden).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);

    clickOn(dom.toggle);
    focus.mockClear();
    // Tab is on its way to the next field: pulling focus back would trap it.
    press(dom.input, 'Tab');
    expect(dom.list.hidden).toBe(true);
    expect(focus).not.toHaveBeenCalled();
  });

  it('leaves the paging keys to the browser', () => {
    clickOn(dom.toggle);

    expect(press(dom.input, 'PageDown').defaultPrevented).toBe(false);
    expect(activeId(dom.input)).toBe('p-y-list-o1');
  });

  it('ignores keys it has no use for', () => {
    expect(press(dom.input, 'a').defaultPrevented).toBe(false);
    expect(dom.list.hidden).toBe(true);
  });

  it('does nothing on Enter when the list has emptied under the cursor', () => {
    clickOn(dom.toggle);
    dom.picker.setOptions([]);
    press(dom.input, 'Home');

    press(dom.input, 'Enter');

    expect(dom.onCommit).not.toHaveBeenCalled();
  });
});

describe('typing while the list is open', () => {
  it('follows the field to the matching option', () => {
    clickOn(dom.toggle);

    dom.input.value = '4';
    dom.input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(activeId(dom.input)).toBe('p-y-list-o4');
    expect(rows()[3]?.getAttribute('aria-selected')).toBe('true');
  });

  it('ignores typing while the list is closed', () => {
    dom.input.value = '4';
    dom.input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(activeId(dom.input)).toBeNull();
  });
});

describe('choosing with the pointer', () => {
  it('commits the option that was clicked', () => {
    clickOn(dom.toggle);

    const event = clickOn(rows()[2]!.appendChild(document.createElement('span')));

    expect(event.defaultPrevented).toBe(true);
    expect(dom.onCommit).toHaveBeenCalledWith(3);
    expect(dom.list.hidden).toBe(true);
  });

  it('ignores a click that misses every option', () => {
    clickOn(dom.toggle);

    clickOn(dom.list);

    expect(dom.onCommit).not.toHaveBeenCalled();
    expect(dom.list.hidden).toBe(false);
  });

  it('ignores an option belonging to some other list', () => {
    clickOn(dom.toggle);
    const foreign = document.createElement('ul');
    foreign.innerHTML = '<li id="stray"></li>';
    dom.list.append(foreign);

    clickOn(document.querySelector('#stray')!);

    expect(dom.onCommit).not.toHaveBeenCalled();
  });
});

describe('dismissal', () => {
  it('clears the picker state when a pointer lands outside', () => {
    clickOn(dom.toggle);

    pointerDownOn(dom.outside);

    expect(dom.list.hidden).toBe(true);
    expect(dom.input.getAttribute('aria-expanded')).toBe('false');
    expect(activeId(dom.input)).toBeNull();
  });

  it('survives a pointer inside', () => {
    clickOn(dom.toggle);

    pointerDownOn(dom.input);

    expect(dom.list.hidden).toBe(false);
    expect(activeId(dom.input)).toBe('p-y-list-o1');
  });

  it('clears the picker state when focus leaves', () => {
    clickOn(dom.toggle);

    focusOutOf(dom.input, dom.outside);

    expect(dom.list.hidden).toBe(true);
    expect(dom.input.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('setOptions', () => {
  it('swaps the list under an open popup and keeps the cursor in range', () => {
    clickOn(dom.toggle);
    press(dom.input, 'End');
    expect(activeId(dom.input)).toBe('p-y-list-o5');

    dom.picker.setOptions(plain(2));

    expect(rows()).toHaveLength(2);
    expect(activeId(dom.input)).toBe('p-y-list-o2');
  });

  it('drops the cursor when nothing is left to point at', () => {
    clickOn(dom.toggle);

    dom.picker.setOptions([]);

    expect(rows()).toHaveLength(0);
    expect(activeId(dom.input)).toBeNull();
  });

  it('defers rendering while the popup is closed', () => {
    dom.picker.setOptions(plain(3));

    expect(rows()).toHaveLength(0);
  });
});

describe('keeping the active option in view', () => {
  const openWithRects = (active: { top: number; bottom: number }): void => {
    clickOn(dom.toggle);
    stubRect(dom.list, { top: 100, bottom: 200, height: 100 });
    trackScroll(dom.list);
    stubRect(rows()[1]!, { ...active, height: active.bottom - active.top });
  };

  it('scrolls up to an option above the viewport', () => {
    openWithRects({ top: 60, bottom: 90 });

    press(dom.input, 'ArrowDown');

    expect(dom.list.scrollTop).toBe(-40);
  });

  it('scrolls down to an option below the viewport', () => {
    openWithRects({ top: 220, bottom: 250 });

    press(dom.input, 'ArrowDown');

    expect(dom.list.scrollTop).toBe(50);
  });

  it('leaves the scroll alone for an option already in view', () => {
    openWithRects({ top: 120, bottom: 150 });

    press(dom.input, 'ArrowDown');

    expect(dom.list.scrollTop).toBe(0);
  });
});

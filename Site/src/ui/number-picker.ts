import type { FieldOption } from '../converter/field-options';
import { normalizeDigits } from '../converter/converter-core';
import { gridIntent } from './grid-navigation';
import { createPopup } from './popup';

export interface NumberPicker {
  setOptions(options: readonly FieldOption[]): void;
  close(): void;
}

interface Parts {
  input: HTMLInputElement;
  toggle: HTMLButtonElement;
  list: HTMLElement;
  /** Called with the chosen option's value. The caller owns writing the field. */
  onCommit: (value: number) => void;
}

/**
 * A type-or-pick numeric field: the input stays a plain text field, and the
 * popup is an ARIA listbox driven by aria-activedescendant so focus never
 * leaves the input and typing keeps working while the list is open.
 *
 * Deliberately ignorant of calendars, languages, and digits — it renders the
 * options it is handed and reports the value that was chosen.
 */
export function createNumberPicker({ input, toggle, list, onCommit }: Parts): NumberPicker {
  /** Matches the CSS touch-target block exactly — see the design spec. */
  const isTouchish = (): boolean =>
    window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;

  // The toggle is the trigger: it is what may swallow a press, whereas the text
  // field must still accept a click to place the caret, so the field only counts
  // as "inside" for dismissal.
  const popup = createPopup({ trigger: toggle, surface: list, within: [input] });

  let options: readonly FieldOption[] = [];
  let activeIndex = -1;
  /**
   * Which element carries `aria-activedescendant`. ARIA requires it on the
   * element that actually holds DOM focus, and the touch path focuses the
   * listbox rather than the input (a text field would summon the keypad).
   */
  let ariaHost: HTMLElement = input;
  /**
   * Option DOM is built on first open, not on every setOptions. With three
   * pickers a side and 300 years apiece, eager rendering would put ~1,200 nodes
   * on the page before the user has opened anything.
   */
  let needsRender = true;

  /** Index of the option matching the field's current number, or -1. */
  const selectedIndex = (): number => {
    const cleaned = normalizeDigits(input.value.trim());
    if (!/^\d+$/.test(cleaned)) return -1;
    const n = Number(cleaned);
    return options.findIndex((o) => o.value === n);
  };

  const setActiveDescendant = (id: string | null): void => {
    for (const el of [input, list]) el.removeAttribute('aria-activedescendant');
    if (id !== null) ariaHost.setAttribute('aria-activedescendant', id);
  };

  /**
   * Bring the active row into view by scrolling the LIST only.
   * `scrollIntoView({block:'nearest'})` scrolls the nearest scrollable ancestor
   * too, which lurched the whole page whenever the list overflowed the viewport.
   */
  const revealActive = (active: HTMLElement): void => {
    const listRect = list.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (rect.top < listRect.top) {
      list.scrollTop -= listRect.top - rect.top;
    } else if (rect.bottom > listRect.bottom) {
      list.scrollTop += rect.bottom - listRect.bottom;
    }
  };

  const paint = (): void => {
    const selected = selectedIndex();
    const children = [...list.children];
    children.forEach((child, i) => {
      const el = child as HTMLElement;
      el.classList.toggle('active', i === activeIndex);
      el.setAttribute('aria-selected', String(i === selected));
    });
    const active = activeIndex >= 0
      ? (children[activeIndex] as HTMLElement | undefined)
      : undefined;
    if (active === undefined) {
      setActiveDescendant(null);
      return;
    }
    setActiveDescendant(active.id);
    revealActive(active);
  };

  const render = (): void => {
    list.replaceChildren(...options.map((option) => {
      const li = document.createElement('li');
      li.id = `${list.id}-o${option.value}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset['value'] = String(option.value);

      const num = document.createElement('span');
      num.className = 'opt-num';
      num.textContent = option.num;
      li.append(num);

      if (option.name !== '') {
        // A real space keeps textContent reading as "22 Saturday" for assistive
        // tech and for anything that flattens the row. It costs nothing in the
        // grid: a whitespace-only text node generates no box, so the row still
        // has exactly two columns.
        li.append(document.createTextNode(' '));
        const name = document.createElement('span');
        name.className = 'opt-name';
        name.textContent = option.name;
        li.append(name);
      }
      return li;
    }));
  };

  const open = (
    opts: { invoker: HTMLElement; focusTarget: HTMLElement; fallback: 'first' | 'last' },
  ): void => {
    if (options.length === 0) return;
    if (needsRender) { render(); needsRender = false; }
    ariaHost = opts.focusTarget === list ? list : input;
    const selected = selectedIndex();
    activeIndex = selected >= 0
      ? selected
      : (opts.fallback === 'first' ? 0 : options.length - 1);
    // The field is a combobox, so its own expanded state is the picker's to keep;
    // the popup only owns the trigger's.
    input.setAttribute('aria-expanded', 'true');
    popup.open({ invoker: opts.invoker, focusTarget: opts.focusTarget });
    // Paint after opening: paint()'s reveal math needs the list's final geometry,
    // or it scrolls against a box that is about to move.
    paint();
  };

  /** Open from the keyboard, keeping focus wherever the key was pressed. */
  const openFromKey = (from: HTMLElement, fallback: 'first' | 'last'): void => {
    const focusTarget = from === toggle && isTouchish() ? list : input;
    open({ invoker: from, focusTarget, fallback });
  };

  /** The picker-owned state that a closed list must not leave behind. */
  const syncClosed = (): void => {
    activeIndex = -1;
    setActiveDescendant(null);
    ariaHost = input;
    input.setAttribute('aria-expanded', 'false');
  };

  const close = (restoreFocus: boolean): void => {
    popup.close(restoreFocus);
    syncClosed();
  };

  const commit = (index: number): void => {
    const option = options[index];
    if (option === undefined) return;
    close(true);
    onCommit(option.value);
  };

  /**
   * gridIntent walks from a real cell. When the typed value matches no option the
   * cursor sits off the list at -1, and the two arrows must enter it from the
   * correct end: Down at the first option, Up at the last.
   */
  const cursorFor = (key: string): number =>
    activeIndex >= 0 ? activeIndex : (key === 'ArrowUp' ? options.length : -1);

  const onKeyDown = (event: KeyboardEvent): void => {
    const isOpen = popup.isOpen;
    const key = event.key;

    // Three keys the shared grid mapping cannot own here, because a listbox in a
    // text field is not a grid: Home and End address the whole list rather than
    // the current row, ArrowLeft/ArrowRight belong to the caret, and Tab must let
    // focus proceed to the next field.
    if ((key === 'Home' || key === 'End') && isOpen) {
      event.preventDefault();
      activeIndex = key === 'Home' ? 0 : options.length - 1;
      paint();
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') return;
    if (key === 'Tab') { close(false); return; }
    // Space is activation on the toggle and the listbox — both can hold focus
    // while the list is open — but in the text field it is a character.
    if (key === ' ' && event.currentTarget === input) return;

    const shape = { columns: 1, count: options.length, rtl: false };
    const intent = gridIntent(key, cursorFor(key), shape, isOpen);
    if (intent === null) {
      // An arrow at either end of an open list is still the list's: left alone it
      // would drive the caret or scroll the listbox instead of doing nothing.
      if (isOpen && (key === 'ArrowDown' || key === 'ArrowUp')) event.preventDefault();
      return;
    }
    switch (intent.kind) {
      case 'open':
        event.preventDefault();
        openFromKey(event.currentTarget as HTMLElement, key === 'ArrowDown' ? 'first' : 'last');
        return;
      case 'move':
        event.preventDefault();
        activeIndex = intent.index;
        paint();
        return;
      case 'select':
        // Suppressed even when nothing is active, so Enter never submits.
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex); else close(true);
        return;
      case 'dismiss':
        event.preventDefault();
        close(true); // The typed value stands.
        return;
      case 'page':
        return; // A list of one column has no pages; the keys stay the browser's.
    }
  };

  // All three can hold focus while the popup is open (the listbox does on the
  // touch path), so all three need the key bindings. Typed as HTMLElement so
  // the generic addEventListener overload resolves: a union of element types
  // falls back to the non-generic EventListener signature.
  for (const el of [input, toggle, list] as readonly HTMLElement[]) {
    el.addEventListener('keydown', onKeyDown);
  }

  // Typing is an explicitly supported path while the list is open, so the cursor
  // and the ARIA state must follow the value the field actually holds. With
  // activeIndex === -1 the Enter branch falls through to close(true), which keeps
  // the typed value instead of overwriting it.
  input.addEventListener('input', () => {
    if (!popup.isOpen) return;
    activeIndex = selectedIndex();
    paint();
  });

  // The popup dismisses itself on an outside pointerdown or on focus leaving, and
  // reports no callback, so the picker mirrors those closes. Registered after
  // createPopup, so on every one of these targets the popup's own handler has
  // already run and `popup.isOpen` is settled.
  const syncAfterDismissal = (): void => { if (!popup.isOpen) syncClosed(); };
  document.addEventListener('pointerdown', syncAfterDismissal);
  for (const el of [input, toggle, list] as readonly HTMLElement[]) {
    el.addEventListener('focusout', syncAfterDismissal);
  }

  toggle.addEventListener('click', () => {
    if (popup.isOpen) { close(true); return; }
    if (isTouchish()) {
      // Focus the listbox, not the input: a text field would summon the OS
      // keypad over the very list the user just opened. Focus still returns to
      // the toggle on close, so the keypad stays down throughout.
      input.blur();
      open({ invoker: toggle, focusTarget: list, fallback: 'first' });
      return;
    }
    open({ invoker: input, focusTarget: input, fallback: 'first' });
  });

  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest('li');
    if (li === null || li.parentElement !== list) return;
    // Cancel activation behaviour so focus stays where close(true) put it.
    event.preventDefault();
    const index = [...list.children].indexOf(li);
    if (index >= 0) commit(index);
  });

  return {
    setOptions(next) {
      options = next;
      needsRender = true;
      if (!popup.isOpen) return;
      // Visible right now, so it has to change under the user immediately.
      render();
      needsRender = false;
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      paint();
    },
    close() { close(false); },
  };
}

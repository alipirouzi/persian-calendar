import type { FieldOption } from '../converter/field-options';
import { normalizeDigits } from '../converter/converter-core';

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
  /** Vertical gap between field and list — mirrors the CSS `calc(100% + 4px)`. */
  const GAP = 4;

  /** Matches the CSS touch-target block exactly — see the design spec. */
  const isTouchish = (): boolean =>
    window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;

  let options: readonly FieldOption[] = [];
  let activeIndex = -1;
  let isOpen = false;
  /** Where focus returns when the popup closes: whatever opened it. */
  let invoker: HTMLElement = input;
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

  const setExpanded = (value: boolean): void => {
    isOpen = value;
    list.hidden = !value;
    input.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-expanded', String(value));
  };

  /**
   * Open downward by default; flip above only when the list does not fit below
   * AND genuinely fits above. When it fits neither way it stays below, because
   * downward overflow grows the document so page scroll can still reach the
   * rows, while upward overflow is unreachable.
   *
   * visualViewport is what shrinks when a mobile keypad is showing, so prefer
   * it — and re-run on its `resize` so a decision taken while the keypad was
   * still retracting is corrected once it has gone.
   */
  const positionList = (): void => {
    list.classList.remove('above');
    const field = input.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const spaceBelow = viewportHeight - field.bottom;
    const spaceAbove = field.top;
    const listHeight = list.getBoundingClientRect().height;
    if (listHeight + GAP > spaceBelow && listHeight + GAP <= spaceAbove) {
      list.classList.add('above');
    }
  };

  window.visualViewport?.addEventListener('resize', () => {
    if (isOpen) positionList();
  });

  const open = (
    opts: { invoker: HTMLElement; focusTarget: HTMLElement; fallback: 'first' | 'last' },
  ): void => {
    if (options.length === 0) return;
    if (needsRender) { render(); needsRender = false; }
    invoker = opts.invoker;
    ariaHost = opts.focusTarget === list ? list : input;
    const selected = selectedIndex();
    activeIndex = selected >= 0
      ? selected
      : (opts.fallback === 'first' ? 0 : options.length - 1);
    setExpanded(true);
    // Position before painting: paint()'s reveal math needs the list's final
    // geometry, or it scrolls against a box that is about to move.
    positionList();
    paint();
    if (document.activeElement !== opts.focusTarget) opts.focusTarget.focus();
  };

  /** Open from the keyboard, keeping focus wherever the key was pressed. */
  const openFromKey = (from: HTMLElement, fallback: 'first' | 'last'): void => {
    const focusTarget = from === toggle && isTouchish() ? list : input;
    open({ invoker: from, focusTarget, fallback });
  };

  const close = (restoreFocus: boolean): void => {
    if (!isOpen) return;
    setExpanded(false);
    activeIndex = -1;
    setActiveDescendant(null);
    ariaHost = input;
    list.classList.remove('above');
    if (restoreFocus) invoker.focus();
  };

  const commit = (index: number): void => {
    const option = options[index];
    if (option === undefined) return;
    close(true);
    onCommit(option.value);
  };

  const move = (delta: number): void => {
    if (options.length === 0) return;
    const next = activeIndex < 0 ? (delta > 0 ? 0 : options.length - 1) : activeIndex + delta;
    activeIndex = Math.min(options.length - 1, Math.max(0, next));
    paint();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) move(1);
        else openFromKey(event.currentTarget as HTMLElement, 'first');
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) move(-1);
        else openFromKey(event.currentTarget as HTMLElement, 'last');
        return;
      case 'Home':
        if (!isOpen) return;
        event.preventDefault();
        activeIndex = 0;
        paint();
        return;
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        activeIndex = options.length - 1;
        paint();
        return;
      case 'Enter':
        if (!isOpen) return;
        // Suppressed even when nothing is active, so Enter never submits.
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex); else close(true);
        return;
      case ' ':
        // Only from the toggle or the listbox: a focused button or listbox
        // treats Space as activation, but in the text field it is a character.
        if (!isOpen || event.currentTarget === input) return;
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex); else close(true);
        return;
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        close(true); // The typed value stands.
        return;
      case 'Tab':
        close(false); // Let focus proceed to the next field.
        return;
      default:
        return;
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
    if (!isOpen) return;
    activeIndex = selectedIndex();
    paint();
  });

  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null
      && (next === input || toggle.contains(next) || list.contains(next))) return;
    close(false);
  };
  for (const el of [input, toggle, list] as readonly HTMLElement[]) {
    el.addEventListener('focusout', onFocusOut);
  }

  // Keep the browser from moving focus on press: `click` decides where it belongs.
  toggle.addEventListener('mousedown', (event) => { event.preventDefault(); });
  toggle.addEventListener('click', () => {
    if (isOpen) { close(true); return; }
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

  list.addEventListener('mousedown', (event) => { event.preventDefault(); });
  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest('li');
    if (li === null || li.parentElement !== list) return;
    // Cancel activation behaviour so focus stays where close(true) put it.
    event.preventDefault();
    const index = [...list.children].indexOf(li);
    if (index >= 0) commit(index);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen) return;
    const target = event.target as Node;
    if (target === input || toggle.contains(target) || list.contains(target)) return;
    close(false);
  });

  return {
    setOptions(next) {
      options = next;
      needsRender = true;
      if (!isOpen) return;
      // Visible right now, so it has to change under the user immediately.
      render();
      needsRender = false;
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      paint();
    },
    close() { close(false); },
  };
}

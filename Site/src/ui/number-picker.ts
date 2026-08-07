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
  let options: readonly FieldOption[] = [];
  let activeIndex = -1;
  let isOpen = false;
  /** Where focus returns when the popup closes: whatever opened it. */
  let invoker: HTMLElement = input;

  /** Index of the option matching the field's current number, or -1. */
  const selectedIndex = (): number => {
    const cleaned = normalizeDigits(input.value.trim());
    if (!/^\d+$/.test(cleaned)) return -1;
    const n = Number(cleaned);
    return options.findIndex((o) => o.value === n);
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
      input.removeAttribute('aria-activedescendant');
    } else {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  };

  const render = (): void => {
    list.replaceChildren(...options.map((option) => {
      const li = document.createElement('li');
      li.id = `${list.id}-o${option.value}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset['value'] = String(option.value);
      li.textContent = option.label;
      return li;
    }));
  };

  const setExpanded = (value: boolean): void => {
    isOpen = value;
    list.hidden = !value;
    input.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-expanded', String(value));
  };

  const open = (from: HTMLElement, fallback: 'first' | 'last'): void => {
    if (options.length === 0) return;
    invoker = from;
    const selected = selectedIndex();
    activeIndex = selected >= 0
      ? selected
      : (fallback === 'first' ? 0 : options.length - 1);
    setExpanded(true);
    paint();
  };

  const close = (restoreFocus: boolean): void => {
    if (!isOpen) return;
    setExpanded(false);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
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

  input.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) move(1); else open(input, 'first');
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) move(-1); else open(input, 'last');
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
  });

  // Keep the browser from moving focus on press: `click` decides where it belongs.
  toggle.addEventListener('mousedown', (event) => { event.preventDefault(); });
  toggle.addEventListener('click', () => {
    if (isOpen) { close(true); return; }
    // Opened by keyboard-then-click → focus returns to the input; opened by a
    // bare tap → focus stays on the toggle, so no OS keyboard covers the list.
    open(document.activeElement === input ? input : toggle, 'first');
  });

  list.addEventListener('mousedown', (event) => { event.preventDefault(); });
  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest('li');
    if (li === null || li.parentElement !== list) return;
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
      render();
      if (!isOpen) return;
      // Stay usable across a re-render: clamp the cursor and repaint in place.
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      paint();
    },
    close() { close(false); },
  };
}

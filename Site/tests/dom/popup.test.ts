import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPopup, type Popup } from '../../src/ui/popup';

/**
 * jsdom has no layout: every element measures zero and `offsetParent` is always
 * null. Both are stubbed per test so the side and cap branches are exercised for
 * real rather than silently agreeing on zero.
 */
const stubRect = (el: HTMLElement, box: { top: number; bottom: number; height: number }): void => {
  el.getBoundingClientRect = (): DOMRect => ({
    x: 0, y: box.top, left: 0, right: 0, width: 0, toJSON: () => ({}), ...box,
  }) as DOMRect;
};

const setViewportHeight = (height: number): void => {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
};

/** A stand-in for the API jsdom does not implement. */
const useVisualViewport = (height: number): EventTarget & { height: number } => {
  const viewport = Object.assign(new EventTarget(), { height });
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  return viewport;
};

const dropVisualViewport = (): void => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
};

interface Harness {
  trigger: HTMLButtonElement;
  surface: HTMLElement;
  field: HTMLInputElement;
  outside: HTMLButtonElement;
}

const opened: Popup[] = [];

/**
 * Popups keep a document-level pointerdown listener for their lifetime, so any
 * left open would answer a later test's events. Closing them is enough — a
 * closed popup's handlers all return immediately.
 */
afterEach(() => {
  for (const popup of opened.splice(0)) popup.close(false);
  dropVisualViewport();
  setViewportHeight(768);
});

const mount = (): Harness => {
  document.body.innerHTML = `
    <div id="host">
      <button id="trigger" type="button"></button>
      <input id="field" />
      <div id="surface" hidden><button id="inner" type="button"></button></div>
    </div>
    <button id="outside" type="button"></button>`;
  const harness: Harness = {
    trigger: document.querySelector<HTMLButtonElement>('#trigger')!,
    surface: document.querySelector<HTMLElement>('#surface')!,
    field: document.querySelector<HTMLInputElement>('#field')!,
    outside: document.querySelector<HTMLButtonElement>('#outside')!,
  };
  // Room to spare below by default, so tests that care about the side say so.
  stubRect(harness.trigger, { top: 100, bottom: 130, height: 30 });
  stubRect(harness.surface, { top: 134, bottom: 334, height: 200 });
  return harness;
};

const track = (popup: Popup): Popup => {
  opened.push(popup);
  return popup;
};

let dom: Harness;

beforeEach(() => {
  dom = mount();
});

const pointerDownOn = (target: Element): void => {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
};

const focusOutOf = (target: Element, relatedTarget: EventTarget | null): void => {
  target.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
};

describe('open and close', () => {
  it('reveals the surface, expands the trigger, and focuses the target', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    const focus = vi.spyOn(dom.surface, 'focus');

    expect(popup.isOpen).toBe(false);
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(popup.isOpen).toBe(true);
    expect(dom.surface.hidden).toBe(false);
    expect(dom.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('leaves focus alone when the target already holds it', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    dom.field.focus();
    const focus = vi.spyOn(dom.field, 'focus');

    popup.open({ invoker: dom.trigger, focusTarget: dom.field });

    expect(document.activeElement).toBe(dom.field);
    expect(focus).not.toHaveBeenCalled();
  });

  it('is idempotent when opened twice', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(popup.isOpen).toBe(true);
    expect(dom.surface.hidden).toBe(false);
    expect(dom.trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the surface and returns focus to the invoker when asked', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    const focus = vi.spyOn(dom.field, 'focus');
    popup.open({ invoker: dom.field, focusTarget: dom.surface });

    popup.close(true);

    expect(popup.isOpen).toBe(false);
    expect(dom.surface.hidden).toBe(true);
    expect(dom.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where it is when not asked to restore it', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    const focus = vi.spyOn(dom.field, 'focus');
    popup.open({ invoker: dom.field, focusTarget: dom.surface });

    popup.close(false);

    expect(focus).not.toHaveBeenCalled();
  });

  it('does nothing when closing an already closed popup', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    const focus = vi.spyOn(dom.trigger, 'focus');

    popup.close(true);

    expect(dom.trigger.hasAttribute('aria-expanded')).toBe(false);
    expect(dom.surface.hidden).toBe(true);
    expect(focus).not.toHaveBeenCalled();
  });

  it('clears the side and the cap on close', () => {
    setViewportHeight(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 500, height: 500 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });
    expect(dom.surface.classList.contains('above')).toBe(true);
    expect(dom.surface.style.maxHeight).not.toBe('');

    popup.close(false);
    expect(dom.surface.classList.contains('above')).toBe(false);
    expect(dom.surface.style.maxHeight).toBe('');
  });
});

describe('dismissal', () => {
  it('closes on a pointerdown outside and stays open on one inside', () => {
    const popup = track(createPopup({
      trigger: dom.trigger, surface: dom.surface, within: [dom.field],
    }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    pointerDownOn(dom.surface.querySelector('#inner')!);
    expect(popup.isOpen).toBe(true);
    pointerDownOn(dom.trigger);
    expect(popup.isOpen).toBe(true);
    pointerDownOn(dom.field);
    expect(popup.isOpen).toBe(true);

    pointerDownOn(dom.outside);
    expect(popup.isOpen).toBe(false);
  });

  it('ignores a pointerdown while closed', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    pointerDownOn(dom.outside);

    expect(popup.isOpen).toBe(false);
    expect(dom.trigger.hasAttribute('aria-expanded')).toBe(false);
  });

  it('closes when focus leaves for an element outside, but not for one inside', () => {
    const popup = track(createPopup({
      trigger: dom.trigger, surface: dom.surface, within: [dom.field],
    }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    focusOutOf(dom.surface, dom.surface.querySelector('#inner'));
    expect(popup.isOpen).toBe(true);
    focusOutOf(dom.field, dom.trigger);
    expect(popup.isOpen).toBe(true);

    focusOutOf(dom.surface, dom.outside);
    expect(popup.isOpen).toBe(false);
  });

  it('closes when focus goes nowhere it can name', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    focusOutOf(dom.surface, null);

    expect(popup.isOpen).toBe(false);
  });

  it('cancels mousedown on the trigger and the surface, but not on a within element', () => {
    track(createPopup({ trigger: dom.trigger, surface: dom.surface, within: [dom.field] }));

    const press = (el: HTMLElement): boolean => {
      const event = new Event('mousedown', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(press(dom.trigger)).toBe(true);
    expect(press(dom.surface)).toBe(true);
    expect(press(dom.field)).toBe(false);
  });
});

describe('positioning', () => {
  it('opens downward when the surface fits below', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(false);
    expect(dom.surface.style.maxHeight).toBe('');
  });

  it('flips above when it does not fit below but fits above', () => {
    setViewportHeight(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(true);
    expect(dom.surface.style.maxHeight).toBe('');
  });

  it('takes the roomier side and caps to it when it fits neither', () => {
    setViewportHeight(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 500, height: 500 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(true);
    expect(dom.surface.style.maxHeight).toBe('292px'); // 300 above - two gaps
  });

  it('stays below when below is the roomier side', () => {
    setViewportHeight(400);
    stubRect(dom.trigger, { top: 60, bottom: 100, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 500, height: 500 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(false);
    expect(dom.surface.style.maxHeight).toBe('292px'); // 300 below - two gaps
  });

  it('leaves the surface uncapped when the cap would be uselessly short', () => {
    setViewportHeight(200);
    stubRect(dom.trigger, { top: 50, bottom: 100, height: 50 });
    stubRect(dom.surface, { top: 0, bottom: 500, height: 500 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(false);
    expect(dom.surface.style.maxHeight).toBe('');
  });

  it('measures against the anchor when one is given', () => {
    setViewportHeight(400);
    const host = document.querySelector<HTMLElement>('#host')!;
    // The anchor sits low even though the trigger, measured alone, has room.
    stubRect(host, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.trigger, { top: 0, bottom: 30, height: 30 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    const popup = track(createPopup({
      trigger: dom.trigger, surface: dom.surface, anchor: () => host,
    }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(true);
  });

  it('falls back to the trigger when the anchor resolves to nothing', () => {
    setViewportHeight(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    const popup = track(createPopup({
      trigger: dom.trigger, surface: dom.surface, anchor: () => null,
    }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(true);
  });
});

describe('reposition', () => {
  it('caps a surface that has outgrown its side, and clears the cap when it fits again', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });
    expect(dom.surface.style.maxHeight).toBe('');

    stubRect(dom.surface, { top: 134, bottom: 1034, height: 900 });
    popup.reposition();
    expect(dom.surface.style.maxHeight).toBe('630px'); // 768 - 130 anchor - two gaps

    stubRect(dom.surface, { top: 134, bottom: 234, height: 100 });
    popup.reposition();
    expect(dom.surface.style.maxHeight).toBe('');
  });

  it('does nothing while the popup is closed', () => {
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    stubRect(dom.surface, { top: 134, bottom: 1034, height: 900 });

    popup.reposition();

    expect(dom.surface.style.maxHeight).toBe('');
  });
});

describe('the visual viewport', () => {
  it('measures against it rather than the layout viewport', () => {
    setViewportHeight(768);
    // The keypad is up: only the visual viewport knows the surface has no room.
    useVisualViewport(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });

    expect(dom.surface.classList.contains('above')).toBe(true);
  });

  it('re-decides the side when it resizes while open', () => {
    const viewport = useVisualViewport(768);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    const popup = track(createPopup({ trigger: dom.trigger, surface: dom.surface }));
    popup.open({ invoker: dom.trigger, focusTarget: dom.surface });
    expect(dom.surface.classList.contains('above')).toBe(false);

    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));

    expect(dom.surface.classList.contains('above')).toBe(true);
  });

  it('ignores a resize while closed', () => {
    const viewport = useVisualViewport(400);
    stubRect(dom.trigger, { top: 300, bottom: 340, height: 40 });
    stubRect(dom.surface, { top: 0, bottom: 200, height: 200 });
    track(createPopup({ trigger: dom.trigger, surface: dom.surface }));

    viewport.dispatchEvent(new Event('resize'));

    expect(dom.surface.classList.contains('above')).toBe(false);
    expect(dom.surface.hidden).toBe(true);
  });
});

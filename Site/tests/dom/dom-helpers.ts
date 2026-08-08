/**
 * jsdom has no layout: every box measures zero, `matchMedia` is missing and
 * `scrollTop` never moves. These put back just enough for the units that read
 * geometry to be exercised for real rather than agreeing on zero.
 *
 * Not a `*.test.ts` file, so Vitest collects it as a module rather than a suite.
 */

export interface Box { top: number; bottom: number; height: number }

export const stubRect = (el: Element, box: Box): void => {
  el.getBoundingClientRect = (): DOMRect => ({
    x: 0, y: box.top, left: 0, right: 0, width: 0, toJSON: () => ({}), ...box,
  }) as DOMRect;
};

/** Make `scrollTop` a plain writable property so scrolling can be asserted. */
export const trackScroll = (el: Element): void => {
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true });
};

/** Install a `matchMedia` that answers every query the same way. */
export const setMediaMatches = (matches: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
  });
};

export const press = (el: Element, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

export const pointerDownOn = (el: Element): void => {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
};

export const focusOutOf = (el: Element, relatedTarget: EventTarget | null): void => {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
};

export const clickOn = (el: Element): MouseEvent => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

// Site/tests/dom/movement-view.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '../../src/i18n/strings';
import { createMovementView, splitLabel } from '../../src/watch/movement-view';
import { BEAT_MS, watchState } from '../../src/watch/movement-model';

let mount: HTMLElement; let lang: Lang;
beforeEach(() => { document.body.innerHTML = '<div id="m"></div>'; mount = document.getElementById('m')!; lang = 'en'; });
const part = (v: ReturnType<typeof createMovementView>, k: string) => v.root.querySelector(`[data-part="${k}"]`) as SVGGElement;
const angle = (g: Element) => Number(/rotate\((-?[\d.e-]+)/.exec(g.getAttribute('transform') ?? '')?.[1]);

describe('movement view', () => {
  it('builds the seven parts of a Swiss-lever train, each named', () => {
    const v = createMovementView(mount, () => lang);
    expect([...v.root.querySelectorAll('.mv-part')].map((g) => g.getAttribute('data-part')))
      .toEqual(['barrel', 'centre', 'third', 'fourth', 'escape', 'pallet', 'balance']);
    expect(part(v, 'balance').getAttribute('aria-label')).toBe('Balance · 4 Hz');
  });

  it('turns every part from the state, about its own staff', () => {
    const v = createMovementView(mount, () => lang);
    const s = watchState(3_725_000 + BEAT_MS * 3, false);
    v.render(s);
    expect(angle(part(v, 'centre'))).toBeCloseTo(s.centre);
    expect(angle(part(v, 'escape'))).toBeCloseTo(s.escape);
    expect(angle(part(v, 'balance'))).toBeCloseTo(s.balance);
    expect(part(v, 'centre').getAttribute('transform')).toMatch(/ 140 140\)$/);
  });

  it('breathes the hairspring with the balance', () => {
    const v = createMovementView(mount, () => lang);
    const spring = v.root.querySelector('.mv-spring')!;
    v.render(watchState(0, false));
    const rest = spring.getAttribute('d');
    v.render(watchState(BEAT_MS / 2, false));
    expect(spring.getAttribute('d')).not.toBe(rest);
  });

  it('sets no colours as attributes', () => {
    const v = createMovementView(mount, () => lang);
    for (const node of v.root.querySelectorAll('*')) for (const attr of ['fill', 'stroke']) {
      const val = node.getAttribute(attr);
      if (val !== null) expect(val).toMatch(/^(none|url\(#.+\)|var\(--w-[a-z0-9-]+\))$/);
    }
  });

  // Added (controller ruling): production CSP blocks style attributes.
  it('sets no style attributes', () => {
    const v = createMovementView(mount, () => lang);
    for (const node of [v.root, ...v.root.querySelectorAll('*')]) expect(node.hasAttribute('style')).toBe(false);
  });

  it('captions a part on tap and clears it after 4 s; re-labels in Persian', () => {
    vi.useFakeTimers();
    try {
      const v = createMovementView(mount, () => lang);
      part(v, 'escape').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(v.root.querySelector('.mv-caption')!.textContent).toBe('Escape wheel · 16 turns a minute');
      vi.advanceTimersByTime(4_000);
      expect(v.root.querySelector('.mv-caption')!.textContent).toBe('');
      lang = 'fa';
      v.rerender();
      expect(part(v, 'balance').getAttribute('aria-label')).toBe('چرخ تعادل · ۴ هرتز');
    } finally { vi.useRealTimers(); }
  });

  it('captions a part on keyboard focus too', () => {
    const v = createMovementView(mount, () => lang);
    part(v, 'barrel').dispatchEvent(new FocusEvent('focus'));
    expect(v.root.querySelector('.mv-caption')!.textContent).toBe('Barrel · 1 turn in 8 hours');
  });

  // Added for coverage of the caption's other paths.
  it('clears the caption on a tap elsewhere, but not on a tap on a part', () => {
    const v = createMovementView(mount, () => lang);
    const caption = v.root.querySelector('.mv-caption')!;
    part(v, 'third').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(caption.textContent).toBe('Third wheel · 8 turns an hour');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(caption.textContent).toBe('');
  });

  it('re-translates a showing caption and the labels on a language change', () => {
    const v = createMovementView(mount, () => lang);
    part(v, 'balance').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    lang = 'fa';
    v.rerender();
    expect(v.root.querySelector('.mv-caption')!.textContent).toBe('چرخ تعادل · ۴ هرتز');
    expect(v.root.querySelector('[data-label="balance"]')!.textContent).toContain('چرخ تعادل');
  });

  it('clears the caption on a click dispatched on the document itself', () => {
    const v = createMovementView(mount, () => lang);
    part(v, 'fourth').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('click'));
    expect(v.root.querySelector('.mv-caption')!.textContent).toBe('');
  });

  it('is named for assistive tech: a localized group name, parts as images, decorative text hidden', () => {
    const v = createMovementView(mount, () => lang);
    expect(v.root.getAttribute('aria-label')).toBe('Watch movement');
    for (const g of v.root.querySelectorAll('.mv-part')) expect(g.getAttribute('role')).toBe('img');
    expect(v.root.querySelector('.mv-labels')!.getAttribute('aria-hidden')).toBe('true');
    expect(v.root.querySelector('.mv-caption')!.getAttribute('aria-hidden')).toBe('true');
    lang = 'fa';
    v.rerender();
    expect(v.root.getAttribute('aria-label')).toBe('موتور ساعت');
  });

  it('destroy removes it', () => {
    createMovementView(mount, () => lang).destroy();
    expect(mount.children).toHaveLength(0);
  });

  it('destroy stops listening for taps elsewhere and cancels a pending clear', () => {
    vi.useFakeTimers();
    try {
      const v = createMovementView(mount, () => lang);
      part(v, 'pallet').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const remove = vi.spyOn(document, 'removeEventListener');
      v.destroy();
      expect(remove).toHaveBeenCalledWith('click', expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});

describe('splitLabel', () => {
  it('splits a part string into its name and speed lines', () => {
    expect(splitLabel('Balance · 4 Hz')).toEqual(['Balance', '4 Hz']);
  });
  it('keeps a string without the separator whole, with an empty speed line', () => {
    expect(splitLabel('Balance')).toEqual(['Balance', '']);
  });
});

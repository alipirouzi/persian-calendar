// Site/tests/dom/watch.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import { STRINGS, type Lang } from '../../src/i18n/strings';
import type { FaceId } from '../../src/watch/face';
import { createWatch, type Watch } from '../../src/watch/watch';
import { setMediaMatches, clickOn } from './dom-helpers';

const BODY = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
let frames: FrameRequestCallback[]; let now: Date; let face: FaceId; let lang: Lang; let watch: Watch | undefined;
let hidden = false;
const runFrame = () => { const f = frames; frames = []; for (const cb of f) cb(0); };
const fadeEnd = (target: Element, propertyName = 'opacity') =>
  target.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }));
const second = () => document.querySelector('#hand-second')!.getAttribute('transform');

beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  setMediaMatches(false);
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.body.innerHTML = BODY;
  now = new Date(2026, 9, 15, 10, 30, 0, 0); face = 'fullbleed'; lang = 'en';
});
afterEach(() => { watch?.destroy(); watch = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

const make = (onTick = vi.fn()) => {
  watch = createWatch(document.getElementById('clock-section')!, { now: () => now, onTick, getFace: () => face, getLang: () => lang });
  return onTick;
};

describe('watch driver', () => {
  it('draws the chosen face with an accessible time', () => {
    make();
    expect(document.querySelector('.clock.watch-face--fullbleed')).not.toBeNull();
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:30');
  });

  it('renders only when the beat changes while the dial shows', () => {
    const onTick = make();
    onTick.mockClear();
    runFrame(); runFrame();                       // same instant: nothing to draw
    expect(onTick).not.toHaveBeenCalled();
    now = new Date(now.getTime() + 125);
    runFrame();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('renders every frame while the movement shows', () => {
    const onTick = make();
    clickOn(document.getElementById('movement-toggle')!);
    onTick.mockClear();
    runFrame(); runFrame();
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('builds the movement on open and removes it on close, keeping focus on the toggle', () => {
    make();
    const toggle = document.getElementById('movement-toggle') as HTMLButtonElement;
    toggle.focus();
    clickOn(toggle);
    expect(document.querySelector('#movement-mount svg')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toBe('Show time');
    expect(document.getElementById('watch-digital')!.textContent).toBe('10:30');
    clickOn(toggle);
    // Fix round 1 mechanics: the close now waits for the movement SVG's own opacity transition.
    fadeEnd(document.querySelector('#movement-mount svg')!);
    expect(document.querySelector('#movement-mount svg')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('switching to Classic closes the movement and hides the toggle', () => {
    make();
    clickOn(document.getElementById('movement-toggle')!);
    face = 'classic';
    watch!.setFace('classic');
    expect(document.querySelector('.clock.watch-face--classic')).not.toBeNull();
    expect(document.querySelector('#movement-mount svg')).toBeNull();
    expect((document.getElementById('movement-toggle') as HTMLElement).hidden).toBe(true);
  });

  it('stops while hidden and draws the current time at once on return, movement included', () => {
    make();
    clickOn(document.getElementById('movement-toggle')!);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(frames).toHaveLength(0);
    now = new Date(2026, 9, 15, 14, 0, 0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('#hand-minute')!.getAttribute('transform')).toBe('rotate(0 100 100)');
    expect(document.getElementById('watch-digital')!.textContent).toBe('14:00');
  });

  it('steps once a second under reduced motion', () => {
    setMediaMatches(true);
    make();
    const before = second();
    now = new Date(now.getTime() + 1000);
    vi.advanceTimersByTime(1000);
    expect(second()).not.toBe(before);
    expect(frames).toHaveLength(0);
  });

  it('re-labels in Persian with Persian digits in the label, Latin on the dial', () => {
    make();
    lang = 'fa';
    watch!.rerender();
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('ساعت، ۱۰:۳۰');
    expect([...document.querySelectorAll('.wf-num')].map((t) => t.textContent)).toEqual(['12', '3', '6', '9']);
    expect(document.getElementById('movement-toggle')!.textContent).toBe('نمایش موتور');
  });

  // Added beyond the brief: covers the open-movement branch of rerender().
  it('re-labels an open movement on a language change', () => {
    make();
    clickOn(document.getElementById('movement-toggle')!);
    lang = 'fa';
    watch!.rerender();
    expect(document.querySelector('#movement-mount svg')!.getAttribute('aria-label')).toBe(STRINGS.fa.movementLabel);
    expect(document.getElementById('movement-toggle')!.textContent).toBe('نمایش ساعت');
  });

  it('ignores transitions other than the movement fading out', () => {
    make();
    const toggle = document.getElementById('movement-toggle')!;
    clickOn(toggle);
    clickOn(toggle);
    const svg = document.querySelector('#movement-mount svg')!;
    fadeEnd(svg.querySelector('[data-part="balance"]')!);       // a child's transition
    fadeEnd(document.querySelector('#clock-mount svg')!);       // the dial fading back
    fadeEnd(svg, 'transform');                                   // the movement's other property
    expect(document.querySelector('#movement-mount svg')).toBe(svg);
  });

  it('tears the movement down after the fade even if no transitionend arrives', () => {
    make();
    const toggle = document.getElementById('movement-toggle')!;
    clickOn(toggle);
    clickOn(toggle);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('#movement-mount svg')).not.toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('#movement-mount svg')).toBeNull();
    expect((document.getElementById('movement-mount') as HTMLElement).hidden).toBe(true);
  });

  it('reopening during the fade keeps the movement', () => {
    make();
    const toggle = document.getElementById('movement-toggle')!;
    clickOn(toggle);
    clickOn(toggle);
    const svg = document.querySelector('#movement-mount svg')!;
    clickOn(toggle);
    vi.advanceTimersByTime(2000);
    fadeEnd(svg);
    expect(document.querySelector('#movement-mount svg')).toBe(svg);
  });

  it('keeps drawing every frame while the movement fades out', () => {
    const onTick = make();
    const toggle = document.getElementById('movement-toggle')!;
    clickOn(toggle);
    clickOn(toggle);
    onTick.mockClear();
    runFrame(); runFrame();
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('a reduced-motion change while hidden does not restart the loop', () => {
    let onChange: (() => void) | undefined;
    let reduce = false;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        get matches() { return reduce; },
        addEventListener: (_: string, cb: () => void) => { onChange = cb; },
        removeEventListener: () => {},
      }),
    });
    const onTick = make();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    onTick.mockClear();
    reduce = true; onChange!();
    vi.advanceTimersByTime(3000);
    expect(onTick).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(2);
    reduce = false; onChange!();                                  // visible: switches straight back to rAF
    expect(frames).toHaveLength(1);
  });

  it('setFace with the same face changes nothing', () => {
    make();
    const root = document.querySelector('.clock');
    watch!.setFace('fullbleed');
    expect(document.querySelector('.clock')).toBe(root);
  });
});

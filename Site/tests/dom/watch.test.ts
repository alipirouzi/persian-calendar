// Site/tests/dom/watch.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PAGE from '../../index.html?raw';
import type { Lang } from '../../src/i18n/strings';
import type { FaceId } from '../../src/watch/face';
import { createWatch, type Watch } from '../../src/watch/watch';
import { setMediaMatches } from './dom-helpers';

const BODY = PAGE.slice(PAGE.indexOf('<body>') + 6, PAGE.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
let frames: FrameRequestCallback[]; let now: Date; let face: FaceId; let lang: Lang; let watch: Watch | undefined;
let hidden = false;
const runFrame = () => { const f = frames; frames = []; for (const cb of f) cb(0); };
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
  now = new Date(2026, 9, 15, 10, 30, 0, 0); face = 'analog'; lang = 'en';
});
afterEach(() => { watch?.destroy(); watch = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

const make = (onTick = vi.fn()) => {
  watch = createWatch(document.getElementById('clock-section')!, {
    now: () => now, onTick, getFace: () => face, getLang: () => lang,
  });
  return onTick;
};

describe('watch driver', () => {
  it('draws the chosen face with an accessible time', () => {
    make();
    expect(document.querySelector('.clock.watch-face--analog')).not.toBeNull();
    expect(document.querySelector('.clock')!.getAttribute('role')).toBe('img');
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:30');
    expect(document.getElementById('watch-box')!.dataset.face).toBe('analog');
  });

  it('renders only when the beat changes', () => {
    const onTick = make();
    onTick.mockClear();
    runFrame(); runFrame();
    expect(onTick).not.toHaveBeenCalled();
    now = new Date(now.getTime() + 125);
    runFrame();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('swaps faces, names the new one and draws it at once', () => {
    make();
    face = 'digital';
    watch!.setFace('digital');
    expect(document.querySelector('.watch-face--analog')).toBeNull();
    const digital = document.querySelector('.clock.watch-face--digital')!;
    expect(digital.getAttribute('aria-label')).toBe('Watch, 10:30');
    expect(digital.querySelector('.wd-hm')!.textContent).toBe('10:30');
    expect(document.getElementById('watch-box')!.dataset.face).toBe('digital');
    watch!.setFace('digital');                       // same face: no rebuild
    expect(document.querySelector('.watch-face--digital')).toBe(digital);
  });

  it('switching face while hidden shows the current time on return', () => {
    make();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    watch!.setFace('digital');
    now = new Date(2026, 9, 15, 10, 31, 5);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('.wd-hm')!.textContent).toBe('10:31');
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:31');
  });

  it('relabels once a minute and on a language change', () => {
    make();
    const label = () => document.querySelector('.clock')!.getAttribute('aria-label');
    now = new Date(2026, 9, 15, 10, 30, 30); runFrame();
    expect(label()).toBe('Watch, 10:30');
    now = new Date(2026, 9, 15, 10, 31, 0); runFrame();
    expect(label()).toBe('Watch, 10:31');
    lang = 'fa'; watch!.rerender();
    expect(label()).toBe('ساعت، ۱۰:۳۱');
  });

  it('stops while hidden and draws the current time at once on return', () => {
    make();
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(frames).toHaveLength(0);
    now = new Date(2026, 9, 15, 14, 0, 0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('#hand-minute')!.getAttribute('transform')).toBe('rotate(0 100 100)');
    expect(frames).toHaveLength(1);
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

  it('runs without an onTick callback', () => {
    watch = createWatch(document.getElementById('clock-section')!, {
      now: () => now, getFace: () => face, getLang: () => lang,
    });
    now = new Date(now.getTime() + 125); runFrame();
    expect(document.querySelector('.clock')!.getAttribute('aria-label')).toBe('Watch, 10:30');
  });

  it('destroy removes the listeners and the face', () => {
    const removeDoc = vi.spyOn(document, 'removeEventListener');
    let removedMotion = false;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => { removedMotion = true; },
      }),
    });
    const onTick = make();
    watch!.destroy(); watch = undefined;
    expect(document.querySelector('.clock')).toBeNull();
    expect(frames).toHaveLength(0);
    expect(removeDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removedMotion).toBe(true);
    onTick.mockClear();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(onTick).not.toHaveBeenCalled();
  });
});

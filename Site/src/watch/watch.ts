import { formatTemplate, STRINGS, type Lang } from '../i18n/strings';
import { createAnalog } from './analog';
import { createDigital } from './digital';
import type { Face, FaceId } from './face';
import { BEAT_MS, handState, hhmm, msSinceLocalMidnight } from './hands';

export interface WatchOptions {
  readonly now: () => Date;
  /** Called with the drawn time on every rendered frame (main.ts's minute gate). */
  readonly onTick?: (date: Date) => void;
  readonly getFace: () => FaceId;
  readonly getLang: () => Lang;
}

export interface Watch {
  setFace(face: FaceId): void;
  /** Language change: the watch label. */
  rerender(): void;
  destroy(): void;
}

const FACES: Readonly<Record<FaceId, (mount: HTMLElement) => Face>> = {
  analog: createAnalog,
  digital: createDigital,
};
const MS_PER_MINUTE = 60_000;
const minuteOf = (ms: number): number => Math.floor(ms / MS_PER_MINUTE);

/**
 * Drives the watch face. Frames are rAF-paced but drawn only when the beat changes (8 a
 * second): the seconds hand ticks and the digits change no faster. Reduced motion draws once a
 * second. A hidden page draws nothing and catches up at once on return.
 */
export function createWatch(section: HTMLElement, { now, onTick, getFace, getLang }: WatchOptions): Watch {
  const box = section.querySelector<HTMLElement>('#watch-box')!;
  const mount = section.querySelector<HTMLElement>('#clock-mount')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let faceId = getFace();
  let face = FACES[faceId](mount);
  let labelMinute = Number.NaN;
  let lastBeat = Number.NaN;
  let rafId = 0;
  let intervalId = 0;

  /** The label only changes with the minute or the language; rerender resets `labelMinute`. */
  const relabel = (date: Date, minute: number): void => {
    if (minute === labelMinute) return;
    labelMinute = minute;
    const lang = getLang();
    face.root.setAttribute('aria-label', formatTemplate(STRINGS[lang].watchLabel, { time: hhmm(date) }, lang));
  };

  const resetLabel = (): void => {
    labelMinute = Number.NaN;
    const date = now();
    relabel(date, minuteOf(msSinceLocalMidnight(date)));
  };

  const nameFace = (): void => {
    box.dataset.face = faceId;
    face.root.setAttribute('role', 'img');
    resetLabel();
  };

  const render = (): void => {
    const date = now();
    const ms = msSinceLocalMidnight(date);
    face.render(handState(ms, reduced.matches), date);
    relabel(date, minuteOf(ms));
    lastBeat = Math.floor(ms / BEAT_MS);
    onTick?.(date);
  };

  // rAF only runs without reduced motion; frames inside a beat have nothing new to draw.
  const frame = (): void => {
    rafId = requestAnimationFrame(frame);
    if (Math.floor(msSinceLocalMidnight(now()) / BEAT_MS) === lastBeat) return;
    render();
  };

  const stop = (): void => {
    cancelAnimationFrame(rafId);
    window.clearInterval(intervalId);
    rafId = 0;
    intervalId = 0;
  };

  const start = (): void => {
    stop();
    render();
    if (reduced.matches) intervalId = window.setInterval(render, 1000);
    else rafId = requestAnimationFrame(frame);
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  /** A hidden page stays stopped; the visible handler picks the right loop on return. */
  const onMotionChange = (): void => {
    if (!document.hidden) start();
  };

  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotionChange);
  nameFace();
  start();

  return {
    setFace(next: FaceId): void {
      if (next === faceId) return;
      face.destroy();
      faceId = next;
      face = FACES[faceId](mount);
      nameFace();
      render();
    },
    rerender: resetLabel,
    destroy(): void {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
      face.destroy();
    },
  };
}

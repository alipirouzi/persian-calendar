import { formatTemplate, STRINGS, type Lang } from '../i18n/strings';
import { createClassic } from './classic';
import type { Face, FaceId } from './face';
import { createFullBleed } from './full-bleed';
import { BEAT_MS, hhmm, msSinceLocalMidnight, watchState } from './movement-model';
import { createMovementView, type MovementView } from './movement-view';

export interface WatchOptions {
  readonly now: () => Date;
  /** Called with the drawn time on every rendered frame (main.ts's minute gate). */
  readonly onTick?: (date: Date) => void;
  readonly getFace: () => FaceId;
  readonly getLang: () => Lang;
}

export interface Watch {
  setFace(face: FaceId): void;
  setMovementOpen(open: boolean): void;
  /** Language change: the watch label, the toggle text and the movement labels. */
  rerender(): void;
  destroy(): void;
}

const FACES: Readonly<Record<FaceId, (mount: HTMLElement) => Face>> = {
  fullbleed: createFullBleed,
  classic: createClassic,
};
/** Only Full bleed has a movement behind it; Classic is the plain clock. */
const HAS_MOVEMENT: Readonly<Record<FaceId, boolean>> = { fullbleed: true, classic: false };
/** The CSS fade is 0.9 s; if its transitionend never arrives, tear down a little after. */
const CLOSE_FALLBACK_MS = 1_100;
const MS_PER_MINUTE = 60_000;
const minuteOf = (ms: number): number => Math.floor(ms / MS_PER_MINUTE);

/**
 * Drives the watch: one face, the optional movement behind it, and the Show movement toggle.
 * Frames are rAF-paced. A ticking face (Full bleed) alone is only drawn when the escapement
 * beats (8 a second); a sweeping face (Classic) and the swinging movement are drawn every frame.
 * Reduced motion draws once a second. A hidden page draws nothing and catches up at once on return.
 */
export function createWatch(section: HTMLElement, { now, onTick, getFace, getLang }: WatchOptions): Watch {
  const box = section.querySelector<HTMLElement>('#watch-box')!;
  const clockMount = section.querySelector<HTMLElement>('#clock-mount')!;
  const movementMount = section.querySelector<HTMLElement>('#movement-mount')!;
  const digital = section.querySelector<HTMLElement>('#watch-digital')!;
  const toggle = section.querySelector<HTMLButtonElement>('#movement-toggle')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let faceId = getFace();
  let face = FACES[faceId](clockMount);
  let movement: MovementView | null = null;
  let open = false;
  let labelMinute = Number.NaN;
  let lastBeat = Number.NaN;
  let rafId = 0;
  let intervalId = 0;
  let closeTimer = 0;

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
    face.root.setAttribute('role', 'img');
    resetLabel();
  };

  const render = (): void => {
    const date = now();
    const ms = msSinceLocalMidnight(date);
    const state = watchState(ms, reduced.matches);
    face.render(state);
    if (movement) {
      movement.render(state);
      const digits = hhmm(date);
      if (digital.textContent !== digits) digital.textContent = digits;
    }
    relabel(date, minuteOf(ms));
    lastBeat = Math.floor(ms / BEAT_MS);
    onTick?.(date);
  };

  // While the movement is mounted (open, or still fading out) it swings, so draw every frame;
  // so does a sweeping face. A ticking face alone only changes on a beat. rAF only runs
  // without reduced motion.
  const frame = (): void => {
    rafId = requestAnimationFrame(frame);
    if (!movement && !face.continuous && Math.floor(msSinceLocalMidnight(now()) / BEAT_MS) === lastBeat) return;
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

  const cancelClose = (): void => {
    box.removeEventListener('transitionend', onCloseEnd);
    window.clearTimeout(closeTimer);
  };

  const teardownMovement = (): void => {
    cancelClose();
    movement?.destroy();
    movement = null;
    movementMount.hidden = true;
    digital.textContent = '';
  };

  /** Only the movement's own fade-out ends the close; the dial's and children's transitions don't. */
  function onCloseEnd(event: Event): void {
    if ((event as TransitionEvent).propertyName === 'opacity' && event.target === movementMount.firstElementChild) teardownMovement();
  }

  const syncToggle = (): void => {
    const strings = STRINGS[getLang()];
    toggle.setAttribute('aria-pressed', String(open));
    toggle.textContent = open ? strings.showTime : strings.showMovement;
    toggle.hidden = !HAS_MOVEMENT[faceId];
  };

  /** `immediate` skips the fade: a face switch or reduced motion tears down at once. */
  const setOpen = (next: boolean, immediate: boolean): void => {
    open = next;
    if (open) {
      cancelClose();
      movement ??= createMovementView(movementMount, getLang);
      movementMount.hidden = false;
      // Commit the hidden start state first, so adding the class runs the fade-in.
      void movementMount.getBoundingClientRect();
      box.classList.add('is-movement');
      render();
    } else {
      box.classList.remove('is-movement');
      if (reduced.matches || immediate) teardownMovement();
      else {
        box.addEventListener('transitionend', onCloseEnd);
        closeTimer = window.setTimeout(teardownMovement, CLOSE_FALLBACK_MS);
      }
    }
    syncToggle();
  };

  /** A face without a movement (Classic) has nothing to open. */
  const setMovementOpen = (next: boolean): void => {
    if (next && !HAS_MOVEMENT[faceId]) return;
    setOpen(next, false);
  };

  const onToggle = (): void => {
    setMovementOpen(!open);
    toggle.focus();
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  /** A hidden page stays stopped; the visible handler picks the right loop on return. */
  const onMotionChange = (): void => {
    if (!document.hidden) start();
  };

  toggle.addEventListener('click', onToggle);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotionChange);
  nameFace();
  syncToggle();
  start();

  return {
    setFace(next: FaceId): void {
      if (next === faceId) return;
      setOpen(false, true);
      face.destroy();
      faceId = next;
      face = FACES[faceId](clockMount);
      nameFace();
      syncToggle();
      render();
    },
    setMovementOpen,
    rerender(): void {
      resetLabel();
      syncToggle();
      movement?.rerender();
    },
    destroy(): void {
      stop();
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
      teardownMovement();
      face.destroy();
    },
  };
}

import { formatTemplate, STRINGS, type Lang } from '../i18n/strings';
import { createClassic } from './classic';
import type { Face, FaceId } from './face';
import { createFullBleed } from './full-bleed';
import { hhmm, msSinceLocalMidnight, watchState } from './movement-model';
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

/**
 * Drives the watch: one face, the optional movement behind it, and the Show movement toggle.
 * Frames are rAF-paced but only drawn when the escapement beats (8 a second) while the dial
 * shows; the movement swings continuously, so it is drawn every frame. Reduced motion draws
 * once a second. A hidden page draws nothing and catches up at once on return.
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
  let label = '';
  let lastBeat = Number.NaN;
  let rafId = 0;
  let intervalId = 0;

  const relabel = (date: Date): void => {
    const lang = getLang();
    const next = formatTemplate(STRINGS[lang].watchLabel, { time: hhmm(date) }, lang);
    if (next === label) return;
    label = next;
    face.root.setAttribute('aria-label', label);
  };

  const nameFace = (): void => {
    face.root.setAttribute('role', 'img');
    label = '';
    relabel(now());
  };

  const render = (): void => {
    const date = now();
    const state = watchState(msSinceLocalMidnight(date), reduced.matches);
    face.render(state);
    if (movement) {
      movement.render(state);
      digital.textContent = hhmm(date);
    }
    relabel(date);
    lastBeat = state.beat;
    onTick?.(date);
  };

  const frame = (): void => {
    rafId = requestAnimationFrame(frame);
    const state = watchState(msSinceLocalMidnight(now()), false);
    if (!open && state.beat === lastBeat) return;
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

  const teardownMovement = (): void => {
    box.removeEventListener('transitionend', teardownMovement);
    movement?.destroy();
    movement = null;
    movementMount.hidden = true;
    digital.hidden = true;
  };

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
      box.removeEventListener('transitionend', teardownMovement);
      movement ??= createMovementView(movementMount, getLang);
      movementMount.hidden = false;
      digital.hidden = false;
      // Commit the hidden start state first, so adding the class runs the fade-in.
      void movementMount.getBoundingClientRect();
      box.classList.add('is-movement');
      render();
    } else {
      box.classList.remove('is-movement');
      if (reduced.matches || immediate) teardownMovement();
      else box.addEventListener('transitionend', teardownMovement, { once: true });
    }
    syncToggle();
  };

  const setMovementOpen = (next: boolean): void => { setOpen(next, false); };

  const onToggle = (): void => {
    setMovementOpen(!open);
    toggle.focus();
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  toggle.addEventListener('click', onToggle);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', start);
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
      label = '';
      relabel(now());
      syncToggle();
      movement?.rerender();
    },
    destroy(): void {
      stop();
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', start);
      teardownMovement();
      face.destroy();
    },
  };
}

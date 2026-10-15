import { handAngles, msSinceLocalMidnight } from '../watch/movement-model';

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i / 60) * 360;
  const isHour = i % 5 === 0;
  const r1 = isHour ? 88 : 92;
  return `<line x1="100" y1="${100 - r1}" x2="100" y2="${100 - 96}"
    transform="rotate(${angle} 100 100)"
    stroke="currentColor" stroke-width="${isHour ? 1.6 : 0.6}"
    opacity="${isHour ? 0.9 : 0.35}" />`;
}).join('');

const CLOCK_SVG = `
<svg viewBox="0 0 200 200" width="260" height="260" role="img" aria-label="Analog clock" class="clock">
  <circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25" />
  ${TICKS}
  <g id="hand-hour"><line x1="100" y1="100" x2="100" y2="52"
    stroke="currentColor" stroke-width="4" stroke-linecap="round" /></g>
  <g id="hand-minute"><line x1="100" y1="100" x2="100" y2="30"
    stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></g>
  <g id="hand-second"><line x1="100" y1="112" x2="100" y2="22"
    class="second-hand" stroke-width="1" stroke-linecap="round" /></g>
  <circle cx="100" cy="100" r="3" fill="currentColor" />
</svg>`;

export interface ClockOptions {
  /** The time to draw; defaults to the device clock. */
  readonly now?: () => Date;
  /** Called with the drawn time on every frame (every second under reduced motion). */
  readonly onTick?: (date: Date) => void;
}

export function createClock(mount: HTMLElement, { now = () => new Date(), onTick }: ClockOptions = {}): () => void {
  mount.innerHTML = CLOCK_SVG;
  const hour = mount.querySelector<SVGGElement>('#hand-hour');
  const minute = mount.querySelector<SVGGElement>('#hand-minute');
  const second = mount.querySelector<SVGGElement>('#hand-second');
  if (!hour || !minute || !second) throw new Error('Clock SVG hands missing');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = 0;
  let intervalId = 0;

  const render = (): void => {
    const date = now();
    const a = handAngles(msSinceLocalMidnight(date));
    hour.setAttribute('transform', `rotate(${a.hour} 100 100)`);
    minute.setAttribute('transform', `rotate(${a.minute} 100 100)`);
    second.setAttribute('transform', `rotate(${a.second} 100 100)`);
    onTick?.(date);
  };

  const loop = (): void => {
    render();
    rafId = requestAnimationFrame(loop);
  };

  const stop = (): void => {
    cancelAnimationFrame(rafId);
    window.clearInterval(intervalId);
    rafId = 0;
    intervalId = 0;
  };

  const start = (): void => {
    stop();
    if (reduced.matches) {
      render();
      intervalId = window.setInterval(render, 1000);
    } else {
      loop();
    }
  };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', start);
  start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', start);
  };
}

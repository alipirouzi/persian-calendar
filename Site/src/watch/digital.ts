import type { Face } from './face';
import { hhmm, pad2 } from './hands';

/**
 * The digital face: 24-hour HH:MM in Bodoni Moda with small blued seconds. The visible digits
 * are aria-hidden; the driver names the face. Text is written only when it changes.
 */
export function createDigital(mount: HTMLElement): Face {
  const root = document.createElement('div');
  root.className = 'clock watch-face--digital';
  const hm = document.createElement('span');
  hm.className = 'wd-hm';
  const ss = document.createElement('span');
  ss.className = 'wd-ss';
  for (const s of [hm, ss]) { s.setAttribute('aria-hidden', 'true'); root.appendChild(s); }
  mount.appendChild(root);

  let shownHm = '';
  let shownSs = '';
  return {
    root,
    render(_state, date: Date): void {
      const nextHm = hhmm(date);
      if (nextHm !== shownHm) { shownHm = nextHm; hm.textContent = nextHm; }
      const nextSs = pad2(date.getSeconds());
      if (nextSs !== shownSs) { shownSs = nextSs; ss.textContent = nextSs; }
    },
    destroy(): void { root.remove(); },
  };
}

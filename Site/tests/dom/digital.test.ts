import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDigital } from '../../src/watch/digital';
import type { Face } from '../../src/watch/face';
import { handState, msSinceLocalMidnight } from '../../src/watch/hands';

let mount: HTMLElement; let face: Face;
const draw = (date: Date) => face.render(handState(msSinceLocalMidnight(date), false), date);
beforeEach(() => { mount = document.createElement('div'); document.body.appendChild(mount); face = createDigital(mount); });
afterEach(() => { face.destroy(); mount.remove(); });

describe('digital face', () => {
  it('shows 24-hour HH:MM and small seconds, in Latin digits, hidden from the a11y tree', () => {
    draw(new Date(2026, 9, 15, 22, 9, 36));
    const root = mount.querySelector('.clock.watch-face--digital')!;
    expect(root.querySelector('.wd-hm')!.textContent).toBe('22:09');
    expect(root.querySelector('.wd-ss')!.textContent).toBe('36');
    for (const s of root.querySelectorAll('span')) expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(mount.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('writes text only when it changes', () => {
    const hm = mount.querySelector('.wd-hm')!; const ss = mount.querySelector('.wd-ss')!;
    draw(new Date(2026, 9, 15, 10, 9, 36, 0));
    const hmNode = hm.firstChild; const ssNode = ss.firstChild;
    draw(new Date(2026, 9, 15, 10, 9, 36, 500));     // same second: nothing rewritten
    expect(hm.firstChild).toBe(hmNode);
    expect(ss.firstChild).toBe(ssNode);
    draw(new Date(2026, 9, 15, 10, 9, 37, 0));       // new second, same minute
    expect(hm.firstChild).toBe(hmNode);
    expect(ss.textContent).toBe('37');
  });

  it('removes itself on destroy', () => {
    face.destroy();
    expect(mount.querySelector('.watch-face--digital')).toBeNull();
    face = createDigital(mount);
  });
});

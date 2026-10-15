import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAnalog } from '../../src/watch/analog';
import type { DialFace } from '../../src/watch/face';
import { handState, msSinceLocalMidnight } from '../../src/watch/hands';

let mount: HTMLElement; let face: DialFace;
beforeEach(() => { mount = document.createElement('div'); document.body.appendChild(mount); face = createAnalog(mount); });
afterEach(() => { face.destroy(); mount.remove(); });

/** The radius a hand reaches: the highest point (smallest y) of its paths, pointing at 12. */
const tipRadius = (id: string): number => {
  const ys = [...document.querySelectorAll(`#${id} path`)]
    .flatMap((p) => (p.getAttribute('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1));
  return 100 - Math.min(...ys);
};

describe('analog face', () => {
  it('builds a railway track, twelve upright Latin numerals and three hands', () => {
    const svg = mount.querySelector('svg.clock.watch-face--analog')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(svg.querySelectorAll('.wa-ring')).toHaveLength(2);
    expect(svg.querySelectorAll('.wa-tick')).toHaveLength(48);
    expect(svg.querySelectorAll('.wa-tick--five')).toHaveLength(12);
    expect([...svg.querySelectorAll('.wa-num')].map((n) => n.textContent))
      .toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    for (const n of svg.querySelectorAll('.wa-num')) expect(n.hasAttribute('transform')).toBe(false);
    for (const id of ['hand-hour', 'hand-minute', 'hand-second']) expect(svg.querySelector(`#${id}`)).not.toBeNull();
  });

  it('lets every hand reach its scale', () => {
    expect(tipRadius('hand-hour')).toBeCloseTo(68, 1);    // just inside the numerals (~r 72.5)
    expect(tipRadius('hand-minute')).toBeCloseTo(94, 1);  // into the railway track (91.5–96)
    expect(tipRadius('hand-second')).toBeCloseTo(95, 1);  // onto the outer track
  });

  it('rotates the hands for 10:09:36', () => {
    const date = new Date(2026, 9, 15, 10, 9, 36);
    face.render(handState(msSinceLocalMidnight(date), false), date);
    const deg = (id: string) => Number(/rotate\(([-\d.]+) 100 100\)/.exec(mount.querySelector(`#${id}`)!.getAttribute('transform')!)![1]);
    expect(deg('hand-hour')).toBeCloseTo(304.8, 3);
    expect(deg('hand-minute')).toBeCloseTo(57.6, 3);
    expect(deg('hand-second')).toBeCloseTo(216, 3);
  });

  it('colours through classes only, with gradients unique per instance', () => {
    expect(mount.querySelectorAll('[style]')).toHaveLength(0);
    for (const s of mount.querySelectorAll('stop')) expect(s.getAttribute('class')).toMatch(/^wa-(dial|blue)-\d$/);
    const other = document.createElement('div'); const second = createAnalog(other);
    const ids = [...mount.querySelectorAll('linearGradient, radialGradient')].map((g) => g.id);
    const otherIds = [...other.querySelectorAll('linearGradient, radialGradient')].map((g) => g.id);
    expect(ids.some((id) => otherIds.includes(id))).toBe(false);
    second.destroy();
  });

  it('removes itself on destroy', () => {
    face.destroy();
    expect(mount.querySelector('svg')).toBeNull();
    face = createAnalog(mount);
  });
});

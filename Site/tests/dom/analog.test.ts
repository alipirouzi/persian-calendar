import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAnalog } from '../../src/watch/analog';
import type { Face } from '../../src/watch/face';
import { handState, msSinceLocalMidnight } from '../../src/watch/hands';

let mount: HTMLElement; let face: Face;
beforeEach(() => { mount = document.createElement('div'); document.body.appendChild(mount); face = createAnalog(mount); });
afterEach(() => { face.destroy(); mount.remove(); });

/** The radius a hand reaches: the highest point (smallest y) of its paths, pointing at 12. */
const tipRadius = (id: string): number => {
  const ys = [...document.querySelectorAll(`#${id} path`)]
    .flatMap((p) => (p.getAttribute('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1));
  return 100 - Math.min(...ys);
};

describe('analog face', () => {
  it('builds a railway track, four upright Latin numerals, eight batons and three hands', () => {
    const svg = mount.querySelector('svg.clock.watch-face--analog')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(svg.querySelectorAll('.wa-ring')).toHaveLength(2);
    expect(svg.querySelectorAll('.wa-tick')).toHaveLength(48);
    expect(svg.querySelectorAll('.wa-tick--five')).toHaveLength(12);
    expect([...svg.querySelectorAll('.wa-num')].map((n) => n.textContent))
      .toEqual(['12', '3', '6', '9']);
    for (const n of svg.querySelectorAll('.wa-num')) expect(n.hasAttribute('transform')).toBe(false);
    expect(svg.querySelectorAll('.wa-idx')).toHaveLength(8);
    for (const id of ['hand-hour', 'hand-minute', 'hand-second']) expect(svg.querySelector(`#${id}`)).not.toBeNull();
  });

  it('lets every hand reach its scale', () => {
    expect(tipRadius('hand-hour')).toBeCloseTo(70, 1);     // meets the batons (r 71)
    expect(tipRadius('hand-minute')).toBeCloseTo(91, 1);   // meets the track's inner ring (r 91.5)
    expect(tipRadius('hand-second')).toBeCloseTo(93.5, 1); // inside the minute marks (91.5–96)
  });

  it('rotates the hands for 10:09:36', () => {
    const date = new Date(2026, 9, 15, 10, 9, 36);
    face.render(handState(msSinceLocalMidnight(date), false), date);
    const deg = (id: string) => Number(/rotate\(([-\d.]+) 100 100\)/.exec(mount.querySelector(`#${id}`)!.getAttribute('transform')!)![1]);
    expect(deg('hand-hour')).toBeCloseTo(304.8, 3);
    expect(deg('hand-minute')).toBeCloseTo(57.6, 3);
    expect(deg('hand-second')).toBeCloseTo(216, 3);
  });

  it('colours through classes only, with gradient and filter ids unique per instance', () => {
    expect(mount.querySelectorAll('[style]')).toHaveLength(0);
    for (const s of mount.querySelectorAll('stop')) expect(s.getAttribute('class')).toMatch(/^wa-(dial|lit|shade|sec|cap|rim)-\d$/);
    const other = document.createElement('div'); const second = createAnalog(other);
    const defIds = (root: Element) => [...root.querySelectorAll('linearGradient, radialGradient, filter')].map((g) => g.id);
    const ids = defIds(mount); const otherIds = defIds(other);
    expect(ids).toHaveLength(7);
    expect(ids.some((id) => otherIds.includes(id))).toBe(false);
    second.destroy();
  });

  it('casts the hands\' shadow from one filtered group', () => {
    const group = mount.querySelector('#hand-hour')!.parentElement!;
    expect(group.getAttribute('filter')).toMatch(/^url\(#wa-shadow-g\d+\)$/);
    for (const id of ['hand-minute', 'hand-second']) expect(mount.querySelector(`#${id}`)!.parentElement).toBe(group);
    expect(mount.querySelector(group.getAttribute('filter')!.slice(4, -1))!.tagName).toBe('filter');
  });

  it('removes itself on destroy', () => {
    face.destroy();
    expect(mount.querySelector('svg')).toBeNull();
    face = createAnalog(mount);
  });
});

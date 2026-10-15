// Site/tests/watch-geometry.test.ts
import { describe, expect, it } from 'vitest';
import {
  escapeWheelPath, gearPath, meshDistance, pitchRadius, polar, spiralPath,
} from '../src/watch/geometry';

const points = (d: string): [number, number][] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const dist = ([x, y]: [number, number], c = { x: 50, y: 50 }) => Math.hypot(x - c.x, y - c.y);

describe('pitch radius and meshing', () => {
  it('is module × teeth / 2', () => {
    expect(pitchRadius(1.2, 80)).toBeCloseTo(48);
  });
  it('meshes a wheel and a pinion at the sum of their pitch radii', () => {
    expect(meshDistance(1.2, 80, 12)).toBeCloseTo(48 + 7.2);
  });
});

describe('polar', () => {
  it('measures 0° straight up and turns clockwise', () => {
    const c = { x: 100, y: 100 };
    const up = polar(c, 10, 0), right = polar(c, 10, 90), down = polar(c, 10, 180);
    expect(up.x).toBeCloseTo(100); expect(up.y).toBeCloseTo(90);
    expect(right.x).toBeCloseTo(110); expect(right.y).toBeCloseTo(100);
    expect(down.y).toBeCloseTo(110);
  });
});

describe('gearPath', () => {
  it('is a closed path with every point between the root and tip circles', () => {
    const d = gearPath({ x: 50, y: 50 }, 1, 20);       // pitch r 10, tip 11, root 8.75
    expect(d.startsWith('M')).toBe(true);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
    for (const p of points(d)) {
      expect(dist(p)).toBeGreaterThanOrEqual(8.75 - 1e-2);
      expect(dist(p)).toBeLessThanOrEqual(11 + 1e-2);
    }
  });
  it('has one tooth tip per tooth', () => {
    const tips = points(gearPath({ x: 50, y: 50 }, 1, 20)).filter((p) => Math.abs(dist(p) - 11) < 1e-2);
    expect(tips.length).toBe(20 * 2);                    // each flat tooth tip has two corner points
  });
});

describe('escapeWheelPath', () => {
  it('has 15 club teeth by default, all within the radius', () => {
    const pts = points(escapeWheelPath({ x: 50, y: 50 }, 13));
    expect(pts.filter((p) => Math.abs(dist(p) - 13) < 1e-2)).toHaveLength(15);
    for (const p of pts) expect(dist(p)).toBeLessThanOrEqual(13 + 1e-2);
  });
});

describe('spiralPath', () => {
  it('runs from the inner to the outer radius', () => {
    const pts = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20));
    expect(dist(pts[0]!)).toBeCloseTo(2);
    expect(dist(pts.at(-1)!)).toBeCloseTo(20);
    expect(pts.length).toBe(161);                        // default 160 steps + start
  });
  it('rotates with its phase', () => {
    const a = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20, 0, 10))[0]!;
    const b = points(spiralPath({ x: 50, y: 50 }, 5, 2, 20, Math.PI / 2, 10))[0]!;
    expect(a).not.toEqual(b);
  });
});

// Site/src/watch/geometry.ts
export interface Point { readonly x: number; readonly y: number }

const TAU = Math.PI * 2;
const fmt = (n: number): string => n.toFixed(2);
const at = (c: Point, angle: number, r: number): string =>
  `${fmt(c.x + Math.sin(angle) * r)} ${fmt(c.y - Math.cos(angle) * r)}`;

export const pitchRadius = (module: number, teeth: number): number => (module * teeth) / 2;

/** 0° points to 12 o'clock and angles grow clockwise, as on a dial. */
export const polar = (from: Point, distance: number, degrees: number): Point => {
  const a = (degrees * Math.PI) / 180;
  return { x: from.x + Math.sin(a) * distance, y: from.y - Math.cos(a) * distance };
};

/** Two gears mesh when their pitch circles touch. */
export const meshDistance = (module: number, wheelTeeth: number, pinionTeeth: number): number =>
  pitchRadius(module, wheelTeeth) + pitchRadius(module, pinionTeeth);

/**
 * A spur gear: addendum = module, dedendum = 1.25 × module (the standard proportions),
 * flanks drawn as straight lines with a flat tip — close enough to an involute at this size.
 */
export function gearPath(centre: Point, module: number, teeth: number): string {
  const r = pitchRadius(module, teeth);
  const tip = r + module;
  const root = r - 1.25 * module;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (k: number): number => ((i + k) / teeth) * TAU;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${at(centre, a(0), root)}`,
      `L${at(centre, a(0.15), root)}`,
      `L${at(centre, a(0.3), tip)}`,
      `L${at(centre, a(0.5), tip)}`,
      `L${at(centre, a(0.65), root)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** A Swiss-lever escape wheel: slanted club teeth, the tip being the radius. */
export function escapeWheelPath(centre: Point, radius: number, teeth = 15): string {
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (k: number): number => ((i + k) / teeth) * TAU;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${at(centre, a(0), radius * 0.72)}`,
      `L${at(centre, a(0.55), radius)}`,
      `L${at(centre, a(0.7), radius * 0.97)}`,
      `L${at(centre, a(0.62), radius * 0.82)}`,
      `L${at(centre, a(1), radius * 0.72)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** An Archimedean spiral — the hairspring. */
export function spiralPath(
  centre: Point, turns: number, innerRadius: number, outerRadius: number, phaseRad = 0, steps = 160,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = phaseRad + t * turns * TAU;
    const r = innerRadius + (outerRadius - innerRadius) * t;
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(centre.x + Math.cos(angle) * r)} ${fmt(centre.y + Math.sin(angle) * r)}`);
  }
  return parts.join(' ');
}

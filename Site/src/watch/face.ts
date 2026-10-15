import type { WatchState } from './movement-model';
import type { HandState } from './hands';

export type FaceId = 'fullbleed' | 'classic';
export const FACE_IDS: readonly FaceId[] = ['fullbleed', 'classic'];

/** A watch face: an SVG that draws one movement state. */
export interface Face {
  readonly root: SVGSVGElement;
  /** True when the face changes between beats (a sweeping hand), so it is drawn every frame. */
  readonly continuous: boolean;
  render(state: WatchState): void;
  destroy(): void;
}

/** The refined faces (Analog, Digital): drawn from a pure hand state. Task 4 renames this to `Face`. */
export interface DialFace {
  readonly root: Element;
  render(state: HandState, date: Date): void;
  destroy(): void;
}

import type { WatchState } from './movement-model';

export type FaceId = 'fullbleed' | 'classic';
export const FACE_IDS: readonly FaceId[] = ['fullbleed', 'classic'];

/** A watch face: an SVG that draws one movement state. */
export interface Face {
  readonly root: SVGSVGElement;
  render(state: WatchState): void;
  destroy(): void;
}

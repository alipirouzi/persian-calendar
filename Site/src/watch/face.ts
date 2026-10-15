import type { HandState } from './hands';

export type FaceId = 'analog' | 'digital';
export const FACE_IDS: readonly FaceId[] = ['analog', 'digital'];

/** A watch face: draws the hands' state (Analog) or the date's digits (Digital). */
export interface Face {
  readonly root: Element;
  render(state: HandState, date: Date): void;
  destroy(): void;
}

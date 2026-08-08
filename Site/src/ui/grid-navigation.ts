export interface GridShape {
  /** 1 for a list, 3 for a month or year page, 7 for a day grid. */
  columns: number;
  count: number;
  rtl: boolean;
}

export type GridIntent =
  | { kind: 'move'; index: number }
  | { kind: 'page'; delta: -1 | 1 }
  | { kind: 'select' }
  | { kind: 'dismiss' }
  | { kind: 'open' }
  | null;

/**
 * The WAI-ARIA grid pattern is visual, not logical: ArrowRight moves to the cell
 * on the right, which under RTL is the *previous* one.
 */
const horizontalDelta = (key: string, rtl: boolean): number =>
  (key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);

/**
 * A move that would land outside the grid is not a move. Reporting null rather
 * than a clamped index lets the caller decide what the edge means — the day view
 * crosses into the neighbouring month, the year page stops.
 */
const moveTo = (target: number, count: number): GridIntent =>
  target >= 0 && target < count ? { kind: 'move', index: target } : null;

/**
 * Key handling for any N-column grid, as a pure function: no DOM, no state, no
 * knowledge of what the cells mean. The caller owns the cursor and decides what
 * each intent does.
 */
export function gridIntent(
  key: string,
  index: number,
  shape: GridShape,
  isOpen: boolean,
): GridIntent {
  const { columns, count, rtl } = shape;
  if (!isOpen) {
    // Closed, only the two keys that conventionally drop a listbox open do
    // anything; the rest belong to whatever holds focus.
    return key === 'ArrowDown' || key === 'ArrowUp' ? { kind: 'open' } : null;
  }
  const rowStart = index - (index % columns);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowLeft':
      return moveTo(index + horizontalDelta(key, rtl), count);
    case 'ArrowDown':
      return moveTo(index + columns, count);
    case 'ArrowUp':
      return moveTo(index - columns, count);
    case 'Home':
      return moveTo(rowStart, count);
    case 'End':
      // A short final row ends at the last real cell, not at a blank.
      return moveTo(Math.min(rowStart + columns - 1, count - 1), count);
    case 'PageUp':
      return { kind: 'page', delta: -1 };
    case 'PageDown':
      return { kind: 'page', delta: 1 };
    case 'Enter':
    case ' ':
      return { kind: 'select' };
    case 'Escape':
      return { kind: 'dismiss' };
    default:
      return null;
  }
}

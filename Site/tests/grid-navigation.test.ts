import { describe, expect, it } from 'vitest';
import { gridIntent, type GridShape } from '../src/ui/grid-navigation';

const shape = (columns: number, count: number, rtl = false): GridShape => ({ columns, count, rtl });

/** A 30-day month laid out 7 across, the widest shape the calendar renders. */
const days = shape(7, 30);
/** A month or year page: 12 cells, 3 across. */
const page = shape(3, 12);
/** The number picker's list: one column. */
const list = shape(1, 12);

describe('horizontal movement', () => {
  it('steps one cell along the row at 7, 3, and 1 columns', () => {
    expect(gridIntent('ArrowRight', 10, days, true)).toEqual({ kind: 'move', index: 11 });
    expect(gridIntent('ArrowLeft', 10, days, true)).toEqual({ kind: 'move', index: 9 });
    expect(gridIntent('ArrowRight', 4, page, true)).toEqual({ kind: 'move', index: 5 });
    expect(gridIntent('ArrowLeft', 4, page, true)).toEqual({ kind: 'move', index: 3 });
    expect(gridIntent('ArrowRight', 4, list, true)).toEqual({ kind: 'move', index: 5 });
    expect(gridIntent('ArrowLeft', 4, list, true)).toEqual({ kind: 'move', index: 3 });
  });

  it('mirrors under RTL, where the cell on the right is the previous one', () => {
    expect(gridIntent('ArrowRight', 10, shape(7, 30, true), true)).toEqual({ kind: 'move', index: 9 });
    expect(gridIntent('ArrowLeft', 10, shape(7, 30, true), true)).toEqual({ kind: 'move', index: 11 });
  });

  it('returns null instead of stepping off either end', () => {
    expect(gridIntent('ArrowLeft', 0, days, true)).toBeNull();
    expect(gridIntent('ArrowRight', 29, days, true)).toBeNull();
  });

  it('returns null off either end under RTL too', () => {
    expect(gridIntent('ArrowRight', 0, shape(7, 1, true), true)).toBeNull();
    expect(gridIntent('ArrowLeft', 0, shape(7, 1, true), true)).toBeNull();
  });
});

describe('vertical movement', () => {
  it('moves a whole row per arrow', () => {
    expect(gridIntent('ArrowDown', 3, days, true)).toEqual({ kind: 'move', index: 10 });
    expect(gridIntent('ArrowUp', 10, days, true)).toEqual({ kind: 'move', index: 3 });
    expect(gridIntent('ArrowDown', 1, page, true)).toEqual({ kind: 'move', index: 4 });
    expect(gridIntent('ArrowUp', 4, page, true)).toEqual({ kind: 'move', index: 1 });
    expect(gridIntent('ArrowDown', 1, list, true)).toEqual({ kind: 'move', index: 2 });
    expect(gridIntent('ArrowUp', 1, list, true)).toEqual({ kind: 'move', index: 0 });
  });

  it('ignores RTL: rows read top to bottom whichever way the text runs', () => {
    expect(gridIntent('ArrowDown', 3, shape(7, 30, true), true)).toEqual({ kind: 'move', index: 10 });
    expect(gridIntent('ArrowUp', 10, shape(7, 30, true), true)).toEqual({ kind: 'move', index: 3 });
  });

  it('returns null when the row above or below does not exist', () => {
    expect(gridIntent('ArrowUp', 3, days, true)).toBeNull();
    expect(gridIntent('ArrowDown', 27, days, true)).toBeNull();
  });
});

describe('Home and End', () => {
  it('goes to the first cell of the row the cursor is in', () => {
    expect(gridIntent('Home', 4, page, true)).toEqual({ kind: 'move', index: 3 });
    expect(gridIntent('Home', 10, days, true)).toEqual({ kind: 'move', index: 7 });
  });

  it('still reports a move when the cursor already sits on the row edge', () => {
    expect(gridIntent('Home', 3, page, true)).toEqual({ kind: 'move', index: 3 });
    expect(gridIntent('End', 13, days, true)).toEqual({ kind: 'move', index: 13 });
  });

  it('goes to the last cell of the row the cursor is in', () => {
    expect(gridIntent('End', 3, page, true)).toEqual({ kind: 'move', index: 5 });
    expect(gridIntent('End', 7, days, true)).toEqual({ kind: 'move', index: 13 });
  });

  it('stops on the last real cell of a short final row', () => {
    expect(gridIntent('End', 28, days, true)).toEqual({ kind: 'move', index: 29 });
  });

  it('treats a one-column list as a row of one', () => {
    expect(gridIntent('Home', 5, list, true)).toEqual({ kind: 'move', index: 5 });
    expect(gridIntent('End', 5, list, true)).toEqual({ kind: 'move', index: 5 });
  });
});

describe('keys that are not movement', () => {
  it('maps PageUp and PageDown to a page step', () => {
    expect(gridIntent('PageUp', 5, days, true)).toEqual({ kind: 'page', delta: -1 });
    expect(gridIntent('PageDown', 5, days, true)).toEqual({ kind: 'page', delta: 1 });
  });

  it('selects on Enter and on Space', () => {
    expect(gridIntent('Enter', 5, days, true)).toEqual({ kind: 'select' });
    expect(gridIntent(' ', 5, days, true)).toEqual({ kind: 'select' });
  });

  it('dismisses on Escape', () => {
    expect(gridIntent('Escape', 5, days, true)).toEqual({ kind: 'dismiss' });
  });

  it('ignores any other key', () => {
    expect(gridIntent('Tab', 5, days, true)).toBeNull();
    expect(gridIntent('a', 5, days, true)).toBeNull();
  });
});

describe('while closed', () => {
  it('opens on either vertical arrow', () => {
    expect(gridIntent('ArrowDown', 0, days, false)).toEqual({ kind: 'open' });
    expect(gridIntent('ArrowUp', 0, days, false)).toEqual({ kind: 'open' });
  });

  it('ignores every other key, including ones it would handle when open', () => {
    expect(gridIntent('ArrowRight', 0, days, false)).toBeNull();
    expect(gridIntent('ArrowLeft', 0, days, false)).toBeNull();
    expect(gridIntent('Home', 0, days, false)).toBeNull();
    expect(gridIntent('End', 0, days, false)).toBeNull();
    expect(gridIntent('PageDown', 0, days, false)).toBeNull();
    expect(gridIntent('Enter', 0, days, false)).toBeNull();
    expect(gridIntent(' ', 0, days, false)).toBeNull();
    expect(gridIntent('Escape', 0, days, false)).toBeNull();
    expect(gridIntent('a', 0, days, false)).toBeNull();
  });
});

describe('an empty grid', () => {
  const empty = shape(7, 0);

  it('never moves and never throws', () => {
    expect(gridIntent('ArrowRight', 0, empty, true)).toBeNull();
    expect(gridIntent('ArrowLeft', 0, empty, true)).toBeNull();
    expect(gridIntent('ArrowDown', 0, empty, true)).toBeNull();
    expect(gridIntent('ArrowUp', 0, empty, true)).toBeNull();
    expect(gridIntent('Home', 0, empty, true)).toBeNull();
    expect(gridIntent('End', 0, empty, true)).toBeNull();
  });
});

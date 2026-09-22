import { describe, expect, it } from 'vitest';
import { reduceKey } from './keyboard';
import { ROW_COL_INDEX, type TreeGridCursor, type TreeGridRow } from './types';

/**
 * A shape with one of every case the model has an answer for: a root, an open row with children
 * of its own, a leaf, a closed row, and a leaf at the end of the list. Nothing here is a client
 * — the reducer knows rows, columns and nothing else (architecture §6).
 *
 *   root            open, level 1, no parent
 *     open          open, level 2, 1 of 3, has children
 *       leaf        level 3, 1 of 2
 *       shut        closed, level 3, 2 of 2, has children
 *     closed        closed, level 2, 2 of 3, has children
 *     last          level 2, 3 of 3, leaf — the last visible row
 */
const ROWS: readonly TreeGridRow[] = [
  { id: 'root', parentId: null, level: 1, posInSet: 1, setSize: 1, hasChildren: true },
  { id: 'open', parentId: 'root', level: 2, posInSet: 1, setSize: 3, hasChildren: true },
  { id: 'leaf', parentId: 'open', level: 3, posInSet: 1, setSize: 2, hasChildren: false },
  { id: 'shut', parentId: 'open', level: 3, posInSet: 2, setSize: 2, hasChildren: true },
  { id: 'closed', parentId: 'root', level: 2, posInSet: 2, setSize: 3, hasChildren: true },
  { id: 'last', parentId: 'root', level: 2, posInSet: 3, setSize: 3, hasChildren: false },
];

const EXPANDED: ReadonlySet<string> = new Set(['root', 'open']);
const COLUMNS = 12;
const LAST_COLUMN = COLUMNS - 1;

const onRow = (rowId: string): TreeGridCursor => ({ rowId, colIndex: ROW_COL_INDEX });
const onFigure = (rowId: string, colIndex: number): TreeGridCursor => ({ rowId, colIndex });

const press = (cursor: TreeGridCursor, key: string, expanded = EXPANDED) =>
  reduceKey(cursor, key, ROWS, expanded, COLUMNS);

describe('reduceKey — on a row (FR3)', () => {
  it('moves down and up through the rows that are showing', () => {
    expect(press(onRow('root'), 'ArrowDown')).toEqual({ cursor: onRow('open') });
    // Straight into the open row's children: the list is already only what is visible.
    expect(press(onRow('open'), 'ArrowDown')).toEqual({ cursor: onRow('leaf') });
    expect(press(onRow('closed'), 'ArrowUp')).toEqual({ cursor: onRow('shut') });
  });

  it('stops at the ends rather than wrapping (FR3-AC10)', () => {
    expect(press(onRow('root'), 'ArrowUp')).toEqual({ cursor: onRow('root') });
    expect(press(onRow('last'), 'ArrowDown')).toEqual({ cursor: onRow('last') });
  });

  it('enters the figures with Right on a closed row, without opening it (FR3-AC2)', () => {
    expect(press(onRow('closed'), 'ArrowRight')).toEqual({ cursor: onFigure('closed', 0) });
    expect(press(onRow('shut'), 'ArrowRight')).toEqual({ cursor: onFigure('shut', 0) });
  });

  it('enters the figures with Right while the row is open (FR3-AC3)', () => {
    expect(press(onRow('open'), 'ArrowRight')).toEqual({ cursor: onFigure('open', 0) });
    expect(press(onRow('root'), 'ArrowRight')).toEqual({ cursor: onFigure('root', 0) });
  });

  it('enters the figures with Right on a row that has nothing beneath it (FR3-AC4)', () => {
    expect(press(onRow('leaf'), 'ArrowRight')).toEqual({ cursor: onFigure('leaf', 0) });
    expect(press(onRow('last'), 'ArrowRight')).toEqual({ cursor: onFigure('last', 0) });
  });

  it('goes up to the parent with Left on an open row, without closing it (FR3-AC12)', () => {
    expect(press(onRow('open'), 'ArrowLeft')).toEqual({ cursor: onRow('root') });
  });

  it('goes up to the parent with Left from a closed row and from a leaf (FR3-AC13)', () => {
    expect(press(onRow('closed'), 'ArrowLeft')).toEqual({ cursor: onRow('root') });
    expect(press(onRow('shut'), 'ArrowLeft')).toEqual({ cursor: onRow('open') });
    expect(press(onRow('leaf'), 'ArrowLeft')).toEqual({ cursor: onRow('open') });
  });

  it('stays put on Left at the top, open or closed — nothing is above the root (FR3-AC11)', () => {
    expect(press(onRow('root'), 'ArrowLeft')).toEqual({ cursor: onRow('root') });
    expect(press(onRow('root'), 'ArrowLeft', new Set(['open']))).toEqual({ cursor: onRow('root') });
  });

  /**
   * The amendment itself, said once over the whole shape rather than row by row: after the
   * owner's screen-reader pass on 2026-09-22 the arrows only ever move the outline. Whether a
   * row is open was the thing that made Right ambiguous, so the interesting assertion is that
   * no row, in either state, answers an arrow with a toggle.
   */
  it('never changes the table’s shape with an arrow, whatever the row’s state (FR3)', () => {
    for (const { id } of ROWS) {
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
        for (const expanded of [EXPANDED, new Set<string>(), new Set(ROWS.map((r) => r.id))]) {
          expect(press(onRow(id), key, expanded)).not.toHaveProperty('toggle');
        }
      }
    }
  });

  it('jumps to the first and last showing rows with Home and End (FR3-AC16)', () => {
    expect(press(onRow('closed'), 'Home')).toEqual({ cursor: onRow('root') });
    expect(press(onRow('closed'), 'End')).toEqual({ cursor: onRow('last') });
    // Already there: still handled, so the page never scrolls underneath the grid instead.
    expect(press(onRow('root'), 'Home')).toEqual({ cursor: onRow('root') });
    expect(press(onRow('last'), 'End')).toEqual({ cursor: onRow('last') });
  });

  it('toggles the row with Enter and with Space — the only keys that do (FR3-AC14)', () => {
    expect(press(onRow('closed'), 'Enter')).toEqual({ toggle: 'closed' });
    expect(press(onRow('closed'), ' ')).toEqual({ toggle: 'closed' });
    expect(press(onRow('open'), 'Enter')).toEqual({ toggle: 'open' });
    expect(press(onRow('open'), ' ')).toEqual({ toggle: 'open' });
  });

  it('does nothing on Enter or Space for a row with nothing to open (FR3-AC15)', () => {
    expect(press(onRow('leaf'), 'Enter')).toEqual({ cursor: onRow('leaf') });
    expect(press(onRow('leaf'), ' ')).toEqual({ cursor: onRow('leaf') });
  });
});

describe('reduceKey — on a figure (FR3)', () => {
  it('moves along the months with Right and Left (FR3-AC5)', () => {
    expect(press(onFigure('open', 0), 'ArrowRight')).toEqual({ cursor: onFigure('open', 1) });
    expect(press(onFigure('open', 1), 'ArrowRight')).toEqual({ cursor: onFigure('open', 2) });
    expect(press(onFigure('open', 2), 'ArrowLeft')).toEqual({ cursor: onFigure('open', 1) });
  });

  it('returns to the row name from the first month (FR3-AC6)', () => {
    expect(press(onFigure('open', 0), 'ArrowLeft')).toEqual({ cursor: onRow('open') });
  });

  it('stops at the last month rather than wrapping (FR3-AC10)', () => {
    expect(press(onFigure('open', LAST_COLUMN), 'ArrowRight')).toEqual({
      cursor: onFigure('open', LAST_COLUMN),
    });
  });

  it('moves to the same month in the row above and below (FR3-AC7)', () => {
    expect(press(onFigure('open', 4), 'ArrowDown')).toEqual({ cursor: onFigure('leaf', 4) });
    expect(press(onFigure('leaf', 4), 'ArrowUp')).toEqual({ cursor: onFigure('open', 4) });
  });

  it('stops at the first and last rows while on a figure (FR3-AC10)', () => {
    expect(press(onFigure('root', 4), 'ArrowUp')).toEqual({ cursor: onFigure('root', 4) });
    expect(press(onFigure('last', LAST_COLUMN), 'ArrowDown')).toEqual({
      cursor: onFigure('last', LAST_COLUMN),
    });
  });

  it('jumps to the row own first and last months with Home and End (FR3-AC8)', () => {
    expect(press(onFigure('open', 4), 'Home')).toEqual({ cursor: onFigure('open', 0) });
    expect(press(onFigure('open', 4), 'End')).toEqual({ cursor: onFigure('open', LAST_COLUMN) });
    // Home and End never leave the row they were pressed in.
    expect(press(onFigure('leaf', 0), 'Home')).toEqual({ cursor: onFigure('leaf', 0) });
  });

  it('does nothing at all on Enter or Space — a row opens from its name (FR3-AC9)', () => {
    expect(press(onFigure('open', 3), 'Enter')).toEqual({ cursor: onFigure('open', 3) });
    expect(press(onFigure('open', 3), ' ')).toEqual({ cursor: onFigure('open', 3) });
    // Even on a row that could open: the figures are not its handle.
    expect(press(onFigure('closed', 0), 'Enter')).toEqual({ cursor: onFigure('closed', 0) });
  });
});

describe('reduceKey — keys that are not the grid’s', () => {
  it('leaves Tab alone, so it moves out of the table (FR3-AC1)', () => {
    expect(press(onRow('root'), 'Tab')).toBeNull();
    expect(press(onFigure('root', 0), 'Tab')).toBeNull();
  });

  it('ignores anything else', () => {
    for (const key of ['a', 'Escape', 'PageDown', 'F5']) {
      expect(press(onRow('open'), key)).toBeNull();
    }
  });

  it('does nothing when the cursor names a row that is no longer showing', () => {
    expect(press(onRow('gone'), 'ArrowDown')).toBeNull();
  });
});

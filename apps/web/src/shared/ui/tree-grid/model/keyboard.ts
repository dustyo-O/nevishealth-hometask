import { ROW_COL_INDEX, type TreeGridCursor, type TreeGridRow } from './types';

/**
 * What a key means to the grid.
 *
 * - `{ cursor }` — where the outline goes, which is sometimes exactly where it already is:
 *   nothing wraps (FR3-AC10), and saying so as a cursor rather than as `null` is what lets the
 *   caller swallow the key. An arrow that fell through to the browser would scroll the months
 *   sideways under a stationary outline, and Space would scroll the page (FR3-AC9).
 * - `{ toggle }` — open or close that row, which only Enter and Space ever ask for. The cursor
 *   does not move with it; where it ends up depends on rows this pure function has not seen
 *   yet (D-10).
 * - `null` — not the grid's key. Tab above all, which is how the outline leaves (FR3-AC1).
 */
export type TreeGridKeyResult = { cursor: TreeGridCursor } | { toggle: string } | null;

/**
 * The whole keyboard model of FR3 as one pure function: no DOM, no React, no state. `rows` is
 * the flattened list of what is *showing*, so "skipping anything hidden inside a closed row" is
 * not a rule here — it is the shape of the input.
 *
 * No rule asks whether a row is open: the arrows only ever move the outline (FR3, amended), so
 * the open rows are not an argument. `columnCount` is: §2.2's "stop at 11" and "End → 11" are
 * counted from it, and a `TreeGridRow` carries no figures to count (it must not — this layer
 * knows nothing about what the columns hold).
 */
export const reduceKey = (
  cursor: TreeGridCursor,
  key: string,
  rows: readonly TreeGridRow[],
  columnCount: number,
): TreeGridKeyResult => {
  const index = rows.findIndex((candidate) => candidate.id === cursor.rowId);
  const row = rows[index];
  // The cursor names a row that is no longer showing. Recovering from that is the caller's job
  // (it knows which row was just closed); there is nothing this function can say about a key.
  if (row === undefined) return null;

  const onRow = cursor.colIndex === ROW_COL_INDEX;
  const lastColIndex = columnCount - 1;
  /** Handled, and the outline stays where it is — an edge, or a key with nothing to do. */
  const stay: TreeGridKeyResult = { cursor };
  const at = (rowId: string, colIndex: number): TreeGridKeyResult => ({
    cursor: { rowId, colIndex },
  });
  /** The row `offset` away, keeping the column: the same month, one row up or down (FR3-AC7). */
  const step = (offset: number): TreeGridKeyResult => {
    const next = rows[index + offset];
    return next === undefined ? stay : at(next.id, cursor.colIndex);
  };

  switch (key) {
    case 'ArrowDown':
      return step(1);

    case 'ArrowUp':
      return step(-1);

    case 'ArrowRight':
      if (!onRow) return cursor.colIndex >= lastColIndex ? stay : at(row.id, cursor.colIndex + 1);
      // Into the figures, whatever state the row is in — open, closed, or with nothing to open
      // (FR3-AC2/AC3/AC4). It used to expand a closed row, which made its meaning depend on a
      // state a screen-reader user cannot see coming; the owner found exactly that confusing.
      return columnCount > 0 ? at(row.id, 0) : stay;

    case 'ArrowLeft': {
      // From the first month back to the name, which `colIndex - 1` already spells (FR3-AC6).
      if (!onRow) return at(row.id, cursor.colIndex - 1);
      // Up a level, whatever state the row is in — it never closes one (FR3-AC12/AC13). The
      // root has nowhere above it to go, so the outline stays (FR3-AC11).
      const { parentId } = row;
      if (parentId === null) return stay;
      return rows.some((candidate) => candidate.id === parentId)
        ? at(parentId, ROW_COL_INDEX)
        : stay;
    }

    case 'Home': {
      if (!onRow) return at(row.id, 0);
      const first = rows[0];
      return first === undefined ? stay : at(first.id, ROW_COL_INDEX);
    }

    case 'End': {
      if (!onRow) return at(row.id, lastColIndex);
      const last = rows.at(-1);
      return last === undefined ? stay : at(last.id, ROW_COL_INDEX);
    }

    case 'Enter':
    case ' ':
      // The only two keys that change the table's shape at all. On a figure, nothing — a row is
      // opened and closed from its name, never from its figures (FR3-AC9) — and on a row with
      // nothing beneath it, nothing either (FR3-AC15).
      return onRow && row.hasChildren ? { toggle: row.id } : stay;

    default:
      return null;
  }
};

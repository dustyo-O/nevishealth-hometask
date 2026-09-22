/**
 * One row of a tree grid, already flattened out of whatever tree the caller holds: the grid
 * renders a list, never a tree. Everything here is a tree concept — nothing in this layer knows
 * what the rows describe (architecture §6).
 */
export type TreeGridRow = {
  id: string;
  /** `null` for a root row — there is nothing above it to move to. */
  parentId: string | null;
  /** 1-based depth, exactly as `aria-level` counts it. */
  level: number;
  /** 1-based position among the rows sharing this parent (`aria-posinset`). */
  posInSet: number;
  /** How many rows share this parent (`aria-setsize`). */
  setSize: number;
  /**
   * False for a leaf. A leaf carries no `aria-expanded` at all, so a screen reader reports no
   * open-or-closed state for it (FR4-AC5).
   */
  hasChildren: boolean;
};

/**
 * Where the outline is: one row, and one column within it. `colIndex` is 0-based along the
 * figures and {@link ROW_COL_INDEX} for the row's own name, so "on a row" and "on a figure" are
 * one value rather than two states that could disagree.
 */
export type TreeGridCursor = {
  rowId: string;
  colIndex: number;
};

/** The cursor's home: the row's name cell, where it enters the grid and where ← brings it back. */
export const ROW_COL_INDEX = -1;

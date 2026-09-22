import { ROW_COL_INDEX } from './types';

/**
 * Every id the grid puts in the DOM, generated in one place. `role="treegrid"` replaces the
 * implicit row/column association a plain table would give, so a figure names its two headers
 * explicitly (D-11) — and the keyboard resolves the element to focus by the same scheme, which
 * is only safe while one function spells all of them.
 */
export type TreeGridIds = {
  columnHeaderId: (colIndex: number) => string;
  rowHeaderId: (rowId: string) => string;
  /** Where the outline can land: the row itself at {@link ROW_COL_INDEX}, otherwise a figure. */
  cellId: (rowId: string, colIndex: number) => string;
};

/** `gridId` namespaces the lot, so two grids on one page never collide. */
export const treeGridIds = (gridId: string): TreeGridIds => ({
  columnHeaderId: (colIndex) => `${gridId}-col-${colIndex}`,
  rowHeaderId: (rowId) => `${gridId}-row-${rowId}-name`,
  cellId: (rowId, colIndex) =>
    colIndex === ROW_COL_INDEX ? `${gridId}-row-${rowId}` : `${gridId}-cell-${rowId}-${colIndex}`,
});

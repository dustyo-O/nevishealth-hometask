import { createContext, use } from 'react';
import type { TreeGridIds } from './ids';
import type { TreeGridRow } from './types';

/**
 * The ids that tie a figure to the two headers describing it, and that the keyboard resolves
 * the focused element by (D-11). Everything here is stable for the life of the grid: the cursor
 * never travels by context, or all 44 rows would re-render on every keystroke (D-9).
 */
export type TreeGridContextValue = TreeGridIds;

/** What the cells of one row share: the row, and where the outline is inside it. */
export type TreeGridRowContextValue = {
  row: TreeGridRow;
  /** The column the outline is on, or `null` when it is on some other row entirely. */
  activeColIndex: number | null;
};

const TreeGridContext = createContext<TreeGridContextValue | null>(null);
const TreeGridRowContext = createContext<TreeGridRowContextValue | null>(null);

export const TreeGridProvider = TreeGridContext;
export const TreeGridRowProvider = TreeGridRowContext;

export const useTreeGridContext = (): TreeGridContextValue => {
  const value = use(TreeGridContext);
  if (value === null) throw new Error('TreeGrid parts must be rendered inside a <TreeGrid>');
  return value;
};

export const useTreeGridRowContext = (): TreeGridRowContextValue => {
  const value = use(TreeGridRowContext);
  if (value === null) throw new Error('TreeGrid cells must be rendered inside a <TreeGrid.Row>');
  return value;
};

export const useTreeGridRow = (): TreeGridRow => useTreeGridRowContext().row;

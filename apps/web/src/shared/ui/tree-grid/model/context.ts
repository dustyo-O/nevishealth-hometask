import { createContext, use } from 'react';
import type { TreeGridRow } from './types';

/**
 * The ids that tie a figure to the two headers describing it. `role="treegrid"` overrides the
 * implicit row/column association a plain table would give, so every figure needs an explicit
 * `headers` — and the ids it points at must be generated in one place or they drift (D-11).
 * Everything here is stable for the life of the grid: the cursor never travels by context (D-9).
 */
export type TreeGridContextValue = {
  columnHeaderId: (colIndex: number) => string;
  rowHeaderId: (rowId: string) => string;
};

const TreeGridContext = createContext<TreeGridContextValue | null>(null);
const TreeGridRowContext = createContext<TreeGridRow | null>(null);

export const TreeGridProvider = TreeGridContext;
export const TreeGridRowProvider = TreeGridRowContext;

export const useTreeGridContext = (): TreeGridContextValue => {
  const value = use(TreeGridContext);
  if (value === null) throw new Error('TreeGrid parts must be rendered inside a <TreeGrid>');
  return value;
};

export const useTreeGridRow = (): TreeGridRow => {
  const row = use(TreeGridRowContext);
  if (row === null) throw new Error('TreeGrid cells must be rendered inside a <TreeGrid.Row>');
  return row;
};

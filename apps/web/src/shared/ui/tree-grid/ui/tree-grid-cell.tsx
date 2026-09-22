import type { ReactNode } from 'react';
import { cx } from '../../../lib/cx';
import { useTreeGridContext, useTreeGridRowContext } from '../model/context';
import styles from './tree-grid.module.css';

export type TreeGridCellProps = {
  /** 0-based, matching the `colIndex` its column heading was given. */
  colIndex: number;
  className?: string;
  children?: ReactNode;
};

/**
 * One figure. `role="treegrid"` replaces the implicit association a plain table would give, so
 * the two headers a screen reader should read out are named explicitly (D-11, FR4-AC2).
 */
export const TreeGridCell = ({ colIndex, className, children }: TreeGridCellProps) => {
  const { columnHeaderId, rowHeaderId, cellId } = useTreeGridContext();
  const { row, activeColIndex } = useTreeGridRowContext();

  return (
    <td
      id={cellId(row.id, colIndex)}
      headers={`${columnHeaderId(colIndex)} ${rowHeaderId(row.id)}`}
      className={cx(styles.cell, className)}
      tabIndex={activeColIndex === colIndex ? 0 : -1}
    >
      {children}
    </td>
  );
};

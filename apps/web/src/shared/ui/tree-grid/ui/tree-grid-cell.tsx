import type { MouseEvent, ReactNode } from 'react';
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
 * A figure is focusable, because the keyboard walks the months — and so, left alone, a click
 * would focus it too, without the grid's cursor knowing: the next key would then act on the
 * stale cursor, and Enter could close the Company row (code review F1). A figure is no click
 * target (FR2-AC5), so the pointer leaves focus where it was. The name cell is not touched: its
 * click is the toggle, and focusing its row is what the keyboard would do there too.
 */
const keepFocus = (event: MouseEvent) => event.preventDefault();

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
      data-col-index={colIndex}
      onMouseDown={keepFocus}
    >
      {children}
    </td>
  );
};

import type { ReactNode } from 'react';
import { useTreeGridContext, useTreeGridRow } from '../model/context';

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
  const { columnHeaderId, rowHeaderId } = useTreeGridContext();
  const row = useTreeGridRow();

  return (
    <td headers={`${columnHeaderId(colIndex)} ${rowHeaderId(row.id)}`} className={className}>
      {children}
    </td>
  );
};

import type { ReactNode } from 'react';
import { TreeGridRowProvider } from '../model/context';
import type { TreeGridRow as TreeGridRowModel } from '../model/types';

export type TreeGridRowProps = {
  row: TreeGridRowModel;
  /** Ignored for a leaf, which reports no open-or-closed state at all (FR4-AC5). */
  expanded?: boolean;
  children: ReactNode;
};

/**
 * One row of the grid. Where it sits in the hierarchy is on the row itself, so a screen reader
 * can say it without the user having to see the indentation (FR4-AC1).
 */
export const TreeGridRow = ({ row, expanded = false, children }: TreeGridRowProps) => (
  <TreeGridRowProvider value={row}>
    <tr
      aria-level={row.level}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-expanded={row.hasChildren ? expanded : undefined}
    >
      {children}
    </tr>
  </TreeGridRowProvider>
);

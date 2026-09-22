import { useMemo, type ReactNode } from 'react';
import { TreeGridRowProvider, useTreeGridContext } from '../model/context';
import { ROW_COL_INDEX, type TreeGridRow as TreeGridRowModel } from '../model/types';
import styles from './tree-grid.module.css';

export type TreeGridRowProps = {
  row: TreeGridRowModel;
  /** Ignored for a leaf, which reports no open-or-closed state at all (FR4-AC5). */
  expanded?: boolean;
  /**
   * Where the outline is inside this row, or `null` when it is on another row — the whole of
   * the roving `tabindex`, carried as a prop so a keystroke touches two rows and not all of
   * them (D-9). The row itself is the tab stop at {@link ROW_COL_INDEX}; a figure takes it from
   * there.
   */
  activeColIndex?: number | null;
  children: ReactNode;
};

/**
 * One row of the grid. Where it sits in the hierarchy is on the row itself, so a screen reader
 * can say it without the user having to see the indentation (FR4-AC1).
 */
export const TreeGridRow = ({
  row,
  expanded = false,
  activeColIndex = null,
  children,
}: TreeGridRowProps) => {
  const { cellId } = useTreeGridContext();
  const context = useMemo(() => ({ row, activeColIndex }), [row, activeColIndex]);

  return (
    <TreeGridRowProvider value={context}>
      <tr
        id={cellId(row.id, ROW_COL_INDEX)}
        className={styles.row}
        aria-level={row.level}
        aria-posinset={row.posInSet}
        aria-setsize={row.setSize}
        aria-expanded={row.hasChildren ? expanded : undefined}
        // Exactly one element in the grid is ever 0, so Tab moves into the table once and out
        // again (FR3-AC1); the rest stay reachable to the arrow keys and to nothing else.
        tabIndex={activeColIndex === ROW_COL_INDEX ? 0 : -1}
      >
        {children}
      </tr>
    </TreeGridRowProvider>
  );
};

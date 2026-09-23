import {
  useMemo,
  useRef,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
  type UIEvent,
} from 'react';
import { cx } from '../../../lib/cx';
import { TreeGridProvider } from '../model/context';
import { treeGridIds } from '../model/ids';
import { useRowMotion } from '../model/use-row-motion';
import { TreeGridCell } from './tree-grid-cell';
import { TreeGridColumnHeader, TreeGridHead } from './tree-grid-head';
import { TreeGridRow } from './tree-grid-row';
import { TreeGridRowHeader } from './tree-grid-row-header';
import { TreeGridToggle } from './tree-grid-toggle';
import styles from './tree-grid.module.css';

export type TreeGridProps = {
  /** Namespaces every header id, so two grids on one page never collide. */
  id: string;
  label: string;
  /** How many figure columns follow the name column. */
  columnCount: number;
  head: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * The whole keyboard model, from `useTreeGrid`. It hangs on the table rather than on each of
   * its cells: a keystroke reaches it by bubbling from whichever one has focus.
   */
  onKeyDown?: KeyboardEventHandler<HTMLTableElement>;
  /** From `useTreeGrid` too: keeps its cursor on whatever gained focus, however it got there. */
  onFocus?: FocusEventHandler<HTMLTableElement>;
};

/**
 * The figures scroll sideways inside a `<div>` of the grid's own, never in its container: giving
 * a container `overflow-x: auto` forces its `overflow-y` away from `visible`, which would turn it
 * into a scroll container (D-1). Sticky still resolves against this scroller, because the
 * container is an ancestor *of* it rather than something in between. `className` lands on the
 * scroller, which is where the caller sets the grid's geometry (`tree-grid.module.css`).
 */
export const TreeGrid = ({
  id,
  label,
  columnCount,
  head,
  children,
  className,
  onKeyDown,
  onFocus,
}: TreeGridProps) => {
  const context = useMemo(() => treeGridIds(id), [id]);

  // FR2-AC8, D-16: the `<tbody>`, because its children are what come and go; the header row
  // must not move.
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  useRowMotion(rowsRef);

  // The edge shadow is the sign that there is more to see, so it must not show when there is
  // nothing (FR6-AC3/AC4). Written straight to the DOM rather than held in state: scrolling
  // must not re-render every row, and the stylesheet is what decides what the flag looks like.
  const markScrolled = (event: UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    scroller.dataset.scrolled = String(scroller.scrollLeft > 0);
  };

  return (
    <div className={cx(styles.scroller, className)} onScroll={markScrolled}>
      <TreeGridProvider value={context}>
        <table
          id={id}
          role="treegrid"
          aria-label={label}
          className={styles.table}
          style={{ '--tree-grid-columns': columnCount } as CSSProperties}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        >
          {head}
          <tbody ref={rowsRef}>{children}</tbody>
        </table>
      </TreeGridProvider>
    </div>
  );
};

// Attached rather than `Object.assign`ed so the export stays a plain component declaration:
// anything else and both Fast Refresh and its lint rule lose sight of it.
TreeGrid.Head = TreeGridHead;
TreeGrid.ColumnHeader = TreeGridColumnHeader;
TreeGrid.Row = TreeGridRow;
TreeGrid.RowHeader = TreeGridRowHeader;
TreeGrid.Cell = TreeGridCell;
TreeGrid.Toggle = TreeGridToggle;

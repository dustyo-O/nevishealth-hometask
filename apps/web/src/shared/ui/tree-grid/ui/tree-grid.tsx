import autoAnimate from '@formkit/auto-animate';
import {
  useEffect,
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
import { rowMotion } from '../model/row-motion';
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
   * its ~570 cells: a keystroke reaches it by bubbling from whichever one has focus.
   */
  onKeyDown?: KeyboardEventHandler<HTMLTableElement>;
  /** From `useTreeGrid` too: keeps its cursor on whatever gained focus, however it got there. */
  onFocus?: FocusEventHandler<HTMLTableElement>;
};

/**
 * The months scroll sideways inside a `<div>` of the grid's own, never in the `Card`: giving a
 * card `overflow-x: auto` forces its `overflow-y` away from `visible`, which would turn every
 * card on the page into a scroll container (D-1). Sticky still resolves against this scroller,
 * because the card is an ancestor *of* it rather than something in between.
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

  // FR2-AC8, D-16: the rows that appear and disappear slide, and the ones that stay travel with
  // them. It is the `<tbody>` because that is the element whose children come and go — the
  // header row must not move — and the plugin is chosen once, here at mount: under
  // `prefers-reduced-motion` it is not a plugin at all and the library disables itself.
  //
  // Registered in an effect with a cleanup rather than through the library's own
  // `useAutoAnimate`, which attaches from a ref callback and cannot undo it: under React's
  // StrictMode the grid mounts twice, and its cleanup reads a controller its first pass had not
  // been told about yet, so the first registration survives the remount. Measured in Chrome 153
  // — two mutation observers on one `<tbody>`, the second re-animating every row about a
  // millisecond after the first, which cancelled every arriving row's slide before it had moved.
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    const rows = rowsRef.current;
    if (rows === null) return;
    const motion = autoAnimate(rows, rowMotion());
    return () => motion.destroy?.();
  }, []);

  // The edge shadow is the sign that there is more to see, so it must not show when there is
  // nothing (FR6-AC3/AC4). Written straight to the DOM rather than held in state: scrolling
  // must not re-render 44 rows, and the stylesheet is what decides what the flag looks like.
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

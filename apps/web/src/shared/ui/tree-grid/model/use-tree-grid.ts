import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { treeGridIds } from './ids';
import { reduceKey } from './keyboard';
import { ROW_COL_INDEX, type TreeGridCursor, type TreeGridRow } from './types';

export type UseTreeGridOptions = {
  /** The same id given to `<TreeGrid>`: both sides name elements through `treeGridIds` (D-11). */
  id: string;
  /** The rows that are showing, in the order they are shown. */
  rows: readonly TreeGridRow[];
  /** How many figure columns follow the name column. */
  columnCount: number;
  expandedIds: ReadonlySet<string>;
  /** Opens or closes that row. The caller owns the state; the grid only asks (D-6). */
  onToggle: (id: string) => void;
};

export type TreeGridApi = {
  /** Where the outline is. One value for both modes: `colIndex -1` is the row's own name. */
  cursor: TreeGridCursor;
  /**
   * The one prop a `memo`'d row needs, and the whole of the roving `tabindex`: `null` for every
   * row but the cursor's, so a keystroke changes the props of exactly two rows (D-9).
   */
  activeColIndexOf: (rowId: string) => number | null;
  /** Opens or closes a row, remembering which — a collapse may have to recover from it (D-10). */
  toggle: (id: string) => void;
  /** For the `<table>`: the keyboard model of FR3, attached once and stable for its lifetime. */
  gridProps: {
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
  };
};

/**
 * The cursor, and everything that follows from moving it: which element is the grid's single
 * tab stop, which element has focus, and how far the scroller must move to show it.
 *
 * Deliberately not here: which rows are open. Flattening needs those ids *before* the grid
 * renders, so they belong to the caller (D-6) — this hook is told, and asks to be told again.
 */
export const useTreeGrid = ({
  id,
  rows,
  columnCount,
  expandedIds,
  onToggle,
}: UseTreeGridOptions): TreeGridApi => {
  const ids = useMemo(() => treeGridIds(id), [id]);

  const [cursor, setCursor] = useState<TreeGridCursor>(() => ({
    rowId: rows[0]?.id ?? '',
    colIndex: ROW_COL_INDEX,
  }));

  // Read by handlers that must never be rebuilt: a fresh `onKeyDown` each render would change
  // a prop on every row and undo D-9. Written after the commit, so render stays pure.
  const latest = useRef({ rows, columnCount, expandedIds, onToggle, cursor });
  useLayoutEffect(() => {
    latest.current = { rows, columnCount, expandedIds, onToggle, cursor };
  });

  // Which row was last asked to open or close. State rather than a ref because it is read
  // while rendering, by the recovery below — the one thing that has to know where the outline
  // should land when its own row has just gone.
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  // Mounting the table must not steal focus, or the page jumps to it on load. Nothing is
  // focused until the user has asked for something.
  const hasMovedRef = useRef(false);

  // FR2's focus recovery (D-10). Closing a row can take the row the outline is on with it —
  // by mouse, which is exactly when the user is not watching the keyboard — and a keyboard user
  // must never be left with nothing selected. Corrected here, during render, so the focus
  // effect below runs once against the cursor that survives rather than twice.
  const firstRow = rows[0];
  if (firstRow !== undefined && !rows.some((row) => row.id === cursor.rowId)) {
    const closed = lastToggled !== null && rows.some((row) => row.id === lastToggled);
    setCursor({ rowId: closed ? lastToggled : firstRow.id, colIndex: ROW_COL_INDEX });
  }

  // D-7, measured: Blink's own focus-scroll path ignores `scroll-padding`, so it oscillates and
  // drops cells under the sticky name column. Take the scrolling away from focus and ask for it
  // explicitly — `nearest` does nothing at all while the cell is already in view, which is what
  // "the page does not move" means (FR3-AC14), and the least it can while it is not (AC15).
  useLayoutEffect(() => {
    if (!hasMovedRef.current) return;
    // A row that has just been closed away is still in the DOM for a moment (D-8); the cursor
    // is about to be moved off it by the correction above, so leave it where it is until then.
    if (!rows.some((row) => row.id === cursor.rowId)) return;
    const target = document.getElementById(ids.cellId(cursor.rowId, cursor.colIndex));
    if (target === null) return;
    // Focus that arrived on its own — a script, an assistive technology — has already been placed
    // and scrolled by the browser; the cursor has only caught up with it (see `handleFocus`).
    if (target === document.activeElement) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    // D-7 measured that the one `scroll-padding-inline-start` line lands every figure flush
    // with the sticky name column, never under it. Re-measured at 375 in Chrome 153 on
    // 2026-09-22, after D-17 widened a month column from 72 px to 88: the column is now wider
    // than the 79 px of scrollport the 264 px name column leaves (343 − 264), and walking
    // *left* Blink then aligns the cell's end edge rather than its start — `cellLeft 271`
    // against a sticky edge at 280. At 72 px it fitted, so the original measurement was right
    // when it was taken. CSSOM-View says `nearest` aligns the *start* edge when the target
    // cannot fit, so asking for `start` here restores the specified behaviour rather than
    // inventing one; it is asked for only once the cell has actually landed under the column,
    // so `nearest` still does nothing whenever nothing is needed, and no `scrollLeft`
    // arithmetic is involved (D-7 rejected that, and rightly).
    if (cursor.colIndex === ROW_COL_INDEX) return;
    const stickyEdge = target.closest('tr')?.querySelector('th')?.getBoundingClientRect().right;
    if (stickyEdge !== undefined && target.getBoundingClientRect().left < stickyEdge) {
      target.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [cursor, rows, ids]);

  const toggle = useCallback((rowId: string) => {
    setLastToggled(rowId);
    latest.current.onToggle(rowId);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const current = latest.current;
    const result = reduceKey(
      current.cursor,
      event.key,
      current.rows,
      current.expandedIds,
      current.columnCount,
    );
    if (result === null) return;

    // The grid owns this key from here, even where the outline does not move: an arrow left to
    // the browser would scroll the months under a stationary outline, and Space would scroll
    // the page (FR3-AC9/AC10).
    event.preventDefault();
    hasMovedRef.current = true;

    if ('toggle' in result) {
      setLastToggled(result.toggle);
      current.onToggle(result.toggle);
      return;
    }

    const { cursor: next } = result;
    setCursor((previous) =>
      previous.rowId === next.rowId && previous.colIndex === next.colIndex ? previous : next,
    );
  }, []);

  // The defence behind the rows' `mousedown` guard (code review F1): focus can still reach an
  // element of the grid by means other than its own keys — a script, an assistive technology
  // moving focus — and the next key must act on what has focus, never on a cursor the user
  // cannot see. So the cursor follows focus. Rows on their way out (D-8) are
  // `inert` and cannot take focus; one that is no longer in `rows` is ignored all the same.
  const handleFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.target;
    const rowId = target.closest('tr')?.dataset.rowId;
    if (rowId === undefined) return;
    const colIndex =
      target instanceof HTMLTableRowElement ? ROW_COL_INDEX : Number(target.dataset.colIndex);
    if (Number.isNaN(colIndex)) return;
    if (!latest.current.rows.some((row) => row.id === rowId)) return;

    hasMovedRef.current = true;
    setCursor((previous) =>
      previous.rowId === rowId && previous.colIndex === colIndex ? previous : { rowId, colIndex },
    );
  }, []);

  const activeColIndexOf = useCallback(
    (rowId: string) => (rowId === cursor.rowId ? cursor.colIndex : null),
    [cursor],
  );

  const gridProps = useMemo(
    () => ({ onKeyDown: handleKeyDown, onFocus: handleFocus }),
    [handleKeyDown, handleFocus],
  );

  return { cursor, activeColIndexOf, toggle, gridProps };
};

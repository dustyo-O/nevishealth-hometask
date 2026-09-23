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
import { useFocusCursor } from './use-focus-cursor';
import { useRevealOnOpen } from './use-reveal-on-open';

export type UseTreeGridOptions = {
  /** Names every element through `treeGridIds` (D-11); handed on to `<TreeGrid>` by `gridProps`. */
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
  /**
   * Spread on `<TreeGrid>`: the id and column count this hook was given — so the two can never
   * disagree, which would leave focus silently stuck — and the keyboard model of FR3, attached
   * once and stable for its lifetime.
   */
  gridProps: {
    id: string;
    columnCount: number;
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
  // effect runs once against the cursor that survives rather than twice.
  const firstRow = rows[0];
  if (firstRow !== undefined && !rows.some((row) => row.id === cursor.rowId)) {
    const closed = lastToggled !== null && rows.some((row) => row.id === lastToggled);
    setCursor({ rowId: closed ? lastToggled : firstRow.id, colIndex: ROW_COL_INDEX });
  }

  // Layout-effect order is load-bearing: focus and its scroll run before an opening's reveal
  // scroll, so the reveal has the last word on where the page comes to rest.
  useFocusCursor(ids, cursor, rows, hasMovedRef);
  const markOpening = useRevealOnOpen(ids, rows, expandedIds);

  const toggle = useCallback(
    (rowId: string) => {
      // Whether this opens the row (to be revealed) or closes it (to be left alone).
      markOpening(latest.current.expandedIds.has(rowId) ? null : rowId);
      setLastToggled(rowId);
      latest.current.onToggle(rowId);
    },
    [markOpening],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const current = latest.current;
      const result = reduceKey(current.cursor, event.key, current.rows, current.columnCount);
      if (result === null) return;

      // The grid owns this key from here, even where the outline does not move: an arrow left to
      // the browser would scroll the figures under a stationary outline, and Space would scroll
      // the page (FR3-AC9/AC10).
      event.preventDefault();
      hasMovedRef.current = true;

      if ('toggle' in result) {
        toggle(result.toggle);
        return;
      }

      const { cursor: next } = result;
      setCursor((previous) =>
        previous.rowId === next.rowId && previous.colIndex === next.colIndex ? previous : next,
      );
    },
    [toggle],
  );

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
    () => ({ id, columnCount, onKeyDown: handleKeyDown, onFocus: handleFocus }),
    [id, columnCount, handleKeyDown, handleFocus],
  );

  return { cursor, activeColIndexOf, toggle, gridProps };
};

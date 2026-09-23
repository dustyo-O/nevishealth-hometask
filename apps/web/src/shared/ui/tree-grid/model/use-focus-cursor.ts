import { useLayoutEffect, type RefObject } from 'react';
import type { TreeGridIds } from './ids';
import { ROW_COL_INDEX, type TreeGridCursor, type TreeGridRow } from './types';

/**
 * Puts focus where the cursor is, and scrolls just enough to show it.
 *
 * D-7, measured: Blink's own focus-scroll path ignores `scroll-padding`, so it oscillates and
 * drops cells under the sticky name column. Take the scrolling away from focus and ask for it
 * explicitly — `nearest` does nothing at all while the cell is already in view, which is what
 * "the page does not move" means (FR3-AC14), and the least it can while it is not (AC15).
 *
 * `hasMovedRef` stays `false` until the user has asked for something: mounting the table must
 * not steal focus, or the page jumps to it on load.
 */
export const useFocusCursor = (
  ids: TreeGridIds,
  cursor: TreeGridCursor,
  rows: readonly TreeGridRow[],
  hasMovedRef: RefObject<boolean>,
): void => {
  useLayoutEffect(() => {
    if (!hasMovedRef.current) return;
    // A row that has just been closed away is still in the DOM for a moment (D-8); the cursor
    // is about to be moved off it by the hook's recovery, so leave it where it is until then.
    if (!rows.some((row) => row.id === cursor.rowId)) return;
    const target = document.getElementById(ids.cellId(cursor.rowId, cursor.colIndex));
    if (target === null) return;
    // Focus that arrived on its own — a script, an assistive technology — has already been placed
    // and scrolled by the browser; the cursor has only caught up with it (see `handleFocus`).
    if (target === document.activeElement) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    // A figure column wider than the scrollport the sticky name column leaves: walking left,
    // Blink aligns the cell's end edge under the column rather than its start. CSSOM-View says
    // `nearest` aligns the *start* edge when the target cannot fit, so `start` is asked for —
    // only once the cell has actually landed under the column, and with no `scrollLeft`
    // arithmetic (D-7 rejected that).
    if (cursor.colIndex === ROW_COL_INDEX) return;
    const stickyEdge = target.closest('tr')?.querySelector('th')?.getBoundingClientRect().right;
    if (stickyEdge !== undefined && target.getBoundingClientRect().left < stickyEdge) {
      target.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [cursor, rows, ids, hasMovedRef]);
};

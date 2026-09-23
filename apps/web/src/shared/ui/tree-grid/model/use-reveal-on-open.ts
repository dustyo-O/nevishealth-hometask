import { useCallback, useLayoutEffect, useRef } from 'react';
import type { TreeGridIds } from './ids';
import { revealRows } from './reveal';
import { ROW_COL_INDEX, type TreeGridRow } from './types';

/**
 * FR2, amended: opening a row low on the screen would leave what it revealed below the fold,
 * where the user cannot see what their click did. Which row was just *opened* is kept until the
 * render that shows its new rows has committed, then scrolled into view with them.
 *
 * `markOpening(id)` before asking for a row to open; `markOpening(null)` before closing one —
 * closing scrolls nothing.
 */
export const useRevealOnOpen = (
  ids: TreeGridIds,
  rows: readonly TreeGridRow[],
  expandedIds: ReadonlySet<string>,
): ((id: string | null) => void) => {
  const openingRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const openedId = openingRef.current;
    if (openedId === null) return;
    openingRef.current = null;
    if (!expandedIds.has(openedId)) return;
    const index = rows.findIndex((row) => row.id === openedId);
    const opened = rows[index];
    if (opened === undefined) return;
    // What it revealed: every row after it that sits deeper, up to the first that does not.
    const end = rows.findIndex((row, at) => at > index && row.level <= opened.level);
    const revealed = rows.slice(index + 1, end === -1 ? undefined : end);

    const element = document.getElementById(ids.cellId(opened.id, ROW_COL_INDEX));
    if (element === null) return;
    revealRows(
      element,
      revealed.flatMap((row) => document.getElementById(ids.cellId(row.id, ROW_COL_INDEX)) ?? []),
    );
  }, [rows, expandedIds, ids]);

  return useCallback((id: string | null) => {
    openingRef.current = id;
  }, []);
};

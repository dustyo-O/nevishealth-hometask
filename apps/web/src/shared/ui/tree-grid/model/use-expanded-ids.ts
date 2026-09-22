import { useCallback, useState } from 'react';
import type { TreeGridRow } from './types';

export type UseExpandedIds = {
  /** The ids whose children are showing. A new `Set` whenever it changes, never mutated. */
  expandedIds: ReadonlySet<string>;
  /**
   * Opens a closed row, closes an open one. `rows` is the flattened list the grid is currently
   * rendering, which is all a closing row needs: an expanded descendant is visible by
   * definition, since every ancestor above it is open too.
   */
  toggle: (id: string, rows: readonly TreeGridRow[]) => void;
};

/**
 * Every id below `id`, found in one forward pass because a flattened list is depth-first: a
 * parent always precedes its children, so by the time a row is read its parent is either the
 * row we are closing or already known to sit beneath it.
 */
const descendantsOf = (id: string, rows: readonly TreeGridRow[]): ReadonlySet<string> => {
  const found = new Set<string>();
  for (const row of rows) {
    if (row.parentId !== null && (row.parentId === id || found.has(row.parentId))) {
      found.add(row.id);
    }
  }
  return found;
};

/**
 * Which rows are open, held outside the grid on purpose: flattening needs the ids *before* the
 * grid renders, so a hook owning them privately could not work — the caller holds the value and
 * passes it down (D-6).
 *
 * Closing a row prunes the ids beneath it, so re-opening a branch shows its own children closed
 * rather than however the user last left them (FR2-AC3). Rows beside it keep their state:
 * opening one branch never closes another (FR2-AC4).
 *
 * `initial` is read once, like `useState`'s initialiser — the seed is where the table starts,
 * not something that reopens what the user has since closed.
 */
export const useExpandedIds = (initial: () => Iterable<string>): UseExpandedIds => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(initial()));

  const toggle = useCallback((id: string, rows: readonly TreeGridRow[]) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
        return next;
      }
      for (const descendant of descendantsOf(id, rows)) next.delete(descendant);
      return next;
    });
  }, []);

  return { expandedIds, toggle };
};

/**
 * One row of a tree grid, already flattened out of whatever tree the caller holds: the grid
 * renders a list, never a tree. Everything here is a tree concept — nothing in this layer knows
 * what the rows describe (architecture §6).
 */
export type TreeGridRow = {
  id: string;
  /** `null` for a root row — there is nothing above it to move to. */
  parentId: string | null;
  /** 1-based depth, exactly as `aria-level` counts it. */
  level: number;
  /** 1-based position among the rows sharing this parent (`aria-posinset`). */
  posInSet: number;
  /** How many rows share this parent (`aria-setsize`). */
  setSize: number;
  /**
   * False for a leaf. A leaf carries no `aria-expanded` at all, so a screen reader reports no
   * open-or-closed state for it (FR4-AC5).
   */
  hasChildren: boolean;
};

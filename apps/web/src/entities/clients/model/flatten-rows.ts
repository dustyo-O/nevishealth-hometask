import { childrenOf, type TreeNode } from '@nevis/contracts';
// A type-only import from a lower layer, so legal under FSD: the rows exist to be tree-grid rows,
// and naming that type keeps the two in step. No component or DOM crosses into the entity.
import type { TreeGridRow } from '@/shared/ui/tree-grid';

/**
 * What each level of the company tree is called. The kind is a business fact about the data, so
 * it is settled here once — not guessed from `level === 3` wherever a row is rendered. The
 * contract nests branches → employees → channels, so level 4 is the deepest the shipped shape
 * reaches; anything deeper keeps the last name rather than inventing one.
 */
const KINDS = ['company', 'branch', 'adviser', 'channel'] as const;

export type ClientKind = (typeof KINDS)[number];

const kindAtLevel = (level: number): ClientKind =>
  KINDS[Math.min(level, KINDS.length) - 1] ?? 'channel';

/** A tree-grid row plus what the clients table needs to draw it. */
export type ClientRow = TreeGridRow & {
  kind: ClientKind;
  name: string;
  /** The figures as the service recorded them — never recalculated from the rows beneath (FR1). */
  values: readonly number[];
};

/**
 * One depth-first walk over `childrenOf` (the contract's single definition of "children"),
 * producing exactly the rows that are on screen: a node's children follow it only while its id
 * is in `expandedIds`. `level`, `posInSet` and `setSize` are 1-based, as the ARIA attributes
 * they become are counted; `hasChildren` is false for a missing *or* empty child list, so both
 * kinds of leaf offer nothing to open (FR1-AC4).
 */
export const flattenVisibleRows = (
  company: TreeNode,
  expandedIds: ReadonlySet<string>,
): ClientRow[] => {
  const rows: ClientRow[] = [];

  const walk = (siblings: readonly TreeNode[], parentId: string | null, level: number): void => {
    siblings.forEach((node, index) => {
      const children = childrenOf(node);
      const hasChildren = children.length > 0;
      rows.push({
        id: node.id,
        parentId,
        level,
        posInSet: index + 1,
        setSize: siblings.length,
        hasChildren,
        kind: kindAtLevel(level),
        name: node.name,
        values: node.values,
      });
      if (hasChildren && expandedIds.has(node.id)) walk(children, node.id, level + 1);
    });
  };

  walk([company], null, 1);
  return rows;
};

import { Logger, type LoggerService } from '@nestjs/common';
import { CHILD_KEYS, childrenOf, MONTHS, type Month, type TreeNode } from '@nevis/contracts';

/** One parent whose monthly figure is not the sum of its children's (spec 001 FR2). */
export type Discrepancy = {
  /** Names from the root, e.g. `['Company', 'Branch 1', 'Anna Blackwood']`. */
  path: string[];
  month: Month;
  /** What the figure should be: the children's sum for that month. */
  expected: number;
  /** The parent's own figure for that month. */
  actual: number;
};

/** A missing figure never equals a sum, so a short `values` list surfaces instead of hiding as 0. */
const figureAt = (node: TreeNode, month: number): number => node.values[month] ?? Number.NaN;

/**
 * Depth-first over `childrenOf` — a leaf (no or empty child list) has nothing to add up.
 * Figures are integers today, so the comparison is exact (tech doc §2.3).
 * Pure: never throws, never mutates the tree.
 */
export const findDiscrepancies = (company: TreeNode): Discrepancy[] => {
  const found: Discrepancy[] = [];

  const visit = (node: TreeNode, ancestors: string[]): void => {
    const path = [...ancestors, node.name];
    const children = childrenOf(node);
    if (children.length === 0) return;

    for (const [i, month] of MONTHS.entries()) {
      const expected = children.reduce((sum, child) => sum + figureAt(child, i), 0);
      const actual = figureAt(node, i);
      if (actual !== expected) found.push({ path, month, expected, actual });
    }
    for (const child of children) visit(child, path);
  };

  visit(company, []);
  return found;
};

/** Every item in the tree, whichever list it hangs from — for the boot summary line. */
export const countNodes = (node: TreeNode): number =>
  1 + CHILD_KEYS.reduce((sum, key) => sum + (node[key] ?? []).reduce((s, c) => s + countNodes(c), 0), 0);

/** The documented warning line: `"Company > Branch 1 > Anna Blackwood" 2024-04: parent 28, children sum 33`. */
export const formatDiscrepancy = ({ path, month, expected, actual }: Discrepancy): string =>
  `"${path.join(' > ')}" ${month}: parent ${actual}, children sum ${expected}`;

export type ConsistencyLogger = Pick<LoggerService, 'warn' | 'log'>;

/**
 * The boot report: one `warn` per discrepancy, then one `log` with the count — the data is served
 * either way (refusing it is Phase 2's guard). Strings only: Nest 12 treats a trailing object as
 * structured params.
 */
export const reportDiscrepancies = (
  company: TreeNode,
  logger: ConsistencyLogger = new Logger('ConsistencyCheck'),
): Discrepancy[] => {
  const discrepancies = findDiscrepancies(company);
  for (const discrepancy of discrepancies) logger.warn(formatDiscrepancy(discrepancy));
  const count = discrepancies.length;
  logger.log(
    `Checked ${countNodes(company)} nodes: ${count} ${count === 1 ? 'discrepancy' : 'discrepancies'}`,
  );
  return discrepancies;
};

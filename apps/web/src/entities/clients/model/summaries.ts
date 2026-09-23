import type { TreeNode } from '@nevis/contracts';

const MIDDLE_DOT = '\u00B7';

const count = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`;

/**
 * The table card's honest placeholder until spec 002: `"Company · 3 branches"` (FR5-AC1–3);
 * one branch reads "1 branch" (tech doc D-12).
 */
export const formatBranchCount = (company: TreeNode): string =>
  `${company.name} ${MIDDLE_DOT} ${count(company.branches?.length ?? 0, 'branch', 'branches')}`;

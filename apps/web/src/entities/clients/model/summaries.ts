import type { TreeNode } from '@nevis/contracts';
import { formatMonth } from './format-month';

const MIDDLE_DOT = '\u00B7';
const EN_DASH = '\u2013';

const count = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`;

/**
 * The chart card's honest placeholder until spec 003: `"12 months · Feb 2024 – Jan 2025"`
 * (U+00B7 middle dot, U+2013 en dash — FR5-AC1). Computed from the loaded months, never typed in.
 */
export const formatPeriod = (months: readonly string[]): string => {
  const first = months[0];
  const last = months[months.length - 1];
  const total = count(months.length, 'month', 'months');
  if (first === undefined || last === undefined) return total;
  return `${total} ${MIDDLE_DOT} ${formatMonth(first)} ${EN_DASH} ${formatMonth(last)}`;
};

/**
 * The table card's honest placeholder until spec 002: `"Company · 3 branches"` (FR5-AC1–3);
 * one branch reads "1 branch" (tech doc D-12).
 */
export const formatBranchCount = (company: TreeNode): string =>
  `${company.name} ${MIDDLE_DOT} ${count(company.branches?.length ?? 0, 'branch', 'branches')}`;

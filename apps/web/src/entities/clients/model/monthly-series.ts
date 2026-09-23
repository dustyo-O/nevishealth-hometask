import { childrenOf, type TreeNode } from '@nevis/contracts';
import type { ClientsData } from './types';

/** One month of the company, split by acquisition channel. */
export type MonthlyPoint = {
  /** ISO year-month as served, e.g. `"2024-02"`. */
  month: string;
  /** The company's figure for each channel, keyed by the channel's name. */
  byChannel: Readonly<Record<string, number>>;
  /** The sum of `byChannel`: every client the data attributes to a channel that month. */
  total: number;
  /**
   * The Company row's own figure for the month, as served (004 §2.3). Not recalculated and not
   * reconciled with `total`: where the channels account for only part of the company, the two
   * differ, and saying what to draw for the difference is the widget's business, not the data's.
   */
  company: number;
};

export type MonthlySeries = {
  /** Channel names in first-seen order: the chart's bottom-up stacking order (FR1). */
  channels: readonly string[];
  /** One point per served month, in the order served. */
  points: readonly MonthlyPoint[];
};

/** Every channel node in the tree; an adviser with no channel list contributes nothing. */
const channelNodes = (node: TreeNode): TreeNode[] =>
  node.channels ?? childrenOf(node).flatMap(channelNodes);

/**
 * The company's twelve months split by acquisition channel (003 §2.1): every adviser's figure
 * for a channel, added together. Grouped by channel **name** — a channel's `id` is unique per
 * adviser (the shipped data holds 30 of them), so only the name says "New organic" across
 * advisers. Pure: no DOM and no charting library; the widget decides colours and drawing.
 */
export const toMonthlySeries = ({ months, company }: ClientsData): MonthlySeries => {
  const totals = new Map<string, number[]>();
  for (const channel of channelNodes(company)) {
    const sums = totals.get(channel.name) ?? months.map(() => 0);
    months.forEach((_, i) => {
      sums[i] = (sums[i] ?? 0) + (channel.values[i] ?? 0);
    });
    totals.set(channel.name, sums);
  }
  const channels = [...totals.keys()];
  const points = months.map((month, i) => {
    const byChannel = Object.fromEntries(
      channels.map((name) => [name, totals.get(name)?.[i] ?? 0]),
    );
    const total = Object.values(byChannel).reduce((sum, value) => sum + value, 0);
    return { month, byChannel, total, company: company.values[i] ?? 0 };
  });
  return { channels, points };
};

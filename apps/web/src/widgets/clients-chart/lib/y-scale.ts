import type { MonthlySeries } from '@/entities/clients';

/** The axis is labelled in equal steps of one hundred clients (FR2). */
const STEP = 100;

export type YScale = {
  /** The scale's top: the first step strictly above the largest month. */
  top: number;
  /** Every labelled step from 0 to `top` inclusive, handed to the axis as-is. */
  ticks: readonly number[];
};

/**
 * The y-axis, computed from the figures shown rather than fixed (003 §2.3). The top is the first
 * step **strictly above** the largest month, so the tallest bar never touches the ceiling: 350 →
 * 400, and 400 → 500 (tech review F5). An empty or all-zero series still gets one step. The
 * charting library's own "nice" ticks give 0/90/…/360 for this data, so the ticks are ours.
 */
export const yScale = ({ points }: MonthlySeries, step = STEP): YScale => {
  const max = Math.max(0, ...points.map((point) => point.total));
  const top = (Math.floor(max / step) + 1) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return { top, ticks };
};

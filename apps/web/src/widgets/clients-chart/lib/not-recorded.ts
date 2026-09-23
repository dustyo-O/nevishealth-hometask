import type { MonthlySeries } from '@/entities/clients';

/** The part of each bar the data attributes to no channel (004 FR3). A label, not a channel. */
export const NOT_RECORDED = 'Not recorded';

export type NotRecorded = {
  /** Per month: the company's own figure less every recorded channel, never below 0. */
  values: readonly number[];
  /** Whether the chart shows the segment at all — decided once for the whole series. */
  shown: boolean;
};

/**
 * The clients nobody attributed to a channel (004 §2.3). A month whose channels come to more
 * than the company's figure has nothing left over and reads 0, not a negative (spec review F1).
 * `shown` is one decision across every month, never per month, so the legend cannot change as
 * the pointer moves (FR4, spec review F2). Pure: no charting library, no DOM.
 */
export const notRecorded = ({ points }: MonthlySeries): NotRecorded => {
  const values = points.map((point) => Math.max(0, point.company - point.total));
  return { values, shown: values.some((value) => value > 0) };
};

/**
 * The series as the chart draws it: when anything is unrecorded, "Not recorded" becomes the
 * first part of every month — the base of the stack — zero included, and each month's total
 * counts it, so a bar is as tall as its Company row (FR3) or, where the channels overshoot, as
 * tall as they come to. When nothing is, the series is returned untouched: the drawing, the
 * legend, the panel, the hidden table and the announcement all read this one series, so they
 * all follow the one `shown` flag (FR4–FR6).
 */
export const withNotRecorded = (series: MonthlySeries): MonthlySeries => {
  const { values, shown } = notRecorded(series);
  if (!shown) return series;
  return {
    channels: [NOT_RECORDED, ...series.channels],
    points: series.points.map((point, i) => {
      const value = values[i] ?? 0;
      return {
        ...point,
        byChannel: { [NOT_RECORDED]: value, ...point.byChannel },
        total: point.total + value,
      };
    }),
  };
};

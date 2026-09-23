import type { MonthlySeries } from '@/entities/clients';
import { EXISTING } from './existing-clients';
import { PLOT_HEIGHT, PLOT_MARGIN, X_AXIS_HEIGHT } from './plot-geometry';
import { yScale, type YScale } from './y-scale';

/**
 * A month as it is **drawn**, never as it is read. It has no `byChannel` and no `total` on
 * purpose: the panel, the hidden table and the announcement take a `MonthlySeries`, and this
 * cannot be handed to them — nor can the true series be handed to the drawing. Keep the two
 * shapes different; merging them is how a lifted figure ends up read aloud (004 FR4-AC4).
 */
export type DrawnBar = {
  month: string;
  /** Each part's drawn height, in clients: lifted to the floor, or the figure where untouched. */
  heights: Readonly<Record<string, number>>;
};

export type DrawnSeries = {
  channels: readonly string[];
  bars: readonly DrawnBar[];
  /** The scale the floor was worked out against, from the true totals. */
  scale: YScale;
};

/** The least a part with clients in it is drawn (004 FR4). */
export const MIN_PART_PX = 4;

/** How tall the scale's full domain is drawn: the plot box less its top margin and month labels. */
export const BARS_HEIGHT = PLOT_HEIGHT - PLOT_MARGIN.top - PLOT_MARGIN.bottom - X_AXIS_HEIGHT;

/**
 * The floor in clients, as a share of the scale's domain: four pixels of `BARS_HEIGHT`, whatever
 * the top of the scale reads (§2.4). 400 → 5.28 clients.
 */
export const floorFor = (top: number): number => (top * MIN_PART_PX) / BARS_HEIGHT;

/**
 * The series the bars are built from (004 §2.4). Every part with clients in it, other than
 * Existing clients, is lifted to the floor, and what that adds is **taken from Existing clients**
 * in the same bar — so the stack's offsets follow the lifted parts and nothing is covered, and
 * each bar's total is still exactly its figure. A month with no newly acquired clients is drawn
 * exactly to its figures. Where Existing clients could not pay without falling below the floor
 * itself (or below zero), the floor gives way and the month is drawn to its figures.
 *
 * Only the drawing reads this. The figures a person reads stay in the `MonthlySeries` it came
 * from, which is left untouched. Pure: no charting library, no DOM.
 */
export const toDrawing = (series: MonthlySeries, floorOf = floorFor): DrawnSeries => {
  const scale = yScale(series);
  const floor = floorOf(scale.top);
  const bars = series.points.map(({ month, byChannel }): DrawnBar => {
    const heights: Record<string, number> = {};
    for (const name of series.channels) heights[name] = byChannel[name] ?? 0;
    let borrowed = 0;
    for (const name of series.channels) {
      const value = heights[name] ?? 0;
      if (name === EXISTING || value <= 0 || value >= floor) continue;
      borrowed += floor - value;
      heights[name] = floor;
    }
    const existing = byChannel[EXISTING] ?? 0;
    if (borrowed === 0) return { month, heights };
    if (existing - borrowed < floor) return { month, heights: { ...byChannel } };
    heights[EXISTING] = existing - borrowed;
    return { month, heights };
  });
  return { channels: series.channels, bars, scale };
};

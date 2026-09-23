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
  /** Each part's drawn height, in clients: lifted onto the curve, or the figure where untouched. */
  heights: Readonly<Record<string, number>>;
};

export type DrawnSeries = {
  channels: readonly string[];
  bars: readonly DrawnBar[];
  /** The scale the curve was worked out against, from the true totals. */
  scale: YScale;
};

/**
 * How far the curve lifts a small part, in pixels: `LIFT_PX × log2(clients + 1)` (004 FR4). That
 * is nothing at zero clients, 4 px at one, 6.34 at two, 8 at three, and tails off.
 */
export const LIFT_PX = 4;

/** How tall the scale's full domain is drawn: the plot box less its top margin and month labels. */
export const BARS_HEIGHT = PLOT_HEIGHT - PLOT_MARGIN.top - PLOT_MARGIN.bottom - X_AXIS_HEIGHT;

/** Pixels per client on a scale whose top reads `top`: the lift is pixels, not clients (§2.4). */
export const pxPerClientFor = (top: number): number => BARS_HEIGHT / top;

/**
 * A part's drawn height in pixels: its true height, or the curve where that is taller. The `max`
 * is the point — the curve only ever **lifts**; above about 24 clients the true height wins and
 * the curve stops applying. The ratio between parts is deliberately not linear: two clients look
 * about one and a half times one, so that a month with new clients can be told from one without.
 */
export const drawnPx = (clients: number, pxPerClient: number): number =>
  Math.max(clients * pxPerClient, LIFT_PX * Math.log2(clients + 1));

/**
 * The series the bars are built from (004 §2.4). Every part with clients in it, other than
 * Existing clients, is lifted onto the curve (`drawnPx`), and what that adds is **taken from
 * Existing clients** in the same bar — so the stack's offsets follow the lifted parts and nothing
 * is covered, and each bar's total is still exactly its figure. A month with no newly acquired
 * clients is drawn exactly to its figures. Where Existing clients could not pay without falling
 * below its own curve (or below zero), the lift gives way and the month is drawn to its figures.
 *
 * Only the drawing reads this. The figures a person reads stay in the `MonthlySeries` it came
 * from, which is left untouched. Pure: no charting library, no DOM.
 */
export const toDrawing = (series: MonthlySeries): DrawnSeries => {
  const scale = yScale(series);
  const px = pxPerClientFor(scale.top);
  /** A part's drawn height, converted back to clients: what the stack is built from. */
  const lifted = (clients: number) => drawnPx(clients, px) / px;
  const bars = series.points.map(({ month, byChannel }): DrawnBar => {
    const heights: Record<string, number> = {};
    for (const name of series.channels) heights[name] = byChannel[name] ?? 0;
    let borrowed = 0;
    for (const name of series.channels) {
      const value = heights[name] ?? 0;
      if (name === EXISTING || value <= 0) continue;
      const height = lifted(value);
      borrowed += height - value;
      heights[name] = height;
    }
    const existing = byChannel[EXISTING] ?? 0;
    if (borrowed === 0) return { month, heights };
    if (existing - borrowed < (LIFT_PX * Math.log2(existing + 1)) / px) {
      return { month, heights: { ...byChannel } };
    }
    heights[EXISTING] = existing - borrowed;
    return { month, heights };
  });
  return { channels: series.channels, bars, scale };
};

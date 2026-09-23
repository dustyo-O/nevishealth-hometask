/**
 * Where the drawing puts its months, in the plot box's own pixels. The drawing is laid out from
 * these numbers, and the tint, the panel and the pointer read them back — so a month's column is
 * one piece of arithmetic, not the library's hover state (003 §2.7, tech review F1).
 */
export const PLOT_MARGIN = { top: 5, right: 16, bottom: 0, left: 0 } as const;
export const Y_AXIS_WIDTH = 32;
/** Fixed, so the plot keeps its height whichever way the month labels are drawn (FR8-AC3). */
export const X_AXIS_HEIGHT = 30;
/** The plot box's height: `--chart-plot-h`, the same at every width (003 §2.6). */
export const PLOT_HEIGHT = 338;

/** The months' columns start after the y-axis and end before the right margin. */
export const COLUMNS_LEFT = PLOT_MARGIN.left + Y_AXIS_WIDTH;
export const COLUMNS_RIGHT = PLOT_MARGIN.right;

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * The month whose column holds `point` — anywhere in the column, above its bar too (FR4) — or
 * `undefined` outside every column: the axis labels, the margins, beyond the box.
 */
export const monthAt = ({ x, y }: Point, { width, height }: Size, months: number) => {
  const top = PLOT_MARGIN.top;
  const bottom = height - PLOT_MARGIN.bottom - X_AXIS_HEIGHT;
  const left = COLUMNS_LEFT;
  const right = width - COLUMNS_RIGHT;
  if (months < 1 || right <= left || y < top || y > bottom || x < left || x >= right) {
    return undefined;
  }
  return Math.floor(((x - left) / (right - left)) * months);
};

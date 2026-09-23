import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatMonth, type MonthlyPoint, type MonthlySeries } from '@/entities/clients';
import { PLOT_MARGIN, X_AXIS_HEIGHT, Y_AXIS_WIDTH } from '../lib/plot-geometry';
import { yScale } from '../lib/y-scale';
import { channelColour } from '../model/channels';
import styles from './bar-plot.module.css';

/** A size to draw at before the container has been measured — jsdom never measures (003 R-5). */
export type PlotDimension = { width: number; height: number };

type BarPlotProps = {
  series: MonthlySeries;
  initialDimension?: PlotDimension | undefined;
};

/** Left at 0 so the plot starts exactly at the y-axis; right 16 or January's label clips (§2.5). */
const MARGIN = { ...PLOT_MARGIN };
const STACK = 'clients';
/**
 * The least a part with clients in it is drawn (004 FR4, §2.4): the newly acquired are 0–2 clients
 * a month, under two pixels to scale. The figures are untouched; only the drawing gives way.
 */
const MIN_PART_PX = 2;

/**
 * A function, so zero stays zero (FR4-AC2) — and keyed on the part's **own** figure, found by the
 * month's index. In a stack the library hands the callback the running top of the stack, not the
 * part (measured, recharts 3.10: February's New organic is called with 250 and would be drawn 2 px
 * tall at 0 clients), so the tech doc's `(value) => (value > 0 ? 2 : 0)` would draw every zero.
 */
const floorOf =
  (points: readonly MonthlyPoint[], name: string) =>
  (_top: number | null | undefined, index: number): number =>
    (points[index]?.byChannel[name] ?? 0) > 0 ? MIN_PART_PX : 0;

/** The design rounds the top of each bar only. */
const TOP_RADIUS: [number, number, number, number] = [2, 2, 0, 0];

/**
 * The drawing, and the only file that imports `recharts` (003 §2.1): a quirk of the library or a
 * future swap touches this file alone. It draws and nothing else — `accessibilityLayer` is off,
 * because the library's keyboard layer fails six of the spec's criteria and cannot be reset
 * (consult Q2); whatever a keyboard or a screen reader touches is the widget's own.
 *
 * Memoised: reading a month changes the widget's state, not the figures, and redrawing here
 * replaced the bar under the pointer with a new node on every hover (measured in Chromium).
 */
export const BarPlot = memo(function BarPlot({ series, initialDimension }: BarPlotProps) {
  const { ticks, top } = yScale(series);
  const topChannel = series.channels.at(-1);
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      className={styles.plot}
      {...(initialDimension && { initialDimension })}
    >
      <BarChart data={series.points} margin={MARGIN} accessibilityLayer={false}>
        {/* Horizontal dotted lines at each labelled step, and nothing between the months (FR2). */}
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          height={X_AXIS_HEIGHT}
          tickLine={false}
          axisLine={false}
        />
        {/* The library's own "nice" ticks read 0/90/…/360 for this data; ours read 0/100/…/400.
            `interval={0}` or it silently drops ticks it thinks collide (consult Q1). */}
        <YAxis
          ticks={[...ticks]}
          domain={[0, top]}
          interval={0}
          allowDecimals={false}
          width={Y_AXIS_WIDTH}
          tickLine={false}
          axisLine={false}
        />
        {/* Stacked bottom-up in the series' own order: Existing, then New organic, then New paid
            (004 FR3). */}
        {series.channels.map((name) => (
          <Bar
            key={name}
            name={name}
            dataKey={(point: MonthlyPoint) => point.byChannel[name] ?? 0}
            stackId={STACK}
            fill={channelColour(name)}
            minPointSize={floorOf(series.points, name)}
            {...(name === topChannel && { radius: TOP_RADIUS })}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
});

import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  formatMonth,
  readDevSwitches,
  toMonthlySeries,
  useClientsQuery,
  type MonthlySeries,
} from '@/entities/clients';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import { toDrawing } from '../lib/drawn-series';
import { withExistingClients } from '../lib/existing-clients';
import { COLUMNS_LEFT, COLUMNS_RIGHT, PLOT_MARGIN, X_AXIS_HEIGHT } from '../lib/plot-geometry';
import { useMonthReader } from '../model/use-month-reader';
import { BarPlot, type PlotDimension } from './bar-plot';
import { ChartDataTable } from './chart-data-table';
import { ChartLegend } from './chart-legend';
import styles from './clients-chart.module.css';
import { MonthPanel } from './month-panel';

export type ClientsChartProps = {
  /**
   * The size to draw at before the plot box has been measured. Only tests pass it: jsdom has no
   * `ResizeObserver`, so without it the drawing renders no SVG at all (003 R-5).
   */
  initialDimension?: PlotDimension;
};

const HINT = 'Use Left and Right to read each month.';

/** "Clients per month by acquisition channel, Feb 2024 to Jan 2025", from the months shown. */
const nameOf = ({ points }: MonthlySeries): string => {
  const first = points.at(0);
  const last = points.at(-1);
  const period = first && last ? `, ${formatMonth(first.month)} to ${formatMonth(last.month)}` : '';
  return `Clients per month by acquisition channel${period}`;
};

/**
 * Where the drawing puts its columns, handed to the stylesheet so the panel stands beside the
 * same column the library draws. Values from `plot-geometry`, which lays out the drawing too.
 */
const columnsOf = (months: number) =>
  ({
    '--months': months,
    '--columns-left': `${COLUMNS_LEFT}px`,
    '--columns-right': `${COLUMNS_RIGHT}px`,
    '--plot-top': `${PLOT_MARGIN.top}px`,
    '--plot-bottom': `${PLOT_MARGIN.bottom + X_AXIS_HEIGHT}px`,
  }) as CSSProperties;

/**
 * The upper card of the dashboard: the company's twelve months as stacked bars, one part per
 * acquisition channel, with the legend beneath (spec 003 FR1–FR3). Company-wide always — the
 * table's drill-down never reaches it.
 *
 * Recharts draws and the widget owns the semantics (003 §2.4): one focus stop named for what it
 * shows, Left and Right reading a month at a time into a polite live region, and the same
 * figures as a hidden table beside it (FR5, FR6).
 */
export const ClientsChart = ({ initialDimension }: ClientsChartProps) => {
  // Read once, like the page: changing a switch means changing the address, which reloads.
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const { data } = useClientsQuery(switches);
  // The page mounts the chart only once the figures are in the cache (`dashboard-page.tsx`).
  if (data === undefined) throw new Error('The clients chart was mounted before its figures');
  // Memoised so a refetch with the same figures hands the drawing the same series (FR7-AC1).
  // Existing clients is derived here, from the Company row less the newly acquired (004 §2.3).
  //
  // TWO SERIES, ON PURPOSE. `series` holds the figures: the legend, the panel, the hidden table
  // and the announcement read it, exactly. `drawing` is what the bars are built from: small parts
  // lifted to four pixels, Existing clients short by what they borrowed (004 FR4, §2.4). They are
  // different types so neither can be handed where the other belongs; do not merge them.
  const series = useMemo(() => withExistingClients(toMonthlySeries(data)), [data]);
  const drawing = useMemo(() => toDrawing(series), [series]);
  const { index, point, announcement, plotProps, drawingProps } = useMonthReader(series);
  const hintId = useId();
  const name = nameOf(series);
  const months = series.points.length;

  return (
    <div className={styles.chart}>
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
          A chart has no interactive ARIA role; a focusable named group that owns Left, Right and
          Escape is the specified structure (003 §2.4), measured with axe at zero violations. */}
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={name}
        aria-describedby={hintId}
        className={styles.plot}
        onFocus={plotProps.onFocus}
        onBlur={plotProps.onBlur}
        onKeyDown={plotProps.onKeyDown}
      >
        {/* The drawing carries no readable text of its own (FR6-AC4). */}
        <div
          aria-hidden="true"
          className={styles.drawing}
          style={columnsOf(months)}
          {...drawingProps}
        >
          {/* The tint is ours, placed from the widget's index: the library's cursor follows its
              own hover index, measured disagreeing with ours after hover-then-Tab (tech review
              F1). Before the drawing, so the bars paint over it. */}
          {point !== undefined && (
            <div
              data-month={point.month}
              className={styles.tint}
              style={{ '--month-index': index } as CSSProperties}
            />
          )}
          <BarPlot drawing={drawing} initialDimension={initialDimension} />
          {point !== undefined && (
            <MonthPanel point={point} channels={series.channels} index={index} months={months} />
          )}
        </div>
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      {/* Referenced as the group's description only; `hidden` keeps it out of reading order. */}
      <span id={hintId} hidden>
        {HINT}
      </span>
      {/* Polite, and empty while nothing is being read: one announcement per move (FR6-AC1/AC3). */}
      <VisuallyHidden as="p" role="status">
        {announcement}
      </VisuallyHidden>
      <ChartDataTable series={series} caption={name} />
      <ChartLegend channels={series.channels} className={styles.legend} />
    </div>
  );
};

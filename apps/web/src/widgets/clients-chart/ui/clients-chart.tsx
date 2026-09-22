import { useMemo, useState } from 'react';
import { readDevSwitches, toMonthlySeries, useClientsQuery } from '@/entities/clients';
import { BarPlot, type PlotDimension } from './bar-plot';
import { ChartLegend } from './chart-legend';
import styles from './clients-chart.module.css';

export type ClientsChartProps = {
  /**
   * The size to draw at before the plot box has been measured. Only tests pass it: jsdom has no
   * `ResizeObserver`, so without it the drawing renders no SVG at all (003 R-5).
   */
  initialDimension?: PlotDimension;
};

/**
 * The upper card of the dashboard: the company's twelve months as stacked bars, one part per
 * acquisition channel, with the legend beneath (spec 003 FR1–FR3). Company-wide always — the
 * table's drill-down never reaches it.
 */
export const ClientsChart = ({ initialDimension }: ClientsChartProps) => {
  // Read once, like the page: changing a switch means changing the address, which reloads.
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const { data } = useClientsQuery(switches);
  // Memoised so a refetch with the same figures hands the drawing the same series (FR7-AC1).
  const series = useMemo(() => (data === undefined ? undefined : toMonthlySeries(data)), [data]);

  // The page only mounts the chart once the figures are here; this is the belt to that braces.
  if (series === undefined) return null;
  return (
    <div className={styles.chart}>
      {/* The drawing carries no readable text of its own (FR6-AC4). */}
      <div aria-hidden="true" className={styles.plot}>
        <BarPlot series={series} initialDimension={initialDimension} />
      </div>
      <ChartLegend channels={series.channels} />
    </div>
  );
};

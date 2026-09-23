import type { CSSProperties } from 'react';
import { range } from '@/shared/lib/range';
import { Skeleton } from '@/shared/ui/skeleton';
import { PLOT_HEIGHT } from '../lib/plot-geometry';
import styles from './clients-chart-skeleton.module.css';

const TICKS = 5;
const MONTHS = 12;
const SERIES = 3;
const PLOT_BOX = { '--plot-height': `${PLOT_HEIGHT}px` } as CSSProperties;

/**
 * Grey blocks where the chart's y-axis, the twelve monthly bars, the month labels and the legend
 * will be (design Mockup 2). Its plot area takes the chart's own `PLOT_HEIGHT` and the same
 * padding, so the card measures the same while loading and once loaded (spec 001 FR3-AC2).
 */
export const ClientsChartSkeleton = () => (
  <div className={styles.chart} style={PLOT_BOX}>
    <div className={styles.plotArea}>
      <div className={styles.axisY}>
        {range(TICKS).map((tick) => (
          <Skeleton key={tick} className={styles.tick} />
        ))}
      </div>
      <div className={styles.plot}>
        {range(MONTHS).map((month) => (
          <Skeleton key={month} className={styles.bar} />
        ))}
      </div>
      <div className={styles.axisX}>
        {range(MONTHS).map((month) => (
          <Skeleton key={month} className={styles.label} />
        ))}
      </div>
    </div>
    <div className={styles.legend}>
      {range(SERIES).map((series) => (
        <Skeleton key={series} className={styles.legendItem} />
      ))}
    </div>
  </div>
);

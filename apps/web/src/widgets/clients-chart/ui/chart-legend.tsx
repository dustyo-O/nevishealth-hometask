import { cx } from '@/shared/lib/cx';
import { ChannelSwatch } from './channel-swatch';
import styles from './chart-legend.module.css';

type ChartLegendProps = {
  channels: readonly string[];
  className?: string | undefined;
};

/**
 * Names the three parts of every bar, each with its colour, in stacking order, whatever the
 * figures are (003 FR3, 004 FR5). Plain HTML, not the library's legend: that one wraps at 375 and takes height from the plot (consult Q3), and it can be
 * clicked into hiding a series — which would change every bar's height and break the chart's
 * agreement with the table. This one explains; it does not operate.
 */
export const ChartLegend = ({ channels, className }: ChartLegendProps) => (
  <ul className={cx(styles.legend, className)}>
    {channels.map((name) => (
      <li key={name} className={styles.entry}>
        <ChannelSwatch name={name} />
        {name}
      </li>
    ))}
  </ul>
);

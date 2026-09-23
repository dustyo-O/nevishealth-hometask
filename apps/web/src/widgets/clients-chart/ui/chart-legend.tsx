import { cx } from '@/shared/lib/cx';
import { channelKey } from '../model/channels';
import styles from './chart-legend.module.css';

type ChartLegendProps = {
  channels: readonly string[];
  className?: string | undefined;
};

/**
 * Names the parts of every bar, each with its colour, in stacking order (003 FR3) — "Not recorded"
 * first whenever the year has any, and then in every state of the chart (004 FR4). Plain HTML, not the library's
 * legend: that one wraps at 375 and takes height from the plot (consult Q3), and it can be
 * clicked into hiding a series — which would change every bar's height and break the chart's
 * agreement with the table. This one explains; it does not operate.
 */
export const ChartLegend = ({ channels, className }: ChartLegendProps) => (
  <ul className={cx(styles.legend, className)}>
    {channels.map((name) => (
      <li key={name} className={styles.entry}>
        <span aria-hidden="true" className={cx(styles.swatch, styles[channelKey(name)])} />
        {name}
      </li>
    ))}
  </ul>
);

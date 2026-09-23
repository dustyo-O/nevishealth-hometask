import type { CSSProperties } from 'react';
import { formatMonth, type MonthlyPoint } from '@/entities/clients';
import { cx } from '@/shared/lib/cx';
import { channelKey } from '../model/channels';
import styles from './month-panel.module.css';

type MonthPanelProps = {
  point: MonthlyPoint;
  channels: readonly string[];
  /** The month's place in the year; the panel stands beside that month's column. */
  index: number;
  months: number;
};

/**
 * The month being read, as a small panel beside its column (FR4-AC1): the month, its parts in
 * the order they are stacked — "Not recorded" included, at 0 too, when the year has any (004
 * FR4) — and the total last. Its text comes from the widget's own state,
 * never from the library's payload — the library's hover index was measured disagreeing with
 * ours when a resting pointer met a Tab (003 §3 R-4). Months in the first half of the year open
 * it to the right of their column, the rest to the left, so it stays over the plot at any width.
 *
 * It lives inside the drawing's `aria-hidden` wrapper: the live region says the same thing once
 * (FR6-AC3), and this is what a sighted user reads.
 */
export const MonthPanel = ({ point, channels, index, months }: MonthPanelProps) => (
  <div
    data-month={point.month}
    className={cx(styles.panel, index < months / 2 ? styles.after : styles.before)}
    style={{ '--month-index': index } as CSSProperties}
  >
    <p className={styles.month}>{formatMonth(point.month)}</p>
    <dl className={styles.figures}>
      {channels.map((name) => (
        <div key={name} className={styles.row}>
          <dt className={styles.name}>
            <span className={cx(styles.swatch, styles[channelKey(name)])} />
            {name}
          </dt>
          <dd className={styles.value}>{point.byChannel[name] ?? 0}</dd>
        </div>
      ))}
      <div className={cx(styles.row, styles.total)}>
        <dt className={styles.name}>Total</dt>
        <dd className={styles.value}>{point.total}</dd>
      </div>
    </dl>
  </div>
);

import { cx } from '@/shared/lib/cx';
import { range } from '@/shared/lib/range';
import { Skeleton } from '@/shared/ui/skeleton';
import styles from './table-card-skeleton.module.css';

const MONTHS = 12;
const ROWS = 4;

/**
 * Grey blocks where the table's header row and the first rows (Company and its branches) will
 * be (design Table `1:2901`). Spec 002 replaces this file with the table widget's own skeleton.
 */
export const TableCardSkeleton = () => (
  <div className={styles.table}>
    <div className={cx(styles.row, styles.header)}>
      <div className={styles.name} />
      {range(MONTHS).map((month) => (
        <Skeleton key={month} className={styles.monthLabel} />
      ))}
    </div>
    {range(ROWS).map((row) => (
      <div key={row} className={styles.row}>
        <div className={styles.name}>
          <Skeleton className={styles.chevron} />
          <Skeleton className={styles.nameText} />
        </div>
        {range(MONTHS).map((month) => (
          <Skeleton key={month} className={styles.figure} />
        ))}
      </div>
    ))}
  </div>
);

import { range } from '@/shared/lib/range';
import { Skeleton } from '@/shared/ui/skeleton';
import styles from './clients-table-skeleton.module.css';

const MONTHS = 12;
const ROWS = 4;

/**
 * Grey blocks where the table's header row and the first rows (Company and its branches) will
 * be (design Table `1:2901`), in the card's own height so the card measures the same while
 * loading and once loaded (spec 001 FR3-AC2).
 */
export const ClientsTableSkeleton = () => (
  <div className={styles.table}>
    <div className={styles.row}>
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

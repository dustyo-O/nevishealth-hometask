import { formatBranchCount, formatPeriod, useClientsQuery } from '@/entities/clients';
import { Card } from '@/shared/ui/card';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import styles from './dashboard-page.module.css';

type View = 'loading' | 'loaded' | 'error';

/**
 * The "Clients" page: heading, a live region for assistive technology, and the two card slots
 * of the design in one of three states. Loading and loaded render the same two `Card` shells so
 * the content lands without shifting; slice 3 fills the loading shells with the skeleton and
 * replaces the error paragraph with the panel and its Retry.
 */
export const DashboardPage = () => {
  const { data, isFetching } = useClientsQuery({});
  // After an error, refetch() keeps status 'error' while fetchStatus is 'fetching' (isPending stays
  // false during Retry), so the state is derived from data + isFetching, not from status.
  const view: View = data ? 'loaded' : isFetching ? 'loading' : 'error';
  const loading = view === 'loading';

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Clients</h1>
      {/* Persistent node outside the busy container: AT may suppress content inside aria-busy. */}
      <VisuallyHidden as="p" role="status">
        {loading ? 'Loading clients…' : null}
      </VisuallyHidden>
      <div aria-busy={loading} className={styles.grid}>
        {view === 'error' ? (
          <p className={styles.message}>We couldn't load the clients data.</p>
        ) : (
          <>
            <Card label="Clients chart" className={styles.chartSlot}>
              {data ? <p className={styles.summary}>{formatPeriod(data.months)}</p> : null}
            </Card>
            <Card label="Monthly detail" className={styles.tableSlot}>
              {data ? <p className={styles.summary}>{formatBranchCount(data.company)}</p> : null}
            </Card>
          </>
        )}
      </div>
    </main>
  );
};

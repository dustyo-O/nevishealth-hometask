import { useEffect, useRef, useState } from 'react';
import {
  formatBranchCount,
  formatPeriod,
  readDevSwitches,
  useClientsQuery,
} from '@/entities/clients';
import { describeError } from '@/shared/api';
import { Card } from '@/shared/ui/card';
import { ErrorPanel } from '@/shared/ui/error-panel';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import { ChartCardSkeleton } from './chart-card-skeleton';
import styles from './dashboard-page.module.css';
import { TableCardSkeleton } from './table-card-skeleton';

type View = 'loading' | 'loaded' | 'error';

const LOAD_FAILED_MESSAGE = "We couldn't load the clients data.";
const LOADING_MESSAGE = 'Loading clients…';

/**
 * The "Clients" page: heading, a live region for assistive technology, and the two card slots
 * of the design in one of three states. Loading and loaded render the same two `Card` shells
 * (skeleton inside while loading) so the content lands without shifting; the failed state puts
 * one error panel with Retry in place of both cards (spec 001 FR3–FR6).
 */
export const DashboardPage = () => {
  // Read once: changing a switch means changing the address, which reloads the page (FR4).
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data, error, status, isFetching, refetch } = useClientsQuery(switches);
  // The panel shows only once the query has settled in error. On Retry without data, query-core
  // 5.103 resets status to 'pending' (its `fetchState`), so Retry is 'loading' by status alone;
  // the `!isFetching` guard keeps that true should a future version keep 'error' while fetching.
  const view: View = data ? 'loaded' : status === 'error' && !isFetching ? 'error' : 'loading';
  const loading = view === 'loading';

  // Live regions report changes, not the content they mount with: the status node renders empty
  // and gets its text on the next tick, so the first "Loading clients…" is a change assistive
  // technology announces (FR3-AC1, code review F2). The flag resets whenever loading ends, so
  // Retry announces again the same way.
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setAnnounced(true), 0);
    return () => {
      clearTimeout(timer);
      setAnnounced(false);
    };
  }, [loading]);

  // Retry unmounts its own button under the keyboard user, so focus moves to the heading first
  // (tech doc D-11); the panel's alert itself never moves focus.
  const handleRetry = () => {
    headingRef.current?.focus();
    void refetch();
  };

  return (
    <main className={styles.page}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Clients
      </h1>
      {/* Persistent node outside the busy container: AT may suppress content inside aria-busy. */}
      <VisuallyHidden as="p" role="status">
        {loading && announced ? LOADING_MESSAGE : null}
      </VisuallyHidden>
      <div aria-busy={loading} className={styles.grid}>
        {view === 'error' ? (
          <ErrorPanel
            message={LOAD_FAILED_MESSAGE}
            detail={describeError(error)}
            onRetry={handleRetry}
          />
        ) : (
          <>
            <Card label="Clients chart" className={styles.chartSlot}>
              {data ? (
                <p className={styles.summary}>{formatPeriod(data.months)}</p>
              ) : (
                <ChartCardSkeleton />
              )}
            </Card>
            <Card label="Monthly detail" className={styles.tableSlot}>
              {data ? (
                <p className={styles.summary}>{formatBranchCount(data.company)}</p>
              ) : (
                <TableCardSkeleton />
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
};

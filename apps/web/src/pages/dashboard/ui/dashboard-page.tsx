import { useEffect, useRef, useState } from 'react';
import { ClientsChart, ClientsChartSkeleton } from '@/widgets/clients-chart';
import { ClientsTable, ClientsTableSkeleton } from '@/widgets/clients-table';
import { readDevSwitches, useClientsQuery } from '@/entities/clients';
import { describeError } from '@/shared/api';
import { Card } from '@/shared/ui/card';
import { ErrorPanel } from '@/shared/ui/error-panel';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import styles from './dashboard-page.module.css';

type View = 'loading' | 'loaded' | 'error';

const LOAD_FAILED_MESSAGE = "We couldn't load the clients data.";
const LOADING_MESSAGE = 'Loading clients…';
/**
 * How long the wait must last before the live region says anything (FR3, amended 2026-09-22).
 * A screen reader spends the first moment after a page opens reading the page itself, and
 * anything said underneath it is lost — VoiceOver read only "Clients. You are currently at…"
 * and the announcement went unheard. A wait shorter than this needs no announcement either:
 * the figures are already on screen.
 */
const LOADING_ANNOUNCE_DELAY_MS = 1000;

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
  // and gets its text only once the wait has lasted LOADING_ANNOUNCE_DELAY_MS, so the first
  // "Loading clients…" is a change assistive technology announces — and one it is free to hear
  // (FR3-AC1/AC3, code review F2 + the VoiceOver device check). The timer is cleared and the
  // flag reset whenever loading ends, so a fast load stays silent and Retry announces the same
  // way, its own wait starting again from zero.
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setAnnounced(true), LOADING_ANNOUNCE_DELAY_MS);
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
      <VisuallyHidden as="p" role="status" aria-atomic="true">
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
              {data ? <ClientsChart data={data} /> : <ClientsChartSkeleton />}
            </Card>
            <Card label="Monthly detail" className={styles.tableSlot}>
              {data ? <ClientsTable data={data} /> : <ClientsTableSkeleton />}
            </Card>
          </>
        )}
      </div>
    </main>
  );
};

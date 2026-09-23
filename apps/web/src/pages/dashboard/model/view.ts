export type View = 'loading' | 'loaded' | 'error';

type QueryState = {
  hasData: boolean;
  status: 'pending' | 'error' | 'success';
  isFetching: boolean;
};

/**
 * Which of the page's three layouts the query calls for (spec 001 FR3–FR4). The failed state
 * shows only once the query has settled in error. On Retry without data, query-core 5.103 resets
 * status to 'pending' (its `fetchState`), so Retry is 'loading' by status alone; the `!isFetching`
 * guard keeps that true should a future version keep 'error' while fetching.
 */
export const toView = ({ hasData, status, isFetching }: QueryState): View => {
  if (hasData) return 'loaded';
  return status === 'error' && !isFetching ? 'error' : 'loading';
};

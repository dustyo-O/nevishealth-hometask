import { DashboardPage } from '@/pages/dashboard';
import { ErrorBoundary } from './providers/error-boundary';
import { QueryProvider } from './providers/query-provider';

export const App = () => (
  <QueryProvider>
    <ErrorBoundary>
      <DashboardPage />
    </ErrorBoundary>
  </QueryProvider>
);

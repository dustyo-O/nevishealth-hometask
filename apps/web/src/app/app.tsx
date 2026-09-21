import { DashboardPage } from '@/pages/dashboard';
import { ErrorBoundary } from './providers/error-boundary';

export const App = () => (
  <ErrorBoundary>
    <DashboardPage />
  </ErrorBoundary>
);

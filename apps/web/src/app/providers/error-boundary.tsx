import { Component, type ErrorInfo, type ReactNode } from 'react';
import { describeError } from '@/shared/api';
import { ErrorPanel } from '@/shared/ui/error-panel';
import styles from './error-boundary.module.css';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { caught: false } | { caught: true; error: unknown };

const LOAD_FAILED_MESSAGE = "We couldn't load the clients data.";

const reload = () => window.location.reload();

/**
 * Last line of defence around the page: a render error shows the same panel as a failed fetch,
 * with Reload in place of Retry (tech doc §2.4).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { caught: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { caught: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.caught) return this.props.children;

    return (
      <main className={styles.fallback}>
        <h1 className={styles.title}>Clients</h1>
        <ErrorPanel
          message={LOAD_FAILED_MESSAGE}
          detail={describeError(this.state.error)}
          onRetry={reload}
          retryLabel="Reload"
        />
      </main>
    );
  }
}

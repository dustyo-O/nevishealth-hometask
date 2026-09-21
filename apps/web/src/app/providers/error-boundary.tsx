import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './error-boundary.module.css';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

const reload = () => window.location.reload();

/**
 * Last line of defence around the page: a render error shows the same message as a failed fetch
 * with a Reload action. Slice 3 swaps the fallback for `ErrorPanel` with `retryLabel="Reload"`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className={styles.fallback}>
        <h1 className={styles.title}>Clients</h1>
        <div role="alert">
          <p>We couldn&rsquo;t load the clients data.</p>
          <p>Unexpected error</p>
        </div>
        <button type="button" onClick={reload}>
          Reload
        </button>
      </main>
    );
  }
}

import { useId } from 'react';
import { cx } from '../../lib/cx';
import { Button } from '../button';
import styles from './error-panel.module.css';

export type ErrorPanelProps = {
  /** The one-line message; it also names the region. */
  message: string;
  /** One short line saying what went wrong. */
  detail: string;
  onRetry: () => void;
  /** @default 'Retry' */
  retryLabel?: string;
  className?: string;
};

/**
 * The failed state (spec 001 FR4): a named region whose text block is the alert — announced on
 * arrival without moving focus — and one action. No `autoFocus`; the caller decides where focus
 * goes when the action unmounts the panel (tech doc D-11).
 */
export const ErrorPanel = ({
  message,
  detail,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorPanelProps) => {
  const messageId = useId();
  return (
    <section aria-labelledby={messageId} className={cx(styles.panel, className)}>
      <div role="alert" className={styles.text}>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <p className={styles.detail}>{detail}</p>
      </div>
      <Button onClick={onRetry}>{retryLabel}</Button>
    </section>
  );
};

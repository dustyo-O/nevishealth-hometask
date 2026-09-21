import { cx } from '../../lib/cx';
import styles from './skeleton.module.css';

export type SkeletonProps = {
  /** Size and position come from the caller; the block itself is only colour and shimmer. */
  className?: string;
};

/** One grey placeholder block. Never announced: the live region says the page is loading. */
export const Skeleton = ({ className }: SkeletonProps) => (
  <span aria-hidden="true" className={cx(styles.skeleton, className)} />
);

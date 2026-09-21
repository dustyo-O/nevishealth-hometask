import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './card.module.css';

export type CardProps = {
  /** Accessible name of the region — the card is a named landmark. */
  label: string;
  className?: string;
  children?: ReactNode;
};

export const Card = ({ label, className, children }: CardProps) => (
  <section aria-label={label} className={cx(styles.card, className)}>
    {children}
  </section>
);

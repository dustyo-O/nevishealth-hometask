import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import styles from './avatar.module.css';
import { hueOf } from './hue';

export type AvatarProps = {
  /** The letters drawn in the circle; whoever they stand for is the caller's business. */
  initials: string;
  /** Anything stable about the subject: the same seed always draws the same tint. */
  seed: string;
  className?: string;
};

/**
 * The circle that stands in for a photograph. It is decoration — the name is beside it, and a
 * screen reader reads that and passes over this (FR5-AC2) — so it is `aria-hidden` and never a
 * label of its own. Size comes from `--avatar-size`, which the caller sets.
 */
export const Avatar = ({ initials, seed, className }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={cx(styles.avatar, className)}
    style={{ '--avatar-hue': hueOf(seed) } as CSSProperties}
  >
    {initials}
  </span>
);

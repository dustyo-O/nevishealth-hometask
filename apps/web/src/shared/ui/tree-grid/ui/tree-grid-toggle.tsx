import { cx } from '../../../lib/cx';
import styles from './tree-grid.module.css';

export type TreeGridToggleProps = {
  className?: string;
};

/**
 * The arrow's place in the name cell. "Expandable" is a tree concept, so the slot belongs to the
 * grid rather than to whatever the rows describe — and it is reserved on every row, open, closed
 * or leaf, so names and figures line up down the column.
 *
 * Slice 1 reserves the space; slice 2 draws the chevron in it and makes the name cell toggle.
 */
export const TreeGridToggle = ({ className }: TreeGridToggleProps) => (
  <span aria-hidden="true" className={cx(styles.toggle, className)} />
);

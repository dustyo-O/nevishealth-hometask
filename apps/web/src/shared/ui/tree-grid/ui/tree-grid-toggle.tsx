import { cx } from '../../../lib/cx';
import { useTreeGridRow } from '../model/context';
import { ChevronDown } from './chevron-down';
import styles from './tree-grid.module.css';

export type TreeGridToggleProps = {
  className?: string;
};

/**
 * The arrow's place in the name cell. "Expandable" is a tree concept, so the slot belongs to the
 * grid rather than to whatever the rows describe — and it is reserved on every row, open, closed
 * or leaf, so names and figures line up down the column.
 *
 * A leaf is drawn no arrow at all: it offers nothing to open (FR1-AC4). Which way the arrow
 * points is the stylesheet's business, read off the row's own `aria-expanded`, so the open state
 * is declared in exactly one place.
 */
export const TreeGridToggle = ({ className }: TreeGridToggleProps) => {
  const row = useTreeGridRow();

  return (
    <span aria-hidden="true" className={cx(styles.toggle, className)}>
      {row.hasChildren ? <ChevronDown className={styles.chevron} /> : null}
    </span>
  );
};

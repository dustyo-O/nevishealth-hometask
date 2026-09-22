import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { cx } from '../../../lib/cx';
import { useTreeGridContext, useTreeGridRow } from '../model/context';
import styles from './tree-grid.module.css';

export type TreeGridRowHeaderProps = {
  /**
   * The name is the only thing that opens and closes the row; the figures carry nothing, so a
   * click on one changes nothing at all (FR2-AC5). Left off for a row with nothing to open.
   */
  onClick?: MouseEventHandler<HTMLTableCellElement>;
  className?: string;
  children?: ReactNode;
};

/**
 * The row's name: the sticky first cell, and the header every figure in the row points at. The
 * depth goes out as a custom property rather than a computed pixel value, so the indent is the
 * stylesheet's business and the row's geometry survives a token change.
 */
export const TreeGridRowHeader = ({ onClick, className, children }: TreeGridRowHeaderProps) => {
  const { rowHeaderId } = useTreeGridContext();
  const row = useTreeGridRow();

  return (
    <th
      scope="row"
      id={rowHeaderId(row.id)}
      className={cx(styles.nameCell, styles.rowHeader, className)}
      style={{ '--tree-grid-level': row.level } as CSSProperties}
      onClick={onClick}
    >
      {children}
    </th>
  );
};

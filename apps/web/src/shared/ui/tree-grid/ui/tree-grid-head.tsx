import type { ReactNode } from 'react';
import { cx } from '../../../lib/cx';
import { useTreeGridContext } from '../model/context';
import styles from './tree-grid.module.css';

export type TreeGridHeadProps = {
  children: ReactNode;
};

/** The one header row: a `<thead>` (a rowgroup) holding a single row of column headings. */
export const TreeGridHead = ({ children }: TreeGridHeadProps) => (
  <thead>
    <tr>{children}</tr>
  </thead>
);

export type TreeGridColumnHeaderProps = {
  className?: string;
  children?: ReactNode;
} & (
  | {
      /** The heading above the row names: pinned like the names, and never a figure's header. */
      nameColumn: true;
      colIndex?: never;
    }
  | {
      nameColumn?: false;
      /** 0-based; the id every figure in this column points its `headers` at. */
      colIndex: number;
    }
);

export const TreeGridColumnHeader = ({
  className,
  children,
  ...column
}: TreeGridColumnHeaderProps) => {
  const { columnHeaderId } = useTreeGridContext();

  if (column.nameColumn === true) {
    return (
      <th scope="col" className={cx(styles.nameCell, className)}>
        {children}
      </th>
    );
  }

  return (
    <th scope="col" id={columnHeaderId(column.colIndex)} className={className}>
      {children}
    </th>
  );
};

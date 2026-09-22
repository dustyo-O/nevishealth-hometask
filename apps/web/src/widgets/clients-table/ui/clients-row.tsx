import { memo } from 'react';
import { toInitials, type ClientRow } from '@/entities/clients';
import { Avatar } from '@/shared/ui/avatar';
import { TreeGrid } from '@/shared/ui/tree-grid';
import styles from './clients-table.module.css';

type ClientsRowProps = {
  row: ClientRow;
  months: readonly string[];
  expanded: boolean;
  /** Where the outline is inside this row, `null` when it is somewhere else entirely. */
  activeColIndex: number | null;
  onToggle: (id: string) => void;
};

/**
 * One row of the table, and the place D-9 is cashed in. A keystroke changes `activeColIndex` on
 * the row the outline left and the row it arrived at, and on no other: two rows re-render per
 * key rather than all forty-four (≈570 cells). That only holds while every other prop is stable
 * between keystrokes — `row` comes from a `useMemo` keyed on the expanded ids, `months` from
 * the loaded data, and `onToggle` from the grid, which keeps it for its lifetime.
 */
export const ClientsRow = memo(function ClientsRow({
  row,
  months,
  expanded,
  activeColIndex,
  onToggle,
}: ClientsRowProps) {
  return (
    <TreeGrid.Row row={row} expanded={expanded} activeColIndex={activeColIndex}>
      {/* A row with nothing beneath it offers nothing to open, so it listens for nothing. */}
      <TreeGrid.RowHeader onClick={row.hasChildren ? () => onToggle(row.id) : undefined}>
        <span className={styles.name}>
          {/* Reserved on every row, open, closed or leaf, so the names line up. */}
          <TreeGrid.Toggle />
          {/* The design photographs advisers; the data holds no photographs (FR5-AC1). A
              channel's extra step of indent takes this slot's place, so the two line up. */}
          {row.kind === 'adviser' ? (
            <Avatar initials={toInitials(row.name)} seed={row.id} className={styles.avatar} />
          ) : null}
          <span className={styles.nameSlot}>
            <span className={styles.label} title={row.name}>
              {row.name}
            </span>
          </span>
        </span>
      </TreeGrid.RowHeader>
      {months.map((month, colIndex) => (
        <TreeGrid.Cell key={month} colIndex={colIndex} className={styles.figure}>
          {row.values[colIndex]}
        </TreeGrid.Cell>
      ))}
    </TreeGrid.Row>
  );
});

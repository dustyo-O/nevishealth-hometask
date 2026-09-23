import { useMemo } from 'react';
import { flattenVisibleRows, formatMonth, type ClientsData } from '@/entities/clients';
import { TreeGrid, useExpandedIds, useTreeGrid } from '@/shared/ui/tree-grid';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import { ClientsRow } from './clients-row';
import styles from './clients-table.module.css';

const GRID_ID = 'clients-table';

type ClientsTableProps = {
  data: ClientsData;
};

/**
 * The monthly detail table: one column per month, one row per part of the company, the company
 * already open when the page appears (FR1). The only place `shared/ui/tree-grid` and
 * `entities/clients` meet — the grid knows rows and columns, the entity knows the tree, and the
 * client-shaped name cell is built here (architecture §6). The page owns the query and mounts
 * this only once the figures are here, so the open company can seed the first render.
 *
 * The open rows live here rather than inside the grid because flattening needs them *before*
 * the grid renders (D-6); the hook beneath them is generic, and the seed is this widget's
 * business.
 */
export const ClientsTable = ({ data }: ClientsTableProps) => {
  const { company, months } = data;
  const { expandedIds, toggle } = useExpandedIds(() => [company.id]);
  const rows = useMemo(() => flattenVisibleRows(company, expandedIds), [company, expandedIds]);
  const grid = useTreeGrid({
    id: GRID_ID,
    rows,
    columnCount: months.length,
    expandedIds,
    // Rebuilt every render and read through a ref, so the grid's own handlers stay stable.
    onToggle: (id) => toggle(id, rows),
  });

  return (
    <TreeGrid
      {...grid.gridProps}
      label="Clients by month"
      className={styles.grid}
      head={
        <TreeGrid.Head>
          {/* Blank in the design, and still named for a screen reader (FR4-AC3). */}
          <TreeGrid.ColumnHeader nameColumn>
            <VisuallyHidden>Name</VisuallyHidden>
          </TreeGrid.ColumnHeader>
          {months.map((month, colIndex) => (
            <TreeGrid.ColumnHeader key={month} colIndex={colIndex}>
              {formatMonth(month)}
            </TreeGrid.ColumnHeader>
          ))}
        </TreeGrid.Head>
      }
    >
      {rows.map((row) => (
        <ClientsRow
          key={row.id}
          row={row}
          months={months}
          expanded={expandedIds.has(row.id)}
          activeColIndex={grid.activeColIndexOf(row.id)}
          onToggle={grid.toggle}
        />
      ))}
    </TreeGrid>
  );
};

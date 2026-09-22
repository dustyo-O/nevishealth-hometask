import { useMemo, useState } from 'react';
import {
  flattenVisibleRows,
  formatMonth,
  readDevSwitches,
  useClientsQuery,
} from '@/entities/clients';
import { TreeGrid } from '@/shared/ui/tree-grid';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import styles from './clients-table.module.css';

const GRID_ID = 'clients-table';

/**
 * The monthly detail table: one column per month, one row per part of the company, the company
 * already open when the page appears (FR1). The only place `shared/ui/tree-grid` and
 * `entities/clients` meet — the grid knows rows and columns, the entity knows the tree, and the
 * client-shaped name cell is built here (architecture §6).
 *
 * Slice 1 opens the company and nothing else: the expanded set is fixed, so this slice is about
 * structure, semantics and geometry. Slice 2 makes the names toggle.
 */
export const ClientsTable = () => {
  // Read once, like the page: changing a switch means changing the address, which reloads.
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const { data } = useClientsQuery(switches);
  const company = data?.company;

  const expandedIds = useMemo(() => new Set(company === undefined ? [] : [company.id]), [company]);
  const rows = useMemo(
    () => (company === undefined ? [] : flattenVisibleRows(company, expandedIds)),
    [company, expandedIds],
  );

  // The page only mounts the table once the figures are here; this is the belt to that braces.
  if (data === undefined) return null;
  const months = data.months;

  return (
    <TreeGrid
      id={GRID_ID}
      label="Clients by month"
      columnCount={months.length}
      head={
        <TreeGrid.Head>
          {/* Blank in the design, and still named for a screen reader (FR4-AC3). */}
          <TreeGrid.ColumnHeader name>
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
        <TreeGrid.Row key={row.id} row={row} expanded={expandedIds.has(row.id)}>
          <TreeGrid.RowHeader>
            <span className={styles.name}>
              {/* Reserved on every row, open, closed or leaf, so the names line up. */}
              <TreeGrid.Toggle />
              <span className={styles.label}>{row.name}</span>
            </span>
          </TreeGrid.RowHeader>
          {months.map((month, colIndex) => (
            <TreeGrid.Cell key={month} colIndex={colIndex} className={styles.figure}>
              {row.values[colIndex]}
            </TreeGrid.Cell>
          ))}
        </TreeGrid.Row>
      ))}
    </TreeGrid>
  );
};

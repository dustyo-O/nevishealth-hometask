import { useMemo, useState } from 'react';
import {
  flattenVisibleRows,
  formatMonth,
  readDevSwitches,
  toInitials,
  useClientsQuery,
  type ClientsData,
} from '@/entities/clients';
import { Avatar } from '@/shared/ui/avatar';
import { TreeGrid, useExpandedIds } from '@/shared/ui/tree-grid';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import styles from './clients-table.module.css';

const GRID_ID = 'clients-table';

/**
 * The monthly detail table: one column per month, one row per part of the company, the company
 * already open when the page appears (FR1). The only place `shared/ui/tree-grid` and
 * `entities/clients` meet — the grid knows rows and columns, the entity knows the tree, and the
 * client-shaped name cell is built here (architecture §6).
 */
export const ClientsTable = () => {
  // Read once, like the page: changing a switch means changing the address, which reloads.
  const [switches] = useState(() => readDevSwitches(window.location.search));
  const { data } = useClientsQuery(switches);

  // The page only mounts the table once the figures are here; this is the belt to that braces.
  // It is also what lets the grid below be seeded with the company id at its own first render.
  if (data === undefined) return null;
  return <ClientsGrid data={data} />;
};

type ClientsGridProps = {
  data: ClientsData;
};

/**
 * Holds which rows are open. The ids live here rather than inside the grid because flattening
 * needs them *before* the grid renders (D-6); the hook beneath them is generic, and the seed —
 * the company, open when the page appears (FR1) — is this widget's business.
 */
const ClientsGrid = ({ data }: ClientsGridProps) => {
  const { company, months } = data;
  const { expandedIds, toggle } = useExpandedIds(() => [company.id]);
  const rows = useMemo(() => flattenVisibleRows(company, expandedIds), [company, expandedIds]);

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
          {/* A row with nothing beneath it offers nothing to open, so it listens for nothing. */}
          <TreeGrid.RowHeader onClick={row.hasChildren ? () => toggle(row.id, rows) : undefined}>
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
      ))}
    </TreeGrid>
  );
};

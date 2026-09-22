import { useMemo, useState } from 'react';
import {
  flattenVisibleRows,
  formatMonth,
  readDevSwitches,
  useClientsQuery,
  type ClientsData,
} from '@/entities/clients';
import { TreeGrid, useExpandedIds, useTreeGrid } from '@/shared/ui/tree-grid';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';
import { ClientsRow } from './clients-row';

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
 * Holds which rows are open, and lets `useTreeGrid` hold where the outline is. The ids live
 * here rather than inside the grid because flattening needs them *before* the grid renders
 * (D-6); the hook beneath them is generic, and the seed — the company, open when the page
 * appears (FR1) — is this widget's business.
 */
const ClientsGrid = ({ data }: ClientsGridProps) => {
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
      id={GRID_ID}
      label="Clients by month"
      columnCount={months.length}
      onKeyDown={grid.gridProps.onKeyDown}
      onFocus={grid.gridProps.onFocus}
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

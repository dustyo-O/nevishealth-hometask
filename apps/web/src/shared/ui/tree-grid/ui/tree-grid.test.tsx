import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import type { TreeGridRow } from '../model/types';
import { TreeGrid } from './tree-grid';

/**
 * Deliberately nothing to do with clients: this layer knows rows, levels and columns, and if a
 * test here needed a client type the code would be in the wrong layer (architecture §6).
 */
const ROWS: TreeGridRow[] = [
  { id: 'root', parentId: null, level: 1, posInSet: 1, setSize: 1, hasChildren: true },
  { id: 'open', parentId: 'root', level: 2, posInSet: 1, setSize: 3, hasChildren: true },
  { id: 'child', parentId: 'open', level: 3, posInSet: 1, setSize: 1, hasChildren: false },
  { id: 'shut', parentId: 'root', level: 2, posInSet: 2, setSize: 3, hasChildren: true },
  { id: 'leaf', parentId: 'root', level: 2, posInSet: 3, setSize: 3, hasChildren: false },
];

const COLUMNS = ['One', 'Two'];

const Grid = ({ expanded = new Set(['root', 'open']) }: { expanded?: ReadonlySet<string> }) => (
  <TreeGrid
    id="grid"
    label="Values by column"
    columnCount={COLUMNS.length}
    head={
      <TreeGrid.Head>
        <TreeGrid.ColumnHeader name>Name</TreeGrid.ColumnHeader>
        {COLUMNS.map((column, colIndex) => (
          <TreeGrid.ColumnHeader key={column} colIndex={colIndex}>
            {column}
          </TreeGrid.ColumnHeader>
        ))}
      </TreeGrid.Head>
    }
  >
    {ROWS.map((row) => (
      <TreeGrid.Row key={row.id} row={row} expanded={expanded.has(row.id)}>
        <TreeGrid.RowHeader>
          <TreeGrid.Toggle />
          {row.id}
        </TreeGrid.RowHeader>
        {COLUMNS.map((column, colIndex) => (
          <TreeGrid.Cell key={column} colIndex={colIndex}>
            {`${row.id}-${column}`}
          </TreeGrid.Cell>
        ))}
      </TreeGrid.Row>
    ))}
  </TreeGrid>
);

const bodyRowNamed = (id: string): HTMLTableRowElement => {
  const header = screen.getByText(id, { selector: 'th' });
  const row = header.closest('tr');
  if (row === null) throw new Error(`no row for "${id}"`);
  return row;
};

describe('TreeGrid', () => {
  it('is one treegrid with a name, a header row and a row per visible node', () => {
    render(<Grid />);

    const grid = screen.getByRole('treegrid', { name: 'Values by column' });
    expect(grid.tagName).toBe('TABLE');
    // The header row plus the five rows it was given.
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
  });

  it('reports each row its level, its position and how many siblings it has (FR4-AC1)', () => {
    render(<Grid />);

    expect(ROWS.map((row) => bodyRowNamed(row.id).getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '3',
      '2',
      '2',
    ]);
    expect(bodyRowNamed('open').getAttribute('aria-posinset')).toBe('1');
    expect(bodyRowNamed('open').getAttribute('aria-setsize')).toBe('3');
    expect(bodyRowNamed('shut').getAttribute('aria-posinset')).toBe('2');
    expect(bodyRowNamed('leaf').getAttribute('aria-posinset')).toBe('3');
    expect(bodyRowNamed('child').getAttribute('aria-setsize')).toBe('1');
  });

  it('says open or closed only for a row that has something beneath it (FR4-AC5)', () => {
    render(<Grid />);

    expect(bodyRowNamed('root')).toHaveAttribute('aria-expanded', 'true');
    expect(bodyRowNamed('open')).toHaveAttribute('aria-expanded', 'true');
    expect(bodyRowNamed('shut')).toHaveAttribute('aria-expanded', 'false');
    // A leaf carries no state at all — not `aria-expanded="false"`.
    expect(bodyRowNamed('leaf')).not.toHaveAttribute('aria-expanded');
    expect(bodyRowNamed('child')).not.toHaveAttribute('aria-expanded');
  });

  it('ties every figure to its column heading and its row name (D-11, FR4-AC2)', () => {
    const { container } = render(<Grid />);

    const figures = [...container.querySelectorAll('td')];
    expect(figures).toHaveLength(ROWS.length * COLUMNS.length);

    for (const figure of figures) {
      const headers = (figure.getAttribute('headers') ?? '').split(' ').filter(Boolean);
      expect(headers).toHaveLength(2);
      for (const id of headers) {
        expect(container.querySelector(`#${CSS.escape(id)}`)?.tagName).toBe('TH');
      }
    }

    // The one figure the acceptance criterion names: its own row's name, its own column's month.
    const cell = screen.getByText('child-Two');
    const [column, name] = (cell.getAttribute('headers') ?? '').split(' ');
    expect(document.getElementById(column ?? '')).toHaveTextContent('Two');
    expect(document.getElementById(name ?? '')).toHaveTextContent('child');
  });

  it('gives every header an id and keeps the name column out of the figures level', () => {
    const { container } = render(<Grid />);

    for (const header of container.querySelectorAll('thead th')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
    for (const header of container.querySelectorAll('tbody th')) {
      expect(header).toHaveAttribute('scope', 'row');
      expect(header.id).not.toBe('');
    }
    // Ids are namespaced by the grid, so two grids on one page never collide.
    expect(bodyRowNamed('root').querySelector('th')?.id).toBe('grid-row-root-name');
  });

  it('hands the level down to the stylesheet so the indent is not computed in JS', () => {
    render(<Grid />);

    const header = bodyRowNamed('child').querySelector('th');
    expect(header?.style.getPropertyValue('--tree-grid-level')).toBe('3');
  });

  it('draws an arrow on the rows that can open and reserves its slot on the ones that cannot', () => {
    render(<Grid />);

    // Every row keeps the slot, so the names line up down the column whatever the row is.
    for (const row of ROWS) {
      expect(bodyRowNamed(row.id).querySelector('[class*="toggle"]')).not.toBeNull();
    }
    expect(bodyRowNamed('root').querySelector('[class*="toggle"] svg')).not.toBeNull();
    expect(bodyRowNamed('shut').querySelector('[class*="toggle"] svg')).not.toBeNull();
    // A leaf offers nothing to open, so it is drawn no arrow at all (FR1-AC4).
    expect(bodyRowNamed('leaf').querySelector('[class*="toggle"] svg')).toBeNull();
    expect(bodyRowNamed('child').querySelector('[class*="toggle"] svg')).toBeNull();
  });

  it('keeps the arrow out of the accessibility tree — the row already says open or closed', () => {
    render(<Grid />);

    const chevron = bodyRowNamed('root').querySelector('[class*="toggle"] svg');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    // Which way it points follows `aria-expanded`, so the state is declared once, on the row.
    expect(chevron?.getAttribute('stroke')).toBe('currentColor');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Grid />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

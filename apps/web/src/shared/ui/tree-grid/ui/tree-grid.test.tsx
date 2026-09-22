import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useMemo } from 'react';
import { describe, expect, it } from 'vitest';
import type { TreeGridRow } from '../model/types';
import { useExpandedIds } from '../model/use-expanded-ids';
import { useTreeGrid } from '../model/use-tree-grid';
import { TreeGrid } from './tree-grid';

/**
 * Deliberately nothing to do with clients: this layer knows rows, levels and columns, and if a
 * test here needed a client type the code would be in the wrong layer (architecture §6). One of
 * every case the model has an answer for — a root, a row with children of its own, two kinds of
 * leaf, and a row whose children are hidden while it is closed:
 *
 *   root
 *     open        has children
 *       child     leaf
 *     shut        has children
 *       hidden    leaf
 *     leaf        leaf, and the last row of all
 */
type Node = { id: string; children?: Node[] };

const TREE: Node[] = [
  {
    id: 'root',
    children: [
      { id: 'open', children: [{ id: 'child' }] },
      { id: 'shut', children: [{ id: 'hidden' }] },
      { id: 'leaf' },
    ],
  },
];

/** What the caller would do: only the rows that are showing, depth-first, 1-based throughout. */
const flatten = (
  siblings: readonly Node[],
  expanded: ReadonlySet<string>,
  parentId: string | null = null,
  level = 1,
): TreeGridRow[] =>
  siblings.flatMap((node, index) => {
    const children = node.children ?? [];
    const row: TreeGridRow = {
      id: node.id,
      parentId,
      level,
      posInSet: index + 1,
      setSize: siblings.length,
      hasChildren: children.length > 0,
    };
    return expanded.has(node.id)
      ? [row, ...flatten(children, expanded, node.id, level + 1)]
      : [row];
  });

const ROWS: TreeGridRow[] = flatten(TREE, new Set(['root', 'open']));

const COLUMNS = ['One', 'Two', 'Three'];

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

/**
 * The same grid, but alive: the caller's expanded ids and the grid's own cursor, wired the way
 * the widget wires them. A button on either side, because "Tab moves in once and out again" is
 * only a claim about the page around the table (FR3-AC1).
 */
const KeyboardGrid = ({ initial }: { initial: readonly string[] }) => {
  const { expandedIds, toggle } = useExpandedIds(() => initial);
  const rows = useMemo(() => flatten(TREE, expandedIds), [expandedIds]);
  const grid = useTreeGrid({
    id: 'grid',
    rows,
    columnCount: COLUMNS.length,
    expandedIds,
    onToggle: (id) => toggle(id, rows),
  });

  return (
    <TreeGrid
      id="grid"
      label="Values by column"
      columnCount={COLUMNS.length}
      onKeyDown={grid.gridProps.onKeyDown}
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
      {rows.map((row) => (
        <TreeGrid.Row
          key={row.id}
          row={row}
          expanded={expandedIds.has(row.id)}
          activeColIndex={grid.activeColIndexOf(row.id)}
        >
          <TreeGrid.RowHeader onClick={row.hasChildren ? () => grid.toggle(row.id) : undefined}>
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
};

const Page = ({ initial = ['root'] }: { initial?: readonly string[] }) => (
  <>
    <button type="button">before</button>
    <KeyboardGrid initial={initial} />
    <button type="button">after</button>
  </>
);

/** Everything in the grid that Tab can reach. There is never more than one (D-9). */
const tabStops = () => [...screen.getByRole('treegrid').querySelectorAll('[tabindex="0"]')];

const figureIn = (rowId: string, colIndex: number): HTMLTableCellElement => {
  const cell = bodyRowNamed(rowId).querySelectorAll('td')[colIndex];
  if (cell === undefined) throw new Error(`no figure ${colIndex} in "${rowId}"`);
  return cell;
};

const nameOf = (rowId: string): HTMLElement => {
  const header = bodyRowNamed(rowId).querySelector('th');
  if (header === null) throw new Error(`no name cell in "${rowId}"`);
  return header;
};

/**
 * A keystroke, and the invariant that must survive every one of them: the grid offers exactly
 * one tab stop, and it is the element the outline is on. Asserting it here rather than in a
 * test of its own means every step of every walk below checks it.
 */
const press = async (user: UserEvent, keys: string) => {
  await user.keyboard(keys);
  expect(tabStops()).toHaveLength(1);
  expect(tabStops()[0]).toBe(document.activeElement);
};

/** Tab in from the button before the table, which is how a keyboard user arrives (FR3-AC1). */
const enterGrid = async (initial?: readonly string[]): Promise<UserEvent> => {
  const user = userEvent.setup();
  render(<Page initial={initial} />);
  screen.getByRole('button', { name: 'before' }).focus();
  await user.tab();
  return user;
};

describe('TreeGrid — operating it from the keyboard (FR3)', () => {
  it('waits to be asked: mounting the table takes no focus of its own', () => {
    render(<Page />);

    expect(document.activeElement).toBe(document.body);
    // The way in is ready all the same — one stop, on the first row.
    expect(tabStops()).toEqual([bodyRowNamed('root')]);
  });

  it('is one stop in the page: Tab moves in, Tab moves out (FR3-AC1)', async () => {
    const user = await enterGrid();

    expect(document.activeElement).toBe(bodyRowNamed('root'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
    // Still exactly one way back in, and it is not focused.
    expect(tabStops()).toEqual([bodyRowNamed('root')]);
  });

  it('moves down the rows, and Right opens the one the outline is on (FR3-AC2)', async () => {
    const user = await enterGrid();

    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(bodyRowNamed('open'));

    await press(user, '{ArrowRight}');
    expect(bodyRowNamed('open')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('child', { selector: 'th' })).toBeInTheDocument();
    // The outline stays where it was: nothing jumps into the rows just revealed.
    expect(document.activeElement).toBe(bodyRowNamed('open'));
  });

  it('moves into the figures with Right once the row is open (FR3-AC3)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{ArrowDown}{ArrowRight}');
    expect(document.activeElement).toBe(figureIn('open', 0));
  });

  it('moves into the figures with Right on a row with nothing beneath it (FR3-AC4)', async () => {
    const user = await enterGrid(['root', 'open']);

    // root → open → child, a leaf.
    await press(user, '{ArrowDown}{ArrowDown}{ArrowRight}');
    expect(document.activeElement).toBe(figureIn('child', 0));
  });

  it('walks the months and comes back to the name (FR3-AC5, FR3-AC6)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{ArrowDown}{ArrowRight}');
    await press(user, '{ArrowRight}{ArrowRight}{ArrowLeft}');
    expect(document.activeElement).toBe(figureIn('open', 1));

    await press(user, '{ArrowLeft}');
    expect(document.activeElement).toBe(figureIn('open', 0));

    await press(user, '{ArrowLeft}');
    expect(document.activeElement).toBe(bodyRowNamed('open'));
  });

  it('moves to the same month in the row below and above (FR3-AC7)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{ArrowDown}{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(figureIn('open', 1));

    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(figureIn('child', 1));

    await press(user, '{ArrowUp}');
    expect(document.activeElement).toBe(figureIn('open', 1));
  });

  it('jumps to the row’s own first and last months with Home and End (FR3-AC8)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{ArrowDown}{ArrowRight}{ArrowRight}');
    await press(user, '{End}');
    expect(document.activeElement).toBe(figureIn('open', COLUMNS.length - 1));

    await press(user, '{Home}');
    expect(document.activeElement).toBe(figureIn('open', 0));
  });

  it('does nothing at all on Enter or Space while on a figure (FR3-AC9)', async () => {
    const user = await enterGrid();

    // On the root's first figure, with the root open and therefore closable from its name.
    await press(user, '{ArrowRight}');
    expect(document.activeElement).toBe(figureIn('root', 0));

    await press(user, '{Enter}');
    await press(user, '[Space]');
    expect(document.activeElement).toBe(figureIn('root', 0));
    expect(bodyRowNamed('root')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('open', { selector: 'th' })).toBeInTheDocument();
  });

  it('stops at the edges rather than wrapping (FR3-AC10)', async () => {
    const user = await enterGrid();

    // Up on the first row: nothing above it.
    await press(user, '{ArrowUp}');
    expect(document.activeElement).toBe(bodyRowNamed('root'));

    // Down to the last showing row, then past it.
    await press(user, '{End}');
    expect(document.activeElement).toBe(bodyRowNamed('leaf'));
    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(bodyRowNamed('leaf'));

    // And along that row to its last month, then past it.
    await press(user, '{ArrowRight}{End}');
    expect(document.activeElement).toBe(figureIn('leaf', COLUMNS.length - 1));
    await press(user, '{ArrowRight}{ArrowDown}');
    expect(document.activeElement).toBe(figureIn('leaf', COLUMNS.length - 1));
  });

  it('closes an open row with Left, then goes up to its parent (FR3-AC11)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{ArrowDown}');
    await press(user, '{ArrowLeft}');
    expect(bodyRowNamed('open')).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(bodyRowNamed('open'));

    await press(user, '{ArrowLeft}');
    expect(document.activeElement).toBe(bodyRowNamed('root'));
  });

  it('leaves the outline on the root once it is closed — there is nothing above it (FR3-AC15)', async () => {
    const user = await enterGrid();

    await press(user, '{ArrowLeft}');
    expect(bodyRowNamed('root')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await press(user, '{ArrowLeft}');
    expect(document.activeElement).toBe(bodyRowNamed('root'));
  });

  it('opens the row with Enter and closes it again with Space (FR3-AC12)', async () => {
    const user = await enterGrid();

    await press(user, '{ArrowDown}{Enter}');
    expect(bodyRowNamed('open')).toHaveAttribute('aria-expanded', 'true');

    await press(user, '[Space]');
    expect(bodyRowNamed('open')).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(bodyRowNamed('open'));

    // A row with nothing to open is unmoved by either of them (FR1-AC4).
    await press(user, '{End}{Enter}');
    expect(bodyRowNamed('leaf')).not.toHaveAttribute('aria-expanded');
    expect(document.activeElement).toBe(bodyRowNamed('leaf'));
  });

  it('jumps to the first and last showing rows with Home and End (FR3-AC13)', async () => {
    const user = await enterGrid(['root', 'open']);

    await press(user, '{End}');
    expect(document.activeElement).toBe(bodyRowNamed('leaf'));

    await press(user, '{Home}');
    expect(document.activeElement).toBe(bodyRowNamed('root'));
  });
});

describe('TreeGrid — the outline when a row is closed away (FR2)', () => {
  it('moves the outline to the row just closed, and Down carries on from there (FR2-AC6, FR2-AC7)', async () => {
    const user = await enterGrid(['root', 'open']);

    // Down to "child" inside "open", then into its figures — the outline is now two levels in.
    await press(user, '{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(figureIn('child', 1));

    // Closed with the mouse, which is when the user is least able to see where focus went.
    await user.click(nameOf('open'));

    expect(screen.queryByText('child', { selector: 'th' })).not.toBeInTheDocument();
    expect(tabStops()).toEqual([bodyRowNamed('open')]);
    expect(document.activeElement).toBe(bodyRowNamed('open'));

    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(bodyRowNamed('shut'));
  });
});

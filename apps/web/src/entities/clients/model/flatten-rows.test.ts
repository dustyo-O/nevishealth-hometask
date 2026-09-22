import { describe, expect, it } from 'vitest';
import { flattenVisibleRows } from './flatten-rows';
import { makeNode } from '@/test/fixtures/clients';

/** Company → 3 branches; Branch 1 → 2 advisers; Anna → 2 channels. */
const company = () =>
  makeNode('company', 'Company', {
    branches: [
      makeNode('b1', 'Branch 1', {
        employees: [
          makeNode('e1', 'Anna Blackwood', {
            channels: [makeNode('c1', 'Existing clients'), makeNode('c2', 'New organic')],
          }),
          makeNode('e2', 'James Walker'),
        ],
      }),
      makeNode('b2', 'Branch 2', { employees: [] }),
      makeNode('b3', 'Branch 3'),
    ],
  });

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('flattenVisibleRows', () => {
  it('shows the company alone when nothing is expanded', () => {
    const rows = flattenVisibleRows(company(), new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'company',
      name: 'Company',
      parentId: null,
      level: 1,
      posInSet: 1,
      setSize: 1,
      hasChildren: true,
      kind: 'company',
    });
  });

  it('walks depth-first, so a branch is followed by its own children before the next branch', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b1', 'e1']));

    expect(idsOf(rows)).toEqual(['company', 'b1', 'e1', 'c1', 'c2', 'e2', 'b2', 'b3']);
  });

  it('counts levels from 1 and names the kind from the level', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b1', 'e1']));

    expect(rows.map((row) => [row.id, row.level, row.kind])).toEqual([
      ['company', 1, 'company'],
      ['b1', 2, 'branch'],
      ['e1', 3, 'adviser'],
      ['c1', 4, 'channel'],
      ['c2', 4, 'channel'],
      ['e2', 3, 'adviser'],
      ['b2', 2, 'branch'],
      ['b3', 2, 'branch'],
    ]);
  });

  it('numbers each row among its own siblings, 1-based (FR4-AC1)', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b1', 'e1']));
    const position = (id: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      return [row?.posInSet, row?.setSize];
    };

    expect(position('company')).toEqual([1, 1]);
    expect(position('b1')).toEqual([1, 3]);
    expect(position('b2')).toEqual([2, 3]);
    expect(position('b3')).toEqual([3, 3]);
    expect(position('e1')).toEqual([1, 2]);
    expect(position('e2')).toEqual([2, 2]);
    expect(position('c1')).toEqual([1, 2]);
    expect(position('c2')).toEqual([2, 2]);
  });

  it('carries each row back to its parent', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b1', 'e1']));
    const parentOf = (id: string) => rows.find((row) => row.id === id)?.parentId;

    expect(parentOf('company')).toBeNull();
    expect(parentOf('b1')).toBe('company');
    expect(parentOf('e1')).toBe('b1');
    expect(parentOf('c1')).toBe('e1');
  });

  it('is a leaf when the child list is missing and when it is merely empty (FR1-AC4)', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b1', 'e1']));
    const hasChildren = (id: string) => rows.find((row) => row.id === id)?.hasChildren;

    // `employees: []` — defined but empty — is as much a leaf as no key at all.
    expect(hasChildren('b2')).toBe(false);
    expect(hasChildren('b3')).toBe(false);
    expect(hasChildren('e2')).toBe(false);
    expect(hasChildren('c1')).toBe(false);
    expect(hasChildren('b1')).toBe(true);
  });

  it('never opens a leaf, even when its id is in the expanded set', () => {
    const rows = flattenVisibleRows(company(), new Set(['company', 'b2', 'b3']));

    expect(idsOf(rows)).toEqual(['company', 'b1', 'b2', 'b3']);
  });

  it('shows a company with no branches as a single row with nothing to open (FR7-AC3)', () => {
    const rows = flattenVisibleRows(makeNode('company', 'Company'), new Set(['company']));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'company', hasChildren: false, level: 1, setSize: 1 });
  });

  it('shows the figures exactly as the node stores them, never a sum of the rows beneath', () => {
    const tree = makeNode('company', 'Company', {
      branches: [makeNode('b1', 'Branch 1'), makeNode('b2', 'Branch 2')],
    });
    tree.values = Array.from({ length: 12 }, (_, month) => 250 + month);

    const rows = flattenVisibleRows(tree, new Set(['company']));

    expect(rows[0]?.values).toEqual(tree.values);
    expect(rows[0]?.values[0]).toBe(250);
  });
});

import { readFileSync } from 'node:fs';
import type { TreeNode } from '@nevis/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  countNodes,
  findDiscrepancies,
  formatDiscrepancy,
  reportDiscrepancies,
  type Discrepancy,
} from './consistency.js';

/** The payload exactly as the brief supplies it — seven of its figures do not add up (spec 004 FR2). */
const shipped = JSON.parse(
  readFileSync(new URL('./data/clients.json', import.meta.url), 'utf8'),
) as TreeNode;

/** Every month the same figure — enough to make a tree whose parents are exactly their children. */
const flat = (figure: number): number[] => Array.from({ length: 12 }, () => figure);

/**
 * A small tree in which every parent equals the sum of its children, with a leaf at every level:
 * Branch 2 has no advisers, James Walker has no channels. The shipped data no longer adds up, so
 * the "break one figure, see one report" tests need a base that does.
 */
const consistent = (): TreeNode => ({
  id: 'company',
  name: 'Company',
  values: flat(60),
  branches: [
    {
      id: 'branch-1',
      name: 'Branch 1',
      values: flat(40),
      employees: [
        {
          id: 'anna',
          name: 'Anna Blackwood',
          values: flat(28),
          channels: [
            { id: 'existing', name: 'Existing clients', values: flat(26) },
            { id: 'organic', name: 'New organic', values: flat(1) },
            { id: 'paid', name: 'New paid', values: flat(1) },
          ],
        },
        { id: 'james', name: 'James Walker', values: flat(12) },
      ],
    },
    { id: 'branch-2', name: 'Branch 2', values: flat(20) },
  ],
});

/** Company > Branch 1 > Anna Blackwood — an adviser with three channels. */
const anna = (company: TreeNode): TreeNode => company.branches![0]!.employees![0]!;

/** Index of 2024-04 in the twelve-month window. */
const APRIL = 2;

/**
 * The seven places the supplied figures disagree with the rows beneath them, pinned so a later
 * data edit cannot silently change what we claim about them (spec 004 §2.2, grill D4).
 * `actual` is the figure as supplied; `expected` is what its children add up to.
 */
const SUPPLIED_DISCREPANCIES: Discrepancy[] = [
  { path: ['Company'], month: '2024-05', expected: 279, actual: 301 },
  { path: ['Company', 'Branch 1'], month: '2024-08', expected: 216, actual: 214 },
  { path: ['Company', 'Branch 1', 'Anna Blackwood'], month: '2024-05', expected: 30, actual: 31 },
  { path: ['Company', 'Branch 1', 'Anna Blackwood'], month: '2024-06', expected: 33, actual: 32 },
  { path: ['Company', 'Branch 1', 'Anna Blackwood'], month: '2024-07', expected: 35, actual: 34 },
  { path: ['Company', 'Branch 1', 'Anna Blackwood'], month: '2024-08', expected: 36, actual: 38 },
  { path: ['Company', 'Branch 1', 'Anna Blackwood'], month: '2024-09', expected: 28, actual: 27 },
];

describe('the supplied data', () => {
  it('disagrees with itself in exactly seven places, pinned by path, month, expected and actual', () => {
    expect(findDiscrepancies(shipped)).toEqual(SUPPLIED_DISCREPANCIES);
  });
});

describe('findDiscrepancies', () => {
  it('finds nothing in a tree whose parents equal their children', () => {
    expect(findDiscrepancies(consistent())).toEqual([]);
  });

  it('reports exactly one entry when a leaf figure is broken: the leaf’s parent, that month', () => {
    const company = consistent();
    anna(company).channels![0]!.values[APRIL]! += 5; // Existing clients 2024-04: 26 → 31

    expect(findDiscrepancies(company)).toEqual<Discrepancy[]>([
      {
        path: ['Company', 'Branch 1', 'Anna Blackwood'],
        month: '2024-04',
        expected: 33,
        actual: 28,
      },
    ]);
  });

  it('reports two entries when a middle figure is broken: the node vs. its children, its parent vs. it', () => {
    const company = consistent();
    anna(company).values[APRIL]! += 1; // Anna Blackwood 2024-04: 28 → 29

    expect(findDiscrepancies(company)).toEqual<Discrepancy[]>([
      { path: ['Company', 'Branch 1'], month: '2024-04', expected: 41, actual: 40 },
      {
        path: ['Company', 'Branch 1', 'Anna Blackwood'],
        month: '2024-04',
        expected: 28,
        actual: 29,
      },
    ]);
  });

  it('reports the root when the company total is off', () => {
    const company = consistent();
    company.values[0]! -= 1;

    expect(findDiscrepancies(company)).toEqual<Discrepancy[]>([
      { path: ['Company'], month: '2024-02', expected: 60, actual: 59 },
    ]);
  });

  it('treats a missing or empty child list as a leaf', () => {
    const company = consistent();
    anna(company).channels = []; // an empty list is a leaf too
    anna(company).values = flat(0);
    company.branches![0]!.values = flat(12);
    company.values = flat(32);

    expect(findDiscrepancies(company)).toEqual([]);
  });

  it('never mutates its input', () => {
    const company = consistent();
    anna(company).values[APRIL]! += 1;
    const before = structuredClone(company);

    findDiscrepancies(company);

    expect(company).toEqual(before);
  });
});

describe('countNodes', () => {
  it('counts the 12 items of the shipped tree', () => {
    expect(countNodes(shipped)).toBe(12);
  });
});

describe('formatDiscrepancy', () => {
  it('renders the documented warning line', () => {
    expect(
      formatDiscrepancy({
        path: ['Company', 'Branch 1', 'Anna Blackwood'],
        month: '2024-04',
        expected: 33,
        actual: 28,
      }),
    ).toBe('"Company > Branch 1 > Anna Blackwood" 2024-04: parent 28, children sum 33');
  });
});

describe('reportDiscrepancies', () => {
  const fakeLogger = () => ({ warn: vi.fn(), log: vi.fn() });

  it('logs only the count for consistent data', () => {
    const logger = fakeLogger();

    expect(reportDiscrepancies(consistent(), logger)).toEqual([]);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledExactlyOnceWith('Checked 8 nodes: 0 discrepancies');
  });

  it('reports the shipped data: seven warnings, then the count over its 12 items', () => {
    const logger = fakeLogger();

    expect(reportDiscrepancies(shipped, logger)).toEqual(SUPPLIED_DISCREPANCIES);

    expect(logger.warn.mock.calls.map(([line]) => String(line))).toEqual([
      '"Company" 2024-05: parent 301, children sum 279',
      '"Company > Branch 1" 2024-08: parent 214, children sum 216',
      '"Company > Branch 1 > Anna Blackwood" 2024-05: parent 31, children sum 30',
      '"Company > Branch 1 > Anna Blackwood" 2024-06: parent 32, children sum 33',
      '"Company > Branch 1 > Anna Blackwood" 2024-07: parent 34, children sum 35',
      '"Company > Branch 1 > Anna Blackwood" 2024-08: parent 38, children sum 36',
      '"Company > Branch 1 > Anna Blackwood" 2024-09: parent 27, children sum 28',
    ]);
    expect(logger.log).toHaveBeenCalledExactlyOnceWith('Checked 12 nodes: 7 discrepancies');
  });

  it('warns one line per discrepancy, then logs the count', () => {
    const company = consistent();
    anna(company).channels![0]!.values[APRIL]! += 5;
    const logger = fakeLogger();

    reportDiscrepancies(company, logger);

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      '"Company > Branch 1 > Anna Blackwood" 2024-04: parent 28, children sum 33',
    );
    expect(logger.log).toHaveBeenCalledExactlyOnceWith('Checked 8 nodes: 1 discrepancy');
  });
});

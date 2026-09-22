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

const shipped = JSON.parse(
  readFileSync(new URL('./data/clients.json', import.meta.url), 'utf8'),
) as TreeNode;

const copy = (): TreeNode => structuredClone(shipped);

/** Company > Branch 1 > Anna Blackwood — an adviser with three channels. */
const anna = (company: TreeNode): TreeNode => company.branches![0]!.employees![0]!;

/** Index of 2024-04 in the twelve-month window. */
const APRIL = 2;

describe('findDiscrepancies', () => {
  it('finds nothing in the shipped data', () => {
    expect(findDiscrepancies(shipped)).toEqual([]);
  });

  it('reports exactly one entry when a leaf figure is broken: the leaf’s parent, that month', () => {
    const company = copy();
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
    const company = copy();
    anna(company).values[APRIL]! += 1; // Anna Blackwood 2024-04: 28 → 29

    expect(findDiscrepancies(company)).toEqual<Discrepancy[]>([
      { path: ['Company', 'Branch 1'], month: '2024-04', expected: 167, actual: 166 },
      {
        path: ['Company', 'Branch 1', 'Anna Blackwood'],
        month: '2024-04',
        expected: 28,
        actual: 29,
      },
    ]);
  });

  it('reports the root when the company total is off', () => {
    const company = copy();
    company.values[0]! -= 1;

    expect(findDiscrepancies(company)).toEqual<Discrepancy[]>([
      { path: ['Company'], month: '2024-02', expected: 250, actual: 249 },
    ]);
  });

  it('treats a missing or empty child list as a leaf', () => {
    const company = copy();
    delete company.branches![2]!.employees;
    company.branches![1]!.employees![0]!.channels = [];

    expect(findDiscrepancies(company)).toEqual([]);
  });

  it('never mutates its input', () => {
    const company = copy();
    anna(company).values[APRIL]! += 1;
    const before = structuredClone(company);

    findDiscrepancies(company);

    expect(company).toEqual(before);
  });
});

describe('countNodes', () => {
  it('counts the 44 items of the shipped tree', () => {
    expect(countNodes(shipped)).toBe(44);
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

    expect(reportDiscrepancies(shipped, logger)).toEqual([]);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledExactlyOnceWith('Checked 44 nodes: 0 discrepancies');
  });

  it('warns one line per discrepancy, then logs the count', () => {
    const company = copy();
    anna(company).channels![0]!.values[APRIL]! += 5;
    const logger = fakeLogger();

    reportDiscrepancies(company, logger);

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      '"Company > Branch 1 > Anna Blackwood" 2024-04: parent 28, children sum 33',
    );
    expect(logger.log).toHaveBeenCalledExactlyOnceWith('Checked 44 nodes: 1 discrepancy');
  });
});

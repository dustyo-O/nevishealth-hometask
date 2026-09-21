import { MONTHS } from '@nevis/contracts';
import { describe, expect, it } from 'vitest';
import { formatBranchCount, formatPeriod } from './summaries';
import { clientsFixture, makeNode } from '@/test/fixtures/clients';

describe('formatPeriod', () => {
  it('is "12 months · Feb 2024 – Jan 2025" for the shipped months (U+00B7, U+2013)', () => {
    const text = formatPeriod([...MONTHS]);

    expect(text).toBe('12 months \u00B7 Feb 2024 \u2013 Jan 2025');
    expect(text).toBe('12 months · Feb 2024 – Jan 2025');
  });

  it('counts whatever it is given', () => {
    expect(formatPeriod(['2024-11', '2024-12'])).toBe('2 months · Nov 2024 – Dec 2024');
    expect(formatPeriod(['2024-11'])).toBe('1 month · Nov 2024 – Nov 2024');
  });
});

describe('formatBranchCount', () => {
  it('names the top item and counts its branches (FR5-AC1/2/3, D-12)', () => {
    expect(formatBranchCount(clientsFixture().company)).toBe('Company · 3 branches');
    expect(
      formatBranchCount(
        makeNode('c', 'Company', { branches: [makeNode('b1', 'B1'), makeNode('b2', 'B2')] }),
      ),
    ).toBe('Company · 2 branches');
    expect(formatBranchCount(makeNode('c', 'Company', { branches: [makeNode('b1', 'B1')] }))).toBe(
      'Company · 1 branch',
    );
    expect(formatBranchCount(makeNode('c', 'Company'))).toBe('Company · 0 branches');
    expect(formatBranchCount(makeNode('c', 'Company', { branches: [] }))).toBe(
      'Company · 0 branches',
    );
  });

  it('uses the middle dot, not a hyphen or bullet', () => {
    expect(formatBranchCount(clientsFixture().company)).toContain('\u00B7');
  });
});

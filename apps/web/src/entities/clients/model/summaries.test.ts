import { describe, expect, it } from 'vitest';
import { formatBranchCount } from './summaries';
import { clientsFixture, makeNode } from '@/test/fixtures/clients';

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

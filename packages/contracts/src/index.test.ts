import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  CHILD_KEYS,
  childrenOf,
  ClientsResponseSchema,
  MONTHS,
  TreeNodeSchema,
  type ClientsResponse,
  type TreeNode,
} from './index.ts';

const shippedCompany = JSON.parse(
  readFileSync(new URL('../../../context/inbox/data.json', import.meta.url), 'utf8'),
) as TreeNode;

const envelope = (): ClientsResponse => ({
  months: [...MONTHS],
  company: structuredClone(shippedCompany),
});

const leaf = (overrides: Partial<TreeNode> = {}): TreeNode => ({
  id: 'leaf',
  name: 'Leaf',
  values: Array.from({ length: 12 }, () => 1),
  ...overrides,
});

describe('MONTHS', () => {
  it('lists the twelve months from 2024-02 to 2025-01 in order', () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe('2024-02');
    expect(MONTHS[11]).toBe('2025-01');
    expect(MONTHS.every((m) => /^\d{4}-\d{2}$/.test(m))).toBe(true);
  });
});

describe('ClientsResponseSchema', () => {
  it('accepts the shipped envelope', () => {
    const result = ClientsResponseSchema.safeParse(envelope());
    expect(result.success).toBe(true);
  });

  it('rejects an item with eleven values', () => {
    const doc = envelope();
    doc.company.branches![0]!.employees![0]!.channels![0]!.values.pop();
    expect(ClientsResponseSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an item without an id', () => {
    const doc = envelope();
    const { id: _dropped, ...withoutId } = doc.company.branches![1]!;
    doc.company.branches![1] = withoutId as TreeNode;
    expect(ClientsResponseSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an item without a name', () => {
    const doc = envelope();
    const { name: _dropped, ...withoutName } = doc.company;
    expect(ClientsResponseSchema.safeParse({ ...doc, company: withoutName }).success).toBe(false);
  });

  it('rejects a document without months', () => {
    const { months: _dropped, ...withoutMonths } = envelope();
    expect(ClientsResponseSchema.safeParse(withoutMonths).success).toBe(false);
  });

  it('rejects a month list that is not twelve ISO year-months', () => {
    expect(
      ClientsResponseSchema.safeParse({ ...envelope(), months: MONTHS.slice(1) }).success,
    ).toBe(false);
    const notIso = [...MONTHS] as string[];
    notIso[0] = 'Feb 2024';
    expect(ClientsResponseSchema.safeParse({ ...envelope(), months: notIso }).success).toBe(false);
  });

  it('rejects a document without a company', () => {
    const { company: _dropped, ...withoutCompany } = envelope();
    expect(ClientsResponseSchema.safeParse(withoutCompany).success).toBe(false);
  });

  it('rejects an item that carries two non-empty child lists', () => {
    const doc = envelope();
    doc.company.branches![0]!.channels = [leaf()];
    const result = ClientsResponseSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/at most one child list/);
  });

  it('rejects an item that defines a populated list and an empty one (FR2: never two at once)', () => {
    const doc = envelope();
    doc.company.branches![0]!.channels = [];
    const result = ClientsResponseSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/employees, channels/);
  });

  it('rejects an item that defines two empty child lists', () => {
    const doc = envelope();
    doc.company.branches![2]!.employees = [];
    doc.company.branches![2]!.channels = [];
    expect(ClientsResponseSchema.safeParse(doc).success).toBe(false);
    expect(TreeNodeSchema.safeParse(leaf({ branches: [], employees: [] })).success).toBe(false);
  });

  it('accepts a branch without advisers and an adviser without channels (missing lists)', () => {
    const doc = envelope();
    delete doc.company.branches![2]!.employees;
    delete doc.company.branches![0]!.employees![0]!.channels;
    expect(ClientsResponseSchema.safeParse(doc).success).toBe(true);
  });

  it('accepts a single empty child list as a leaf', () => {
    const doc = envelope();
    doc.company.branches![2]!.employees = [];
    doc.company.branches![0]!.employees![0]!.channels = [];
    expect(ClientsResponseSchema.safeParse(doc).success).toBe(true);
    expect(TreeNodeSchema.safeParse(leaf({ channels: [] })).success).toBe(true);
  });
});

describe('TreeNodeSchema', () => {
  it('strips unknown keys and keeps the known shape', () => {
    const parsed = TreeNodeSchema.parse({ ...leaf(), extra: true });
    expect(parsed).toEqual(leaf());
  });

  it('rejects non-finite figures', () => {
    expect(
      TreeNodeSchema.safeParse(leaf({ values: [...leaf().values.slice(1), NaN] })).success,
    ).toBe(false);
  });
});

describe('childrenOf', () => {
  it('returns the single non-empty list in branches → employees → channels order', () => {
    expect(CHILD_KEYS).toEqual(['branches', 'employees', 'channels']);
    const company = envelope().company;
    expect(childrenOf(company)).toBe(company.branches);
    const branch = company.branches![0]!;
    expect(childrenOf(branch)).toBe(branch.employees);
    const adviser = branch.employees![0]!;
    expect(childrenOf(adviser)).toBe(adviser.channels);
  });

  it('returns [] for a leaf, whether its lists are missing or empty', () => {
    expect(childrenOf(leaf())).toEqual([]);
    expect(childrenOf(leaf({ branches: [], employees: [], channels: [] }))).toEqual([]);
  });
});

describe('types', () => {
  it('keeps the recursive child lists typed (no erosion to any)', () => {
    expectTypeOf<TreeNode['branches']>().not.toBeAny();
    expectTypeOf<TreeNode['branches']>().toEqualTypeOf<TreeNode[] | undefined>();
    expectTypeOf<z.output<typeof TreeNodeSchema>>().toEqualTypeOf<TreeNode>();
    expectTypeOf<z.output<typeof ClientsResponseSchema>>().toEqualTypeOf<ClientsResponse>();
  });
});

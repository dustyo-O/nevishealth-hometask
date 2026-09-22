import { z } from 'zod';

/** The twelve months the shipped figures cover, in order (spec 001 FR2). */
export const MONTHS = [
  '2024-02',
  '2024-03',
  '2024-04',
  '2024-05',
  '2024-06',
  '2024-07',
  '2024-08',
  '2024-09',
  '2024-10',
  '2024-11',
  '2024-12',
  '2025-01',
] as const;

export type Month = (typeof MONTHS)[number];

/**
 * One item of the company tree: the company, a branch, an adviser (`employees`) or a channel.
 * A node defines at most one child list — never two, even if the extra one is empty (FR2);
 * a node whose single list is missing or empty is the end of its line.
 * The `| undefined` is required under `exactOptionalPropertyTypes` (tech doc D-4).
 */
export type TreeNode = {
  id: string;
  name: string;
  values: number[];
  branches?: TreeNode[] | undefined;
  employees?: TreeNode[] | undefined;
  channels?: TreeNode[] | undefined;
};

/** The `GET /api/clients` envelope. */
export type ClientsResponse = {
  months: string[];
  company: TreeNode;
};

/** The three child lists a node may carry, in the order the tree nests them. */
export const CHILD_KEYS = ['branches', 'employees', 'channels'] as const;

export type ChildKey = (typeof CHILD_KEYS)[number];

const definedChildKeys = (node: TreeNode): ChildKey[] =>
  CHILD_KEYS.filter((key) => node[key] !== undefined);

const populatedChildKeys = (node: TreeNode): ChildKey[] =>
  CHILD_KEYS.filter((key) => (node[key]?.length ?? 0) > 0);

/**
 * The one definition of "children" shared by the API's consistency check and the web's flatten:
 * the single non-empty child list (the schema guarantees at most one is defined), `[]` for a leaf.
 */
export const childrenOf = (node: TreeNode): TreeNode[] => {
  const key = populatedChildKeys(node)[0];
  return key === undefined ? [] : (node[key] ?? []);
};

const MonthValuesSchema = z.array(z.number()).length(12);

/**
 * Explicitly annotated so the recursive node never erodes to `any[]` in consumers (D-4).
 * Unknown keys are stripped; `z.number()` rejects NaN and ±Infinity.
 */
export const TreeNodeSchema: z.ZodType<TreeNode> = z
  .object({
    id: z.string(),
    name: z.string(),
    values: MonthValuesSchema,
    branches: z.array(z.lazy(() => TreeNodeSchema)).optional(),
    employees: z.array(z.lazy(() => TreeNodeSchema)).optional(),
    channels: z.array(z.lazy(() => TreeNodeSchema)).optional(),
  })
  .superRefine((node, ctx) => {
    // FR2: "never two of these at once" — an empty extra list is still a second kind of list.
    const defined = definedChildKeys(node);
    if (defined.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: `An item may define at most one child list, got: ${defined.join(', ')}`,
      });
    }
  });

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const ClientsResponseSchema: z.ZodType<ClientsResponse> = z.object({
  months: z.array(z.string().regex(ISO_MONTH)).length(12),
  company: TreeNodeSchema,
});

import { MONTHS, type ClientsResponse, type TreeNode } from '@nevis/contracts';

type ChildLists = Pick<TreeNode, 'branches' | 'employees' | 'channels'>;

/** Twelve monthly figures — the web never checks sums, so the value does not matter. */
export const twelveValues = (value = 1): number[] => Array.from({ length: 12 }, () => value);

export const makeNode = (
  id: string,
  name: string,
  children: Partial<ChildLists> = {},
): TreeNode => ({
  id,
  name,
  values: twelveValues(),
  ...children,
});

/** A valid envelope in the shipped shape: Company → 3 branches → advisers → channels. Fresh object per call. */
export const clientsFixture = (): ClientsResponse => ({
  months: [...MONTHS],
  company: makeNode('company', 'Company', {
    branches: [
      makeNode('b1', 'Branch 1', {
        employees: [
          makeNode('e1', 'Anna Blackwood', {
            channels: [makeNode('c1', 'Referral'), makeNode('c2', 'Web')],
          }),
        ],
      }),
      makeNode('b2', 'Branch 2', { employees: [makeNode('e2', 'Ben Carter')] }),
      makeNode('b3', 'Branch 3'),
    ],
  }),
});

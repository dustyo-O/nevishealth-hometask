import { MONTHS, type ClientsResponse } from '@nevis/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/shared/api';
import { ClientsTable } from './clients-table';

const HEADINGS = [
  'Feb 2024',
  'Mar 2024',
  'Apr 2024',
  'May 2024',
  'Jun 2024',
  'Jul 2024',
  'Aug 2024',
  'Sep 2024',
  'Oct 2024',
  'Nov 2024',
  'Dec 2024',
  'Jan 2025',
];

/**
 * The shipped data cannot prove FR1-AC2, because there every parent happens to equal the sum of
 * its children (review 2 F4). Here the Company's figures are deliberately nothing like the two
 * branches beneath it: if the table ever started adding rows up, these numbers would change.
 */
const COMPANY = [250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350];
const BRANCH_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const BRANCH_2 = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];

const fixture = (): ClientsResponse => ({
  months: [...MONTHS],
  company: {
    id: 'company',
    name: 'Company',
    values: [...COMPANY],
    branches: [
      {
        id: 'b1',
        name: 'Branch 1',
        values: [...BRANCH_1],
        employees: [{ id: 'e1', name: 'Anna Blackwood', values: [...BRANCH_2] }],
      },
      { id: 'b2', name: 'Branch 2', values: [...BRANCH_2] },
    ],
  },
});

const mockClients = (body: ClientsResponse = fixture()) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(Response.json(body)));

const renderTable = () =>
  render(
    <QueryClientProvider client={createQueryClient({ retryDelay: 0 })}>
      <ClientsTable />
    </QueryClientProvider>,
  );

const rowNamed = (name: string): HTMLTableRowElement => {
  const header = screen.getByRole('rowheader', { name });
  const row = header.closest('tr');
  if (row === null) throw new Error(`no row for "${name}"`);
  return row;
};

const figuresOf = (name: string) =>
  [...rowNamed(name).querySelectorAll('td')].map((cell) => cell.textContent);

describe('ClientsTable (FR1)', () => {
  it('heads the twelve months in order and names the blank first column for assistive technology (FR1-AC3, FR4-AC3)', async () => {
    mockClients();
    renderTable();
    await screen.findByRole('treegrid');

    const headings = screen.getAllByRole('columnheader');
    expect(headings.map((heading) => heading.textContent)).toEqual(['Name', ...HEADINGS]);

    // The design leaves the first heading blank on screen; it is still announced (FR4-AC3).
    // That it is *invisible* is a matter of layout, so the browser proves it, not jsdom — what
    // is provable here is that the title exists and is carried by a visually-hidden element.
    const name = screen.getByRole('columnheader', { name: 'Name' });
    const title = name.querySelector('span');
    expect(title).toHaveTextContent('Name');
    expect(title?.className).toMatch(/visuallyHidden/i);
  });

  it('opens with the company showing its branches, each indented one step further (FR1-AC1)', async () => {
    mockClients();
    renderTable();
    await screen.findByRole('treegrid');

    expect(screen.getAllByRole('rowheader').map((header) => header.textContent)).toEqual([
      'Company',
      'Branch 1',
      'Branch 2',
    ]);
    expect(rowNamed('Company')).toHaveAttribute('aria-level', '1');
    expect(rowNamed('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-level', '2');
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-posinset', '1');
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-setsize', '2');
    // Branch 1 has an adviser beneath it; Branch 2 has nothing to open (FR1-AC4).
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'false');
    expect(rowNamed('Branch 2')).not.toHaveAttribute('aria-expanded');
  });

  it('shows every figure exactly as it is stored, never the sum of the rows beneath (FR1-AC2)', async () => {
    mockClients();
    renderTable();
    await screen.findByRole('treegrid');

    expect(figuresOf('Company')).toEqual(COMPANY.map(String));
    // Feb 2024 and Jan 2025 read 250 and 350 even though the branches sum to 3 and 14.
    expect(figuresOf('Company')[0]).toBe('250');
    expect(figuresOf('Company').at(-1)).toBe('350');
    expect(figuresOf('Branch 1')).toEqual(BRANCH_1.map(String));
    expect(figuresOf('Branch 2')).toEqual(BRANCH_2.map(String));
  });

  it('points every figure at its own month and its own row (FR4-AC2)', async () => {
    mockClients();
    renderTable();
    await screen.findByRole('treegrid');

    const june = within(rowNamed('Branch 1')).getByText('5');
    const [month, name] = (june.getAttribute('headers') ?? '').split(' ');
    expect(document.getElementById(month ?? '')).toHaveTextContent('Jun 2024');
    expect(document.getElementById(name ?? '')).toHaveTextContent('Branch 1');
  });

  it('shows a company with no branches as one row with nothing to open (FR7-AC3)', async () => {
    mockClients({
      months: [...MONTHS],
      company: { id: 'company', name: 'Company', values: [...COMPANY] },
    });
    renderTable();
    await screen.findByRole('treegrid');

    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(rowNamed('Company')).not.toHaveAttribute('aria-expanded');
    expect(figuresOf('Company')).toEqual(COMPANY.map(String));
  });

  it('has no accessibility violations', async () => {
    mockClients();
    const { container } = renderTable();
    await screen.findByRole('treegrid');

    expect(await axe(container)).toHaveNoViolations();
  });
});

import { MONTHS, type ClientsResponse } from '@nevis/contracts';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ClientsTable } from './clients-table';
import { clientsFixture } from '@/test/fixtures/clients';

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

/**
 * The widget as the page mounts it: already holding the figures, so it renders at once. Hands
 * back the user-event session every interacting test needs.
 */
const renderTable = (data: ClientsResponse = fixture()) => {
  const user = userEvent.setup();
  return { user, ...render(<ClientsTable data={data} />) };
};

const rowNamed = (name: string): HTMLTableRowElement => {
  const header = screen.getByRole('rowheader', { name });
  const row = header.closest('tr');
  if (row === null) throw new Error(`no row for "${name}"`);
  return row;
};

const figuresOf = (name: string) =>
  [...rowNamed(name).querySelectorAll('td')].map((cell) => cell.textContent);

describe('ClientsTable (FR1)', () => {
  it('heads the twelve months in order and names the blank first column for assistive technology (FR1-AC3, FR4-AC3)', () => {
    renderTable();

    const headings = screen.getAllByRole('columnheader');
    expect(headings.map((heading) => heading.textContent)).toEqual(['Name', ...HEADINGS]);

    // The design leaves the first heading blank on screen; it is still announced (FR4-AC3).
    // That it is *invisible* is a matter of layout, so the browser proves it, not jsdom — what
    // is provable here is that assistive technology is given the title.
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });

  it('opens with the company showing its branches, each indented one step further (FR1-AC1)', () => {
    renderTable();

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

  it('shows every figure exactly as it is stored, never the sum of the rows beneath (FR1-AC2)', () => {
    renderTable();

    expect(figuresOf('Company')).toEqual(COMPANY.map(String));
    // Feb 2024 and Jan 2025 read 250 and 350 even though the branches sum to 3 and 14.
    expect(figuresOf('Company')[0]).toBe('250');
    expect(figuresOf('Company').at(-1)).toBe('350');
    expect(figuresOf('Branch 1')).toEqual(BRANCH_1.map(String));
    expect(figuresOf('Branch 2')).toEqual(BRANCH_2.map(String));
  });

  it('points every figure at its own month and its own row (FR4-AC2)', () => {
    renderTable();

    const june = within(rowNamed('Branch 1')).getByText('5');
    const [month, name] = (june.getAttribute('headers') ?? '').split(' ');
    expect(document.getElementById(month ?? '')).toHaveTextContent('Jun 2024');
    expect(document.getElementById(name ?? '')).toHaveTextContent('Branch 1');
  });

  it('shows a company with no branches as one row with nothing to open (FR7-AC3)', () => {
    renderTable({
      months: [...MONTHS],
      company: { id: 'company', name: 'Company', values: [...COMPANY] },
    });

    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(rowNamed('Company')).not.toHaveAttribute('aria-expanded');
    expect(figuresOf('Company')).toEqual(COMPANY.map(String));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderTable();

    expect(await axe(container)).toHaveNoViolations();
  });
});

/** A row's name as printed: the element carrying the full name for a pointer (FR5-AC3). */
const labelOf = (header: HTMLElement) => header.querySelector('[title]');

const clickName = async (user: UserEvent, name: string) => {
  await user.click(screen.getByRole('rowheader', { name }));
};

/**
 * The names as a screen reader reads them down the table: the adviser's circle is `aria-hidden`
 * decoration, so it is no part of a row's name however much text it happens to hold (FR5-AC2).
 */
const visibleNames = () =>
  screen.getAllByRole('rowheader').map((header) => labelOf(header)?.textContent);

/**
 * The shipped shape, from the shared fixture: Company → three branches, one of them with an
 * adviser who has channels, one with an adviser, one with nothing beneath it. Everything FR2
 * asks about — independence, nesting and a leaf — is already in it.
 */
describe('ClientsTable — opening and closing a row with the mouse (FR2)', () => {
  it('opens a row when its name is clicked, one level at a time (FR2-AC1)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');

    expect(visibleNames()).toEqual([
      'Company',
      'Branch 1',
      'Anna Blackwood',
      'Branch 2',
      'Branch 3',
    ]);
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'true');
    // One step further than the branch that owns them (FR1, FR2-AC1).
    expect(rowNamed('Anna Blackwood')).toHaveAttribute('aria-level', '3');
  });

  it('closes it again when the name is clicked a second time (FR2-AC2)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');
    await clickName(user, 'Branch 1');

    // Rows linger while they animate out (D-8), so wait for them to go rather than count now.
    await waitFor(() => {
      expect(screen.queryByRole('rowheader', { name: 'Anna Blackwood' })).not.toBeInTheDocument();
    });
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a re-opened branch with its own children closed again (FR2-AC3)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');
    await clickName(user, 'Anna Blackwood');
    expect(visibleNames()).toContain('Referral');

    await clickName(user, 'Branch 1');
    await waitFor(() => {
      expect(screen.queryByRole('rowheader', { name: 'Referral' })).not.toBeInTheDocument();
    });

    await clickName(user, 'Branch 1');
    expect(screen.getByRole('rowheader', { name: 'Anna Blackwood' })).toBeInTheDocument();
    expect(rowNamed('Anna Blackwood')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('rowheader', { name: 'Referral' })).not.toBeInTheDocument();
  });

  it('leaves the branches beside it open (FR2-AC4)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');
    await clickName(user, 'Branch 2');

    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'true');
    expect(rowNamed('Branch 2')).toHaveAttribute('aria-expanded', 'true');
    expect(visibleNames()).toEqual([
      'Company',
      'Branch 1',
      'Anna Blackwood',
      'Branch 2',
      'Ben Carter',
      'Branch 3',
    ]);
  });

  it('does nothing at all when a monthly figure is clicked (FR2-AC5)', async () => {
    const { user } = renderTable(clientsFixture());

    const before = visibleNames();
    const [figure] = [...rowNamed('Branch 1').querySelectorAll('td')];
    expect(figure).toBeDefined();
    await user.click(figure as HTMLTableCellElement);

    expect(visibleNames()).toEqual(before);
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'false');
    // Nothing on a figure listens for a click at all.
    expect(figure).not.toHaveAttribute('onclick');
  });

  it('offers nothing to open on a row with nothing beneath it (FR1-AC4)', async () => {
    const { user } = renderTable(clientsFixture());

    const before = visibleNames();
    await clickName(user, 'Branch 3');

    expect(visibleNames()).toEqual(before);
    expect(rowNamed('Branch 3')).not.toHaveAttribute('aria-expanded');
  });

  it('has no accessibility violations with rows opened (FR2)', async () => {
    const { user, container } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');
    await clickName(user, 'Anna Blackwood');

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The adviser's circle: the one piece of decoration in the name cell that carries letters. The
 * chevron slot beside it is decoration too, but draws only an arrow.
 */
const avatarIn = (name: string) =>
  [...rowNamed(name).querySelectorAll('th [aria-hidden="true"]')].find(
    (element) => element.textContent !== '',
  ) ?? null;

describe('ClientsTable — reading a row (FR5)', () => {
  it('puts an adviser’s initials before the name and nobody else’s (FR5-AC1)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');
    await clickName(user, 'Anna Blackwood');

    expect(avatarIn('Anna Blackwood')).toHaveTextContent('AB');
    // The design shows a photograph on advisers only: not on the company, a branch or a channel.
    expect(avatarIn('Company')).toBeNull();
    expect(avatarIn('Branch 1')).toBeNull();
    expect(avatarIn('Branch 3')).toBeNull();
    expect(avatarIn('Referral')).toBeNull();
  });

  it('lets a screen reader read the name and pass over the circle (FR5-AC2)', async () => {
    const { user } = renderTable(clientsFixture());

    await clickName(user, 'Branch 1');

    expect(avatarIn('Anna Blackwood')).toHaveAttribute('aria-hidden', 'true');
    // The row's name is the adviser's, not "AB Anna Blackwood".
    expect(screen.getByRole('rowheader', { name: 'Anna Blackwood' })).toBeInTheDocument();
  });

  it('carries the full name for a pointer, however the column shortens it (FR5-AC3)', () => {
    renderTable(clientsFixture());

    const label = screen.getByTitle('Branch 1');
    expect(label).toHaveAttribute('title', 'Branch 1');
    expect(label).toHaveTextContent('Branch 1');
  });
});

/**
 * The table with something before and after it, because "Tab moves into the table once and out
 * again" is a claim about the page around it (FR3-AC1). The generic grid has its own keyboard
 * tests; what is proved here is that this widget wires the same model to the real names and
 * the real months — a missing `onKeyDown` would leave those tests perfectly green.
 */
const renderPage = (data: ClientsResponse) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <>
        <button type="button">before</button>
        <ClientsTable data={data} />
        <button type="button">after</button>
      </>,
    ),
  };
};

const tabStops = () => [...screen.getByRole('treegrid').querySelectorAll('[tabindex="0"]')];

const enterTable = async (data: ClientsResponse): Promise<UserEvent> => {
  const { user } = renderPage(data);
  screen.getByRole('button', { name: 'before' }).focus();
  await user.tab();
  return user;
};

/**
 * The outline is on that row's first month, named by the two headings a screen reader reads
 * off it (D-11) — never a bare number (FR4-AC2).
 */
const expectFirstMonthOf = (name: string) => {
  const [month, row] = (document.activeElement?.getAttribute('headers') ?? '').split(' ');
  expect(document.getElementById(month ?? '')).toHaveTextContent('Feb 2024');
  expect(document.getElementById(row ?? '')).toHaveTextContent(name);
};

/** Every step leaves one way into the table, and it is where the outline is (D-9). */
const press = async (user: UserEvent, keys: string) => {
  await user.keyboard(keys);
  expect(tabStops()).toHaveLength(1);
  expect(tabStops()[0]).toBe(document.activeElement);
};

describe('ClientsTable — operating the real table from the keyboard (FR3)', () => {
  it('takes one Tab to reach the Company row and one more to leave (FR3-AC1)', async () => {
    const user = await enterTable(clientsFixture());

    expect(document.activeElement).toBe(rowNamed('Company'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
  });

  it('enters Branch 1’s figures with Right whether it is closed or open (FR3-AC2, FR3-AC3)', async () => {
    const user = await enterTable(clientsFixture());

    // Closed: Right moves into the months and leaves the row shut (FR3-AC2).
    await press(user, '{ArrowDown}{ArrowRight}');
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('rowheader', { name: 'Anna Blackwood' })).not.toBeInTheDocument();
    expectFirstMonthOf('Branch 1');

    // Opened by the one key that opens it, Right means exactly the same thing (FR3-AC3) — which
    // is the whole point of the amendment: it no longer depends on a state the user cannot see.
    await press(user, '{ArrowLeft}{Enter}');
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('rowheader', { name: 'Anna Blackwood' })).toBeInTheDocument();

    await press(user, '{ArrowRight}');
    expectFirstMonthOf('Branch 1');
  });

  it('moves the outline onto Branch 1 when a click closes the row it was inside (FR2-AC6, FR2-AC7)', async () => {
    const user = await enterTable(clientsFixture());

    // Company → Branch 1 → Enter → Anna Blackwood → Enter → Referral → into its months.
    await press(user, '{ArrowDown}{Enter}{ArrowDown}{Enter}{ArrowDown}');
    expect(document.activeElement).toBe(rowNamed('Referral'));
    await press(user, '{ArrowRight}{ArrowRight}');
    expect(rowNamed('Referral').contains(document.activeElement)).toBe(true);

    await clickName(user, 'Branch 1');

    await waitFor(() => {
      expect(screen.queryByRole('rowheader', { name: 'Referral' })).not.toBeInTheDocument();
    });
    expect(tabStops()).toEqual([rowNamed('Branch 1')]);
    expect(document.activeElement).toBe(rowNamed('Branch 1'));

    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(rowNamed('Branch 2'));
  });

  it('leaves the keyboard where it was when a figure is clicked, so the next key acts there (FR2-AC5, code review F1)', async () => {
    const { user } = renderPage(clientsFixture());
    const before = screen.getByRole('button', { name: 'before' });
    before.focus();

    // Nothing in the table has focus: a click on a figure must not bring it there, or Enter
    // would act on the cursor the user cannot see — the Company row — and close it.
    await user.click(rowNamed('Branch 1').querySelectorAll('td')[4] as HTMLTableCellElement);
    expect(document.activeElement).toBe(before);
    await user.keyboard('{Enter}');
    expect(rowNamed('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(visibleNames()).toEqual(['Company', 'Branch 1', 'Branch 2', 'Branch 3']);

    // With the outline on a row, a click on another row's figure leaves it on that row, and the
    // next key moves on from there.
    await user.tab();
    expect(document.activeElement).toBe(rowNamed('Company'));
    await user.click(rowNamed('Branch 2').querySelectorAll('td')[4] as HTMLTableCellElement);
    expect(document.activeElement).toBe(rowNamed('Company'));
    await press(user, '{ArrowDown}');
    expect(document.activeElement).toBe(rowNamed('Branch 1'));
    expect(rowNamed('Branch 1')).toHaveAttribute('aria-expanded', 'false');

    // Nor does a click on a name take the outline with it: it opens and closes, and the keyboard
    // stays where the keyboard put it (the FR2-AC6/AC7 negative case).
    await clickName(user, 'Branch 3');
    await clickName(user, 'Branch 2');
    expect(document.activeElement).toBe(rowNamed('Branch 1'));
    expect(tabStops()).toEqual([rowNamed('Branch 1')]);
  });

  it('follows focus that arrives by other means than its own keys (code review F1)', async () => {
    const user = await enterTable(clientsFixture());

    // A figure focused from outside the keyboard model — a script, an assistive technology.
    const figure = rowNamed('Branch 1').querySelectorAll('td')[4] as HTMLTableCellElement;
    act(() => figure.focus());
    expect(document.activeElement).toBe(figure);

    // Enter on a figure does nothing (FR3-AC9), rather than closing the Company row the stale
    // cursor was on; and the arrows move on from the figure the outline is actually on.
    await press(user, '{Enter}');
    expect(rowNamed('Company')).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(figure);
    await press(user, '{ArrowRight}');
    expect(document.activeElement).toBe(rowNamed('Branch 1').querySelectorAll('td')[5]);
  });

  it('has no accessibility violations with the outline inside the table', async () => {
    const { user, container } = renderPage(clientsFixture());
    screen.getByRole('button', { name: 'before' }).focus();
    await user.tab();
    await press(user, '{ArrowDown}{Enter}{ArrowRight}{ArrowRight}');

    expect(await axe(container)).toHaveNoViolations();
  });
});

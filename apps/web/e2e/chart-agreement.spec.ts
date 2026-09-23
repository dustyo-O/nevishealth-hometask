// @layer: e2e
// @spec: 003-clients-trend-chart
//
// FR1-AC2, the check a reviewer will look for: in one page, the twelve bars read from the drawing
// and the twelve figures read from the table's Company row agree month by month.
//
// Why it cannot pass with only one card right: both cards are read from the screen in the same
// page — the bars as heights against the labelled axis, the table as the text of its cells — and
// compared to each other, and each is also compared to the figures the page was served, so a
// card that drifts is caught by both comparisons. The second test serves figures that are not the
// shipped ones, so neither card can pass by holding a copy of the shipped year.
import { expect, test, type Page } from '@playwright/test';
import { openChart, readBars, reshaped, type Chart } from './support/chart';
import { figureOf, MONTH_HEADINGS, shippedClients, type ClientsBody } from './support/table';

const tableCompanyRow = async (chart: Chart): Promise<number[]> => {
  const figures: number[] = [];
  for (const month of MONTH_HEADINGS) {
    const text = await figureOf(chart.ui, 'Company', month).innerText();
    figures.push(Number(text.trim()));
  }
  return figures;
};

const expectAgreement = async (page: Page, body: ClientsBody): Promise<void> => {
  const chart = await openChart(page, { body });

  const { months, exactness } = await readBars(chart);
  const table = await tableCompanyRow(chart);

  // The drawing is read exactly, not approximately: a whole client is under a pixel high.
  expect(exactness).toBeLessThan(0.05);
  expect(months).toHaveLength(12);
  expect(table).toHaveLength(12);

  MONTH_HEADINGS.forEach((month, i) => {
    const bar = months[i]!;
    const parts = bar['Existing clients'] + bar['New organic'] + bar['New paid'];
    // The three parts add up to the whole bar, and the whole bar to the table's Company row.
    expect(parts, `${month}: the three parts add up to the bar`).toBe(bar.total);
    expect(bar.total, `${month}: chart against table`).toBe(table[i]);
  });
  // And both are the company the page was served — the Company row's own stored figures.
  expect(months.map(({ total }) => total)).toEqual(body.company.values);
  expect(table).toEqual(body.company.values);
};

test(
  'FR1-AC2: on the shipped data, every bar agrees with the Company row of the table, month by month',
  { tag: '@regression' },
  async ({ page }) => {
    await expectAgreement(page, shippedClients());
  },
);

test(
  'FR1-AC2: on figures that are not the shipped ones, the two cards still agree — neither is holding a copy of the year',
  { tag: '@regression' },
  async ({ page }) => {
    // Every channel moves by a different amount each month; the stored totals above are resummed.
    const body = reshaped((value, channel, month) => value + ((channel.length + month) % 5) * 3);
    expect(body.company.values).not.toEqual(shippedClients().company.values);
    await expectAgreement(page, body);
  },
);

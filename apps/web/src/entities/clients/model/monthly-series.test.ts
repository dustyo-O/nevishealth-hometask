import { describe, expect, it } from 'vitest';
import { toMonthlySeries } from './monthly-series';
import { makeNode } from '@/test/fixtures/clients';
import { shippedClients } from '@/test/fixtures/shipped-clients';

describe('toMonthlySeries', () => {
  it('returns one point per served month, in order', () => {
    const data = shippedClients();
    const { points } = toMonthlySeries(data);
    expect(points.map((p) => p.month)).toEqual(data.months);
  });

  // What the tree records; the chart derives Existing clients from the Company row (004 §2.3).
  it('totals only what the channels record: Anna Blackwood’s, a tenth of the company (004 FR1)', () => {
    const data = shippedClients();
    const { points } = toMonthlySeries(data);
    expect(points.map((p) => p.total)).toEqual([25, 26, 28, 30, 33, 35, 36, 28, 27, 27, 27, 38]);
    for (const point of points) {
      const sum = Object.values(point.byChannel).reduce((a, b) => a + b, 0);
      expect(sum).toBe(point.total);
    }
  });

  it('groups the channels by name into three series, in first-seen order (FR1-AC5)', () => {
    const { channels } = toMonthlySeries(shippedClients());
    expect(channels).toEqual(['Existing clients', 'New organic', 'New paid']);
  });

  it('reads February 2024 as 25 / 0 / 0 of a company of 250 (004 FR1)', () => {
    const [feb] = toMonthlySeries(shippedClients()).points;
    expect(feb).toEqual({
      month: '2024-02',
      byChannel: { 'Existing clients': 25, 'New organic': 0, 'New paid': 0 },
      total: 25,
      company: 250,
    });
  });

  it("makes August 2024 and January 2025 the company's biggest months, each 350 (FR1-AC4)", () => {
    const { points } = toMonthlySeries(shippedClients());
    const max = Math.max(...points.map((p) => p.company));
    expect(max).toBe(350);
    expect(points.filter((p) => p.company === max).map((p) => p.month)).toEqual([
      '2024-08',
      '2025-01',
    ]);
  });

  it("carries the Company row's own figure for every month, as served (004 §2.3)", () => {
    const data = shippedClients();
    const { points } = toMonthlySeries(data);
    expect(points.map((p) => p.company)).toEqual(data.company.values);
  });

  it("keeps the company's figure when the channels account for only part of it, or overshoot it", () => {
    const anna = makeNode('e1', 'Anna', { channels: [makeNode('c1', 'Web')] });
    const company = makeNode('co', 'Company', {
      branches: [makeNode('b1', 'Branch 1', { employees: [anna, makeNode('e2', 'Ben')] })],
    });
    company.values = [10, 0];
    anna.channels![0]!.values = [3, 4];
    const { points } = toMonthlySeries({ months: ['2024-02', '2024-03'], company });
    expect(points).toEqual([
      { month: '2024-02', byChannel: { Web: 3 }, total: 3, company: 10 },
      { month: '2024-03', byChannel: { Web: 4 }, total: 4, company: 0 },
    ]);
  });

  it('skips an adviser with no channel list rather than throwing', () => {
    const data = {
      months: ['2024-02'],
      company: makeNode('co', 'Company', {
        branches: [
          makeNode('b1', 'Branch 1', {
            employees: [
              makeNode('e1', 'Anna', { channels: [makeNode('c1', 'Web'), makeNode('c2', 'Paid')] }),
              makeNode('e2', 'Ben'),
              makeNode('e3', 'Cleo', { channels: [makeNode('c3', 'Paid')] }),
            ],
          }),
          makeNode('b2', 'Branch 2'),
        ],
      }),
    };
    const series = toMonthlySeries(data);
    expect(series.channels).toEqual(['Web', 'Paid']);
    expect(series.points[0]).toEqual({
      month: '2024-02',
      byChannel: { Web: 1, Paid: 2 },
      total: 3,
      company: 1,
    });
  });
});

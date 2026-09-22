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

  it("adds up to the Company row's stored figure in every month (FR1-AC2)", () => {
    const data = shippedClients();
    const { points } = toMonthlySeries(data);
    expect(points.map((p) => p.total)).toEqual(data.company.values);
    for (const point of points) {
      const sum = Object.values(point.byChannel).reduce((a, b) => a + b, 0);
      expect(sum).toBe(point.total);
    }
  });

  it('groups the thirty per-adviser channels by name into three series, in first-seen order (FR1-AC5)', () => {
    const { channels } = toMonthlySeries(shippedClients());
    expect(channels).toEqual(['Existing clients', 'New organic', 'New paid']);
  });

  it('reads February 2024 as 221 / 15 / 14 = 250 (FR1-AC3)', () => {
    const [feb] = toMonthlySeries(shippedClients()).points;
    expect(feb).toEqual({
      month: '2024-02',
      byChannel: { 'Existing clients': 221, 'New organic': 15, 'New paid': 14 },
      total: 250,
    });
  });

  it('makes August 2024 and January 2025 the tallest, each 350 (FR1-AC4)', () => {
    const { points } = toMonthlySeries(shippedClients());
    const max = Math.max(...points.map((p) => p.total));
    expect(max).toBe(350);
    expect(points.filter((p) => p.total === max).map((p) => p.month)).toEqual([
      '2024-08',
      '2025-01',
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
    });
  });
});

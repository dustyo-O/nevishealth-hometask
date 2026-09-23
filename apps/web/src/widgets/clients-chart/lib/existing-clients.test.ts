import { describe, expect, it } from 'vitest';
import { toMonthlySeries, type MonthlyPoint, type MonthlySeries } from '@/entities/clients';
import { EXISTING, existingClients, withExistingClients } from './existing-clients';
import { shippedClients } from '@/test/fixtures/shipped-clients';

const CHANNELS = ['Existing clients', 'New organic', 'New paid'];

/** A month whose company figure is `company` and whose three recorded channels read `parts`. */
const month = (company: number, parts: [number, number, number], i = 0): MonthlyPoint => ({
  month: `2024-${String(i + 2).padStart(2, '0')}`,
  byChannel: Object.fromEntries(CHANNELS.map((name, c) => [name, parts[c] ?? 0])),
  total: parts.reduce((sum, value) => sum + value, 0),
  company,
});

const seriesOf = (...points: [number, [number, number, number]][]): MonthlySeries => ({
  channels: CHANNELS,
  points: points.map(([company, parts], i) => month(company, parts, i)),
});

const sumOfParts = ({ channels, points }: MonthlySeries) =>
  points.map((point) => channels.reduce((sum, name) => sum + (point.byChannel[name] ?? NaN), 0));

describe('existingClients', () => {
  it('is the recorded figure when the channels already account for every client (003 FR1)', () => {
    expect(existingClients(seriesOf([250, [221, 15, 14]], [300, [280, 10, 10]]))).toEqual([
      221, 280,
    ]);
  });

  it('is the company figure less the newly acquired, month by month (FR3-AC2)', () => {
    expect(
      existingClients(seriesOf([250, [25, 0, 0]], [301, [30, 1, 0]], [10, [10, 0, 0]])),
    ).toEqual([250, 300, 10]);
  });

  it('ignores the recorded Existing figure, even where it exceeds the company (§2.3)', () => {
    expect(existingClients(seriesOf([20, [15, 10, 5]]))).toEqual([5]);
  });

  it('is 0, never negative, in a month whose new clients exceed the company figure (F1)', () => {
    expect(existingClients(seriesOf([2, [0, 2, 1]], [40, [10, 0, 0]]))).toEqual([0, 40]);
  });

  it('is empty for a series with no months', () => {
    expect(existingClients({ channels: CHANNELS, points: [] })).toEqual([]);
  });

  it('reads the supplied payload as measured: 250, 266, 282 … 346 (§2.3)', () => {
    expect(existingClients(toMonthlySeries(shippedClients()))).toEqual([
      250, 266, 282, 299, 315, 331, 348, 247, 248, 248, 248, 346,
    ]);
  });
});

describe('withExistingClients', () => {
  it('keeps exactly the three channels, Existing clients first — the base of the stack (FR3-AC1)', () => {
    expect(withExistingClients(seriesOf([250, [25, 0, 0]])).channels).toEqual(CHANNELS);
  });

  it('puts Existing clients first even when the tree records none (FR3-AC1)', () => {
    const series: MonthlySeries = {
      channels: ['New organic', 'New paid'],
      points: [
        { month: '2024-02', byChannel: { 'New organic': 1, 'New paid': 2 }, total: 3, company: 10 },
      ],
    };
    const { channels, points } = withExistingClients(series);
    expect(channels).toEqual(CHANNELS);
    expect(points[0]?.byChannel[EXISTING]).toBe(7);
  });

  it('keeps New organic, at 0, when the tree records none anywhere (code review F1)', () => {
    const series: MonthlySeries = {
      channels: ['Existing clients', 'New paid'],
      points: [
        {
          month: '2024-02',
          byChannel: { 'Existing clients': 8, 'New paid': 1 },
          total: 9,
          company: 10,
        },
      ],
    };
    const { channels, points } = withExistingClients(series);
    expect(channels).toEqual(CHANNELS);
    expect(points[0]).toMatchObject({
      byChannel: { 'Existing clients': 9, 'New organic': 0, 'New paid': 1 },
      total: 10,
    });
  });

  it('orders the three Existing, New organic, New paid whatever order the tree lists them in (code review F1)', () => {
    const series: MonthlySeries = {
      channels: ['New paid', 'New organic', 'Existing clients'],
      points: [
        {
          month: '2024-02',
          byChannel: { 'New paid': 1, 'New organic': 2, 'Existing clients': 7 },
          total: 10,
          company: 10,
        },
      ],
    };
    expect(withExistingClients(series).channels).toEqual(CHANNELS);
  });

  it('keeps the three for a tree that records no channels at all (code review F1)', () => {
    const series: MonthlySeries = {
      channels: [],
      points: [{ month: '2024-02', byChannel: {}, total: 0, company: 12 }],
    };
    const { channels, points } = withExistingClients(series);
    expect(channels).toEqual(CHANNELS);
    expect(points[0]).toMatchObject({
      byChannel: { 'Existing clients': 12, 'New organic': 0, 'New paid': 0 },
      total: 12,
    });
  });

  it('throws on a channel it has no part for, rather than dropping it from every bar (003 §2.1)', () => {
    const series: MonthlySeries = {
      channels: ['Referral'],
      points: [{ month: '2024-02', byChannel: { Referral: 3 }, total: 3, company: 10 }],
    };
    expect(() => withExistingClients(series)).toThrow('"Referral"');
  });

  it("makes each month's parts add up to its total, and the total its company figure (FR3-AC2)", () => {
    const series = withExistingClients(
      seriesOf([250, [25, 0, 0]], [301, [30, 1, 0]], [20, [15, 10, 5]]),
    );
    expect(series.points.map((point) => point.total)).toEqual([250, 301, 20]);
    expect(sumOfParts(series)).toEqual([250, 301, 20]);
  });

  it('leaves the newly acquired exactly as recorded (FR3-AC5)', () => {
    const { points } = withExistingClients(seriesOf([301, [30, 1, 0]]));
    expect(points[0]?.byChannel).toMatchObject({ 'New organic': 1, 'New paid': 0 });
  });

  it('leaves an overshooting month as tall as its new clients, above the company figure (§2.3)', () => {
    const { points } = withExistingClients(seriesOf([2, [0, 2, 1]]));
    expect(points[0]).toMatchObject({ total: 3, company: 2 });
    expect(points[0]?.byChannel[EXISTING]).toBe(0);
  });

  it('sums to the Company row in all twelve supplied months (FR3-AC2, FR5-AC4)', () => {
    const series = withExistingClients(toMonthlySeries(shippedClients()));
    const company = series.points.map((point) => point.company);
    expect(company).toEqual([250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350]);
    expect(series.points.map((point) => point.total)).toEqual(company);
    expect(sumOfParts(series)).toEqual(company);
  });

  it('reads February 2024 as 250 / 0 / 0 and July 2024 as 331 / 2 / 1 (FR3-AC3/AC4)', () => {
    const { points } = withExistingClients(toMonthlySeries(shippedClients()));
    expect(points[0]).toEqual({
      month: '2024-02',
      byChannel: { 'Existing clients': 250, 'New organic': 0, 'New paid': 0 },
      total: 250,
      company: 250,
    });
    expect(points[5]).toMatchObject({
      month: '2024-07',
      byChannel: { 'Existing clients': 331, 'New organic': 2, 'New paid': 1 },
      total: 334,
    });
  });
});

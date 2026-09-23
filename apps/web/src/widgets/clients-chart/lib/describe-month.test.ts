import { describe, expect, it } from 'vitest';
import { toMonthlySeries } from '@/entities/clients';
import { describeMonth } from './describe-month';
import { shippedClients } from '@/test/fixtures/shipped-clients';

describe('describeMonth', () => {
  const series = toMonthlySeries(shippedClients());

  it('says February 2024 as one sentence: month, three parts bottom-up, then the total (FR6-AC1)', () => {
    expect(describeMonth(series.points[0]!, series.channels)).toBe(
      'Feb 2024: existing clients 221, new organic 15, new paid 14, total 250',
    );
  });

  it('says a channel that is zero that month, rather than leaving it out', () => {
    const point = {
      month: '2025-01',
      byChannel: { 'New paid': 0, 'New organic': 3 },
      total: 3,
      company: 3,
    };
    expect(describeMonth(point, ['New organic', 'New paid'])).toBe(
      'Jan 2025: new organic 3, new paid 0, total 3',
    );
  });
});

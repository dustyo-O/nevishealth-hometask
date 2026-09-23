import { describe, expect, it } from 'vitest';
import type { MonthlySeries } from '@/entities/clients';
import { yScale } from './y-scale';

/** A series whose months total the given figures; the channel split does not matter here. */
const seriesOf = (...totals: number[]): MonthlySeries => ({
  channels: ['Only'],
  points: totals.map((total, i) => ({
    month: `2024-${i + 1}`,
    byChannel: { Only: total },
    total,
    company: total,
  })),
});

describe('yScale', () => {
  it('tops a largest month of 350 at 400, labelled 0/100/200/300/400 (FR2-AC2)', () => {
    expect(yScale(seriesOf(250, 350, 300))).toEqual({ top: 400, ticks: [0, 100, 200, 300, 400] });
  });

  it('tops a largest month of exactly 400 at 500, so no bar touches the ceiling (FR2, tech review F5)', () => {
    expect(yScale(seriesOf(400, 120))).toEqual({ top: 500, ticks: [0, 100, 200, 300, 400, 500] });
  });

  it('moves the top up with the data (FR2-AC5)', () => {
    expect(yScale(seriesOf(350, 420)).top).toBe(500);
    expect(yScale(seriesOf(1234)).top).toBe(1300);
  });

  it('gives an all-zero or empty series a sane minimum of one step', () => {
    expect(yScale(seriesOf(0, 0))).toEqual({ top: 100, ticks: [0, 100] });
    expect(yScale(seriesOf())).toEqual({ top: 100, ticks: [0, 100] });
  });

  it('always starts at 0 and spaces its ticks evenly, one hundred apart (FR2-AC1)', () => {
    for (const max of [1, 99, 100, 101, 350, 999, 1234]) {
      const { ticks, top } = yScale(seriesOf(max));
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(top);
      expect(top).toBeGreaterThan(max);
      ticks.slice(1).forEach((tick, i) => expect(tick - (ticks[i] ?? NaN)).toBe(100));
    }
  });
});

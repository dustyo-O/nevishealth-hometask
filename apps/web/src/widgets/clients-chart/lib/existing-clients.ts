import type { MonthlySeries } from '@/entities/clients';
import { channelKey } from '../model/channels';

/** The channel that holds every client the data does not record as newly acquired (004 FR3). */
export const EXISTING = 'Existing clients';

/** The parts the data records as newly acquired, in the order they stack above Existing clients. */
const NEWLY_ACQUIRED = ['New organic', 'New paid'] as const;

/**
 * The three parts of every bar, bottom-up (004 FR3-AC1). Fixed, not read from the data: a payload
 * that records no "New organic" anywhere still has three parts (FR5-AC1), and one that lists its
 * channels in another order still stacks in this one (code review F1).
 */
export const PARTS: readonly string[] = [EXISTING, ...NEWLY_ACQUIRED];

/**
 * Per month: the clients who are not newly acquired — the company's own figure less every other
 * channel, never below 0 (004 §2.3). The three names are exhaustive between them: the data
 * records "New organic" and "New paid" wherever they exist, so everyone else is an existing
 * client, whether or not an adviser's figures were broken down. A month whose new clients come to
 * more than the company's figure reads 0, not a negative (spec review F1). Pure: no charting
 * library, no DOM.
 *
 * Where the channels do not overshoot, this is the recorded `Existing clients` plus
 * `company − Σ channels`: the clients no adviser's figures break down, all of them existing.
 */
export const existingClients = ({ channels, points }: MonthlySeries): number[] =>
  points.map((point) => {
    const acquired = channels
      .filter((name) => name !== EXISTING)
      .reduce((sum, name) => sum + (point.byChannel[name] ?? 0), 0);
    return Math.max(0, point.company - acquired);
  });

/**
 * The series as the chart draws it: always the three `PARTS`, in that order — Existing clients
 * first, the base of the stack, derived per month; the newly acquired as the tree records them,
 * a channel the tree does not record reading 0, which is what a channel recorded as 0 reads
 * (FR4-AC5: not drawn); and each month's total the sum of its three parts. So every bar is as tall as its Company row (FR3-AC2), or, where the new clients alone
 * exceed it, as tall as they come to. The drawing, the legend, the panel, the hidden table and
 * the announcement all read this one series.
 */
export const withExistingClients = (series: MonthlySeries): MonthlySeries => {
  // A name outside the three throws rather than being dropped from every bar unseen (003 §2.1).
  series.channels.forEach(channelKey);
  const values = existingClients(series);
  return {
    channels: PARTS,
    points: series.points.map((point, i) => {
      const byChannel: Record<string, number> = { [EXISTING]: values[i] ?? 0 };
      for (const name of NEWLY_ACQUIRED) byChannel[name] = point.byChannel[name] ?? 0;
      const total = PARTS.reduce((sum, name) => sum + (byChannel[name] ?? 0), 0);
      return { ...point, byChannel, total };
    }),
  };
};

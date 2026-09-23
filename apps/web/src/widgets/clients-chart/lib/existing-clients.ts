import type { MonthlySeries } from '@/entities/clients';

/** The channel that holds every client the data does not record as newly acquired (004 FR3). */
export const EXISTING = 'Existing clients';

/**
 * Per month: the clients who are not newly acquired — the company's own figure less every other
 * channel, never below 0 (004 §2.3). The three names are exhaustive between them: the data
 * records "New organic" and "New paid" wherever they exist, so everyone else is an existing
 * client, whether or not an adviser's figures were broken down. A month whose new clients come to
 * more than the company's figure reads 0, not a negative (spec review F1). Pure: no charting
 * library, no DOM.
 *
 * Slice 1 computed `company − Σ channels` here as "Not recorded"; it is exactly what Existing now
 * absorbs on top of the recorded `Existing clients` nodes.
 */
export const existingClients = ({ channels, points }: MonthlySeries): number[] =>
  points.map((point) => {
    const acquired = channels
      .filter((name) => name !== EXISTING)
      .reduce((sum, name) => sum + (point.byChannel[name] ?? 0), 0);
    return Math.max(0, point.company - acquired);
  });

/**
 * The series as the chart draws it: Existing clients first — the base of the stack — derived per
 * month, the newly acquired as the tree records them, and each month's total the sum of its three
 * parts. So every bar is as tall as its Company row (FR3-AC2), or, where the new clients alone
 * exceed it, as tall as they come to. The drawing, the legend, the panel, the hidden table and
 * the announcement all read this one series.
 */
export const withExistingClients = (series: MonthlySeries): MonthlySeries => {
  const values = existingClients(series);
  const channels = [EXISTING, ...series.channels.filter((name) => name !== EXISTING)];
  return {
    channels,
    points: series.points.map((point, i) => {
      const byChannel = { ...point.byChannel, [EXISTING]: values[i] ?? 0 };
      const total = channels.reduce((sum, name) => sum + (byChannel[name] ?? 0), 0);
      return { ...point, byChannel, total };
    }),
  };
};

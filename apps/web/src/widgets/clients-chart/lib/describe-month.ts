import { formatMonth, type MonthlyPoint } from '@/entities/clients';

/**
 * One month as the live region says it (003 FR6-AC1): "Feb 2024: existing clients 250, new
 * organic 0, new paid 0, total 250". The parts come in the order they are stacked and the total
 * last, the order the panel shows them in; a channel at zero is said, not skipped.
 */
export const describeMonth = (point: MonthlyPoint, channels: readonly string[]): string => {
  const parts = channels.map((name) => `${name.toLowerCase()} ${point.byChannel[name] ?? 0}`);
  return `${formatMonth(point.month)}: ${[...parts, `total ${point.total}`].join(', ')}`;
};

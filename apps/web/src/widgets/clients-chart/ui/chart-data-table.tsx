import { formatMonth, type MonthlySeries } from '@/entities/clients';
import { VisuallyHidden } from '@/shared/ui/visually-hidden';

type ChartDataTableProps = {
  series: MonthlySeries;
  caption: string;
};

/**
 * The chart's figures as text (003 FR6-AC2): a month per row, its parts in stacking order —
 * "Not recorded" among them whenever the chart draws it (004 FR5) — and the total. Not shown on screen, and never hidden from assistive technology either — it is
 * the second deliberate route to the figures beside the announcement, not a duplicate to
 * suppress. It lives outside the drawing's `aria-hidden` wrapper and outside the focus stop.
 */
export const ChartDataTable = ({ series, caption }: ChartDataTableProps) => (
  <VisuallyHidden as="div">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          {series.channels.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {series.points.map((point) => (
          <tr key={point.month}>
            <th scope="row">{formatMonth(point.month)}</th>
            {series.channels.map((name) => (
              <td key={name}>{point.byChannel[name] ?? 0}</td>
            ))}
            <td>{point.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </VisuallyHidden>
);

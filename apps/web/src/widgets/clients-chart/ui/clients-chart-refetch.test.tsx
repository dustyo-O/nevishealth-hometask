import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { clientsQueryOptions, type MonthlySeries } from '@/entities/clients';
import { createQueryClient } from '@/shared/api';
import { ClientsChart } from './clients-chart';
import { shippedClients } from '@/test/fixtures/shipped-clients';

/** Every series the drawing is handed, in order. The drawing itself is not this test's subject. */
const drawn = vi.hoisted(() => [] as unknown[]);
vi.mock('./bar-plot', () => ({
  BarPlot: ({ series }: { series: MonthlySeries }) => {
    drawn.push(series);
    return null;
  },
}));

/**
 * FR7-AC1: the bars grow once. A refetch that brings back the same figures must hand the drawing
 * the very same series, so nothing downstream can mistake it for new data and grow the bars
 * again. It rests on two things together: the query's structural sharing keeps `data` the same
 * object, and the widget memoises `toMonthlySeries` on it. Reading a month afterwards re-renders
 * the widget, so the memo is exercised and not merely left unreached.
 */
it('hands the drawing the same series after a refetch with unchanged figures (FR7-AC1)', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(Response.json(shippedClients())),
  );
  const client = createQueryClient();
  const { queryKey } = clientsQueryOptions();
  client.setQueryData(queryKey, shippedClients());
  render(
    <QueryClientProvider client={client}>
      <ClientsChart />
    </QueryClientProvider>,
  );

  await act(() => client.refetchQueries({ queryKey }));

  fireEvent.focus(screen.getByRole('group'));

  expect(globalThis.fetch).toHaveBeenCalled();
  expect(drawn.length).toBeGreaterThan(1);
  expect(new Set(drawn).size).toBe(1);
});

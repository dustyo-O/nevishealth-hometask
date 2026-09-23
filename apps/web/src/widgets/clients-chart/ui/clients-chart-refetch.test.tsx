import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';
import { clientsQueryOptions, useClientsQuery } from '@/entities/clients';
import { createQueryClient } from '@/shared/api';
import type { BarPlot } from './bar-plot';
import { ClientsChart } from './clients-chart';
import { shippedClients } from '@/test/fixtures/shipped-clients';

/**
 * Every drawing the plot is handed, in order. The drawing itself is not this test's subject. The
 * stand-in takes the real component's props, so renaming them fails to compile here instead of
 * leaving this test reading a prop nobody passes (it did, from 004 s4 until 005).
 */
const drawn = vi.hoisted(() => [] as unknown[]);
vi.mock('./bar-plot', () => ({
  BarPlot: ({ drawing }: ComponentProps<typeof BarPlot>) => {
    drawn.push(drawing);
    return null;
  },
}));

/** The page's part, and only that: it holds the query and hands the chart its figures. */
const Host = () => {
  const { data } = useClientsQuery();
  return data ? <ClientsChart data={data} /> : null;
};

/**
 * FR7-AC1: the bars grow once. A refetch that brings back the same figures must hand the plot
 * the very same drawing, so nothing downstream can mistake it for new data and grow the bars
 * again. It rests on three things together: the query's structural sharing keeps `data` the same
 * object, which the page hands straight down; the widget memoises the series on `data`; and the
 * drawing on the series. Reading a month afterwards re-renders the widget, so the memos are
 * exercised and not merely left unreached.
 */
it('hands the plot the same drawing after a refetch with unchanged figures (FR7-AC1)', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(Response.json(shippedClients())),
  );
  const client = createQueryClient();
  const { queryKey } = clientsQueryOptions();
  client.setQueryData(queryKey, shippedClients());
  render(
    <QueryClientProvider client={client}>
      <Host />
    </QueryClientProvider>,
  );

  await act(() => client.refetchQueries({ queryKey }));

  fireEvent.focus(screen.getByRole('group'));

  expect(globalThis.fetch).toHaveBeenCalled();
  expect(drawn.length).toBeGreaterThan(1);
  expect(new Set(drawn).size).toBe(1);
});

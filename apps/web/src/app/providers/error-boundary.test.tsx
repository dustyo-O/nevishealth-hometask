import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';

const MESSAGE = "We couldn't load the clients data.";

const Boom = (): never => {
  throw new Error('boom');
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ErrorBoundary', () => {
  it('renders the children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the same error panel as the page with a Reload action when a child throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React reports the throw
    const reload = vi.fn();
    vi.stubGlobal('location', { search: '', href: 'http://localhost:5173/', reload });
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(alert).toHaveTextContent('Unexpected error');
    expect(screen.getByRole('region', { name: MESSAGE })).toContainElement(alert);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

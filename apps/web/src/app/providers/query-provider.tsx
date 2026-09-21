import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/shared/api';

export type QueryProviderProps = { children: ReactNode };

/** One `QueryClient` for the app's lifetime, carrying the spec's fetch policy (tech doc D-6). */
export const QueryProvider = ({ children }: QueryProviderProps) => {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

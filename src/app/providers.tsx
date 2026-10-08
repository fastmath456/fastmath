'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const MockInitializer = dynamic(() => import('./mock-initializer'), { ssr: false });

const MockReadyContext = createContext(false);
export const useMockReady = () => useContext(MockReadyContext);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } }));
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return <QueryClientProvider client={client}>{process.env.NODE_ENV === 'development' && <MockInitializer onReady={onReady} />}<MockReadyContext value={ready}>{children}</MockReadyContext></QueryClientProvider>;
}

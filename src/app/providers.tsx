'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isMockMode } from '@/lib/http';
import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const MockInitializer = dynamic(() => import('./mock-initializer'), { ssr: false });

const MockReadyContext = createContext(false);
export const useMockReady = () => useContext(MockReadyContext);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } }));
  const [ready, setReady] = useState(!isMockMode);
  const onReady = useCallback(() => setReady(true), []);
  return <QueryClientProvider client={client}>{isMockMode && <MockInitializer onReady={onReady} />}<MockReadyContext value={ready}>{children}</MockReadyContext></QueryClientProvider>;
}

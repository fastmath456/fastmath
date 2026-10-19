'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isUnauthorized } from '@/lib/http';

export function useLoginRedirect(...errors: unknown[]) {
  const router = useRouter();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const redirectIfUnauthorized = useCallback((error: unknown) => {
    if (!isUnauthorized(error)) return false;
    if (mounted.current) router.replace('/login');
    return true;
  }, [router]);
  const error = errors.find(isUnauthorized);
  useEffect(() => { redirectIfUnauthorized(error); }, [error, redirectIfUnauthorized]);
  return { requiresLogin: Boolean(error), redirectIfUnauthorized };
}

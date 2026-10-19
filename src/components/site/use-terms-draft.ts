'use client';

import { useEffect, useState } from 'react';

const historyKey = '__quickMathTermsDraft';
const termsPaths = new Set(['/term', '/privacy/collection', '/privacy', '/term/marketing']);

export function isTermsPath(pathname: string) {
  return termsPaths.has(pathname);
}

export function useTermsDraft<T>(key: string, initial: T) {
  const [draft, setDraft] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    const saved = window.history.state?.[historyKey];
    return saved?.key === key && saved.path === window.location.pathname + window.location.search
      ? saved.draft as T
      : initial;
  });

  useEffect(() => {
    function clear() {
      if (window.history.state?.[historyKey]?.key !== key) return;
      const state = { ...window.history.state };
      delete state[historyKey];
      window.history.replaceState(state, '');
    }

    clear();
    function preserve(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href);
      if (destination.origin !== window.location.origin || !isTermsPath(destination.pathname)) return;
      // Keep the draft if a full navigation or route-cache eviction bypasses Next's in-memory state.
      window.history.replaceState({ ...window.history.state, [historyKey]: {
        key, path: window.location.pathname + window.location.search, draft,
      } }, '');
    }

    document.addEventListener('click', preserve, true);
    window.addEventListener('pageshow', clear);
    return () => {
      document.removeEventListener('click', preserve, true);
      window.removeEventListener('pageshow', clear);
    };
  }, [draft, key]);

  return [draft, setDraft] as const;
}

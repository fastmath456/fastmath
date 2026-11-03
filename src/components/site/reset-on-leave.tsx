'use client';

import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

export function ResetOnLeave({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);

  useLayoutEffect(() => () => setVersion(current => current + 1), []);
  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (event.persisted) setVersion(current => current + 1);
    }
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  return <Fragment key={version}>{children}</Fragment>;
}

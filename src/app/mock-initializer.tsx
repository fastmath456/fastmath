'use client';

import { useEffect } from 'react';
import { startWorker } from '../mocks/browser';

export default function MockInitializer({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let active = true;
    startWorker().then(() => { if (active) onReady(); }).catch(error => console.error('MSW initialization failed', error));
    return () => { active = false; };
  }, [onReady]);
  return null;
}

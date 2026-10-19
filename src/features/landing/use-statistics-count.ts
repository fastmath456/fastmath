import { useEffect, useRef, useState } from 'react';

export function useStatisticsCount() {
  const statisticsRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = statisticsRef.current;
    if (!section) return;

    let frame = 0;
    let waiting = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !waiting) return;
      waiting = false;
      observer.disconnect();
      const startedAt = performance.now();

      function tick(now: number) {
        const next = Math.min(1, Math.max(0, (now - startedAt) / 2000));
        setProgress(next);
        if (next < 1) frame = requestAnimationFrame(tick);
      }

      frame = requestAnimationFrame(tick);
    }, { rootMargin: '-52px 0px 0px 0px' });

    observer.observe(section);
    return () => {
      waiting = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return { statisticsRef, progress };
}

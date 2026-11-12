'use client';

import { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './admin-guide.css';
import { adminGuides, type AdminGuideId } from './steps';
import { hasViewedGuide, markGuideViewed } from './storage';

// The caller supplies its existing verified admin state; browser storage is only tour history.
export function AdminGuide({ guide, admin, paused = false }: { guide: AdminGuideId; admin: boolean; paused?: boolean }) {
  const replay = useRef<() => void>(() => {});

  useEffect(() => {
    if (!admin || paused) return;
    const desktop = window.matchMedia('(width > 1080px)');
    let tour: Driver | undefined;
    let frame = 0;

    function start(manual = false) {
      if (!desktop.matches || (!manual && hasViewedGuide(guide))) return;
      const steps = adminGuides[guide].filter(step => {
        const element = document.querySelector(step.element);
        return element instanceof HTMLElement && element.getClientRects().length > 0;
      });
      if (!steps.length) return;
      tour?.destroy();
      tour = driver({
        steps, animate: false, overlayOpacity: 0.35, disableActiveInteraction: true,
        popoverClass: 'admin-guide-popover', showProgress: true, progressText: '{{current}} / {{total}}',
        nextBtnText: '다음', prevBtnText: '이전', doneBtnText: '완료', closeBtnLabel: '안내 닫기',
        onPopoverRender(popover, { driver: current }) {
          const skip = document.createElement('button');
          skip.type = 'button'; skip.className = 'admin-guide-skip'; skip.textContent = '건너뛰기';
          skip.addEventListener('click', () => { markGuideViewed(guide); current.destroy(); });
          popover.footerButtons.prepend(skip);
        },
        onDestroyed(_element, _step, { reason }) {
          if (reason === 'done' || reason === 'close' || reason === 'escape' || reason === 'overlay') markGuideViewed(guide);
        },
      });
      tour.drive();
    }

    function update() {
      cancelAnimationFrame(frame);
      if (desktop.matches) frame = requestAnimationFrame(() => start());
      else tour?.destroy();
    }
    replay.current = () => start(true);
    update();
    desktop.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      desktop.removeEventListener('change', update);
      replay.current = () => {};
      tour?.destroy();
    };
  }, [guide, admin, paused]);

  if (!admin || paused) return null;
  return <button className="admin-guide-replay" type="button" onClick={() => replay.current()}>안내 다시 보기</button>;
}

import type { AdminGuideId } from './steps';

const viewed = new Set<AdminGuideId>();
const key = (guide: AdminGuideId) => `quick-math:admin-guide:v1:${guide}`;

export function hasViewedGuide(guide: AdminGuideId) {
  if (viewed.has(guide)) return true;
  try { return window.localStorage.getItem(key(guide)) === 'viewed'; }
  catch { return false; }
}

export function markGuideViewed(guide: AdminGuideId) {
  viewed.add(guide);
  try { window.localStorage.setItem(key(guide), 'viewed'); }
  catch { /* Keep the dismissal for this page lifetime when storage is blocked. */ }
}

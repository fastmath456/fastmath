import type { CourseProductOrder } from './types';

export function validProductOrder(value: unknown): value is CourseProductOrder {
  if (!value || typeof value !== 'object') return false;
  const { baseline, ids } = value as CourseProductOrder;
  const validId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 120;
  // shortcut: matches the catalog API limit; paginate both before exceeding 1,000 products.
  return Array.isArray(baseline) && Array.isArray(ids)
    && baseline.length <= 1000 && ids.length <= 1001
    && baseline.every(validId) && ids.every(id => id === null || validId(id))
    && new Set(baseline).size === baseline.length && new Set(ids).size === ids.length
    && ids.includes(null);
}

export function initialProductOrder(baseline: string[], courseId: string | undefined, saved?: CourseProductOrder): CourseProductOrder {
  const expected = new Set(baseline.filter(id => id !== courseId));
  if (saved && validProductOrder(saved) && saved.ids.length === expected.size + 1
    && saved.ids.every(id => id === null || expected.has(id))
    && baseline.length === saved.baseline.length && baseline.every((id, index) => id === saved.baseline[index])) return saved;
  const ids: (string | null)[] = baseline.map(id => id === courseId ? null : id);
  if (!ids.includes(null)) ids.push(null);
  return { baseline, ids };
}

export function moveProduct(ids: (string | null)[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to) return ids;
  const result = [...ids];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

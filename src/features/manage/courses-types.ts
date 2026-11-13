export type AdminCourseStatus = 'selling' | 'stopped' | 'draft';
export type AdminCourseFilter = 'all' | AdminCourseStatus;
export type AdminCourse = {
  /** Product id for a registered course, draft id for a saved draft. */
  id: string; status: AdminCourseStatus; kind: 'vod' | 'pdf'; title: string; slug: string | null; image: string | null;
  price: number | null; licenseDays: number | null; lessons: number | null; date: string; step: 1 | 2;
};

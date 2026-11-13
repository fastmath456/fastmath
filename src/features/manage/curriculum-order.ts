import type { CourseChapter } from './types';

function moved<T>(items: T[], index: number, delta: -1 | 1) {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
/** Moves a chapter one place up (-1) or down (1). The array order is the order the course is published in. */
export function moveChapter(chapters: CourseChapter[], chapterId: string, delta: -1 | 1) {
  return moved(chapters, chapters.findIndex(chapter => chapter.id === chapterId), delta);
}
/** Moves a lesson one place up (-1) or down (1) inside its own chapter. */
export function moveLesson(chapters: CourseChapter[], chapterId: string, lessonId: string, delta: -1 | 1) {
  return chapters.map(chapter => {
    if (chapter.id !== chapterId) return chapter;
    const lessons = moved(chapter.lessons, chapter.lessons.findIndex(lesson => lesson.id === lessonId), delta);
    return lessons === chapter.lessons ? chapter : { ...chapter, lessons };
  });
}

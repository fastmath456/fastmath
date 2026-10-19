export type ClassroomItem = { id: string; orderId?: string; courseId?: string; kind: 'vod' | 'pdf'; title: string; status: string; period: string; progress?: number; recent?: string; downloaded?: string; includedPdf?: boolean; expired: boolean };
export type Classroom = { items: ClassroomItem[]; count: number; hidden?: boolean };
export type ViewerChapter = { id: string; title: string; lessons: { id: string; title: string }[] };
export type Viewer = { orderId?: string; courseId: string; title: string; recentLessonId: string; poster: string; chapters: ViewerChapter[] };

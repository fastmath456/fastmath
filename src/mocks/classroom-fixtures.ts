import type { ClassroomItem, Viewer } from '@/features/classroom';

export const classroomItems: ClassroomItem[] = [
  { id: 'vod-active-1', courseId: 'exponential-logarithmic-core', kind: 'vod', title: '지수함수와 로그함수 핵심 정리', status: '수강 중', period: '2026. 10. 06 ~ 2026. 12. 05', progress: 6, recent: '2강. 거듭제곱근 기초 연산', expired: false },
  { id: 'vod-active-2', courseId: 'trigonometry-concepts', kind: 'vod', title: '삼각함수 개념부터 실전까지', status: '수강 전', period: '2026. 10. 05 ~ 2026. 12. 04', progress: 0, recent: '아직 학습한 강의가 없습니다.', includedPdf: true, expired: false },
  { id: 'vod-expired', courseId: 'exponential-logarithmic-core', kind: 'vod', title: '지수함수와 로그함수 핵심 정리', status: '수강 중', period: '2026. 10. 01 ~ 2026. 11. 30', progress: 33, recent: '8강. 삼각함수의 그래프', expired: true },
  { id: 'pdf-active', kind: 'pdf', title: '수학1 개념 워크북', status: '다운로드 가능', period: '2026. 10. 01 ~ 2026. 11. 30', downloaded: '2026. 10. 01. 12:32', expired: false },
  { id: 'pdf-expired', kind: 'pdf', title: '수학1 개념 워크북', status: '다운로드 가능', period: '2026. 10. 01 ~ 2026. 11. 30', downloaded: '2026. 10. 01. 12:32', expired: true },
];
export const viewer: Viewer = {
  courseId: 'exponential-logarithmic-core', title: '지수함수와 로그함수 핵심 정리', recentLessonId: 'lesson-2', poster: '/assets/viewer-imgRectangle1838.png', chapters: [
    { id: 'unit-1', title: '01. 거듭제곱근과 지수', lessons: ['1강. 거듭제곱근의 뜻과 성질','2강. 거듭제곱근 기초 연산','3강. 지수의 확장','4강. 지수법칙과 식의 정리','5강. 지수 단원 핵심 문제'].map((title,index) => ({ id: `lesson-${index+1}`, title })) },
    { id: 'unit-2', title: '02. 로그의 정의와 성질', lessons: ['6강. 로그의 뜻과 조건','7강. 로그의 성질','8강. 상용로그의 활용','9강. 로그식의 계산','10강. 로그 단원 핵심 문제'].map((title,index) => ({ id: `lesson-${index+6}`, title })) },
    ...['03. 지수함수와 그래프','04. 로그함수와 역함수','05. 방정식과 부등식','06. 실전 종합 문제 풀이'].map((title,index) => ({ id: `unit-${index+3}`, title, lessons: [] })),
  ],
};

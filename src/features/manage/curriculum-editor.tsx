'use client';

import { useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import type { CourseChapter, CourseLesson } from './types';
import styles from './curriculum-editor.module.css';

type CurriculumEditorProps = {
  chapters: CourseChapter[];
  selectedLessonId: string | null;
  verifying: boolean;
  onAddChapter: () => void;
  onAddLesson: (chapterId: string) => void;
  onSelectLesson: (lessonId: string) => void;
  onRenameChapter: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onRenameLesson: (chapterId: string, lessonId: string) => void;
  onDeleteLesson: (chapterId: string, lessonId: string) => void;
  onChangeUrl: (value: string) => void;
  onVerify: () => void;
  onVideoError: () => void;
};

function lessonStatus(lesson: CourseLesson, selected: boolean, verifying: boolean) {
  if (lesson.videoError) return { label: '연결 오류', tone: 'error' };
  if (selected && verifying) return { label: '확인 중', tone: 'pending' };
  if (lesson.video) return { label: '연결 완료', tone: 'complete' };
  return { label: '미연결', tone: 'idle' };
}

function previewUrl(embedUrl: string) {
  try {
    const url = new URL(embedUrl);
    if (url.origin !== 'https://player.vimeo.com') return null;
    url.searchParams.set('autoplay', '0');
    return url.toString();
  } catch {
    return null;
  }
}

export function CurriculumEditor({
  chapters,
  selectedLessonId,
  verifying,
  onAddChapter,
  onAddLesson,
  onSelectLesson,
  onRenameChapter,
  onDeleteChapter,
  onRenameLesson,
  onDeleteLesson,
  onChangeUrl,
  onVerify,
  onVideoError,
}: CurriculumEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onVideoErrorRef = useRef(onVideoError);
  const subscribedFrameRef = useRef<Window | null>(null);
  const selectedLesson = useMemo(
    () => chapters.flatMap(chapter => chapter.lessons).find(lesson => lesson.id === selectedLessonId) ?? null,
    [chapters, selectedLessonId],
  );
  const selectedVideoUrl = selectedLesson?.video ? previewUrl(selectedLesson.video.embedUrl) : null;

  useEffect(() => {
    onVideoErrorRef.current = onVideoError;
  }, [onVideoError]);

  useEffect(() => {
    if (!selectedVideoUrl) return;

    function reportVimeoError(event: MessageEvent) {
      if (event.origin !== 'https://player.vimeo.com' || event.source !== iframeRef.current?.contentWindow) return;
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload?.event === 'ready' || payload?.method === 'ping') {
          if (subscribedFrameRef.current !== event.source) {
            iframeRef.current?.contentWindow?.postMessage({ method: 'addEventListener', value: 'error' }, 'https://player.vimeo.com');
            subscribedFrameRef.current = event.source as Window;
          }
        }
        if (payload?.event === 'error') onVideoErrorRef.current();
      } catch {
        // Ignore non-Vimeo postMessage payloads from the trusted player frame.
      }
    }

    window.addEventListener('message', reportVimeoError);
    return () => window.removeEventListener('message', reportVimeoError);
  }, [selectedVideoUrl]);

  function pingVimeoPlayer() {
    iframeRef.current?.contentWindow?.postMessage({ method: 'ping' }, 'https://player.vimeo.com');
  }

  return (
    <section className={styles.editor} aria-label="커리큘럼 및 영상 업로드">
      <aside data-guide="curriculum" className={styles.curriculum} aria-label="커리큘럼">
        {chapters.length === 0 ? <p className={styles.emptyCurriculum}>챕터를 추가해주세요.</p> : chapters.map(chapter => (
          <section className={styles.chapter} key={chapter.id} aria-label={chapter.title}>
            <div className={styles.chapterHeader}>
              <p className={styles.chapterTitle}>{chapter.title}</p>
              <div className={styles.chapterActions}>
                <button className={styles.addLesson} type="button" onClick={() => onAddLesson(chapter.id)} disabled={verifying}>
                  카테고리 추가 <Image src="/assets/manage-plus.svg" width={16} height={16} alt="" />
                </button>
                <details className={styles.manageMenu}>
                  <summary aria-label={`${chapter.title} 관리`}>⋯</summary>
                  <div className={styles.menuItems}>
                    <button type="button" onClick={() => onRenameChapter(chapter.id)}>이름 변경</button>
                    <button type="button" onClick={() => onDeleteChapter(chapter.id)} disabled={verifying}>삭제</button>
                  </div>
                </details>
              </div>
            </div>
            {chapter.lessons.length === 0 ? <p className={styles.emptyChapter}>차시를 추가해주세요.</p> : chapter.lessons.map(lesson => {
              const selected = lesson.id === selectedLessonId;
              const status = lessonStatus(lesson, selected, verifying);
              return <div className={styles.lessonRow} key={lesson.id}>
                <button className={`${styles.lesson} ${selected ? styles.selected : ''}`} type="button" onClick={() => onSelectLesson(lesson.id)} disabled={verifying} aria-current={selected ? 'true' : undefined}>
                  <span className={styles.lessonTitle}>{lesson.title}</span>
                  <span className={`${styles.status} ${styles[status.tone]}`}>{status.label}</span>
                </button>
                <details className={styles.manageMenu}>
                  <summary aria-label={`${lesson.title} 관리`}>⋯</summary>
                  <div className={styles.menuItems}>
                    <button type="button" onClick={() => onRenameLesson(chapter.id, lesson.id)}>이름 변경</button>
                    <button type="button" onClick={() => onDeleteLesson(chapter.id, lesson.id)} disabled={verifying}>삭제</button>
                  </div>
                </details>
              </div>;
            })}
          </section>
        ))}
        <div className={styles.addChapterRow}>
          <p>챕터</p>
          <button className={styles.addChapter} type="button" onClick={onAddChapter} disabled={verifying}>
            챕터 추가 <Image src="/assets/manage-plus.svg" width={16} height={16} alt="" />
          </button>
        </div>
      </aside>

      <div data-guide="video-editor" className={styles.videoEditor}>
        <label className={styles.label} htmlFor="vimeo-url">영상 업로드 <span aria-hidden="true">*</span></label>
        {!selectedLesson && <p className={styles.emptyVideo}>차시를 선택하거나 추가해주세요.</p>}
        <div className={styles.urlRow}>
          <input id="vimeo-url" className={styles.urlInput} type="url" value={selectedLesson?.inputUrl ?? ''} onChange={event => onChangeUrl(event.target.value)} placeholder="영상 링크를 붙여 넣어주세요." disabled={!selectedLesson || verifying} />
          <button className={styles.verify} type="button" onClick={onVerify} disabled={!selectedLesson || verifying}>{verifying ? '확인 중' : '등록'}</button>
        </div>
        {selectedLesson?.videoError && <p className={styles.videoError} role="alert">{selectedLesson.videoError}</p>}
        {selectedVideoUrl && <iframe ref={iframeRef} key={`${selectedLesson?.id}:${selectedVideoUrl}`} className={styles.preview} src={selectedVideoUrl} title="Vimeo 영상 미리보기" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen onLoad={pingVimeoPlayer} onError={onVideoError} />}
      </div>
    </section>
  );
}

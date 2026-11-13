'use client';

import Image from 'next/image';
import { AdminGuide } from '@/features/admin-guide';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationDialog, FormField, SiteFooter } from '@/components/site';
import { RequestError } from '@/lib/http';
import { checkAccess, getDraft, getEditableCourse, publishDraft, saveDraft, verifyVideo } from './api';
import { BasicInformation } from './basic-information';
import { CurriculumEditor } from './curriculum-editor';
import { CourseOrderDialog } from './course-order-dialog';
import { useCourseUploads } from './use-course-uploads';
import { emptyDocument, emptyReview, isEmptyReview, validateReview, formattedPrice, parseVimeoUrl, validateBasic, validateCurriculum } from './validation';
import type { BasicErrors, CourseChapter, CourseDocument, CourseDraft, CourseLesson, CourseReview } from './types';
import { ManageCourseSkeleton } from './manage-course-skeleton';
import styles from './manage.module.css';

type Props = { courseId?: string; draftId?: string; stepValue?: string };
type NameDialog = { kind: 'chapter' | 'lesson'; chapterId?: string; lessonId?: string; value: string; error: string };
type Confirm = { label: string; text: string; cancel: string; accept: string; onAccept: () => void; summary?: boolean };
const serialize = (document: CourseDocument) => JSON.stringify(document);
const firstLesson = (chapters: CourseChapter[]) => chapters.flatMap(chapter => chapter.lessons)[0]?.id ?? null;
const selectedIn = (document: CourseDocument) => document.chapters.flatMap(chapter => chapter.lessons).find(lesson => lesson.id === document.selectedLessonId);
const videoMessages: Record<string, string> = {
  invalid_video_url: 'Vimeo 영상 링크를 확인해주세요.',
  video_not_found: '영상을 찾을 수 없습니다.',
  video_restricted: '영상 공개 범위와 임베드 설정을 확인해주세요.',
  video_processing: '영상 처리가 완료된 후 다시 등록해주세요.',
};

export function ManageCourseScreen({ courseId, draftId, stepValue }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [document, setDocument] = useState<CourseDocument>(emptyDocument);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [saved, setSaved] = useState(() => serialize(document));
  const [phase, setPhase] = useState<'checking' | 'loading' | 'ready' | 'error' | 'forbidden' | 'missing'>('checking');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<BasicErrors>({});
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const operation = useRef(false);
  const mounted = useRef(false);
  const dirty = serialize(document) !== saved;

  const handleAuthError = useCallback((error: unknown) => {
    if (!(error instanceof RequestError)) return false;
    if (error.code === 'unauthorized') {
      setPhase('checking');
      router.replace('/login');
      return true;
    }
    if (error.code === 'forbidden') { setPhase('forbidden'); return true; }
    return false;
  }, [router]);
  const uploads = useCourseUploads(document, setDocument, { onError: handleAuthError });

  function replaceUrl(nextDraft: CourseDraft | null, step: 1 | 2) {
    const path = nextDraft?.id || !courseId ? '/manage/courses/new' : `/manage/courses/${encodeURIComponent(courseId)}/edit`;
    const query = new URLSearchParams({ ...(nextDraft?.id ? { draft: nextDraft.id } : {}), step: String(step) });
    window.history.replaceState(null, '', `${path}?${query}`);
  }

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function load() {
      try {
        await checkAccess();
        if (cancelled) return;
        setPhase(current => current === 'checking' ? 'loading' : current);
        const loaded = draftId ? await getDraft(draftId) : courseId ? await getEditableCourse(courseId) : null;
        if (cancelled) return;
        if (loaded?.draft.published && loaded.draft.slug) { router.replace('/courses/' + encodeURIComponent(loaded.draft.slug)); return; }
        const next = loaded?.draft.document ?? emptyDocument();
        const basicErrors = validateBasic(next.basic);
        const requestedDetails = stepValue === '2' || next.step === 2;
        if (requestedDetails && Object.keys(basicErrors).length) {
          next.step = 1; setErrors(basicErrors);
        } else if (stepValue === '1' || stepValue === '2') next.step = Number(stepValue) as 1 | 2;
        setDocument(next); setSaved(serialize(next)); setDraft(loaded?.draft ?? null); setPhase('ready');
        const path = loaded?.draft.id || !courseId ? '/manage/courses/new' : `/manage/courses/${encodeURIComponent(courseId)}/edit`;
        const query = new URLSearchParams({ ...(loaded?.draft.id ? { draft: loaded.draft.id } : {}), step: String(next.step) });
        window.history.replaceState(null, '', `${path}?${query}`);
        if (Object.keys(basicErrors).length && requestedDetails) focusFirstError(basicErrors);
      } catch (error) {
        if (cancelled || handleAuthError(error)) return;
        if (error instanceof RequestError && error.code === 'not_found') {
          if (courseId) setPhase('missing');
          else {
            const blank = emptyDocument(); setDocument(blank); setSaved(serialize(blank)); setDraft(null);
            setMessage('초안을 찾을 수 없습니다.'); setPhase('ready');
            window.history.replaceState(null, '', '/manage/courses/new');
          }
        } else { setMessage('화면을 열지 못했습니다. 다시 시도해주세요.'); setPhase('error'); }
      }
    }
    void load();
    return () => { cancelled = true; mounted.current = false; };
  }, [courseId, draftId, stepValue, loadAttempt, handleAuthError, router]);

  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ''; }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  function updateLesson(id: string, update: (lesson: CourseLesson) => CourseLesson) {
    setDocument(current => ({ ...current, chapters: current.chapters.map(chapter => ({ ...chapter, lessons: chapter.lessons.map(lesson => lesson.id === id ? update(lesson) : lesson) })) }));
  }

  function guardDirty(action: () => void) {
    if (!dirty) { action(); return; }
    setConfirm({ label: '미저장 변경사항', text: '저장하지 않은 변경사항이 있습니다.', cancel: '계속 작성', accept: '저장하지 않고 이동', onAccept: action });
  }

  function guardPending(action: () => void) {
    if (operation.current) return;
    const lesson = selectedIn(document);
    if (!lesson || lesson.inputUrl.trim() === (lesson.video?.url ?? '')) { action(); return; }
    setConfirm({ label: '영상 링크 변경', text: '변경한 영상 링크가 아직 반영되지 않았습니다.', cancel: '계속 편집', accept: '변경 버리고 이동', onAccept: () => {
      updateLesson(lesson.id, current => ({ ...current, inputUrl: current.video?.url ?? '', videoError: undefined })); action();
    } });
  }

  function uploadsReady() {
    if (uploads.pending) { setMessage('파일 업로드가 완료될 때까지 기다려주세요.'); return false; }
    if (uploads.failedDetailImages) { setMessage('업로드에 실패한 상세이미지를 재시도하거나 삭제해주세요.'); return false; }
    if (uploads.failedMaterials) { setMessage('업로드에 실패한 교재파일을 재시도하거나 삭제해주세요.'); return false; }
    return true;
  }

  function focusFirstError(nextErrors: BasicErrors) {
    const field = (['thumbnail', 'detailImages', 'title', 'materials', 'basePrice', 'price', 'licenseDays', 'displayOrder'] as const).find(key => nextErrors[key]);
    const reviewId = Object.keys(nextErrors.reviews ?? {}).find(id => Object.keys(nextErrors.reviews?.[id] ?? {}).length);
    if (!field && !reviewId) return;
    requestAnimationFrame(() => {
      const reviewField = reviewId && (['rating', 'body', 'author'] as const).find(key => nextErrors.reviews?.[reviewId]?.[key]);
      const id = field ? field === 'licenseDays' ? 'course-license-days' : `course-${field === 'detailImages' ? 'detailImage' : field}` : `review-${reviewId}-${reviewField}`;
      const element = window.document.getElementById(id);
      element?.scrollIntoView({ block: 'center' }); element?.focus();
    });
  }

  function nextStep() {
    if (!uploadsReady()) return;
    const nextErrors = validateBasic(document.basic); setErrors(nextErrors); setNotice('');
    if (Object.keys(nextErrors).length) { focusFirstError(nextErrors); return; }
    setMessage(''); setDocument(current => ({ ...current, step: 2, basic: { ...current.basic, title: current.basic.title.trim(), licenseDays: current.basic.licenseDays || '60' } }));
    replaceUrl(draft, 2); window.scrollTo(0, 0);
  }

  async function persist(publishing = false) {
    if (operation.current || !uploadsReady()) return;
    operation.current = true; setBusy(true); setMessage(''); setNotice('');
    try {
      const snapshot = publishing ? { ...document, basic: { ...document.basic, displayOrder: document.basic.displayOrder.trim(), reviews: document.basic.reviews.filter(review => !isEmptyReview(review)).map(review => ({ ...review, author: review.author.trim() })) } } : document;
      const result = publishing && draft?.id && serialize(snapshot) === saved ? { draft } : await saveDraft(snapshot, draft, courseId);
      if (!mounted.current) return;
      setDraft(result.draft); setDocument(result.draft.document); setSaved(serialize(result.draft.document)); replaceUrl(result.draft, result.draft.document.step);
      if (publishing) {
        const published = await publishDraft(result.draft);
        if (!mounted.current) return;
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['products'] }), queryClient.invalidateQueries({ queryKey: ['product', published.slug] })]);
        const go = () => { setSaved(serialize(result.draft.document)); router.push('/courses/' + encodeURIComponent(published.slug)); };
        setConfirm({ label: '클래스 등록 완료', text: '클래스가 등록되었습니다.', cancel: '확인', accept: '', onAccept: go });
      } else {
        setNotice('임시저장되었습니다.');
      }
    } catch (error) {
      if (!handleAuthError(error)) setMessage(publishing ? '클래스를 등록하지 못했습니다. 다시 시도해주세요.' : '임시저장하지 못했습니다. 다시 시도해주세요.');
    } finally { operation.current = false; if (mounted.current) setBusy(false); }
  }

  function requestPublish() {
    if (!uploadsReady() || operation.current) return;
    const nextErrors = validateBasic(document.basic); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setDocument(current => ({ ...current, step: 1 })); replaceUrl(draft, 1); focusFirstError(nextErrors); return; }
    const curriculumError = validateCurriculum(document.chapters);
    if (curriculumError) {
      setMessage(curriculumError);
      const invalidLesson = document.chapters.flatMap(chapter => chapter.lessons.filter(lesson => validateCurriculum([{ ...chapter, lessons: [lesson] }])))[0];
      if (invalidLesson) {
        const highlight = () => {
          setDocument(current => ({ ...current, selectedLessonId: invalidLesson.id }));
          requestAnimationFrame(() => { window.document.getElementById('vimeo-url')?.focus(); });
        };
        if (invalidLesson.id === document.selectedLessonId) highlight(); else guardPending(highlight);
      }
      return;
    }
    setMessage(''); setConfirm({ label: '클래스 등록', text: document.basic.reviews.some(review => !isEmptyReview(review)) ? '클래스와 입력한 후기가 공개되며 구매할 수 있습니다.' : '클래스가 공개되며 구매할 수 있습니다.', cancel: '취소', accept: '등록하기', summary: true, onAccept: () => { void persist(true); } });
  }

  function addReview() {
    const review = emptyReview();
    setDocument(current => ({ ...current, basic: { ...current.basic, reviews: [...current.basic.reviews, review] } }));
    setNotice('');
    requestAnimationFrame(() => { const element = window.document.getElementById(`review-${review.id}-rating`); element?.scrollIntoView({ block: 'center' }); element?.focus(); });
  }

  function removeReview(review: CourseReview) {
    const remove = () => {
      setDocument(current => { const reviews = current.basic.reviews.filter(item => item.id !== review.id); return { ...current, basic: { ...current.basic, reviews: reviews.length ? reviews : [emptyReview()] } }; });
      setNotice('');
      setErrors(current => { const reviews = { ...current.reviews }; delete reviews[review.id]; return { ...current, reviews }; });
    };
    if (isEmptyReview(review)) remove();
    else setConfirm({ label: '후기 삭제', text: '입력한 후기를 삭제하시겠습니까?', cancel: '취소', accept: '삭제', onAccept: remove });
  }

  function openName(kind: NameDialog['kind'], chapterId?: string, lessonId?: string) {
    if (operation.current) return;
    const chapter = document.chapters.find(item => item.id === chapterId);
    const value = kind === 'chapter' ? chapter?.title : chapter?.lessons.find(item => item.id === lessonId)?.title;
    const action = () => setNameDialog({ kind, chapterId, lessonId, value: value ?? '', error: '' });
    if (kind === 'lesson' && !lessonId) guardPending(action); else action();
  }

  function saveName() {
    if (!nameDialog) return;
    const title = nameDialog.value.trim();
    if (!title || title.length > 100) { setNameDialog({ ...nameDialog, error: `${nameDialog.kind === 'chapter' ? '챕터명' : '차시명'}을 1자 이상 100자 이하로 입력해주세요.` }); return; }
    const id = crypto.randomUUID();
    setDocument(current => {
      if (nameDialog.kind === 'chapter') return { ...current, chapters: nameDialog.chapterId ? current.chapters.map(chapter => chapter.id === nameDialog.chapterId ? { ...chapter, title } : chapter) : [...current.chapters, { id, title, lessons: [] }] };
      return { ...current, selectedLessonId: nameDialog.lessonId ? current.selectedLessonId : id, chapters: current.chapters.map(chapter => chapter.id === nameDialog.chapterId ? { ...chapter, lessons: nameDialog.lessonId ? chapter.lessons.map(lesson => lesson.id === nameDialog.lessonId ? { ...lesson, title } : lesson) : [...chapter.lessons, { id, title, inputUrl: '', video: null }] } : chapter) };
    });
    setNameDialog(null);
  }

  function deleteItem(chapterId: string, lessonId?: string) {
    if (operation.current) return;
    setConfirm({ label: lessonId ? '차시 삭제' : '챕터 삭제', text: lessonId ? '차시를 삭제하시겠습니까?' : '챕터를 삭제하면 포함된 모든 차시가 삭제됩니다.', cancel: '취소', accept: '삭제', onAccept: () => {
      setDocument(current => {
        const chapters = lessonId ? current.chapters.map(chapter => chapter.id === chapterId ? { ...chapter, lessons: chapter.lessons.filter(lesson => lesson.id !== lessonId) } : chapter) : current.chapters.filter(chapter => chapter.id !== chapterId);
        const selectionExists = chapters.some(chapter => chapter.lessons.some(lesson => lesson.id === current.selectedLessonId));
        return { ...current, chapters, selectedLessonId: selectionExists ? current.selectedLessonId : firstLesson(chapters) };
      });
    } });
  }

  async function verifySelected() {
    const lesson = selectedIn(document);
    if (!lesson || operation.current) return;
    const url = lesson.inputUrl.trim();
    if (!parseVimeoUrl(url)) { updateLesson(lesson.id, current => ({ ...current, videoError: 'Vimeo 영상 링크를 확인해주세요.' })); return; }
    operation.current = true; setVerifying(true);
    updateLesson(lesson.id, current => ({ ...current, videoError: undefined }));
    try {
      const result = await verifyVideo(url);
      if (mounted.current) updateLesson(lesson.id, current => current.inputUrl.trim() === url ? { ...current, inputUrl: result.video.url, video: result.video, videoError: undefined } : current);
    } catch (error) {
      if (mounted.current && !handleAuthError(error)) updateLesson(lesson.id, current => ({ ...current, videoError: error instanceof RequestError ? videoMessages[error.code] ?? '영상을 확인하지 못했습니다. 다시 시도해주세요.' : '영상을 확인하지 못했습니다. 다시 시도해주세요.' }));
    } finally { operation.current = false; if (mounted.current) setVerifying(false); }
  }

  if (phase === 'checking') return null;
  if (phase === 'loading') return <ManageCourseSkeleton />;
  if (phase !== 'ready') return <><main className={styles.main}><p role="alert">{phase === 'forbidden' ? '관리자만 이용할 수 있습니다.' : phase === 'missing' ? '강의를 찾을 수 없습니다.' : message}</p><button type="button" className={styles.outlined} onClick={phase === 'error' ? () => { setPhase('checking'); setLoadAttempt(value => value + 1); } : () => router.push('/courses')}>{phase === 'error' ? '재시도' : '목록으로'}</button></main><SiteFooter /></>;

  const nameLabel = nameDialog ? `${nameDialog.kind === 'chapter' ? '챕터' : '차시'} ${nameDialog.lessonId || (nameDialog.kind === 'chapter' && nameDialog.chapterId) ? '이름 변경' : '추가'}` : '';
  return <>
    <main className={`${styles.main} ${document.step === 2 ? styles.details : ''}`}>
      <div className={styles.heading}>
        <div className={styles.headingRow}><h1>클래스 등록</h1><AdminGuide guide={document.step === 1 ? 'course-basic' : 'course-curriculum'} admin={phase === 'ready'} paused={busy || verifying || Boolean(confirm || nameDialog || ordering)} /></div>
        <div className={styles.steps} data-guide="course-steps" aria-label="클래스 등록 단계">
          {document.step === 2 ? <button type="button" className={styles.step} onClick={() => guardPending(() => { setDocument(current => ({ ...current, step: 1 })); replaceUrl(draft, 1); })} disabled={busy || verifying}><span className={styles.chip}>1</span><span>기본정보</span></button> : <span className={`${styles.step} ${styles.current}`} aria-current="step"><span className={styles.chip}>1</span><span>기본정보</span></span>}
          <Image unoptimized src="/assets/manage-chevron-right.svg" alt="" width={16} height={16} />
          <span className={`${styles.step} ${document.step === 2 ? styles.current : ''}`} aria-current={document.step === 2 ? 'step' : undefined}><span className={styles.chip}>2</span><span>상세정보</span></span>
        </div>
      </div>
      <fieldset className={styles.fields} disabled={busy}>
        {document.step === 1 ? <BasicInformation onChooseOrder={() => setOrdering(true)} basic={document.basic} errors={errors} uploading={uploads.uploading} uploadErrors={uploads.uploadErrors} onChange={(field, value) => {
          setNotice(''); setDocument(current => ({ ...current, basic: { ...current.basic, [field]: field === 'title' ? value : value.replace(/\D/g, '') } }));
          setErrors(current => ({ ...current, [field]: undefined }));
        }} onBlur={field => setErrors(current => ({ ...current, [field]: validateBasic(document.basic)[field] }))} onUpload={uploads.onUpload} onRemoveThumbnail={uploads.onRemoveThumbnail} onRemoveMaterial={uploads.onRemoveMaterial} onRetryMaterial={uploads.onRetryMaterial} onRemoveDetailImage={uploads.onRemoveDetailImage} onRetryDetailImage={uploads.onRetryDetailImage}
          onAddReview={addReview} onRemoveReview={removeReview} onReviewBlur={review => setErrors(current => ({ ...current, reviews: { ...current.reviews, [review.id]: validateReview(review) } }))}
          onReviewChange={(id, field, value) => {
            setNotice('');
            setDocument(current => ({ ...current, basic: { ...current.basic, reviews: current.basic.reviews.map(review => review.id === id ? { ...review, [field]: value } : review) } }));
            setErrors(current => ({ ...current, reviews: { ...current.reviews, [id]: { ...current.reviews?.[id], [field]: undefined } } }));
          }} /> : <CurriculumEditor chapters={document.chapters} selectedLessonId={document.selectedLessonId} verifying={verifying} onAddChapter={() => openName('chapter')} onAddLesson={id => openName('lesson', id)} onSelectLesson={id => { if (id !== document.selectedLessonId) guardPending(() => setDocument(current => ({ ...current, selectedLessonId: id }))); }} onRenameChapter={id => openName('chapter', id)} onDeleteChapter={id => deleteItem(id)} onRenameLesson={(chapterId, lessonId) => openName('lesson', chapterId, lessonId)} onDeleteLesson={deleteItem} onChangeUrl={value => { if (document.selectedLessonId) updateLesson(document.selectedLessonId, current => ({ ...current, inputUrl: value, videoError: undefined })); }} onVerify={() => { void verifySelected(); }} onVideoError={() => { if (document.selectedLessonId) updateLesson(document.selectedLessonId, current => ({ ...current, videoError: '영상 공개 범위와 임베드 설정을 확인해주세요.' })); }} />}
      </fieldset>
      <div className={styles.actionGroup}>
        {message && <p className={styles.error} role="alert">{message}</p>}{notice && <p role="status">{notice}</p>}
        <div className={styles.actions}><button type="button" className={styles.outlined} disabled={busy || verifying} onClick={() => guardDirty(() => { uploads.reset(); router.push('/courses'); })}>목록으로</button><div className={styles.rightActions}><button type="button" className={styles.outlined} data-guide="save-draft" disabled={busy || verifying} onClick={() => { void persist(); }}>{busy ? '저장 중' : '임시저장'}</button><button type="button" className={styles.primary} data-guide="course-next" disabled={busy || verifying} onClick={document.step === 1 ? nextStep : requestPublish}>{document.step === 1 ? '다음으로' : '등록하기'}</button></div></div>
      </div>
    </main>
    <SiteFooter />
    {confirm && <ConfirmationDialog label={confirm.label} onCancel={() => { if (!confirm.accept) confirm.onAccept(); setConfirm(null); }} actions={confirm.accept ? [{ label: confirm.cancel, cancel: true }, { label: confirm.accept, onClick: () => { setConfirm(null); confirm.onAccept(); } }] : [{ label: confirm.cancel, onClick: () => { setConfirm(null); confirm.onAccept(); } }]}><div className={styles.dialogText}><p>{confirm.text}</p>{confirm.summary && <div className={styles.summary}><p>클래스명: {document.basic.title.trim()}</p><p>판매금액: {formattedPrice(document.basic.price)}원</p><p>수강기간: {document.basic.licenseDays || '60'}일</p><p>정렬 순서: {Number(document.basic.displayOrder)}</p><p>공개 후기: {document.basic.reviews.filter(review => !isEmptyReview(review)).length}개</p><p>차시 수: {document.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0)}개</p></div>}</div></ConfirmationDialog>}
    {ordering && <CourseOrderDialog basic={document.basic} courseId={draft?.courseId ?? courseId} value={document.productOrder} onCancel={() => setOrdering(false)} onSave={productOrder => {
      setDocument(current => ({ ...current, productOrder, basic: { ...current.basic, displayOrder: String(productOrder.ids.indexOf(null)) } }));
      setErrors(current => ({ ...current, displayOrder: undefined })); setNotice(''); setOrdering(false);
    }} />}
    {nameDialog && <ConfirmationDialog label={nameLabel} onCancel={() => setNameDialog(null)} actions={[{ label: '취소', cancel: true }, { label: nameDialog.lessonId || (nameDialog.kind === 'chapter' && nameDialog.chapterId) ? '변경' : '추가', onClick: saveName }]}><form className={styles.dialogText} onSubmit={event => { event.preventDefault(); saveName(); }}>{nameDialog.kind === 'lesson' && <p>소속 챕터: {document.chapters.find(chapter => chapter.id === nameDialog.chapterId)?.title}</p>}<FormField id="curriculum-name" autoFocus label={nameDialog.kind === 'chapter' ? '챕터명' : '차시명'} value={nameDialog.value} error={nameDialog.error} onChange={event => setNameDialog({ ...nameDialog, value: event.target.value, error: '' })} /></form></ConfirmationDialog>}
  </>;
}

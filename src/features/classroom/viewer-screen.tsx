'use client';

import Image from 'next/image';
import { isUnauthorized } from '@/lib/http';
import { VideoPlayer } from './video-player';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ConfirmationDialog, SiteFooter, SiteHeader } from '@/components/site';
import { useProfile } from '@/features/account';
import { checkout } from '@/features/catalog';
import { useLoginRedirect } from '@/features/auth';
import { getViewer } from './api';
import { ViewerLoading } from './classroom-skeletons';
import styles from './classroom.module.css';
import mobileStyles from './viewer-mobile.module.css';

export function ViewerScreen({ courseId, lessonId, state = '', preview = false }: { courseId: string; lessonId?: string; state?: string; preview?: boolean }) {
  const profile = useProfile(), router = useRouter();
  const query = useQuery({ queryKey: ['viewer',courseId,state,preview,preview ? lessonId : undefined], queryFn: () => getViewer(courseId,preview,lessonId) });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(preview ? undefined : profile.error, query.error);
  const requestKey = useRef(''), purchase = useRef<Promise<void> | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expanded, setOpen] = useState<string[] | null>(null);
  const open = expanded ?? query.data?.chapters.slice(0,2).map(chapter => chapter.id) ?? [];
  const data = query.data, lessons = data?.chapters.flatMap(chapter => chapter.lessons) ?? [];
  const selected = lessonId ?? data?.recentLessonId ?? lessons[0]?.id;
  const index = lessons.findIndex(lesson => lesson.id === selected), lesson = lessons[index];
  function select(id: string) {
    if (id === selected) return;
    if (preview && !lessons.find(item => item.id === id)?.preview) { setPaymentOpen(true); return; }
    const chapter = data?.chapters.find(chapter => chapter.lessons.some(lesson => lesson.id === id));
    if (chapter && !open.includes(chapter.id)) setOpen([...open,chapter.id]);
    router.push(`/classroom/courses/${encodeURIComponent(courseId)}?lesson=${encodeURIComponent(id)}${preview ? '&preview=1' : ''}`);
  }
  function handlePurchase() {
    setPaymentOpen(false);
    if (isUnauthorized(profile.error)) { router.push('/login'); return; }
    if (purchase.current) return;
    requestKey.current ||= crypto.randomUUID();
    purchase.current = checkout(courseId, requestKey.current)
      .catch(error => { if (!redirectIfUnauthorized(error)) router.push('/payments/failure?kind=vod'); })
      .finally(() => { purchase.current = null; });
  }
  if (requiresLogin) return null;
  if (query.isPending) return <ViewerLoading />;
  return <>
    <SiteHeader
      mobileAt1360
      profileLoading={profile.isPending}
      profile={profile.data ? {name: profile.data.name, image: profile.data.avatar} : undefined}
      mobile={{ title: data?.title ?? '', onBack: () => router.back(), menu: true }}
    />
    <main className={`${styles.viewer} ${mobileStyles.viewer}`}>
      <aside className={`${styles.curriculum} ${mobileStyles.curriculum}`}>
        <h2>커리큘럼</h2>
        <div className={styles.units}>{data?.chapters.map(chapter => <section className={styles.unit} key={chapter.id}>
          <button type="button" className={styles.unitButton} aria-expanded={open.includes(chapter.id)} aria-controls={`unit-${chapter.id}`} onClick={() => setOpen(open.includes(chapter.id) ? open.filter(id => id !== chapter.id) : [...open, chapter.id])}>
            {chapter.title}<Image unoptimized src="/assets/viewer-imgChevronDown1.svg" width={16} height={16} alt="" className={open.includes(chapter.id) ? styles.chevronUp : undefined} />
          </button>
          {open.includes(chapter.id) && <div id={`unit-${chapter.id}`} className={styles.unitLessons}>{chapter.lessons.map(item => <button type="button" key={item.id} className={styles.lessonButton} aria-current={selected === item.id ? 'true' : undefined} onClick={() => select(item.id)}>{item.title}</button>)}</div>}
        </section>)}</div>
      </aside>
      <div className={`${styles.videoContent} ${mobileStyles.videoContent}`}>
        <div className={`${styles.videoHeading} ${mobileStyles.videoHeading}`}>
          <div><h1>{lesson?.title}</h1><p>{data?.title}</p></div>
          <div className={`${styles.protection} ${mobileStyles.protection}`}><Image unoptimized src="/assets/viewer-imgAlertCircle.svg" width={20} height={20} alt="" />해당 콘텐츠는 보호되고 있습니다.</div>
        </div>
        <div className={styles.videoGroup}>
          <div className={mobileStyles.media}>
            {query.isError ? <div className={styles.videoEmpty}><div><p>수강 권한을 확인하지 못했습니다.</p><button onClick={() => query.refetch()}>다시 시도</button></div></div> : data && (lessons.length === 0 ? <div className={styles.videoEmpty}>아직 공개된 강의가 없습니다.</div> : !lesson ? <div className={styles.videoEmpty}>강의를 찾을 수 없습니다.</div> : (data.orderId || data.previewUrl) ? (data.orderId ? <VideoPlayer key={lesson.id} orderId={data.orderId} lessonId={lesson.id} /> : <VideoPlayer key={lesson.id} previewUrl={data.previewUrl!} lessonId={lesson.id} />) : null)}
          </div>
          <div className={`${styles.videoActions} ${mobileStyles.videoActions}`}><Link href="/classroom">나가기</Link><div><button type="button" disabled={index <= 0} onClick={() => select(lessons[index-1].id)}>이전 강의</button><button type="button" disabled={index < 0 || index === lessons.length - 1} onClick={() => select(lessons[index + 1].id)}>다음 강의</button></div></div>
        </div>
      </div>
    </main>
    <SiteFooter />
    {paymentOpen && <ConfirmationDialog label="결제가 필요한 강의입니다." onCancel={() => setPaymentOpen(false)} actions={[{label:'취소',cancel:true},{label:'결제',onClick:handlePurchase}]}><p>결제가 필요한 강의입니다.</p><p>다음 영상을 확인하시러면 결제가 필요합니다. 결제하시겠습니까?</p></ConfirmationDialog>}
  </>;
}

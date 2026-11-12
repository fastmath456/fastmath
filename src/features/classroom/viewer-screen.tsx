'use client';

import Image from 'next/image';
import { isUnauthorized } from '@/lib/http';
import { VideoPlayer } from './video-player';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { ConfirmationDialog, SiteFooter, SiteHeader } from '@/components/site';
import { useProfile } from '@/features/account';
import { checkout, coursePaymentFailureHref } from '@/features/catalog';
import { useLoginRedirect } from '@/features/auth';
import { getViewer } from './api';
import { ViewerLoading } from './classroom-skeletons';
import styles from './classroom.module.css';
import mobileStyles from './viewer-mobile.module.css';

export function ViewerScreen({ courseId, lessonId, state = '', preview = false }: { courseId: string; lessonId?: string; state?: string; preview?: boolean }) {
  const profile = useProfile(), router = useRouter();
  const query = useQuery({ queryKey: ['viewer',courseId,state,preview,preview ? lessonId : undefined], queryFn: () => getViewer(courseId,preview,lessonId), gcTime: preview ? undefined : 0 });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(preview ? undefined : profile.error, query.error);
  const requestKey = useRef(''), purchase = useRef<Promise<void> | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [menuState, setMenuState] = useState<'closed' | 'open' | 'closing'>('closed');
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuId = useId(), menuVisible = menuState !== 'closed';
  const [expanded, setOpen] = useState<string[] | null>(null);
  const open = expanded ?? query.data?.chapters.slice(0,2).map(chapter => chapter.id) ?? [];
  const data = query.data, lessons = data?.chapters.flatMap(chapter => chapter.lessons) ?? [];
  const selected = lessonId ?? data?.recentLessonId ?? lessons[0]?.id;
  const index = lessons.findIndex(lesson => lesson.id === selected), lesson = lessons[index];
  useEffect(() => {
    const dialog = menuRef.current;
    if (!menuVisible || !dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desktop = window.matchMedia('(width >= 1360px)');
    const closeOnDesktop = () => { if (desktop.matches) dialog.close(); };
    dialog.showModal();
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => { desktop.removeEventListener('change', closeOnDesktop); dialog.close(); returnFocus?.focus(); };
  }, [menuVisible]);
  useEffect(() => {
    if (menuState !== 'closing') return;
    const timer = window.setTimeout(() => setMenuState('closed'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
    return () => window.clearTimeout(timer);
  }, [menuState]);
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
    const key = requestKey.current ||= crypto.randomUUID();
    purchase.current = checkout(courseId, key)
      .catch(error => { if (!redirectIfUnauthorized(error)) router.push(coursePaymentFailureHref(courseId, key)); })
      .finally(() => { purchase.current = null; });
  }
  if (requiresLogin) return null;
  if (query.isPending) return <ViewerLoading />;
  const curriculum = (scope: string) => <>
    <h2 id={`${scope}-title`}>커리큘럼</h2>
    <div className={styles.units}>{data?.chapters.map(chapter => <section className={styles.unit} key={chapter.id}>
      <button type="button" className={styles.unitButton} aria-expanded={open.includes(chapter.id)} aria-controls={`${scope}-unit-${chapter.id}`} onClick={() => setOpen(open.includes(chapter.id) ? open.filter(id => id !== chapter.id) : [...open, chapter.id])}>
        {chapter.title}<Image unoptimized src="/assets/viewer-imgChevronDown1.svg" width={16} height={16} alt="" className={open.includes(chapter.id) ? styles.chevronUp : undefined} />
      </button>
      {open.includes(chapter.id) && <div id={`${scope}-unit-${chapter.id}`} className={styles.unitLessons}>{chapter.lessons.map(item => <button type="button" key={item.id} className={styles.lessonButton} aria-current={selected === item.id ? 'true' : undefined} onClick={() => select(item.id)}>{item.title}</button>)}</div>}
    </section>)}</div>
  </>;
  return <>
    <SiteHeader
      mobileAt1360
      profileLoading={profile.isPending}
      profile={profile.data ? {name: profile.data.name, image: profile.data.avatar} : undefined}
      mobile={{ title: data?.title ?? '', onBack: () => router.back(), menu: <button className={mobileStyles.menuButton} type="button" aria-label="커리큘럼 메뉴" aria-expanded={menuVisible} aria-controls={menuId} onClick={() => setMenuState('open')}><Image unoptimized src="/assets/mobile-menu.svg" width={24} height={24} alt="" /></button> }}
    />
    {menuVisible && <dialog ref={menuRef} id={menuId} className={mobileStyles.menuDialog} data-closing={menuState === 'closing'} aria-labelledby={`${menuId}-title`} onClose={() => setMenuState('closed')} onCancel={event => { event.preventDefault(); setMenuState('closing'); }}>
      <SiteHeader mobileAt1360 mobile={{ title: data?.title ?? '', onBack: () => router.back(), backIcon: '/assets/viewer-menu-back.svg', menu: <button className={mobileStyles.menuButton} type="button" aria-label="커리큘럼 닫기" onClick={() => setMenuState('closing')}><Image unoptimized src="/assets/viewer-menu-close.svg" width={24} height={24} alt="" /></button> }} />
      <aside className={`${styles.curriculum} ${mobileStyles.menuPanel}`}>{curriculum(menuId)}</aside>
    </dialog>}
    <main className={`${styles.viewer} ${mobileStyles.viewer}`}>
      <aside className={`${styles.curriculum} ${mobileStyles.curriculum}`}>
        {curriculum(`${menuId}-desktop`)}
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
          <div className={`${styles.videoActions} ${mobileStyles.videoActions}`}>
            <Link href="/classroom">나가기</Link>
            <div>
              {index > 0 && <button type="button" onClick={() => select(lessons[index - 1].id)}>이전 강의</button>}
              {index >= 0 && index < lessons.length - 1 && <button type="button" onClick={() => select(lessons[index + 1].id)}>다음 강의</button>}
            </div>
          </div>
        </div>
      </div>
    </main>
    <SiteFooter />
    {paymentOpen && <ConfirmationDialog label="결제가 필요한 강의입니다." onCancel={() => setPaymentOpen(false)} actions={[{label:'취소',cancel:true},{label:'결제',onClick:handlePurchase}]}><p>결제가 필요한 강의입니다.</p><p>다음 영상을 확인하시러면 결제가 필요합니다. 결제하시겠습니까?</p></ConfirmationDialog>}
  </>;
}

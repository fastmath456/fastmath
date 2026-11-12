'use client';

import Image from 'next/image';
import { AdminGuide } from '@/features/admin-guide';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readResponse } from '@/lib/http';
import { ResetOnLeave } from '@/components/site';
import { ReviewDialog } from './review-dialog';
import { ReviewEditorDialog } from './review-editor-dialog';
import { landingReviews, maskReviewAuthor, type SourceReview } from './reviews';
import { reviewKeyframes } from './review-carousel';
import styles from './landing.module.css';

export function ReviewsSection() {
  const [review, setReview] = useState<SourceReview | null>(null);
  const [editing, setEditing] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const paused = useRef(false);
  const client = useQueryClient();
  const query = useQuery<{ items: SourceReview[]; admin: boolean }>({ queryKey: ['landing-reviews'], queryFn: async () => readResponse(await fetch('/api/landing/reviews')) });
  const items = query.data?.items ?? landingReviews;

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function update() {
      animation.current?.cancel();
      animation.current = null;
      if (!reducedMotion.matches && items.length) {
        animation.current = element!.animate(reviewKeyframes(items.length), { duration: items.length * 2500, iterations: Infinity });
        if (paused.current) animation.current.pause();
      }
    }
    update();
    reducedMotion.addEventListener('change', update);
    return () => { reducedMotion.removeEventListener('change', update); animation.current?.cancel(); animation.current = null; };
  }, [items.length]);

  useEffect(() => {
    paused.current = Boolean(review);
    if (paused.current) animation.current?.pause();
    else animation.current?.play();
  }, [review]);

  return <section className={styles.reviews} aria-labelledby="reviews-title">
    <div className={`${styles.container} ${styles.reviewsHeadingRow}`}>
      <div className={styles.reviewsHeading}><h2 id="reviews-title" className={styles.sectionTitle}>관점이 바뀌면,<br className={styles.mobBreak} /> 공부가 달라지니까.</h2><p className={styles.bodyCopy}>빠른수학 유튜브 영상을 보고 시청자가 직접 남긴<br className={styles.mobBreak} /> 이야기입니다.</p></div>
      {query.data?.admin && <div className={styles.reviewAdminActions}><button data-guide="landing-review-manage" type="button" className={styles.reviewManageButton} onClick={() => setEditing(true)}>리뷰 관리</button><AdminGuide guide="landing-reviews" admin={query.data.admin} paused={editing || Boolean(review)} /></div>}
    </div>
    <div className={styles.reviewBanner}>
      <div ref={track} className={styles.reviewTrack}>
        {[false, true].map(duplicate => <div key={String(duplicate)} className={styles.reviewGroup} aria-hidden={duplicate || undefined}>
          {items.map(item => <article className={styles.reviewCard} key={item.id}>
            <div className={styles.reviewSource}><span className={styles.youtubeBadge}><span className={styles.youtubeIcon}><Image unoptimized src="/assets/landing/youtube.png" width={640} height={443} alt="" /></span>유튜브</span><span className={styles.sourceLabel}>시청자 댓글<span>中</span></span></div>
            <div className={styles.reviewBody}><p className={styles.reviewPreview}>{item.text}</p><div className={styles.reviewMeta}><span className={styles.author}>{maskReviewAuthor(item.author)}</span><button type="button" tabIndex={duplicate ? -1 : undefined} className={styles.reviewLink} onClick={() => setReview(item)}>원문 보기<Image unoptimized src="/assets/landing/up-right.svg" width={16} height={16} alt="" /></button></div></div>
          </article>)}
        </div>)}
      </div>
    </div>
    <div className={`${styles.container} ${styles.reviewActions}`}><p className={styles.videoPrompt}>영상으로 먼저 만나보세요.</p><a href="https://www.youtube.com/@fastermaths" target="_blank" rel="noreferrer" className={styles.action}>빠른수학 유튜브<Image unoptimized src="/assets/landing/arrow.svg" width={20} height={20} alt="" /></a></div>
    {review && <ReviewDialog review={review} onClose={() => setReview(null)} />}
    {editing && query.data?.admin && <ResetOnLeave><ReviewEditorDialog reviews={items} onClose={() => setEditing(false)} onSaved={saved => {
      client.setQueryData<{ items: SourceReview[]; admin: boolean }>(['landing-reviews'], current => ({ admin: true, items: items.some(item => item.id === saved.id) ? (current?.items ?? items).map(item => item.id === saved.id ? saved : item) : [...(current?.items ?? items), saved] }));
      setEditing(false);
    }} /></ResetOnLeave>}
  </section>;
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useState, type MouseEvent } from 'react';
import { SiteFooter, SiteHeader } from '@/components/site';
import { useProfile } from '@/features/account';
import { landingFacts, landingReviews, philosophySteps, teachingPoints, type SourceReview } from './landing-content';
import { ReviewDialog } from './review-dialog';
import { useStatisticsCount } from './use-statistics-count';
import styles from './landing.module.css';

function CoursesLink({ dark = false }: { dark?: boolean }) {
  return <Link href="/courses" className={dark ? styles.darkAction : styles.action}>
    강의·교재 살펴보기
    <Image unoptimized src={`/assets/landing/arrow${dark ? '-yellow' : ''}.svg`} width={20} height={20} alt="" />
  </Link>;
}

function LandingHeader() {
  const profile = useProfile();
  return <SiteHeader profileLoading={profile.isPending} profile={profile.data ? { name: profile.data.name, image: profile.data.avatar } : undefined} mobileAt1080 />;
}

function TeachingPoints() {
  const point = teachingPoints[0];
  const board = point.board;

  return <section className={styles.teaching} aria-labelledby="teaching-title">
    <div className={`${styles.container} ${styles.teachingInner}`}>
      <div className={styles.teachingLead}>
        <div className={styles.teachingHeader}>
          <h2 id="teaching-title" className={styles.sectionTitle}>풀이보다 먼저,<br />생각하는 방법을 배웁니다.</h2>
          <p className={styles.bodyCopy}>어디서 시작할지, 무엇을 볼지, 어떻게 확인할지.<br />문제를 풀어내는 사고과정을 전합니다.</p>
        </div>
        <div role="list" aria-label="세 가지 강의 포인트" className={styles.tabs}>
          {teachingPoints.map(item => <div key={item.number} role="listitem" className={styles.tab}>
            <span className={styles.tabNumber}>{item.number}</span><span className={styles.tabTitle}>{item.label}</span>
          </div>)}
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelCopy}>
          <h3 className={styles.sectionTitle}>{point.title[0]}<br />{' '}{point.title[1]}</h3>
          <p className={styles.bodyCopy}>근호 안의 조건과 오른쪽의 부호를<br /> 함께 확인합니다. 계산에 앞서 원래 식이 요구하는 조건부터 읽습니다.</p>
        </div>
        {board && <div className={styles.board} aria-hidden={!point.board}>
          <div className={styles.boardCopy}><h3>{board.title}</h3><p>{board.description}</p></div>
          <div className={styles.boardImage}><Image unoptimized src={board.image} width={1823} height={863} alt={board.alt} /></div>
        </div>}
      </div>
    </div>
  </section>;
}

export function LandingScreen() {
  const [review, setReview] = useState<SourceReview | null>(null);
  const { statisticsRef, progress } = useStatisticsCount();

  function goToPhilosophy(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', '/#philosophy');
    document.getElementById('philosophy')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  return <div className={styles.page}>
    <LandingHeader />
    <main>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={`${styles.container} ${styles.heroLayout}`}>
          <div className={styles.heroCopy}>
            <h1 id="landing-title" className={styles.heroTitle}>빠른 풀이는,<br /> 깊은 이해에서.</h1>
            <p className={styles.heroDescription}>정의를 정확히 이해하고,<br className={styles.mobBreak} /> 스스로 ‘왜?’를 설명할 수 있을 때까지.<br />극상위권의 사고과정으로 수학을 다시 봅니다.</p>
            <div className={styles.heroActions}><CoursesLink /><Link href="/#philosophy" scroll={false} className={styles.philosophyLink} onClick={goToPhilosophy}>강의 철학 알아보기<Image unoptimized src="/assets/landing/arrow.svg" width={20} height={20} alt="" /></Link></div>
          </div>
          <div className={styles.heroImage}><Image unoptimized loading="eager" src="/assets/landing/hero-desktop.png" width={1366} height={1152} alt="점 A(1,1)과 B(2,4)를 잇는 직선과 함수 f(x)=x²를 비교한 손글씨 그래프" /></div>
        </div>
      </section>
      <section ref={statisticsRef} className={styles.statistics} aria-label="빠른수학 소개 정보">
        <div className={styles.statisticsLayout}>
          <h2 className={styles.statisticsHeading}>수학을 바라보는 관점,<br /> 함께 나누고 있습니다.</h2>
          <div className={styles.metrics}>{landingFacts.map((fact, index) => <Fragment key={fact.value}>
            {index > 0 && <Image unoptimized className={styles.metricRule} src="/assets/landing/metric-rule.svg" width={1} height={64} alt="" />}
            <div className={styles.metric}><p className={styles.metricValue}>{fact.countTo === undefined ? fact.value : `${Math.floor(fact.countTo * progress * 10) / 10}만`}</p><p className={styles.metricLabel}>{fact.label}</p></div>
          </Fragment>)}</div>
        </div>
      </section>
      <section id="philosophy" className={styles.philosophy} aria-labelledby="philosophy-title">
        <div className={`${styles.container} ${styles.philosophyContent}`}>
          <div className={styles.philosophyIntro}>
            <div className={styles.why}><picture><source media="(width <= 1080px)" srcSet="/assets/landing/why-mobile.png" /><Image unoptimized src="/assets/landing/why-desktop.png" width={247} height={140} alt="왜?" /></picture></div>
            <div className={styles.philosophyCopy}>
              <h2 id="philosophy-title" className={styles.sectionTitle}>공식 뒤에 있는 이유까지.<br /> 한 문제를 풀어도, 깊이.</h2>
              <p className={styles.bodyCopy}>수학은 문제를 많이 푸는 것만큼, 한 문제를<br className={styles.mobBreak} /> 오래 고민하는 시간도 중요합니다.<br />정의와 원리를 정확하게 이해하고,<br className={styles.mobBreak} /> 스스로 ‘왜?’를 설명할 수 있을 때까지.<br />빠른수학은 그 생각의 과정을 함께합니다.</p>
            </div>
          </div>
          <div className={styles.steps}>{philosophySteps.map(step => <div className={styles.step} key={step.number}>
            <div className={styles.stepRule}><picture><source media="(768px <= width <= 1080px)" srcSet="/assets/landing/step-rule-tablet.svg" /><source media="(width < 768px)" srcSet="/assets/landing/step-rule-mobile.svg" /><Image unoptimized loading="eager" src="/assets/landing/step-rule-desktop.svg" width={427} height={1} alt="" /></picture></div>
            <div className={styles.stepContent}><span className={styles.stepNumber}>{step.number}</span><div className={styles.stepCopy}><h3 className={styles.stepTitle}>{step.title}</h3><p className={styles.stepDescription}>{step.description}</p></div></div>
          </div>)}</div>
        </div>
      </section>
      <TeachingPoints />
      <section className={`${styles.container} ${styles.reviews}`} aria-labelledby="reviews-title">
        <div className={styles.reviewsHeading}><h2 id="reviews-title" className={styles.sectionTitle}>관점이 바뀌면,<br className={styles.mobBreak} /> 공부가 달라지니까.</h2><p className={styles.bodyCopy}>빠른수학 유튜브 영상을 보고 시청자가 직접 남긴<br className={styles.mobBreak} /> 이야기입니다.</p></div>
        <div className={styles.reviewGrid}>{landingReviews.map((item, index) => <article className={styles.reviewCard} key={`${item.id}-${index}`}>
          <div className={styles.reviewSource}><span className={styles.youtubeBadge}><span className={styles.youtubeIcon}><Image unoptimized src="/assets/landing/youtube.png" width={640} height={443} alt="" /></span>유튜브</span><span className={styles.sourceLabel}>시청자 댓글<span>中</span></span></div>
          <div className={styles.reviewBody}><p className={styles.reviewPreview}>{item.text}</p><div className={styles.reviewMeta}><span className={styles.author}>{item.author}</span><button type="button" className={styles.reviewLink} onClick={() => setReview(item)}>원문 보기<Image unoptimized src="/assets/landing/up-right.svg" width={16} height={16} alt="" /></button></div></div>
        </article>)}</div>
        <div className={styles.reviewActions}><p className={styles.videoPrompt}>영상으로 먼저 만나보세요.</p><a href="https://www.youtube.com/@fastermaths" target="_blank" rel="noreferrer" className={styles.action}>빠른수학 유튜브<Image unoptimized src="/assets/landing/arrow.svg" width={20} height={20} alt="" /></a></div>
      </section>
      <section className={`${styles.container} ${styles.closing}`} aria-labelledby="closing-title"><div className={styles.closingBanner}><div className={styles.closingContent}>
        <div className={styles.closingCopy}><h2 id="closing-title" className={styles.closingTitle}>여러분의 수학 공부 시간을,<br />1초라도 더 가치 있게.</h2><p className={styles.closingDescription}>빠른수학의 강의와 PDF 전자책으로 이어가 보세요.</p></div><CoursesLink dark />
      </div></div></section>
    </main>
    <SiteFooter />
    {review && <ReviewDialog review={review} onClose={() => setReview(null)} />}
  </div>;
}

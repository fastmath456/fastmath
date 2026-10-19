'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isMockMode } from '@/lib/http';
import { checkout } from './checkout';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiteFooter, SiteHeader } from '@/components/site';
import { useMockReady } from '@/app/providers';
import { AdminCourseActions } from '@/features/manage';
import { useLoginRedirect } from '@/features/auth';
import { discountPercent, getProduct } from './api';
import { refundEmphasis, refundIntro, refundSections } from './refund-copy';
import styles from './catalog.module.css';

export function ProductDetailScreen({ slug, kind, state = '', view = '' }: { slug: string; kind: 'vod' | 'pdf'; state?: string; view?: string }) {
  const ready = useMockReady(), router = useRouter();
  const { redirectIfUnauthorized } = useLoginRedirect();
  const requestKey = useRef(''), purchase = useRef<Promise<void> | null>(null);
  const query = useQuery({ queryKey: ['product', slug, kind, state, view], queryFn: () => getProduct(slug, kind, state, view), enabled: ready });
  const [openChapter, setOpenChapter] = useState<string | null>('chapter-1');
  const [active, setActive] = useState('info');
  const product = query.data;
  useEffect(() => {
    if (!product) return;
    function update() {
      let current = 'info';
      for (const id of ['info', 'reviews', 'refund']) { const element = document.getElementById(id); if (element && element.getBoundingClientRect().top <= 84) current = id; }
      setActive(current);
    }
    update(); window.addEventListener('scroll', update, { passive: true });
    const hash = location.hash.slice(1);
    if (['info', 'reviews', 'refund'].includes(hash)) document.getElementById(hash)?.scrollIntoView();
    return () => window.removeEventListener('scroll', update);
  }, [product]);
  const owned = product?.ownership === 'owned';
  const handlePurchase = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isMockMode || !product?.profile) return;
    event.preventDefault();
    if (purchase.current) return;
    requestKey.current ||= crypto.randomUUID();
    purchase.current = checkout(product.id, requestKey.current)
      .catch(error => { if (!redirectIfUnauthorized(error)) router.push(`/payments/failure?kind=${kind}`); })
      .finally(() => { purchase.current = null; });
  };
  const discounted = product && product.basePrice !== undefined && product.basePrice > product.price;
  return <><SiteHeader activeCourses profile={product?.profile} /><main className={`${styles.detail} ${product?.admin ? styles.adminDetail : ''}`}>
    {query.isError ? <div className={styles.requestError}><p>강의 정보를 불러오지 못했습니다. 다시 시도해주세요.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : product && <>
      <div className={styles.detailLeft}><Image unoptimized loading="eager" className={styles.hero} src={product.image} width={640} height={410} alt={product.title} onError={event => { event.currentTarget.src = '/assets/detail-imgRectangle3.png'; }} /><div><nav className={styles.tabs} aria-label="상품 상세 섹션">{[['info',kind === 'vod' ? '강의정보' : '전자책 정보'],['reviews',`후기(${product.reviews.length})`],['refund','취소 및 환불']].map(([id,label]) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}>{label}</a>)}</nav><section id="info" className={styles.detailImage} aria-label="상품 소개 콘텐츠 영역" style={product.detailImage ? { height: 'auto', aspectRatio: 'auto', background: 'transparent', display: 'block' } : undefined}>{product.detailImage ? <Image unoptimized src={product.detailImage.url} width={product.detailImage.width ?? 640} height={product.detailImage.height ?? 1854} alt={`${product.title} 상세 이미지`} style={{ display: 'block', width: '100%', height: 'auto' }} /> : '상세 IMG'}</section></div>
      <section id="reviews" className={styles.reviews}><h2 className={styles.sectionTitle}>후기({product.reviews.length})</h2>{product.reviews.length ? <div>{product.reviews.map(review => <article className={styles.review} key={review.author}><div className={styles.stars} aria-label={`5점 만점에 ${review.rating}점`}>{Array.from({length:5},(_,index) => <Image unoptimized key={index} src="/assets/detail-imgStar02.svg" width={16} height={16} alt="" />)}<span>({review.rating.toFixed(1)}/5.0)</span></div><p className={styles.reviewBody}>{review.body}</p><div className={styles.reviewMeta}><span>{product.title}</span><span>·</span><span>{review.author}</span><span>·</span><span>{review.date}</span></div></article>)}</div> : <div className={styles.empty}><p>아직 등록된 후기가 없습니다.</p></div>}</section>
      <section id="refund" className={styles.refund}><h2 className={styles.sectionTitle}>취소 및 환불</h2><div className={styles.refundContent}><p>{refundIntro}</p>{refundSections.map(section => <div className={styles.refundSection} key={section.title}><h3>{section.title}</h3><div className={styles.bullets}>{section.paragraphs.map(text => <div className={styles.bullet} key={text}><span aria-hidden="true">•</span><p>{text.split(refundEmphasis).map((part,index) => index % 2 ? <strong key={index}>{part}</strong> : part)}</p></div>)}</div></div>)}</div></section></div>
      <aside className={styles.sticky}><section className={`${styles.purchase} ${kind === 'pdf' ? styles.pdf : ''}`}><div className={styles.purchaseHeading}><div className={styles.tags}>{product.tags.map(tag => <span className={styles.tag} key={tag}>{tag}</span>)}</div><h1 className={styles.purchaseTitle}>{product.title}</h1></div><div className={styles.purchaseInfo}>{discounted && <div className={styles.infoRow}><span className={styles.infoLabel}>기본가</span><span className={styles.basePrice}>{product.basePrice!.toLocaleString('ko-KR')}원</span></div>}<div className={styles.infoRow}><span className={styles.infoLabel}>{discounted ? '할인가' : '판매가'}</span><div className={styles.sale}>{product.price.toLocaleString('ko-KR')}원{discounted && <span className={styles.discount}>{discountPercent(product.basePrice!, product.price)}%<Image unoptimized src="/assets/detail-imgDownArrow.svg" width={16} height={16} alt="" /></span>}</div></div><div className={styles.infoRow}><span className={styles.infoLabel}>유형</span><span>{kind === 'vod' ? 'VOD 클래스' : 'PDF 전자책'}</span></div><div className={styles.infoRow}><span className={styles.infoLabel}>{kind === 'vod' ? '수강기간' : '다운로드기간'}</span><span>결제일로부터 {product.licenseDays ?? 60}일</span></div></div>{owned || !product.selling ? <button type="button" disabled className={styles.buy}>{owned ? kind === 'vod' ? '이미 수강 중인 강의입니다.' : '이미 구매한 교재입니다.' : '판매 종료'}</button> : <Link href="/login" className={styles.buy} onClick={handlePurchase}>{kind === 'vod' ? '수강 신청하기' : '전자책 구매하기'}</Link>}</section>
      {kind === 'vod' && <section className={styles.curriculum}><h2 className={styles.sectionTitle}>강의 커리큘럼</h2><div className={styles.chapters}>{product.chapters.map(chapter => <section key={chapter.id} className={styles.chapter}><button type="button" className={styles.chapterButton} aria-expanded={openChapter === chapter.id} aria-controls={`content-${chapter.id}`} onClick={() => setOpenChapter(openChapter === chapter.id ? null : chapter.id)}>{chapter.title}<Image unoptimized src={`/assets/detail-imgChevron${openChapter === chapter.id ? 'Up' : 'Down'}.svg`} width={24} height={24} alt="" /></button>{openChapter === chapter.id && <div className={styles.lessons} id={`content-${chapter.id}`}>{chapter.lessons.map(lesson => <div className={styles.lesson} key={lesson.id}><div className={styles.lessonName}><p className={styles.lessonTitle}>{lesson.title}</p><span className={styles.duration}>{lesson.duration}</span></div>{lesson.preview && <button type="button" className={styles.preview}>미리보기</button>}</div>)}</div>}</section>)}</div></section>}</aside>
      {product.admin && <AdminCourseActions courseId={product.id} />}
    </>}
  </main><SiteFooter /></>;
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SiteFooter, SiteHeader, Skeleton } from '@/components/site';
import { getProducts, parseSort } from './api';
import styles from './product-list-mobile.module.css';
import { ProductListSkeleton } from './product-skeletons';
import loading from './product-skeletons.module.css';

export function ProductListScreen({ sortValue, state = '' }: { sortValue?: string; state?: string }) {
  const sort = parseSort(sortValue), router = useRouter();
  const query = useQuery({ queryKey: ['products', sort, state], queryFn: () => getProducts(sort) });
  return <><SiteHeader activeCourses profile={query.data?.profile} profileLoading={query.isPending} /><main className={styles.listing}><div className={styles.listingHeading}><h1 className={styles.title} aria-label={query.isPending ? '강의·교재 목록' : undefined}>{query.isPending ? <Skeleton className={loading.line}>강의·교재 목록(00)</Skeleton> : <>강의·교재 목록{query.data ? `(${query.data.count})` : ''}</>}</h1><label className={styles.sort}>정렬<span className={styles.sortControl}><select aria-label="정렬" className={styles.select} value={sort} onChange={event => router.push(`/courses?sort=${event.target.value}${state ? `&state=${encodeURIComponent(state)}` : ''}`)}><option value="latest">최신순</option><option value="price-asc">낮은 가격순</option><option value="price-desc">높은 가격순</option></select><Image unoptimized className={styles.sortIcon} src="/assets/listing-imgArrowSwitchHorizontal.svg" width={16} height={16} alt="" /></span></label></div>
    {query.isPending ? <ProductListSkeleton /> : query.isError ? <div className={styles.requestError}><p>강의·교재 목록을 불러오지 못했어요.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data?.count === 0 ? <div className={styles.empty}><p>아직 등록된 강의 및 교재가 없어요.</p></div> : <div className={styles.grid}>{query.data?.items.map(product => <Link key={product.id} className={styles.card} href={`/${product.kind === 'vod' ? 'courses' : 'books'}/${product.slug}`} aria-label={product.title}><Image unoptimized loading="eager" className={styles.thumbnail} src={product.image} width={325} height={217} alt={product.title} onError={event => { event.currentTarget.src = '/assets/listing-imgRectangle3.png'; }} /><div className={styles.cardInfo}><div className={styles.cardHeading}><div className={styles.tags}>{product.tags.map(tag => <span className={styles.tag} key={tag}>{tag}</span>)}</div><h2 className={styles.cardTitle}>{product.title}</h2></div><p className={styles.price}>{product.price.toLocaleString('ko-KR')}원</p></div></Link>)}</div>}
  </main><SiteFooter /></>;
}

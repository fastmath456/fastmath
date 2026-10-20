'use client';

import { useRouter } from 'next/navigation';
import { SiteFooter, SiteHeader, Skeleton } from '@/components/site';
import styles from './catalog.module.css';
import listing from './product-list-mobile.module.css';
import mobileStyles from './product-detail-mobile.module.css';
import loading from './product-skeletons.module.css';

export function ProductListSkeleton() {
  return <div className={listing.grid} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className={listing.card} key={index} aria-hidden="true">
    <Skeleton className={listing.thumbnail} />
    <div className={listing.cardInfo}><div className={listing.cardHeading}><Skeleton className={loading.tag} /><Skeleton className={`${listing.cardTitle} ${loading.line}`} /></div><Skeleton className={`${listing.price} ${loading.line}`} /></div>
  </div>)}</div>;
}

export function ProductListLoading() {
  return <><SiteHeader activeCourses profileLoading /><main className={listing.listing}><div className={listing.listingHeading}><h1 className={listing.title}>강의·교재 목록<Skeleton className={loading.count}>(　)</Skeleton></h1><span className={listing.sort}>정렬<span className={listing.select}><Skeleton>낮은 가격순</Skeleton></span></span></div><ProductListSkeleton /></main><SiteFooter /></>;
}

export function ProductDetailLoading({ kind }: { kind: 'vod' | 'pdf' }) {
  const router = useRouter();
  const purchase = (mobile = false) => <section className={`${styles.purchase} ${mobile ? mobileStyles.mobilePurchase : ''}`} aria-busy="true">
    <div className={styles.purchaseHeading}><Skeleton className={loading.tag} /><Skeleton className={`${styles.purchaseTitle} ${loading.line}`} /></div>
    <div className={styles.purchaseInfo}>{Array.from({ length: 3 }, (_, index) => <div className={styles.infoRow} key={index}><Skeleton className={`${styles.infoLabel} ${loading.line}`} /><Skeleton className={`${loading.value} ${loading.line}`} /></div>)}</div>
    <div className={styles.buy}><Skeleton className={loading.fill} /></div>
  </section>;
  const curriculum = () => kind === 'vod' && <section className={styles.curriculum} aria-busy="true"><h2 className={styles.sectionTitle}>강의 커리큘럼</h2><div className={styles.chapter}><div className={styles.chapterButton}><Skeleton className={loading.line} /></div><Skeleton className={loading.line} /></div></section>;
  return <><SiteHeader activeCourses mobileAt1080 profileLoading titleLoading mobile={{ title: '', onBack: () => router.back() }} /><main className={`${styles.detail} ${mobileStyles.detail}`} aria-busy="true">
    <div className={`${styles.detailLeft} ${mobileStyles.detailLeft}`}><div className={mobileStyles.heroAndPurchase}><Skeleton className={`${styles.hero} ${mobileStyles.hero}`} /><div className={mobileStyles.mobileProduct}>{purchase(true)}{curriculum()}</div></div>
      <div className={mobileStyles.detailContent}><div className={styles.tabs}>{[kind === 'vod' ? '강의정보' : '전자책 정보', '후기', '취소 및 환불'].map(label => <span className={loading.tab} key={label}>{label}</span>)}</div><div className={`${styles.detailImage} ${mobileStyles.detailImage}`}><Skeleton className={loading.fill} /></div></div>
    </div><aside className={`${styles.sticky} ${mobileStyles.sticky}`}>{purchase()}{curriculum()}</aside>
  </main><SiteFooter /></>;
}

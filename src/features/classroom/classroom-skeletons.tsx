'use client';

import { useRouter } from 'next/navigation';
import { AccountShell } from '@/features/account';
import { SiteFooter, SiteHeader, Skeleton } from '@/components/site';
import account from '../account/account.module.css';
import styles from './classroom.module.css';
import mobile from './classroom-mobile.module.css';
import viewerMobile from './viewer-mobile.module.css';
import loading from './classroom-skeletons.module.css';

export function ClassroomSkeleton() {
  return <div className={mobile.list} aria-busy="true">{Array.from({ length: 3 }, (_, index) => <div className={mobile.row} key={index} aria-hidden="true"><div className={mobile.rowContent}>
    <div className={mobile.thumbnail}><Skeleton className={loading.fill} /></div>
    <div className={mobile.info}><div className={mobile.infoHeading}><Skeleton className={loading.status} /><Skeleton className={`${mobile.productTitle} ${loading.line}`} /></div><div className={mobile.details}>{Array.from({ length: 3 }, (_, field) => <Skeleton className={loading.line} key={field} />)}</div></div>
    <div className={mobile.actions}><Skeleton className={loading.action}>VOD 수강하기</Skeleton></div>
  </div></div>)}</div>;
}

export function ClassroomLoading() {
  return <AccountShell profileLoading section="classroom"><div><h1 className={account.title}>내 강의실<Skeleton className={loading.count}>(　)</Skeleton></h1><p className={account.subtitle}>구매한 강의와 교재를 한곳에서 확인하세요.</p></div><ClassroomSkeleton /></AccountShell>;
}

export function ViewerLoading() {
  const router = useRouter();
  return <><SiteHeader profileLoading titleLoading mobileAt1360 mobile={{ title: '', onBack: () => router.back(), menu: true }} /><main className={`${styles.viewer} ${viewerMobile.viewer}`} aria-busy="true"><aside className={`${styles.curriculum} ${viewerMobile.curriculum}`}><h2>커리큘럼</h2><div className={styles.unit}><Skeleton className={loading.unit} /><Skeleton className={loading.unit} /></div></aside><div className={`${styles.videoContent} ${viewerMobile.videoContent}`}><div className={`${styles.videoHeading} ${viewerMobile.videoHeading}`}><div className={loading.heading}><Skeleton className={loading.title} /><Skeleton className={loading.line} /></div></div><div className={styles.videoGroup}><div className={viewerMobile.media}><Skeleton className={`${styles.poster} ${loading.media}`} /></div><div className={styles.videoActions}><Skeleton className={loading.action}>나가기</Skeleton><div><Skeleton className={loading.action}>이전 강의</Skeleton><Skeleton className={loading.action}>다음 강의</Skeleton></div></div></div></div></main><SiteFooter /></>;
}

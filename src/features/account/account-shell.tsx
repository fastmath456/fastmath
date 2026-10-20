import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader, Skeleton } from '@/components/site';
import type { Profile } from './types';
import styles from './account.module.css';

export function AccountShell({ profile, profileLoading = false, section, children }: { profile?: Profile; profileLoading?: boolean; section: 'classroom' | 'orders' | 'profile'; children: ReactNode }) {
  return <><SiteHeader mobileAt1360 profileLoading={profileLoading} profile={profile ? {name:profile.name,image:profile.avatar} : undefined} /><main className={styles.layout}><aside className={styles.sidebar}>{profileLoading && !profile ? <div className={styles.profile} aria-busy="true"><Skeleton className={styles.avatarSkeleton} /><Skeleton className={styles.greetingSkeleton} /><Skeleton className={styles.emailSkeleton} /></div> : profile && <div className={styles.profile}><Image unoptimized src={profile.avatar} width={48} height={48} alt="" className={styles.avatar} /><div><p className={styles.greeting} title={`${profile.name}님, 안녕하세요`}>{profile.name}님, 안녕하세요</p><p className={styles.email} title={profile.email}>{profile.email}</p></div></div>}<nav aria-label="계정 메뉴">{[['classroom','내 강의실'],['orders','내 결제내역'],['profile','내 정보']].map(([route,label]) => <Link key={route} href={`/${route}`} aria-current={section === route ? 'page' : undefined}>{label}</Link>)}</nav></aside><div className={styles.content}>{children}</div></main><SiteFooter /></>;
}

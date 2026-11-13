import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/site';
import type { Profile } from '@/features/account';
import styles from './refunds.module.css';

const menu = [['/manage/courses/new', '강의 등록', 'courses'], ['/manage/refunds', '환불 관리', 'refunds']] as const;

export function ManageShell({ profile, profileLoading = false, section, children }: { profile?: Profile; profileLoading?: boolean; section: 'courses' | 'refunds'; children: ReactNode }) {
  return <><SiteHeader mobileAt1360 profileLoading={profileLoading} profile={profile ? { name: profile.name, image: profile.avatar } : undefined} />
    <main className={styles.layout}>
      <aside className={styles.sidebar}>
        {profile && <div className={styles.profile}><Image unoptimized src={profile.avatar} width={48} height={48} alt="" className={styles.avatar} /><div><p className={styles.greeting} title={`${profile.name}님, 안녕하세요`}>{profile.name}님, 안녕하세요</p><p className={styles.email} title={profile.email}>{profile.email}</p></div></div>}
        <nav aria-label="관리 메뉴">{menu.map(([href, label, key]) => <Link key={key} href={href} aria-current={section === key ? 'page' : undefined}>{label}</Link>)}</nav>
      </aside>
      <div className={styles.content}>{children}</div>
    </main>
    <SiteFooter /></>;
}

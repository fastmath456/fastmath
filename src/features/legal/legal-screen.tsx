'use client';

import { useRouter } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site';
import { useProfile } from '@/features/account';
import styles from './legal.module.css';

export function LegalScreen({ document }: { document: { title: string; lines: readonly string[] } }) {
  const router = useRouter();
  const profile = useProfile();

  return <>
    <SiteHeader profileLoading={profile.isPending} profile={profile.data ? { name: profile.data.name, image: profile.data.avatar, admin: profile.data.admin } : undefined} mobile={{ title: document.title, onBack: () => router.back() }} />
    <main className={styles.main}>
      <h1 className={styles.title}>{document.title}</h1>
      <article className={styles.content}>
        {document.lines.map((line, index) => <p key={index}>{line}</p>)}
      </article>
    </main>
    <SiteFooter />
  </>;
}

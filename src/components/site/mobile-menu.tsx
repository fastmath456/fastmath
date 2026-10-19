'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import styles from './site.module.css';

export function MobileMenu({ profile }: { profile?: { name: string; image: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const links = [['/', '홈'], ['/courses', '강의·교재 목록'], ['/classroom', '내 강의실'], ['/orders', '내 결제내역'], ['/profile', '내 정보']];
  return <><button className={styles.backButton} type="button" aria-label="메뉴" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}><Image unoptimized src="/assets/mobile-menu.svg" width={24} height={24} alt="" /></button>{open && <><div className={styles.mobileMenuBackdrop} aria-hidden="true" /><nav id={id} className={styles.mobileMenu} aria-label="사이트·계정 메뉴" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>{profile ? <Link href="/profile" className={styles.profileLink} onClick={() => setOpen(false)}><Image unoptimized className={styles.profileImage} src={profile.image} width={24} height={24} alt="" />{profile.name}님</Link> : <Link href="/login" onClick={() => setOpen(false)}>로그인/회원가입</Link>}{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (href !== '/' && pathname.startsWith(href + '/')) ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}</nav></>}</>;
}

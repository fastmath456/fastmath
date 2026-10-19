import Image from 'next/image';
import Link from 'next/link';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { MobileMenu } from './mobile-menu';
import styles from './site.module.css';

export function Logo({ large = false }: { large?: boolean }) {
  return <span className={`${styles.logo} ${large ? styles.largeLogo : ''}`} role="img" aria-label="빠른수학"><span className={styles.logoInner}>
    <Image unoptimized loading="eager" className={styles.logoShadow} src={`/assets/login-${large ? 'img2' : 'img'}.svg`} width={large ? 161 : 80} height={large ? 41 : 21} alt="" />
    <Image unoptimized loading="eager" className={styles.logoFront} src={`/assets/login-${large ? 'img3' : 'img1'}.svg`} width={large ? 164 : 82} height={large ? 45 : 22} alt="" />
  </span></span>;
}

export function SiteHeader({ profile, activeCourses = false, mobileAt1080 = false, mobileAt1360 = false, mobile }: { profile?: { name: string; image: string }; activeCourses?: boolean; mobileAt1080?: boolean; mobileAt1360?: boolean; mobile?: { title: string; onBack?: () => void; href?: string; menu?: boolean } }) {
  return <><header className={`${styles.header} ${mobileAt1080 ? styles.mobileAt1080 : ''} ${mobileAt1360 ? styles.mobileAt1360 : ''}`}><nav className={styles.headerLeft} aria-label="주 메뉴"><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><Link href="/">홈</Link><Link href="/courses" className={activeCourses ? styles.activeCourses : undefined}>강의·교재 목록</Link></nav>
    <div className={styles.headerRight}>{profile ? <Link href="/profile" className={styles.profileLink}><Image unoptimized className={styles.profileImage} src={profile.image} width={24} height={24} alt="" />{profile.name}님</Link> : <Link href="/login">로그인/회원가입</Link>}<Link href={profile ? '/classroom' : '/login'} className={styles.classroomLink}>내 강의실</Link></div>
  </header><header className={`${styles.mobileHeader} ${mobileAt1080 ? styles.mobileAt1080 : ''} ${mobileAt1360 ? styles.mobileAt1360 : ''}`}>{mobile ? <>{mobile.onBack ? <button className={styles.backButton} type="button" aria-label="뒤로가기" onClick={mobile.onBack}><Image unoptimized src="/assets/login-imgArrowLeft.svg" width={24} height={24} alt="" /></button> : <Link className={styles.backButton} href={mobile.href ?? '/courses'} aria-label="뒤로가기"><Image unoptimized src="/assets/login-imgArrowLeft.svg" width={24} height={24} alt="" /></Link>}<p className={styles.mobileTitle}>{mobile.title}</p>{mobile.menu ? <MobileMenu profile={profile} /> : <span className={styles.mobileHeaderSpacer} aria-hidden="true" />}</> : <><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><MobileMenu profile={profile} /></>}</header></>;
}

export function SiteFooter() {
  return <footer className={styles.footer}><Logo /><div className={styles.footerRule} /><div className={styles.footerLinks}>
    <Link href="/term">이용약관</Link><Link className={styles.privacy} href="/privacy">개인정보처리방침</Link>
    <div className={styles.footerGroup}><p>고객센터</p><p>전화번호 : 000-0000-0000</p><p>평일 09:00 ~ 18:00 (점심시간 : 12시 ~ 13시, 주말 및 공휴일 제외)</p></div>
  </div><div className={styles.footerRule} /><div className={styles.footerGroup}><p>사업자등록증 상호명</p><p>사업자등록번호 : 000-00-000</p><p>대표 : 홍길동</p><p>개인정보처리담당자 : 홍길동</p><p>주소 : 경기도 고양시 덕양구 동축로 70, A동 901호 (동산동, 현대프리미어캠퍼스)</p><p>Copyright © 2026 빠른수학. All Rights Reserved.</p></div></footer>;
}

export function FormField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <div className={styles.field}><label htmlFor={props.id}>{label}</label><input {...props} className={styles.input} aria-invalid={Boolean(error)} aria-describedby={error ? `${props.id}-error` : undefined} />{error && <p id={`${props.id}-error`} className={styles.error}>{error}</p>}</div>;
}

export function Checkbox({ children, ...props }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return <label className={styles.checkLabel}><input {...props} type="checkbox" className={styles.checkbox} />{children}</label>;
}

type ResultContent = { title: string; lines: string[]; actions: { label: string; href?: string; variant?: 'primary' | 'outline' | 'secondary' }[] };

function ResultBody({ title, lines, actions, className = '' }: ResultContent & { className?: string }) {
  return <div className={`${styles.resultBody} ${className}`}><div className={styles.resultText}><h1 className={styles.title}>{title}</h1><div>{lines.map(line => <p key={line}>{line}</p>)}</div></div><div className={styles.resultActions}>{actions.map((action, i) => {
    const variant = action.variant === 'outline' ? styles.outline : action.variant === 'secondary' || (!action.variant && i === 0) ? styles.secondary : '';
    const actionClass = `${styles.button} ${variant}`;
    return action.href ? <Link key={action.label} href={action.href} className={actionClass}>{action.label}</Link> : <button key={action.label} type="button" className={actionClass}>{action.label}</button>;
  })}</div></div>;
}

export function ResultScreen({ title, lines, image, actions, mobileTitle, mobileBackHref, mobileContent, className = '' }: ResultContent & { image: string; mobileTitle?: string; mobileBackHref?: string; mobileContent?: ResultContent; className?: string }) {
  return <><SiteHeader mobile={mobileTitle ? { title: mobileTitle, href: mobileBackHref } : undefined} /><main className={`${styles.result} ${mobileTitle ? styles.responsiveResult : ''} ${className}`}><Image unoptimized loading="eager" src={image} width={132} height={132} alt="" /><ResultBody title={title} lines={lines} actions={actions} className={mobileContent ? styles.desktopResultBody : ''} />{mobileContent && <ResultBody {...mobileContent} className={styles.mobileResultBody} />}</main><SiteFooter /></>;
}

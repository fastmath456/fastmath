import Image from 'next/image';
import Link from 'next/link';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { MobileMenu } from './mobile-menu';
import { PasswordInput } from './password-input';
import { Skeleton } from './skeleton';
import styles from './site.module.css';

export function Logo({ large = false }: { large?: boolean }) {
  return <span className={`${styles.logo} ${large ? styles.largeLogo : ''}`} role="img" aria-label="빠른수학"><span className={styles.logoInner}>
    <Image unoptimized loading="eager" className={styles.logoShadow} src={`/assets/login-${large ? 'img2' : 'img'}.svg`} width={large ? 161 : 80} height={large ? 41 : 21} alt="" />
    <Image unoptimized loading="eager" className={styles.logoFront} src={`/assets/login-${large ? 'img3' : 'img1'}.svg`} width={large ? 164 : 82} height={large ? 45 : 22} alt="" />
  </span></span>;
}

export function SiteHeader({ profile, profileLoading = false, titleLoading = false, activeCourses = false, mobileAt1080 = false, mobileAt1360 = false, mobile }: { profile?: { name: string; image: string }; profileLoading?: boolean; titleLoading?: boolean; activeCourses?: boolean; mobileAt1080?: boolean; mobileAt1360?: boolean; mobile?: { title: string; onBack?: () => void; href?: string; backIcon?: string; menu?: ReactNode } }) {
  return <><header className={`${styles.header} ${mobileAt1080 ? styles.mobileAt1080 : ''} ${mobileAt1360 ? styles.mobileAt1360 : ''}`}><nav className={styles.headerLeft} aria-label="주 메뉴"><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><Link href="/">홈</Link><Link href="/courses" className={activeCourses ? styles.activeCourses : undefined}>강의·교재 목록</Link></nav>
    <div className={styles.headerRight}>{profileLoading && !profile ? <span className={styles.profileLink} aria-busy="true"><Skeleton className={styles.profileSkeletonImage} /><Skeleton>홍길동님</Skeleton></span> : profile ? <Link href="/profile" className={styles.profileLink}><Image unoptimized className={styles.profileImage} src={profile.image} width={24} height={24} alt="" />{profile.name}님</Link> : <Link href="/login">로그인/회원가입</Link>}<Link href={profile ? '/classroom' : '/login'} className={styles.classroomLink}>내 강의실</Link></div>
  </header><header className={`${styles.mobileHeader} ${mobileAt1080 ? styles.mobileAt1080 : ''} ${mobileAt1360 ? styles.mobileAt1360 : ''}`}>{mobile ? <>{mobile.onBack ? <button className={styles.backButton} type="button" aria-label="뒤로가기" onClick={mobile.onBack}><Image unoptimized src={mobile.backIcon ?? "/assets/login-imgArrowLeft.svg"} width={24} height={24} alt="" /></button> : <Link className={styles.backButton} href={mobile.href ?? '/courses'} aria-label="뒤로가기"><Image unoptimized src={mobile.backIcon ?? "/assets/login-imgArrowLeft.svg"} width={24} height={24} alt="" /></Link>}<p className={`${styles.mobileTitle} ${titleLoading ? styles.pendingTitle : ''}`}>{titleLoading ? <Skeleton className={styles.lineSkeleton}>수학1 개념 완성</Skeleton> : mobile.title}</p>{mobile.menu ? mobile.menu === true ? <MobileMenu profile={profile} profileLoading={profileLoading} /> : mobile.menu : <span className={styles.mobileHeaderSpacer} aria-hidden="true" />}</> : <><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><MobileMenu profile={profile} profileLoading={profileLoading} /></>}</header></>;
}

export function SiteFooter() {
  return <footer className={styles.footer}><Link className={styles.footerLogo} href="/" aria-label="빠른수학 홈"><Logo /></Link><div className={styles.footerRule} /><div className={styles.footerLinks}>
    <Link href="/term" prefetch={false}>이용약관</Link><Link className={styles.privacy} href="/privacy" prefetch={false}>개인정보처리방침</Link>
    <div className={styles.footerGroup}><p>고객센터</p><p>전화번호 : 010-2030-6138</p><p>평일 09:00 ~ 18:00 (점심시간 : 12시 ~ 13시, 주말 및 공휴일 제외)</p></div>
  </div><div className={styles.footerRule} /><div className={styles.footerGroup}><p>사업자등록증 상호명</p><p>사업자등록번호 : 873-03-03352</p><p>대표 : 임재현</p><p>개인정보처리담당자 : 임재현</p><p>주소 : 서울특별시 동작구 만양로14길 43(노량진동)</p><p>Copyright © 2026 빠른수학. All Rights Reserved.</p></div></footer>;
}

export function FormField({ label, description, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string; error?: string }) {
  const describedBy = [description && `${props.id}-description`, error && `${props.id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={styles.field}>{description ? <div><label htmlFor={props.id} className={styles.fieldLabel}>{label}</label><p id={`${props.id}-description`} className={styles.fieldDescription}>{description}</p></div> : <label htmlFor={props.id}>{label}</label>}{props.type === 'password' ? <PasswordInput {...props} label={label} aria-invalid={Boolean(error)} aria-describedby={describedBy} /> : <input {...props} className={styles.input} aria-invalid={Boolean(error)} aria-describedby={describedBy} />}{error && <p id={`${props.id}-error`} className={styles.error}>{error}</p>}</div>;
}

export function Checkbox({ children, ...props }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return <label className={styles.checkLabel}><input {...props} type="checkbox" className={styles.checkbox} />{children}</label>;
}

type ResultContent = { title: string; lines: string[]; actions: { label: string; href?: string; onClick?: () => void; variant?: 'primary' | 'outline' | 'secondary' }[] };

function ResultBody({ title, lines, actions, className = '' }: ResultContent & { className?: string }) {
  return <div className={`${styles.resultBody} ${className}`}><div className={styles.resultText}><h1 className={styles.title}>{title}</h1><div>{lines.map(line => <p key={line}>{line}</p>)}</div></div><div className={styles.resultActions}>{actions.map((action, i) => {
    const variant = action.variant === 'outline' ? styles.outline : action.variant === 'secondary' || (!action.variant && i === 0) ? styles.secondary : '';
    const actionClass = `${styles.button} ${variant}`;
    return action.href ? <Link key={action.label} href={action.href} className={actionClass}>{action.label}</Link> : <button key={action.label} type="button" className={actionClass} onClick={action.onClick}>{action.label}</button>;
  })}</div></div>;
}

export function ResultScreen({ title, lines, image, actions, mobileTitle, mobileBackHref, mobileContent, className = '' }: ResultContent & { image: string; mobileTitle?: string; mobileBackHref?: string; mobileContent?: ResultContent; className?: string }) {
  return <><SiteHeader mobile={mobileTitle ? { title: mobileTitle, href: mobileBackHref } : undefined} /><main className={`${styles.result} ${mobileTitle ? styles.responsiveResult : ''} ${className}`}><Image unoptimized loading="eager" src={image} width={132} height={132} alt="" /><ResultBody title={title} lines={lines} actions={actions} className={mobileContent ? styles.desktopResultBody : ''} />{mobileContent && <ResultBody {...mobileContent} className={styles.mobileResultBody} />}</main><SiteFooter /></>;
}

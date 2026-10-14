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

export function SiteHeader({ profile, activeCourses = false, mobile }: { profile?: { name: string; image: string }; activeCourses?: boolean; mobile?: { title: string; onBack: () => void } }) {
  return <><header className={`${styles.header} ${mobile ? styles.responsiveHeader : ''}`}><nav className={styles.headerLeft} aria-label="주 메뉴"><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><Link href="/">홈</Link><Link href="/courses" className={activeCourses ? styles.activeCourses : undefined}>강의·교재 목록</Link></nav>
    <div className={styles.headerRight}>{profile ? <Link href="/profile" className={styles.profileLink}><Image unoptimized className={styles.profileImage} src={profile.image} width={24} height={24} alt="" />{profile.name}님</Link> : <Link href="/login">로그인/회원가입</Link>}<Link href={profile ? '/classroom' : '/login'} className={styles.classroomLink}>내 강의실</Link></div>
  </header><header className={styles.mobileHeader}>{mobile ? <><button className={styles.backButton} type="button" aria-label="뒤로가기" onClick={mobile.onBack}><Image unoptimized src="/assets/login-imgArrowLeft.svg" width={24} height={24} alt="" /></button><p className={styles.mobileTitle}>{mobile.title}</p><span className={styles.mobileHeaderSpacer} aria-hidden="true" /></> : <><Link href="/" aria-label="빠른수학 홈"><Logo /></Link><MobileMenu profile={profile} /></>}</header></>;
}

export function SiteFooter() {
  return <footer className={styles.footer}><Logo /><div className={styles.footerRule} /><div className={styles.footerLinks}>
    <Link href="/terms" target="_blank" rel="noreferrer">이용약관</Link><Link className={styles.privacy} href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</Link>
    <div className={styles.footerGroup}><p>고객센터</p><p>전화번호 : 000-0000-0000</p><p>평일 09:00 ~ 18:00 (점심시간 : 12시 ~ 13시, 주말 및 공휴일 제외)</p></div>
  </div><div className={styles.footerRule} /><div className={styles.footerGroup}><p>사업자등록증 상호명</p><p>사업자등록번호 : 000-00-000</p><p>대표 : 홍길동</p><p>개인정보처리담당자 : 홍길동</p><p>주소 : 경기도 고양시 덕양구 동축로 70, A동 901호 (동산동, 현대프리미어캠퍼스)</p><p>Copyright © 2026 빠른수학. All Rights Reserved.</p></div></footer>;
}

export function FormField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <div className={styles.field}><label htmlFor={props.id}>{label}</label><input {...props} className={styles.input} aria-invalid={Boolean(error)} aria-describedby={error ? `${props.id}-error` : undefined} />{error && <p id={`${props.id}-error`} className={styles.error}>{error}</p>}</div>;
}

export function Checkbox({ children, ...props }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return <label className={styles.checkLabel}><input {...props} type="checkbox" className={styles.checkbox} />{children}</label>;
}

export function ResultScreen({ title, lines, image, actions }: { title: string; lines: string[]; image: string; actions: { label: string; href?: string }[] }) {
  return <><SiteHeader /><main className={styles.result}><Image unoptimized loading="eager" src={image} width={132} height={132} alt="" /><div className={styles.resultText}><h1 className={styles.title}>{title}</h1><div>{lines.map(line => <p key={line}>{line}</p>)}</div></div><div className={styles.resultActions}>{actions.map((action, i) => action.href ? <Link key={action.label} href={action.href} className={`${styles.button} ${i === 0 ? styles.secondary : ''}`}>{action.label}</Link> : <button key={action.label} type="button" className={`${styles.button} ${i === 0 ? styles.secondary : ''}`}>{action.label}</button>)}</div></main><SiteFooter /></>;
}

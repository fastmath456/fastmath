'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { mutate, RequestError, requestFailure } from '@/lib/http';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Checkbox, FormField, Logo, SiteFooter, SiteHeader, useTermsDraft } from '@/components/site';
import { fieldLabels, fieldsByKind, placeholders, validateField, type AuthField, type AuthKind, type AuthValues } from './validation';
import { useLoginRedirect } from './use-login-redirect';
import styles from './auth.module.css';

const emptyValues: AuthValues = { email: '', password: '', confirmation: '', name: '', birthday: '', phone: '' };
const terms = [
  { label: '[필수] 서비스 이용약관에 동의합니다.', href: '/term' },
  { label: '[필수] 개인정보 수집 및 이용에 동의합니다.', href: '/privacy/collection' },
  { label: '[필수] 개인정보 처리 방침에 동의합니다.', href: '/privacy' },
  { label: '[선택] 마케팅 정보 수신에 동의합니다.', href: '/term/marketing' },
];
const titles = { login: '로그인', signup: '회원가입', recovery: '비밀번호 찾기', reset: '비밀번호 재설정' };

export function AuthForm({ kind }: { kind: AuthKind }) {
  const router = useRouter(), client = useQueryClient();
  const { redirectIfUnauthorized } = useLoginRedirect();
  const [remoteError,setRemoteError] = useState('');
  const [{ values, agreements }, setDraft] = useTermsDraft(`auth:${kind}`, { values: emptyValues, agreements: [false, false, false, false] });
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [termsError, setTermsError] = useState(false);
  const fields = fieldsByKind[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<AuthField, string>> = {};
    fields.forEach(field => { const error = validateField(field, values, kind); if (error) next[field] = error; });
    setErrors(next);
    const missingTerms = kind === 'signup' && !agreements.slice(0, 3).every(Boolean);
    setTermsError(missingTerms);
    const first = fields.find(field => next[field]);
    if (first) event.currentTarget.querySelector<HTMLInputElement>(`#${first}`)?.focus();
    else if (missingTerms) event.currentTarget.querySelector<HTMLInputElement>(`#agreement-${agreements.findIndex(value => !value)}`)?.focus();
    if (first || missingTerms) return;
    setRemoteError('');
    try {
      await mutate('auth/'+(kind === 'recovery' ? 'recovery' : kind), {...values,agreements});
      if (kind === 'login') { client.clear(); router.push('/courses'); router.refresh(); }
      else if (kind === 'signup') router.push('/signup/complete');
      else if (kind === 'reset') router.push('/login');
    } catch (error) {
      if (kind === 'reset' && redirectIfUnauthorized(error)) return;
      if (error instanceof RequestError && error.code === 'invalid_credentials') setErrors({password:'이메일 또는 비밀번호를 확인해주세요.'});
      else setRemoteError(requestFailure);
    }
  }
  function change(field: AuthField, value: string) {
    const next = { ...values, [field]: value };
    setDraft(current => ({ ...current, values: next })); setRemoteError('');
    if (field === 'password' && values.confirmation) setErrors(current => ({ ...current, confirmation: validateField('confirmation', next) }));
  }
  function changeInput(field: AuthField, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (kind !== 'signup' || (field !== 'birthday' && field !== 'phone')) return change(field, input.value);
    let value = input.value, cursor = input.selectionStart ?? value.length;
    if (field === 'phone') {
      const inputType = (event.nativeEvent as InputEvent).inputType;
      if (value.length === values.phone.length - 1 && values.phone[cursor] === '-' && inputType === 'deleteContentBackward' && cursor > 0) {
        value = value.slice(0, cursor - 1) + value.slice(cursor); cursor--;
      } else if (value.length === values.phone.length - 1 && values.phone[cursor] === '-' && inputType === 'deleteContentForward') {
        value = value.slice(0, cursor) + value.slice(cursor + 1);
      }
    }
    const digitsBeforeCursor = value.slice(0, cursor).replace(/\D/g, '').length;
    const digits = value.replace(/\D/g, '').slice(0, field === 'phone' ? 11 : undefined);
    const formatted = field === 'phone' ? digits.replace(/^(\d{3})(\d)/, '$1-$2').replace(/^(\d{3}-\d{4})(\d)/, '$1-$2') : digits;
    let position = 0, seen = 0;
    while (position < formatted.length && seen < digitsBeforeCursor) { if (formatted[position] !== '-') seen++; position++; }
    input.value = formatted;
    input.setSelectionRange(position, position);
    change(field, formatted);
  }
  function toggle(index?: number) {
    const next = index === undefined ? agreements.map(() => !agreements.every(Boolean)) : agreements.map((value, i) => i === index ? !value : value);
    setDraft(current => ({ ...current, agreements: next }));
    if (next.slice(0, 3).every(Boolean)) setTermsError(false);
  }
  const form = <form className={styles.form} noValidate onSubmit={submit}><div className={styles.fields}>
    {fields.map(field => <FormField key={field} id={field} name={field} label={fieldLabels[field]} description={kind === 'signup' && field === 'password' ? '비밀번호는 8자 이상 입력해 주세요.' : undefined} placeholder={placeholders[field]} value={values[field]} type={field === 'password' || field === 'confirmation' ? 'password' : 'text'} inputMode={field === 'birthday' || field === 'phone' ? 'numeric' : field === 'email' ? 'email' : undefined} autoComplete={field === 'confirmation' ? 'new-password' : field === 'password' ? kind === 'login' ? 'current-password' : 'new-password' : field === 'phone' ? 'tel' : field === 'birthday' ? 'bday' : field} onChange={event => changeInput(field, event)} onBlur={() => { if (errors[field]) setErrors(current => ({ ...current, [field]: validateField(field, values, kind) })); }} error={errors[field]} />)}
    {kind === 'signup' && <div className={styles.terms}><p className={styles.termsTitle}>약관 동의</p><div className={styles.termsBox}><strong><Checkbox checked={agreements.every(Boolean)} onChange={() => toggle()}>전체 동의</Checkbox></strong><div className={styles.termsRule} />{terms.map((term, index) => <div className={styles.termsRow} key={term.href}><Checkbox id={`agreement-${index}`} checked={agreements[index]} onChange={() => toggle(index)}>{term.label}</Checkbox><Link href={term.href}>보기</Link></div>)}</div>{termsError && <p className={styles.error}>필수 약관에 동의해주세요.</p>}</div>}
  </div>{remoteError && <p className={styles.error}>{remoteError}</p>}<button className={styles.button} type="submit">{titles[kind]}</button></form>;
  return <div className={styles.shell}><SiteHeader mobile={kind === 'signup' ? { title: titles.signup, onBack: () => router.back() } : { title: '로그인', onBack: () => router.back() }} /><main className={`${styles.main} ${kind === 'signup' ? styles.signup : styles.responsiveMain}`}>
    {kind === 'signup' ? <h1 className={styles.title}>회원가입</h1> : <div className={styles.brand}><Logo large />{kind === 'login' ? <div><p>1문제 넘게 틀려본 적 없는 수학 극상위권 연대 수학강사</p><p>여러분의 수학 공부 시간을 1초라도 줄여드리고 싶어서 만들었습니다</p></div> : <h1>{titles[kind]}</h1>}</div>}
    {kind === 'login' ? <div className={styles.loginBottom}>{form}<div className={styles.links}><Link href="/signup">회원가입</Link><span>·</span><Link href="/reset-password">비밀번호 찾기</Link></div></div> : form}
  </main><SiteFooter /></div>;
}

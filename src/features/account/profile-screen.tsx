'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { isMockMode, mutate, requestFailure } from '@/lib/http';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Checkbox, ConfirmationDialog, FormField, isTermsPath, useTermsDraft } from '@/components/site';
import { validateField, fieldLabels, type AuthField, type AuthValues } from '@/features/auth';
import { AccountShell } from './account-shell';
import { useProfile } from './use-profile';
import { validProfileImage } from './profile-image';
import type { Profile } from './types';
import styles from './profile.module.css';
import accountStyles from './account.module.css';

const editable = ['name','birthday','phone'] as const;
type NavigationEvent = Event & { navigationType: string; destination: { url: string; key: string } };
type BrowserNavigation = EventTarget & { traverseTo: (key: string) => { finished: Promise<unknown> } };
type ProfileDraft = { values: AuthValues; marketing: boolean; baseline: Profile; selectedFile?: { name: string; preview: string }; imageChanged: boolean };
function profileValues(profile: Profile): AuthValues {
  return { email:profile.email, name:profile.name, birthday:profile.birthday, phone:profile.phone, password:'', confirmation:'' };
}
function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter(), client = useQueryClient();
  const [{ values, marketing, baseline, selectedFile, imageChanged }, setDraft] = useTermsDraft<ProfileDraft>(`profile:${profile.email}`, {
    values: profileValues(profile), marketing: profile.marketing, baseline: profile, imageChanged: false,
  });
  const [errors,setErrors] = useState<Partial<Record<AuthField,string>>>({}), [imageError,setImageError] = useState(''), [message,setMessage] = useState('');
  const [leaving,setLeaving] = useState<{url:string; key?:string} | null>(null);
  const input = useRef<HTMLInputElement>(null), selection = useRef(0);
  const allowLeave = useRef(false);
  const visitingTerms = useRef(false);
  const currentImage = imageChanged ? selectedFile?.preview ?? '' : profile.image;
  const changed = values.name.trim() !== baseline.name || values.birthday !== baseline.birthday || values.phone.replace(/[-\s]/g,'') !== baseline.phone || imageChanged || marketing !== baseline.marketing;
  useEffect(() => () => { selection.current += 1; }, []);
  useEffect(() => {
    if (!changed) return;
    allowLeave.current = false;
    visitingTerms.current = false;
    function intercept(event: MouseEvent) {
      if (allowLeave.current) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || target.href === location.href) return;
      visitingTerms.current = isTermsPath(target.pathname);
      if (visitingTerms.current) return;
      event.preventDefault(); setLeaving({url:target.pathname+target.search+target.hash});
    }
    // ponytail: history exit confirmation requires cancelable Navigation API traversal; add a router guard for unsupported browsers.
    const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
    function historyNavigation(event: Event) {
      const move = event as NavigationEvent;
      if (allowLeave.current || !move.cancelable || move.navigationType !== 'traverse') return;
      const target = new URL(move.destination.url);
      if (target.origin !== location.origin || target.href === location.href) return;
      visitingTerms.current = isTermsPath(target.pathname);
      if (visitingTerms.current) return;
      move.preventDefault(); setLeaving({url:target.pathname+target.search+target.hash,key:move.destination.key});
    }
    function beforeUnload(event: BeforeUnloadEvent) { if (!allowLeave.current && !visitingTerms.current) { event.preventDefault(); event.returnValue = ''; } }
    document.addEventListener('click',intercept,true);
    navigation?.addEventListener('navigate',historyNavigation);
    window.addEventListener('beforeunload',beforeUnload);
    return () => { document.removeEventListener('click',intercept,true); navigation?.removeEventListener('navigate',historyNavigation); window.removeEventListener('beforeunload',beforeUnload); };
  }, [changed, values, marketing, imageChanged, selectedFile]);
  function change(field: typeof editable[number], value: string) { setDraft(current => ({...current,values:{...current.values,[field]:value}})); setMessage(''); }
  function leave() {
    if (!leaving) return;
    allowLeave.current = true;
    selection.current += 1;
    setDraft({ values: profileValues(baseline), marketing: profile.marketing, baseline, imageChanged: false });
    setErrors({}); setImageError(''); setMessage(''); setLeaving(null);
    const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
    if (leaving.key && navigation) void navigation.traverseTo(leaving.key).finished.catch(() => { allowLeave.current = false; });
    else router.push(leaving.url);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<AuthField,string>> = {};
    editable.forEach(field => { const error = validateField(field,values); if (error) next[field] = error; });
    setErrors(next); setMessage('');
    const first = editable.find(field => next[field]);
    if (first) event.currentTarget.querySelector<HTMLInputElement>(`#profile-${first}`)?.focus();
    else if (!changed) setMessage('변경된 정보가 없습니다.');
    if (first || !changed || isMockMode) return;
    try {
      let path = currentImage ? profile.imagePath : '';
      if(selectedFile) { const form = new FormData(); form.set('file',await (await fetch(selectedFile.preview)).blob(),selectedFile.name); path=(await mutate<{path:string}>('profile/image',form)).path; }
      const saved = await mutate<Profile>('profile',{name:values.name,birthday:values.birthday,phone:values.phone,marketing,imagePath:path,revision:baseline.revision},'PATCH'); setDraft(current => ({ ...current, baseline: saved }));
      await client.invalidateQueries({queryKey:['profile']}); setDraft(current => ({ ...current, imageChanged: false, selectedFile: undefined }));
    } catch { setMessage(requestFailure); }
  }
  async function choose(file: File | undefined) {
    if (!file) return;
    const current = ++selection.current;
    try {
      const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
      if (current !== selection.current) return;
      if (!validProfileImage(file,bytes)) { setImageError('JPG, PNG, WEBP 형식의 5MB 이하 이미지를 선택해주세요.'); return; }
      const bitmap = await createImageBitmap(file); bitmap.close();
      if (current !== selection.current) return;
      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (current !== selection.current) return;
      setDraft(current => ({ ...current, selectedFile: { name: file.name, preview }, imageChanged: true })); setImageError(''); setMessage('');
    } catch {
      if (current === selection.current) setImageError('이미지를 불러오지 못했습니다. 다시 선택해주세요.');
    }
  }
  return <form className={styles.form} noValidate onSubmit={submit}><div className={styles.fields}><div className={styles.imageField}><span>프로필 이미지</span><input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choose(file); }} /><div className={styles.imageBox}><button type="button" aria-label="프로필 이미지 선택" className={currentImage ? styles.choose : `${styles.choose} ${styles.upload}`} onClick={() => input.current?.click()}>{currentImage ? <Image unoptimized loading="eager" src={currentImage} width={108} height={108} alt="프로필 이미지 미리보기" /> : <span className={styles.imageTag}>Upload<Image unoptimized src="/assets/profile-upload.svg" width={16} height={16} alt="" /></span>}</button>{currentImage && <div className={styles.imageTag}><button type="button" onClick={() => input.current?.click()}>IMG</button><button type="button" aria-label="프로필 이미지 삭제" onClick={() => { selection.current += 1; setDraft(current => ({ ...current, imageChanged: Boolean(profile.image), selectedFile: undefined })); setImageError(''); setMessage(''); }}><Image unoptimized src="/assets/profile-imgX03.svg" width={16} height={16} alt="" /></button></div>}</div>{imageError && <p className={styles.error} role="alert">{imageError}</p>}</div>
    <FormField id="profile-email" label="이메일" value={profile.email} readOnly type="text" autoComplete="email" />
    {editable.map(field => <FormField key={field} id={`profile-${field}`} label={fieldLabels[field]} value={values[field]} error={errors[field]} onChange={event => change(field,event.target.value)} onBlur={() => { if (errors[field]) setErrors(current => ({...current,[field]:validateField(field,values)})); }} inputMode={field === 'name' ? undefined : 'numeric'} autoComplete={field === 'phone' ? 'tel' : field === 'birthday' ? 'bday' : 'name'} />)}
    <div className={styles.marketing}><strong>마케팅 수신 동의</strong><div><Checkbox checked={marketing} onChange={event => { const marketing = event.target.checked; setDraft(current => ({ ...current, marketing })); setMessage(''); }}>[선택] 마케팅 정보 수신에 동의합니다.</Checkbox><Link href="/term/marketing">보기</Link></div></div>
  </div>{message && <p role="status">{message}</p>}<button className={styles.submit} type="submit">정보수정</button>{leaving && <ConfirmationDialog label="저장 전 화면 이동 확인" onCancel={() => setLeaving(null)} actions={[{label:'계속 수정',cancel:true},{label:'나가기',onClick:leave}]}><p>수정한 내용을 저장하지 않고 나가시겠어요?</p></ConfirmationDialog>}</form>;
}
export function ProfileScreen({ state = '' }: { state?: string }) {
  const query = useProfile(state);
  return <AccountShell profile={query.data} section="profile"><div className={styles.content}><div><h1 className={accountStyles.title}>내 정보</h1><p className={accountStyles.subtitle}>내 정보를 확인하고 수정하세요.</p></div>{query.isError ? <div className={accountStyles.error}><p>내 정보를 불러오지 못했습니다. 다시 시도해주세요.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data && <ProfileForm key={state+query.data.email} profile={query.data} />}</div></AccountShell>;
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { isMockMode, mutate } from '@/lib/http';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccountShell, useProfile } from '@/features/account';
import { useLoginRedirect } from '@/features/auth';
import { ConfirmationDialog } from '@/components/site';
import { useMockReady } from '@/app/providers';
import { getClassroom } from './api';
import styles from './classroom.module.css';
import accountStyles from '../account/account.module.css';

export function ClassroomScreen({ state = '' }: { state?: string }) {
  const profile = useProfile(), ready = useMockReady();
  const query = useQuery({ queryKey: ['classroom',state], queryFn: () => getClassroom(state), enabled: ready });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(profile.error, query.error);
  const [deleting, setDeleting] = useState<string | null>(null);
  if (requiresLogin) return null;
  return <AccountShell profile={profile.data} section="classroom"><div><h1 className={accountStyles.title}>내 강의실{query.data ? `(${query.data.count})` : ''}</h1><p className={accountStyles.subtitle}>구매한 강의와 교재를 한곳에서 확인하세요.</p></div>
    {query.isError ? <div className={accountStyles.error}><p>목록을 불러오지 못했습니다.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data?.count === 0 ? <div className={accountStyles.empty}><p>{query.data.hidden ? '표시할 강의·교재가 없습니다.' : '아직 구매한 강의·교재가 없습니다.'}</p></div> : <div className={styles.list}>{query.data?.items.map((item,index) => <article className={styles.row} key={item.id}><div className={styles.rowContent}><div className={styles.thumbnail}><Image unoptimized loading={index === 0 ? "eager" : "lazy"} src="/assets/classroom-img2.png" width={240} height={165} alt={item.title} /><span className={styles.type}>{item.kind === 'vod' ? 'VOD 클래스' : 'PDF 전자책'}</span></div><div className={styles.info}><div className={styles.infoHeading}><span className={styles.status}>{item.status}</span><h2 className={styles.productTitle}>{item.title}</h2></div><div className={styles.details}>{(item.kind === 'vod' ? [['진도율',`${item.progress}%`],['최근 학습',item.recent],['수강 기간',item.period]] : [['다운로드 기간',item.period],['최근 다운로드',item.downloaded]]).map(([label,value]) => <div className={styles.detailRow} key={label}><span className={styles.detailLabel}>{label}</span><span>{value}</span></div>)}</div></div><div className={styles.actions}>{(item.includedPdf || item.kind === 'pdf') && <button type="button" className={styles.action} disabled={item.expired} onClick={() => { if(!isMockMode && item.orderId) void mutate<{url:string}>(`orders/${item.orderId}/download`).then(data => { location.assign(data.url); }).catch(error => { if (!redirectIfUnauthorized(error)) void query.refetch(); }); }}>PDF 다운로드</button>}{item.kind === 'vod' && (item.expired ? <button disabled className={styles.action}>VOD 수강하기</button> : <Link href={`/classroom/courses/${item.courseId}`} className={styles.action}>VOD 수강하기</Link>)}</div></div>{item.expired && <div className={styles.expired}><p>{item.kind === 'vod' ? '수강 기간 만료' : '다운로드 기간 만료'}</p><button type="button" onClick={() => setDeleting(item.id)}>내역 삭제하기</button></div>}</article>)}</div>}
    {deleting && <ConfirmationDialog label="내 강의실 내역 삭제 확인" onCancel={() => setDeleting(null)} actions={[{label:'취소',cancel:true},{label:'삭제',onClick:() => { if(!isMockMode && deleting) void mutate(`classroom/${deleting}/hide`).then(() => { setDeleting(null); return query.refetch(); }).catch(error => { if (!redirectIfUnauthorized(error)) void query.refetch(); }); }}]}><p>이 상품을 내 강의실에서 숨길까요? 구매·결제 내역은 유지됩니다.</p></ConfirmationDialog>}
  </AccountShell>;
}

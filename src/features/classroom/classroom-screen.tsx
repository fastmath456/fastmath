'use client';

import Image from 'next/image';
import Link from 'next/link';
import { mutate } from '@/lib/http';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccountShell, useProfile } from '@/features/account';
import { useLoginRedirect } from '@/features/auth';
import { ConfirmationDialog, Skeleton } from '@/components/site';
import { downloadMaterials, getClassroom } from './api';
import mobileStyles from './classroom-mobile.module.css';
import accountStyles from '../account/account.module.css';
import { ClassroomSkeleton } from './classroom-skeletons';
import loading from './classroom-skeletons.module.css';

export function ClassroomScreen({ state = '' }: { state?: string }) {
  const profile = useProfile();
  const query = useQuery({ queryKey: ['classroom',state], queryFn: () => getClassroom() });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(profile.error, query.error);
  const [deleting, setDeleting] = useState<string | null>(null);
  if (requiresLogin) return null;
  return <AccountShell profileLoading={profile.isPending} profile={profile.data} section="classroom"><div><h1 className={accountStyles.title}>내 강의실{query.data ? `(${query.data.count})` : query.isPending ? <Skeleton className={loading.count}>(　)</Skeleton> : ''}</h1><p className={accountStyles.subtitle}>구매한 강의와 교재를 한곳에서 확인하세요.</p></div>
    {query.isPending ? <ClassroomSkeleton /> : query.isError ? <div className={accountStyles.error}><p>목록을 불러오지 못했습니다.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data?.count === 0 ? <div className={accountStyles.empty}><p>{query.data.hidden ? '표시할 강의·교재가 없습니다.' : '아직 구매한 강의·교재가 없습니다.'}</p></div> : <div className={mobileStyles.list}>{query.data?.items.map((item,index) => <article className={mobileStyles.row} key={item.id}><div className={mobileStyles.rowContent}><div className={mobileStyles.thumbnail}><Image unoptimized loading={index === 0 ? "eager" : "lazy"} src={item.image || "/assets/classroom-img2.png"} width={240} height={165} alt={item.title} /><span className={mobileStyles.type}>{item.kind === 'vod' ? 'VOD 클래스' : 'PDF 전자책'}</span></div><div className={mobileStyles.info}><div className={mobileStyles.infoHeading}><span className={mobileStyles.status}>{item.status}</span><h2 className={mobileStyles.productTitle}>{item.title}</h2></div><div className={mobileStyles.details}>{(item.kind === 'vod' ? [['진도율',`${item.progress}%`],['최근 학습',item.recent],['수강 기간',item.period]] : [['다운로드 기간',item.period],['최근 다운로드',item.downloaded]]).map(([label,value]) => <div className={mobileStyles.detailRow} key={label}><span className={mobileStyles.detailLabel}>{label}</span><span>{value}</span></div>)}</div></div><div className={mobileStyles.actions}>{(item.includedPdf || item.kind === 'pdf') && <button type="button" className={mobileStyles.action} disabled={item.expired} onClick={() => { if(item.orderId) void downloadMaterials(item.orderId).catch(error => { if (!redirectIfUnauthorized(error)) void query.refetch(); }); }}>PDF 다운로드</button>}{item.kind === 'vod' && (item.expired ? <button disabled className={mobileStyles.action}>VOD 수강하기</button> : <Link href={`/classroom/courses/${item.courseId}`} className={mobileStyles.action}>VOD 수강하기</Link>)}</div></div>{item.expired && <div className={mobileStyles.expired}><p>{item.kind === 'vod' ? '수강 기간 만료' : '다운로드 기간 만료'}</p><button type="button" onClick={() => setDeleting(item.id)}>내역 삭제하기</button></div>}</article>)}</div>}
    {deleting && <ConfirmationDialog label="내 강의실 내역 삭제 확인" onCancel={() => setDeleting(null)} actions={[{label:'취소',cancel:true},{label:'삭제',onClick:() => { if(deleting) void mutate(`classroom/${deleting}/hide`).then(() => { setDeleting(null); return query.refetch(); }).catch(error => { if (!redirectIfUnauthorized(error)) void query.refetch(); }); }}]}><p>이 상품을 내 강의실에서 숨길까요? 구매·결제 내역은 유지됩니다.</p></ConfirmationDialog>}
  </AccountShell>;
}

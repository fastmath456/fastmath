'use client';

import { isMockMode, mutate } from '@/lib/http';
import { Fragment, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ConfirmationDialog } from '@/components/site';
import { useLoginRedirect } from '@/features/auth';
import { useMockReady } from '@/app/providers';
import { AccountShell } from './account-shell';
import { useProfile } from './use-profile';
import { getOrders, getRefundQuote } from './orders-api';
import styles from './orders.module.css';
import accountStyles from './account.module.css';

export function OrdersScreen({ state = '' }: { state?: string }) {
  const ready = useMockReady(), profile = useProfile(), pathname = usePathname();
  const refundId = pathname.match(/^\/orders\/([^/]+)\/refund$/)?.[1];
  const refundKey = useRef('');
  const focusId = useRef<string | undefined>(refundId), previousId = useRef(refundId);
  const query = useQuery({ queryKey: ['orders',state], queryFn: () => getOrders(state), enabled: ready });
  const quote = useQuery({ queryKey: ['refund-quote',refundId,state], queryFn: () => getRefundQuote(refundId!,state), enabled: ready && Boolean(refundId) });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(profile.error, query.error, refundId ? quote.error : null);
  useEffect(() => {
    if (refundId) { focusId.current = refundId; if(refundId !== previousId.current) refundKey.current = ''; }
    else if (focusId.current && previousId.current) document.querySelector<HTMLButtonElement>(`button[data-order-id="${CSS.escape(focusId.current)}"]`)?.focus();
    previousId.current = refundId;
  }, [refundId]);
  function cancel() { window.history.replaceState(null,'',`/orders${state ? '?state='+encodeURIComponent(state) : ''}`); }
  const mixed = query.data?.items.some(item => item.kind === 'pdf') && query.data.items.some(item => item.kind === 'vod');
  const periodTitle = mixed ? '이용기간' : query.data?.items.length && query.data.items.every(item => item.kind === 'pdf') ? '다운로드기간' : '수강기간';
  if (requiresLogin) return null;
  return <AccountShell profile={profile.data} section="orders"><div><h1 className={accountStyles.title}>내 결제내역{query.data ? `(${query.data.count})` : ''}</h1><p className={accountStyles.subtitle}>구매한 강의와 교재 결제내역을 확인하세요.</p></div><div className={styles.table} role="table" aria-label="내 결제내역" aria-busy={query.isPending}>
    <div className={styles.header} role="row">{['상품명','상태','결제금액',periodTitle,'진도율','결제일','환불'].map(label => <div role="columnheader" key={label}>{label}</div>)}</div>
    {query.isError ? <div className={accountStyles.error}><p>결제내역을 불러오지 못했습니다. 다시 시도해주세요.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data?.count === 0 ? <div className={accountStyles.empty}><p>아직 구매한 강의·교재가 없습니다.</p></div> : query.data && <div className={styles.rows} role="rowgroup">{query.data.items.map((item,index) => <Fragment key={item.id}>{index > 0 && <div className={styles.divider} role="presentation" />}<div className={styles.row} role="row"><div role="cell"><span className={styles.name} title={item.title}>{item.title}</span></div><div role="cell">{item.status}</div><div role="cell">{item.amount.toLocaleString('ko-KR')}원</div><div role="cell"><span>{mixed && <span className={styles.periodKind}>{item.kind === 'vod' ? '수강' : '다운로드'}</span>}~ {item.endDate}</span></div><div role="cell">{item.progress}</div><div role="cell">{item.paidDate}</div><div role="cell"><button type="button" data-order-id={item.id} className={styles.refund} disabled={!item.refundable || refundId === item.id} onClick={() => window.history.pushState(null,'',`/orders/${encodeURIComponent(item.id)}/refund${state ? '?state='+encodeURIComponent(state) : ''}`)}>{item.refundLabel}</button></div></div></Fragment>)}</div>}
  </div>{refundId && quote.data && <ConfirmationDialog label={quote.data.title+' 환불 확인'} onCancel={cancel} actions={[{label:'환불',onClick:() => { if(!isMockMode && quote.data?.quote && quote.data.token) void mutate(`orders/${refundId}/refund`,{quote:quote.data.quote,token:quote.data.token,requestKey:refundKey.current ||= crypto.randomUUID()}).then(() => { cancel(); return query.refetch(); }).catch(error => { if (!redirectIfUnauthorized(error)) void quote.refetch(); }); }},{label:'취소',cancel:true}]}><p className={styles.quote}>{quote.data.text}</p></ConfirmationDialog>}{refundId && quote.isError && <ConfirmationDialog label="환불 정보 조회 오류" onCancel={cancel} actions={[{label:'다시 시도',onClick:() => { void quote.refetch(); }},{label:'취소',cancel:true}]}><p>환불 정보를 불러오지 못했습니다. 다시 시도해주세요.</p></ConfirmationDialog>}</AccountShell>;
}

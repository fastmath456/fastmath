'use client';

import { mutate } from '@/lib/http';
import { Fragment, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ConfirmationDialog, Skeleton } from '@/components/site';
import { useLoginRedirect } from '@/features/auth';
import { AccountShell } from './account-shell';
import { useProfile } from './use-profile';
import { getOrders, getRefundQuote } from './orders-api';
import { OrdersSkeletonRows, RefundQuoteSkeleton } from './account-skeletons';
import loading from './account-skeletons.module.css';
import styles from './orders.module.css';
import accountStyles from './account.module.css';

function refundBlockedText(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'refund_expired' ? '수강기간이 끝난 강의는 환불할 수 없습니다.' : code === 'refund_downloaded' ? '다운로드한 전자책은 환불할 수 없습니다.' : '';
}

export function OrdersScreen({ state = '' }: { state?: string }) {
  const profile = useProfile(), pathname = usePathname();
  const refundId = pathname.match(/^\/orders\/([^/]+)\/refund$/)?.[1];
  const refundKey = useRef('');
  const focusId = useRef<string | undefined>(refundId), previousId = useRef(refundId);
  const query = useQuery({ queryKey: ['orders',state], queryFn: () => getOrders() });
  const quote = useQuery({ queryKey: ['refund-quote',refundId,state], queryFn: () => getRefundQuote(refundId!), enabled: Boolean(refundId) });
  const { requiresLogin, redirectIfUnauthorized } = useLoginRedirect(profile.error, query.error, refundId ? quote.error : null);
  useEffect(() => {
    if (refundId) { focusId.current = refundId; if(refundId !== previousId.current) refundKey.current = ''; }
    else if (focusId.current && previousId.current) document.querySelector<HTMLButtonElement>(`button[data-order-id="${CSS.escape(focusId.current)}"]`)?.focus();
    previousId.current = refundId;
  }, [refundId]);
  const refundBlocked = refundBlockedText(quote.error);
  function cancel() { window.history.replaceState(null,'',`/orders${state ? '?state='+encodeURIComponent(state) : ''}`); }
  if (requiresLogin) return null;
  return <AccountShell profileLoading={profile.isPending} profile={profile.data} section="orders">
    <div><h1 className={accountStyles.title} aria-label={query.isPending ? '내 결제내역' : undefined}>{query.isPending ? <Skeleton className={loading.text}>내 결제내역(00)</Skeleton> : <>내 결제내역{query.data ? `(${query.data.count})` : ''}</>}</h1><p className={accountStyles.subtitle}>구매한 강의와 교재 결제내역을 확인하세요.</p></div>
    <div className={styles.table} role="table" aria-label="내 결제내역" aria-busy={query.isPending}>
      <div className={styles.header} role="row">{['상품명','상태','결제금액','수강기간','진도율','결제일','환불'].map((label, index) => <div role="columnheader" key={index}>{query.isPending && index === 3 ? <Skeleton className={loading.text}>수강기간</Skeleton> : label}</div>)}</div>
      {query.isPending ? <OrdersSkeletonRows /> : query.isError ? <div className={accountStyles.error}><p>결제내역을 불러오지 못했습니다. 다시 시도해주세요.</p><button onClick={() => query.refetch()}>다시 시도</button></div> : query.data?.count === 0 ? <div className={accountStyles.empty}><p>아직 구매한 강의·교재가 없습니다.</p></div> : query.data && <div className={styles.rows} role="rowgroup">{query.data.items.map((item,index) => <Fragment key={item.id}>{index > 0 && <div className={styles.divider} role="presentation" />}<div className={styles.row} role="row">
        <div className={styles.status} role="cell"><span className={styles.statusBadge}>{item.status}</span></div>
        <div className={styles.mobileContent}>
          <div className={styles.product} role="cell"><span className={styles.name} title={item.title}>{item.title}</span></div>
          <div className={styles.mobileAction}>
            <div className={styles.details}>
              <div className={styles.detail} role="cell"><span className={styles.mobileLabel}>결제금액</span><span>{item.amount.toLocaleString('ko-KR')}원</span></div>
              <div className={styles.detail} role="cell"><span className={styles.mobileLabel}>{item.kind === 'vod' ? '수강기간' : '다운로드기간'}</span><span className={styles.date}>~ {item.endDate.replaceAll('.', '. ')}</span></div>
              <div className={styles.detail} role="cell"><span className={styles.mobileLabel}>진도율</span><span>{item.kind === 'pdf' ? '—' : item.progress}</span></div>
              <div className={styles.detail} role="cell"><span className={styles.mobileLabel}>결제일시</span><span className={styles.date}>{item.paidDate.replaceAll('.', '. ')}</span></div>
            </div>
            <div className={styles.refundCell} role="cell"><button type="button" data-order-id={item.id} className={styles.refund} disabled={!item.refundable || refundId === item.id} onClick={() => window.history.pushState(null,'',`/orders/${encodeURIComponent(item.id)}/refund${state ? '?state='+encodeURIComponent(state) : ''}`)}>{item.refundLabel}</button></div>
          </div>
        </div>
      </div></Fragment>)}</div>}
    </div>
    {refundId && (quote.isPending || quote.data) && <ConfirmationDialog label={quote.data ? quote.data.title+' 환불 확인' : '환불 확인'} onCancel={cancel} actions={quote.data ? [{label:quote.data.quote?.manual === true ? '환불 신청' : '환불',onClick:() => { if(quote.data?.quote && quote.data.token) void mutate(`orders/${refundId}/refund`,{quote:quote.data.quote,token:quote.data.token,requestKey:refundKey.current ||= crypto.randomUUID()}).then(() => { cancel(); return query.refetch(); }).catch(error => { if (!redirectIfUnauthorized(error)) void quote.refetch(); }); }},{label:'취소',cancel:true}] : []}>{quote.data ? <p className={styles.quote}>{quote.data.text}</p> : <RefundQuoteSkeleton />}</ConfirmationDialog>}
    {refundId && quote.isError && refundBlocked && <ConfirmationDialog label="환불 불가" onCancel={cancel} actions={[{label:'확인',cancel:true}]}><p>{refundBlocked}</p></ConfirmationDialog>}
    {refundId && quote.isError && !refundBlocked && <ConfirmationDialog label="환불 정보 조회 오류" onCancel={cancel} actions={[{label:'다시 시도',onClick:() => { void quote.refetch(); }},{label:'취소',cancel:true}]}><p>환불 정보를 불러오지 못했습니다. 다시 시도해주세요.</p></ConfirmationDialog>}
  </AccountShell>;
}

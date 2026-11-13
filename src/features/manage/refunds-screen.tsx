'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/features/account';
import { AdminGuide } from '@/features/admin-guide';
import { useLoginRedirect } from '@/features/auth';
import { getRefunds } from './refunds-api';
import { filters, matches, refundErrorMessage, shortDateTime, statusLabels, usage, won } from './refunds-format';
import { ManageShell } from './refunds-shell';
import type { AdminRefund, RefundFilter } from './refunds-types';
import styles from './refunds.module.css';

const columns = ['신청일', '회원', '상품명', '결제금액', '이용', '환불금액', '상태', '처리'];

export function ManageRefundsScreen() {
  const profile = useProfile();
  const query = useQuery({ queryKey: ['admin-refunds'], queryFn: getRefunds });
  const { requiresLogin } = useLoginRedirect(profile.error, query.error);
  const [filter, setFilter] = useState<RefundFilter>('all');
  const [search, setSearch] = useState('');
  if (requiresLogin) return null;
  const items = query.data ?? [];
  const stuck = items.filter(item => item.status === 'processing').length;
  const visible = items.filter(item => matches(item, filter, search));
  const errorCode = (query.error as { code?: string } | null)?.code;
  return <ManageShell profile={profile.data} profileLoading={profile.isPending} section="refunds">
    <div><div className={styles.titleRow}><h1 className={styles.title}>환불 관리{query.data ? `(${items.length})` : ''}</h1><AdminGuide guide="refunds-list" admin={Boolean(query.data)} /></div><p className={styles.subtitle}>환불 요청을 확인하고 승인하거나 거절하세요.</p></div>
    {query.isPending ? <p className={styles.muted} aria-busy="true">환불 요청을 불러오는 중이에요.</p>
      : query.isError ? <div className={styles.stack}><p role="alert">{refundErrorMessage(errorCode)}</p>{errorCode !== 'forbidden' && <div><button type="button" className={`${styles.pill} ${styles.pillView}`} onClick={() => void query.refetch()}>다시 시도</button></div>}</div>
      : <div className={styles.stack}>
        {stuck > 0 && <div role="alert" className={styles.alert} data-guide="refund-alert">
          <div><p className={styles.alertTitle}>결제사 응답을 확인해야 하는 환불이 {stuck}건 있어요</p><p className={styles.muted}>취소를 요청했지만 결과를 받지 못한 건이에요. 다시 확인하면 결제사 기록을 조회해 마무리해요.</p></div>
          <button type="button" className={`${styles.pill} ${styles.pillRecover}`} onClick={() => setFilter('processing')}>해당 건 보기</button>
        </div>}
        <div className={styles.toolbar}>
          <div role="group" aria-label="상태로 거르기" className={styles.filters} data-guide="refund-filters">{filters.map(option =>
            <button key={option.value} type="button" className={styles.filter} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label} {option.value === 'all' ? items.length : items.filter(item => item.status === option.value).length}</button>)}</div>
          <input type="search" data-guide="refund-search" className={styles.search} aria-label="회원 이름, 이메일, 주문번호, 상품명으로 검색" placeholder="이름 · 이메일 · 주문번호" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {visible.length === 0 ? <p className={styles.empty}>{items.length ? '조건에 맞는 환불 요청이 없어요.' : '아직 환불 요청이 없어요.'}</p>
          : <div className={styles.tableScroll} data-guide="refund-table"><div role="table" aria-label="환불 요청" className={styles.table}>
            <div role="row" className={styles.header}>{columns.map(column => <div role="columnheader" key={column}>{column}</div>)}</div>
            <div role="rowgroup" className={styles.rows}>{visible.map((item, index) => <Fragment key={item.orderId}>{index > 0 && <div role="presentation" className={styles.divider} />}<RefundRow item={item} /></Fragment>)}</div>
          </div></div>}
      </div>}
  </ManageShell>;
}

function RefundRow({ item }: { item: AdminRefund }) {
  const action = item.status === 'review' ? ['확인하기', styles.pillReview] : item.status === 'processing' ? ['다시 확인', styles.pillRecover] : ['보기', styles.pillView];
  return <div role="row" className={styles.row}>
    <div role="cell" className={styles.nowrap}>{shortDateTime(item.requestedAt)}</div>
    <div role="cell" className={styles.member}><span>{item.name || '탈퇴 회원'}</span>{item.email && <span className={styles.small}>{item.email}</span>}</div>
    <div role="cell" className={styles.product}><span className={styles.tag}>{item.kind === 'vod' ? 'VOD' : '교재'}</span><span className={styles.productName} title={item.title}>{item.title}</span></div>
    <div role="cell" className={styles.nowrap}>{won(item.paidAmount)}</div>
    <div role="cell">{usage(item)}</div>
    <div role="cell" className={`${styles.amount} ${styles.nowrap}`}>{item.status === 'rejected' ? '-' : won(item.refundAmount)}</div>
    <div role="cell" className={styles.statusCell}>{item.status === 'review' || item.status === 'processing'
      ? <span className={`${styles.badge} ${styles[item.status]}`}>{statusLabels[item.status]}</span> : statusLabels[item.status]}{item.external && <span className={styles.small}>PG 직접 취소</span>}</div>
    <div role="cell"><Link href={`/manage/refunds/${encodeURIComponent(item.orderId)}`} className={`${styles.pill} ${action[1]}`}>{action[0]}</Link></div>
  </div>;
}

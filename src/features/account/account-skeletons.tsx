import { Skeleton } from '@/components/site';
import { AccountShell } from './account-shell';
import account from './account.module.css';
import orders from './orders.module.css';
import profile from './profile.module.css';
import loading from './account-skeletons.module.css';

export function OrdersSkeletonRows() {
  return <div className={orders.rows} aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <div className={orders.row} key={index}>
    <div className={orders.status}><Skeleton className={loading.line} /></div>
    <div className={orders.mobileContent}><div className={orders.product}><Skeleton className={`${orders.name} ${loading.line}`} /></div><div className={orders.mobileAction}><div className={`${orders.details} ${loading.details}`}>{Array.from({ length: 4 }, (_, field) => <div className={orders.detail} key={field}><Skeleton className={loading.line} /></div>)}</div><div className={orders.refundCell}><Skeleton className={loading.refundAction}>환불</Skeleton></div></div></div>
  </div>)}</div>;
}

export function OrdersLoading() {
  return <AccountShell profileLoading section="orders"><div><h1 className={account.title}>내 결제내역<Skeleton className={loading.count}>(　)</Skeleton></h1><p className={account.subtitle}>구매한 강의와 교재 결제내역을 확인하세요.</p></div><div className={orders.table} aria-busy="true"><div className={orders.header}>{['상품명', '상태', '결제금액', '', '진도율', '결제일', '환불'].map((label, index) => <div key={index}>{label || <Skeleton className={loading.line} />}</div>)}</div><OrdersSkeletonRows /></div></AccountShell>;
}

export function RefundQuoteSkeleton() {
  return <div className={loading.quote} aria-busy="true"><Skeleton className={loading.line} /><Skeleton className={loading.line} /><Skeleton className={loading.line} /><div className={loading.quoteActions}><Skeleton className={loading.quoteAction}>환불</Skeleton><Skeleton className={loading.quoteAction}>취소</Skeleton></div></div>;
}

export function ProfileLoading() {
  return <AccountShell profileLoading section="profile"><div className={profile.content} aria-busy="true"><div><h1 className={account.title}>내 정보</h1><p className={account.subtitle}>내 정보를 확인하고 수정하세요.</p></div><div className={profile.form}><div className={profile.fields}><div className={profile.imageField}><span>프로필 이미지</span><div className={profile.imageBox}><Skeleton className={loading.image} /></div></div>{['이메일', '이름', '생년월일', '연락처'].map(label => <div className={loading.field} key={label}><span>{label}</span><Skeleton className={loading.input} /></div>)}<div className={profile.marketing}><strong>마케팅 수신 동의</strong><Skeleton className={loading.input} /></div></div><Skeleton className={loading.submit} /></div></div></AccountShell>;
}

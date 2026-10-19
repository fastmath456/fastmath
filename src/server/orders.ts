import { createHmac, timingSafeEqual } from 'node:crypto';
import { adminDb, ApiError, body, dbError, integer, uuid, string, requireAdmin, setting, date, type Context } from './http';

type OrderRow={id:string;user_id:string;product_id:string;title:string;kind:'vod'|'pdf';amount:number;status:string;payment_key:string|null;paid_at:string|null;total_paid_seconds:number};
type Quote={orderId:string;title:string;amount:number;paidAmount:number;usedSeconds:number;totalSeconds:number;manual:boolean;version:string;expiresAt:string};
type Refund={order_id:string;user_id:string;request_key:string;amount:number;status:string};
type Payment={paymentKey:string;orderId:string;totalAmount:number;status:string;approvedAt:string;cancels?:{cancelAmount:number;transactionKey:string}[]};
export async function ownOrder(ctx:Context,id:string) {
  const user=await ctx.user(); const {data,error}=await adminDb().from('orders').select('*').eq('id',uuid(id)).eq('user_id',user.id).maybeSingle(); dbError(error); if(!data) throw new ApiError(404,'not_found'); return data as OrderRow;
}
function paymentConfig() {
  const key=setting('TOSS_SECRET_KEY');
  if(!key.startsWith('test_')&&process.env.ALLOW_LIVE_PAYMENTS!=='true') throw new ApiError(503,'live_payments_disabled'); return key;
}
async function toss(path:string,method='GET',payload?:unknown,key?:string):Promise<Payment> {
  const response=await fetch('https://api.tosspayments.com/v1/payments/'+path,{method,headers:{Authorization:'Basic '+Buffer.from(paymentConfig()+':').toString('base64'),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(10000)}).catch(()=>{throw new ApiError(503,'payment_outcome_unknown');});
  if(!response.ok) throw new ApiError(response.status>=500?503:409,'payment_not_confirmed');
  const data=await response.json() as Payment; if(!data || typeof data.paymentKey!=='string'||!Number.isSafeInteger(data.totalAmount)) throw new ApiError(502,'invalid_payment_response'); return data;
}
export async function createOrder(ctx:Context) {
  const user=await ctx.user(),input=await body(ctx.request); paymentConfig();
  const {data,error}=await adminDb().rpc('create_order',{p_user:user.id,p_product:string(input.productId,'productId',100),p_key:uuid(input.requestKey,'requestKey')}); dbError(error); if(!data) throw new ApiError(500,'database_error');
  return {orderId:data.id,orderName:data.title,amount:data.amount,customerKey:user.id,clientKey:setting('TOSS_CLIENT_KEY')};
}
export async function confirmPayment(ctx:Context,input?:Record<string,unknown>) {
  const user=await ctx.user(),values=input??await body(ctx.request); paymentConfig();
  const orderId=uuid(values.orderId,'orderId'),paymentKey=string(values.paymentKey,'paymentKey',200),amount=integer(values.amount,'amount');
  const own=await ownOrder(ctx,orderId); if(own.amount!==amount) throw new ApiError(409,'payment_mismatch');
  const db=adminDb(); const prepared=await db.rpc('prepare_payment',{p_user:user.id,p_order:orderId,p_payment:paymentKey}); dbError(prepared.error); if(!prepared.data) throw new ApiError(500,'database_error');
  if(prepared.data.status==='paid') return {ok:true,orderId,kind:own.kind};
  const payment=await toss('confirm','POST',{orderId,paymentKey,amount},'pay-'+orderId);
  if(payment.orderId!==orderId||payment.paymentKey!==paymentKey||payment.totalAmount!==amount||payment.status!=='DONE'||!Number.isFinite(Date.parse(payment.approvedAt))) throw new ApiError(409,'payment_mismatch');
  const result=await db.rpc('complete_payment',{p_order:orderId,p_payment:paymentKey,p_amount:amount,p_paid:payment.approvedAt}); dbError(result.error); return {ok:true,orderId,kind:own.kind};
}
export async function paymentWebhook(ctx:Context) {
  paymentConfig(); const input=await body(ctx.request);
  const event=input.data;
  if(!event||typeof event!=='object') throw new ApiError(400,'invalid_body');
  const values=event as Record<string,unknown>,id=uuid(values.orderId,'orderId');
  const db=adminDb(),order=await db.from('orders').select('*').eq('id',id).maybeSingle(); dbError(order.error);
  if(!order.data?.payment_key) throw new ApiError(404,'not_found');
  const payment=await toss(encodeURIComponent(order.data.payment_key));
  if(payment.orderId!==id||payment.totalAmount!==order.data.amount||payment.paymentKey!==order.data.payment_key) throw new ApiError(409,'payment_mismatch');
  if(payment.status==='DONE'&&order.data.status==='pending') { const result=await db.rpc('complete_payment',{p_order:id,p_payment:payment.paymentKey,p_amount:payment.totalAmount,p_paid:payment.approvedAt}); dbError(result.error); }
  if(['CANCELED','PARTIAL_CANCELED'].includes(payment.status)) {
    const refunded=(payment.cancels??[]).reduce((n,c)=>n+c.cancelAmount,0);
    const r=await db.from('refunds').select('status,amount').eq('order_id',id).maybeSingle(); dbError(r.error);
    if(r.data?.status==='processing' && r.data.amount===refunded) await reconcileRefund(id,payment);
    else { const result=await db.rpc('external_cancellation',{p_order:id,p_amount:refunded}); dbError(result.error); }
  }
  return {ok:true};
}
export async function orders(ctx:Context) {
  const user=await ctx.user(),db=adminDb(); const [orders,entitlements,refunds,progress]=await Promise.all([
    db.from('orders').select('*').eq('user_id',user.id).neq('status','pending').order('created_at',{ascending:false}),
    db.from('entitlements').select('order_id,expires_at').eq('user_id',user.id),
    db.from('refunds').select('order_id,status').eq('user_id',user.id),
    db.from('lesson_progress').select('order_id,completed').eq('user_id',user.id),
  ]); [orders,entitlements,refunds,progress].forEach(r=>dbError(r.error));
  const items=await Promise.all(orders.data!.map(async o=>{
    const total=await db.from('lessons').select('id',{count:'exact',head:true}).eq('product_id',o.product_id); dbError(total.error);
    const completed=progress.data!.filter(p=>p.order_id===o.id&&p.completed).length,rate=total.count?Math.floor(completed/total.count*100):0;
    const status=o.status==='refunded'?'환불완료':o.status==='refunding'?'환불 처리 중':o.status==='review'?'환불 확인 중':'결제완료';
    return {id:o.id,title:o.title,kind:o.kind,status,amount:o.amount,endDate:date(entitlements.data!.find(e=>e.order_id===o.id)?.expires_at??null),progress:o.kind==='pdf'?'-':rate+'%',paidDate:date(o.paid_at),refundLabel:o.status==='refunded'?'환불 완료':o.status==='refunding'?'처리 중':o.status==='review'?'확인 중':'환불',refundable:o.status==='paid'};
  })); return {items,count:items.length};
}
function signQuote(q:Quote) { return createHmac('sha256',setting('SUPABASE_SECRET_KEY')).update(JSON.stringify(q)).digest('hex'); }
export async function refundQuote(ctx:Context) {
  const user=await ctx.user(); const {data,error}=await adminDb().rpc('refund_quote',{p_user:user.id,p_order:uuid(ctx.params.orderId)}); dbError(error); const q=data as Quote;
  return {...q,quote:q,token:signQuote(q),text:`예상 환불 금액 ${q.amount.toLocaleString('ko-KR')}원\n\n실제 결제금액: ${q.paidAmount.toLocaleString('ko-KR')}원\n전체 유료 영상: ${Math.floor(q.totalSeconds/60)}분\n중복 제외 시청·저장: ${Math.floor(q.usedSeconds/60)}분\n이용분 공제액: ${(q.paidAmount-q.amount).toLocaleString('ko-KR')}원\n\n무료 미리보기는 이용분에서 제외하며, 정가 차액·위약금·결제 수수료는 추가 공제하지 않습니다.\n\n환불을 신청하시겠어요?`};
}
async function reconcileRefund(id:string,payment:Payment) {
  const db=adminDb(),r=await db.from('refunds').select('*').eq('order_id',id).maybeSingle(); dbError(r.error);
  if(!r.data||r.data.status!=='processing'||(payment.cancels??[]).reduce((n,c)=>n+c.cancelAmount,0)!==r.data.amount) throw new ApiError(409,'refund_mismatch');
  const result=await db.rpc('complete_refund',{p_order:id,p_amount:r.data.amount}); dbError(result.error);
}
async function executeRefund(refund:Refund) {
  const db=adminDb(),order=await db.from('orders').select('*').eq('id',refund.order_id).single(); dbError(order.error); if(!order.data) throw new ApiError(404,'not_found');
  if(refund.status!=='processing') return {status:refund.status};
  if(refund.amount===0) { const result=await db.rpc('complete_refund',{p_order:refund.order_id,p_amount:0}); dbError(result.error); return {status:'completed'}; }
  if(!order.data.payment_key) throw new ApiError(409,'refund_requires_review');
  // A persisted cancellation is checked first, so a retry after DB failure cannot cancel twice.
  const existing=await toss(encodeURIComponent(order.data.payment_key));
  const canceled=(existing.cancels??[]).reduce((n,c)=>n+c.cancelAmount,0);
  if(canceled>0 && canceled!==refund.amount) throw new ApiError(409,'refund_requires_review');
  const payment=canceled===refund.amount?existing:await toss(encodeURIComponent(order.data.payment_key)+'/cancel','POST',{cancelReason:'빠른수학 환불',cancelAmount:refund.amount},'refund-'+refund.request_key);
  if(payment.orderId!==refund.order_id||payment.paymentKey!==order.data.payment_key||!['CANCELED','PARTIAL_CANCELED'].includes(payment.status)) throw new ApiError(409,'refund_mismatch');
  await reconcileRefund(refund.order_id,payment); return {status:'completed'};
}
export async function requestRefund(ctx:Context) {
  const user=await ctx.user(),input=await body(ctx.request);
  const q=input.quote as Quote;
  if(!q||q.orderId!==ctx.params.orderId) throw new ApiError(400,'invalid_quote');
  const token=string(input.token,'token',64),expected=signQuote(q);
  if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected))) throw new ApiError(400,'invalid_quote');
  if(!q.manual) paymentConfig();
  const {data,error}=await adminDb().rpc('prepare_refund',{p_user:user.id,p_order:uuid(ctx.params.orderId),p_key:uuid(input.requestKey,'requestKey'),p_amount:integer(q.amount,'amount'),p_used:integer(q.usedSeconds,'usedSeconds'),p_expires:q.expiresAt}); dbError(error);
  return executeRefund(data as Refund);
}
export async function reviewRefund(ctx:Context) {
  await requireAdmin(ctx); const input=await body(ctx.request);
  if(typeof input.approve!=='boolean') throw new ApiError(400,'invalid_field','approve'); if(input.approve && typeof input.amount==='number' && input.amount>0) paymentConfig();
  const {data,error}=await adminDb().rpc('review_refund',{p_order:uuid(ctx.params.orderId),p_approve:input.approve,p_amount:integer(input.amount,'amount'),p_reason:string(input.reason,'reason',1000)}); dbError(error);
  return executeRefund(data as Refund);
}
export async function recoverOrder(ctx:Context) {
  await requireAdmin(ctx); const orderId=uuid(ctx.params.orderId); const {data,error}=await adminDb().from('orders').select('*').eq('id',orderId).single(); dbError(error); if(!data) throw new ApiError(404,'not_found');
  if(!data.payment_key) throw new ApiError(409,'payment_not_confirmed');
  const payment=await toss(encodeURIComponent(data.payment_key));
  if(payment.orderId!==orderId||payment.totalAmount!==data.amount) throw new ApiError(409,'payment_mismatch');
  if(data.status==='pending'&&payment.status==='DONE') { const result=await adminDb().rpc('complete_payment',{p_order:orderId,p_payment:payment.paymentKey,p_amount:payment.totalAmount,p_paid:payment.approvedAt}); dbError(result.error); }
  else if(data.status==='refunding') {const r=await adminDb().from('refunds').select('*').eq('order_id',orderId).single(); dbError(r.error); return executeRefund(r.data as Refund);}
  return {ok:true};
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminDb, ApiError, body, bytes, dbError, integer, uuid, string, requireAdmin, setting, date, type Context } from './http';
import type { Database } from './database.types';
import { approvalTimeout, nicepayCallbackAttempt, nicepayConfig, nicepayGoodsName, nicepayRequest, nicepayReturnUrl, readNicepayPayment, requireNicepayWrites, validNicepaySignature, type NicepayPayment } from './nicepay';

type OrderRow={id:string;user_id:string;product_id:string;request_key:string;title:string;kind:'vod'|'pdf';amount:number;status:string;payment_key:string|null;paid_at:string|null;total_paid_seconds:number};
type Quote={orderId:string;title:string;amount:number;paidAmount:number;usedSeconds:number;totalSeconds:number;manual:boolean;version:string;expiresAt:string};
type Refund=Database['public']['Tables']['refunds']['Row'];
type Attempt=Database['public']['Tables']['nicepay_attempts']['Row'];
type NicepayConfig=ReturnType<typeof nicepayConfig>;
export async function ownOrder(ctx:Context,id:string) {
  const user=await ctx.user(); const {data,error}=await adminDb().from('orders').select('*').eq('id',uuid(id)).eq('user_id',user.id).maybeSingle(); dbError(error); if(!data) throw new ApiError(404,'not_found'); return data as OrderRow;
}

export async function createOrder(ctx:Context) {
  const user=await ctx.user(), input=await body(ctx.request), config=nicepayConfig();
  requireNicepayWrites(config);
  const retry=input.retryOrderId===undefined ? undefined : await ownOrder(ctx,uuid(input.retryOrderId,'retryOrderId'));
  if (retry && (retry.kind!=='vod' || retry.status!=='pending')) throw new ApiError(409,'payment_conflict');
  const {data,error}=await adminDb().rpc('create_nicepay_attempt',{
    p_user:user.id, p_product:retry?.product_id ?? string(input.productId,'productId',100),
    p_key:retry?.request_key ?? uuid(input.requestKey,'requestKey'), p_environment:config.environment,
  }).single();
  dbError(error);
  if (!data) throw new ApiError(500,'database_error');
  return {
    clientId:config.clientId, orderId:data.attempt_id, amount:data.amount,
    goodsName:nicepayGoodsName(data.title), returnUrl:nicepayReturnUrl(config,data.attempt_id),
  };
}

export async function paymentStatus(ctx:Context) {
  const {status,kind}=await ownOrder(ctx,ctx.params.orderId);
  return {status,kind};
}

async function loadOrder(id:string):Promise<OrderRow> {
  const {data,error}=await adminDb().from('orders').select('*').eq('id',id).maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404,'not_found');
  return data as OrderRow;
}

async function currentAttempt(orderId:string) {
  const {data,error}=await adminDb().from('nicepay_attempts').select('*').eq('order_id',orderId).neq('status','closed').maybeSingle();
  dbError(error);
  return data;
}

function checkPayment(attempt:Attempt, order:OrderRow, payment:NicepayPayment, orderId=attempt.id) {
  if (payment.tid!==attempt.tid || payment.orderId!==orderId || payment.amount!==order.amount
      || payment.currency!=='KRW' || payment.payMethod!=='card') throw new ApiError(409,'payment_mismatch');
}

async function lookupPayment(config:NicepayConfig, attempt:Attempt, order:OrderRow) {
  if (!attempt.tid || attempt.environment!==config.environment) throw new ApiError(409,'payment_not_confirmed');
  const payment=readNicepayPayment(config,await nicepayRequest(config,encodeURIComponent(attempt.tid)));
  checkPayment(attempt,order,payment);
  if (payment.resultCode!=='0000') throw new ApiError(503,'payment_outcome_unknown');
  return payment;
}

async function completeNicepayPayment(attempt:Attempt, payment:NicepayPayment) {
  if (payment.resultCode!=='0000' || payment.status!=='paid' || typeof payment.paidAt!=='string'
      || !payment.paidAt.includes('T') || !Number.isFinite(Date.parse(payment.paidAt))) {
    throw new ApiError(503,'payment_outcome_unknown');
  }
  const result=await adminDb().rpc('complete_nicepay_payment',{
    p_attempt:attempt.id, p_tid:payment.tid, p_amount:payment.amount, p_paid:payment.paidAt,
  });
  dbError(result.error);
  if (!result.data) throw new ApiError(409,'payment_conflict');
}

function endedWithoutAccess(payment:NicepayPayment) {
  return ['failed','expired','cancelled'].includes(payment.status);
}

async function closeAttempt(attempt:Attempt) {
  const result=await adminDb().from('nicepay_attempts').update({status:'closed'})
    .eq('id',attempt.id).in('status',[attempt.status,'closed']).select('id').maybeSingle();
  dbError(result.error);
  if (!result.data) throw new ApiError(503,'payment_outcome_unknown');
}

function paymentRedirect(order:OrderRow, paid:boolean) {
  const url=new URL(paid?'/payments/success':'/payments/failure',setting('APP_ORIGIN'));
  url.searchParams.set(paid?'orderId':'kind',paid?order.id:order.kind);
  if (!paid) {
    if (order.kind==='vod') url.searchParams.set('orderId',order.id);
    url.searchParams.set('productId',order.product_id);
  }
  return NextResponse.redirect(url,303);
}

async function cancelUncertainApproval(config:NicepayConfig, attempt:Attempt, order:OrderRow) {
  const {data:marked,error}=await adminDb().from('nicepay_attempts').update({status:'voiding'})
    .eq('id',attempt.id).eq('status','approving').select('*').maybeSingle();
  dbError(error);
  if (!marked) throw new ApiError(503,'payment_outcome_unknown');

  const payment=readNicepayPayment(config,await nicepayRequest(config,'netcancel',{orderId:attempt.id}));
  checkPayment(marked,order,payment);
  if (payment.resultCode!=='0000' || !endedWithoutAccess(payment)) throw new ApiError(503,'payment_outcome_unknown');
  await closeAttempt(marked);
  return paymentRedirect(order,false);
}

export async function nicepayCallback(ctx:Context) {
  const config=nicepayConfig(), id=nicepayCallbackAttempt(config,ctx.request);
  if (ctx.request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded') {
    throw new ApiError(415,'invalid_content_type');
  }
  const form=new URLSearchParams((await bytes(ctx.request)).toString());
  const resultCode=string(form.get('authResultCode'),'authResultCode',4);
  const db=adminDb();
  const {data:attempt,error}=await db.from('nicepay_attempts').select('*').eq('id',id).maybeSingle();
  dbError(error);
  if (!attempt) throw new ApiError(404,'not_found');
  const order=await loadOrder(attempt.order_id);
  if (attempt.environment!==config.environment) throw new ApiError(409,'payment_mismatch');

  if (resultCode!=='0000') {
    if (attempt.status==='ready' || attempt.status==='closed') return paymentRedirect(order,false);
    throw new ApiError(503,'payment_outcome_unknown');
  }
  const tid=string(form.get('tid'),'tid',30), authToken=string(form.get('authToken'),'authToken',40);
  const amount=form.get('amount');
  if (form.get('orderId')!==id || form.get('clientId')!==config.clientId
      || !amount || !/^\d{1,12}$/.test(amount) || Number(amount)!==order.amount
      || !validNicepaySignature(config,form.get('signature'),authToken,config.clientId,amount)) {
    throw new ApiError(400,'invalid_payment_signature');
  }
  const tokenHash=createHash('sha256').update(authToken).digest('hex');
  if (attempt.status!=='ready') {
    if (attempt.tid!==tid || attempt.auth_token_hash!==tokenHash) throw new ApiError(409,'payment_mismatch');
    if (attempt.status==='paid' && order.status==='paid') return paymentRedirect(order,true);
    if (attempt.status==='closed') return paymentRedirect(order,false);
    throw new ApiError(503,'payment_outcome_unknown');
  }
  if (order.status!=='pending' || order.payment_key!==null) throw new ApiError(409,'payment_conflict');
  requireNicepayWrites(config);

  const {data:claimed,error:claimError}=await db.from('nicepay_attempts').update({
    status:'approving',tid,auth_token_hash:tokenHash,claimed_at:new Date().toISOString(),
  }).eq('id',id).eq('status','ready').select('*').maybeSingle();
  dbError(claimError);
  if (!claimed) throw new ApiError(503,'payment_outcome_unknown');

  let response:Record<string,unknown>;
  try {
    response=await nicepayRequest(config,encodeURIComponent(tid),{amount:order.amount});
  } catch (error) {
    if (error instanceof ApiError && error.status===503 && error.code==='payment_outcome_unknown') {
      return cancelUncertainApproval(config,claimed,order);
    }
    throw error;
  }
  const payment=readNicepayPayment(config,response);
  checkPayment(claimed,order,payment);
  if (endedWithoutAccess(payment)) {
    await closeAttempt(claimed);
    return paymentRedirect(order,false);
  }
  await completeNicepayPayment(claimed,payment);
  return paymentRedirect(order,true);
}

async function loadRefund(orderId:string) {
  const result=await adminDb().from('refunds').select('*').eq('order_id',orderId).maybeSingle();
  dbError(result.error);
  return result.data;
}

function cancellationAmount(payment:NicepayPayment) {
  return payment.cancels.reduce((total,cancel)=>total+cancel.amount,0);
}

function verifiedCancellation(payment:NicepayPayment, amount:number) {
  const status=amount===payment.amount?'cancelled':'partialCancelled';
  return payment.resultCode==='0000' && payment.status===status
    && amount>0 && payment.balance===payment.amount-amount && cancellationAmount(payment)===amount;
}

async function reconcileCancellation(order:OrderRow, payment:NicepayPayment) {
  const amount=cancellationAmount(payment);
  if (!verifiedCancellation(payment,amount)) throw new ApiError(409,'refund_mismatch');
  const refund=await loadRefund(order.id);
  if (refund?.status==='processing') {
    if (refund.amount!==amount || !payment.cancels.some(cancel=>cancel.tid===refund.nicepay_cancel_tid && cancel.amount===amount)) {
      throw new ApiError(503,'payment_outcome_unknown');
    }
    const result=await adminDb().rpc('complete_refund',{p_order:order.id,p_amount:amount});
    dbError(result.error);
  } else if (order.status!=='refunded') {
    const result=await adminDb().rpc('external_cancellation',{p_order:order.id,p_amount:amount});
    dbError(result.error);
  }
}

async function reconcilePayment(config:NicepayConfig, attempt:Attempt, order:OrderRow) {
  // Let the callback persist a timeout before a webhook or admin recovery can grant access.
  if (attempt.status==='approving' && Date.now()-Date.parse(attempt.claimed_at ?? '')<approvalTimeout+5000) {
    throw new ApiError(503,'payment_outcome_unknown');
  }
  const payment=await lookupPayment(config,attempt,order);
  if (attempt.status==='paid') {
    if (payment.status==='cancelled' || payment.status==='partialCancelled') await reconcileCancellation(order,payment);
    else if (payment.status!=='paid') throw new ApiError(503,'payment_outcome_unknown');
    return;
  }
  if (endedWithoutAccess(payment)) {
    await closeAttempt(attempt);
  } else if (attempt.status==='approving' && payment.status==='paid') {
    await completeNicepayPayment(attempt,payment);
  } else {
    throw new ApiError(503,'payment_outcome_unknown');
  }
}

export async function paymentWebhook(ctx:Context) {
  const config=nicepayConfig(), event=readNicepayPayment(config,await body(ctx.request));
  const {data:attempt,error}=await adminDb().from('nicepay_attempts').select('*').eq('tid',event.tid).maybeSingle();
  dbError(error);
  if (!attempt) throw new ApiError(404,'not_found');
  const order=await loadOrder(attempt.order_id);
  if (event.amount!==order.amount) throw new ApiError(409,'payment_mismatch');
  await reconcilePayment(config,attempt,order);
  return new NextResponse('OK',{headers:{'Content-Type':'text/html; charset=utf-8'}});
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
async function refundableAttempt(order:OrderRow, config:NicepayConfig) {
  const attempt=await currentAttempt(order.id);
  if (attempt?.status!=='paid' || !attempt.tid || attempt.tid!==order.payment_key || attempt.environment!==config.environment) {
    throw new ApiError(409,'refund_requires_review');
  }
  return {...attempt,tid:attempt.tid};
}

async function executeRefund(refund:Refund) {
  if(refund.status!=='processing') return {status:refund.status};
  const db=adminDb();
  if(refund.amount===0) { const result=await db.rpc('complete_refund',{p_order:refund.order_id,p_amount:0}); dbError(result.error); return {status:'completed'}; }
  const config=nicepayConfig(), order=await loadOrder(refund.order_id);
  const attempt=await refundableAttempt(order,config), existing=await lookupPayment(config,attempt,order);
  if (existing.status==='cancelled' || existing.status==='partialCancelled') {
    await reconcileCancellation(order,existing);
    return {status:'completed'};
  }
  if (refund.nicepay_cancel_started) throw new ApiError(503,'payment_outcome_unknown');
  const partial=refund.amount<order.amount;
  if (existing.status!=='paid' || existing.balance!==order.amount || existing.cancels.length || refund.amount>existing.balance
      || (partial && existing.canPartCancel!==true && existing.canPartCancel!=='true')) throw new ApiError(409,'refund_requires_review');

  requireNicepayWrites(config);
  const claim=await db.from('refunds').update({nicepay_cancel_started:true}).eq('order_id',order.id)
    .eq('request_key',refund.request_key).eq('status','processing').eq('nicepay_cancel_started',false).select('order_id').maybeSingle();
  dbError(claim.error);
  if (!claim.data) throw new ApiError(503,'payment_outcome_unknown');

  const cancelId=`refund-${refund.request_key}`;
  const payment=readNicepayPayment(config,await nicepayRequest(config,`${encodeURIComponent(attempt.tid)}/cancel`,{
    reason:'빠른수학 환불',orderId:cancelId,...(partial?{cancelAmt:refund.amount}:{}),
  }));
  checkPayment(attempt,order,payment,payment.orderId===cancelId?cancelId:attempt.id);
  const cancelledTid=payment.cancelledTid;
  if (!verifiedCancellation(payment,refund.amount) || typeof cancelledTid!=='string'
      || !payment.cancels.some(cancel=>cancel.tid===cancelledTid && cancel.amount===refund.amount)) {
    throw new ApiError(409,'refund_mismatch');
  }
  const record=await db.from('refunds').update({nicepay_cancel_tid:cancelledTid}).eq('order_id',order.id)
    .eq('request_key',refund.request_key).eq('status','processing').select('order_id').maybeSingle();
  dbError(record.error);
  if (!record.data) throw new ApiError(503,'payment_outcome_unknown');
  await reconcileCancellation(order,payment);
  return {status:'completed'};
}

export async function requestRefund(ctx:Context) {
  const user=await ctx.user(),input=await body(ctx.request);
  const q=input.quote as Quote;
  if(!q||q.orderId!==ctx.params.orderId) throw new ApiError(400,'invalid_quote');
  const token=string(input.token,'token',64),expected=signQuote(q);
  if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected))) throw new ApiError(400,'invalid_quote');
  const amount=integer(q.amount,'amount');
  if (!q.manual && amount>0) {
    const config=nicepayConfig();
    requireNicepayWrites(config);
    await refundableAttempt(await ownOrder(ctx,ctx.params.orderId),config);
  }
  const {data,error}=await adminDb().rpc('prepare_refund',{p_user:user.id,p_order:uuid(ctx.params.orderId),p_key:uuid(input.requestKey,'requestKey'),p_amount:amount,p_used:integer(q.usedSeconds,'usedSeconds'),p_expires:q.expiresAt}); dbError(error);
  return executeRefund(data as Refund);
}
export async function reviewRefund(ctx:Context) {
  await requireAdmin(ctx); const input=await body(ctx.request);
  if(typeof input.approve!=='boolean') throw new ApiError(400,'invalid_field','approve');
  const orderId=uuid(ctx.params.orderId), amount=integer(input.amount,'amount');
  if (input.approve && amount>0) {
    const config=nicepayConfig();
    requireNicepayWrites(config);
    await refundableAttempt(await loadOrder(orderId),config);
  }
  const {data,error}=await adminDb().rpc('review_refund',{p_order:orderId,p_approve:input.approve,p_amount:amount,p_reason:string(input.reason,'reason',1000)}); dbError(error);
  return executeRefund(data as Refund);
}
export async function recoverOrder(ctx:Context) {
  await requireAdmin(ctx);
  const order=await loadOrder(uuid(ctx.params.orderId));
  const attempt=await currentAttempt(order.id);
  if (!attempt?.tid) throw new ApiError(409,'payment_not_confirmed');
  if (order.status==='refunding') {
    const refund=await loadRefund(order.id);
    if (!refund) throw new ApiError(409,'refund_mismatch');
    return executeRefund(refund);
  }
  await reconcilePayment(nicepayConfig(),attempt,order);
  return {ok:true};
}

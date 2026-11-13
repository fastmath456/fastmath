import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminDb, ApiError, body, bytes, dbError, integer, uuid, string, requireAdmin, setting, date, type Context } from './http';
import type { Database } from './database.types';
import { approvalTimeout, nicepayCallbackAttempt, nicepayConfig, nicepayGoodsName, nicepayRequest, nicepayReturnUrl, readNicepayPayment, requireNicepayWrites, validNicepaySignature, type NicepayPayment } from './nicepay';

type OrderRow={id:string;user_id:string;product_id:string;request_key:string;title:string;kind:'vod'|'pdf';amount:number;status:string;payment_key:string|null;paid_at:string|null;total_paid_seconds:number};
type Quote={orderId:string;title:string;kind?:'vod'|'pdf';amount:number;paidAmount:number;usedSeconds:number;totalSeconds:number;manual:boolean;version:string;expiresAt:string};
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
    // No recorded cancel tid means the cancel response was lost or the cancel was made in the PG console.
    // Then a single cancel of exactly the approved amount is this refund's cancel.
    const recorded=refund.nicepay_cancel_tid;
    if (!recorded && refund.amount!==amount) throw new ApiError(409,'refund_mismatch');
    const tid=recorded ?? (payment.cancels.length===1 ? payment.cancels[0].tid : null);
    if (refund.amount!==amount || !payment.cancels.some(cancel=>cancel.tid===tid && cancel.amount===amount)) {
      throw new ApiError(503,'payment_outcome_unknown');
    }
    if (!recorded) {
      const record=await adminDb().from('refunds').update({nicepay_cancel_tid:tid}).eq('order_id',order.id)
        .eq('request_key',refund.request_key).eq('status','processing').is('nicepay_cancel_tid',null).select('order_id').maybeSingle();
      dbError(record.error);
      if (!record.data) throw new ApiError(503,'payment_outcome_unknown');
    }
    const result=await adminDb().rpc('complete_refund',{p_order:order.id,p_amount:amount});
    dbError(result.error);
  } else if (order.status!=='refunded' && !(refund?.status==='rejected' && refund.amount===amount)) {
    // A rejected review of this same cancellation already decided to keep access; don't reopen it.
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
  const user=await ctx.user(),db=adminDb(); const [orders,entitlements,refunds,progress,downloads]=await Promise.all([
    db.from('orders').select('*').eq('user_id',user.id).neq('status','pending').order('created_at',{ascending:false}),
    db.from('entitlements').select('order_id,expires_at').eq('user_id',user.id),
    db.from('refunds').select('order_id,status').eq('user_id',user.id),
    db.from('lesson_progress').select('order_id,completed').eq('user_id',user.id),
    db.from('download_events').select('order_id').eq('user_id',user.id),
  ]); [orders,entitlements,refunds,progress,downloads].forEach(r=>dbError(r.error));
  const items=await Promise.all(orders.data!.map(async o=>{
    const total=await db.from('lessons').select('id',{count:'exact',head:true}).eq('product_id',o.product_id); dbError(total.error);
    const completed=progress.data!.filter(p=>p.order_id===o.id&&p.completed).length,rate=total.count?Math.floor(completed/total.count*100):0;
    const status=o.status==='refunded'?'환불완료':o.status==='refunding'?'환불 처리 중':o.status==='review'?'환불 확인 중':'결제완료';
    // VOD: no refund after the access period ends. PDF: no refund once downloaded.
    const expiresAt=entitlements.data!.find(e=>e.order_id===o.id)?.expires_at??null;
    const blocked=o.kind==='pdf'?downloads.data!.some(d=>d.order_id===o.id):!expiresAt||Date.parse(expiresAt)<=Date.now();
    return {id:o.id,title:o.title,kind:o.kind,status,amount:o.amount,endDate:date(expiresAt),progress:o.kind==='pdf'?'-':rate+'%',paidDate:date(o.paid_at),refundLabel:o.status==='refunded'?'환불 완료':o.status==='refunding'?'처리 중':o.status==='review'?'확인 중':blocked?'환불 불가':'환불',refundable:o.status==='paid'&&!blocked};
  })); return {items,count:items.length};
}
function signQuote(q:Quote) { return createHmac('sha256',setting('SUPABASE_SECRET_KEY')).update(JSON.stringify(q)).digest('hex'); }
export async function refundQuote(ctx:Context) {
  const user=await ctx.user(); const {data,error}=await adminDb().rpc('refund_quote',{p_user:user.id,p_order:uuid(ctx.params.orderId)}); dbError(error); const q=data as Quote;
  const won=(n:number)=>n.toLocaleString('ko-KR')+'원',vod=q.kind!=='pdf';
  // Three-step table: nothing watched -> full, under 1/3 -> 2/3, under 1/2 -> 1/2 (1/2 or more is refused by refund_quote).
  const tier=q.usedSeconds===0?'수강 전 · 전액 환불':q.usedSeconds*3<q.totalSeconds?'전체의 1/3 수강 전 · 결제금액의 2/3 환불':'전체의 1/2 수강 전 · 결제금액의 1/2 환불';
  const usage=vod?`\n전체 유료 영상: ${Math.floor(q.totalSeconds/60)}분\n중복 제외 시청·저장: ${Math.floor(q.usedSeconds/60)}분\n적용 구간: ${tier}`:'';
  // Every request is reviewed by an admin, and the user is told so before submitting.
  const review=`\n\n환불은 관리자 확인 후 처리돼요. 최종 금액은 확인 후 정해지며, 신청하면 결제내역에서 '환불 확인 중'으로 표시돼요.`;
  return {...q,quote:q,token:signQuote(q),text:`예상 환불 금액 ${won(q.amount)}\n\n실제 결제금액: ${won(q.paidAmount)}${usage}\n\n${vod?'무료 미리보기는 수강 분량에서 제외하며, ':''}정가 차액·위약금·결제 수수료는 추가 공제하지 않습니다.${review}\n\n환불을 신청하시겠어요?`};
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
  const partial=refund.amount<order.amount;
  if (refund.nicepay_cancel_started) {
    // The last cancel's outcome was lost. Once it has had time to settle, a payment that is still untouched
    // proves the cancel never happened, so it is safe to try again.
    const startedAt=refund.nicepay_cancel_started_at?Date.parse(refund.nicepay_cancel_started_at):0;
    if (Date.now()-startedAt<approvalTimeout+5000 || existing.status!=='paid' || existing.balance!==order.amount || existing.cancels.length) {
      throw new ApiError(503,'payment_outcome_unknown');
    }
  }
  if (existing.status!=='paid' || existing.balance!==order.amount || existing.cancels.length || refund.amount>existing.balance
      || (partial && existing.canPartCancel!==true && existing.canPartCancel!=='true')) throw new ApiError(409,'refund_requires_review');

  requireNicepayWrites(config);
  if (refund.nicepay_cancel_started) {
    const reset=await db.from('refunds').update({nicepay_cancel_started:false,nicepay_cancel_started_at:null}).eq('order_id',order.id)
      .eq('request_key',refund.request_key).eq('status','processing').eq('nicepay_cancel_started',true).select('order_id').maybeSingle();
    dbError(reset.error);
    if (!reset.data) throw new ApiError(503,'payment_outcome_unknown');
  }
  const claim=await db.from('refunds').update({nicepay_cancel_started:true,nicepay_cancel_started_at:new Date().toISOString()}).eq('order_id',order.id)
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
  // The request only records the refund for review; the PG cancel happens when an admin approves it.
  const {data,error}=await adminDb().rpc('prepare_refund',{p_user:user.id,p_order:uuid(ctx.params.orderId),p_key:uuid(input.requestKey,'requestKey'),p_amount:amount,p_used:integer(q.usedSeconds,'usedSeconds'),p_expires:q.expiresAt}); dbError(error);
  return executeRefund(data as Refund);
}
export async function reviewRefund(ctx:Context) {
  await requireAdmin(ctx); const input=await body(ctx.request);
  if(typeof input.approve!=='boolean') throw new ApiError(400,'invalid_field','approve');
  const orderId=uuid(ctx.params.orderId), amount=integer(input.amount,'amount');
  if (input.approve && amount>0) {
    const config=nicepayConfig(), order=await loadOrder(orderId);
    requireNicepayWrites(config);
    // If the PG already cancelled part of this payment (e.g. in its console), only that amount can be approved.
    const cancelled=cancellationAmount(await lookupPayment(config,await refundableAttempt(order,config),order));
    if (cancelled>0 && cancelled!==amount) throw new ApiError(409,'refund_mismatch');
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

// Admin refund dashboard: the list reads stored refund rows; the detail adds the PG's current view.
async function adminEmails(userIds:string[]) {
  const db=adminDb();
  const entries=await Promise.all([...new Set(userIds)].map(async id=>{
    const {data,error}=await db.auth.admin.getUserById(id);
    return [id,error?'':data.user?.email??''] as const;
  }));
  return new Map(entries);
}
export async function adminRefunds(ctx:Context) {
  await requireAdmin(ctx);
  const db=adminDb();
  const refunds=await db.from('refunds').select('*').order('requested_at',{ascending:false}).limit(200);
  dbError(refunds.error);
  const rows=refunds.data!;
  if (!rows.length) return {items:[]};
  const orderIds=rows.map(row=>row.order_id), userIds=[...new Set(rows.map(row=>row.user_id))];
  const [orderRows,profiles,downloads,emails]=await Promise.all([
    db.from('orders').select('id,title,kind,amount,total_paid_seconds').in('id',orderIds),
    db.from('profiles').select('user_id,name').in('user_id',userIds),
    db.from('download_events').select('order_id').in('order_id',orderIds),
    adminEmails(userIds),
  ]);
  [orderRows,profiles,downloads].forEach(result=>dbError(result.error));
  const items=rows.flatMap(row=>{
    const order=orderRows.data!.find(item=>item.id===row.order_id);
    if (!order) return [];
    return [{
      orderId:row.order_id, requestedAt:row.requested_at, status:row.status, external:row.request_key===row.order_id,
      name:profiles.data!.find(profile=>profile.user_id===row.user_id)?.name??'', email:emails.get(row.user_id)??'',
      title:order.title, kind:order.kind, paidAmount:order.amount, refundAmount:row.amount,
      usedSeconds:row.used_seconds, totalSeconds:order.total_paid_seconds,
      downloaded:downloads.data!.some(download=>download.order_id===row.order_id),
    }];
  });
  return {items};
}
export async function adminRefund(ctx:Context) {
  await requireAdmin(ctx);
  const orderId=uuid(ctx.params.orderId), db=adminDb();
  const refund=await loadRefund(orderId);
  if (!refund) throw new ApiError(404,'not_found');
  const order=await loadOrder(orderId);
  const [profile,entitlement,downloads,lessons,completed,emails]=await Promise.all([
    db.from('profiles').select('name').eq('user_id',order.user_id).maybeSingle(),
    db.from('entitlements').select('starts_at,expires_at').eq('order_id',orderId).maybeSingle(),
    db.from('download_events').select('order_id',{count:'exact',head:true}).eq('order_id',orderId),
    db.from('lessons').select('id',{count:'exact',head:true}).eq('product_id',order.product_id),
    db.from('lesson_progress').select('lesson_id',{count:'exact',head:true}).eq('order_id',orderId).eq('completed',true),
    adminEmails([order.user_id]),
  ]);
  [profile,entitlement,downloads,lessons,completed].forEach(result=>dbError(result.error));
  // The PG view is best effort: without it the page still shows the stored refund.
  let payment:{status:string;cancelledAmount:number;balance:number;partialCancel:boolean}|null=null;
  try {
    const config=nicepayConfig(), attempt=await currentAttempt(orderId);
    if (attempt?.status==='paid' && attempt.tid && attempt.environment===config.environment) {
      const current=await lookupPayment(config,attempt,order);
      payment={status:current.status,cancelledAmount:cancellationAmount(current),balance:current.balance,
        partialCancel:current.canPartCancel===true||current.canPartCancel==='true'};
    }
  } catch { payment=null; }
  return {
    orderId, status:refund.status, external:refund.request_key===orderId, requestedAt:refund.requested_at, reason:refund.reason,
    name:profile.data?.name??'', email:emails.get(order.user_id)??'', title:order.title, kind:order.kind,
    paidAmount:order.amount, paidAt:order.paid_at, refundAmount:refund.amount,
    usedSeconds:refund.used_seconds, totalSeconds:order.total_paid_seconds,
    progress:order.kind==='vod'&&lessons.count?Math.floor((completed.count??0)/lessons.count*100):null,
    downloads:downloads.count??0, startsAt:entitlement.data?.starts_at??null, expiresAt:entitlement.data?.expires_at??null,
    cancelStartedAt:refund.nicepay_cancel_started?refund.nicepay_cancel_started_at??refund.requested_at:null, payment,
  };
}

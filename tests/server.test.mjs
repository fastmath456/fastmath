// Only the dedicated local quick-math stack is allowed; no cloud/test-production writes.
import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {createClient} from '@supabase/supabase-js';
import nextEnv from '@next/env';
const {loadEnvConfig}=nextEnv;
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
loadEnvConfig(process.cwd());
assert.equal(process.env.SUPABASE_URL,'http://127.0.0.1:54331','tests require isolated local Supabase');
const base=process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000',run=Date.now().toString(),productId='test-'+run;
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const users=[],orders=[];
const meta={name:'홍길동',birthday:'2014-02-22',phone:'01032428118',marketing:false,agreements:[true,true,true,false],testRun:run};
const cookie=(r,jar)=> { for(const raw of r.headers.getSetCookie()){ const pair=raw.split(';')[0],at=pair.indexOf('='); if(pair.slice(at+1)) jar.set(pair.slice(0,at),pair.slice(at+1));else jar.delete(pair.slice(0,at)); } };
async function http(path,{method='GET',data,jar=new Map(),origin=base}={}) {
 if(path==='profile'&&method==='PATCH'&&data&&data.revision===undefined) data={...data,revision:(await http('profile',{jar})).body.revision};
 const r=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),Cookie:[...jar].map(([k,v])=>k+'='+v).join(';')},...(data?{body:JSON.stringify(data)}:{})});
 cookie(r,jar); const body=await r.json(); return {status:r.status,body,headers:r.headers};
}
async function rpc(name,args){const r=await db.rpc(name,args);assert.equal(r.error,null,JSON.stringify(r.error));return r.data;}
async function newUser(suffix){const email='qa-'+run+'-'+suffix+'@example.com';const r=await db.auth.admin.createUser({email,password:'test-password-2026',email_confirm:true,user_metadata:meta});assert.equal(r.error,null);const u={id:r.data.user.id,email,jar:new Map()};users.push(u);const login=await http('auth/login',{method:'POST',data:{email,password:'test-password-2026'},jar:u.jar});assert.equal(login.status,200,JSON.stringify(login.body));assert.ok(login.headers.getSetCookie().every(c=>c.includes('HttpOnly')));return u;}
let a,b,order,session;
before(async()=>{
 a=await newUser('a');b=await newUser('b');
 const p=await db.from('products').insert({id:productId,slug:productId,kind:'vod',title:'검증용 강의',price:99000,image:'/assets/listing-imgRectangle3.png',selling:true});assert.equal(p.error,null);
 assert.equal((await db.from('chapters').insert({id:productId+'-chapter',product_id:productId,title:'검증 챕터',position:0})).error,null);
 assert.equal((await db.from('lessons').insert([{id:productId+'-lesson',product_id:productId,chapter_id:productId+'-chapter',title:'유료 강의',position:1,duration_seconds:36000,preview:false},{id:productId+'-preview',product_id:productId,chapter_id:productId+'-chapter',title:'무료 미리보기',position:0,duration_seconds:600,preview:true}])).error,null);
 order=await rpc('create_order',{p_user:a.id,p_product:productId,p_key:randomUUID()});orders.push(order.id);
 await rpc('prepare_payment',{p_user:a.id,p_order:order.id,p_payment:'qa-'+run});
 await rpc('complete_payment',{p_order:order.id,p_payment:'qa-'+run,p_amount:99000,p_paid:new Date().toISOString()});
 session=await rpc('start_playback',{p_user:a.id,p_order:order.id,p_lesson:productId+'-lesson'});
});

test('real auth, personal profile, save validation, CSRF and cache headers',async()=>{
 assert.equal((await http('profile')).status,401);
 const p=await http('profile',{jar:a.jar});assert.equal(p.status,200);assert.equal(p.body.email,a.email);assert.match(p.headers.get('cache-control'),/no-store/);
 assert.equal((await http('profile',{method:'PATCH',jar:a.jar,origin:'https://other.invalid',data:{}})).status,403);
 const payload={name:'홍길동 수정',birthday:'20140222',phone:'010-3242-8118',marketing:true};
 assert.equal((await http('profile',{method:'PATCH',jar:a.jar,data:{...payload,birthday:'20260230'}})).status,400);
 const saved=await http('profile',{method:'PATCH',jar:a.jar,data:payload});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.name,payload.name);assert.equal(saved.body.phone,'01032428118');
 assert.equal((await http('profile',{method:'PATCH',jar:a.jar,data:{...payload,revision:p.body.revision}})).status,409,'stale profile cannot overwrite a newer save');
 assert.equal((await http('profile',{jar:b.jar})).body.name,'홍길동');
 assert.equal((await http('profile',{method:'PATCH',jar:a.jar,data:{...payload,name:'x'.repeat(20000)}})).status,413);
 assert.equal((await http('profile',{method:'PATCH',jar:a.jar,data:{...payload,imagePath:b.id+'/foreign.webp'}})).status,400);
 const form=new FormData();form.set('file',new File([new Uint8Array([1,2,3])],'broken.png',{type:'image/png'}));
 const badImage=await fetch(base+'/api/profile/image',{method:'POST',headers:{Origin:base,Cookie:[...a.jar].map(([k,v])=>k+'='+v).join(';')},body:form});assert.equal(badImage.status,400);
 const consents=await db.from('consent_events').select('*').eq('user_id',a.id).eq('kind','marketing');assert.equal(consents.data.length,2);
});
test('RLS, financial write restrictions, hidden source paths, server role and IDOR',async()=>{
 const publicClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const logged=await publicClient.auth.signInWithPassword({email:b.email,password:'test-password-2026'});assert.equal(logged.error,null);
 assert.deepEqual((await publicClient.from('profiles').select('*').eq('user_id',a.id)).data,[]);
 assert.deepEqual((await publicClient.from('orders').select('*').eq('user_id',a.id)).data,[]);
 assert.ok((await publicClient.from('orders').update({status:'paid'}).eq('id',order.id)).error);
 assert.ok((await publicClient.rpc('complete_payment',{p_order:order.id,p_payment:'attack',p_amount:0,p_paid:new Date().toISOString()})).error);
 assert.ok((await publicClient.from('user_roles').insert({user_id:b.id,role:'admin'})).error);
 assert.ok((await publicClient.from('products').select('pdf_path')).error);
 assert.ok((await publicClient.from('lessons').select('vimeo_id')).error);
 assert.equal((await http('orders/'+order.id+'/refund-quote',{jar:b.jar})).status,404);
 assert.equal((await http('orders/'+order.id+'/payment-status',{jar:b.jar})).status,404);
 assert.deepEqual((await http('orders/'+order.id+'/payment-status',{jar:a.jar})).body,{status:'paid',kind:'vod'});
 assert.ok((await publicClient.from('nicepay_attempts').select('*')).error);
 assert.equal((await http('classroom/courses/'+productId,{jar:b.jar})).status,403);
 assert.equal((await http('admin/products',{method:'POST',jar:b.jar,data:{}})).status,403);
 assert.equal((await http('products/'+productId+'?view=admin',{jar:b.jar})).body.admin,false);
});
test('payment replay creates one entitlement; browser amount cannot grant access',async()=>{
 await rpc('complete_payment',{p_order:order.id,p_payment:'qa-'+run,p_amount:99000,p_paid:new Date().toISOString()});
 assert.equal((await db.from('entitlements').select('id').eq('order_id',order.id)).data.length,1);
 const mismatch=await db.rpc('complete_payment',{p_order:order.id,p_payment:'qa-'+run,p_amount:1,p_paid:new Date().toISOString()});assert.ok(mismatch.error);
 const key=randomUUID(),again=await rpc('create_order',{p_user:a.id,p_product:productId,p_key:order.request_key});assert.equal(again.id,order.id);
 assert.ok((await db.rpc('create_order',{p_user:a.id,p_product:productId,p_key:key})).error);
 assert.equal((await http('orders',{jar:a.jar})).body.items[0].amount,99000);
 assert.equal((await http('orders',{method:'POST',data:{productId,requestKey:randomUUID()}})).status,401);
});
test('progress ignores seeking, excludes preview and deduplicates replay',async()=>{
 await rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:1,p_position:1000,p_playing:true});assert.equal(await rpc('used_seconds',{p_order:order.id}),0);
 const args={p_user:a.id,p_session:session,p_sequence:2,p_position:1010,p_playing:true};
 await db.from('playback_sessions').update({last_seen:new Date(Date.now()-10000).toISOString()}).eq('id',session);
 await rpc('record_progress',args);await rpc('record_progress',args);assert.equal(await rpc('used_seconds',{p_order:order.id}),10);
 await rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:3,p_position:1000,p_playing:false});
 await db.from('playback_sessions').update({last_seen:new Date(Date.now()-10000).toISOString()}).eq('id',session);
 await rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:4,p_position:1010,p_playing:true});assert.equal(await rpc('used_seconds',{p_order:order.id}),10);
 const preview=await rpc('start_playback',{p_user:a.id,p_order:order.id,p_lesson:productId+'-preview'});
 await db.from('playback_sessions').update({last_seen:new Date(Date.now()-10000).toISOString()}).eq('id',preview);
 await rpc('record_progress',{p_user:a.id,p_session:preview,p_sequence:1,p_position:10,p_playing:true});assert.equal(await rpc('used_seconds',{p_order:order.id}),10);
 assert.ok((await db.rpc('record_progress',{p_user:b.id,p_session:session,p_sequence:5,p_position:1015,p_playing:true})).error);
});
test('signed quote detects tampering, manual review freezes access, reject restores it',async()=>{
 const quote=await http('orders/'+order.id+'/refund-quote',{jar:a.jar});assert.equal(quote.status,200);assert.equal(quote.body.usedSeconds,10);assert.equal(quote.body.amount,98972);
 const bad=await http('orders/'+order.id+'/refund',{method:'POST',jar:a.jar,data:{quote:{...quote.body.quote,amount:99000},token:quote.body.token,requestKey:randomUUID()}});assert.equal(bad.status,400);
 const malformed=await http('orders/'+order.id+'/refund',{method:'POST',jar:a.jar,data:{quote:quote.body.quote,token:'é'.repeat(64),requestKey:randomUUID()}});assert.equal(malformed.status,400);
 const key=randomUUID(),request={quote:quote.body.quote,token:quote.body.token,requestKey:key};
 const response=await http('orders/'+order.id+'/refund',{method:'POST',jar:a.jar,data:request});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.status,'review');
 assert.equal((await http('orders/'+order.id+'/refund',{method:'POST',jar:a.jar,data:request})).body.status,'review');
 assert.ok((await db.rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:5,p_position:1015,p_playing:true})).error);
 await rpc('review_refund',{p_order:order.id,p_approve:false,p_amount:98972,p_reason:'테스트 반려'});
 await rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:5,p_position:1015,p_playing:false});
});
test('quote/progress concurrency and post-purchase curriculum keep monetary snapshot stable',async()=>{
 const added=productId+'-bonus';
 assert.equal((await db.from('lessons').insert({id:added,product_id:productId,chapter_id:productId+'-chapter',title:'추가 강의',position:2,duration_seconds:100,preview:false})).error,null);
 const bonus=await rpc('start_playback',{p_user:a.id,p_order:order.id,p_lesson:added});
 await db.from('playback_sessions').update({last_seen:new Date(Date.now()-10000).toISOString()}).eq('id',bonus);
 await rpc('record_progress',{p_user:a.id,p_session:bonus,p_sequence:1,p_position:10,p_playing:true});
 assert.equal(await rpc('used_seconds',{p_order:order.id}),10,'new content must not alter purchased refund weights');
 const q=await rpc('refund_quote',{p_user:a.id,p_order:order.id});
 await db.from('playback_sessions').update({last_seen:new Date(Date.now()-10000).toISOString()}).eq('id',session);
 const [refunded,progress]=await Promise.all([
  db.rpc('prepare_refund',{p_user:a.id,p_order:order.id,p_key:randomUUID(),p_amount:q.amount,p_used:q.usedSeconds,p_expires:q.expiresAt}),
  db.rpc('record_progress',{p_user:a.id,p_session:session,p_sequence:6,p_position:1020,p_playing:true}),
 ]);
 assert.ok(refunded.error||progress.error,'refund and new chargeable progress cannot both commit a stale quote');
 if(!refunded.error) await rpc('review_refund',{p_order:order.id,p_approve:false,p_amount:q.amount,p_reason:'테스트 동시성 반려'});
});

test('auth provider rejects missing mandatory consent and logout removes access',async()=>{
 const invalid=await db.auth.admin.createUser({email:'qa-'+run+'-bad@example.com',password:'test-password-2026',email_confirm:true,user_metadata:{...meta,agreements:[true,false,false,true]}});
 if(invalid.data.user) users.push({id:invalid.data.user.id});
 assert.ok(invalid.error,'DB trigger must check each required agreement');
 const direct=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await direct.auth.signInWithPassword({email:b.email,password:'test-password-2026'})).error,null);
 assert.equal((await direct.from('profiles').select('user_id')).data.length,1);
 const oldJar=new Map(b.jar);
 assert.equal((await http('auth/logout',{method:'POST',jar:b.jar})).status,200);
 assert.equal((await http('profile',{jar:b.jar})).status,401);
 assert.equal((await http('profile',{jar:oldJar})).status,401,'revoked JWT must not grant access');
 assert.deepEqual((await direct.from('profiles').select('user_id')).data,[],'RLS must deny the revoked session too');
});

async function verificationLink(email,type) {
 for(let i=0;i<20;i++) {
  const messages=await (await fetch('http://127.0.0.1:54334/api/v1/messages')).json();
  for(const item of messages.messages.filter(m=>m.To.some(to=>to.Address===email))) {
   const message=await (await fetch('http://127.0.0.1:54334/api/v1/message/'+item.ID)).json();
   const links=[...(message.HTML??'').matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
   const link=links.find(link=>link.includes('type='+type));if(link){assert.equal(new URL(link).origin,'http://127.0.0.1:54331');return link;}
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('local verification mail not received');
}
async function consumeAuthLink(link,jar) {
 const verification=await fetch(link,{redirect:'manual'});assert.equal(verification.status,303);
 const callback=verification.headers.get('location');assert.equal(new URL(callback).origin,base);
 const response=await fetch(callback,{redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join(';')}});cookie(response,jar);assert.equal(response.status,307);
 return response.headers.get('location');
}
test('local mail: real signup confirmation, recovery, password reset and reused link',async()=>{
 const email='qa-'+run+'-mail@example.com',jar=new Map();
 const input={email,password:'test-password-2026',confirmation:'test-password-2026',name:'홍길동',birthday:'20140222',phone:'01032428118',agreements:[true,true,true,true,false]};
 const signup=await http('auth/signup',{method:'POST',data:input,jar});assert.equal(signup.status,200,JSON.stringify(signup.body));assert.equal(signup.body.confirmed,false);
 const listing=await db.auth.admin.listUsers();const u=listing.data.users.find(u=>u.email===email);assert.ok(u);users.push({id:u.id});
 assert.equal((await http('auth/login',{method:'POST',data:{email,password:input.password}})).status,401);
 const link=await verificationLink(email,'signup');assert.equal(await consumeAuthLink(link,jar),base+'/courses');
 assert.equal((await http('profile',{jar})).body.email,email);
 const recovered=await http('auth/recovery',{method:'POST',jar,data:{email,name:'홍길동',phone:'01032428118'}});assert.equal(recovered.status,200);
 const recovery=await verificationLink(email,'recovery');assert.equal(await consumeAuthLink(recovery,jar),base+'/reset-password/new');
 assert.equal((await http('auth/reset',{method:'POST',jar,data:{password:'changed-password-2026',confirmation:'changed-password-2026'}})).status,200);
 assert.equal((await http('auth/login',{method:'POST',data:{email,password:input.password}})).status,401);
 assert.equal((await http('auth/login',{method:'POST',data:{email,password:'changed-password-2026'}})).status,200);
 const replay=await fetch(recovery,{redirect:'manual'});assert.ok(replay.headers.get('location')?.includes('error'));
});
test('private Storage: validated image upload, signed PDF, expiration and hide preserve orders',async()=>{
 const sharp=(await import('sharp')).default;
 const image=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
 const form=new FormData();form.set('file',new File([image],'qa.png',{type:'image/png'}));
 const uploaded=await fetch(base+'/api/profile/image',{method:'POST',headers:{Origin:base,Cookie:[...a.jar].map(([k,v])=>k+'='+v).join(';')},body:form});const file=await uploaded.json();assert.equal(uploaded.status,200);assert.ok(file.path.startsWith(a.id+'/'));
 const saved=await http('profile',{method:'PATCH',jar:a.jar,data:{name:'홍길동',birthday:'20140222',phone:'01032428118',marketing:false,imagePath:file.path}});assert.equal(saved.status,200);
 assert.equal((await fetch(saved.body.image)).status,200);await db.storage.from('profile-images').remove([file.path]);
 await db.from('user_roles').insert({user_id:a.id,role:'admin'});
 const pdf=await fetch(base+'/api/admin/products/'+productId+'/file',{method:'PUT',headers:{Origin:base,'Content-Type':'application/pdf',Cookie:[...a.jar].map(([k,v])=>k+'='+v).join(';')},body:'%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF'});
 const object=await pdf.json();assert.equal(pdf.status,200);
 const link=await http('orders/'+order.id+'/download',{method:'POST',jar:a.jar});assert.equal(link.status,200,JSON.stringify(link.body));assert.equal((await fetch(link.body.url)).status,200);
 // A downloaded PDF is never refundable, and admin approval cannot bypass it.
 assert.equal((await db.from('orders').update({kind:'pdf'}).eq('id',order.id)).error,null);
 const downloaded=await http('orders/'+order.id+'/refund-quote',{jar:a.jar});assert.equal(downloaded.status,409);assert.equal(downloaded.body.error.code,'refund_downloaded');
 const pdfItem=(await http('orders',{jar:a.jar})).body.items.find(item=>item.id===order.id);assert.equal(pdfItem.refundable,false);assert.equal(pdfItem.refundLabel,'환불 불가');
 assert.equal((await db.from('refunds').upsert({order_id:order.id,user_id:a.id,request_key:randomUUID(),amount:1,used_seconds:0,status:'review'})).error,null);
 assert.equal((await db.from('orders').update({status:'review'}).eq('id',order.id)).error,null);
 assert.match((await db.rpc('review_refund',{p_order:order.id,p_approve:true,p_amount:1,p_reason:'테스트 승인'})).error?.message??'',/refund_downloaded/);
 await rpc('review_refund',{p_order:order.id,p_approve:false,p_amount:1,p_reason:'테스트 반려'});
 assert.equal((await db.from('orders').update({kind:'vod'}).eq('id',order.id)).error,null);
 const publicUrl=process.env.SUPABASE_URL+'/storage/v1/object/public/paid-files/'+object.path;assert.notEqual((await fetch(publicUrl)).status,200);
 await db.from('entitlements').update({starts_at:new Date(Date.now()-120000).toISOString(),expires_at:new Date(Date.now()-60000).toISOString()}).eq('order_id',order.id);
 // A VOD past its access period is never refundable, watched or not.
 const expired=await http('orders/'+order.id+'/refund-quote',{jar:a.jar});assert.equal(expired.status,409);assert.equal(expired.body.error.code,'refund_expired');
 assert.equal((await http('orders',{jar:a.jar})).body.items.find(item=>item.id===order.id).refundable,false);
 assert.equal((await http('orders/'+order.id+'/download',{method:'POST',jar:a.jar})).status,403);
 assert.equal((await http('classroom/courses/'+productId,{jar:a.jar})).status,403);
 const ent=(await db.from('entitlements').select('id').eq('order_id',order.id).single()).data;
 assert.equal((await http('classroom/'+ent.id+'/hide',{method:'POST',jar:a.jar})).status,200);
 assert.equal((await db.from('orders').select('id').eq('id',order.id)).data.length,1);
 await db.storage.from('paid-files').remove([object.path]);
});

test('Nicepay: verified approval, timeout cancellation, recovery, and a single refund',async()=>{
 const compiled=mkdtempSync(join(tmpdir(),'quick-math-server-test-'));
 symlinkSync(join(process.cwd(),'node_modules'),join(compiled,'node_modules'),'dir');
 mkdirSync(join(compiled,'server'));
 for(const file of ['http','nicepay','orders']) writeFileSync(join(compiled,'server',file+'.js'),ts.transpileModule(readFileSync('src/server/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
 const code=await import(pathToFileURL(join(compiled,'server','orders.js')).href);
 const o=await rpc('create_order',{p_user:b.id,p_product:productId,p_key:randomUUID()});orders.push(o.id);
 const clientId='S2_contract',secret='contract-test-only';
 const settings={NICEPAY_ENV:'sandbox',NICEPAY_CLIENT_ID:clientId,NICEPAY_SECRET_KEY:secret};
 const oldSettings=Object.fromEntries(Object.keys(settings).map(name=>[name,process.env[name]]));
 Object.assign(process.env,settings);
 const original=globalThis.fetch;
 const digest=(...fields)=>createHash('sha256').update(fields.join('')+secret).digest('hex');
 const ediDate=new Date().toISOString();
 let state, orderId=o.id, timedOut=true, failedPayment=false, failedRefund=false, cancelCalls=0, approvals=0;
 let partialAmount, refundMode='ok';
 const reply=()=>({...state,signature:digest(state.tid,state.amount,state.ediDate)});
 const transaction=(checkout,tid)=>({tid,orderId:checkout.orderId,amount:checkout.amount,status:'paid',paidAt:ediDate,ediDate,resultCode:'0000',currency:'KRW',payMethod:'card',balanceAmt:checkout.amount,cancels:[]});
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='sandbox-api.nicepay.co.kr') {
   assert.equal(new Headers(options.headers).get('Authorization'),'Basic '+Buffer.from(`${clientId}:${secret}`).toString('base64'));
   if(url.pathname.endsWith('/netcancel')) {
    assert.deepEqual(JSON.parse(options.body),{orderId:state.orderId});
    state={...state,status:'cancelled',balanceAmt:0};
    throw new Error('lost netcancel response');
   }
   if(url.pathname.endsWith('/cancel')) {
    cancelCalls++;
    const request=JSON.parse(options.body);
    assert.match(request.orderId,/^refund-/);
    assert.equal(request.cancelAmt,partialAmount);
    if(refundMode==='dropped') {refundMode='ok';throw new Error('dropped refund request');}
    const amount=partialAmount??state.amount;
    state={...state,status:partialAmount?'partialCancelled':'cancelled',balanceAmt:state.amount-amount,cancelledTid:'contract-cancel',cancels:[{tid:'contract-cancel',amount}]};
    if(refundMode==='lost') {refundMode='ok';throw new Error('lost refund response');}
   } else if(options.method==='POST') {
    approvals++;
    assert.deepEqual(JSON.parse(options.body),{amount:state.amount});
    if(timedOut) {timedOut=false;throw new Error('approval timeout');}
   }
   return Response.json(reply());
  }
  if(url.pathname.endsWith('/rpc/complete_nicepay_payment')&&!failedPayment){failedPayment=true;return Response.json({message:'injected DB failure',code:'XX000'},{status:500});}
  if(url.pathname.endsWith('/rpc/complete_refund')&&!failedRefund){failedRefund=true;return Response.json({message:'injected DB failure',code:'XX000'},{status:500});}
  return original(input,options);
 };
 const ctx=(data,actor=b)=>({params:{orderId},user:async()=>({id:actor.id,email:actor.email}),request:new NextRequest(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
 const start=()=>code.createOrder(ctx({productId,requestKey:randomUUID(),amount:1}));
 const callback=(checkout,overrides={},returnUrl=checkout.returnUrl)=>{
  const authToken=state.tid+'-auth';
  const form=new URLSearchParams({authResultCode:'0000',orderId:checkout.orderId,clientId,tid:state.tid,authToken,amount:String(checkout.amount),signature:digest(authToken,clientId,checkout.amount),...overrides});
  return code.nicepayCallback({request:new NextRequest(returnUrl,{method:'POST',body:form})});
 };
 const webhook=(event=reply())=>code.paymentWebhook(ctx(event));
 try {
  const [first,resumed]=await Promise.all([start(),start()]);
  assert.equal(first.orderId,resumed.orderId);
  assert.equal(first.amount,99000);
  assert.equal('secretKey' in first,false);
  state=transaction(first,'timeout-'+run);
  const failure=await callback(first,{authResultCode:'9999'});
  assert.equal(failure.status,303);
  assert.equal(failure.headers.get('location'),`${base}/payments/failure?kind=vod&orderId=${o.id}&productId=${productId}`);
  await assert.rejects(code.createOrder(ctx({retryOrderId:o.id},a)),e=>e.code==='not_found');
  const reopened=await code.createOrder(ctx({retryOrderId:o.id,productId:'different-course'}));
  assert.equal(reopened.orderId,first.orderId);
  await assert.rejects(callback(first,{amount:'1'}),e=>e.code==='invalid_payment_signature');
  await assert.rejects(callback(first,{},first.returnUrl+'x'),e=>e.code==='invalid_payment_state');
  assert.equal(approvals,0);
  await assert.rejects(callback(first),e=>e.code==='payment_outcome_unknown');
  assert.equal((await db.from('nicepay_attempts').select('status').eq('id',first.orderId).single()).data.status,'voiding');
  await assert.rejects(start(),e=>e.code==='payment_outcome_unknown');
  assert.equal(await (await webhook()).text(),'OK');
  assert.equal((await db.from('entitlements').select('*').eq('order_id',o.id)).data.length,0);

  const next=await code.createOrder(ctx({retryOrderId:o.id}));
  assert.notEqual(next.orderId,first.orderId);
  state=transaction(next,'approved-'+run);
  const callbacks=await Promise.allSettled([callback(next),callback(next)]);
  assert.ok(callbacks.every(result=>result.status==='rejected'));
  assert.ok(callbacks.some(result=>result.reason.code==='database_error'));
  assert.equal(approvals,2,'one request per claimed attempt');
  assert.equal((await db.from('entitlements').select('*').eq('order_id',o.id)).data.length,0);
  await assert.rejects(webhook(),e=>e.code==='payment_outcome_unknown');
  assert.equal((await db.from('nicepay_attempts').update({claimed_at:new Date(Date.now()-60_000).toISOString()}).eq('id',next.orderId)).error,null);
  await assert.rejects(webhook({...reply(),amount:1}),e=>e.code==='invalid_payment_signature');
  assert.equal(await (await webhook()).text(),'OK');
  assert.equal(await (await webhook()).text(),'OK');
  const success=await callback(next);
  assert.equal(success.status,303);
  assert.equal(success.headers.get('location'),`${base}/payments/success?orderId=${o.id}`);
  await assert.rejects(code.createOrder(ctx({retryOrderId:o.id})),e=>e.code==='payment_conflict');
  assert.equal((await db.from('entitlements').select('*').eq('order_id',o.id)).data.length,1);
  const delayedApproval=reply();
  const q=await code.refundQuote(ctx({}));
  const refund={quote:q.quote,token:q.token,requestKey:randomUUID()};
  await assert.rejects(code.requestRefund(ctx(refund)),e=>e.code==='database_error');
  assert.equal((await code.requestRefund(ctx(refund))).status,'completed');
  assert.equal(cancelCalls,1);
  assert.equal(await (await webhook(delayedApproval)).text(),'OK');
  assert.equal(await (await webhook()).text(),'OK');
  assert.equal((await db.from('orders').select('status').eq('id',o.id).single()).data.status,'refunded');
  assert.equal((await db.from('entitlements').select('revoked').eq('order_id',o.id).single()).data.revoked,true);

  assert.equal((await db.from('user_roles').upsert({user_id:a.id,role:'admin'})).error,null);
  partialAmount=15000;
  for(const mode of ['ok','lost','dropped','external']) {
   refundMode=mode;
   const checkout=await start();
   const attempt=await db.from('nicepay_attempts').select('order_id').eq('id',checkout.orderId).single();
   assert.equal(attempt.error,null);
   orderId=attempt.data.order_id;
   state={...transaction(checkout,'partial-'+mode+'-'+run),card:{canPartCancel:'true'}};
   assert.equal((await callback(checkout)).status,303);
   const review=ctx({approve:true,amount:partialAmount,reason:'테스트 부분취소'},a);
   if(mode==='external') {
    // A partial cancel made in the PG console goes to review, and only its exact amount can be approved.
    state={...state,status:'partialCancelled',balanceAmt:state.amount-partialAmount,cancels:[{tid:'console-cancel',amount:partialAmount}]};
    assert.equal(await (await webhook()).text(),'OK');
    assert.equal((await db.from('orders').select('status').eq('id',orderId).single()).data.status,'review');
    await assert.rejects(code.reviewRefund(ctx({approve:true,amount:partialAmount-1,reason:'금액 불일치'},a)),e=>e.code==='refund_mismatch');
    assert.equal((await code.reviewRefund(review)).status,'completed');
   } else {
    assert.equal((await db.from('refunds').insert({order_id:orderId,user_id:b.id,request_key:randomUUID(),amount:partialAmount,used_seconds:1,status:'review'})).error,null);
    assert.equal((await db.from('orders').update({status:'review'}).eq('id',orderId)).error,null);
    if(mode==='ok') {
     assert.equal((await code.reviewRefund(review)).status,'completed');
    } else {
     await assert.rejects(code.reviewRefund(review),e=>e.code==='payment_outcome_unknown');
     if(mode==='lost') {
      // The cancel went through but its response was lost: the PG record finishes the refund.
      assert.equal(await (await webhook()).text(),'OK');
     } else {
      // The cancel never reached the PG: too soon to tell at first, then safe to retry once it has settled.
      await assert.rejects(code.recoverOrder(ctx({},a)),e=>e.code==='payment_outcome_unknown');
      assert.equal((await db.from('refunds').update({nicepay_cancel_started_at:new Date(Date.now()-60_000).toISOString()}).eq('order_id',orderId)).error,null);
      assert.equal((await code.recoverOrder(ctx({},a))).status,'completed');
     }
    }
   }
   assert.equal((await db.from('refunds').select('status').eq('order_id',orderId).single()).data.status,'completed');
   assert.equal((await db.from('entitlements').select('revoked').eq('order_id',orderId).single()).data.revoked,true);
   assert.equal(cancelCalls,{ok:2,lost:3,dropped:5,external:5}[mode]);
  }
 } finally {
  globalThis.fetch=original;
  for(const [name,value] of Object.entries(oldSettings)) {
   if(value===undefined) delete process.env[name]; else process.env[name]=value;
  }
  rmSync(compiled,{recursive:true});
 }
});

test('admin refund dashboard lists requests and shows one request in detail, for admins only',async()=>{
 const compiled=mkdtempSync(join(tmpdir(),'quick-math-refunds-test-'));
 symlinkSync(join(process.cwd(),'node_modules'),join(compiled,'node_modules'),'dir');
 mkdirSync(join(compiled,'server'));
 for(const file of ['http','nicepay','orders']) writeFileSync(join(compiled,'server',file+'.js'),ts.transpileModule(readFileSync('src/server/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
 try {
  const code=await import(pathToFileURL(join(compiled,'server','orders.js')).href);
  const ctx=(actor,orderId)=>({params:{orderId},user:async()=>({id:actor.id,email:actor.email}),request:new NextRequest(base+'/api/admin/refunds')});
  const o=await rpc('create_order',{p_user:b.id,p_product:productId,p_key:randomUUID()});orders.push(o.id);
  await rpc('prepare_payment',{p_user:b.id,p_order:o.id,p_payment:'admin-list-'+run});
  await rpc('complete_payment',{p_order:o.id,p_payment:'admin-list-'+run,p_amount:o.amount,p_paid:new Date().toISOString()});
  assert.equal((await db.from('refunds').insert({order_id:o.id,user_id:b.id,request_key:randomUUID(),amount:50000,used_seconds:600,status:'review'})).error,null);
  assert.equal((await db.from('orders').update({status:'review'}).eq('id',o.id)).error,null);
  assert.equal((await db.from('user_roles').upsert({user_id:a.id,role:'admin'})).error,null);

  await assert.rejects(code.adminRefunds(ctx(b)),e=>e.code==='forbidden');
  await assert.rejects(code.adminRefund(ctx(b,o.id)),e=>e.code==='forbidden');
  const {items}=await code.adminRefunds(ctx(a));
  const row=items.find(item=>item.orderId===o.id);
  assert.deepEqual({...row,requestedAt:typeof row.requestedAt},{orderId:o.id,requestedAt:'string',status:'review',external:false,name:'홍길동',email:b.email,
   title:'검증용 강의',kind:'vod',paidAmount:o.amount,refundAmount:50000,usedSeconds:600,totalSeconds:36000,downloaded:false});

  const detail=await code.adminRefund(ctx(a,o.id));
  assert.equal(detail.orderId,o.id);assert.equal(detail.status,'review');assert.equal(detail.email,b.email);
  assert.equal(detail.refundAmount,50000);assert.equal(detail.downloads,0);assert.equal(detail.cancelStartedAt,null);
  assert.equal(detail.payment,null,'no PG attempt: the PG view is left out, not an error');
  assert.ok(Date.parse(detail.expiresAt)>Date.now());
  await assert.rejects(code.adminRefund(ctx(a,randomUUID())),e=>e.code==='not_found');
  await rpc('review_refund',{p_order:o.id,p_approve:false,p_amount:50000,p_reason:'목록 테스트 정리'});
 } finally { rmSync(compiled,{recursive:true}); }
});

after(async()=>{
 for(const u of users){
  // Each ID was created by this test run; clean only those rows, preserving other local projects.
  for(const table of ['refunds','order_lessons','download_events','lesson_progress','playback_sessions','entitlements','orders','consent_events','user_roles','profiles']) await db.from(table).delete().eq('user_id',u.id);
  await db.auth.admin.deleteUser(u.id);
 }
 await db.from('lessons').delete().eq('product_id',productId);await db.from('chapters').delete().eq('product_id',productId);await db.from('products').delete().eq('id',productId);
 const audit=execFileSync('docker',['exec','supabase_db_quick-math','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"],{encoding:'utf8'}).trim();assert.equal(audit,'0','all public tables must have RLS');
});

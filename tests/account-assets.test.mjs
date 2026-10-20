// This suite creates and removes only its own fixtures in the isolated local stack.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server.js';
import ts from 'typescript';

assert.equal(process.env.SUPABASE_URL,'http://127.0.0.1:54331','tests require isolated local Supabase');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const nodeRequire=createRequire(import.meta.url), modules=new Map();
function load(file) {
  const path=resolve(file);
  if(modules.has(path)) return modules.get(path);
  const exports={}; modules.set(path,exports);
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  runInNewContext(source,{exports,process,console,Buffer,URL,Headers,Response,Request,ReadableStream,AbortSignal,FormData,File,fetch,require:name=>{
    if(name==='../features/auth') return load('src/features/auth/validation.ts');
    return name.startsWith('.') ? load(resolve(dirname(path),name+'.ts')) : nodeRequire(name);
  }});
  return exports;
}
const {api}=load('src/server/http.ts'), auth=load('src/server/auth.ts'), learning=load('src/server/learning.ts'), catalog=load('src/server/catalog.ts'), manage=load('src/server/manage.ts');
const run='account-assets-'+Date.now(), users=[], assetIds=[], paths=[], productId=run;
const metadata={name:'로컬 연동 검증',birthday:'2000-01-01',phone:'01012345678',marketing:false,agreements:[true,true,true,false]};
const pdfs=[Buffer.from('%PDF-1.7\n개념 교재'),Buffer.from('%PDF-1.7\n문제 교재')];
let owner,other,order,thumbnail,materialA,materialB,profilePath;
async function rpc(name,args) {const result=await db.rpc(name,args);assert.equal(result.error,null,JSON.stringify(result.error));return result.data;}
async function call(handler,{jar=new Map(),method='GET',params={},data,origin='http://127.0.0.1:3001',query=''}={}) {
  const response=await api(handler)(new NextRequest('http://127.0.0.1:3001/api/test'+query,{method,headers:{Origin:origin,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join(';'),...(method==='GET'?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(data??{})})}),{params:Promise.resolve(params)});
  for(const cookie of response.headers.getSetCookie()){const part=cookie.split(';')[0],at=part.indexOf('=');if(part.slice(at+1))jar.set(part.slice(0,at),part.slice(at+1));else jar.delete(part.slice(0,at));}
  return {status:response.status,headers:response.headers,body:response.headers.get('content-type')==='application/zip'?Buffer.from(await response.arrayBuffer()):await response.json()};
}
async function user(suffix) {
  const email=`${run}-${suffix}@example.com`,created=await db.auth.admin.createUser({email,password:'local-qa-password-2026',email_confirm:true,user_metadata:metadata});
  assert.equal(created.error,null,JSON.stringify(created.error));
  const value={id:created.data.user.id,email,jar:new Map()}; users.push(value);
  const login=await call(auth.authenticate,{method:'POST',params:{action:'login'},data:{email,password:'local-qa-password-2026'},jar:value.jar});
  assert.equal(login.status,200,JSON.stringify(login.body)); return value;
}
async function asset(slot,name,bytes,type) {
  const path=`${owner.id}/${randomUUID()}.${type==='application/pdf'?'pdf':'png'}`,uploaded=await db.storage.from('admin-course-assets').upload(path,bytes,{contentType:type});
  assert.equal(uploaded.error,null);paths.push(['admin-course-assets',path]);
  const inserted=await db.from('admin_course_assets').insert({owner_id:owner.id,slot,path,name,size_bytes:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),content_type:type}).select('id').single();
  assert.equal(inserted.error,null);assetIds.push(inserted.data.id);return inserted.data.id;
}
before(async()=>{
  owner=await user('owner');other=await user('other');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKQAAAABJRU5ErkJggg==','base64');
  thumbnail=await asset('thumbnail','thumb.png',png,'image/png');
  materialA=await asset('material','개념.pdf',pdfs[0],'application/pdf');materialB=await asset('material','문제.pdf',pdfs[1],'application/pdf');
  profilePath=`${owner.id}/${run}.png`;assert.equal((await db.storage.from('profile-images').upload(profilePath,png,{contentType:'image/png'})).error,null);paths.push(['profile-images',profilePath]);
  assert.equal((await db.from('profiles').update({image_path:profilePath}).eq('user_id',owner.id)).error,null);
  assert.equal((await db.from('products').insert({id:productId,slug:productId,kind:'vod',title:'연동 검증 강의',price:10000,image:'/api/course-assets/'+thumbnail,selling:true})).error,null);
  assert.equal((await db.from('product_assets').insert([{product_id:productId,asset_id:thumbnail,role:'thumbnail',position:0},{product_id:productId,asset_id:materialA,role:'material',position:0},{product_id:productId,asset_id:materialB,role:'material',position:1}])).error,null);
  assert.equal((await db.from('chapters').insert([{id:run+'-c1',product_id:productId,title:'첫 챕터',position:0},{id:run+'-c2',product_id:productId,title:'둘째 챕터',position:1}])).error,null);
  assert.equal((await db.from('lessons').insert([{id:run+'-l1',product_id:productId,chapter_id:run+'-c1',title:'1강',position:2,duration_seconds:98,preview:false,vimeo_url:'https://vimeo.com/19231868'},{id:run+'-l2',product_id:productId,chapter_id:run+'-c2',title:'2강',position:0,duration_seconds:196,preview:true,vimeo_url:'https://vimeo.com/123456/paidsecret'}])).error,null);
  order=await rpc('create_order',{p_user:owner.id,p_product:productId,p_key:randomUUID()});
  await rpc('prepare_payment',{p_user:owner.id,p_order:order.id,p_payment:run});
  await rpc('complete_payment',{p_order:order.id,p_payment:run,p_amount:10000,p_paid:new Date().toISOString()});
});

test('catalog and preview expose only lesson one and propagate the saved profile image',async()=>{
  const detail=await call(catalog.productDetail,{params:{slug:productId},jar:owner.jar});assert.equal(detail.status,200,JSON.stringify(detail.body));
  assert.deepEqual(detail.body.chapters.flatMap(c=>c.lessons.map(l=>l.preview)),[true,false]);
  assert.ok(detail.body.profile.image.includes('profile-images/'+profilePath));
  const preview=await call(learning.previewViewer,{params:{courseId:productId}});assert.equal(preview.status,200);assert.equal(preview.body.recentLessonId,run+'-l1');
  assert.ok(!JSON.stringify(preview.body).includes('paidsecret'));
  assert.equal((await call(learning.previewViewer,{params:{courseId:productId},query:'?lesson='+run+'-l2'})).status,403);
  const snapshot=await db.from('order_lessons').select('lesson_id,preview').eq('order_id',order.id).order('lesson_id');assert.equal(snapshot.error,null);
  assert.deepEqual(snapshot.data.map(l=>l.preview),[true,false]);assert.equal(order.total_paid_seconds,196);
});

test('classroom uses the published image and recognizes uploaded materials without legacy pdf_path',async()=>{
  const result=await call(learning.classroom,{jar:owner.jar});assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.items[0].image,'/api/course-assets/'+thumbnail);assert.equal(result.body.items[0].includedPdf,true);
  assert.equal((await call(manage.publicCourseAsset,{params:{id:materialA}})).status,404);
  assert.equal((await call(learning.download,{method:'POST',params:{orderId:order.id},jar:other.jar})).status,404);
  assert.equal((await call(learning.download,{method:'POST',params:{orderId:order.id}})).status,401);
});

test('two private PDFs download as one valid ZIP and record one download event',async()=>{
  const result=await call(learning.download,{method:'POST',params:{orderId:order.id},jar:owner.jar});assert.equal(result.status,200);
  assert.equal(result.headers.get('content-type'),'application/zip');
  const contents=JSON.parse(execFileSync('python3',['-c','import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))'],{input:result.body,encoding:'utf8'}));
  assert.deepEqual(contents,{'1-개념.pdf':pdfs[0].toString(),'2-문제.pdf':pdfs[1].toString()});
  assert.equal((await db.from('download_events').select('id').eq('order_id',order.id)).data.length,1);
});

test('a single uploaded PDF retains the signed-link response and revoked access is denied',async()=>{
  assert.equal((await db.from('product_assets').delete().eq('product_id',productId).eq('asset_id',materialB)).error,null);
  const result=await call(learning.download,{method:'POST',params:{orderId:order.id},jar:owner.jar});assert.equal(result.status,200,JSON.stringify(result.body));
  assert.ok(result.body.url.includes('admin-course-assets/'));
  assert.deepEqual(Buffer.from(await (await fetch(result.body.url)).arrayBuffer()),pdfs[0]);
  assert.equal((await db.from('entitlements').update({revoked:true}).eq('order_id',order.id)).error,null);
  assert.equal((await call(learning.download,{method:'POST',params:{orderId:order.id},jar:owner.jar})).status,403);
  assert.equal((await db.from('entitlements').update({revoked:false}).eq('order_id',order.id)).error,null);
});

test('withdrawal atomically ends access and sessions while preserving payment records',async()=>{
  const oldCookies=new Map(owner.jar);
  assert.equal((await call(auth.authenticate,{method:'POST',params:{action:'withdraw'}})).status,401);
  assert.equal((await call(auth.authenticate,{method:'POST',params:{action:'withdraw'},jar:owner.jar,origin:'https://other.invalid'})).status,403);
  const result=await call(auth.authenticate,{method:'POST',params:{action:'withdraw'},jar:owner.jar});assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal((await call(learning.classroom,{jar:oldCookies})).status,401);
  assert.equal((await call(learning.download,{method:'POST',params:{orderId:order.id},jar:oldCookies})).status,401);
  const identity=await db.auth.admin.getUserById(owner.id);assert.equal(identity.error,null);assert.ok(identity.data.user.deleted_at);
  const saved=await db.from('orders').select('status,amount,payment_key').eq('id',order.id).single();assert.equal(saved.error,null);assert.deepEqual(saved.data,{status:'paid',amount:10000,payment_key:run});
  assert.equal((await db.from('order_lessons').select('lesson_id').eq('order_id',order.id)).data.length,2);
  assert.equal((await db.from('entitlements').select('revoked').eq('order_id',order.id).single()).data.revoked,true);
  const restored=await db.from('entitlements').update({revoked:false}).eq('order_id',order.id).select('revoked').single();assert.equal(restored.error,null);assert.equal(restored.data.revoked,true);
  assert.equal((await call(auth.authenticate,{method:'POST',params:{action:'login'},data:{email:owner.email,password:'local-qa-password-2026'}})).status,401);
});

test('logout clears the session and previously issued cookies cannot reopen the classroom',async()=>{
  const oldCookies=new Map(other.jar);
  assert.equal((await call(auth.authenticate,{method:'POST',params:{action:'logout'},jar:other.jar})).status,200);
  assert.equal((await call(learning.classroom,{jar:oldCookies})).status,401);
});

after(async()=>{
  for(const [bucket,path] of paths) await db.storage.from(bucket).remove([path]);
  for(const item of users) for(const table of ['refunds','order_lessons','download_events','lesson_progress','playback_sessions','entitlements','orders']) await db.from(table).delete().eq('user_id',item.id);
  await db.from('product_assets').delete().eq('product_id',productId);
  await db.from('lessons').delete().eq('product_id',productId);await db.from('chapters').delete().eq('product_id',productId);await db.from('products').delete().eq('id',productId);
  if(assetIds.length) await db.from('admin_course_assets').delete().in('id',assetIds);
  for(const item of users){for(const table of ['consent_events','user_roles','profiles'])await db.from(table).delete().eq('user_id',item.id);await db.auth.admin.deleteUser(item.id);}
});

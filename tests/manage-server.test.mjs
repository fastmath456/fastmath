// Only the dedicated local quick-math stack is allowed; no cloud/test-production writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
assert.equal(process.env.SUPABASE_URL,'http://127.0.0.1:54331','tests require isolated local Supabase');
const base=process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const users=[];
const metadata={name:'관리자 테스트',birthday:'2014-02-22',phone:'01032428118',marketing:false,agreements:[true,true,true,false]};

function cookies(response,jar) {
  for(const raw of response.headers.getSetCookie()) { const pair=raw.split(';')[0],at=pair.indexOf('='); if(pair.slice(at+1)) jar.set(pair.slice(0,at),pair.slice(at+1)); else jar.delete(pair.slice(0,at)); }
}
async function request(path,{method='GET',data,jar=new Map()}={}) {
  const response=await fetch(base+'/api/'+path,{method,headers:{Origin:base,...(data?{'Content-Type':'application/json'}:{}),Cookie:[...jar].map(([key,value])=>key+'='+value).join(';')},...(data?{body:JSON.stringify(data)}:{})});
  cookies(response,jar); return {status:response.status,body:await response.json()};
}
async function user(name) {
  const email=`manage-${Date.now()}-${name}@example.com`,created=await db.auth.admin.createUser({email,password:'test-password-2026',email_confirm:true,user_metadata:metadata});
  assert.equal(created.error,null,JSON.stringify(created.error)); const result={id:created.data.user.id,email,jar:new Map()}; users.push(result);
  const login=await request('auth/login',{method:'POST',data:{email,password:'test-password-2026'},jar:result.jar}); assert.equal(login.status,200,JSON.stringify(login.body)); return result;
}
function document() { return {basic:{title:'초안',basePrice:'10000',price:'9000',licenseDays:'',thumbnail:null,detailImage:null,materials:[]},chapters:[],step:1,selectedLessonId:null}; }

let admin,other,member,draft,publishedCourse,publishedDocument,oldLessonId,newLessonId;
before(async()=>{
  admin=await user('admin'); other=await user('other'); member=await user('member');
  assert.equal((await db.from('user_roles').insert([{user_id:admin.id,role:'admin'},{user_id:other.id,role:'admin'}])).error,null);
});

test('course drafts require an administrator and use an optimistic revision',async()=>{
  assert.equal((await request('admin/courses/access',{jar:member.jar})).status,403);
  assert.deepEqual((await request('admin/courses/access',{jar:admin.jar})).body,{admin:true});
  const created=await request('admin/courses/drafts',{method:'POST',jar:admin.jar,data:{document:document()}}); assert.equal(created.status,200,JSON.stringify(created.body)); draft=created.body.draft;
  assert.equal(draft.document.basic.displayOrder,''); assert.deepEqual(draft.document.basic.detailImages,[]); assert.equal(draft.document.basic.reviews[0].rating,null); assert.equal(draft.revision,1); assert.equal(draft.document.basic.title,'초안');
  const own=await request('admin/courses/drafts/'+draft.id,{jar:admin.jar}); assert.equal(own.status,200);
  assert.equal((await request('admin/courses/drafts/'+draft.id,{jar:other.jar})).status,404);
  const changed={...document(),basic:{...document().basic,title:'저장된 초안'}};
  const saved=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:changed,revision:1}}); assert.equal(saved.status,200,JSON.stringify(saved.body)); assert.equal(saved.body.draft.revision,2);
  const stale=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:changed,revision:1}}); assert.equal(stale.status,409); assert.equal(stale.body.error.code,'draft_conflict');
  assert.equal((await fetch(base+'/api/admin/courses/drafts')).status,405);
});

test('uploads reject MIME spoofing before private storage is written',async()=>{
  const form=new FormData(); form.set('slot','thumbnail'); form.set('file',new File([new Uint8Array([1,2,3])],'spoofed.png',{type:'image/png'}));
  const response=await fetch(base+'/api/admin/courses/uploads',{method:'POST',headers:{Origin:base,Cookie:[...admin.jar].map(([key,value])=>key+'='+value).join(';')},body:form}); assert.equal(response.status,400); assert.equal((await response.json()).error.code,'invalid_file');
});

test('material uploads deduplicate checksum races and drafts reject duplicate material references',async()=>{
  const upload=async()=>{
    const form=new FormData(); form.set('slot','material'); form.set('file',new File([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj')],'guide.pdf',{type:'application/pdf'}));
    const response=await fetch(base+'/api/admin/courses/uploads',{method:'POST',headers:{Origin:base,Cookie:[...admin.jar].map(([key,value])=>key+'='+value).join(';')},body:form});
    return {status:response.status,body:await response.json()};
  };
  const first=await upload(),second=await upload();
  assert.equal(first.status,200,JSON.stringify(first.body)); assert.equal(second.status,200,JSON.stringify(second.body));
  assert.equal(first.body.asset.id,second.body.asset.id);
  const duplicate=document(); duplicate.basic.materials=[first.body.asset,first.body.asset];
  const rejected=await request('admin/courses/drafts',{method:'POST',jar:admin.jar,data:{document:duplicate}});
  assert.equal(rejected.status,400); assert.equal(rejected.body.error.code,'invalid_asset');
});

test('publishing atomically creates a sellable VOD and retains every material reference',async()=>{
  const createAsset=async(slot,name)=>{
    const row=await db.from('admin_course_assets').insert({owner_id:admin.id,slot,path:admin.id+'/'+name,name,size_bytes:1,checksum:(name.charCodeAt(0).toString(16).padStart(2,'0')).repeat(32),content_type:slot==='material'?'application/pdf':'image/png'}).select('id').single();
    assert.equal(row.error,null,JSON.stringify(row.error)); return row.data.id;
  };
  const [thumbnail,detail,materialA,materialB]=await Promise.all([createAsset('thumbnail','thumb.png'),createAsset('detailImage','detail.png'),createAsset('material','a.pdf'),createAsset('material','b.pdf')]);
  const video={url:'https://vimeo.com/123456',embedUrl:'https://player.vimeo.com/video/123456?autoplay=0',durationSeconds:120};
  assert.equal((await db.from('verified_videos').insert({owner_id:admin.id,url:video.url,embed_url:video.embedUrl,duration_seconds:video.durationSeconds})).error,null);
  const complete={basic:{title:'공개할 강의',basePrice:'10000',price:'9000',licenseDays:'45',displayOrder:'0',reviews:[],thumbnail:{id:thumbnail},detailImages:[{id:detail}],materials:[{id:materialA},{id:materialB}]},chapters:[{id:'chapter-'+draft.id,title:'챕터',lessons:[{id:'lesson-'+draft.id,title:'차시',inputUrl:video.url,video}]}],step:2,selectedLessonId:'lesson-'+draft.id};
  publishedDocument=complete; oldLessonId=complete.chapters[0].lessons[0].id;
  const oversized=structuredClone(complete); oversized.basic.price='2147483648';
  const oversizedSave=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:oversized,revision:2}}); assert.equal(oversizedSave.status,200,JSON.stringify(oversizedSave.body));
  const oversizedPublish=await request('admin/courses/drafts/'+draft.id+'/publish',{method:'POST',jar:admin.jar,data:{revision:3}}); assert.equal(oversizedPublish.status,400); assert.equal(oversizedPublish.body.error.code,'invalid_draft');
  const forged=structuredClone(complete); forged.chapters[0].lessons[0].video.durationSeconds=121;
  const saved=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:forged,revision:3}}); assert.equal(saved.status,200,JSON.stringify(saved.body));
  const forgedPublish=await request('admin/courses/drafts/'+draft.id+'/publish',{method:'POST',jar:admin.jar,data:{revision:4}}); assert.equal(forgedPublish.status,400); assert.equal(forgedPublish.body.error.code,'invalid_video');
  const corrected=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:complete,revision:4}}); assert.equal(corrected.status,200,JSON.stringify(corrected.body));
  const published=await request('admin/courses/drafts/'+draft.id+'/publish',{method:'POST',jar:admin.jar,data:{revision:5}}); assert.equal(published.status,200,JSON.stringify(published.body)); publishedCourse=published.body.courseId;
  const product=await db.from('products').select('image,license_days,selling').eq('id',publishedCourse).single(); assert.equal(product.error,null); assert.equal(product.data.license_days,45); assert.equal(product.data.selling,true); assert.equal(product.data.image,'/api/course-assets/'+thumbnail);
  const assets=await db.from('product_assets').select('role').eq('product_id',publishedCourse); assert.equal(assets.error,null); assert.deepEqual(assets.data.map(row=>row.role).sort(),['detailImage','material','material','thumbnail']);
  assert.equal((await fetch(base+'/api/course-assets/'+materialA)).status,404,'published materials stay private');
  const immutable=await request('admin/courses/drafts/'+draft.id,{method:'PATCH',jar:admin.jar,data:{document:complete,revision:5}}); assert.equal(immutable.status,400); assert.equal(immutable.body.error.code,'draft_published');
  const again=await request('admin/courses/drafts/'+draft.id+'/publish',{method:'POST',jar:admin.jar,data:{revision:5}}); assert.equal(again.status,200); assert.equal(again.body.courseId,publishedCourse);
});

test('another administrator can publish a title-only edit using the already verified course video',async()=>{
  const loaded=await request('admin/courses/'+publishedCourse,{jar:other.jar}); assert.equal(loaded.status,200,JSON.stringify(loaded.body)); assert.equal(loaded.body.draft.id,''); assert.equal(loaded.body.draft.published,false);
  const document=structuredClone(loaded.body.draft.document); document.basic.title='다른 관리자 제목 수정';
  const saved=await request('admin/courses/drafts',{method:'POST',jar:other.jar,data:{courseId:publishedCourse,document}}); assert.equal(saved.status,200,JSON.stringify(saved.body)); assert.equal(saved.body.draft.courseId,publishedCourse); assert.notEqual(saved.body.draft.id,'');
  const published=await request('admin/courses/drafts/'+saved.body.draft.id+'/publish',{method:'POST',jar:other.jar,data:{revision:1}}); assert.equal(published.status,200,JSON.stringify(published.body)); assert.equal(published.body.courseId,publishedCourse);
});

async function pay(user,courseId) {
  const created=await db.rpc('create_order',{p_user:user.id,p_product:courseId,p_key:randomUUID()});
  assert.equal(created.error,null,JSON.stringify(created.error));
  const order=created.data;
  const payment='test-'+randomUUID();
  const prepared=await db.rpc('prepare_payment',{p_user:user.id,p_order:order.id,p_payment:payment});
  assert.equal(prepared.error,null,JSON.stringify(prepared.error));
  const paid=await db.rpc('complete_payment',{p_order:order.id,p_payment:payment,p_amount:order.amount,p_paid:new Date().toISOString()});
  assert.equal(paid.error,null,JSON.stringify(paid.error));
  return order.id;
}

test('course edits preserve paid lesson snapshots while new purchases see only active lessons',async()=>{
  const memberOrder=await pay(member,publishedCourse);
  const loaded=await request('admin/courses/'+publishedCourse,{jar:admin.jar});
  assert.equal(loaded.status,200,JSON.stringify(loaded.body));
  assert.deepEqual(loaded.body.draft.document.chapters[0].lessons[0].video,publishedDocument.chapters[0].lessons[0].video);
  newLessonId='lesson-new-'+draft.id;
  const replacement=structuredClone(loaded.body.draft.document);
  replacement.chapters[0].lessons=[{...replacement.chapters[0].lessons[0],id:newLessonId,title:'새 차시'}];
  replacement.selectedLessonId=newLessonId;
  const edit=await request('admin/courses/drafts',{method:'POST',jar:admin.jar,data:{courseId:publishedCourse,document:replacement}});
  assert.equal(edit.status,200,JSON.stringify(edit.body));
  const republished=await request('admin/courses/drafts/'+edit.body.draft.id+'/publish',{method:'POST',jar:admin.jar,data:{revision:1}});
  assert.equal(republished.status,200,JSON.stringify(republished.body));
  const otherOrder=await pay(other,publishedCourse);
  const before=await request('classroom/courses/'+publishedCourse,{jar:member.jar});
  assert.equal(before.status,200,JSON.stringify(before.body));
  assert.deepEqual(before.body.chapters.flatMap(chapter=>chapter.lessons.map(lesson=>lesson.id)),[oldLessonId]);
  const after=await request('classroom/courses/'+publishedCourse,{jar:other.jar});
  assert.equal(after.status,200,JSON.stringify(after.body));
  assert.deepEqual(after.body.chapters.flatMap(chapter=>chapter.lessons.map(lesson=>lesson.id)),[newLessonId]);
  const oldPlayback=await request('playback',{method:'POST',jar:member.jar,data:{orderId:memberOrder,lessonId:oldLessonId}});
  assert.equal(oldPlayback.status,200,JSON.stringify(oldPlayback.body));
  assert.match(oldPlayback.body.url,/player\.vimeo\.com\/video\/123456/);
  assert.equal((await request('playback',{method:'POST',jar:member.jar,data:{orderId:memberOrder,lessonId:newLessonId}})).status,403);
  const newPlayback=await request('playback',{method:'POST',jar:other.jar,data:{orderId:otherOrder,lessonId:newLessonId}});
  assert.equal(newPlayback.status,200,JSON.stringify(newPlayback.body));
  assert.equal((await request('playback',{method:'POST',jar:other.jar,data:{orderId:otherOrder,lessonId:oldLessonId}})).status,403);
});

after(async()=>{
  const orderRows=await db.from('orders').select('id').in('user_id',users.map(current=>current.id));
  const orderIds=(orderRows.data??[]).map(row=>row.id);
  if(orderIds.length) {
    await db.from('lesson_progress').delete().in('order_id',orderIds);
    await db.from('playback_sessions').delete().in('order_id',orderIds);
    await db.from('order_lessons').delete().in('order_id',orderIds);
    await db.from('entitlements').delete().in('order_id',orderIds);
    await db.from('refunds').delete().in('order_id',orderIds);
    await db.from('orders').delete().in('id',orderIds);
  }
  if(publishedCourse) {
    await db.from('course_drafts').delete().eq('course_id',publishedCourse);
    await db.from('product_assets').delete().eq('product_id',publishedCourse);
    await db.from('lessons').delete().eq('product_id',publishedCourse);
    await db.from('chapters').delete().eq('product_id',publishedCourse);
    await db.from('products').delete().eq('id',publishedCourse);
  }
  for(const current of users) {
    await db.from('verified_videos').delete().eq('owner_id',current.id);
    await db.from('admin_course_assets').delete().eq('owner_id',current.id);
    await db.from('course_drafts').delete().eq('owner_id',current.id);
    await db.from('user_roles').delete().eq('user_id',current.id);
    await db.from('consent_events').delete().eq('user_id',current.id);
    await db.from('profiles').delete().eq('user_id',current.id);
    await db.auth.admin.deleteUser(current.id);
  }
});

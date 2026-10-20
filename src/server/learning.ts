import { adminDb, ApiError, body, dbError, integer, string, uuid, date, type Context } from './http';
import { ownOrder } from './orders';
import { parseVimeoUrl } from '../features/manage/validation';
import { NextResponse } from 'next/server';
import { zipStream } from './zip';

export async function classroom(ctx:Context) {
  const user=await ctx.user(),db=adminDb(); const [entitlements,progress,downloads]=await Promise.all([
    db.from('entitlements').select('*,products(title,kind,image,pdf_path)').eq('user_id',user.id).eq('revoked',false).eq('hidden',false).order('starts_at',{ascending:false}),
    db.from('lesson_progress').select('order_id,completed,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false}),
    db.from('download_events').select('order_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
  ]); [entitlements,progress,downloads].forEach(r=>dbError(r.error));
  const assets=entitlements.data!.length ? await db.from('product_assets').select('product_id').eq('role','material').in('product_id',entitlements.data!.map(e=>e.product_id)) : {data:[],error:null}; dbError(assets.error);
  const materialProducts=new Set(assets.data!.map(asset=>asset.product_id));
  const items=await Promise.all(entitlements.data!.map(async e=>{
    const p=e.products as unknown as {title:string;kind:string;image:string;pdf_path:string|null};
    const lessons=await db.from('order_lessons').select('lesson_id',{count:'exact',head:true}).eq('order_id',e.order_id); dbError(lessons.error);
    const completed=progress.data!.filter(pr=>pr.order_id===e.order_id&&pr.completed).length,expired=Date.parse(e.expires_at)<=Date.now();
    return {id:e.id,orderId:e.order_id,courseId:e.product_id,kind:p.kind,title:p.title,image:p.image,status:expired?'만료':p.kind==='vod'?'수강 중':'다운로드 가능',period:date(e.starts_at)+' ~ '+date(e.expires_at),progress:lessons.count?Math.floor(completed/lessons.count*100):0,recent:date(progress.data!.find(pr=>pr.order_id===e.order_id)?.updated_at??null)||'-',downloaded:date(downloads.data!.find(d=>d.order_id===e.order_id)?.created_at??null)||'-',includedPdf:Boolean(p.pdf_path)||materialProducts.has(e.product_id),expired};
  })); return {items,count:items.length};
}
export async function viewer(ctx:Context) {
  const user=await ctx.user(),db=adminDb(),now=new Date().toISOString();
  const ent=await db.from('entitlements').select('order_id,products(title,poster),orders(status)').eq('user_id',user.id).eq('product_id',ctx.params.courseId).eq('revoked',false).lte('starts_at',now).gt('expires_at',now).maybeSingle(); dbError(ent.error);
  if(!ent.data||(ent.data.orders as unknown as {status:string}).status!=='paid') throw new ApiError(403,'no_access');
  const [orderLessons,progress]=await Promise.all([
    db.from('order_lessons').select('lesson_id').eq('order_id',ent.data.order_id),
    db.from('lesson_progress').select('lesson_id').eq('order_id',ent.data.order_id).order('updated_at',{ascending:false}).limit(1),
  ]);[orderLessons,progress].forEach(r=>dbError(r.error));
  const lessonIds=orderLessons.data!.map(row=>row.lesson_id);
  const lessons=lessonIds.length?await db.from('lessons').select('id,title,chapter_id,position').eq('product_id',ctx.params.courseId).in('id',lessonIds).order('position'):{data:[],error:null}; dbError(lessons.error);
  const chapterIds=[...new Set(lessons.data!.map(lesson=>lesson.chapter_id))];
  const chapters=chapterIds.length?await db.from('chapters').select('id,title,position').eq('product_id',ctx.params.courseId).in('id',chapterIds).order('position'):{data:[],error:null}; dbError(chapters.error);
  const product=ent.data.products as unknown as {title:string;poster:string};
  return {courseId:ctx.params.courseId,title:product.title,poster:product.poster,orderId:ent.data.order_id,recentLessonId:progress.data?.[0]?.lesson_id??lessons.data?.[0]?.id??'',chapters:chapters.data!.map(c=>({...c,lessons:lessons.data!.filter(l=>l.chapter_id===c.id).map(l=>({id:l.id,title:l.title}))}))};
}
export async function previewViewer(ctx:Context) {
  const db=adminDb(),courseId=string(ctx.params.courseId,'courseId',100);
  const product=await db.from('products').select('id,title,poster').eq('id',courseId).eq('kind','vod').maybeSingle(); dbError(product.error);
  if(!product.data) throw new ApiError(404,'not_found');
  const [chapters,lessons]=await Promise.all([
    db.from('chapters').select('id,title,position').eq('product_id',courseId).eq('active',true).order('position'),
    db.from('lessons').select('id,title,chapter_id,preview,position').eq('product_id',courseId).eq('active',true).order('position'),
  ]); [chapters,lessons].forEach(result=>dbError(result.error));
  const visible=chapters.data!.flatMap(chapter=>lessons.data!.filter(lesson=>lesson.chapter_id===chapter.id));
  const firstLesson=visible[0]?.id;
  const requested=ctx.request.nextUrl.searchParams.get('lesson');
  const requestedId=requested===null ? undefined : string(requested,'lesson',100);
  const selected=requestedId ? visible.find(lesson=>lesson.id===requestedId) : visible[0];
  if(!selected || selected.id!==firstLesson) throw new ApiError(403,'no_access');
  const source=await db.from('lessons').select('vimeo_id,vimeo_url').eq('id',selected.id).eq('product_id',courseId).eq('active',true).maybeSingle(); dbError(source.error);
  if(!source.data) throw new ApiError(403,'no_access');
  const video=parseVimeoUrl(source.data.vimeo_url??(source.data.vimeo_id?'https://vimeo.com/'+source.data.vimeo_id:''));
  if(!video) throw new ApiError(503,'video_unavailable');
  return {courseId,title:product.data.title,poster:product.data.poster,recentLessonId:selected.id,previewUrl:video.embedUrl,chapters:chapters.data!.map(chapter=>({id:chapter.id,title:chapter.title,lessons:visible.filter(lesson=>lesson.chapter_id===chapter.id).map(lesson=>({id:lesson.id,title:lesson.title,preview:lesson.id===firstLesson}))}))};
}
export async function hide(ctx:Context) {
  const user=await ctx.user(),db=adminDb();
  const result=await db.from('entitlements').update({hidden:true}).eq('id',uuid(ctx.params.id)).eq('user_id',user.id).lte('expires_at',new Date().toISOString()).select('id').maybeSingle(); dbError(result.error); if(!result.data) throw new ApiError(403,'no_access'); return {ok:true};
}
export async function download(ctx:Context) {
  const order=await ownOrder(ctx,ctx.params.orderId),db=adminDb();
  const ent=await db.from('entitlements').select('expires_at').eq('order_id',order.id).single();dbError(ent.error); if(!ent.data) throw new ApiError(403,'no_access');
  const seconds=Math.min(60,Math.floor((Date.parse(ent.data.expires_at)-Date.now())/1000)); if(seconds<1) throw new ApiError(403,'no_access');
  const result=await db.rpc('order_download',{p_user:order.user_id,p_order:order.id});dbError(result.error);
  const files=result.data as {bucket:string;path:string;name:string;size:number}[];
  if(!files?.length) throw new ApiError(404,'file_missing');
  if(files.length===1) {
    const file=files[0],signed=await db.storage.from(file.bucket).createSignedUrl(file.path,seconds,{download:file.name});
    dbError(signed.error);return {url:signed.data!.signedUrl};
  }
  const entries=files.map((file,index)=>({
    name:`${index+1}-${file.name.replace(/[\\/\x00-\x1f]/g,'_')}`,size:file.size,open:async()=>{
      const signed=await db.storage.from(file.bucket).createSignedUrl(file.path,seconds);dbError(signed.error);
      const response=await fetch(signed.data!.signedUrl,{signal:AbortSignal.timeout(60_000)});
      if(!response.ok || !response.body) throw new ApiError(503,'file_unavailable');
      return response.body;
    },
  }));
  return new NextResponse(zipStream(entries),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="materials.zip"; filename*=UTF-8''${encodeURIComponent(order.title+'.zip')}`}});
}
export async function playback(ctx:Context) {
  const user=await ctx.user(),input=await body(ctx.request),db=adminDb(),order=await ownOrder(ctx,string(input.orderId,'orderId'));
  const lessonId=string(input.lessonId,'lessonId',100),snapshot=await db.from('order_lessons').select('lesson_id').eq('order_id',order.id).eq('lesson_id',lessonId).maybeSingle(); dbError(snapshot.error); if(!snapshot.data) throw new ApiError(403,'no_access');
  const lesson=await db.from('lessons').select('vimeo_id,vimeo_url').eq('id',lessonId).eq('product_id',order.product_id).maybeSingle();dbError(lesson.error);
  const source=lesson.data?.vimeo_url??(lesson.data?.vimeo_id?'https://vimeo.com/'+lesson.data.vimeo_id:''); const video=parseVimeoUrl(source);
  if(!video) throw new ApiError(503,'video_unavailable');
  const result=await db.rpc('start_playback',{p_user:user.id,p_order:order.id,p_lesson:lessonId});dbError(result.error);
  return {sessionId:result.data,url:video.embedUrl};
}
export async function progress(ctx:Context) {
  const user=await ctx.user(),input=await body(ctx.request);
  if(typeof input.playing!=='boolean') throw new ApiError(400,'invalid_field','playing');
  const result=await adminDb().rpc('record_progress',{p_user:user.id,p_session:uuid(input.sessionId,'sessionId'),p_sequence:integer(input.sequence,'sequence'),p_position:integer(input.position,'position'),p_playing:input.playing});dbError(result.error);return {ok:true};
}

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { parseVimeoUrl, emptyReview, emptyDocument } from '../features/manage/validation';
import { validProductOrder } from '../features/manage/course-order';
import type { Json } from './database.types';
import { adminDb, ApiError, bytes, dbError, requireAdmin, type Context } from './http';

type Slot = 'thumbnail' | 'detailImage' | 'material';
type AssetRow = { id:string; owner_id:string; slot:Slot; path:string; name:string; size_bytes:number; checksum:string; content_type:string; width:number|null; height:number|null };
type DraftRow = { id:string; owner_id:string; course_id:string|null; slug:string|null; document:unknown; revision:number; published:boolean; saved_at:string };
type Video = { url:string; embedUrl:string; durationSeconds:number };

const slots = new Set<Slot>(['thumbnail','detailImage','material']);
const imageTypes = new Set(['image/jpeg','image/png','image/webp']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const db = () => adminDb();

function manageError(error: {message:string; code?:string}|null) {
  if (!error) return;
  const found = ['order_conflict','draft_conflict','draft_published','invalid_draft','invalid_asset','invalid_video','pending_video','duplicate_asset'].find(code => error.message.includes(code));
  if (found) throw new ApiError(found === 'draft_conflict' || found === 'order_conflict' ? 409 : found === 'duplicate_asset' ? 409 : 400,found);
  dbError(error);
}
function plainObject(value: unknown, field='document'): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400,'invalid_field',field);
  return value as Record<string,unknown>;
}
async function json(request: Request, limit=1024*1024) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ApiError(415,'invalid_content_type');
  try { return plainObject(JSON.parse((await bytes(request,limit)).toString()),'body'); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400,'invalid_body'); }
}
function courseAsset(asset: AssetRow) {
  return { id:asset.id,name:asset.name,url:'/api/admin/courses/assets/'+asset.id,size:Number(asset.size_bytes),type:asset.content_type,checksum:asset.checksum };
}
function readAssetId(value: unknown, field: string, required=false) {
  if (value === null || value === undefined) { if(required) throw new ApiError(400,'invalid_field',field); return null; }
  const item=plainObject(value,field),id=item.id;
  if(typeof id!=='string'||!uuid.test(id)) throw new ApiError(400,'invalid_field',field);
  return id;
}
function assetReferences(document: Record<string,unknown>) {
  const basic=plainObject(document.basic,'basic'); const refs:{id:string;slot:Slot;field:string}[]=[];
  const thumbnail=readAssetId(basic.thumbnail,'thumbnail'); if(thumbnail) refs.push({id:thumbnail,slot:'thumbnail',field:'thumbnail'});
  if (!Array.isArray(basic.detailImages)) throw new ApiError(400,'invalid_field','detailImages');
  basic.detailImages.forEach((item,index) => { const id=readAssetId(item,'detailImages',true); refs.push({id:id!,slot:'detailImage',field:'detailImages.'+index}); });
  if(basic.materials !== undefined) {
    if(!Array.isArray(basic.materials)) throw new ApiError(400,'invalid_field','materials');
    basic.materials.forEach((item,index)=>{ const id=readAssetId(item,'materials'); if(id) refs.push({id,slot:'material',field:'materials.'+index}); });
  }
  return refs;
}
function assertDocumentShape(document: unknown) {
  const value=plainObject(document); const basic=plainObject(value.basic,'basic');
  if (value.productOrder !== undefined && !validProductOrder(value.productOrder)) throw new ApiError(400,'invalid_field','productOrder');
  // Older saved drafts contain one detailImage and no authoring fields.
  if (basic.detailImages === undefined) basic.detailImages = basic.detailImage ? [basic.detailImage] : [];
  delete basic.detailImage;
  if (basic.displayOrder === undefined) basic.displayOrder = '';
  if (basic.reviews === undefined) basic.reviews = [emptyReview()];
  if (!Array.isArray(basic.reviews)) throw new ApiError(400,'invalid_field','reviews');
  if (!basic.reviews.length) basic.reviews.push(emptyReview());
  const reviewIds = new Set<string>();
  for (const item of basic.reviews) {
    const review=plainObject(item,'reviews');
    if(typeof review.id!=='string'||!uuid.test(review.id)||reviewIds.has(review.id)||typeof review.body!=='string'||typeof review.author!=='string'||(review.rating!==null&&(typeof review.rating!=='number'||!Number.isFinite(review.rating)))) throw new ApiError(400,'invalid_field','reviews');
    reviewIds.add(review.id);
  }
  for(const key of ['displayOrder','title','basePrice','price','licenseDays']) if(typeof basic[key] !== 'string') throw new ApiError(400,'invalid_field','basic.'+key);
  if(!Array.isArray(value.chapters) || (value.step!==1&&value.step!==2) || (value.selectedLessonId!==null&&typeof value.selectedLessonId!=='string')) throw new ApiError(400,'invalid_field','document');
  for(const chapter of value.chapters) {
    const c=plainObject(chapter,'chapter'); if(typeof c.id!=='string'||typeof c.title!=='string'||!Array.isArray(c.lessons)) throw new ApiError(400,'invalid_field','chapter');
    for(const lesson of c.lessons) {
      const l=plainObject(lesson,'lesson');
      if(typeof l.id!=='string'||typeof l.title!=='string'||typeof l.inputUrl!=='string'||(l.video!==null&&typeof l.video!=='object')) throw new ApiError(400,'invalid_field','lesson');
      if(l.inputUrl.length>2048||l.title.length>200||l.id.length>120) throw new ApiError(400,'invalid_field','lesson');
      if(l.video!==null) { const video=plainObject(l.video,'video'),duration=video.durationSeconds; if(typeof video.url!=='string'||typeof video.embedUrl!=='string'||typeof duration!=='number'||!Number.isSafeInteger(duration)||duration<=0) throw new ApiError(400,'invalid_field','video'); }
    }
  }
  if(Buffer.byteLength(JSON.stringify(value))>1024*1024) throw new ApiError(413,'body_too_large');
  return value;
}
async function authoredAssets(ownerId: string, document: Record<string,unknown>, courseId?: string|null) {
  const refs=assetReferences(document); if(!refs.length) return new Map<string,AssetRow>();
  const ids=[...new Set(refs.map(ref=>ref.id))];
  const result=await db().from('admin_course_assets').select('id,owner_id,slot,path,name,size_bytes,checksum,content_type,width,height').in('id',ids);
  manageError(result.error); const rows=result.data as AssetRow[];
  if(rows.length!==ids.length) throw new ApiError(400,'invalid_asset');
  const linked=courseId ? await db().from('product_assets').select('asset_id').eq('product_id',courseId).in('asset_id',ids) : {data:[],error:null}; manageError(linked.error);
  const linkedIds=new Set((linked.data as Array<{asset_id:string}>).map(row=>row.asset_id));
  const found=new Map(rows.map(row=>[row.id,row]));
  const materialIds=new Set<string>(),materialChecksums=new Set<string>();
  const detailIds=new Set<string>();
  for(const ref of refs) {
    const asset=found.get(ref.id);
    if(asset?.slot!==ref.slot||(asset.owner_id!==ownerId&&!linkedIds.has(ref.id))) throw new ApiError(400,'invalid_asset',ref.field);
    if(ref.slot==='detailImage') { if(detailIds.has(asset.id)) throw new ApiError(400,'invalid_asset',ref.field); detailIds.add(asset.id); }
    if(ref.slot==='material') {
      if(materialIds.has(asset.id)||materialChecksums.has(asset.checksum)) throw new ApiError(400,'invalid_asset',ref.field);
      materialIds.add(asset.id); materialChecksums.add(asset.checksum);
    }
  }
  return found;
}
function hydrateDocument(value: unknown, assets: Map<string,AssetRow>) {
  const document=structuredClone(assertDocumentShape(value)); const basic=document.basic as Record<string,unknown>;
  const hydrate=(item:unknown) => { const id=readAssetId(item,'asset'); return id ? courseAsset(assets.get(id)!) : null; };
  if(basic.thumbnail) basic.thumbnail=hydrate(basic.thumbnail);
  if(Array.isArray(basic.detailImages)) basic.detailImages=basic.detailImages.map(hydrate);
  if(Array.isArray(basic.materials)) basic.materials=basic.materials.map(hydrate);
  return document;
}
function draft(row: DraftRow, document: unknown) {
  return {id:row.id,revision:row.revision,courseId:row.course_id,slug:row.slug,published:row.published,savedAt:row.saved_at,document};
}
async function courseReviews(courseId: string) {
  const [reviews, authors] = await Promise.all([
    db().from('reviews').select('id,rating,body,author').eq('product_id',courseId).order('position',{nullsFirst:false}).order('created_at',{ascending:false}).order('id'),
    db().from('course_review_authors').select('review_id,author').eq('product_id',courseId),
  ]);
  manageError(reviews.error); manageError(authors.error);
  const originalNames = new Map(authors.data!.map(row=>[row.review_id,row.author]));
  return reviews.data!.map(review=>({...review,author:originalNames.get(review.id)??review.author}));
}
async function authoringDocument(value: unknown, courseId: string|null) {
  const input=structuredClone(plainObject(value)),basic=plainObject(input.basic,'basic');
  if(courseId && basic.reviews===undefined) basic.reviews=await courseReviews(courseId);
  if(courseId && basic.displayOrder===undefined) { const product=await db().from('products').select('display_order').eq('id',courseId).single(); manageError(product.error); basic.displayOrder=product.data?.display_order===null?'':String(product.data!.display_order); }
  return assertDocumentShape(input);
}
async function hydrateDraft(row: DraftRow, ownerId: string) {
  const document=await authoringDocument(row.document,row.course_id); const assets=await authoredAssets(ownerId,document,row.course_id);
  return draft(row,hydrateDocument(document,assets));
}
export async function courseAccess(ctx: Context) { await requireAdmin(ctx); return {admin:true}; }
// Admin course list: every product, selling or not, then this admin's saved drafts of courses not registered yet.
export async function adminCourses(ctx: Context) {
  const user=await requireAdmin(ctx);
  const [products,lessons,drafts]=await Promise.all([
    db().from('products').select('id,slug,kind,title,price,image,selling,license_days,published_at').order('display_order',{ascending:true,nullsFirst:false}).order('published_at',{ascending:false}).order('id').limit(1000),
    db().from('lessons').select('product_id').eq('active',true).limit(10000),
    db().from('course_drafts').select('id,document,saved_at').eq('owner_id',user.id).eq('published',false).is('course_id',null).order('saved_at',{ascending:false}).limit(100),
  ]); [products,lessons,drafts].forEach(result=>manageError(result.error));
  const counts=new Map<string,number>(); for(const lesson of lessons.data!) counts.set(lesson.product_id,(counts.get(lesson.product_id)??0)+1);
  const courses=products.data!.map(p=>({id:p.id,status:p.selling?'selling':'stopped',kind:p.kind,title:p.title,slug:p.slug,image:p.image,price:p.price,licenseDays:p.license_days,lessons:counts.get(p.id)??0,date:p.published_at,step:1}));
  const saved=drafts.data!.map(row=>{
    const document=row.document&&typeof row.document==='object'&&!Array.isArray(row.document)?row.document as Record<string,unknown>:{};
    const basic=document.basic&&typeof document.basic==='object'&&!Array.isArray(document.basic)?document.basic as Record<string,unknown>:{};
    const price=typeof basic.price==='string'&&/^\d{1,9}$/.test(basic.price)?Number(basic.price):null,days=typeof basic.licenseDays==='string'&&/^\d{1,4}$/.test(basic.licenseDays)?Number(basic.licenseDays):null;
    const chapters=Array.isArray(document.chapters)?document.chapters as Array<{lessons?:unknown}>:[];
    return {id:row.id,status:'draft',kind:'vod',title:typeof basic.title==='string'?basic.title:'',slug:null,image:null,price,licenseDays:days,lessons:chapters.reduce((sum,chapter)=>sum+(Array.isArray(chapter?.lessons)?chapter.lessons.length:0),0),date:row.saved_at,step:document.step===2?2:1};
  });
  const items=[...courses,...saved]; return {items,count:items.length};
}
export async function createCourseDraft(ctx: Context) {
  const user=await requireAdmin(ctx),input=await json(ctx.request);
  const courseId=input.courseId===undefined?null:typeof input.courseId==='string'&&input.courseId.length<=120?input.courseId:null;
  if(input.courseId!==undefined&&!courseId) throw new ApiError(400,'invalid_field','courseId');
  if(courseId) { const course=await db().from('products').select('id').eq('id',courseId).maybeSingle(); manageError(course.error); if(!course.data) throw new ApiError(404,'not_found'); }
  const document=await authoringDocument(input.document,courseId);
  const assets=await authoredAssets(user.id,document,courseId),saved=hydrateDocument(document,assets);
  const result=await db().from('course_drafts').insert({owner_id:user.id,course_id:courseId,document:saved as unknown as Json}).select('id,owner_id,course_id,slug,document,revision,published,saved_at').single();
  manageError(result.error); return {draft:await hydrateDraft(result.data as DraftRow,user.id)};
}
export async function courseDraft(ctx: Context) {
  const user=await requireAdmin(ctx),id=ctx.params.id; if(!uuid.test(id)) throw new ApiError(400,'invalid_field','id');
  const result=await db().from('course_drafts').select('id,owner_id,course_id,slug,document,revision,published,saved_at').eq('id',id).eq('owner_id',user.id).maybeSingle();
  manageError(result.error); if(!result.data) throw new ApiError(404,'not_found'); return {draft:await hydrateDraft(result.data as DraftRow,user.id)};
}
export async function saveCourseDraft(ctx: Context) {
  const user=await requireAdmin(ctx),id=ctx.params.id,input=await json(ctx.request);
  const revision=input.revision; if(!uuid.test(id)||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1) throw new ApiError(400,'invalid_field','revision');
  const current=await db().from('course_drafts').select('course_id,published').eq('id',id).eq('owner_id',user.id).maybeSingle(); manageError(current.error); if(!current.data) throw new ApiError(404,'not_found'); if(current.data.published) throw new ApiError(400,'draft_published');
  const document=await authoringDocument(input.document,current.data.course_id);
  const assets=await authoredAssets(user.id,document,current.data.course_id),saved=hydrateDocument(document,assets);
  const result=await db().rpc('save_course_draft',{p_owner:user.id,p_draft:id,p_revision:revision,p_document:saved as unknown as Json}); manageError(result.error);
  return {draft:await hydrateDraft(result.data as DraftRow,user.id)};
}

export async function persistedCourse(ctx: Context) {
  const user=await requireAdmin(ctx),courseId=ctx.params.courseId;
  const product=await db().from('products').select('id,slug,title,base_price,price,license_days,display_order').eq('id',courseId).maybeSingle(); manageError(product.error); if(!product.data) throw new ApiError(404,'not_found');
  const saved=await db().from('course_drafts').select('id,owner_id,course_id,slug,document,revision,published,saved_at').eq('owner_id',user.id).eq('course_id',courseId).eq('published',false).order('saved_at',{ascending:false}).limit(1).maybeSingle(); manageError(saved.error);
  if(saved.data) return {draft:await hydrateDraft(saved.data as DraftRow,user.id)};
  const [chapters,lessons,links]=await Promise.all([
    db().from('chapters').select('id,title,position').eq('product_id',courseId).eq('active',true).order('position'),
    db().from('lessons').select('id,chapter_id,title,position,duration_seconds,vimeo_url').eq('product_id',courseId).eq('active',true).order('position'),
    db().from('product_assets').select('role,position,asset_id').eq('product_id',courseId).order('position'),
  ]); [chapters,lessons,links].forEach(result=>manageError(result.error));
  const lessonRows=lessons.data as Array<{id:string;chapter_id:string;title:string;duration_seconds:number;vimeo_url:string|null}>;
  const videoUrls=[...new Set(lessonRows.flatMap(lesson=>lesson.vimeo_url?[lesson.vimeo_url]:[]))];
  const verified=videoUrls.length ? await db().from('verified_videos').select('url,embed_url,duration_seconds').in('url',videoUrls) : {data:[],error:null}; manageError(verified.error);
  const verifiedByUrl=new Map((verified.data as Array<{url:string;embed_url:string;duration_seconds:number}>).map(video=>[video.url,video]));
  const linked=links.data as Array<{role:Slot;asset_id:string}>; const assetResult=linked.length ? await db().from('admin_course_assets').select('id,owner_id,slot,path,name,size_bytes,checksum,content_type,width,height').in('id',linked.map(link=>link.asset_id)) : {data:[],error:null}; manageError(assetResult.error);
  const assetById=new Map((assetResult.data as AssetRow[]).map(asset=>[asset.id,asset]));
  const document=emptyDocument(); document.basic.title=product.data.title; document.basic.basePrice=String(product.data.base_price??product.data.price); document.basic.price=String(product.data.price); document.basic.licenseDays=String(product.data.license_days); document.basic.displayOrder=product.data.display_order===null?'':String(product.data.display_order);
  const reviews=await courseReviews(courseId); document.basic.reviews=reviews.length?reviews:[emptyReview()];
  for(const row of linked) { const source=assetById.get(row.asset_id); if(!source) continue; const asset=courseAsset(source); if(row.role==='thumbnail') document.basic.thumbnail=asset; else if(row.role==='detailImage') document.basic.detailImages.push(asset); else document.basic.materials.push(asset); }
  document.chapters=(chapters.data as Array<{id:string;title:string}>).map(chapter=>({id:chapter.id,title:chapter.title,lessons:lessonRows.filter(lesson=>lesson.chapter_id===chapter.id).map(lesson=>{
    const verifiedVideo=lesson.vimeo_url ? verifiedByUrl.get(lesson.vimeo_url) : undefined;
    return {id:lesson.id,title:lesson.title,inputUrl:lesson.vimeo_url??'',video:verifiedVideo?{url:lesson.vimeo_url!,embedUrl:verifiedVideo.embed_url,durationSeconds:verifiedVideo.duration_seconds}:null,videoError:lesson.vimeo_url&&!verifiedVideo?'영상 재확인이 필요합니다.':undefined};
  })}));
  return {draft:{id:'',revision:0,courseId,slug:product.data.slug,published:false,savedAt:new Date(0).toISOString(),document}};
}

function fileMime(file: File, buffer: Buffer) {
  if(buffer.subarray(0,5).equals(Buffer.from('%PDF-'))) return 'application/pdf';
  if(buffer.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) return 'image/jpeg';
  if(buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if(buffer.subarray(0,4).equals(Buffer.from('RIFF'))&&buffer.subarray(8,12).equals(Buffer.from('WEBP'))) return 'image/webp';
  return null;
}
function extension(type: string) { return type==='application/pdf'?'pdf':type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp'; }
export async function uploadCourseAsset(ctx: Context) {
  const user=await requireAdmin(ctx); if(!ctx.request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new ApiError(415,'invalid_content_type');
  const raw=await bytes(ctx.request,101*1024*1024); const form=await new Response(new Uint8Array(raw),{headers:{'Content-Type':ctx.request.headers.get('content-type')!}}).formData();
  const slot=form.get('slot'),file=form.get('file'); if(typeof slot!=='string'||!slots.has(slot as Slot)||!(file instanceof File)) throw new ApiError(400,'invalid_field','file');
  const selected=slot as Slot,buffer=Buffer.from(await file.arrayBuffer()),type=fileMime(file,buffer),max=selected==='thumbnail'?10*1024*1024:selected==='detailImage'?20*1024*1024:100*1024*1024;
  if(!type||buffer.length===0||buffer.length>max||(selected==='material'?type!=='application/pdf':!imageTypes.has(type))) throw new ApiError(400,'invalid_file');
  let width:number|null=null,height:number|null=null;
  if(type!=='application/pdf') { try { const metadata=await sharp(buffer,{limitInputPixels:40_000_000}).metadata(); if(!metadata.width||!metadata.height) throw new Error(); width=metadata.width;height=metadata.height; } catch { throw new ApiError(400,'invalid_file'); } }
  const checksum=createHash('sha256').update(buffer).digest('hex');
  if(selected==='material') {
    const existing=await db().from('admin_course_assets').select('id,owner_id,slot,path,name,size_bytes,checksum,content_type,width,height').eq('owner_id',user.id).eq('slot','material').eq('checksum',checksum).maybeSingle();
    manageError(existing.error); if(existing.data) return {asset:courseAsset(existing.data as AssetRow)};
  }
  const path=user.id+'/'+randomUUID()+'.'+extension(type); const upload=await db().storage.from('admin-course-assets').upload(path,buffer,{contentType:type,upsert:false}); manageError(upload.error);
  const inserted=await db().from('admin_course_assets').insert({owner_id:user.id,slot:selected,path,name:file.name.slice(0,255)||'upload.'+extension(type),size_bytes:buffer.length,checksum,content_type:type,width,height}).select('id,owner_id,slot,path,name,size_bytes,checksum,content_type,width,height').single();
  if(inserted.error) {
    await db().storage.from('admin-course-assets').remove([path]);
    if(selected==='material'&&inserted.error.code==='23505') {
      const existing=await db().from('admin_course_assets').select('id,owner_id,slot,path,name,size_bytes,checksum,content_type,width,height').eq('owner_id',user.id).eq('slot','material').eq('checksum',checksum).maybeSingle();
      manageError(existing.error); if(existing.data) return {asset:courseAsset(existing.data as AssetRow)};
    }
    manageError(inserted.error);
  }
  return {asset:courseAsset(inserted.data as AssetRow)};
}
export async function courseAssetBytes(ctx: Context) {
  await requireAdmin(ctx); const user=await ctx.user(),id=ctx.params.id; if(!uuid.test(id)) throw new ApiError(400,'invalid_field','id');
  const asset=await db().from('admin_course_assets').select('id,owner_id,path,name,content_type,size_bytes').eq('id',id).maybeSingle(); manageError(asset.error); if(!asset.data) throw new ApiError(404,'not_found');
  if(asset.data.owner_id!==user.id) { const linked=await db().from('product_assets').select('product_id,products!inner(selling)').eq('asset_id',id).eq('products.selling',true).limit(1); manageError(linked.error); if(!linked.data?.length) throw new ApiError(404,'not_found'); }
  const object=await db().storage.from('admin-course-assets').download(asset.data.path); manageError(object.error);
  return new NextResponse(object.data,{headers:{'Content-Type':asset.data.content_type,'Content-Length':String(asset.data.size_bytes),'Content-Disposition':'inline; filename="'+asset.data.name.replaceAll('"','')+'"'}});
}
export async function publicCourseAsset(ctx: Context) {
  const id=ctx.params.id; if(!uuid.test(id)) throw new ApiError(404,'not_found');
  const asset=await db().from('admin_course_assets').select('path,name,content_type,size_bytes').eq('id',id).maybeSingle(); manageError(asset.error); if(!asset.data) throw new ApiError(404,'not_found');
  const published=await db().from('product_assets').select('product_id,products!inner(selling)').eq('asset_id',id).in('role',['thumbnail','detailImage']).eq('products.selling',true).limit(1); manageError(published.error); if(!published.data?.length) throw new ApiError(404,'not_found');
  const object=await db().storage.from('admin-course-assets').download(asset.data.path); manageError(object.error);
  return new NextResponse(object.data,{headers:{'Content-Type':asset.data.content_type,'Content-Length':String(asset.data.size_bytes),'Cache-Control':'public, max-age=300'}});
}

export async function verifyCourseVideo(ctx: Context) {
  const user=await requireAdmin(ctx),input=await json(ctx.request,16*1024); if(typeof input.url!=='string'||input.url.length>2048) throw new ApiError(400,'invalid_video_url'); const parsed=parseVimeoUrl(input.url); if(!parsed) throw new ApiError(400,'invalid_video_url'); const endpoint=new URL('https://vimeo.com/api/oembed.json'); endpoint.searchParams.set('url',parsed.url);
  let response: Response; try { response=await fetch(endpoint,{signal:AbortSignal.timeout(10_000)}); } catch { throw new ApiError(503,'video_unavailable'); }
  if(!response.ok) throw new ApiError(response.status===404?404:response.status===401||response.status===403?403:503,response.status===404?'video_not_found':response.status===401||response.status===403?'video_restricted':'video_unavailable');
  let payload: {html?:unknown;duration?:unknown}; try { payload=await response.json(); } catch { throw new ApiError(503,'video_unavailable'); }
  const source=typeof payload.html==='string'?payload.html.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;','&'):undefined; let embed: URL;
  try { embed=new URL(source??''); } catch { throw new ApiError(403,'video_restricted'); }
  const duration=payload.duration; if(typeof duration!=='number'||!Number.isSafeInteger(duration)||duration<=0) throw new ApiError(409,'video_processing');
  if(embed.protocol!=='https:'||embed.hostname!=='player.vimeo.com'||!embed.pathname.match(new RegExp('^/video/'+parsed.id+'/?$'))) throw new ApiError(403,'video_restricted');
  const video:Video={url:parsed.url,embedUrl:parsed.embedUrl,durationSeconds:duration}; const result=await db().from('verified_videos').upsert({owner_id:user.id,url:video.url,embed_url:video.embedUrl,duration_seconds:video.durationSeconds},{onConflict:'owner_id,url'}); manageError(result.error); return {video};
}
export async function publishCourseDraft(ctx: Context) {
  const user=await requireAdmin(ctx),input=await json(ctx.request),id=ctx.params.id,revision=input.revision; if(!uuid.test(id)||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1) throw new ApiError(400,'invalid_field','revision');
  const saved=await db().from('course_drafts').select('document').eq('id',id).eq('owner_id',user.id).maybeSingle();
  manageError(saved.error); if (!saved.data) throw new ApiError(404,'not_found');
  const document=plainObject(saved.data.document);
  const publish=document.productOrder === undefined ? 'publish_course_draft' : 'publish_ordered_course_draft';
  const result=await db().rpc(publish,{p_owner:user.id,p_draft:id,p_revision:revision}); manageError(result.error); const row=Array.isArray(result.data)?result.data[0]:result.data;
  if(!row?.course_id||!row?.slug) throw new ApiError(500,'database_error'); return {courseId:row.course_id,slug:row.slug};
}

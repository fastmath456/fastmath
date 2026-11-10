import { adminDb, ApiError, body, dbError, integer, requireAdmin, string, date, type Context } from './http';
import { profile } from './profile';
import { parseSort, type Product, type Chapter } from '../features/catalog';
const columns='id,slug,kind,title,tags,price,base_price,image,published_at,selling';
const detailColumns='id,slug,kind,title,tags,price,base_price,image,published_at,selling,license_days';
type Row={id:string;slug:string;kind:'vod'|'pdf';title:string;tags:string[];price:number;base_price:number|null;image:string;published_at:string;selling:boolean};
type DetailRow=Row&{license_days:number|null};
type ProductAssetRow={role:'thumbnail'|'detailImage'|'material';position:number;asset_id:string;admin_course_assets:{id:string;name:string;size_bytes:number;content_type:string;width:number|null;height:number|null}|{id:string;name:string;size_bytes:number;content_type:string;width:number|null;height:number|null}[]|null};
const product=(p:Row):Product=>({id:p.id,slug:p.slug,kind:p.kind,title:p.title,tags:p.tags,price:p.price,...(p.base_price?{basePrice:p.base_price}:{}),image:p.image,publishedOrder:-new Date(p.published_at).getTime()});
export async function products(ctx: Context) {
  const sortValues = ctx.request.nextUrl.searchParams.getAll('sort');
  const sort = parseSort(sortValues.length === 1 ? sortValues[0] : undefined);
  // shortcut: hide the production QA item until catalog visibility is managed explicitly.
  let query = ctx.db.from('products').select(columns).neq('id','course-9664ad3b74f94f7a834a53cff0d16188');
  if (sort === 'default') {
    query = query.order('display_order', { ascending: true, nullsFirst: false });
  } else if (sort === 'price-asc' || sort === 'price-desc') {
    query = query.order('price', { ascending: sort === 'price-asc' });
  }
  const { data, error } = await query.order('published_at', { ascending: false }).order('id').limit(1000);
  dbError(error);
  const user=await ctx.optionalUser(),current=user?await profile(ctx):null;
  return {items:(data as unknown as Row[]).map(product),count:data!.length,...(current?{profile:{name:current.name,image:current.avatar}}:{})};
}

export async function checkoutProductReturnHref(productId: unknown, kind: 'vod' | 'pdf') {
  if (typeof productId !== 'string' || !productId || productId.length > 100) return null;
  try {
    const { data, error } = await adminDb().from('products').select('slug').eq('id', productId).eq('kind', kind).maybeSingle();
    dbError(error);
    const slug = data?.slug;
    if (!slug || slug === '.' || slug === '..') return null;
    return `/${kind === 'vod' ? 'courses' : 'books'}/${encodeURIComponent(slug)}`;
  } catch (error) {
    console.error('Checkout return lookup failed:', error instanceof ApiError ? error.code : error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export async function productDetail(ctx: Context) {
  const db=adminDb(); const {data,error}=await db.from('products').select(detailColumns).eq('slug',ctx.params.slug).maybeSingle(); dbError(error); if(!data) throw new ApiError(404,'not_found');
  const user=await ctx.optionalUser();
  const [chapters,lessons,reviews,ownership,role,account,assets]=await Promise.all([
    db.from('chapters').select('id,title,position').eq('product_id',data.id).eq('active',true).order('position'),
    db.from('lessons').select('id,title,chapter_id,duration_seconds,preview,position').eq('product_id',data.id).eq('active',true).order('position'),
    db.from('reviews').select('body,author,created_at,rating').eq('product_id',data.id).order('created_at',{ascending:false}),
    user?db.from('entitlements').select('id').eq('user_id',user.id).eq('product_id',data.id).eq('revoked',false).limit(1):Promise.resolve({data:[],error:null}),
    user?db.from('user_roles').select('role').eq('user_id',user.id).maybeSingle():Promise.resolve({data:null,error:null}),
    user?profile(ctx):Promise.resolve(null),
    db.from('product_assets').select('role,position,asset_id,admin_course_assets!inner(id,name,size_bytes,content_type,width,height)').eq('product_id',data.id).order('position'),
  ]); [chapters,lessons,reviews,ownership,role].forEach(r=>dbError(r.error));
  dbError(assets.error);
  const firstLesson=chapters.data!.flatMap(c=>lessons.data!.filter(l=>l.chapter_id===c.id))[0]?.id;
  const curriculum:Chapter[]=chapters.data!.map(c=>({id:c.id,title:c.title,lessons:lessons.data!.filter(l=>l.chapter_id===c.id).map(l=>({id:l.id,title:l.title,preview:l.id===firstLesson,duration:new Date(l.duration_seconds*1000).toISOString().slice(11,19)}))}));
  const productAssets=(assets.data as unknown as ProductAssetRow[]).flatMap(row=>{
    const asset=Array.isArray(row.admin_course_assets)?row.admin_course_assets[0]:row.admin_course_assets;
    return asset?[{role:row.role,id:asset.id,name:asset.name,size:asset.size_bytes,type:asset.content_type,width:asset.width,height:asset.height}]:[];
  });
  const detailAsset=productAssets.find(asset=>asset.role==='detailImage');
  const detailImage=detailAsset?{id:detailAsset.id,name:detailAsset.name,size:detailAsset.size,type:detailAsset.type,width:detailAsset.width,height:detailAsset.height,url:'/api/course-assets/'+detailAsset.id}:null;
  const materials=productAssets.filter(asset=>asset.role==='material').map(asset=>({id:asset.id,name:asset.name,size:asset.size,type:asset.type,width:asset.width,height:asset.height}));
  const licenseDays=Number.isSafeInteger(data.license_days)&&data.license_days>0?data.license_days:60;
  return {...product(data as DetailRow),chapters:curriculum,reviews:reviews.data!.map(r=>({body:r.body,author:r.author,date:date(r.created_at),rating:Number(r.rating)})),selling:data.selling,ownership:ownership.data?.length?'owned':'none',admin:role.data?.role==='admin',licenseDays,detailImage,materials,...(account?{profile:{name:account.name,image:account.avatar}}:{})};
}
export async function manageProduct(ctx: Context) {
  await requireAdmin(ctx); const input=await body(ctx.request);
  const id=string(ctx.params.id ?? input.id,'id',100),slug=string(input.slug,'slug',100);
  if(!/^[a-z0-9-]+$/.test(id)||!/^[a-z0-9-]+$/.test(slug)||!['vod','pdf'].includes(String(input.kind))||typeof input.selling!=='boolean'||!Array.isArray(input.tags)||input.tags.some(t=>typeof t!=='string'||t.length>80)) throw new ApiError(400,'invalid_field');
  const price=integer(input.price,'price'); if(price===0) throw new ApiError(400,'invalid_field','price');
  const row={id,slug,kind:input.kind as 'vod'|'pdf',title:string(input.title,'title',200),tags:input.tags as string[],price,base_price:input.basePrice===undefined?null:integer(input.basePrice,'basePrice'),image:string(input.image,'image',1000),selling:input.selling};
  if(!row.image.startsWith('/assets/') || row.image.includes('..')) throw new ApiError(400,'invalid_field','image');
  const db=adminDb(); const result=ctx.request.method==='POST'?await db.from('products').insert(row):await db.from('products').update(row).eq('id',id).select('id').single(); dbError(result.error); return {id};
}
export async function manageCurriculum(ctx:Context) {
  await requireAdmin(ctx);const input=await body(ctx.request),productId=string(ctx.params.id,'id',100),db=adminDb();
  const id=string(input.id,'id',120),title=string(input.title,'title',200),position=integer(input.position,'position',10000);
  if(ctx.params.resource==='chapters') { const result=await db.from('chapters').insert({id,title,position,product_id:productId});dbError(result.error); }
  else if(ctx.params.resource==='lessons') {
    const duration=integer(input.durationSeconds,'durationSeconds',86400);
    if(!duration||typeof input.preview!=='boolean'||input.vimeoId!==undefined && (typeof input.vimeoId!=='string'||!/^\d+$/.test(input.vimeoId))) throw new ApiError(400,'invalid_field');
    const result=await db.from('lessons').insert({id,title,position,product_id:productId,chapter_id:string(input.chapterId,'chapterId',120),duration_seconds:duration,preview:input.preview,vimeo_id:typeof input.vimeoId==='string'?input.vimeoId:null});dbError(result.error);
  } else throw new ApiError(404,'not_found');return {id};
}
export async function manageFile(ctx:Context) {
  await requireAdmin(ctx); if(ctx.params.resource!=='file') throw new ApiError(404,'not_found');
  const {bytes}=await import('./http'); const {randomUUID}=await import('node:crypto');
  const file=await bytes(ctx.request,50*1024*1024); if(!file.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new ApiError(400,'invalid_file');
  const db=adminDb(),product=await db.from('products').select('id').eq('id',ctx.params.id).maybeSingle();dbError(product.error);if(!product.data) throw new ApiError(404,'not_found');
  const path=product.data.id+'/'+randomUUID()+'.pdf'; const upload=await db.storage.from('paid-files').upload(path,file,{contentType:'application/pdf',upsert:false});dbError(upload.error);
  const saved=await db.from('products').update({pdf_path:path}).eq('id',product.data.id);dbError(saved.error);return {path};
}

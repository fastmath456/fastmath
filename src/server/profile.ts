import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { validProfileImage } from '../features/account/profile-image';
import { validBirthday } from '../features/auth/validation';
import { adminDb, ApiError, body, bytes, dbError, string, type Context } from './http';

export async function profile(ctx: Context) {
  const user = await ctx.user(), db=adminDb();
  const {data,error} = await db.from('profiles').select('name,birthday,phone,image_path,marketing,updated_at').eq('user_id',user.id).single(); dbError(error); if(!data) throw new ApiError(404,'profile_missing');
  let image = '';
  if(data.image_path) { const signed=await db.storage.from('profile-images').createSignedUrl(data.image_path,300); dbError(signed.error); image=signed.data!.signedUrl; }
  return { name:data.name,email:user.email,birthday:data.birthday.replaceAll('-',''),phone:data.phone,marketing:data.marketing,imagePath:data.image_path,revision:data.updated_at,image,avatar:image||'/assets/profile-imgRectangle2.png' };
}
export async function saveProfile(ctx: Context) {
  const user=await ctx.user(),input=await body(ctx.request),db=adminDb();
  const revision=string(input.revision,'revision',100); if(!Number.isFinite(Date.parse(revision))) throw new ApiError(400,'invalid_field','revision');
  const name=string(input.name,'name',80).trim(),birthday=string(input.birthday,'birthday',8),phone=string(input.phone,'phone',30).replace(/[-\s]/g,'');
  if(!name || !validBirthday(birthday)) throw new ApiError(400,'invalid_field','birthday');
  if(!/^\d{11}$/.test(phone)) throw new ApiError(400,'invalid_field','phone');
  if(typeof input.marketing!=='boolean') throw new ApiError(400,'invalid_field','marketing');
  const current=await db.from('profiles').select('image_path').eq('user_id',user.id).single(); dbError(current.error);
  const image=input.imagePath===undefined ? current.data!.image_path : input.imagePath;
  if(typeof image!=='string' || (image && (!image.startsWith(user.id+'/') || image.includes('..')))) throw new ApiError(400,'invalid_field','image');
  if(image) { const folder=image.slice(0,image.lastIndexOf('/')),filename=image.slice(image.lastIndexOf('/')+1); const found=await db.storage.from('profile-images').list(folder,{search:filename}); dbError(found.error); if(!found.data?.some(f=>f.name===filename)) throw new ApiError(400,'invalid_field','image'); }
  const result=await db.rpc('save_profile',{p_user:user.id,p_name:name,p_birthday:birthday.slice(0,4)+'-'+birthday.slice(4,6)+'-'+birthday.slice(6),p_phone:phone,p_marketing:input.marketing,p_image:image,p_revision:revision}); dbError(result.error);
  // Keep old objects until a retention/cleanup policy is chosen; failure never deletes the current image.
  return profile(ctx);
}
export async function uploadProfile(ctx: Context) {
  const user=await ctx.user();
  if(!ctx.request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new ApiError(415,'invalid_content_type');
  const payload=await bytes(ctx.request,6*1024*1024);
  const form=await new Response(new Uint8Array(payload),{headers:{'Content-Type':ctx.request.headers.get('content-type')!}}).formData();
  const file=form.get('file'); if(!(file instanceof File)) throw new ApiError(400,'invalid_field','image');
  const buffer=Buffer.from(await file.arrayBuffer()); if(!validProfileImage(file,buffer.subarray(0,12))) throw new ApiError(400,'invalid_field','image');
  let image: Buffer;
  try { image=await sharp(buffer,{limitInputPixels:40_000_000}).rotate().webp().toBuffer(); } catch {throw new ApiError(400,'invalid_field','image');}
  const path=user.id+'/'+randomUUID()+'.webp'; const {error}=await adminDb().storage.from('profile-images').upload(path,image,{contentType:'image/webp',upsert:false}); dbError(error);
  return {path};
}

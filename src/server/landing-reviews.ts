import 'server-only';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ReviewImage, SourceReview } from '@/features/landing';
import type { Json } from './database.types';
import { adminDb, ApiError, bytes, dbError, requireAdmin, string, type Context } from './http';

const bucket = 'landing-review-images';
type ReviewRow = { id: string; author: string; body: string; image: Json };
function review(row: ReviewRow): SourceReview {
  return { id: row.id, author: row.author, text: row.body, images: [row.image as ReviewImage] };
}

export async function publicLandingReviews(ctx: Context) {
  const db = adminDb();
  const result = await db.from('landing_reviews').select('id,author,body,image').order('position');
  dbError(result.error);
  const user = await ctx.optionalUser();
  let admin = false;
  if (user) {
    const role = await db.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    dbError(role.error); admin = role.data?.role === 'admin';
  }
  return { items: result.data!.map(review), admin };
}

export async function saveLandingReview(ctx: Context) {
  await requireAdmin(ctx);
  const db = adminDb(), id = ctx.params.id;
  if (id && !/^(figma-480-\d{4}|[0-9a-f-]{36})$/.test(id)) throw new ApiError(400, 'invalid_field', 'id');
  const current = id ? await db.from('landing_reviews').select('image,image_path').eq('id', id).maybeSingle() : null;
  if (current) { dbError(current.error); if (!current.data) throw new ApiError(404, 'not_found'); }
  if (!ctx.request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new ApiError(415, 'invalid_content_type');
  let form: FormData;
  try {
    const buffer = await bytes(ctx.request, 20 * 1024 * 1024 + 64 * 1024);
    form = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': ctx.request.headers.get('content-type')! }, body: new Uint8Array(buffer) }).formData();
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'invalid_body'); }
  const author = string(form.get('author'), 'author', 300), text = string(form.get('text'), 'text', 300);
  if (!author.trim() || !text.trim()) throw new ApiError(400, 'invalid_field');
  const file = form.get('image');
  let image = current?.data?.image, path = current?.data?.image_path ?? null;
  let uploaded: string | null = null;
  try {
    if (file !== null) {
      if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024) throw new ApiError(400, 'invalid_field', 'image');
      let normalized: Buffer;
      try {
        const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
        normalized = data;
        path = randomUUID() + '.webp';
        image = { src: db.storage.from(bucket).getPublicUrl(path).data.publicUrl, width: info.width, height: info.height };
      } catch { throw new ApiError(400, 'invalid_field', 'image'); }
      const upload = await db.storage.from(bucket).upload(path!, normalized, { contentType: 'image/webp', upsert: false });
      if (upload.error) throw new ApiError(503, 'storage_unavailable');
      uploaded = path;
    }
    if (!image) throw new ApiError(400, 'invalid_field', 'image');
    const values = id && !uploaded ? { author, body: text } : { author, body: text, image, image_path: path };
    const saved = id
      ? await db.from('landing_reviews').update(values).eq('id', id).select('id,author,body,image').single()
      : await db.from('landing_reviews').insert({ author, body: text, image, image_path: path }).select('id,author,body,image').single();
    dbError(saved.error);
    const replaced = uploaded !== null;
    uploaded = null;
    if (replaced && current?.data?.image_path) await db.storage.from(bucket).remove([current.data.image_path]).catch(() => {});
    return { review: review(saved.data!) };
  } catch (error) {
    if (uploaded) await db.storage.from(bucket).remove([uploaded]);
    throw error;
  }
}

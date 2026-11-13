import 'server-only';
import type { Database } from './database.types';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public field?: string) { super(code); }
}
export function setting(name: string) {
  const value = process.env[name];
  if (!value) throw new ApiError(503, 'configuration_missing');
  return value;
}
export function adminDb() {
  return createClient<Database>(setting('SUPABASE_URL'), setting('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}
export function dbError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.message === 'payment_outcome_unknown') throw new ApiError(503, 'payment_outcome_unknown');
  const code = ['not_found','no_access','not_selling','already_owned','key_conflict','payment_conflict','payment_mismatch','sequence_conflict','invalid_position','quote_expired','quote_changed','refund_conflict','refund_mismatch','refund_expired','refund_downloaded','file_missing','profile_missing','profile_conflict'].find(code => error.message.includes(code));
  if(!code && error.code==='23505') throw new ApiError(409,'conflict');
  if(!code && ['23503','23514','23502'].includes(error.code??'')) throw new ApiError(400,'invalid_field');
  throw new ApiError(code === 'not_found' ? 404 : code === 'no_access' ? 403 : code ? 409 : 500, code ?? 'database_error');
}
export type Context = {
  request: NextRequest; params: Record<string,string>; db: ReturnType<typeof createServerClient<Database>>;
  user: () => Promise<User>; optionalUser: () => Promise<User | null>;
};
export function api(handler: (ctx: Context) => Promise<unknown>, allowExternal = false) {
  return async (request: NextRequest, route: { params: Promise<Record<string,string>> }) => {
    const cookies: { name: string; value: string; options: CookieOptions }[] = [];
    const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' });
    let response: NextResponse;
    // Read the request boundary outside catch so Next.js prerender control errors propagate.
    const jar = new Map(request.cookies.getAll().map(c => [c.name,c.value]));
    try {
      if (!['GET','HEAD'].includes(request.method) && !allowExternal && request.headers.get('origin') !== setting('APP_ORIGIN')) throw new ApiError(403,'invalid_origin');
      const db = createServerClient<Database>(setting('SUPABASE_URL'),setting('SUPABASE_PUBLISHABLE_KEY'), {
        cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && setting('APP_ORIGIN').startsWith('https://') },
        cookies: { getAll: () => [...jar].map(([name,value]) => ({name,value})), setAll: (items, cacheHeaders) => {
          items.forEach(c => { jar.set(c.name,c.value); cookies.push(c); });
          Object.entries(cacheHeaders).forEach(([key,value]) => headers.set(key,value));
        } },
      });
      let identity: Promise<User | null> | undefined, counted=false;
      const optionalUser = () => identity ??= db.auth.getUser().then(async ({data,error}) => {
        if (error && (error.status && error.status >= 500 || !['AuthSessionMissingError','AuthApiError'].includes(error.name))) throw new ApiError(503,'auth_unavailable');
        if(data.user) {
          const claims=await db.auth.getClaims(); const session=claims.data?.claims.session_id;
          if(typeof session!=='string') return null;
          const active=await db.rpc('session_active',{p_session:session}); dbError(active.error);
          if(!active.data) return null;
        }
        return data.user;
      });
      const ctx: Context = { request,params: await route.params,db,optionalUser,user: async () => {
        const user = await optionalUser(); if (!user) throw new ApiError(401,'unauthorized');
        if(!counted && !['GET','HEAD'].includes(request.method)) { counted=true; await limit('mutation:'+user.id,100,60); } return user;
      } };
      const data = await handler(ctx);
      response = data instanceof NextResponse ? data : NextResponse.json(data ?? {ok:true});
    } catch (error) {
      const known = error instanceof ApiError;
      response = NextResponse.json({ error: { code: known ? error.code : 'internal_error', ...(known && error.field ? {field:error.field} : {}) } },{ status: known ? error.status : 500 });
      if (!known) console.error('API failed:', error instanceof Error ? error.name : 'unknown');
    }
    cookies.forEach(c => response.cookies.set(c.name,c.value,c.options));
    headers.forEach((value,key) => response.headers.set(key,value));
    return response;
  };
}
export async function bytes(request: Request, limit = 16384) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400,'invalid_body');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength; if (size > limit) { await reader.cancel(); throw new ApiError(413,'body_too_large'); } chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function body(request: Request): Promise<Record<string,unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ApiError(415,'invalid_content_type');
  try { const value: unknown = JSON.parse((await bytes(request)).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string,unknown>;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400,'invalid_body'); }
}
export function string(value: unknown, field: string, max = 200) {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new ApiError(400,'invalid_field',field); return value;
}
export function integer(value: unknown, field: string, max = 2147483647) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new ApiError(400,'invalid_field',field); return value;
}
export function uuid(value: unknown, field = 'id') {
  const id = string(value,field,36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400,'invalid_field',field); return id;
}
export async function limit(key: string, count = 20, seconds = 60) {
  const hash = createHash('sha256').update(key).digest('hex');
  const {data,error} = await adminDb().rpc('consume_limit',{p_key:hash,p_limit:count,p_seconds:seconds}); dbError(error);
  if (!data) throw new ApiError(429,'rate_limited');
}
export async function requireAdmin(ctx: Context) {
  const user = await ctx.user(); const {data,error} = await adminDb().from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
  dbError(error); if (data?.role !== 'admin') throw new ApiError(403,'forbidden'); return user;
}
export function date(value: string | null) { return value ? new Date(value).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).replaceAll('-','.') : ''; }

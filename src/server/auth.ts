import { NextResponse } from 'next/server';
import { validateField, type AuthValues, type AuthField } from '../features/auth';
import { ApiError, body, string, limit, setting, type Context } from './http';

export async function authenticate(ctx: Context) {
  const action = ctx.params.action;
  if (!['login','signup','logout','recovery','reset'].includes(action)) throw new ApiError(404,'not_found');
  if (action === 'logout') { await ctx.user(); const {error} = await ctx.db.auth.signOut(); if(error) throw new ApiError(503,'auth_unavailable'); return {ok:true}; }
  const input = await body(ctx.request);
  const fields: AuthField[] = action === 'signup' ? ['email','password','confirmation','name','birthday','phone'] : action === 'login' ? ['email','password'] : action === 'reset' ? ['password','confirmation'] : ['email','name','phone'];
  const values: AuthValues = {email:'',password:'',confirmation:'',name:'',birthday:'',phone:''};
  for (const field of fields) { values[field] = string(input[field],field,field==='password'||field==='confirmation'?128:200); if (validateField(field,values)) throw new ApiError(400,'invalid_field',field); }
  if (action !== 'recovery' && values.password.length<8) throw new ApiError(400,'invalid_field','password');
  values.email=values.email.trim().toLowerCase(); values.name=values.name.trim(); values.phone=values.phone.replace(/[-\s]/g,'');
  await limit('auth:'+action+':'+(action==='reset' ? (await ctx.user()).id : values.email),5,300);
  if (action === 'login') {
    const {error} = await ctx.db.auth.signInWithPassword({email:values.email,password:values.password});
    if(error) throw new ApiError(401,'invalid_credentials','password'); return {ok:true};
  }
  if (action === 'signup') {
    if (!Array.isArray(input.agreements) || input.agreements.length!==4 || input.agreements.some(v=>typeof v!=='boolean') || !input.agreements.slice(0,3).every(Boolean)) throw new ApiError(400,'agreements_required');
    const {data,error} = await ctx.db.auth.signUp({email:values.email,password:values.password, options:{emailRedirectTo:setting('APP_ORIGIN')+'/api/auth/callback',data:{agreements:input.agreements,name:values.name,birthday:values.birthday.slice(0,4)+'-'+values.birthday.slice(4,6)+'-'+values.birthday.slice(6),phone:values.phone,marketing:input.agreements[3]}}});
    if(error || !data.user || data.user.identities?.length===0) throw new ApiError(400,'signup_failed'); return {ok:true,confirmed:Boolean(data.session)};
  }
  if (action === 'recovery') {
    // The response deliberately does not disclose membership; name/phone are not proof of ownership.
    const {error} = await ctx.db.auth.resetPasswordForEmail(values.email,{redirectTo:setting('APP_ORIGIN')+'/api/auth/callback?flow=recovery'});
    if(error && error.status !== 429) throw new ApiError(503,'auth_unavailable');
    if(error?.status===429) throw new ApiError(429,'rate_limited'); return {ok:true};
  }
  await ctx.user(); const {error} = await ctx.db.auth.updateUser({password:values.password});
  if(error) throw new ApiError(400,'password_update_failed','password'); return {ok:true};
}
export async function authCallback(ctx: Context) {
  const code = string(ctx.request.nextUrl.searchParams.get('code'),'code',2000);
  const {error} = await ctx.db.auth.exchangeCodeForSession(code);
  if(error) throw new ApiError(400,'invalid_auth_link');
  return NextResponse.redirect(setting('APP_ORIGIN')+(ctx.request.nextUrl.searchParams.get('flow')==='recovery'?'/reset-password/new':'/courses'));
}

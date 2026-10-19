// Vimeo verification is isolated from the live provider with a fetch stub.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';

const { loadEnvConfig }=nextEnv;
loadEnvConfig(process.cwd());
assert.equal(process.env.SUPABASE_URL,'http://127.0.0.1:54331','tests require isolated local Supabase');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const metadata={name:'영상 검증',birthday:'2014-02-22',phone:'01032428118',marketing:false,agreements:[true,true,true,false]};
let user,code,temp;

function compile(source,destination) {
  writeFileSync(destination,ts.transpileModule(readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
}
function context(url) {
  return {user:async()=>user,request:new NextRequest('http://local.test/api/admin/courses/videos/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})};
}
function requestUrl(request) { return new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url); }
async function rejects(fetcher,expected) {
  const original=globalThis.fetch; globalThis.fetch=async(...args)=>{
    const request=args[0],url=requestUrl(request);
    return url.origin==='https://vimeo.com' ? fetcher(...args) : original(...args);
  };
  try { await assert.rejects(code.verifyCourseVideo(context('https://vimeo.com/123456/unlistedhash')),error=>error.code===expected); }
  finally { globalThis.fetch=original; }
}

before(async()=>{
  const created=await db.auth.admin.createUser({email:`manage-video-${Date.now()}@example.com`,password:'test-password-2026',email_confirm:true,user_metadata:metadata});
  assert.equal(created.error,null,JSON.stringify(created.error)); user=created.data.user;
  assert.equal((await db.from('user_roles').insert({user_id:user.id,role:'admin'})).error,null);
  temp=mkdtempSync(join(tmpdir(),'quick-math-manage-video-'));
  symlinkSync(join(process.cwd(),'node_modules'),join(temp,'node_modules'),'dir');
  mkdirSync(join(temp,'server'),{recursive:true}); mkdirSync(join(temp,'features','manage'),{recursive:true});
  compile('src/server/http.ts',join(temp,'server','http.js'));
  compile('src/server/manage.ts',join(temp,'server','manage.js'));
  compile('src/features/manage/validation.ts',join(temp,'features','manage','validation.js'));
  code=await import(pathToFileURL(join(temp,'server','manage.js')).href);
});

test('verification keeps an unlisted hash from a successful trusted Vimeo response',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(...args)=>{
    const request=args[0];
    const url=requestUrl(request);
    if(url.origin!=='https://vimeo.com') return original(...args);
    assert.equal(url.origin,'https://vimeo.com'); assert.equal(url.pathname,'/api/oembed.json');
    assert.equal(url.searchParams.get('url'),'https://vimeo.com/123456/unlistedhash');
    return Response.json({html:'<iframe src="https://player.vimeo.com/video/123456?h=unlistedhash"></iframe>',duration:120});
  };
  try {
    const result=await code.verifyCourseVideo(context('https://vimeo.com/123456/unlistedhash'));
    assert.deepEqual(result.video,{url:'https://vimeo.com/123456/unlistedhash',embedUrl:'https://player.vimeo.com/video/123456?h=unlistedhash&autoplay=0',durationSeconds:120});
  } finally { globalThis.fetch=original; }
});

test('verification maps Vimeo provider failure states without a live request',async()=>{
  await rejects(async()=>new Response('',{status:404}),'video_not_found');
  await rejects(async()=>new Response('',{status:403}),'video_restricted');
  await rejects(async()=>{ throw new TypeError('timeout'); },'video_unavailable');
  await rejects(async()=>Response.json({html:'<iframe src="https://player.vimeo.com/video/123456?h=unlistedhash"></iframe>',duration:0}),'video_processing');
  await rejects(async()=>Response.json({html:'<iframe src="https://other.invalid/video/123456"></iframe>',duration:120}),'video_restricted');
});

after(async()=>{
  if(user) {
    await db.from('verified_videos').delete().eq('owner_id',user.id);
    await db.from('user_roles').delete().eq('user_id',user.id);
    await db.auth.admin.deleteUser(user.id);
  }
  if(temp) rmSync(temp,{recursive:true});
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const exports = {};
runInNewContext(ts.transpileModule(readFileSync('src/server/zip.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,Buffer,ReadableStream});
const { zipStream } = exports;
const source = bytes => new ReadableStream({start(controller) { controller.enqueue(bytes.subarray(0,3)); controller.enqueue(bytes.subarray(3)); controller.close(); }});

test('streamed ZIP preserves Korean names and PDF bytes in an independent ZIP reader',async()=>{
  const files=[{name:'1-개념.pdf',bytes:Buffer.from('%PDF-1.7\n첫 번째 교재')},{name:'2-문제.pdf',bytes:Buffer.from('%PDF-1.7\n두 번째 교재')}];
  const archive=Buffer.from(await new Response(zipStream(files.map(file=>({name:file.name,size:file.bytes.length,open:async()=>source(file.bytes)})))).arrayBuffer());
  const result=execFileSync('python3',['-c','import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))'],{input:archive,encoding:'utf8'});
  assert.deepEqual(JSON.parse(result),Object.fromEntries(files.map(file=>[file.name,file.bytes.toString()])));
});

test('incomplete source bytes and source failures cannot silently produce a valid archive',async()=>{
  for(const open of [async()=>source(Buffer.from('short')),async()=>{throw new Error('Storage unavailable');}]) {
    await assert.rejects(new Response(zipStream([{name:'a.pdf',size:10,open}])).arrayBuffer());
  }
  assert.throws(()=>zipStream([{name:'huge.pdf',size:0xffffffff,open:async()=>source(Buffer.alloc(0))}]),/ZIP64/);
});

test('cancelling an archive closes the currently open source',async()=>{
  let cancelled=false;
  const reader=zipStream([{name:'a.pdf',size:2,open:async()=>new ReadableStream({pull(controller){controller.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}})}]).getReader();
  await reader.read(); await reader.read(); await reader.read(); await reader.cancel();
  assert.equal(cancelled,true);
});

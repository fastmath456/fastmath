import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const { unstable_doesMiddlewareMatch } = createRequire(import.meta.url)('next/experimental/testing/server');

const source = ts.transpileModule(readFileSync('src/proxy.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(user) {
  const exports = {};
  runInNewContext(source, {
    exports, URL,
    require(name) {
      if (name === 'next/server') return { NextResponse: {
        redirect: url => ({ redirect: url.href }),
        next: () => ({ next: true }),
      } };
      assert.equal(name, '@/server');
      return { api: handler => request => handler({ request, optionalUser: async () => user }) };
    },
  });
  return exports;
}

test('only login, signup and password recovery are protected', () => {
  const { config } = setup(null);
  assert.deepEqual(Array.from(config.matcher), ['/login', '/signup', '/reset-password']);
  for (const url of ['/login', '/signup', '/reset-password']) assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true);
  for (const url of ['/reset-password/new', '/signup/complete', '/']) assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false);
});

test('logged-in users are redirected to the home page', async () => {
  const { proxy } = setup({ id: 'user' });
  for (const path of ['/login', '/signup', '/reset-password']) {
    assert.equal((await proxy({ url: `https://example.com${path}` })).redirect, 'https://example.com/');
  }
});

test('logged-out users can visit the pages', async () => {
  const { proxy } = setup(null);
  assert.equal((await proxy({ url: 'https://example.com/login' })).next, true);
});

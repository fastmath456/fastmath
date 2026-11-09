import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

function load(path, imports = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, { exports, require: name => imports[name] });
  return exports;
}

const { parseSort } = load('../src/features/catalog/api.ts');
const { products } = load('../src/server/catalog.ts', {
  '../features/catalog': { parseSort },
  './http': { dbError: error => assert.equal(error, null) },
  './profile': {},
});

test('the list starts in default order and accepts all four sort values', () => {
  for (const invalid of [undefined, '', 'unknown']) assert.equal(parseSort(invalid), 'default');
  for (const sort of ['default', 'latest', 'price-asc', 'price-desc']) assert.equal(parseSort(sort), sort);
});

test('the catalog query uses the selected primary order and stable tie breakers', async () => {
  const newest = 'published_at.desc,id.asc';
  const defaultOrder = `display_order.asc.nullslast,${newest}`;
  const cases = [
    ['', defaultOrder],
    ['?sort=default', defaultOrder],
    ['?sort=unknown', defaultOrder],
    ['?sort=latest&sort=price-asc', defaultOrder],
    ['?sort=latest', newest],
    ['?sort=price-asc', `price.asc,${newest}`],
    ['?sort=price-desc', `price.desc,${newest}`],
  ];
  for (const [params, expected] of cases) {
    let requestedOrder;
    const db = createClient('http://127.0.0.1:54331', 'test-key', {
      auth: { persistSession: false },
      global: { fetch: async url => {
        requestedOrder = new URL(url).searchParams.get('order');
        return Response.json([]);
      } },
    });
    const request = { nextUrl: new URL('http://localhost/api/products' + params) };
    await products({ db, request, optionalUser: async () => null });
    assert.equal(requestedOrder, expected, params);
  }
});

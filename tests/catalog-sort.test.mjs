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
function loadCatalog(adminDb) {
  return load('../src/server/catalog.ts', {
    '../features/catalog': { parseSort },
    './http': { adminDb, dbError: error => assert.equal(error, null) },
    './profile': {},
  });
}
const { products } = loadCatalog();

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

test('catalog tags follow the product type and attached materials on list and detail', async () => {
  const rows = [
    { id: 'course', kind: 'vod', tags: ['#교재', '#수학1'], pdf_path: '', product_assets: [], expected: ['#강의', '#수학1'] },
    { id: 'attached', kind: 'vod', tags: ['#강의', '#확통', '#강의'], pdf_path: null, product_assets: [{ role: 'material' }], expected: ['#강의', '#교재', '#확통'] },
    { id: 'legacy', kind: 'vod', tags: [], pdf_path: 'private/legacy.pdf', product_assets: [], expected: ['#강의', '#교재'] },
    { id: 'ebook', kind: 'pdf', tags: ['#강의', '#미적분', '#교재'], pdf_path: null, product_assets: [], expected: ['#교재', '#미적분'] },
  ].map(row => ({ ...row, slug: row.id, title: row.id, price: 1000, base_price: null, image: '/assets/cover.png', published_at: '2026-10-08T00:00:00Z', selling: true, license_days: 60 }));
  const makeDb = fetch => createClient('http://127.0.0.1:54331', 'test-key', {
    auth: { persistSession: false }, global: { fetch },
  });
  const db = makeDb(async url => {
    const select = new URL(url).searchParams.get('select');
    assert.doesNotMatch(select, /pdf_path|product_assets/);
    const fields = select.split(',');
    return Response.json(rows.map(row => Object.fromEntries(fields.map(field => [field, row[field]]))));
  });
  const admin = makeDb(async url => {
    const { pathname, searchParams } = new URL(url);
    switch (pathname.split('/').at(-1)) {
      case 'products': {
        const slug = searchParams.get('slug');
        if (slug) return Response.json(rows.filter(row => slug === 'eq.' + row.slug));
        assert.equal(searchParams.get('id'), 'in.(course,attached,legacy)');
        assert.equal(searchParams.get('product_assets.role'), 'eq.material');
        assert.equal(searchParams.get('product_assets.limit'), '1');
        return Response.json(rows.filter(row => row.kind === 'vod').map(({ id, pdf_path, product_assets }) => ({ id, pdf_path, product_assets })));
      }
      case 'product_assets':
        return Response.json(searchParams.get('product_id') === 'eq.attached' ? [{
          role: 'material', admin_course_assets: { id: 'material', name: '교재.pdf', size_bytes: 100, content_type: 'application/pdf' },
        }] : []);
      case 'chapters':
      case 'lessons':
      case 'reviews':
        return Response.json([]);
      default:
        throw new Error('Unexpected request ' + pathname);
    }
  });
  const catalog = loadCatalog(() => admin);
  const ctx = { db, request: { nextUrl: new URL('http://localhost/api/products') }, optionalUser: async () => null };
  const list = await catalog.products(ctx);
  for (const [index, row] of rows.entries()) {
    const detail = await catalog.productDetail({ ...ctx, params: { slug: row.slug } });
    for (const product of [list.items[index], detail]) {
      assert.deepEqual(Array.from(product.tags), row.expected);
      assert.equal('pdf_path' in product, false);
    }
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import sharp from 'sharp';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const seedExports = {};
runInNewContext(compile('src/features/landing/reviews.ts'), { exports: seedExports });
const seeds = seedExports.landingReviews;

class ApiError extends Error {
  constructor(status, code, field) { super(code); Object.assign(this, { status, code, field }); }
}
function service({ role = 'admin', current, failSave = false, failUpload = false, failCleanup = false } = {}) {
  const rows = current ? [{ ...current }] : [], uploads = [], removals = [];
  let checked = false;
  const storage = {
    getPublicUrl: path => ({ data: { publicUrl: 'https://storage.example/' + path } }),
    async upload(path, data, options) { uploads.push({ path, data, options }); return { error: failUpload ? { message: 'unavailable' } : null }; },
    async remove(paths) { removals.push(paths); if (failCleanup) throw new Error('cleanup unavailable'); return { error: null }; },
  };
  const db = {
    storage: { from: name => { assert.equal(name, 'landing-review-images'); return storage; } },
    from(name) {
      let id, values, creating = false;
      const chain = {
        select: () => chain,
        eq: (_field, value) => { id = value; return chain; },
        order: async field => { assert.equal(field, 'position'); return { data: rows, error: null }; },
        maybeSingle: async () => ({ data: name === 'user_roles' ? { role } : rows.find(row => row.id === id) ?? null, error: null }),
        insert: input => { creating = true; values = input; return chain; },
        update: input => { values = input; return chain; },
        single: async () => {
          assert.equal(checked, true, 'writes must follow administrator authorization');
          if (failSave) return { data: null, error: { message: 'database_error' } };
          if (!creating && !('image' in values)) assert.equal('image_path' in values, false, 'text edits must not overwrite a concurrent image replacement');
          const row = { ...(creating ? {} : rows.find(row => row.id === id)), id: creating ? 'created-id' : id, ...values };
          if (creating) rows.push(row); else rows.splice(rows.findIndex(row => row.id === id), 1, row);
          return { data: row, error: null };
        },
      };
      return chain;
    },
  };
  const exports = {};
  runInNewContext(compile('src/server/landing-reviews.ts'), {
    exports, Buffer, File, FormData, Request, Uint8Array,
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return { randomUUID: () => 'test-image-id' };
      if (name === 'sharp') return sharp;
      if (name === './http') return {
        ApiError, adminDb: () => db,
        requireAdmin: async () => { if (role !== 'admin') throw new ApiError(role ? 403 : 401, role ? 'forbidden' : 'unauthorized'); checked = true; },
        bytes: async (request, max) => { const bytes = Buffer.from(await request.arrayBuffer()); if (bytes.length > max) throw new ApiError(413, 'body_too_large'); return bytes; },
        dbError: error => { if (error) throw new ApiError(500, 'database_error'); },
        string: (value, field, max) => { if (typeof value !== 'string' || !value.length || value.length > max) throw new ApiError(400, 'invalid_field', field); return value; },
      };
      throw new Error(name);
    },
  });
  function save({ id, author = '작성자', text = '본문', file } = {}) {
    const form = new FormData();
    form.set('author', author); form.set('text', text);
    if (file) form.set('image', file);
    return exports.saveLandingReview({ request: new Request('http://localhost', { method: 'POST', body: form }), params: { id } });
  }
  return { save, rows, uploads, removals, publicReviews: () => exports.publicLandingReviews({ optionalUser: async () => role ? { id: 'user' } : null }) };
}

const existing = { id: 'figma-480-3089', author: seeds[0].author, body: seeds[0].text, image: seeds[0].images[0], image_path: null };
const png = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#ffffff' } }).png().toBuffer();
const pngFile = () => new File([png], 'original.any', { type: 'application/octet-stream' });

test('seed contains exactly the 12 requested Figma nodes in order with valid original images', async () => {
  assert.deepEqual(Array.from(seeds, row => row.id), ['3089','3082','3079','3084','3078','3085','3087','3080','3077','3081','3076','3083'].map(id => 'figma-480-' + id));
  for (const row of seeds) {
    assert.ok(row.author.length > 0 && row.author.length <= 300 && row.text.length > 0 && row.text.length <= 300);
    const image = row.images[0], metadata = await sharp('public' + image.src).metadata();
    assert.equal(metadata.format, 'png');
    if (image.crop) {
      assert.ok(image.crop.topPercent <= 0);
      assert.ok(image.crop.heightPercent + image.crop.topPercent >= 99.99, 'crop must cover its frame');
    }
  }
});

test('guest and non-admin writes are rejected before image processing or DB mutation', async () => {
  for (const role of [null, 'student']) {
    const api = service({ role });
    await assert.rejects(api.save({ file: pngFile() }), error => error.status === (role ? 403 : 401));
    assert.equal(api.uploads.length, 0); assert.equal(api.rows.length, 0);
  }
});

test('author and body are required, limited to 300 characters, and whitespace is rejected', async () => {
  for (const field of ['author', 'text']) for (const value of ['', '   ', 'x'.repeat(301)]) {
    const api = service({ current: existing });
    await assert.rejects(api.save({ id: existing.id, [field]: value }), error => error.status === 400);
    assert.equal(api.rows[0].author, existing.author); assert.equal(api.uploads.length, 0);
  }
  const api = service({ current: existing });
  const result = await api.save({ id: existing.id, author: 'a'.repeat(300), text: 'b'.repeat(300) });
  assert.equal(result.review.author.length, 300); assert.equal(result.review.text.length, 300);
  assert.deepEqual(result.review.images[0], existing.image, 'text-only edit preserves Figma cropping');
});

test('new reviews require an image and reject empty, oversized or undecodable files', async () => {
  for (const file of [undefined, new File([], 'empty.png'), new File([Buffer.alloc(20 * 1024 * 1024 + 1)], 'large.png'), new File(['not an image'], 'fake.png', { type: 'image/png' })]) {
    const api = service();
    await assert.rejects(api.save({ file }), error => error.status === 400);
    assert.equal(api.uploads.length, 0); assert.equal(api.rows.length, 0);
  }
});

test('image content is decoded without extension/MIME allowlists and normalized for web display', async () => {
  const images = [pngFile(), new File(['<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="white"/></svg>'], 'vector.svg'), new File([await sharp(png).tiff().toBuffer()], 'image.tiff')];
  for (const file of images) {
    const api = service();
    const result = await api.save({ file });
    assert.equal(api.rows.length, 1);
    const metadata = await sharp(api.uploads[0].data).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(result.review.images[0].width, metadata.width);
    assert.equal(result.review.images[0].height, metadata.height);
    assert.equal(api.uploads[0].options.upsert, false);
    assert.match(result.review.images[0].src, /^https:\/\/storage\.example\//);
  }
});

test('an image at the exact 20MB boundary is accepted', async () => {
  const api = service();
  const file = new File([png, Buffer.alloc(20 * 1024 * 1024 - png.length)], 'boundary.png');
  await api.save({ file });
  assert.equal(api.rows.length, 1);
});

test('DB save failure removes only the new upload and preserves the current review', async () => {
  const api = service({ current: { ...existing, image_path: 'old.webp' }, failSave: true });
  await assert.rejects(api.save({ id: existing.id, file: pngFile() }));
  assert.deepEqual(api.removals.map(paths => Array.from(paths)), [['test-image-id.webp']]);
  assert.deepEqual(api.rows[0].image, existing.image);
});

test('storage failure cannot publish a row with a missing image', async () => {
  const api = service({ failUpload: true });
  await assert.rejects(api.save({ file: pngFile() }), error => error.code === 'storage_unavailable');
  assert.equal(api.rows.length, 0);
});

test('successful replacement remains saved even if old-image cleanup is unavailable', async () => {
  const api = service({ current: { ...existing, image_path: 'old.webp' }, failCleanup: true });
  const result = await api.save({ id: existing.id, file: pngFile() });
  assert.match(result.review.images[0].src, /test-image-id.webp$/);
  assert.deepEqual(api.removals.map(paths => Array.from(paths)), [['old.webp']]);
});

test('public response exposes the image and grants editor visibility only to administrators', async () => {
  for (const role of [null, 'student', 'admin']) {
    const api = service({ role, current: existing });
    const result = await api.publicReviews();
    assert.equal(result.admin, role === 'admin');
    assert.equal(result.items[0].text, existing.body);
    assert.equal('image_path' in result.items[0], false);
  }
});

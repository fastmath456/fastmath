import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const source = ts.transpileModule(readFileSync('src/server/profile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function getProfile(imagePath) {
  const exports = {};
  const row = { name: '학생', birthday: '2000-01-01', phone: '01012345678', image_path: imagePath, marketing: false, updated_at: '2026-01-01' };
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }), maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/uploaded-image' }, error: null }) }) },
  };
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === './http') return { adminDb: () => db, dbError(error) { if (error) throw error; } };
      return {};
    },
  });
  return exports.profile({ user: async () => ({ id: 'user', email: 'student@example.com' }) });
}

test('members without an uploaded image use the default avatar', async () => {
  const result = await getProfile('');
  assert.equal(result.avatar, '/assets/default-profile.png');
  assert.equal(result.image, '');
});

test('members with an uploaded image continue to use it', async () => {
  const result = await getProfile('user/profile.webp');
  assert.equal(result.avatar, 'https://example.com/uploaded-image');
  assert.equal(result.image, result.avatar);
});

test('Figma default avatar is exported at 4x', async () => {
  const { width, height, format } = await sharp('public/assets/default-profile.png').metadata();
  assert.equal(format, 'png');
  assert.equal(width, 96);
  assert.equal(height, 96);
});

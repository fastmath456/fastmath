import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm, chmod, symlink, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { products, chapters, lessons, reviews, assertDemoReview, originalDurations, fixture, email, stableId, assertDemoUser, assertOriginalLesson, paymentDate } from './demo-data.mjs';
import { optionsFrom, targetUrl, readAssets, outsideRepository, credentialsForStudent, assertCredentialStat, applySeed } from './seed-demo.mjs';

test('writes are opt-in and remote project requires both explicit guards', () => {
  assert.equal(optionsFrom([]).apply, false);
  assert.equal(targetUrl('http://127.0.0.1:54331', {}), 'http://127.0.0.1:54331');
  const remote = 'https://bhyoyilivttszrwkaffs.supabase.co';
  assert.throws(() => targetUrl(remote, {}));
  assert.throws(() => targetUrl(remote, { remote: true }));
  assert.throws(() => targetUrl(remote, { remote: true, 'confirm-host': 'another.supabase.co' }));
  assert.equal(targetUrl(remote, { remote: true, 'confirm-host': new URL(remote).hostname }), remote);
  for (const url of ['https://another.supabase.co', 'http://127.0.0.1:9000', `${remote}/rest/v1`, 'https://example.com@bhyoyilivttszrwkaffs.supabase.co']) assert.throws(() => targetUrl(url, {}));
  assert.throws(() => optionsFrom(['--aply']));
});

test('only the marked synthetic account can be reused', () => {
  assert.doesNotThrow(() => assertDemoUser(null));
  assert.throws(() => assertDemoUser({ email }));
  assert.throws(() => assertDemoUser({ email, user_metadata: { demo_fixture: fixture } }));
  assert.throws(() => assertDemoUser({ email: 'existing@example.com', app_metadata: { demo_fixture: fixture } }));
  assert.doesNotThrow(() => assertDemoUser({ email, app_metadata: { demo_fixture: fixture } }));
});

test('normalization accepts only untouched Figma lessons with no purchases', () => {
  const lesson = lessons.find(lesson => lesson.id === 'lesson-1');
  const original = { ...lesson, duration_seconds: originalDurations[lesson.id], vimeo_url: null, vimeo_id: null };
  assert.equal(assertOriginalLesson(original, []), true);
  assert.equal(assertOriginalLesson(lesson, [{ lesson_id: lesson.id }]), false);
  assert.throws(() => assertOriginalLesson(original, [{ lesson_id: lesson.id }]));
  for (const changed of [{ title: 'Edited lesson' }, { duration_seconds: 500 }, { active: false }, { vimeo_id: '123' }]) assert.throws(() => assertOriginalLesson({ ...original, ...changed }, []));
  assert.throws(() => assertOriginalLesson({ ...lessons[0], duration_seconds: 500 }, []));
});

test('eight unique orders have six active and two expired 60-day entitlements', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const expiry = products.map(product => Date.parse(paymentDate(product, now)) + product.license_days * 86400000);
  assert.equal(expiry.filter(time => time > now.getTime()).length, 6);
  assert.equal(expiry.filter(time => time < now.getTime()).length, 2);
  assert.equal(new Set(products.map(product => stableId(`order:sample:${product.id}`))).size, 8);
  assert.equal(stableId('same'), stableId('same'));
  assert.equal(products.length, 8);
  assert.equal(chapters.length, 12);
  assert.equal(lessons.length, 37);
  assert(lessons.every(lesson => lesson.duration_seconds === 98 && chapters.some(chapter => chapter.id === lesson.chapter_id && chapter.product_id === lesson.product_id)));
});

test('missing and malformed assets stop before any database client exists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-seed-check-'));
  try {
    await assert.rejects(readAssets(directory), /Required demo asset missing/);
    await writeFile(join(directory, 'math1.pdf'), 'not a PDF');
    await assert.rejects(readAssets(directory), /Invalid PDF header/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('sample review IDs cannot duplicate and changed fixture reviews are preserved by aborting', () => {
  assert.equal(reviews.length, 12);
  assert.equal(new Set(reviews.map(review => review.id)).size, 12);
  for (const product of products) assert.equal(reviews.filter(review => review.product_id === product.id).length, product.kind === 'vod' ? 2 : 1);
  for (const review of reviews) {
    assert.match(review.author, /^샘플 /);
    assert.equal(review.rating, 5);
    assert.doesNotThrow(() => assertDemoReview({ ...review, created_at: review.created_at.replace('Z', '+00:00') }));
    assert.throws(() => assertDemoReview({ ...review, body: 'Changed by another author' }));
  }
});

test('credential path uses an actual parent segment, not any name starting with two dots', () => {
  assert.equal(outsideRepository('/repo', '/repo/..credentials.json'), false);
  assert.equal(outsideRepository('/repo', '/repo/..folder/credentials.json'), false);
  assert.equal(outsideRepository('/repo', '/repo/credentials.json'), false);
  assert.equal(outsideRepository('/repo', '/repo'), false);
  assert.equal(outsideRepository('/repo', '/credentials.json'), true);
  assert.equal(outsideRepository('/repo', '/another/credentials.json'), true);
});

test('valid external 0600 credentials can retry account creation without changing the password', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-credential-check-'));
  const path = join(directory, 'credentials.json');
  try {
    const first = await credentialsForStudent(path);
    assert.equal(first.reused, false);
    assert.match(first.password, /^Demo1![A-Za-z0-9_-]{32}$/);
    const bytes = await readFile(path, 'utf8');
    const second = await credentialsForStudent(path);
    assert.equal(second.reused, true);
    assert.equal(second.password, first.password);
    assert.equal(await readFile(path, 'utf8'), bytes);
    const metadata = await stat(path);
    assertCredentialStat(metadata);
    assert.throws(() => assertCredentialStat(metadata, metadata.uid + 1));
    await chmod(path, 0o644);
    await assert.rejects(credentialsForStudent(path), /0600/);
    await chmod(path, 0o600);
    await writeFile(path, JSON.stringify({ email: 'another@example.com', password: first.password }));
    await assert.rejects(credentialsForStudent(path), /email\/password/);
    await writeFile(path, JSON.stringify({ email, password: 'not-generated' }));
    await assert.rejects(credentialsForStudent(path), /email\/password/);
    await writeFile(path, '{invalid-json');
    await assert.rejects(credentialsForStudent(path), /Invalid credential JSON/);
    const link = join(directory, 'symlink.json');
    await symlink(path, link);
    await assert.rejects(credentialsForStudent(link), /symlink/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('remote normalization is blocked before any mutation, while local normalization is allowed', async () => {
  let mutations = 0;
  const db = new Proxy({}, { get() { mutations++; throw new Error('Unexpected database access'); } });
  await assert.rejects(applySeed(db, { normalize: [{}] }, [], { apply: true }, 'https://bhyoyilivttszrwkaffs.supabase.co'), /Remote apply refuses duration normalization/);
  assert.equal(mutations, 0);
  const { assertApplyAllowed } = await import('./seed-demo.mjs');
  assert.doesNotThrow(() => assertApplyAllowed('http://127.0.0.1:54331', { apply: true }, { normalize: [{}] }));
  assert.doesNotThrow(() => assertApplyAllowed('https://bhyoyilivttszrwkaffs.supabase.co', { apply: true }, { normalize: [] }));
});

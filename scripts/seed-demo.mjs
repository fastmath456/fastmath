#!/usr/bin/env node
// Default is read-only. Apply only to the explicitly selected demo environment.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, realpath, open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { fixture, email, video, products, chapters, lessons, reviews, assertDemoReview, subjectNames, stableId, sameFields, assertDemoUser, assertOriginalLesson, paymentDate } from './demo-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const remoteHost = 'bhyoyilivttszrwkaffs.supabase.co';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };

export function targetUrl(value, options) {
  const url = new URL(value);
  check(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Use a plain Supabase origin');
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && ['54321', '54331'].includes(url.port) && url.protocol === 'http:';
  if (!local) check(url.protocol === 'https:' && url.hostname === remoteHost && !url.port && options.remote && options['confirm-host'] === url.hostname, `Remote access requires --remote --confirm-host ${remoteHost}`);
  return url.origin;
}

export function optionsFrom(args) {
  const { values } = parseArgs({ args, options: {
    apply: { type: 'boolean', default: false }, remote: { type: 'boolean', default: false },
    'confirm-host': { type: 'string' }, 'credentials-file': { type: 'string' },
    'asset-dir': { type: 'string', default: resolve(root, 'fixtures/demo') }, help: { type: 'boolean', default: false },
  } });
  return values;
}

async function result(query, label) {
  const response = await query;
  if (response.error) fail(`${label} failed (${response.error.code ?? response.error.status ?? response.error.statusCode ?? 'request_error'})`);
  return response.data;
}

export async function readAssets(directory) {
  const assets = [];
  for (const subject of subjectNames) {
    for (const extension of ['pdf', 'png']) {
      const filename = `${subject}.${extension}`;
      const bytes = await readFile(resolve(directory, filename)).catch(() => fail(`Required demo asset missing: ${filename}`));
      check(bytes.length > 0 && bytes.length <= (extension === 'pdf' ? 52428800 : 104857600), `Invalid asset size: ${filename}`);
      let width = null, height = null;
      if (extension === 'pdf') {
        check(bytes.subarray(0, 5).toString() === '%PDF-' && bytes.subarray(-2048).includes(Buffer.from('%%EOF')), `Invalid PDF header/trailer: ${filename}`);
      } else {
        check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `Invalid PNG header: ${filename}`);
        const decoded = await sharp(bytes, { limitInputPixels: 40_000_000 }).raw().toBuffer({ resolveWithObject: true });
        width = decoded.info.width; height = decoded.info.height;
        check(width > 0 && height > 0, `Invalid PNG dimensions: ${filename}`);
      }
      const checksum = hash(bytes);
      assets.push({ subject, filename, extension, bytes, checksum, width, height, type: extension === 'pdf' ? 'application/pdf' : 'image/png',
        bucket: extension === 'pdf' ? 'paid-files' : 'admin-course-assets' });
    }
  }
  return assets;
}

async function findUser(db) {
  for (let page = 1; ; page++) {
    const data = await result(db.auth.admin.listUsers({ page, perPage: 100 }), 'Find demo account');
    const user = data.users.find(user => user.email?.toLowerCase() === email);
    if (user) { assertDemoUser(user); return user; }
    if (data.users.length < 100) return null;
  }
}

async function inspectStorage(db, assets, user) {
  for (const name of ['paid-files', 'admin-course-assets']) {
    const bucket = await result(db.storage.getBucket(name), `Inspect ${name} bucket`);
    check(bucket && !bucket.public, `Expected private bucket: ${name}`);
    for (const asset of assets.filter(asset => asset.bucket === name)) {
      check(bucket.file_size_limit >= asset.bytes.length && bucket.allowed_mime_types?.includes(asset.type), `Bucket does not accept ${asset.filename}`);
    }
  }
  // Content addressed paths never overwrite an existing object on a retry.
  for (const asset of assets) {
    asset.path = asset.extension === 'pdf' ? `${fixture}/${asset.subject}-${asset.checksum.slice(0, 16)}.pdf` : user ? `${user.id}/${fixture}/${asset.subject}-${asset.checksum.slice(0, 16)}.png` : null;
    if (!asset.path) continue;
    const response = await db.storage.from(asset.bucket).download(asset.path);
    if (response.error) {
      check((String(response.error.statusCode) === '404' || response.error.code === 'NoSuchKey' || response.error.status === 404), `Cannot inspect storage object: ${asset.filename}`);
      continue;
    }
    check(response.data.type.split(';')[0] === asset.type && hash(Buffer.from(await response.data.arrayBuffer())) === asset.checksum, `Existing object differs: ${asset.filename}`);
    asset.exists = true;
  }
}

async function preflight(db, assets) {
  const user = await findUser(db);
  const ids = products.map(product => product.id);
  const existingProducts = await result(db.from('products').select('*').in('id', ids), 'Read fixture products');
  check(existingProducts.length === products.length, 'All eight original Figma products must exist; import supabase/seed.sql locally first');
  for (const product of products) {
    const current = existingProducts.find(row => row.id === product.id);
    check(current && sameFields(current, product, Object.keys(product).filter(key => key !== 'subject')), `Original product fields differ: ${product.id}`);
    const pdf = assets.find(asset => asset.subject === product.subject && asset.extension === 'pdf');
    const expectedPath = `${fixture}/${pdf.subject}-${pdf.checksum.slice(0, 16)}.pdf`;
    check(current.pdf_path === null || current.pdf_path === expectedPath, `Existing PDF belongs to different content: ${product.id}`);
  }
  const existingChapters = await result(db.from('chapters').select('*').in('product_id', ids), 'Read chapters');
  const existingLessons = await result(db.from('lessons').select('*').in('product_id', ids), 'Read lessons');
  const snapshots = await result(db.from('order_lessons').select('order_id,lesson_id,duration_seconds,preview').in('lesson_id', lessons.map(lesson => lesson.id)), 'Read purchased snapshots');
  for (const row of existingChapters) {
    const expected = chapters.find(chapter => chapter.id === row.id);
    check(expected && sameFields(row, expected), `Existing chapter differs: ${row.id}`);
  }
  const normalize = [];
  for (const row of existingLessons) {
    if (assertOriginalLesson(row, snapshots)) normalize.push(row);
  }
  // Preserve the required original chapter/lesson identifiers and titles.
  check(['chapter-1', 'chapter-2', 'chapter-3'].every(id => existingChapters.some(row => row.id === id)), 'Original Figma chapters are missing');
  check(['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'].every(id => existingLessons.some(row => row.id === id)), 'Original Figma lessons are missing');
  for (const snapshot of snapshots) {
    const expected = lessons.find(lesson => lesson.id === snapshot.lesson_id);
    check(snapshot.duration_seconds === expected.duration_seconds && snapshot.preview === expected.preview, `Existing purchased snapshot differs: ${snapshot.lesson_id}`);
  }
  const existingReviews = await result(db.from('reviews').select('*').in('id', reviews.map(review => review.id)), 'Read sample reviews');
  existingReviews.forEach(assertDemoReview);
  const links = await result(db.from('product_assets').select('*').in('product_id', ids).eq('role', 'detailImage'), 'Read detail image links');
  const assetRows = links.length ? await result(db.from('admin_course_assets').select('*').in('id', [...new Set(links.map(link => link.asset_id))]), 'Read linked assets') : [];
  for (const link of links) {
    const product = products.find(product => product.id === link.product_id);
    const png = assets.find(asset => asset.subject === product.subject && asset.extension === 'png');
    check(user && link.position === 0 && link.asset_id === stableId(`asset:${user.id}:${png.subject}`), `Existing detail image differs: ${link.product_id}`);
    const row = assetRows.find(row => row.id === link.asset_id);
    check(row && row.owner_id === user.id && row.checksum === png.checksum, `Existing detail asset differs: ${link.product_id}`);
  }
  const orders = user ? await result(db.from('orders').select('*').eq('user_id', user.id), 'Read demo orders') : [];
  const entitlements = user ? await result(db.from('entitlements').select('*').eq('user_id', user.id), 'Read demo entitlements') : [];
  if (user) {
    const roles = await result(db.from('user_roles').select('role').eq('user_id', user.id), 'Check student role');
    check(roles.length === 0, 'Demo student must not have an administrator role');
    for (const order of orders) {
      const product = products.find(product => product.id === order.product_id);
      check(product && order.request_key === stableId(`order:${user.id}:${product.id}`) && ((order.status === 'pending' && order.payment_key === null) || order.payment_key === `${fixture}:${user.id}:${product.id}`) && ['pending', 'paid'].includes(order.status), 'Demo account contains non-fixture orders; refusing changes');
      check(order.amount === product.price && order.kind === product.kind && order.title === product.title, 'Demo order differs from fixture');
      const expected = lessons.filter(lesson => lesson.product_id === product.id);
      check(order.total_paid_seconds === expected.filter(lesson => !lesson.preview).length * video.duration, 'Demo payment snapshot total differs');
      const purchased = snapshots.filter(snapshot => snapshot.order_id === order.id);
      check(purchased.length === expected.length, 'Demo purchased lesson snapshot differs');
      const entitlement = entitlements.find(row => row.order_id === order.id);
      if (order.status === 'paid') check(entitlement && !entitlement.hidden && !entitlement.revoked && entitlement.product_id === order.product_id, 'Demo entitlement has changed; refusing changes');
    }
  }
  await inspectStorage(db, assets, user);
  const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.url)}`, { signal: AbortSignal.timeout(15000) });
  check(response.ok, 'Vimeo test clip verification failed');
  const clip = await response.json();
  check(String(clip.video_id) === video.id && clip.duration === video.duration, 'Vimeo clip duration/id changed; refusing inconsistent snapshots');
  return { user, existingChapters, existingLessons, normalize, orders, existingReviews };
}

export function outsideRepository(repository, path) {
  const rel = relative(repository, path);
  return rel === '..' || rel.startsWith(`..${sep}`);
}

export function assertCredentialStat(stat, owner = process.getuid()) {
  check(stat.isFile() && stat.uid === owner && (stat.mode & 0o7777) === 0o600 && stat.nlink === 1, 'Credentials must be an owned regular 0600 file with one link');
}

export async function credentialsForStudent(credentialsFile) {
  check(credentialsFile && isAbsolute(credentialsFile), 'New demo account requires --credentials-file with an absolute path outside this repository');
  const parent = await realpath(dirname(credentialsFile));
  const path = resolve(parent, basename(credentialsFile));
  check(outsideRepository(await realpath(root), path), 'Credentials must be outside the repository');
  const existing = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing) {
    check(!existing.isSymbolicLink() && await realpath(path) === path, 'Credential file must not be a symlink');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      assertCredentialStat(stat);
      check(stat.size <= 4096 && await realpath(path) === path, 'Invalid credential file');
      let value;
      try { value = JSON.parse(await handle.readFile('utf8')); } catch { fail('Invalid credential JSON'); }
      check(value?.email === email && typeof value.password === 'string' && /^Demo1![A-Za-z0-9_-]{32}$/.test(value.password), 'Credential email/password is not a generated demo credential');
      return { path, password: value.password, reused: true };
    } finally {
      await handle.close();
    }
  }
  const password = `Demo1!${randomBytes(24).toString('base64url')}`;
  // Save before the request; retry with the same credential after a failed creation.
  await writeFile(path, `${JSON.stringify({ email, password }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  return { path, password, reused: false };
}

export function assertApplyAllowed(origin, options, state) {
  check(options.apply === true, 'Write operation requires --apply');
  check(new URL(origin).hostname !== remoteHost || state.normalize.length === 0, 'Remote apply refuses duration normalization; normalize unused Figma lessons in a locked SQL transaction first');
}

async function createStudent(db, credentialsFile) {
  const { path, password } = await credentialsForStudent(credentialsFile);
  const data = await result(db.auth.admin.createUser({ email, password, email_confirm: true,
    app_metadata: { demo_fixture: fixture },
    user_metadata: { name: '체험 수강생', birthday: '1999-01-01', phone: '01000000000', agreements: [true, true, true, false], marketing: false },
  }), 'Create demo student');
  check(data.user, 'Demo user creation did not return a user');
  console.log(`New account credentials available in ${path}; no email was sent.`);
  return data.user;
}

async function upload(db, asset) {
  if (!asset.exists) {
    const response = await db.storage.from(asset.bucket).upload(asset.path, asset.bytes, { contentType: asset.type, upsert: false });
    // Concurrent reruns may win the insert. Verify the resulting bytes either way.
    if (response.error && !['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String(response.error.statusCode ?? response.error.code)) && response.error.status !== 409) fail(`Upload failed: ${asset.filename}`);
  }
  const object = await result(db.storage.from(asset.bucket).download(asset.path), `Verify ${asset.filename}`);
  check(object.type.split(';')[0] === asset.type && hash(Buffer.from(await object.arrayBuffer())) === asset.checksum, `Uploaded bytes/MIME differ: ${asset.filename}`);
}

export async function applySeed(db, state, assets, options, origin) {
  assertApplyAllowed(origin, options, state);
  const user = state.user ?? await createStudent(db, options['credentials-file']);
  assertDemoUser(user);
  for (const chapter of chapters) {
    if (!state.existingChapters.some(row => row.id === chapter.id)) await result(db.from('chapters').insert(chapter), `Insert chapter ${chapter.id}`);
  }
  for (const lesson of lessons) {
    const current = state.existingLessons.find(row => row.id === lesson.id);
    if (!current) await result(db.from('lessons').insert(lesson), `Insert lesson ${lesson.id}`);
    else if (state.normalize.some(row => row.id === lesson.id)) {
      // Recheck immediately before mutation; never modify a purchased duration.
      const purchased = await result(db.from('order_lessons').select('lesson_id').eq('lesson_id', lesson.id).limit(1), 'Recheck duration snapshot');
      check(purchased.length === 0, `Purchased snapshot appeared: ${lesson.id}`);
      const updated = await result(db.from('lessons').update({ duration_seconds: video.duration, vimeo_id: video.id, vimeo_url: video.url }).eq('id', lesson.id).eq('duration_seconds', current.duration_seconds).is('vimeo_id', null).is('vimeo_url', null).select('id'), `Normalize fixture ${lesson.id}`);
      check(updated.length === 1, `Lesson changed concurrently: ${lesson.id}`);
    }
  }
  for (const asset of assets) {
    if (asset.extension === 'png' && !asset.path) asset.path = `${user.id}/${fixture}/${asset.subject}-${asset.checksum.slice(0, 16)}.png`;
    await upload(db, asset);
    if (asset.extension === 'png') {
      const row = { id: stableId(`asset:${user.id}:${asset.subject}`), owner_id: user.id, slot: 'detailImage', path: asset.path, name: asset.filename, size_bytes: asset.bytes.length, checksum: asset.checksum, content_type: asset.type, width: asset.width, height: asset.height };
      const existing = await result(db.from('admin_course_assets').select('*').eq('id', row.id).maybeSingle(), 'Inspect detail asset');
      if (existing) check(sameFields(existing, row), `Detail image metadata differs: ${asset.subject}`);
      else await result(db.from('admin_course_assets').insert(row), 'Insert detail asset');
      for (const product of products.filter(product => product.subject === asset.subject)) {
        const link = { product_id: product.id, asset_id: row.id, role: 'detailImage', position: 0 };
        const existingLink = await result(db.from('product_assets').select('*').eq('product_id', product.id).eq('role', 'detailImage').eq('position', 0).maybeSingle(), 'Inspect detail link');
        if (existingLink) check(sameFields(existingLink, link), `Detail link differs: ${product.id}`);
        else await result(db.from('product_assets').insert(link), 'Insert detail link');
      }
    } else {
      for (const product of products.filter(product => product.subject === asset.subject)) {
        await result(db.from('products').update({ pdf_path: asset.path }).eq('id', product.id).or(`pdf_path.is.null,pdf_path.eq.${asset.path}`).select('id').single(), 'Connect sample PDF');
      }
    }
  }
  for (const review of reviews) {
    if (!state.existingReviews.some(row => row.id === review.id)) await result(db.from('reviews').insert(review), 'Insert sample review');
  }
  const now = new Date();
  for (const product of products) {
    const requestKey = stableId(`order:${user.id}:${product.id}`);
    const paymentKey = `${fixture}:${user.id}:${product.id}`;
    const existing = state.orders.find(order => order.product_id === product.id);
    const order = existing ?? await result(db.rpc('create_order', { p_user: user.id, p_product: product.id, p_key: requestKey }), 'Create demo order');
    if (order.status === 'pending') {
      await result(db.rpc('prepare_payment', { p_user: user.id, p_order: order.id, p_payment: paymentKey }), 'Prepare simulated demo payment');
      await result(db.rpc('complete_payment', { p_order: order.id, p_payment: paymentKey, p_amount: product.price, p_paid: paymentDate(product, now) }), 'Complete simulated demo payment');
    }
    if (product.kind === 'vod') {
      const purchased = await result(db.from('order_lessons').select('lesson_id,duration_seconds,preview').eq('order_id', order.id).eq('user_id', user.id), 'Verify demo snapshot');
      const courseLessons = lessons.filter(lesson => lesson.product_id === product.id);
      check(purchased.length === courseLessons.length && purchased.every(row => courseLessons.some(lesson => row.lesson_id === lesson.id && row.duration_seconds === lesson.duration_seconds && row.preview === lesson.preview)), 'Demo lesson snapshot mismatch');
      for (const [index, lesson] of courseLessons.slice(0, 3).entries()) {
        const prior = await result(db.from('lesson_progress').select('lesson_id').eq('order_id', order.id).eq('lesson_id', lesson.id).maybeSingle(), 'Inspect demo progress');
        if (prior) continue; // Preserve the sample student's subsequent learning.
        const position = index < 2 ? video.duration : 34;
        const paidAt = Date.parse(existing?.paid_at ?? paymentDate(product, now));
        await result(db.from('lesson_progress').insert({ user_id: user.id, order_id: order.id, lesson_id: lesson.id, position, watched: `{[0,${position})}`, completed: index < 2, updated_at: new Date(paidAt + (index + 1) * 3600000).toISOString() }), 'Insert sample learning progress');
      }
    }
  }
  console.log('Applied: 8 paid demo orders (6 active, 2 expired initially), 4 PDFs, 8 detail image links, 37 lessons, 12 explicitly labeled sample reviews. No external payment provider was called.');
  console.log('Vimeo is a public test clip, not a mathematics lesson. Existing credentials and subsequent student progress were not reset.');
}

export async function main(args = process.argv.slice(2)) {
  const options = optionsFrom(args);
  if (options.help) {
    console.log('node scripts/seed-demo.mjs [--apply --credentials-file /private/tmp/demo-credentials.json] [--remote --confirm-host bhyoyilivttszrwkaffs.supabase.co] [--asset-dir PATH]\nDefault: read-only preflight. Uses SUPABASE_URL and SUPABASE_SECRET_KEY from the environment or .env files. New account credentials are written once to an 0600 file outside the repository; a valid existing file is reused without resetting any account.');
    return;
  }
  const require = createRequire(import.meta.url);
  require('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
  check(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY in the process environment');
  const origin = targetUrl(process.env.SUPABASE_URL, options);
  const assets = await readAssets(options['asset-dir']);
  const db = createClient(origin, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const state = await preflight(db, assets);
  console.log(`Preflight passed for ${new URL(origin).host}: 8 unchanged Figma products; ${chapters.length} planned chapters; ${lessons.length} planned lessons; ${state.normalize.length} unused Figma durations to normalize.`);
  if (!options.apply) {
    console.log('DRY RUN: no database, authentication or storage mutations. Rerun with --apply to seed the sample student, assets and simulated payments.');
    return;
  }
  await applySeed(db, state, assets, options, origin);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Demo seed stopped: ${error.message}`); process.exitCode = 1; });
}

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import test from 'node:test';

const app = new URL('../src/app/', import.meta.url);
const { entries } = JSON.parse(readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8'));

test('every App Router page is in the Storybook index', () => {
  const routes = readdirSync(app, { recursive: true })
    .filter(file => file === 'page.tsx' || file.endsWith(sep + 'page.tsx'))
    .map(file => file === 'page.tsx' ? '/' : '/' + dirname(file).split(sep).join('/'));
  const pageStories = Object.values(entries).filter(entry => entry.type === 'story' && entry.title.startsWith('Pages/'));
  const taggedRoutes = new Set(pageStories.flatMap(entry => entry.tags
    .filter(tag => tag.startsWith('route:')).map(tag => tag.slice('route:'.length))));
  assert.deepEqual([...taggedRoutes].sort(), routes.sort());
});

test('course and book each have separate checkout and result stories', () => {
  for (const kind of ['course', 'book']) {
    for (const state of ['checkout', 'success', 'failure', 'cancelled']) {
      const id = `pages-payments-${kind}--${state}`;
      assert.equal(entries[id]?.type, 'story', id);
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Script } from 'node:vm';

test('public build preserves script syntax, named callbacks, and source formatting', async () => {
  const source = await readFile('index.html', 'utf8');
  const built = await readFile('dist/index.html', 'utf8');
  assert.ok(built.length < source.length);
  assert.ok(source.includes('/*') && source.includes('<!--'));
  for (const match of built.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|application\/ld\+json/.test(match[1]) || !match[2].trim()) continue;
    assert.doesNotThrow(() => new Script(match[2]));
  }
  assert.ok(built.includes('role","img') || built.includes("role','img") || built.includes('setAttribute("role", "img")'));
});

test('phones do not auto-cover the hero, and video sources remain deferred', async () => {
  const source = await readFile('index.html', 'utf8');
  assert.ok(source.includes("!matchMedia('(max-width: 899px)').matches"));
  assert.ok(source.includes('aria-label="Skip intro film"') || (await readFile('assets/js/hero-film.js', 'utf8')).includes('aria-label="Skip intro film"'));
  for (const video of source.matchAll(/<video\b[^>]*>/g)) {
    assert.ok(!/\sautoplay\b/.test(video[0]));
    assert.ok(video[0].includes('preload="none"'));
  }
  assert.ok(!/<source src="[^"]+\.mp4"/.test(source));
  assert.ok(source.includes('assets/js/media.js'));
});

test('critical fonts and semantic content are present without exposing private build inputs', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.ok(html.includes('<main id="main-content">'));
  assert.ok(html.includes('name="description"'));
  assert.ok(!html.includes('fonts.googleapis.com') && !html.includes('fonts.gstatic.com'));
  for (const match of html.matchAll(/(?:src|href)="(\/?assets\/[^"]+)"/g)) {
    if (match[1].startsWith('assets/js/') || match[1].includes('/fonts/')) await access('dist/' + match[1].replace(/^\//, ''));
  }
  await assert.rejects(access('dist/lib/knowledge.js'));
  await assert.rejects(access('dist/docs/assistant-setup.md'));
  await assert.rejects(access('dist/package.json'));
});

test('deferred galleries preserve source metadata and shader license notices', async () => {
  const source = await readFile('index.html', 'utf8');
  assert.ok(source.includes('data-src="assets/ai-showcase/'));
  assert.ok(source.includes('update(cat, true)'));
  assert.ok(!source.includes("img.loading = 'eager'"));
  assert.ok(source.includes('aria-hidden="true" inert'));
  assert.ok((await readFile('dist/assets/js/horizon-glow.js', 'utf8')).includes('MIT License'));
  assert.ok((await readFile('dist/assets/js/project-visuals.js', 'utf8')).includes('MIT License'));
});

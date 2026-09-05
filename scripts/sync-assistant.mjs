#!/usr/bin/env node
// Brings the assistant's private half into this checkout, at BUILD time.
//
//   node scripts/sync-assistant.mjs           clone kimlj/port-assistant, copy in
//   node scripts/sync-assistant.mjs --local   copy from ../port-assistant instead
//   node scripts/sync-assistant.mjs --check   report what is present, change nothing
//
// WHY THIS IS A BUILD STEP AND NOT A FETCH IN api/chat.js.
//
// The endpoint has no tools, no database and no network beyond the one call to
// Anthropic, and that is the design rather than a limitation of it: the worst
// case of a visitor talking their way past every rule in the prompt is a wrong
// sentence, which is a copy bug. Fetching the prompt per request would put a
// second host in that path, and whoever held it would be writing the system
// prompt for a site that answers in Kim's first person. The worst case would
// stop being a wrong sentence and start being a reached system.
//
// Pulling the same files here costs nothing at request time. The build bakes
// them into the bundle, the deployed function holds a static constant, and the
// prompt cache is unaffected because the bytes do not change between requests.
//
// The files this writes are gitignored in this repo, so a stray `git add -A`
// cannot put them back in the public one.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.ASSISTANT_REPO || 'kimlj/port-assistant';

// Everything the private repo owns. Listed rather than globbed so a new file
// appearing there is a deliberate addition here, not a silent one.
const FILES = [
  'lib/owner.json',
  'lib/knowledge.js',
  'lib/guards.js',
  'docs/assistant-answers.md',
  'scripts/build-kb.mjs',
  'scripts/import-answers.mjs',
  'scripts/devserver.mjs'
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

function report() {
  let missing = 0;
  for (const f of FILES) {
    const ok = existsSync(join(ROOT, f));
    if (!ok) missing++;
    console.log(`  ${ok ? 'present' : 'MISSING'}  ${f}`);
  }
  return missing;
}

if (has('--check')) {
  const missing = report();
  console.log(missing ? `\n${missing} missing — run: node scripts/sync-assistant.mjs` : '\nall present.');
  process.exit(missing ? 1 : 0);
}

// Already here? Do nothing. This is what makes the cutover safe in either
// order: the build machinery can ship while the files are still committed to
// the public repo, no-op, and start cloning by itself the moment they are
// removed. Without it, adding the build command would break every deploy until
// the token happened to be set.
function allPresent() {
  return FILES.every((f) => existsSync(join(ROOT, f)));
}

if (!has('--force') && !has('--local') && allPresent()) {
  console.log(`all ${FILES.length} files already present, skipping the clone.`);
  console.log('(pass --force to pull the private repo over them)');
  process.exit(0);
}

function copyFrom(dir) {
  let copied = 0;
  for (const f of FILES) {
    const from = join(dir, f);
    if (!existsSync(from)) {
      console.error(`  ! ${f} is not in the source — the private repo may have moved it`);
      continue;
    }
    cpSync(from, join(ROOT, f), { recursive: true });
    copied++;
  }
  return copied;
}

if (has('--local')) {
  const sibling = process.env.ASSISTANT_DIR || join(ROOT, '..', 'port-assistant');
  if (!existsSync(sibling)) {
    console.error(`no checkout at ${sibling}.`);
    console.error('Clone it beside this repo:  git clone git@github.com:' + REPO + '.git');
    process.exit(1);
  }
  console.log(`copying from ${sibling}`);
  console.log(`${copyFrom(sibling)}/${FILES.length} files in place.`);
  process.exit(0);
}

// A token is required on Vercel and not locally, where the gh CLI's own
// credentials are already on the machine. Both end up as an https remote; the
// token is only ever interpolated into the URL for the clone and never written
// anywhere, so it does not land in the build log or in a git config.
const token =
  process.env.ASSISTANT_REPO_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const tmp = mkdtempSync(join(tmpdir(), 'port-assistant-'));

try {
  const url = token
    ? `https://x-access-token:${token}@github.com/${REPO}.git`
    : `https://github.com/${REPO}.git`;

  execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  const copied = copyFrom(tmp);
  console.log(`${copied}/${FILES.length} files in place from ${REPO}.`);
  if (copied < FILES.length) process.exit(1);
} catch (err) {
  // Never print the error verbatim: a clone failure echoes the remote URL, and
  // the URL has the token in it.
  console.error(`could not clone ${REPO}.`);
  console.error('');
  console.error('On Vercel this needs ASSISTANT_REPO_TOKEN set to a GitHub token with');
  console.error('read access to that repository, in every environment that builds.');
  console.error('Locally, `gh auth login` is enough, or use --local against a sibling');
  console.error('checkout. Set ASSISTANT_REPO to point somewhere else.');
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

#!/usr/bin/env node
// The Vercel build. Three steps, in this order and no other:
//
//   1. pull the assistant's private half into this checkout
//   2. generate lib/kb.json from index.html, the resume and lib/owner.json
//   3. leave everything else alone — the page itself has no build step and is
//      not going to get one
//
// Step 2 has to follow step 1 because build-kb.mjs reads lib/owner.json, which
// only exists after the sync. There is no committed kb.json in either repo: a
// generated file with a copy in git is a file that goes stale, and the whole
// reason the corpus is generated is so the page and the assistant cannot
// disagree.
//
// If the sync fails the build fails, deliberately. A deploy that quietly
// shipped without the corpus would serve an assistant that had forgotten
// everything, which looks like a model problem and is not one.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The child has already printed whatever it wanted to say, on inherited stdio.
// Rethrowing here would bury that under a Node stack trace whose frames are all
// this file, so the failure is reported as an exit code and nothing else: the
// last thing in the log stays the child's own message about what to fix.
const run = (script, args = []) => {
  console.log(`\n> node scripts/${script} ${args.join(' ')}`.trimEnd());
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
      stdio: 'inherit',
      cwd: ROOT
    });
  } catch {
    console.error(`\nbuild failed in scripts/${script}.`);
    process.exit(1);
  }
};

run('sync-assistant.mjs');
run('build-kb.mjs');

// ---------------------------------------------------------------- publish
//
// Vercel served the repository root, which meant it served the repository: the
// whole corpus, the system prompt and the guard thresholds were downloadable
// from the site itself at /lib/knowledge.js and friends, along with CLAUDE.md,
// TODO.md and the scripts. Making the source repo private would not have
// touched that, because the exposure was the deploy and not the repo.
//
// So the build now names what is public instead of publishing whatever happens
// to be in the tree. Everything not on this list stays out of the served
// output, and a new file is public only because somebody added it here.
//
// The functions in api/ are unaffected: Vercel builds those from the project
// root and traces their imports, so lib/ still reaches them. It is only the
// static serving that is scoped.

const PUBLIC = [
  'index.html',
  'favicon.svg',
  'assets',
  'Kim_Julongbayan_Resume.pdf',
  'Kim_Julongbayan_Resume.docx'
];

const OUT = join(ROOT, 'dist');

console.log('\n> publish');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const entry of PUBLIC) {
  const from = join(ROOT, entry);
  if (!existsSync(from)) {
    console.error(`  ! ${entry} is missing — the page references it`);
    process.exit(1);
  }
  cpSync(from, join(OUT, entry), { recursive: true });
  console.log(`  ${entry}`);
}

console.log('\nbuild complete.');

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

console.log('\nbuild complete.');

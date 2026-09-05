#!/usr/bin/env node
// Reads docs/assistant-answers.md and writes the approved entries into
// lib/owner.json, which scripts/build-kb.mjs then folds into the corpus.
//
//   node scripts/import-answers.mjs           import, then report
//   node scripts/import-answers.mjs --dry     report only, write nothing
//
// WHY THIS EXISTS RATHER THAN EDITING THE JSON. Two reasons, and the second is
// the important one:
//
//   1. A markdown file opens in Notepad and does not break when a quote or an
//      apostrophe lands in the wrong place. JSON does.
//
//   2. Draft answers in that file were written by an assistant, not by Kim.
//      They are a starting point so he is not facing a blank page — and they
//      are guesses about a real person's opinions, on a public page, in his
//      voice. So an entry is imported ONLY when its STATUS line reads OK, which
//      is a change he has to make deliberately, one answer at a time. Skimming
//      the file and running this cannot publish a word he did not approve.
//
// Anything still marked NEEDS-REVIEW, GUESS or YOURS-ONLY is skipped and
// counted, so the file can sit half-finished for as long as he likes.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs', 'assistant-answers.md');
const OUT = join(ROOT, 'lib', 'owner.json');

if (!existsSync(DOC)) {
  console.error('docs/assistant-answers.md not found.');
  process.exit(1);
}

const lines = readFileSync(DOC, 'utf8').split(/\r?\n/);

const entries = [];
let cur = null;
let section = '';

for (const line of lines) {
  const h1 = /^#\s+([A-Z]\.\s+.*)$/.exec(line);
  if (h1) section = h1[1].replace(/^[A-Z]\.\s+/, '');

  const q = /^###\s*Q:\s*(.+)$/.exec(line);
  if (q) {
    if (cur) entries.push(cur);
    cur = { q: q[1].trim(), status: '', a: [], section };
    continue;
  }
  if (!cur) continue;

  const st = /^STATUS:\s*(\S+)/.exec(line);
  if (st) {
    cur.status = st[1].toUpperCase();
    continue;
  }

  const a = /^A:\s*(.*)$/.exec(line);
  if (a) {
    cur.a.push(a[1]);
    continue;
  }

  // A continuation line: part of the answer unless it opens a new block.
  if (cur.a.length && !/^#/.test(line)) cur.a.push(line);
}
if (cur) entries.push(cur);

const clean = (e) => e.a.join('\n').replace(/\s+\n/g, '\n').trim();

const approved = [];
const skipped = { NEEDS_REVIEW: 0, GUESS: 0, YOURS_ONLY: 0, EMPTY: 0, OTHER: 0 };

for (const e of entries) {
  const text = clean(e);

  if (e.status !== 'OK') {
    if (e.status === 'NEEDS-REVIEW') skipped.NEEDS_REVIEW++;
    else if (e.status === 'GUESS') skipped.GUESS++;
    else if (e.status === 'YOURS-ONLY') skipped.YOURS_ONLY++;
    else skipped.OTHER++;
    continue;
  }

  // Marked OK but nothing written, or the placeholder left in place.
  if (!text || /^TODO\b/i.test(text)) {
    skipped.EMPTY++;
    console.warn(`  ! marked OK but empty, skipped: ${e.q}`);
    continue;
  }

  approved.push({ q: e.q, a: text, section: e.section });
}

const total = entries.length;

if (process.argv.includes('--dry')) {
  console.log(`${total} questions in the doc, ${approved.length} marked OK.`);
} else {
  const note = JSON.parse(readFileSync(OUT, 'utf8'))._note;
  writeFileSync(
    OUT,
    JSON.stringify({ _note: note, _from: 'docs/assistant-answers.md', answers: approved }, null, 2) + '\n'
  );
  console.log(`lib/owner.json — ${approved.length} of ${total} answers imported.`);
}

const waiting =
  skipped.NEEDS_REVIEW + skipped.GUESS + skipped.YOURS_ONLY + skipped.OTHER + skipped.EMPTY;

if (waiting) {
  console.log(`\n  ${waiting} not imported:`);
  if (skipped.NEEDS_REVIEW) console.log(`    ${skipped.NEEDS_REVIEW} drafted, awaiting your check   (NEEDS-REVIEW)`);
  if (skipped.GUESS) console.log(`    ${skipped.GUESS} invented, rewrite before using    (GUESS)`);
  if (skipped.YOURS_ONLY) console.log(`    ${skipped.YOURS_ONLY} only you can answer                (YOURS-ONLY)`);
  if (skipped.EMPTY) console.log(`    ${skipped.EMPTY} marked OK but blank`);
  if (skipped.OTHER) console.log(`    ${skipped.OTHER} with no or an unknown STATUS`);
  console.log('\n  Change a STATUS line to OK to import that answer.');
}

if (approved.length) console.log('\n  Now run: node scripts/build-kb.mjs');

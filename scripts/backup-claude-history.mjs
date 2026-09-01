#!/usr/bin/env node
/**
 * Copy ~/.claude/history.jsonl somewhere it will survive.
 *
 * That file is the only complete record of Claude Code use on this machine -
 * created 2025-10-19, append-only, 15,000+ prompts - and there is exactly one
 * copy of it. The session transcripts beside it are already pruned to about
 * eight weeks, so the pruning behaviour is demonstrably real; nothing promises
 * history.jsonl is exempt forever.
 *
 *     node scripts/backup-claude-history.mjs
 *
 * NOT INTO THE REPO, deliberately. history.jsonl contains `display` - the full
 * text of every prompt - and `pastedContents`, which is whatever was pasted into
 * a session: source code, credentials, client data. The derived numbers in
 * assets/claude-usage.json are safe to publish; this file is not, and a copy
 * inside a git repo is one `git add -A` away from being published.
 *
 * Backups are dated and the newest few are kept, so a corrupted source cannot
 * quietly overwrite every good copy.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SRC = join(homedir(), ".claude", "history.jsonl");
const DEST_DIR = join(homedir(), "claude-history-backups");
const KEEP = 10;

let src;
try {
  src = statSync(SRC);
} catch {
  console.error(`Nothing at ${SRC} - nothing to back up.`);
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const dest = join(DEST_DIR, `history-${stamp}.jsonl`);

// A source that has SHRUNK is the exact case a backup exists for, so it is worth
// saying out loud rather than copying over the top in silence.
const existing = readdirSync(DEST_DIR)
  .filter((f) => f.startsWith("history-") && f.endsWith(".jsonl"))
  .sort();
if (existing.length) {
  const newest = join(DEST_DIR, existing[existing.length - 1]);
  const prev = statSync(newest).size;
  if (src.size < prev) {
    console.warn(
      `WARNING: the source is SMALLER than the last backup ` +
      `(${(src.size / 1e6).toFixed(1)} MB vs ${(prev / 1e6).toFixed(1)} MB).\n` +
      `         history.jsonl may have been rotated or truncated. The older ` +
      `backup is being kept.`
    );
  }
}

copyFileSync(SRC, dest);

// Keep the newest KEEP, drop the rest.
const all = readdirSync(DEST_DIR)
  .filter((f) => f.startsWith("history-") && f.endsWith(".jsonl"))
  .sort();
for (const f of all.slice(0, Math.max(0, all.length - KEEP))) {
  unlinkSync(join(DEST_DIR, f));
}

console.log(
  `backed up ${(src.size / 1e6).toFixed(1)} MB -> ${dest}\n` +
  `  ${Math.min(all.length, KEEP)} backup(s) retained in ${DEST_DIR}\n` +
  `  this directory is OUTSIDE the repo on purpose - it holds prompt text.`
);

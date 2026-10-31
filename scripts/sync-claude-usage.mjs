#!/usr/bin/env node
/**
 * Refresh both halves of Build Activity in one daily commit and deployment.
 *
 * GitHub uses the existing gh CLI login. Claude hours come from transcripts under
 * ~/.claude/projects on the machine that did the work, and those should not be in
 * the repo. So the machine refreshes its own figure and pushes the result.
 *
 * It works in a clone of its own, under LOCALAPPDATA, and never in a checkout
 * anyone is using. That is the whole safety story: a scheduled task that ran
 * `git commit` in a working tree would eventually fire in the middle of an edit,
 * on the wrong branch, or over a half-finished rebase. Here it can hard-reset to
 * origin/main every run without asking what state anything was left in, because
 * nothing else touches this directory.
 *
 * Only assets/contributions.json and assets/claude-usage.json are staged.
 * A successful publish is recorded outside the clone so repeated logons do not
 * create extra deployments on the same Philippine calendar day.
 *
 *     node scripts/sync-claude-usage.mjs           # refresh, commit, push
 *     node scripts/sync-claude-usage.mjs --dry-run # do everything but push
 *
 * Register it with scripts/install-usage-sync.ps1. Output goes to the console and
 * is appended to sync.log beside the clone, because a scheduled task has nowhere
 * else to say what happened.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { activityDay, alreadyPublished, assertContributionCounts } from './activity-policy.mjs';

const REMOTE = "https://github.com/kimlj/port";
const BRANCH = "main";
const FILE = "assets/claude-usage.json";
const CONTRIBUTIONS = "assets/contributions.json";
const FILES = [CONTRIBUTIONS, FILE];

const BASE = process.env.LOCALAPPDATA || join(homedir(), ".local", "share");
const DIR = resolve(BASE, "kimlj-port-usage-sync");
const REPO = join(DIR, "repo");
const LOG = join(DIR, "sync.log");
const STATE = join(DIR, "activity-published.json");
const LOCK = join(DIR, "activity-sync.lock");

const DRY = process.argv.includes("--dry-run");

function say(msg) {
  const line = `${new Date().toISOString()}  ${msg}`;
  console.log(line);
  try {
    mkdirSync(DIR, { recursive: true });
    appendFileSync(LOG, line + "\n", "utf8");
  } catch {
    /* the log is a convenience; losing it is not a reason to fail the run */
  }
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 180000,
    cwd: opts.cwd,
    stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
    env: {
      ...process.env,
      // A scheduled task has no terminal. Without these, an expired credential
      // makes git sit forever on a prompt nobody will ever see, and the task
      // stays "running" until the next reboot.
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
    },
  }).trim();
}

function git(args, opts = {}) {
  return run("git", args, { cwd: REPO, ...opts });
}

let lock;
try {
  mkdirSync(DIR, { recursive: true });
  lock = openSync(LOCK, 'wx');
} catch {
  console.error('Activity sync is already running, or a stale lock needs review.');
  process.exit(2);
}

function rememberPublished(commit) {
  writeFileSync(STATE + '.tmp', JSON.stringify({ day: activityDay(), commit }) + '\n');
  renameSync(STATE + '.tmp', STATE);
}

function synchronize() {
  let priorState;
  try { priorState = JSON.parse(readFileSync(STATE, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Daily publication record is unreadable.');
  }
  if (!DRY && alreadyPublished(priorState)) {
    say('Both activity snapshots were already published today; nothing to do.');
    return;
  }
  if (!existsSync(join(REPO, '.git'))) {
    say(`cloning ${REMOTE} into ${REPO}`);
    mkdirSync(DIR, { recursive: true });
    run('git', ['clone', '--depth', '50', '--branch', BRANCH, REMOTE, REPO]);
  }
  // This clone belongs exclusively to the scheduled sync, never to a human edit.
  git(['fetch', '--depth', '50', 'origin', BRANCH], { quiet: true });
  git(['checkout', '-q', BRANCH], { quiet: true });
  git(['reset', '--hard', `origin/${BRANCH}`], { quiet: true });

  const previous = JSON.parse(git(['show', `HEAD:${CONTRIBUTIONS}`], { quiet: true }));
  say('refreshing GitHub contributions through the existing gh login');
  run('node', [join(REPO, 'scripts', 'fetch-contributions.mjs')], { cwd: REPO });
  assertContributionCounts(previous, JSON.parse(readFileSync(join(REPO, CONTRIBUTIONS), 'utf8')));
  say('reading local Claude Code transcripts');
  run('node', [join(REPO, 'scripts', 'fetch-claude-usage.mjs')], { cwd: REPO });

  if (!git(['status', '--porcelain', '--', ...FILES], { quiet: true })) {
    say('no change; nothing to push');
    if (!DRY) rememberPublished(git(['rev-parse', 'HEAD'], { quiet: true }));
    return;
  }
  git(['add', '--', ...FILES], { quiet: true });
  const payload = JSON.parse(git(['show', `:${FILE}`], { quiet: true }));
  const hours = payload?.hours?.total ?? '?';
  const sessions = payload?.hours?.sessions ?? '?';
  const prompts = payload?.prompts?.total ?? '?';
  git([
    '-c', 'user.name=kimlj', '-c', 'user.email=kljulongbayan@gmail.com',
    'commit', '-q', '-m',
    `Refresh daily GitHub and Claude Code activity\n\n` +
      `${hours} hours across ${sessions} sessions, ${prompts} prompts.\n` +
      'Written by scripts/sync-claude-usage.mjs on this machine.',
  ], { quiet: true });
  if (DRY) {
    say(`dry run; would publish both snapshots (${hours}h / ${sessions} sessions / ${prompts} prompts)`);
    return;
  }
  // A rejected or slow push is reported for inspection, never blindly retried.
  git(['push', 'origin', `HEAD:${BRANCH}`], { quiet: true });
  rememberPublished(git(['rev-parse', 'HEAD'], { quiet: true }));
  say(`published both activity snapshots: ${hours}h / ${sessions} sessions / ${prompts} prompts`);
}

try {
  synchronize();
} catch {
  say('FAILED: Activity sync did not complete. Check GitHub login, tool availability and the daily publication record. No push was retried.');
  process.exitCode = 1;
} finally {
  closeSync(lock);
  unlinkSync(LOCK);
}

#!/usr/bin/env node
/**
 * Refresh the Claude Code half of Build Activity and push it.
 *
 * The GitHub half is refreshed by a runner (.github/workflows/refresh-activity.yml).
 * This half cannot be: the hours are derived from session transcripts under
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
 * Only assets/claude-usage.json is ever staged.
 *
 *     node scripts/sync-claude-usage.mjs           # refresh, commit, push
 *     node scripts/sync-claude-usage.mjs --dry-run # do everything but push
 *
 * Register it with scripts/install-usage-sync.ps1. Output goes to the console and
 * is appended to sync.log beside the clone, because a scheduled task has nowhere
 * else to say what happened.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

const REMOTE = "https://github.com/kimlj/port";
const BRANCH = "main";
const FILE = "assets/claude-usage.json";

const BASE = process.env.LOCALAPPDATA || join(homedir(), ".local", "share");
const DIR = resolve(BASE, "kimlj-port-usage-sync");
const REPO = join(DIR, "repo");
const LOG = join(DIR, "sync.log");

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

try {
  if (!existsSync(join(REPO, ".git"))) {
    say(`cloning ${REMOTE} into ${REPO}`);
    mkdirSync(DIR, { recursive: true });
    run("git", ["clone", "--depth", "50", "--branch", BRANCH, REMOTE, REPO]);
  }

  // Whatever the last run left behind, this is the starting point. Safe only
  // because this clone belongs to this script and to nothing else.
  git(["fetch", "--depth", "50", "origin", BRANCH], { quiet: true });
  git(["checkout", "-q", BRANCH], { quiet: true });
  git(["reset", "--hard", `origin/${BRANCH}`], { quiet: true });

  say("reading local Claude Code transcripts");
  run("node", [join(REPO, "scripts", "fetch-claude-usage.mjs")], { cwd: REPO });

  const dirty = git(["status", "--porcelain", "--", FILE], { quiet: true });
  if (!dirty) {
    say("no change — nothing to push");
    process.exit(0);
  }

  git(["add", "--", FILE], { quiet: true });

  // Read back what is actually being published rather than describing it from
  // the script's own output, so the commit message cannot drift from the file.
  const payload = JSON.parse(
    git(["show", `:${FILE}`], { quiet: true })
  );
  const hours = payload?.hours?.total ?? "?";
  const sessions = payload?.hours?.sessions ?? "?";
  const prompts = payload?.prompts?.total ?? "?";

  git([
    "-c", "user.name=kimlj",
    "-c", "user.email=kljulongbayan@gmail.com",
    "commit", "-q", "-m",
    `Refresh Claude Code usage figures\n\n` +
      `${hours} hours across ${sessions} sessions, ${prompts} prompts.\n` +
      `Written by scripts/sync-claude-usage.mjs on this machine.`,
  ], { quiet: true });

  if (DRY) {
    say(`dry run — would push ${hours}h / ${sessions} sessions / ${prompts} prompts`);
    process.exit(0);
  }

  try {
    git(["push", "origin", `HEAD:${BRANCH}`], { quiet: true });
  } catch {
    // The workflow pushes to the same branch. It only ever writes the other
    // JSON file, so a rebase here cannot conflict — it just has to be redone.
    say("push rejected, rebasing on origin and retrying");
    git(["pull", "--rebase", "origin", BRANCH], { quiet: true });
    git(["push", "origin", `HEAD:${BRANCH}`], { quiet: true });
  }

  say(`pushed ${hours}h / ${sessions} sessions / ${prompts} prompts`);
} catch (err) {
  // Exits non-zero so Task Scheduler records a failed run, but says something
  // legible first: the next person to read this is reading a log file weeks on.
  say(`FAILED: ${(err.stderr || err.message || String(err)).trim().split("\n")[0]}`);
  process.exit(1);
}

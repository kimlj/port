#!/usr/bin/env node
/**
 * Re-count the commit figures on /hub and write them back into hub.html.
 *
 *     node scripts/fetch-hub-figures.mjs [--check]
 *
 * MDS Pro and WordWarz carry Commits tiles. JobSift now uses database aggregates; the portfolio panel explains its architecture. They were hand-typed and correct on
 * the day they were typed, and three of the four had drifted within a week -
 * MDS Pro by fourteen, the portfolio by six. That is the ordinary fate of a
 * number nobody recounts, and it matters more here than on most pages: the hub
 * is shown while somebody talks over it, so a figure on it gets read out loud.
 *
 * BY HAND, like the Claude usage half and for the same reason. Three of the four
 * repositories only exist on this machine - two are private and one is a
 * client's - so there is no runner that could count them. `.github/workflows`
 * can refresh the contribution figures because GitHub already holds those;
 * nothing off this laptop can see these.
 *
 * THE NOTE IS REWRITTEN WITH THE NUMBER, and that is the point of the script
 * rather than a flourish. The tiles used to read "Jun 2026 to now", which claims
 * a currency a hardcoded number cannot keep and which is exactly the thing this
 * site argues against elsewhere. They now read "Jun 2026 to 13 Sep 2026": the
 * first date comes from the repository's first commit, the second from the day
 * it was counted. A stale figure then looks stale instead of looking current.
 *
 * A missing repository is reported and SKIPPED, never guessed at and never
 * zeroed. A wrong number on this page is worse than an old one, because an old
 * one says when it was taken.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HUB = join(ROOT, "hub.html");

// panel id in hub.html -> the working copy its commits are counted from. The
// checkout is named rather than the GitHub repo because two of these have no
// readable remote from here; `git rev-list` against the local clone is the only
// count available, and it is the same count.
const PANELS = [
  { id: "mdspro", repo: "mdspromonitor", name: "MDS Pro" },
  { id: "wordwarz", repo: "Multiwordle", name: "WordWarz" }
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

// "2026-06-11" -> "Jun 2026". Parsed by hand rather than through Date, which
// would read the string as UTC midnight and hand back the previous day in any
// timezone west of London - enough to move a first commit into the month before.
function monthLabel(iso) {
  const [y, m] = iso.split("-");
  return MONTHS[Number(m) - 1] + " " + y;
}

function today() {
  const d = new Date();
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

// The panel's own slice of the file, so a regex that fails to find a Commits
// tile cannot wander into the next panel and rewrite its figures instead.
function panelBounds(html, id) {
  const start = html.indexOf(`<section class="panel" id="panel-${id}"`);
  if (start === -1) return null;
  const next = html.indexOf('<section class="panel"', start + 1);
  return { start, end: next === -1 ? html.length : next };
}

const TILE = /(<span class="metric-value">)([^<]*)(<\/span>\s*<span class="metric-label">Commits<\/span>\s*<span class="metric-note">)([^<]*)(<\/span>)/;

const check = process.argv.includes("--check");
let html = readFileSync(HUB, "utf8");
const stamp = today();
let changed = 0;
let missing = 0;

for (const panel of PANELS) {
  const dir = panel.repo === ROOT ? ROOT : join(homedir(), panel.repo);
  if (!existsSync(join(dir, ".git"))) {
    console.warn(`  ${panel.name.padEnd(14)} SKIPPED — no checkout at ${dir}`);
    missing++;
    continue;
  }

  const count = Number(git(dir, ["rev-list", "--count", "HEAD"]));
  const first = git(dir, ["log", "--reverse", "--format=%as", "--max-parents=0"]).split("\n")[0];
  const note = `${monthLabel(first)} to ${stamp}`;
  const value = count.toLocaleString("en-US");

  const bounds = panelBounds(html, panel.id);
  if (!bounds) {
    console.warn(`  ${panel.name.padEnd(14)} SKIPPED — no #panel-${panel.id} in hub.html`);
    missing++;
    continue;
  }

  const slice = html.slice(bounds.start, bounds.end);
  const match = TILE.exec(slice);
  if (!match) {
    console.warn(`  ${panel.name.padEnd(14)} SKIPPED — no Commits tile in #panel-${panel.id}`);
    missing++;
    continue;
  }

  const was = match[2];
  const wasNote = match[4];
  if (was === value && wasNote === note) {
    console.log(`  ${panel.name.padEnd(14)} ${value} unchanged`);
    continue;
  }

  console.log(`  ${panel.name.padEnd(14)} ${was} -> ${value}   (${note})`);
  changed++;
  if (!check) {
    html = html.slice(0, bounds.start) +
      slice.replace(TILE, `$1${value}$3${note}$5`) +
      html.slice(bounds.end);
  }
}

if (missing) {
  // Loud, because the silent version of this is a panel quietly keeping last
  // month's figure while every other panel on the page moved.
  console.warn(`\n${missing} panel(s) left at their old figures.`);
}

if (check) {
  if (changed) {
    console.error(`\n${changed} figure(s) out of date. Run without --check to write them.`);
    process.exit(1);
  }
  console.log("\nUp to date.");
} else if (changed) {
  writeFileSync(HUB, html);
  console.log(`\nhub.html updated (${changed} figure(s)).`);
} else {
  console.log("\nNothing to write.");
}

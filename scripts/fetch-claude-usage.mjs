#!/usr/bin/env node
/**
 * Aggregate local Claude Code usage into assets/claude-usage.json.
 *
 * Claude Code keeps every session transcript on this machine under
 * ~/.claude/projects/**\/*.jsonl - one JSON object per line - and each assistant
 * message carries its own token breakdown and model. That is the only place this
 * usage exists: the Usage & Cost Admin API covers API keys, not a Claude Code
 * subscription, and returns 401 for an individual account anyway.
 *
 *     node scripts/fetch-claude-usage.mjs
 *
 * PRIVACY, and it is the whole design of this file. Those transcripts contain
 * real prompts, real source code, and whatever happened to be pasted into a
 * session. This reads ONLY four fields per line - timestamp, model, the usage
 * object, and whether the line is a subagent - and writes nothing but daily
 * totals. `message.content` is never touched, and the output is numbers per date
 * with no text of any kind. Read the output before publishing it anyway; it is
 * your machine and your call, not mine.
 *
 * Streams line by line because the transcripts run to hundreds of megabytes.
 */

import { createReadStream, writeFileSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/claude-usage.json");
const SESSIONS = join(homedir(), ".claude", "projects");

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

const days = {};          // date -> { in, out, cacheRead, cacheWrite, messages }
const models = {};        // model -> total tokens
let files = 0, lines = 0, messages = 0, bytes = 0;

function bump(date) {
  return (days[date] ||= { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, messages: 0 });
}

for await (const file of walk(SESSIONS)) {
  files++;
  try { bytes += statSync(file).size; } catch {}

  const rl = createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;
    lines++;
    // Cheap reject before parsing: most lines are not assistant messages, and
    // JSON.parse on a 50MB file's worth of them is the slow part.
    if (!line.includes('"usage"')) continue;

    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    const usage = entry?.message?.usage;
    const stamp = entry?.timestamp;
    if (!usage || !stamp) continue;

    const date = String(stamp).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const d = bump(date);
    d.in += usage.input_tokens || 0;
    d.out += usage.output_tokens || 0;
    d.cacheRead += usage.cache_read_input_tokens || 0;
    d.cacheWrite += usage.cache_creation_input_tokens || 0;
    d.messages += 1;
    messages++;

    const model = entry?.message?.model;
    if (model) {
      const total =
        (usage.input_tokens || 0) + (usage.output_tokens || 0) +
        (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
      models[model] = (models[model] || 0) + total;
    }
  }
}

// The days this run actually found on disk. Reported in the console summary,
// but deliberately NOT used for the totals or the published day count: the
// archive merge below adds back days that have since been pruned, and a total
// taken from one set of days over a count taken from another is exactly the bug
// this file spent a release publishing. Everything published is computed after
// the merge, further down.
const diskDates = Object.keys(days).sort();

// ---- history.jsonl: the long arc -------------------------------------------
// Only `timestamp` is read. That file also carries `display` - the prompt text
// itself - and `pastedContents`; neither is touched and neither reaches the
// output. Projects are COUNTED but never named: they are directory names like
// "ore-cli" and "mdspromonitor", and publishing them would disclose client work
// and side projects the page has not chosen to disclose.
const promptDays = {};
let promptTotal = 0;
let projectCount = 0;
try {
  const seen = new Set();
  const rl = createInterface({
    input: createReadStream(join(homedir(), ".claude", "history.jsonl"), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const t = e && e.timestamp;
    if (!t) continue;
    const date = new Date(t > 1e11 ? t : t * 1000).toISOString().slice(0, 10);
    promptDays[date] = (promptDays[date] || 0) + 1;
    promptTotal++;
    if (e.project) seen.add(String(e.project));
  }
  projectCount = seen.size;
} catch {
  // A missing history file is survivable - the token half still reports.
}
const promptDates = Object.keys(promptDays).sort();

// ---- hours at the keyboard ------------------------------------------------
// Prompt COUNT is a poor headline: it measures how much was asked, not how much
// was done, and a high number is as consistent with prompting badly as with
// working hard. Elapsed time is not.
//
// Prompts are grouped into sessions and a session ends after IDLE_GAP of
// silence, so only stretches of continuous work are counted - a laptop left open
// overnight adds nothing. 15 minutes is the strictest of the thresholds tried
// (15/30/45/60 gave 725/841/890/936 hours); the most conservative one is the
// right one to publish.
const IDLE_GAP_MIN = 15;
const SINGLE_PROMPT_CREDIT_MIN = 3;   // a lone prompt is not zero minutes of work

const stamps = [];
for (const [date, _] of Object.entries(promptDays)) { void date; }
// Re-read timestamps: promptDays only kept per-day counts, and sessions need the
// individual times.
const times = [];
try {
  const rl2 = createInterface({
    input: createReadStream(join(homedir(), ".claude", "history.jsonl"), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl2) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const t = e && e.timestamp;
    if (t) times.push(t > 1e11 ? t : t * 1000);
  }
} catch {}
times.sort((a, b) => a - b);
void stamps;

let sessions = 0, totalMs = 0, longestMs = 0;
const hoursByDay = {};
if (times.length) {
  let start = times[0], last = times[0];
  const close = () => {
    sessions++;
    const span = last - start || SINGLE_PROMPT_CREDIT_MIN * 60000;
    totalMs += span;
    if (span > longestMs) longestMs = span;
    const day = new Date(start).toISOString().slice(0, 10);
    hoursByDay[day] = (hoursByDay[day] || 0) + span / 3600000;
  };
  for (let i = 1; i < times.length; i++) {
    if (times[i] - last > IDLE_GAP_MIN * 60000) { close(); start = times[i]; }
    last = times[i];
  }
  close();
}
const hours = {
  total: Math.round(totalMs / 3600000),
  sessions,
  longestSessionHours: +(longestMs / 3600000).toFixed(1),
  idleGapMinutes: IDLE_GAP_MIN,
  byDay: Object.fromEntries(
    Object.entries(hoursByDay).map(([k, v]) => [k, +v.toFixed(2)])
  ),
};

// ---- archive: never lose a day we have already seen -----------------------
// The transcripts are pruned, so a day that reported 2M tokens in August will
// simply be absent next month. Recomputing from scratch every run therefore
// LOSES history. Instead the previous output is read back and merged, taking
// the larger value per day - a past day's totals only ever get more complete,
// never less. history.jsonl is append-only today, but the same merge protects
// this if that ever changes too.
const ARCHIVE = resolve(ROOT, "assets/claude-usage.json");
let prior = null;
try { prior = JSON.parse(readFileSync(ARCHIVE, "utf8")); } catch {}

function mergeDaily(oldMap, newMap) {
  const out = { ...(oldMap || {}) };
  for (const [k, v] of Object.entries(newMap || {})) {
    out[k] = Math.max(out[k] || 0, v);
  }
  return out;
}

// The per-day BREAKDOWN is archived too, field by field. Archiving only the
// combined per-day figure was not enough: `totals` was recomputed from disk on
// every run while the day count came from the merged map, so a day that aged
// off disk kept its place in the denominator and took its output tokens out of
// the numerator. Tokens per active day then FELL as more work was done - 1.3M
// to 1.2M across a week where hours and total tokens both rose - which is the
// opposite of what that figure claims to say.
function mergeBreakdown(oldMap, newMap) {
  const keys = new Set([...Object.keys(oldMap || {}), ...Object.keys(newMap || {})]);
  const out = {};
  for (const k of keys) {
    const a = (oldMap || {})[k] || {};
    const b = (newMap || {})[k] || {};
    out[k] = {
      in: Math.max(a.in || 0, b.in || 0),
      out: Math.max(a.out || 0, b.out || 0),
      cacheRead: Math.max(a.cacheRead || 0, b.cacheRead || 0),
      cacheWrite: Math.max(a.cacheWrite || 0, b.cacheWrite || 0),
      messages: Math.max(a.messages || 0, b.messages || 0),
    };
  }
  return out;
}

const breakdown = prior ? mergeBreakdown(prior.breakdown, days) : { ...days };

// Totals and the published day count both come off the merged breakdown, so the
// numerator and the denominator of any rate describe the same set of days.
const mergedTokenDates = Object.keys(breakdown).sort();
const totals = mergedTokenDates.reduce(
  (t, k) => {
    const d = breakdown[k];
    t.in += d.in; t.out += d.out;
    t.cacheRead += d.cacheRead; t.cacheWrite += d.cacheWrite;
    t.messages += d.messages;
    return t;
  },
  { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, messages: 0 }
);
totals.all = totals.in + totals.out + totals.cacheRead + totals.cacheWrite;

// The chart's series, derived from the breakdown and then merged with the
// previous file's own daily map: days archived before `breakdown` existed carry
// a combined figure and nothing else, so the chart can still draw them even
// though they can no longer contribute to a total.
const daily = {};
for (const k of mergedTokenDates) {
  const d = breakdown[k];
  daily[k] = d.in + d.out + d.cacheRead + d.cacheWrite;
}

if (prior) {
  const beforeTok = Object.keys(daily).length;
  const beforePr = Object.keys(promptDays).length;
  Object.assign(daily, mergeDaily(prior.daily, daily));
  Object.assign(promptDays, mergeDaily(prior.prompts && prior.prompts.daily, promptDays));
  const keptTok = Object.keys(daily).length - beforeTok;
  const keptPr = Object.keys(promptDays).length - beforePr;
  if (keptTok || keptPr) {
    console.log(`archive: recovered ${keptTok} chart-only token-day(s) and ${keptPr} ` +
                `prompt-day(s) that are no longer on disk`);
  }
}

const mergedPromptDates = Object.keys(promptDays).sort();

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    hours,
    prompts: {
      total: Object.values(promptDays).reduce((a, b) => a + b, 0),
      activeDays: mergedPromptDates.length,
      firstDay: mergedPromptDates[0] || null,
      lastDay: mergedPromptDates[mergedPromptDates.length - 1] || null,
      projects: projectCount,
      daily: promptDays,
    },
    source: "local Claude Code session transcripts (~/.claude/projects)",
    firstDay: mergedTokenDates[0] || null,
    lastDay: mergedTokenDates[mergedTokenDates.length - 1] || null,
    activeDays: mergedTokenDates.length,
    totals,
    models,
    daily,
    breakdown,
  }),
  "utf8"
);

const fmt = (n) => n.toLocaleString("en-US");
console.log(
  `hours: ${fmt(hours.total)} across ${fmt(hours.sessions)} sessions ` +
  `(idle gap ${IDLE_GAP_MIN}min, longest ${hours.longestSessionHours}h)
` +
  `prompts: ${fmt(promptTotal)} over ${promptDates.length} active days ` +
  `(${promptDates[0]} -> ${promptDates[promptDates.length - 1]}), ` +
  `${projectCount} projects
` +
  `read ${files} session files (${(bytes / 1e6).toFixed(0)} MB, ${fmt(lines)} lines)\n` +
  `  ${fmt(messages)} assistant messages across ${diskDates.length} days still on disk\n` +
  `  ${diskDates[0]} -> ${diskDates[diskDates.length - 1]}
` +
  `  totals cover ${mergedTokenDates.length} days after the archive merge\n` +
  `  ${fmt(totals.all)} tokens total ` +
  `(in ${fmt(totals.in)}, out ${fmt(totals.out)}, ` +
  `cache read ${fmt(totals.cacheRead)}, cache write ${fmt(totals.cacheWrite)})\n` +
  `  models: ${Object.entries(models).sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${m} ${fmt(n)}`).join(", ")}\n` +
  `\nwrote ${OUT}`
);

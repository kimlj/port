#!/usr/bin/env node
/**
 * Aggregate a ChatGPT data export into assets/chatgpt-history.json.
 *
 * This exists for ONE figure the rest of the section cannot state. The Claude
 * Code panel starts on 2025-10-19 because that is when those transcripts start,
 * and the GitHub calendars start when the account did; neither can date the
 * habit itself. The export can: the first conversation is 11 Dec 2022, eleven
 * days after ChatGPT opened to the public.
 *
 *     node scripts/fetch-chatgpt-history.mjs [export path ...]
 *
 * With no arguments it looks for ~/Downloads/OpenAI-export. An argument may be
 * the export folder, the `Conversations__*.zip` inside it, or a folder already
 * unzipped. Several may be given at once.
 *
 * PASS EVERY EXPORT YOU STILL HAVE, because this file has no archive merge and
 * must not grow one. OpenAI exports are requested by hand and each is a fresh
 * snapshot, so a conversation deleted since the last one is simply gone from the
 * next. Max-merging two runs' aggregates would then keep a day in `activeDays`
 * whose conversations had left `conversations` - the same numerator/denominator
 * split that made fetch-claude-usage.mjs publish a falling token rate while the
 * work rose. Instead every export given in one run is deduplicated by
 * conversation id, so the figures are always computed from one set of ids.
 *
 * PRIVACY. An export contains everything ever typed into ChatGPT. Five things
 * are read per conversation - its id, its create_time, and per message the
 * author's role, its create_time, and whether a text part contains a fenced code
 * block - and the output is counts and two dates. Titles are never read: a title
 * is content, and the ones in here name private repositories, clients and
 * things that are nobody's business. Nothing from the export is copied into this
 * repository, which is also why the default path is outside it.
 */

import { openSync, readSync, closeSync, statSync, readFileSync, readdirSync,
         writeFileSync, mkdirSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { homedir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/chatgpt-history.json");

/* ChatGPT opened to the public on 30 Nov 2022. Hardcoded because it is history,
   not data: it is the thing `firstDay` is being measured against, and the page
   states the gap between them rather than either date on its own. */
const LAUNCH_DAY = "2022-11-30";

const CONV_FILE = /^conversations(-\d+)?\.json$/;

/* ── zip, the 80 lines of it this needs ──────────────────────────────────────
   The conversations arrive as a 450MB zip and the repo has no dependencies to
   add one to. Read from the tail inwards - the central directory says where each
   entry's bytes are - so only the JSON shards are ever inflated and the archive
   is never held in memory whole. */

function zipEntries(path) {
  const fd = openSync(path, "r");
  try {
    const size = statSync(path).size;
    const tailLen = Math.min(65557, size);          /* EOCD + max comment */
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, size - tailLen);

    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error(`not a zip file: ${path}`);

    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
      throw new Error(`${path} is a zip64 archive; unzip it and pass the folder`);
    }

    const cd = Buffer.alloc(cdSize);
    readSync(fd, cd, 0, cdSize, cdOffset);

    const entries = [];
    let p = 0;
    while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
      const nameLen = cd.readUInt16LE(p + 28);
      entries.push({
        name: cd.toString("utf8", p + 46, p + 46 + nameLen),
        method: cd.readUInt16LE(p + 10),
        compSize: cd.readUInt32LE(p + 20),
        localOffset: cd.readUInt32LE(p + 42),
      });
      p += 46 + nameLen + cd.readUInt16LE(p + 30) + cd.readUInt16LE(p + 32);
    }
    return { fd, entries, close: () => closeSync(fd) };
  } catch (err) {
    closeSync(fd);
    throw err;
  }
}

function zipRead(fd, entry) {
  /* The central directory's name and extra lengths are not always the local
     header's, so the data offset is taken from the local header itself. */
  const head = Buffer.alloc(30);
  readSync(fd, head, 0, 30, entry.localOffset);
  const start = entry.localOffset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const raw = Buffer.alloc(entry.compSize);
  readSync(fd, raw, 0, entry.compSize, start);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported compression ${entry.method} in ${entry.name}`);
}

/* ── finding the shards ─────────────────────────────────────────────────────── */

/* Yields [label, buffer] for every conversations JSON in an export, whatever
   shape the export was handed over in. */
function* shards(input) {
  let st;
  try { st = statSync(input); } catch { throw new Error(`no such path: ${input}`); }

  if (st.isFile()) {
    if (input.toLowerCase().endsWith(".zip")) {
      const z = zipEntries(input);
      try {
        for (const e of z.entries) {
          if (CONV_FILE.test(basename(e.name))) {
            yield [`${basename(input)}:${e.name}`, zipRead(z.fd, e)];
          }
        }
      } finally { z.close(); }
      return;
    }
    yield [basename(input), readFileSync(input)];
    return;
  }

  /* A folder: the conversations may be loose in it, or still zipped one level
     down in "User Online Activity". Recurse rather than guess at the layout,
     which has changed twice across the exports on this machine. */
  for (const name of readdirSync(input)) {
    const p = join(input, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) { yield* shards(p); continue; }
    if (CONV_FILE.test(name)) yield [p, readFileSync(p)];
    /* Only the conversations zip. The others carry uploaded files and personal
       info, and there is nothing in them this file is allowed to publish. */
    else if (/^Conversations__.*\.zip$/i.test(name)) yield* shards(p);
  }
}

/* ── the aggregate ──────────────────────────────────────────────────────────── */

const inputs = process.argv.slice(2);
if (!inputs.length) inputs.push(join(homedir(), "Downloads", "OpenAI-export"));

const seen = new Set();               /* conversation id -> counted already */
const days = new Set();               /* date -> had at least one message */
const byYear = {};                    /* year -> { conversations, messages } */
let conversations = 0, messages = 0, withCode = 0, duplicates = 0;
let firstMs = null, lastMs = null;
let shardCount = 0;

function year(y) {
  return (byYear[y] ||= { conversations: 0, messages: 0 });
}

for (const input of inputs) {
  for (const [label, buf] of shards(input)) {
    shardCount++;
    let list;
    try { list = JSON.parse(buf.toString("utf8")); } catch {
      console.warn(`skipped unparseable shard ${label}`);
      continue;
    }
    if (!Array.isArray(list)) continue;

    for (const conv of list) {
      /* Deduplicated across every export given, so passing an old snapshot
         alongside a new one recovers deleted conversations without counting the
         overlap twice. */
      const id = conv && (conv.id || conv.conversation_id);
      if (id) {
        if (seen.has(id)) { duplicates++; continue; }
        seen.add(id);
      }
      conversations++;

      let hasCode = false;
      let convYear = null;
      const mapping = (conv && conv.mapping) || {};
      for (const node of Object.values(mapping)) {
        const msg = node && node.message;
        if (!msg) continue;
        const role = msg.author && msg.author.role;
        if (role !== "user" && role !== "assistant") continue;   /* skip system, tools */
        messages++;

        const t = msg.create_time;
        if (t) {
          const ms = t * 1000;
          const iso = new Date(ms).toISOString().slice(0, 10);
          days.add(iso);
          const y = iso.slice(0, 4);
          year(y).messages++;
          if (convYear === null || y < convYear) convYear = y;
          if (firstMs === null || ms < firstMs) firstMs = ms;
          if (lastMs === null || ms > lastMs) lastMs = ms;
        }

        /* The only thing the text itself is inspected for, and all that leaves
           this loop is a boolean. A fenced block is the mechanical definition of
           "this conversation was about code": no classifier, no judgement, and a
           reader can reproduce the count from their own export. */
        const parts = (msg.content && msg.content.parts) || [];
        for (const part of parts) {
          if (typeof part === "string" && part.includes("```")) { hasCode = true; break; }
        }
      }
      if (hasCode) withCode++;
      if (convYear) year(convYear).conversations++;
    }
  }
}

if (!conversations) {
  console.error(
    `no conversations found in:\n  ${inputs.join("\n  ")}\n\n` +
    `Request an export from ChatGPT (Settings -> Data controls -> Export data),\n` +
    `then pass the folder it unzipped to.`
  );
  process.exit(1);
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const firstDay = iso(firstMs);
const daysAfterLaunch = Math.round(
  (Date.parse(firstDay + "T00:00:00Z") - Date.parse(LAUNCH_DAY + "T00:00:00Z")) / 86400000
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "ChatGPT data export (conversations.json), aggregated locally",
    /* Stated in the payload because the page has to say it: unlike the other two
       files in this folder, nothing refreshes this one. There is no API behind
       it - an export is requested by hand and emailed - so these figures are
       true as of generatedAt and stay that way until someone runs this again. */
    refresh: "manual: request a new ChatGPT export and re-run this script",
    firstDay,
    lastDay: iso(lastMs),
    activeDays: days.size,
    conversations,
    messages,
    withCode,
    launchDay: LAUNCH_DAY,
    daysAfterLaunch,
    byYear,
  }),
  "utf8"
);

const fmt = (n) => n.toLocaleString("en-US");
console.log(
  `read ${shardCount} shard(s) from ${inputs.length} export(s)` +
  (duplicates ? `, skipped ${fmt(duplicates)} duplicate conversation(s)` : "") + `\n` +
  `${fmt(conversations)} conversations, ${fmt(messages)} messages ` +
  `(user + assistant), ${fmt(days.size)} active days\n` +
  `${fmt(withCode)} conversations carry a fenced code block ` +
  `(${Math.round((withCode / conversations) * 100)}%)\n` +
  `${firstDay} -> ${iso(lastMs)}, ` +
  `${daysAfterLaunch} day(s) after ChatGPT opened on ${LAUNCH_DAY}\n` +
  `by year: ${Object.keys(byYear).sort().map(function (y) {
      return `${y} ${fmt(byYear[y].conversations)}c/${fmt(byYear[y].messages)}m`;
    }).join(", ")}\n` +
  `\nwrote ${OUT}`
);

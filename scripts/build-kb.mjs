#!/usr/bin/env node
// Generates lib/kb.json — everything the site assistant is allowed to know.
//
// The point of generating it rather than writing it: the page and the assistant
// cannot disagree, because there is only one copy of each fact. Add a project to
// index.html and the assistant knows it; delete one and it forgets. Nothing here
// is authored, so nothing here can be invented.
//
//   node scripts/build-kb.mjs           write lib/kb.json
//   node scripts/build-kb.mjs --check   exit 1 if stale, for CI
//
// Two sources:
//
//   Kim_Julongbayan_Resume.docx   employment dates, education, titles. The owner
//                                 keeps it current, so it wins on anything it
//                                 states. Read straight out of the .docx so
//                                 there is no third copy to update.
//   index.html                    projects, AI systems, skills, about. Richer
//                                 than the resume and the only source for most
//                                 of it.
//
// Conflicts are recorded, never silently resolved. An assistant holding two
// versions of one fact answers differently on different days, and that reads as
// making things up. `conflicts` in the output is the list of things to fix on
// the page; the prompt tells the model the resume wins meanwhile.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');
const DOCX = join(ROOT, 'Kim_Julongbayan_Resume.docx');
const OUT = join(ROOT, 'lib', 'kb.json');

const warnings = [];
const warn = (m) => warnings.push(m);

/* --------------------------------------------------------------- html text */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', middot: '·', hellip: '…',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  times: '×', deg: '°', copy: '©'
};

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
}

// Tags out, entities decoded, whitespace collapsed. <br> becomes a space rather
// than vanishing, so "Players<br>reached a game" does not run together.
function text(html) {
  if (!html) return '';
  return decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Every substring that starts at a tag carrying `cls`, running to the next such
// tag. Good enough for repeated sibling blocks, which is all this page has, and
// it saves pulling in a DOM parser this repo has nowhere to put.
function blocks(html, cls) {
  const open = new RegExp(`<(\\w+)[^>]*class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>`, 'g');
  const starts = [];
  let m;
  while ((m = open.exec(html))) starts.push(m.index);
  return starts.map((s, i) => html.slice(s, starts[i + 1] ?? html.length));
}

function attr(html, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(html);
  return m ? decode(m[1]) : '';
}

// Inner HTML of the first element carrying `cls`, counting nesting of its own
// tag name so `.skill-where` (a span full of spans) ends where it really ends
// rather than at the first </span>.
function innerOf(html, cls) {
  const m = new RegExp(`<(\\w+)[^>]*class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>`).exec(html);
  if (!m) return '';
  const tag = m[1];
  const from = m.index + m[0].length;
  const scan = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  scan.lastIndex = from;
  let depth = 1;
  let t;
  while ((t = scan.exec(html))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return html.slice(from, t.index);
  }
  return html.slice(from);
}

const firstOf = (html, cls) => text(innerOf(html, cls));

// Text of every <tag>…</tag>, non-greedy. For <li> and <p> runs with no class.
function tags(html, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    const t = text(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function section(html, id) {
  const i = html.indexOf(`<section id="${id}"`);
  if (i < 0) {
    warn(`section #${id} not found — the page may have been restructured`);
    return '';
  }
  const j = html.indexOf('</section>', i);
  return html.slice(i, j < 0 ? html.length : j);
}

/* ------------------------------------------------------------------- .docx */

// A .docx is a zip. Read the central directory rather than the local headers —
// local headers may defer their sizes to a trailing data descriptor, the
// central directory never does.
function unzipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const localAt = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (name === wanted) {
      const lnLen = buf.readUInt16LE(localAt + 26);
      const leLen = buf.readUInt16LE(localAt + 28);
      const start = localAt + 30 + lnLen + leLen;
      const raw = buf.subarray(start, start + compSize);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  throw new Error(`no ${wanted} inside the archive`);
}

function readResume() {
  if (!existsSync(DOCX)) {
    warn('resume .docx not found — employment dates and education will be missing');
    return null;
  }

  const xml = unzipEntry(readFileSync(DOCX), 'word/document.xml').toString('utf8');
  const lines = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => decode(l).replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  // The document is flat: an ALL-CAPS line is a heading and everything under it
  // belongs to it. Parsing by shape rather than by line number, so reordering a
  // section of the resume does not break this.
  const headings = {};
  let key = 'HEADER';
  headings[key] = [];
  for (const line of lines) {
    if (/^[A-Z][A-Z &]{3,}$/.test(line)) {
      key = line.trim();
      headings[key] ??= [];
    } else {
      headings[key].push(line);
    }
  }
  // The name is ALL CAPS and so becomes a heading key of its own, which leaves
  // the contact line under it rather than under HEADER. Keep the flat list too.
  headings._all = lines;
  return headings;
}

/* ------------------------------------------------------------------- parse */

const html = readFileSync(HTML, 'utf8');
const resume = readResume();

// -- identity ---------------------------------------------------------------

const heroStart = html.indexOf('<section class="hero"');
const hero = html.slice(heroStart, html.indexOf('</section>', heroStart));
const header = resume?._all?.join(' | ') ?? '';

const identity = {
  name: 'Kim Julongbayan',
  title: firstOf(hero, 'hero-label'),
  summary: firstOf(hero, 'hero-sub'),
  location: (/([A-Z][a-z]+ City, Metro Manila, Philippines)/.exec(header) || [, ''])[1],
  email: 'kljulongbayan@gmail.com',
  site: 'https://kimlj.dev',
  github: 'https://github.com/kimlj',
  linkedin: 'https://www.linkedin.com/in/kimjulongbayan',
  resume: 'https://kimlj.dev/Kim_Julongbayan_Resume.pdf'
};

// -- projects ---------------------------------------------------------------

const projects = blocks(section(html, 'projects'), 'work-item')
  .map((b) => {
    const nums = blocks(b, 'project-metric-num').map((m) => text(m.split('</div>')[0]));
    const labels = blocks(b, 'project-metric-label').map((m) => text(m.split('</div>')[0]));
    return {
      name: attr(b, 'data-name'),
      category: attr(b, 'data-class'),
      tag: firstOf(b, 'project-tag'),
      status: firstOf(b, 'project-status'),
      url: (/<a href="(https?:[^"]+)"[^>]*class="[^"]*project-card/.exec(b) || [, ''])[1],
      summary: tags(b.split('project-tech')[0], 'p').filter((p) => p.length > 60)[0] || '',
      role: firstOf(b, 'project-role'),
      points: tags(b, 'li'),
      tech: blocks(b, 'project-tech').flatMap((t) => tags(t, 'span')),
      metrics: nums.map((v, i) => ({ value: v, of: labels[i] || '' })).filter((m) => m.value),
      note: firstOf(b, 'project-metrics-note')
    };
  })
  .filter((p) => p.name);

if (!projects.length) warn('no projects parsed from #projects');

// -- AI showcase ------------------------------------------------------------

const aiSystems = blocks(section(html, 'ai-showcase'), 'ai-tab-content')
  .map((b) => ({
    name: attr(b, 'data-name'),
    model: attr(b, 'data-model'),
    guard: attr(b, 'data-guard'),
    context: attr(b, 'data-bar'),
    summary: firstOf(b, 'ev-lede'),
    points: tags(b, 'li').slice(0, 8)
  }))
  .filter((s) => s.name);

if (!aiSystems.length) warn('no AI systems parsed from #ai-showcase');

// -- skills -----------------------------------------------------------------

const skillsSection = section(html, 'skills');

const skills = blocks(skillsSection, 'skill-group')
  .map((g) => ({
    group: firstOf(g, 'skill-group-title'),
    items: blocks(g, 'skill-row')
      .map((r) => ({
        name: firstOf(r, 'skill-name'),
        usedIn: tags(innerOf(r, "skill-where"), "span")
      }))
      .filter((i) => i.name)
  }))
  .filter((g) => g.items.length);

// The one block on the page that makes no provenance claim. Carried separately
// and flagged, so the assistant can never present these as demonstrated work —
// which is the whole argument section 04 is making.
const aside = blocks(skillsSection, 'skill-aside')[0] || '';
const alsoFamiliar = {
  claim: 'comfort only — no project on this site demonstrates these',
  note: firstOf(aside, 'skill-aside-note'),
  items: tags(innerOf(aside, 'skill-aside-list'), 'span')
};

// -- experience -------------------------------------------------------------

const xpSection = section(html, 'experience');

const pageExperience = blocks(xpSection, 'xp-row')
  .map((r) => ({
    when: firstOf(r, 'xp-when'),
    role: firstOf(r, 'xp-role'),
    at: firstOf(r, 'xp-at'),
    detail: firstOf(r, 'xp-body'),
    points: [],
    source: 'page'
  }))
  .filter((e) => e.role);

const availability = firstOf(xpSection, 'availability-badge');

// -- about ------------------------------------------------------------------

const about = blocks(section(html, 'about'), 'about-text').flatMap((b) => tags(b, 'p'));

// -- build activity ---------------------------------------------------------

function loadJson(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) {
    warn(`${rel} missing — activity figures will be absent`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    warn(`${rel} is not valid JSON`);
    return null;
  }
}

const contributions = loadJson('assets/contributions.json');
const usage = loadJson('assets/claude-usage.json');

// Working days, not calendar days — the figure the page quotes.
function perWorkingDay(byDay, total) {
  if (!byDay || !total) return null;
  const days = Object.keys(byDay).filter((d) => {
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    return wd !== 0 && wd !== 6;
  }).length;
  return days ? Number((total / days).toFixed(1)) : null;
}

const thisYear = String(new Date().getUTCFullYear());

const activity = {
  // Both files are snapshots, not live feeds. Saying so is the difference
  // between a stale figure being honest and being wrong.
  isSnapshot: true,
  asOf: (contributions?.generatedAt || usage?.generatedAt || '').slice(0, 10),
  contributions: contributions && {
    thisYear: contributions.years?.[thisYear]?.total ?? null,
    byYear: Object.fromEntries(
      Object.entries(contributions.years ?? {}).map(([y, v]) => [y, v.total])
    ),
    includesPrivate: contributions.includesPrivate === true
  },
  claudeCode: usage && {
    totalHours: usage.hours?.total ?? null,
    sessions: usage.hours?.sessions ?? null,
    longestSessionHours: usage.hours?.longestSessionHours ?? null,
    hoursPerWorkingDay: perWorkingDay(usage.hours?.byDay, usage.hours?.total)
  }
};

// -- resume -----------------------------------------------------------------

const resumeFacts = resume
  ? {
      summary: resume['PROFESSIONAL SUMMARY'] ?? [],
      technicalSkills: resume['TECHNICAL SKILLS'] ?? [],
      experience: resume.EXPERIENCE ?? [],
      projects: resume.PROJECTS ?? [],
      education: resume.EDUCATION ?? []
    }
  : null;

/* ------------------------------------------------------- experience, merged */

// The page's Experience section is not the whole employment history — the MDS
// Pro contract lives on the page as a project card instead, and the resume is
// where the role, the dates and the bullets are written down. So the two are
// merged rather than compared: a role the resume states and the page does not
// show is still a role, and the assistant should answer with it.
//
// A resume line reading "<employer> - <role> | <dates>" opens an entry, and
// every line under it until the next such line is one of its bullets.
function resumeRoles(lines) {
  const out = [];
  for (const line of lines) {
    if (line.includes('|')) {
      const [lhs, when] = line.split('|').map((s) => s.trim());
      const [a, b] = lhs.split(' - ').map((s) => s.trim());
      out.push({
        when,
        role: b || a,
        at: b ? a : '',
        detail: '',
        points: [],
        source: 'resume'
      });
    } else if (out.length) {
      out[out.length - 1].points.push(line);
    }
  }
  return out;
}

const roles = resumeFacts ? resumeRoles(resumeFacts.experience) : [];

// Match on the first word of the employer, else the role text — enough to tell
// "Independent Full Stack Developer" on both sides apart from a new employer.
const sameRole = (r, e) => {
  const key = (r.at || r.role).toLowerCase().split(' ')[0];
  return (
    e.role.toLowerCase().includes(key) ||
    e.at.toLowerCase().includes(key) ||
    e.role.toLowerCase() === r.role.toLowerCase()
  );
};

const experience = [
  // Resume order first: it leads with the current role, which is the answer to
  // the question people actually ask.
  ...roles.map((r) => {
    const onPage = pageExperience.find((e) => sameRole(r, e));
    return {
      ...r,
      // Keep the page's prose where there is some — it is written for a reader,
      // the resume bullets are written for a scanner.
      detail: onPage?.detail || '',
      onPage: Boolean(onPage)
    };
  }),
  // Anything the page carries that the resume does not — education, chiefly.
  ...pageExperience
    .filter((e) => !roles.some((r) => sameRole(r, e)))
    .map((e) => ({ ...e, onPage: true }))
];

/* --------------------------------------------------------------- conflicts */

const conflicts = [];

if (resumeFacts) {
  for (const r of roles) {
    const onPage = pageExperience.find((e) => sameRole(r, e));
    if (onPage && r.when && onPage.when && normDate(r.when) !== normDate(onPage.when)) {
      conflicts.push({
        field: 'experience.when',
        resume: `${r.role}: ${r.when}`,
        page: `${onPage.role}: ${onPage.when}`,
        note: 'Dates differ. The resume is authoritative.'
      });
    }
  }

  // The professional summary and the page's hero lede say the same thing in the
  // same words, so a clause added to one and not the other is a real drift.
  const rSum = (resumeFacts.summary[0] || '').toLowerCase();
  const pSum = identity.summary.toLowerCase();
  if (rSum && pSum) {
    for (const clause of rSum.split(/[-—,]/).map((s) => s.trim())) {
      if (clause.length > 24 && !pSum.includes(clause.slice(0, 24))) {
        conflicts.push({
          field: 'identity.summary',
          resume: clause,
          page: null,
          note: 'In the resume summary but not in the page hero lede.'
        });
      }
    }
  }
}

function normDate(s) {
  return s.replace(/[\s–—-]/g, '').toLowerCase();
}

/* ---------------------------------------------------------------- assemble */

const kb = {
  generatedAt: new Date().toISOString(),
  generatedBy: 'scripts/build-kb.mjs',
  sources: {
    page: createHash('sha256').update(html).digest('hex').slice(0, 12),
    resume: existsSync(DOCX)
      ? createHash('sha256').update(readFileSync(DOCX)).digest('hex').slice(0, 12)
      : null
  },
  identity,
  projects,
  activity,
  aiSystems,
  skills,
  alsoFamiliar,
  experience,
  availability,
  about,
  resume: resumeFacts,
  conflicts
};

const json = JSON.stringify(kb, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const strip = (s) => s.replace(/^\s*"generatedAt": "[^"]*",\n/m, '');
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (strip(current) !== strip(json)) {
    console.error('lib/kb.json is stale — run: node scripts/build-kb.mjs');
    process.exit(1);
  }
  console.log('lib/kb.json is up to date.');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, json);

const skillCount = skills.reduce((n, g) => n + g.items.length, 0);
console.log(
  `lib/kb.json — ${projects.length} projects, ${aiSystems.length} AI systems, ` +
    `${skillCount} skills, ${experience.length} experience rows, ` +
    `${(json.length / 1024).toFixed(1)} KB`
);

for (const w of warnings) console.warn(`  warning: ${w}`);

if (conflicts.length) {
  const n = conflicts.length;
  console.warn(`\n  ${n} page/resume conflict${n > 1 ? 's' : ''} — the resume wins, the page should be fixed:`);
  for (const c of conflicts) {
    console.warn(`    [${c.field}] ${c.resume}`);
    console.warn(`      page: ${c.page ?? '(absent)'} — ${c.note}`);
  }
}

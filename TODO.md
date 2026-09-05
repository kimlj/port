# TODO

Open work on the portfolio. See `CLAUDE.md` for how the codebase is put together
and the traps it has already sprung.


## Site assistant for kimlj.dev

Build a scoped chatbot for this portfolio, modelled on the one already running on
mdsprosolutions.com. The point is not that it answers — it is that it **cannot
answer outside what it was given**, which is the part worth showing on a
developer's portfolio.

**Knowledge base:** the projects, the skills, the resume, the experience timeline
and the build-activity figures — the same facts the page already states, kept in
one file so the site and the assistant can never disagree.

### What to copy from the MDS Pro build

Read `chat.js` on mdsprosolutions.com and its `api/chat.js`. The parts that make
it trustworthy rather than merely working:

- **No tools and no database.** It answers from a fixed knowledge file, so there
  is nothing for it to invent from. This is the whole design, not a limitation.
- **Out of scope hands off** instead of guessing. There, the question goes to the
  team with a name and email. Here the equivalent is the existing pitch form —
  the assistant should offer it, not improvise an answer about availability,
  rates or anything else not in the file.
- **Never render model output as HTML.** `createElement` and `textContent`
  throughout. Plain text by instruction is not a guarantee worth betting a script
  injection on.
- **A short-lived signed ticket per session** (`/api/chat-ticket`), so the
  endpoint answers this page rather than anyone who found the URL.
- **Load-event deferred, self-injected stylesheet.** The widget must never
  compete with the hero for bandwidth.

### Extra care needed here that MDS Pro did not need

- **Spend caps.** A public portfolio is a spam target in a way a clinic site is
  not. Per-session and per-day ceilings, plus the Turnstile already wired up for
  the pitch form.
- **Prompt-injection surface.** The knowledge file is authored, so the risk is
  the visitor's question, not the corpus — but the reply still gets rendered, so
  the no-innerHTML rule is load-bearing.
- **Keep the knowledge file generated from the page** if practical, rather than
  hand-maintained beside it. Two copies of the same facts drift.

### Then

Once it is live, it becomes the honest centrepiece of the AI section — a working
scoped assistant on the page itself beats any description of one. See the section
study for the shape that would take.


## Live figures for Build Activity

Both charts are **static snapshots**, not live. `assets/contributions.json` and
`assets/claude-usage.json` were both generated on **1 Sep 2026** by the scripts
in `scripts/`, and neither has moved since — the numbers on the page are the
numbers as of that day, and they will stay that way until someone runs the
scripts and commits the result.

Neither can be fetched from the browser, and that is a constraint rather than an
oversight:

- **GitHub contributions** need the GraphQL calendar API, which requires an
  authenticated token. A token that reaches the browser is a token that has
  leaked. `scripts/fetch-contributions.mjs` uses the `gh` CLI's own auth, so
  there is nothing to paste or rotate — but it has to run somewhere trusted.
- **Claude Code hours** only exist as session transcripts under
  `~/.claude/projects/**/*.jsonl` on the machine that did the work. There is no
  API to ask: the Usage & Cost Admin API covers API keys, not a subscription,
  and returns 401 for an individual account. `scripts/fetch-claude-usage.mjs`
  reads those transcripts locally.

So "real time" means *automatically refreshed*, not *fetched live by the page*.
Three ways to get there, cheapest first:

1. **A scheduled GitHub Action.** Runs both scripts on a cron, commits the two
   JSON files, Vercel redeploys on the push. Free, no server, no new secret
   beyond a repo-scoped token. This gets the GitHub half fully automatic.
   It cannot get the Claude half — the transcripts are on this machine, not in
   the repo, and should not be.

2. **A push from this machine.** A scheduled task runs the usage script and
   POSTs the JSON to an endpoint, which stores it and serves it to the page.
   Needs somewhere to receive it — a Vercel function plus a store, or the VPS.
   The endpoint must be authenticated, or anyone can rewrite the figures on the
   page.

3. **The VPS as the source of truth for both.** A cron there pulls contributions
   and receives the pushed usage; the page fetches from it instead of from
   static JSON. Most moving parts, and it puts a runtime dependency in front of
   a section that currently cannot fail — worth it only if the figures should be
   genuinely current rather than genuinely recent.

Whichever way, two things the page needs either way:

- **Say when.** A dateline on the panel — "as of 1 Sep 2026" — so a stale figure
  is honest rather than wrong. This is worth doing today, independently of any
  of the above.
- **Keep the static file as the fallback.** If a fetch fails the section should
  fall back to the committed JSON, not disappear. The panels already remove
  themselves on a failed fetch; that is the right instinct for a missing chart
  and the wrong one for a chart that has a slightly old copy on disk.


## Redesign Skills, Experience and About

Sections 04, 05 and 06 are the last three still on the original design, and they
read as template. Agreed 5 Sep 2026; not started.

### What is actually wrong

**Three box-grids in a row.** Skills is four icon cards, the Experience sidebar
is six icon rows, About is four stat cards — the same atom (icon, bold label,
grey blurb) three times running. That is why Skills and About feel like the same
section: the page has one shape doing three different jobs.

**They assert where the rest of the page shows.** The reader arrives straight out
of an evidence ledger where every system carries the constraint it is held to,
and lands on *"Attention to Detail — Meticulous in identifying bugs, edge cases,
and quality issues."* That is a drop in rigour from the section directly above
it. *Analytical Thinking* and *English Proficiency* are the same problem.

**The tech list appears three times.** The marquee, the expertise cards restating
it as prose, then About's second paragraph naming it again — three recitations
within two sections.

**Two of the four stat cards are not numbers.** `Full` and `AI` sit in a
`stat-number` slot beside two that genuinely count up, so the row reads as
padding.

**The marquee is decorative rather than readable.** Scrolling text cannot be
scanned, searched or linked to.

### The shape to aim for

Three different shapes, with density falling as the reader approaches the contact
form — 04 a list, 05 two rows of prose, 06 a single measured column. Right now
density stays flat and boxy the whole way down.

**Skills becomes the legend for the rest of the page.** Marquee and cards go.
In their place, a two-column typeset list where each technology names where on
this site it was used:

    TypeScript   ·  WordWarz.io   MDS Pro   RecodeAI   kimlj.dev
    Python       ·  Avatar pipeline   Job Email Watcher
    ComfyUI      ·  Avatar pipeline   Style transfer   Fashion generation

Serif for the technology, mono for the provenance — the ledger's typography, but
a list rather than rows, so section 04 does not become a third index after
Selected Work and the AI Showcase. It ties 04 back to 01 and 03, and it answers
the question a reader actually has (how much has this been used) rather than the
one they do not (is the name known).

**Experience loses the apparatus and keeps the substance.** Two entries do not
need a progress rail, ripple dots and a sidebar; the chrome outweighs the
content. Two rows: mono date column, serif role, prose underneath.

Key Strengths comes out entirely. The claims are already made better elsewhere —
the showcase demonstrates AI/LLM proficiency, Build Activity demonstrates
consistency, the guard column demonstrates attention to detail. The *Open to
remote work* badge stays; it is real and actionable.

**About becomes one column of prose.** With the technology list living in Skills
with receipts, About's second paragraph goes. Two paragraphs on how the work is
done rather than what is known.

The stat cards go with it. Either all four are real checkable figures or the row
should not exist — and there are real ones on the page now (2,253 contributions
this year, 817 sessions, 5.1 hrs per working day, 66 avatars, 8 AI systems). One
quiet line of those under the portrait, which also ties 06 back to 02.

### Settle before starting

- **The technology → project mapping has to come from the owner.** It is the
  whole value of the Skills idea and it cannot be guessed at. Invented provenance
  on a page that argues against hallucination is the same own goal as the
  illustrative transcripts below.
- **Dropping Key Strengths and the stat cards is a content decision, not a layout
  one.** If they are there because a recruiter asked for them, redesign them
  instead of removing them.
- The label reads `05 / Journey` while the heading reads `Experience`. Pick one.

Cost is roughly 88 CSS references across `skills-marquee`, `skill-chip`,
`expertise-`, `timeline`, `competency-`, `sidebar-card`, `availability-`,
`about-` and `stat-card`, most of them deletions. Start with Skills — it carries
the most weight in the plan, and Experience and About are partly subtraction once
it exists.


## Smaller, unscheduled

- **Two AI transcripts are illustrative.** The behaviour in `ai-ledger.js` is read
  from the real `chat.js` on mdsprosolutions.com; the wording is invented and
  labelled as such in the source. Replace both with captured exchanges before
  showing the page to anyone — a fabricated transcript on a section arguing
  against hallucination is the worst possible own goal.
- **`assets/js/semantic-bloom.js` is untracked and unreferenced.** It predates the
  current site. Delete it or wire it up.
- **The mid-page CTAs still use the old hover idiom.** "Start a Project" keeps its
  lift-and-glow while the hero's primary lost it when the dot field replaced it,
  so the two `.btn-primary`s behave differently.
- **Style Transfer may be coming out of the AI section.** Raised, then set aside
  mid-task; nothing was removed. It would be its panel and its row, with Fashion
  generation staying.

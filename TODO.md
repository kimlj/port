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

Half automated, half not. The two charts are still **committed snapshots** — the
page reads `assets/contributions.json` and `assets/claude-usage.json` and talks
to nothing — but the GitHub half now refreshes itself, and both halves say on the
page when they were taken.

Neither can be fetched from the browser, and that is a constraint rather than an
oversight:

- **GitHub contributions** need the GraphQL calendar API, which requires an
  authenticated token. A token that reaches the browser is a token that has
  leaked. `scripts/fetch-contributions.mjs` uses the `gh` CLI's own auth.
- **Claude Code hours** only exist as session transcripts under
  `~/.claude/projects/**/*.jsonl` on the machine that did the work. There is no
  API to ask: the Usage & Cost Admin API covers API keys, not a subscription,
  and returns 401 for an individual account. `scripts/fetch-claude-usage.mjs`
  reads those transcripts locally.

So "live" means *automatically refreshed*, not *fetched by the page*.

### Done

- **`.github/workflows/refresh-activity.yml`** runs the contributions script
  daily at 16:10 UTC (00:10 Manila, so it picks up the day GitHub just closed),
  commits the file if it moved, and lets Vercel redeploy on the push.
- **A dateline on each half**, built from the `generatedAt` both payloads
  already carried. The halves refresh on different schedules, so each states its
  own date rather than sharing one that would describe the older of them.
- **The cache headers**, which would have silently defeated all of this:
  everything under `assets/` was `immutable` for a year, so a returning visitor
  would never have seen a refreshed figure. Scripts and JSON revalidate now.

### Still to do

**The workflow needs its secret before it can run.** `CONTRIBUTIONS_TOKEN`, a
PAT with `repo` and `read:user`, under Settings → Secrets and variables →
Actions. The workflow's own `GITHUB_TOKEN` cannot stand in: it is scoped to this
repository, and ~93% of this account's contributions are in private repos it
cannot see. The run fails loudly rather than publishing a number 20x too small —
there is an explicit check for a zero private count.

**The Claude Code half is still manual.** `node scripts/fetch-claude-usage.mjs`,
then commit. It cannot move to the runner, because the transcripts are on this
machine and should not be in the repo. Two ways to automate it, and the choice
has not been made:

1. **A scheduled task on this machine** that runs the script, commits the one
   file and pushes. No new secret and no new infrastructure — this machine
   already has the repo and a git remote. Only runs when the machine is on,
   which makes the figure genuinely recent rather than genuinely current. Needs
   care: it must touch only that file, and never fight a branch being worked on.

2. **A push to an endpoint.** A scheduled task POSTs the JSON to a Vercel
   function that stores it and serves it. Adds a store, an endpoint and a shared
   secret, and puts a runtime dependency in front of a section that currently
   cannot fail. Only worth it if the figure has to be current to the hour.

If neither is built, the dateline is doing its job: the page says how old the
number is instead of implying it is today's.

**The fallback only matters once something is fetched at runtime.** Today both
files ship with the deploy, so a failed fetch means a failed deploy. If option 2
is ever built, the page must fall back to the committed JSON rather than
removing the panel, which is what the four `.catch` handlers do now.


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

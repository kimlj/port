# TODO

Open work on the portfolio. See `CLAUDE.md` for how the codebase is put together
and the traps it has already sprung.


## Site assistant for kimlj.dev

Shipped. Its plan, its open questions and its known gaps moved to
`kimlj/port-assistant/TODO.md` when the assistant was split into that private
repo. The gaps list is the reason: it names what is not yet defended, and that
does not belong in a public repo.


## Live figures for Build Activity

Both halves refresh themselves now, and both say on the page when they were
taken. The two charts are still **committed snapshots** — the page reads
`assets/contributions.json` and `assets/claude-usage.json` and talks to nothing —
but each file is rewritten on a schedule rather than by hand: the GitHub half by
a workflow, the Claude half by a task on this machine.

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
- **`CONTRIBUTIONS_TOKEN` is set**, so the workflow actually runs. It is a PAT
  with `repo` and `read:user`; the workflow's own `GITHUB_TOKEN` cannot stand in,
  being scoped to this repository while ~93% of this account's contributions are
  in private repos it cannot see. The scheduled run has been succeeding since
  2026-09-05 — two failures that day were the setup attempts, not the schedule.
- **The Claude Code half refreshes from this machine.**
  `scripts/sync-claude-usage.mjs` reads the local transcripts, commits only
  `assets/claude-usage.json` and pushes; `scripts/install-usage-sync.ps1`
  registers it as a scheduled task at 22:00 daily, and at logon so a day the
  machine was off is caught up rather than skipped.

  It works in a clone of its own under `LOCALAPPDATA`, never in a working tree.
  A task that ran `git commit` in a checkout would eventually fire in the middle
  of an edit, on the wrong branch, or over a half-finished rebase; in its own
  clone it can hard-reset to `origin/main` every run without asking what state
  anything was left in. It runs the copy of itself inside that clone, so it
  always runs whatever is on `main`.

  The honest limit: it only fires while someone is signed in to this machine, so
  the figure is genuinely recent rather than genuinely current. That is inherent
  — the transcripts are here and nowhere else — and it is what the dateline on
  the panel is for.

### Still standing

**The fallback only matters once something is fetched at runtime.** Today both
files ship with the deploy, so a failed fetch means a failed deploy. If the page
is ever made to fetch either half, it must fall back to the committed JSON
rather than removing the panel, which is what the four `.catch` handlers do now.


## ChatGPT hours, beside the Claude Code ones

**Waiting on the export.** Requested 2026-09-08; OpenAI emails a download link
rather than serving it, so this starts when the zip arrives.

There is no usage API for a ChatGPT subscription. OpenAI's usage endpoints cover
API keys, which is the same wall the Claude Code half hit and for the same
reason — a subscription is not an API account. The export is the only route:
Settings → Data controls → Export data, which produces a zip whose
`conversations.json` carries `create_time` and `update_time` on every
conversation and every message.

What that supports, and what it does not:

- **Derivable**: active days, conversation and message counts, and hours under
  the same session model `fetch-claude-usage.mjs` already uses — consecutive
  activity, closed after 15 minutes of silence. The years are the point: heavy
  ChatGPT use through 2023 sits exactly on the GitHub year restored on
  2026-09-08, and the Build Activity panel currently has nothing to say about
  2021–2023 beyond contribution counts.
- **Not derivable**: tokens. The export carries no token accounting at all, so
  there is no ChatGPT equivalent of "tokens written back". State it as absent
  rather than estimating it — a made-up figure on the section that argues
  against unfounded claims is the own goal already recorded above.

Two rules any importer has to inherit:

- **Read timestamps and nothing else.** `conversations.json` is the full text of
  every conversation, which is far more sensitive than the Claude transcripts —
  it is not scoped to one machine's work. The existing script's design is the
  precedent: four fields per line, never `message.content`, output is numbers per
  date with no text of any kind.
- **Archive the per-day breakdown from the first run.** The Claude half shipped
  a rate whose numerator came from disk and whose denominator came from the
  merged archive, so tokens-per-day *fell* as more work was done. Whatever this
  writes must total and count over the same map from day one — see the trap in
  `CLAUDE.md`.

The open question is framing, not code. The panel says "hours in Claude Code",
and the honest options are a second figure beside it or a relabelled one that
names both tools; a combined total that quietly folds in a different tool over a
different period would be the same sleight of hand the token figure already
refuses.

## Hub panel 6: the droplet

A sixth panel on `/hub`, after Shift Ops: the backend itself. Every panel so far
is a product; this one is the machine four of them run on, and a walkthrough
that ends at "and it is deployed" has nothing to point at.

**What it should show**, for DigitalOcean droplet `159.223.59.45`:

- **Health.** Up or down per service, and how long for: the MDS Pro API
  (`pm2 mdspro`, `127.0.0.1:8787/api/health`), the WordWarz game server, the
  Casinore API, and Caddy in front of them. Uptime, restart count (mdspro sat at
  158 on 2026-09-13), memory and CPU per process, and the box's own load, disk
  and memory headroom.
- **What is deployed.** For each repository on the box: the commit it is on,
  whether that is `origin/main` or behind it and by how much, and whether the
  working tree is dirty. The MDS Pro deploy script already logs a line per run
  in `/root/deploy-mdspro.log` - the last few runs, their result and duration,
  and whether they skipped the rebuild.
- **What runs on a schedule.** The crontab and any systemd timers, each with
  its last run, its exit status and its next run. The GitHub Actions that
  reach the box (`deploy-api.yml`) belong here too, from the Actions API.
- **What is happening.** A tail of recent log lines per service, and the TLS
  certificates Caddy holds with their expiry dates.
- **Project files.** Which directories on the box belong to which project, and
  what is in them at the top level - enough to answer "where does this live"
  without an SSH session on a recording.

**How it has to be built**, because the hub's existing rules decide most of it:

- **Probed server-side, never from the browser.** Same as `api/hub-status.js`:
  CSP here is `connect-src 'self'`. The droplet needs a small read-only status
  endpoint of its own, token-gated and answering a bad token with 404, the way
  WordWarz's `/api/hub/stats` does. **Not SSH from a Vercel function** - that
  puts a key able to open a shell on the droplet into a web deployment.
- **The endpoint reports, it never acts.** No restart button, no "run this
  cron now". A status page that can change what it reports on is a remote
  control with a login screen in front of it.
- **Logs and repo state are operator-only**, behind the same unlock as the
  WordWarz operator half, and allowlisted at both ends. Log lines are the
  likeliest thing on this page to carry a nurse's name, an email address, a
  token in a URL or a stack trace with a path in it - redact at the droplet,
  before anything leaves the box, and allowlist which services' logs are read
  at all. The public half is health and versions only.
- **Everything the page asserts is in the markup** before `hub.js` runs: the
  list of services, crons and paths is written out, and only live values come
  from the fetch. With the droplet down, the panel is still an accurate map of
  what normally runs there - which is the moment it is most useful.
- **It fits the fold.** Services, deploy state and schedules on one screen;
  logs as a short tail rather than a scroller.

Panel 6 now exists as a single stack shown all at once — client, Caddy, the four services, the stores and this page’s own probe, each with its technologies — plus live MDS Pro / WordWarz API reachability from the existing status poll, the service map, the deployment notes and an explicit list of what is not measured. It is the second panel allowed to scroll. Host metrics are explicitly unavailable. Remaining: the token-gated collector on the droplet, host resources, deploy revisions, schedules, TLS expiry and operator-only redacted logs.

## Smaller, unscheduled

- **Two AI transcripts are illustrative.** The behaviour in `ai-ledger.js` is read
  from the real `chat.js` on mdsprosolutions.com; the wording is invented and
  labelled as such in the source. Replace both with captured exchanges before
  showing the page to anyone — a fabricated transcript on a section arguing
  against hallucination is the worst possible own goal.
- **The assistant still says MDS Pro has 13 daily users; the card says 15.**
  Fixed on the page 2026-09-06 in the two places that carry it — the work-item's
  `data-fig` and the metric tile — but the figure is stated a third time in
  `lib/owner.json` in `kimlj/port-assistant`, which is a different repo and
  gitignored here, so it did not move with them. Two instances there: the Q&A
  answer and the MDS Pro experience blurb. `lib/kb.json` regenerates from it on
  the next build, so only `owner.json` needs editing.

  Until then a visitor can read "15 daily users" on the card and be told "13" by
  the widget beside it. That is a wrong sentence rather than a reached system —
  the worst case `api/chat.js` is deliberately shaped around — but it is a wrong
  sentence on the page that argues for checkable claims.

  The standing question underneath it: **headcount keeps moving** (the card's own
  note says so, and it has now changed once), while the other two metrics —
  100% server-set timestamps, 0 rows edited in place — are invariants that never
  will. So a live figure is stated by hand in two repositories and drifts the
  moment one is edited alone. Worth deciding whether the assistant should stop
  naming a number it cannot see and defer to the page instead, which is the same
  rule the rest of this file already follows: one copy, or it disagrees with
  itself eventually.

## JobSift hub evidence

Panels 3 and 5 include illustrative pipeline replays with pause/step controls. JobSift reads aggregate evidence from `assets/jobsift-stats.json`; these are dated snapshots, not live database queries. Refresh both JSON and the no-JavaScript markup with `python scripts/export-jobsift-hub.py PATH_TO_FRESH_CORE_BACKUP`. The browser checks that file every 30 seconds; updates still require a new export and deployment. A continuous core-to-hub feed is not connected. No job titles, URLs, email content or application evidence are exported.

JobSift and Shift Ops have five detailed sample scenes each, inspired by recodeai’s status feed: input UI, visible processing, stored output and notification/review UI. Panel 6 briefly had a sixth set and does not any more — it shows its whole stack at once instead, and carries no sample figures at all. The replay data is fictional and the aggregate counters remain separate. No additional live integration is implied.

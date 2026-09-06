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


## Smaller, unscheduled

- **Two AI transcripts are illustrative.** The behaviour in `ai-ledger.js` is read
  from the real `chat.js` on mdsprosolutions.com; the wording is invented and
  labelled as such in the source. Replace both with captured exchanges before
  showing the page to anyone — a fabricated transcript on a section arguing
  against hallucination is the worst possible own goal.

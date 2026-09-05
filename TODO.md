# TODO

Open work on the portfolio. See `CLAUDE.md` for how the codebase is put together
and the traps it has already sprung.


## Site assistant for kimlj.dev

Shipped. Its plan, its open questions and its known gaps moved to
`kimlj/port-assistant/TODO.md` when the assistant was split into that private
repo. The gaps list is the reason: it names what is not yet defended, and that
does not belong in a public repo.
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

**The Claude Code half now refreshes from this machine.**
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

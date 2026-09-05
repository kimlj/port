# TODO

Open work on the portfolio. See `CLAUDE.md` for how the codebase is put together
and the traps it has already sprung.


## Site assistant for kimlj.dev

**Built and tested, not deployed.** Branch `site-assistant`, nine commits, never
pushed. `main` has none of it. Everything has been verified against a *stubbed*
model — **it has not yet answered a single real question.**

    api/chat-ticket.js          short-lived signed ticket, IP-bound
    api/chat.js                 the endpoint. No tools, no database. Haiku 4.5.
    lib/guards.js               origin, ticket, per-IP, per-ticket, spend cap
    lib/knowledge.js            generated facts + hand-written rules
    lib/kb.json                 generated — never edit, re-run the script
    lib/owner.json              generated from the doc — never edit either
    docs/assistant-answers.md   the 54 answers. THIS is the file to edit.
    scripts/build-kb.mjs        rebuilds kb.json from the page and the resume
    scripts/import-answers.mjs  doc -> owner.json, only STATUS: OK entries
    assets/js/chat.js           the widget, textContent only

After changing page content or any answer:

    node scripts/import-answers.mjs
    node scripts/build-kb.mjs

### Next three things, in order

1. **Set `ANTHROPIC_API_KEY` in Vercel**, or locally to test first.
   `scripts/devserver.mjs` serves the page and runs the real handlers; without
   `REAL=1` it stubs the model call, so the guards and the widget can be
   exercised for free. A plain static server cannot do this — `python -m
   http.server` answers every POST with 501, which looks like a broken endpoint
   and is not one.

        $env:ANTHROPIC_API_KEY = "sk-ant-..."
        $env:REAL = "1"
        node scripts/devserver.mjs           # real handlers on :8137

   `CHAT_TICKET_SECRET` is optional and worth setting — without it the ticket
   secret is derived from the API key, so rotating the key kills live sessions.
   `CHAT_HOURLY_USD` defaults to 1.00.

2. **Ask it the questions a recruiter would open with, and the awkward ones.**
   Every gap found so far came from a real question, never from re-reading the
   prompt: "most proud of" exposed the invented-preference hole, and a plain
   static server returning 501 on POST looked like a broken endpoint. Red-team
   the innocent framing too — the phrasing that gets correctly refused is not
   the one that leaks.

3. **Set a billing alert on the Anthropic account.** The rolling hourly cap in
   `lib/guards.js` is in-memory and resets on a cold start, so the billing alert
   is the only guard that survives one. A WAF rate limit at the edge is the other
   half; traffic blocked there costs nothing, traffic blocked in the function has
   already paid for an invocation.

### Open questions on the content

- **Two separate interruptions are in the corpus and a blended question has to
  pick one.** "Tell me about your education" answers UPLB, dropped for failing
  grades. "Why isn't your degree finished" answers AMA, paused for financial and
  family reasons, still a year short. Both are true and each names its
  institution, but "so why did you leave school?" will get whichever it lands on.
  Add a rule if it should always give the sequence.
- **The hero lede and the resume still say "5+ years of on-and-off experience"
  while the Experience row says 2018 to present**, which is eight. The owner
  spotted it and his own answer now avoids claiming a total; the source of the
  claim is still there.
- **`$25/hour` is now a public figure** on a page that is indexed. Fine, but it
  is the kind of number that is awkward to walk back.

### Known gaps

- **Turnstile is not wired to the chat.** The pitch form has it; the chat has the
  ticket instead. Worth adding if the spend cap ever actually trips.
- **No eval.** 54 answers and a 11k-token prompt, and a prompt change is still
  judged by reading it rather than by running anything.
- **The avatars, transcripts and process logs are not in the corpus** — only what
  the markup states as text. If a reader should be able to ask about them, they
  need to be on the page as text first.

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

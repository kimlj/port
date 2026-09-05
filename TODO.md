# TODO

Open work on the portfolio. See `CLAUDE.md` for how the codebase is put together
and the traps it has already sprung.


## Site assistant for kimlj.dev

**Built, not yet live.** Everything is in the repo and tested against a stubbed
upstream; it needs `ANTHROPIC_API_KEY` in Vercel and a look at a real answer
before the widget is trustworthy.

  api/chat-ticket.js    short-lived signed ticket, IP-bound
  api/chat.js           the endpoint. No tools, no database. Haiku 4.5.
  lib/kb.json           generated corpus — never edit, re-run the script
  lib/knowledge.js      generated facts + hand-written rules
  lib/guards.js         origin, ticket, per-IP, per-ticket, spend cap
  assets/js/chat.js     the widget, textContent only
  scripts/build-kb.mjs  regenerates the corpus from the page and the resume

### Before it goes live

- **Set `ANTHROPIC_API_KEY` in Vercel.** Nothing works without it and both routes
  return 503 rather than pretending. `CHAT_TICKET_SECRET` is optional and worth
  setting — without it the ticket secret is derived from the API key, so rotating
  the key invalidates every live session.
- **Set a billing alert on the Anthropic account.** The rolling hourly cap in
  `lib/guards.js` is in-memory and resets on a cold start, so it is the only
  guard that survives one. `CHAT_HOURLY_USD` defaults to $1.00.
- **Consider a WAF rate limit at the edge.** Traffic blocked there costs nothing;
  traffic blocked in the function has already paid for an invocation.
- **Ask it real questions before showing anyone.** Every gap in the MDS Pro
  build surfaced from a real question, never from reading the prompt. Red-team
  the innocent framing too — the phrasing that gets correctly refused is not the
  one that leaks.

### Known gaps

- **Turnstile is not wired to the chat.** The pitch form has it; the chat has the
  ticket instead. Worth adding if the spend cap ever actually trips.
- **The 66 avatars, the transcripts and the process logs are not in the corpus.**
  Only what the markup states as text. If a reader should be able to ask about
  them, they need to be in the page as text first.
- **No eval.** There is no set of questions with expected answers, so a prompt
  change is currently judged by reading it rather than by running it.

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

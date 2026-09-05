# The assistant's two repos

The site assistant is split across two repositories. This explains why, how the
pieces fit, and the one thing you have to set up by hand.

If you have not done this before: nothing here is exotic. A private repository is
an ordinary repository that only you can read. The build machine is given a
read-only key for it, copies a handful of files out of it, and bundles them. The
running site never talks to it.

## Why it is split

`kimlj/port` is public on purpose. The page argues that a claim should be
checkable, and being able to point at the source is part of that argument.

But the whole assistant was in there too. Anyone who cloned the repo got
`lib/knowledge.js` — every sentence of the system prompt, including the rules
about people trying to steer it — plus the full corpus and the guard thresholds.
None of it is a secret in the "leaked credentials" sense, and the design already
assumes a jailbreak costs nothing worse than a wrong sentence. It is still
strange to hand the instructions to the people being answered.

So the assistant's own half moved to `kimlj/port-assistant`, which is private.

## The pieces

    kimlj/port  (public)                 kimlj/port-assistant  (private)
    ─────────────────────                ───────────────────────────────
    index.html                           docs/assistant-answers.md
    assets/                              lib/owner.json
    Kim_Julongbayan_Resume.*             lib/knowledge.js
    api/chat.js                          lib/guards.js
    api/chat-ticket.js                   scripts/build-kb.mjs
    scripts/sync-assistant.mjs           scripts/import-answers.mjs
    scripts/build.mjs                    scripts/devserver.mjs
    vercel.json

`lib/kb.json` is in **neither**. It is generated during every build from
`index.html`, the resume and `lib/owner.json`. A generated file with a committed
copy is a file that goes stale, and the entire reason the corpus is generated is
so the page and the assistant cannot disagree.

`api/chat.js` stays public. It is the handler — it holds no content, no prompt
and no thresholds, and moving it would mean creating serverless functions during
the build, which is a fragile trick for no gain.

## What happens on a deploy

    vercel build
      │
      ├─ node scripts/build.mjs
      │    ├─ scripts/sync-assistant.mjs
      │    │    clones kimlj/port-assistant with ASSISTANT_REPO_TOKEN
      │    │    copies 7 files into this checkout
      │    │
      │    └─ scripts/build-kb.mjs
      │         reads index.html + resume + lib/owner.json
      │         writes lib/kb.json
      │
      └─ bundle: the function now holds the whole corpus as a constant

At **request** time the function talks to exactly one host, `api.anthropic.com`,
the same as before. That matters more than it might look.

### Why this is a build step and not a fetch

The endpoint has no tools, no database and no network beyond the one call to
Anthropic. That is the design, not a limitation of it: the worst case of a
visitor talking their way past every rule in the prompt is a wrong sentence,
which is a copy bug you fix in an afternoon.

Fetching the prompt per request would put a second host in that path. Whoever
controlled that host — or its DNS, or a certificate for it — would be writing
the system prompt for a site that answers in the first person as a real, named,
findable person. The worst case stops being a wrong sentence and becomes your
portfolio saying whatever they wrote, in your voice, over your name.

It would also mean the assistant is down whenever that host is, and it would put
a network round trip in front of every reply.

None of that is true of a build-time pull. **Do not move the fetch into the
request path.**

## One-time setup

The build needs read access to the private repo. That is the only manual step.

**1. Create a token.** github.com → Settings → Developer settings → Personal
access tokens → Fine-grained tokens → Generate new token.

- Repository access: **Only select repositories** → `port-assistant`
- Permissions → Repository permissions → **Contents: Read-only**
- Expiration: your call. A token that expires breaks deploys on a date you have
  forgotten, so put the date somewhere you will see it.

Nothing else. It does not need write access, and it must not have access to
anything else.

**2. Give it to Vercel.** Project → Settings → Environment Variables.

- Name: `ASSISTANT_REPO_TOKEN`
- Value: the token
- Environments: **Production, Preview and Development** — all three. A preview
  deploy runs the same build and fails the same way without it.

**3. Redeploy.** The next build will clone the private repo. The log shows:

    > node scripts/sync-assistant.mjs
    7/7 files in place from kimlj/port-assistant.

## Working on it locally

Clone both repos next to each other:

    git clone https://github.com/kimlj/port.git
    git clone https://github.com/kimlj/port-assistant.git

Then, from `port`:

    node scripts/sync-assistant.mjs --local

That copies from `../port-assistant`. The plain `node scripts/sync-assistant.mjs`
also works if you are signed in with `gh auth login`, since git will use those
credentials.

The seven files are **gitignored in `port`**, so a stray `git add -A` cannot put
the corpus or the prompt back into the public repo. That is deliberate: the
mistake this setup is most likely to suffer is somebody committing them back.

## Changing an answer

Nothing about this changed except which directory you are in.

    cd port-assistant
    # edit docs/assistant-answers.md, set STATUS: OK
    node scripts/import-answers.mjs      # only OK entries are imported
    git commit -am "..." && git push

Then redeploy `port`. The build pulls the new `owner.json` and regenerates the
corpus.

You can run `node scripts/build-kb.mjs` in the `port` checkout to see the result
locally, since that is where `index.html` lives.

## When it goes wrong

**`could not clone kimlj/port-assistant`** — the token is missing, expired, or
was not added to the environment being built. Check all three environments in
Vercel, not just Production. The script never prints the token or the URL it
tried, because the URL has the token in it.

**The assistant answers as though it knows nothing.** `lib/kb.json` did not get
generated, or generated empty. The build fails loudly rather than shipping that,
so if you see it in production, check that the build command actually ran:
`vercel.json` → `buildCommand`.

**An edit to an answer does not show up.** `import-answers.mjs` only imports
entries whose `STATUS:` line reads `OK`. That is the point of it — a draft
cannot reach the page by being skimmed past.

**`sync-assistant.mjs` says "already present, skipping".** Files are still in
your checkout from before the split. That is the safe default; pass `--force` to
pull the private copies over them.

## What is still public

Worth being clear about, because the split is narrower than it looks.

The corpus is generated from `index.html` and the resume, both of which are
public and always will be. Hiding `kb.json` hides nothing that is not already
readable by scrolling the page. And every answer in `owner.json` is one the
assistant will recite to anyone who asks it the right question.

What actually moved out of public view is the **system prompt** and the **guard
thresholds**. That is a real gain and a modest one. The protections that matter
are still a rate limit at the edge and a billing alert on the account, neither
of which is application code and neither of which this changes.

**And the files are still in `kimlj/port`'s git history.** Removing a file from
the tip of a branch does not remove it from the commits behind it — anyone can
recover them with `git log`. Scrubbing that means rewriting history and force
pushing, and it cannot reach copies that have already been cloned, forked or
cached. If that matters, say so and it can be done; if it does not, the split
still holds for everything from here on.

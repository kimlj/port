# TODO

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

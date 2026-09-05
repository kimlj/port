# kimlj.dev — portfolio

A single-page portfolio. **One hand-written `index.html`** — markup, styles and
most behaviour — plus a small set of standalone scripts in `assets/js/`. No build
step, no framework, no package.json. Deployed on Vercel from `main`.

Open it with any static server (`python -m http.server 8081`); the only thing
that will not work is `api/pitch.js`, which needs `vercel dev`.

## Layout of the file

`index.html` is large but strictly ordered: one `<style>` block, then the markup
section by section, then `<script>` blocks at the end in the order they run.
Section ids run `#projects` → `#activity` → `#ai-showcase` → `#skills` →
`#experience` → `#about` → `#contact`, and the section labels (`01 /`, `02 /`)
follow that order — if you reorder sections, renumber the labels.

The `<style>` block has no nesting and no preprocessor. **Check brace balance
after editing it**: an unclosed rule silently kills every rule after it, and the
page renders as unstyled links rather than throwing anything.

## The AI Showcase

The most intricate part of the file, and the one place where the markup is not
what the page shows. Two levels of switching, both generated rather than written
out twice.

The eight systems are rows in `.ai-tabs`. `ai-ledger.js` builds each row from its
panel's `data-name` / `data-model` / `data-guard`, then **moves the panel up into
the strip behind its own row** — the markup keeps all eight panels in one
readable block below the strip, the page shows them as eight drawers. A system
therefore cannot appear in the index and not the panel, and a ninth means adding
one `.ai-tab-content` and nothing else.

A drawer is a one-track grid transitioning `0fr → 1fr`. That is the only way to
animate to a height nobody has measured, which matters because the panel is
still typing a transcript into itself while it opens; a measured `max-height`
would need re-measuring every time it grew.

Inside the Avatar pipeline panel its four `.showcase-block`s are a second
switcher — a real tablist this time, since the tabs are together and their
panels follow. Built the same way, out of the `01 — …` text each block already
carried, which is then hidden because the tab is saying it. One stage is in
layout at a time; stacked, that panel was 3,374px.

Both switchers pin the clicked row. With the height animated the page shift
arrives over half a second rather than at the click, so the correction runs every
frame until the slide ends, and releases early if the reader touches the wheel.

Classes these scripts add are prefixed `ev-`.

## The Skills list

Section 04 is a list of technologies against the work on this site each was used
in, and **an entry without provenance does not go in**. The rows were sourced
from the project cards, the showcase panels, the repositories behind them and the
owner's resume; the marquee they replaced claimed React Native, Swift, Kotlin and
Figma, and none of the four survived that check — WordWarz ships through
Capacitor, whose generated iOS and Android shells are the only Swift and Java in
that tree. A technology whose provenance cannot be named belongs nowhere on a
page that argues against unfounded claims.

The list is written out in the markup rather than generated: unlike the showcase
rows there is no second copy to drift from, and the provenance is prose that has
to be read and checked rather than derived.

The list runs three columns and is deliberately tight: it is a reference table,
and a reference table you have to scroll is a worse one. All 27 rows, the chips
and the familiar block fit one screen together.

**The group sizes are load-bearing.** A column cannot split a group — each
heading stays with its own rows — so the column heights are decided entirely by
how big the groups are and what order they come in, and the browser cannot fix a
bad split. Six groups of 3/5/3/6/5/5 land one pair per column: Languages +
Interface, Runtime + Models & pipelines, Data & services + Delivery. Merging two
groups or moving a row between them will silently unbalance the columns, which is
what an 8-row Server & data block did before it was split.

`skills-filter.js` puts chips above it so the reader can run the check the other
way round — pick a piece of work, see what it was built with. Each mention
carries the project it belongs to as `data-proj` and each row the set as
`data-projs`, so the filter reads its index off the markup and there is no second
copy of the mapping. The chips and the tally under the list are **built by the
script, not written in the markup**, so with the script gone the section is
exactly the list it was. Non-matching rows are dimmed rather than removed: pulling
rows out would change the height of the section under the reader's cursor, and
what did not match is still the answer to "what else is there".

Below the list, **Also familiar** is the one block that makes no provenance claim.
It is deliberately worded as a comfort claim rather than a specific one — a
narrow factual assertion nobody can check, sitting under a heading promising that
everything can be, is the one thing that would cost the section its argument.

## The scripts

Each is a self-contained IIFE that finds its own elements and returns quietly if
they are missing. They are `defer`red and independent — deleting one costs its
feature and nothing else.

| File | What it does |
|---|---|
| `avatar-field.js` | The hero portrait, typeset from this file's own source. The cursor pushes its characters aside and the source shows in the clearing. |
| `hero-particles.js` | Hero label, headline and lede split into glyphs the cursor pushes. |
| `button-field.js` | Dot fields inside every CTA and the contact buttons. |
| `section-ornaments.js` | Drift, trace and registration marks, Projects → footer. |
| `ai-ledger.js` | The AI Showcase rows, transcripts and process logs, plus the Avatar pipeline's stage tabs. Two IIFEs. |
| `skills-filter.js` | Section 04's project chips — filters the technology list to one piece of work. |
| `activity-motion.js` | Build Activity animation and the chart tooltip. |
| `project-visuals.js` | Shader backgrounds behind project cards. |
| `horizon-glow.js` | WebGL glow behind the contact section. |
| `chat.js` | The site assistant widget. Deferred to the load event, styles injected by itself. |
| `semantic-bloom.js` | **Untracked and unreferenced.** Predates the current site. |

## The site assistant

The only part of the site with a server behind it, and the only part where a
stranger's text reaches the page. `api/chat.js` answers from a fixed corpus and
**has no tools, no database and no network beyond the one call to Anthropic.**
That is the design rather than a limitation of it: the worst case of a visitor
talking their way past every rule in the prompt is a wrong sentence, which is a
copy bug. Give it one tool and the worst case becomes a reached system. Do not
add one.

**Half of it is not in this repo.** The corpus, the system prompt, the guards and
the three scripts that build them live in `kimlj/port-assistant`, which is
private; `scripts/sync-assistant.mjs` clones it during the Vercel build and
`scripts/build.mjs` runs the generator after it. The seven files are gitignored
here so they cannot be committed back by accident, and `lib/kb.json` is in
neither repo because it is generated on every build. `docs/assistant-setup.md`
has the whole arrangement, the token it needs and what to do when it breaks.

That pull is a **build** step and must stay one. A per-request fetch would put a
second host inside the property this whole section rests on: whoever held it
would be writing the system prompt for a page that answers in the first person
as a real person. The paragraph above stops being true the moment the prompt
arrives over the network.

Everything below describes those files wherever they happen to be checked out.

`lib/kb.json` is **generated, never edited** — `scripts/build-kb.mjs` reads
`index.html` and the resume `.docx` and writes it, so the page and the assistant
cannot disagree. Re-run it after any content change; `--check` fails if it is
stale. Two extraction traps it already hit: a class regex bounded by `\b` matches
`skill-aside-head` when asked for `skill-aside`, and reading an element's text by
slicing to the next sibling of the same class runs to the end of the block when
there is only one of them.

The resume is authoritative on employment. MDS Pro is a role with dates there and
a project card here, so the two are merged rather than compared — the assistant
answers "where does he work now" from the resume even though section 05 does not
list it.

`lib/owner.json` is the **one authored file** in the corpus, and the only place a
fact may come from that is neither on the page nor in the resume. It exists
because fair questions — what he is proudest of, what he wants next, why the
degree stopped — have answers only the owner has, and the alternative is the
assistant inventing them in the first person. Its 54 answers are the only
sentences a reader cannot check against the page, which is the whole cost of it.
**Do not edit it by hand.** It is written by `scripts/import-answers.mjs` from
`docs/assistant-answers.md`, which is the file the owner edits; an answer is
imported only when its `STATUS:` reads `OK`, so a draft cannot reach the page by
being skimmed past. The importer reads every `docs/assistant-answers*.md` and
de-dupes by question text, keeping the last approved copy.

If an answer in there would be better said on the page itself, **say it on the
page** and delete it from the doc. Then the generator picks it up and there is no
second copy to drift.

`lib/knowledge.js` holds the facts and the rules separately. The facts are
generated; the rules are hand-written, because a rule is a judgement and there is
nothing to generate it from. They are written as tests rather than descriptions —
a named sentence the model must not produce, with the wrong output quoted beside
it — because a described distinction is not something a model can check itself
against. The prompt is a constant with no clock in it: caching is a prefix match,
and one changing byte would invalidate the whole corpus on every request.

**It answers as Kim, in the first person.** The launcher says "Talk to Me", so
the replies come from him rather than about him — but it says plainly that it is
software whenever a visitor asks whether they are talking to a person, and the
panel header reads `AI assistant` because with first-person replies that label is
what tells a reader this is not Kim typing. Two rules exist only because of the
voice: declining is harder in the first person, since a model asked its own rate
has something plausible to say; and modesty is not vagueness, because "I've done
a bit of dashboard work" throws away a fact.

**It must never invent a preference.** "Which project are you most proud of" was
the first question a real visitor asked, and a fabricated favourite attributed to
a real person is worse than a fabricated figure — nobody can check it and he has
to live with having supposedly said it. Where `owner.json` answers the question
it answers from there; where it does not, it gives the record and hands the
ranking back. Same shape for favourites, regrets, ambitions, and anything asking
what he would think about something the page does not cover.

`lib/guards.js` holds every counter in one object so swapping Maps for Redis is a
change to that file alone. **All of it is in-memory and dies with the instance.**
It is real protection against one impatient visitor and weak protection against a
distributed one; the guards that actually close it are a WAF rate limit at the
edge and a billing alert on the account, neither of which is application code.

**Model output never reaches `innerHTML`.** `createElement` and `textContent`
throughout `assets/js/chat.js`. The model is told to answer in plain text and
does, but "asked nicely" is not a guarantee worth betting a script injection on.

**A static server cannot test any of this.** `python -m http.server` answers
every POST with `501 Unsupported method`, which looks like a broken endpoint and
is not one. `scripts/devserver.mjs` serves the page and runs the real handlers
with the model call stubbed, so the guards and the widget can be exercised
without a key or any spend; `REAL=1` makes the call live. `vercel dev` also
works and is closer to production.

## Conventions that are load-bearing

**Colour comes from the tokens, never from a literal.** `--accent`, `--bg`,
`--border`, `--gradient-2` and friends are redefined under `[data-theme="light"]`,
and canvas code reads them with `getComputedStyle` plus a `MutationObserver` on
`data-theme`. A hardcoded hex is a light-theme bug waiting to happen.

**Every animation is guarded.** `prefers-reduced-motion` renders the final state
rather than a faster animation, and pointer effects check
`(hover: none), (pointer: coarse)` — there is no cursor to answer on a phone, and
the spans would cost layout for an effect that can never fire.

**Canvases need both sizes set.** `canvas.width` is the backing store in device
pixels; without `style.width` the element lays out at that size and the whole
drawing is scaled up. Size from `documentElement.clientWidth`, not `innerWidth`,
which includes the scrollbar.

**Comments explain why, not what.** Several in here record a bug that was
actually hit — the `background-clip: text` collision, the shared `.has-field`
class, the scrollbar offset. Those are worth keeping.

## Traps this codebase has already sprung

Each of these cost real debugging time. They are documented in commit messages
in more detail.

- **`background-clip: text` breaks on transformed children.** `.hero-line` paints
  its gradient this way; a moved glyph paints nothing and leaves a ghost at the
  line's origin. Glyphs carry the gradient themselves and the line drops it via
  `.is-split`.
- **`will-change: transform` on many small inline elements.** Promoting ~90
  glyphs to compositor layers made Chrome rasterise the headline into a pile of
  misplaced letters. Do not add it back.
- **Two components sharing a class name.** `.has-field` was on both the buttons
  and the portrait wrapper; the button rule's `position: relative` dropped the
  portrait out of its absolute placement. The button one is `.has-btn-field` now.
- **`width: 100%` inside a flex row** resolves against the container, so a
  `min-width` floor never applies. This made the mobile Selected Work index show
  exactly one project.
- **Splitting text into spans removes wrap opportunities.** Wrapping spaces in
  `white-space: pre` spans made a paragraph's min-content width the width of its
  whole text, forcing a 621px grid onto a 384px phone. Spaces stay text nodes.
- **A `[hidden]` element has no layout.** `offsetLeft` and `scrollWidth` are both
  0, so anything measuring must run after the unhide.
- **Animate-on-view must arm on create, not on release.** Otherwise the panel
  paints its real values, then resets to animate them, and every figure arrives
  twice.
- **A `0fr` grid track cannot shrink past its item's padding.** `min-height: 0`
  zeroes the content box only. With the panel itself as the grid child, the
  showcase drawer bottomed out at the 72px of its own padding and the last frame
  of every close was a snap. The clip is a bare wrapper now, padding inside it.
- **`restrictedContributionsCount` is not the private-contribution count.**
  It is how many contributions the *caller cannot see*, so it depends on the
  token, not on the data. The `gh` CLI token on this machine reports ~2,135 of
  them; the workflow's PAT has `repo` scope, reads every private repo, and
  correctly reports 0 — with identical totals. A guard built on it blocked two
  perfectly good runs, and the panel's note would have published "where 0 of
  2,314 of this year's contributions live". Anything derived from that field
  has to survive it being 0; the totals are what the charts draw.
- **A cached canvas and per-glyph motion do not compose for free.** The
  portrait is one blit of a pre-rendered bitmap, so a character that moves has
  to be erased from the cache's copy of it as well as drawn in its new place.
  That means clearing the disturbed box and re-typing *everything* in it, the
  characters that did not move included — and clearing a box sized to where
  they came from leaves the far side of the push smeared, because they have
  been carried outside it.
- **A page-width media query fires early inside a capped container.** The
  section's two-up image rule turns at 768px, which is right for a grid the width
  of the page and wrong inside a 600px figure — it doubled every output the
  moment a tablet loaded one, and turned a 528px panel into 792. Anything capped
  states its own columns and direction rather than inheriting them.

## Data

`assets/contributions.json` and `assets/claude-usage.json` are **committed
snapshots**, not live reads — neither can be fetched from the browser, and
`TODO.md` says why. The GitHub half refreshes itself daily through
`.github/workflows/refresh-activity.yml`; the Claude half is still
`node scripts/fetch-claude-usage.mjs` by hand, because the transcripts it reads
only exist on the machine that did the work.

Both payloads carry `generatedAt`, and the panel prints it. **A figure on this
page states its own date** — keep it that way when editing the section, since
the two halves refresh on different schedules and neither is today's by default.

**Nothing under `assets/` may be served `immutable`.** No path here is
content-hashed, so the scripts and these two files are edited in place; caching
them for a year froze both the figures and the site's behaviour for anyone who
had already visited. `vercel.json` splits the rule by file type — media long,
scripts and JSON revalidating.

`assets/ai-showcase/` holds 66 generated avatars used by the Avatar pipeline
walkthrough.

## Working here

- **Branch, don't commit to `main`** — `main` is what Vercel deploys.
- **Verify in a browser when the layout changes** — a new element in the flow, a
  flex or grid direction, a cap, anything a media query or an inherited rule
  might disagree with. Most bugs in this file are visual or layout-order problems
  that reading the diff will not show. Check both themes, a phone width, and
  reduced motion. One value on a rule you have already watched render does not
  need a browser; opening one for that is cost with no information in it.
- **Check for horizontal overflow** after any layout change:
  `documentElement.scrollWidth` should equal `clientWidth`.
- Content is the owner's professional history. **Do not invent figures, dates or
  claims.** Where placeholder copy exists it is marked as such — the two AI
  transcripts in `ai-ledger.js` are illustrative and say so.

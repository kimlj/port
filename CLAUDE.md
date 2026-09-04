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

## The scripts

Each is a self-contained IIFE that finds its own elements and returns quietly if
they are missing. They are `defer`red and independent — deleting one costs its
feature and nothing else.

| File | What it does |
|---|---|
| `avatar-field.js` | The hero portrait, typeset from this file's own source. Includes the reading glass. |
| `hero-particles.js` | Hero label, headline and lede split into glyphs the cursor pushes. |
| `button-field.js` | Dot fields inside every CTA and the contact buttons. |
| `section-ornaments.js` | Drift, trace and registration marks, Projects → footer. |
| `ai-ledger.js` | The AI Showcase rows, transcripts and process logs. |
| `activity-motion.js` | Build Activity animation and the chart tooltip. |
| `project-visuals.js` | Shader backgrounds behind project cards. |
| `horizon-glow.js` | WebGL glow behind the contact section. |
| `semantic-bloom.js` | **Untracked and unreferenced.** Predates the current site. |

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

## Data

`assets/contributions.json` and `assets/claude-usage.json` are **static snapshots
generated 1 Sep 2026** by the scripts in `scripts/`. Neither can be fetched from
the browser — see `TODO.md` for why, and for the routes to refreshing them.

`assets/ai-showcase/` holds 66 generated avatars used by the Avatar pipeline
walkthrough.

## Working here

- **Branch, don't commit to `main`** — `main` is what Vercel deploys.
- **Verify in a browser, not by reading.** Most bugs in this file are visual or
  layout-order problems that reading the diff will not show. Check both themes,
  a phone width, and reduced motion.
- **Check for horizontal overflow** after any layout change:
  `documentElement.scrollWidth` should equal `clientWidth`.
- Content is the owner's professional history. **Do not invent figures, dates or
  claims.** Where placeholder copy exists it is marked as such — the two AI
  transcripts in `ai-ledger.js` are illustrative and say so.

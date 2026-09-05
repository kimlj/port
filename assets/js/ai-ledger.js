/* AI Showcase — the evidence ledger.
 *
 * Eight systems as rows; the open one proves itself in a drawer directly under
 * its own row, in whatever medium it actually works in. Two assistants
 * transcribe an exchange, three pipelines run their real step sequence, three
 * image systems keep the walkthrough they already had.
 *
 * The rows are generated from the panels rather than written beside them, so a
 * system cannot appear in one and not the other, and adding a ninth means adding
 * one .ai-tab-content and nothing else. Everything a row shows is an attribute
 * on the panel it opens. Each panel is then moved into the strip behind its own
 * row — the markup keeps them in one readable block, the page shows them as
 * eight drawers.
 *
 * Two things are deliberately absent from the process logs. There are no
 * timings: inventing plausible millisecond figures in the one section arguing
 * against hallucination would be exactly the mistake it warns about. And no step
 * reports a result, only that it ran — a captured run would report results, and
 * this is not one.
 */
(function () {
  'use strict';

  var strip = document.querySelector('#ai-showcase .ai-tabs');
  if (!strip) return;
  var panels = Array.prototype.slice.call(
    document.querySelectorAll('#ai-showcase .ai-tab-content'));
  if (!panels.length) return;

  var reduced = window.matchMedia &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the evidence each panel plays ──────────────────────────── */

  /* Wording is illustrative. The behaviour it illustrates is not: the site
     assistant really does hand off rather than guess, and the query bot really
     is confined to a read-only role. Replace both with captured exchanges when
     there are ones worth keeping. */
  var CHAT = {
    assistant: [
      ['Asked', 'What are the requirements for the remote MDS nurse role?'],
      ['Answered', 'Active RN licensure, MDS coordination experience, and a reliable home setup for remote work.', 0, 'answered from the knowledge file'],
      ['Asked', 'What would my salary be after two years?'],
      ['Answered', 'That is not in what I have been given, and I will not guess at pay. I can send this to the team — would you like to leave a name and email?', 1, 'out of scope → offered the human relay']
    ],
    dbquery: [
      ['Asked', 'How many hours did the night shift log last pay period?'],
      ['Answered', '412.5 hours across 9 nurses.', 0, 'one query · read-only role · cost recorded'],
      ['Asked', 'Which nurse is most likely to quit next month?'],
      ['Answered', 'Nothing here records intent to leave, and I will not infer it from attendance.', 1, 'refused — no column to ground it in']
    ]
  };

  /* The real sequence each pipeline performs. */
  var LOG = {
    recodeai: [
      ['crawl', 'fetch the target URL, its DOM and assets'],
      ['extract', 'palette, type stack, page structure'],
      ['analyse', 'brand identity — Claude'],
      ['generate', 'the redesign, streamed over SSE'],
      ['render', 'build the new front end'],
      ['deploy', 'push it to a live URL — Netlify API'],
      ['return', 'hand back the deployed link']
    ],
    matcher: [
      ['scrape', 'read the listing off the page'],
      ['parse', 'structure it — title, pay, stack, location'],
      ['load', 'the resume profile'],
      ['score', 'match the role against it — LLM'],
      ['draft', 'a cold email, tone-controlled']
    ],
    watcher: [
      ['poll', 'Gmail — Indeed, Upwork, JobStreet'],
      ['extract', 'the listing out of the alert'],
      ['score', 'against the resume — GPT-4o'],
      ['value', 'salary — model plus deterministic code'],
      ['log', 'append the row to Google Sheets'],
      ['notify', 'send it to Telegram']
    ]
  };

  /* ── the index ──────────────────────────────────────────────── */

  var tabs = [];
  var drawers = [];
  var current = -1;

  /* Long enough to read as a movement, short enough that the reader is not left
     waiting on it. Kept in step with the .ev-drawer transition in the stylesheet:
     the slide is the stylesheet's, this is only how long the panel has to stay
     laid out for the slide to have something to close over. */
  var SLIDE_MS = reduced ? 0 : 500;

  panels.forEach(function (panel, i) {
    var id = panel.getAttribute('data-tab');
    var isOpen = panel.classList.contains('active');
    if (isOpen) current = i;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-tab' + (isOpen ? ' active' : '');
    btn.id = 'ev-row-' + id;
    btn.setAttribute('data-tab', id);
    /* A drawer, not a tab: the panel sits inside the row's own block now, and a
       tablist whose panels are interleaved with its tabs is not a tablist. */
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'ev-panel-' + id);

    add(btn, 'ev-num', ('0' + (i + 1)).slice(-2));
    add(btn, 'ev-name', panel.getAttribute('data-name') || id);
    add(btn, 'ev-model', panel.getAttribute('data-model') || '');
    add(btn, 'ev-guard', panel.getAttribute('data-guard') || '');
    add(btn, 'ev-caret', '');

    panel.id = 'ev-panel-' + id;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', btn.id);

    /* The drawer the panel slides in. The one that starts open is marked here
       rather than through open(), which forces a reflow to give the slide a
       closed frame to start from — doing that on load would animate the first
       panel open behind a reader who has not reached the section yet. */
    var drawer = document.createElement('div');
    drawer.className = 'ev-drawer' + (isOpen ? ' is-open is-live is-settled' : '');
    var clip = document.createElement('div');
    clip.className = 'ev-clip';
    drawer.appendChild(clip);

    btn.addEventListener('click', function () { toggle(i); });
    tabs.push(btn);
    drawers.push(drawer);
    strip.appendChild(btn);
    /* The drawer follows the row that opens it. The panels are written as one
       block below the list and moved here, so the markup stays readable and the
       page still puts the proof directly under the claim. */
    strip.appendChild(drawer);
    clip.appendChild(panel);
  });

  function add(host, cls, text) {
    var el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    host.appendChild(el);
  }

  var timer = null;    /* the open panel's own evidence, typing or stepping */
  var closing = null;  /* {i, id} — a panel still laid out under a shutting drawer */
  var settling = null;
  var pinned = 0, unpin = null;

  function toggle(i) {
    var row = tabs[i];
    var top = row.getBoundingClientRect().top;
    if (current === i) shut(); else open(i);
    pin(row, top);
  }

  function open(i) {
    /* Settle whatever an earlier click left mid-slide, before shut() starts a
       new one. Reopening a drawer that is still shutting keeps its panel — it
       has not been taken out of layout yet, so the track simply turns round and
       goes back up from wherever it had got to. */
    if (closing && closing.i === i) {
      clearTimeout(closing.id);
      closing = null;
    } else {
      hide();
    }
    shut();

    var drawer = drawers[i];
    tabs[i].classList.add('active');
    tabs[i].setAttribute('aria-expanded', 'true');
    drawer.classList.add('is-live');
    panels[i].classList.add('active');
    /* The closed frame the slide starts from. Without this read, the panel going
       from display: none to laid out and the drawer going from 0fr to 1fr land in
       one style change, and there is no earlier height to interpolate from — the
       drawer snaps open, which is the thing this is all here to avoid. */
    void drawer.offsetHeight;
    drawer.classList.add('is-open');
    settling = setTimeout(function () { drawer.classList.add('is-settled'); }, SLIDE_MS);

    current = i;
    play(panels[i]);
  }

  function shut() {
    clearTimeout(timer);
    clearTimeout(settling);
    if (current < 0) return;
    var i = current;
    tabs[i].classList.remove('active');
    tabs[i].setAttribute('aria-expanded', 'false');
    /* is-settled goes in the same style change as is-open: the panel has to be
       clipping again before the track starts shrinking, or its content stands at
       full height while the drawer closes behind it */
    drawers[i].classList.remove('is-settled');
    drawers[i].classList.remove('is-open');
    /* The panel keeps its layout until the drawer has closed over it. Taking it
       out at click time would remove the height the slide is animating, and the
       drawer would have nothing left to close. */
    hide();
    closing = { i: i, id: setTimeout(function () { closing = null; hide(i); }, SLIDE_MS) };
    current = -1;
  }

  /* Takes the named panel out of layout, or finishes whichever close is still
     outstanding — a second click during a slide must not leave a panel behind. */
  function hide(i) {
    if (i === undefined) {
      if (!closing) return;
      clearTimeout(closing.id);
      i = closing.i;
      closing = null;
    }
    panels[i].classList.remove('active');
    drawers[i].classList.remove('is-live');
  }

  /* Keeping the clicked row still, now for the length of the slide rather than
     for one frame. Closing a tall panel above the row drags the whole list up
     under the cursor — one panel here is 93 images tall, so unpinned that is
     several screens of travel — and pinning is what makes one drawer shutting
     and another opening read as a single movement instead of a jump.

     Corrected every frame rather than once, because with the height animated the
     shift arrives over half a second and not at the click. */
  function pin(row, top) {
    if (unpin) unpin();
    var until = performance.now() + SLIDE_MS + 80;

    function release() {
      cancelAnimationFrame(pinned);
      pinned = 0;
      unpin = null;
      removeEventListener('wheel', release);
      removeEventListener('touchmove', release);
      removeEventListener('keydown', release);
    }
    unpin = release;
    /* the reader's own scroll wins: a page that fights the wheel for half a
       second feels broken, however good its reason */
    addEventListener('wheel', release, { passive: true });
    addEventListener('touchmove', release, { passive: true });
    addEventListener('keydown', release);

    (function frame() {
      var drift = row.getBoundingClientRect().top - top;
      /* instant, because html has scroll-behavior: smooth and a smooth
         correction would still be catching up when the next frame asks again */
      if (drift) window.scrollBy({ top: drift, behavior: 'instant' });
      if (performance.now() < until) pinned = requestAnimationFrame(frame);
      else release();
    })();
  }

  /* ── playing a panel ────────────────────────────────────────── */

  function play(panel) {
    var chat = panel.querySelector('[data-chat]');
    if (chat) return runChat(chat, CHAT[chat.getAttribute('data-chat')]);
    var log = panel.querySelector('[data-log]');
    if (log) return runLog(log, LOG[log.getAttribute('data-log')]);
  }

  /* Typed rather than pasted in whole. A transcript that appears a line at a
     time is a list; one that types is a conversation, and the whole point of the
     panel is watching the assistant decide what it will and will not answer.

     The two speeds are deliberate: a question is typed at something like human
     speed, an answer arrives faster because a model streams it. The difference
     is small and nobody will name it, but a transcript where both sides type
     identically reads as a machine talking to itself.

     Built with createElement and textContent throughout — the same rule the real
     widget follows, and it costs nothing to keep it here. */
  var ASK_MS = 26, REPLY_MS = 11;

  function runChat(host, script) {
    if (!script) return;
    host.textContent = '';
    var n = 0;

    function step() {
      if (n >= script.length) return;
      var m = script[n++];
      var asking = m[0] === 'Asked';

      var wrap = document.createElement('div');
      wrap.className = 'ev-msg' + (m[2] ? ' is-refusal' : '');

      var who = document.createElement('div');
      who.className = 'ev-who';
      who.textContent = m[0];
      wrap.appendChild(who);

      var body = document.createElement('div');
      body.className = asking ? 'ev-q' : 'ev-a';
      wrap.appendChild(body);
      host.appendChild(wrap);

      function finish() {
        wrap.classList.remove('is-typing');
        if (m[3]) {
          var src = document.createElement('div');
          src.className = 'ev-src';
          src.textContent = m[3];
          wrap.appendChild(src);
        }
        if (reduced) { step(); return; }
        timer = setTimeout(step, asking ? 380 : 760);
      }

      if (reduced) { body.textContent = m[1]; finish(); return; }

      wrap.classList.add('is-typing');
      var i = 0, text = m[1], rate = asking ? ASK_MS : REPLY_MS;
      (function type() {
        /* a few characters per tick rather than one, so a long reply does not
           take longer to type than a reader will wait for */
        i = Math.min(text.length, i + (asking ? 1 : 2));
        body.textContent = text.slice(0, i);
        if (i < text.length) { timer = setTimeout(type, rate); return; }
        finish();
      })();
    }
    step();
  }

  function runLog(host, steps) {
    if (!steps) return;
    host.textContent = '';
    var n = 0;

    function settle() {
      var prev = host.lastElementChild;
      if (!prev) return;
      var s = prev.querySelector('.s');
      s.textContent = 'done';
      s.className = 's done';
    }

    function step() {
      settle();
      if (n >= steps.length) return;
      var row = steps[n++];
      var line = document.createElement('div');
      add(line, 'k', row[0]);
      add(line, 'v', row[1]);
      add(line, 's run', 'running');
      host.appendChild(line);
      if (reduced) { step(); return; }
      timer = setTimeout(step, 480);
    }
    step();
  }

  /* Held until the section is actually on screen: a transcript that typed itself
     out three screens above the reader would be finished before they arrived,
     and the panel would look static when they got there. */
  var section = document.getElementById('ai-showcase');
  if (window.IntersectionObserver && section) {
    var started = false;
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting || started) return;
      started = true;
      obs.disconnect();
      if (current >= 0) play(panels[current]);
    }, { rootMargin: '-15% 0px' }).observe(section);
  } else if (current >= 0) {
    play(panels[current]);
  }
})();

/* The Avatar pipeline's four stages, as tabs.
 *
 * Its own IIFE rather than part of the ledger above: the ledger switches panels,
 * this switches what one panel shows, and neither needs the other. Without it
 * the four blocks stack the way they always did.
 *
 * The strip is generated from the blocks for the same reason the ledger's rows
 * are generated from the panels — a stage cannot end up in one and not the
 * other, and the number and name come from the .showcase-step the block already
 * carried, which is then hidden because the tab is now saying it.
 *
 * A real tablist this time, unlike the rows above: the tabs are together and
 * their panels follow, which is the shape the role actually describes. So the
 * arrow keys work and only the selected tab is in the tab order.
 */
(function () {
  'use strict';

  var panel = document.querySelector(
    '#ai-showcase .ai-tab-content[data-tab="pipeline"]');
  if (!panel) return;

  var blocks = [];
  Array.prototype.forEach.call(panel.children, function (el) {
    if (el.classList && el.classList.contains('showcase-block')) blocks.push(el);
  });
  if (blocks.length < 2) return;

  var strip = document.createElement('div');
  strip.className = 'ev-stages';
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', 'Pipeline stages');

  var tabs = [];

  blocks.forEach(function (block, i) {
    /* "01 — Prompt Engineering" is one string in the markup and two things on a
       tab. If it is ever written without the dash, the position in the panel is
       still a number and the heading is still a name. */
    var step = block.querySelector('.showcase-step');
    var head = block.querySelector('h3');
    var raw = (step ? step.textContent : '').trim();
    var cut = raw.indexOf('\u2014');
    var num = cut > 0 ? raw.slice(0, cut).trim() : ('0' + (i + 1)).slice(-2);
    var name = (cut > 0 ? raw.slice(cut + 1) : raw).trim() ||
      (head ? head.textContent.trim() : 'Stage ' + (i + 1));

    block.classList.add('is-stage');
    block.id = 'ev-stage-' + (i + 1);
    block.setAttribute('role', 'tabpanel');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ev-stage-tab';
    btn.id = 'ev-stage-tab-' + (i + 1);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', block.id);
    block.setAttribute('aria-labelledby', btn.id);

    span(btn, 'n', num);
    span(btn, 't', name);

    btn.addEventListener('click', function () { show(i); });
    tabs.push(btn);
    strip.appendChild(btn);
  });

  strip.addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 :
      e.key === 'Home' ? -tabs.length : e.key === 'End' ? tabs.length : 0;
    if (!step) return;
    e.preventDefault();
    var at = tabs.indexOf(document.activeElement);
    if (at < 0) at = 0;
    var to = Math.max(0, Math.min(tabs.length - 1, at + step));
    show(to);
    tabs[to].focus();
  });

  function span(host, cls, text) {
    var el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    host.appendChild(el);
  }

  function show(i) {
    blocks.forEach(function (block, n) {
      var on = n === i;
      block.classList.toggle('is-current', on);
      tabs[n].classList.toggle('is-current', on);
      tabs[n].setAttribute('aria-selected', on ? 'true' : 'false');
      /* roving tabindex: one stop for the strip, then the arrows */
      tabs[n].tabIndex = on ? 0 : -1;
    });
  }

  /* so the panel's own lede can be spaced against the strip rather than against
     the 3.5rem the blocks below it used to need */
  panel.classList.add('has-stages');
  blocks[0].parentNode.insertBefore(strip, blocks[0]);
  show(0);
})();

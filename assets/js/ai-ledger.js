/* AI Showcase — the evidence ledger.
 *
 * Eight systems as rows; the open one proves itself below in whatever medium it
 * actually works in. Two assistants transcribe an exchange, three pipelines run
 * their real step sequence, three image systems keep the walkthrough they
 * already had.
 *
 * The rows are generated from the panels rather than written beside them, so a
 * system cannot appear in one and not the other, and adding a ninth means adding
 * one .ai-tab-content and nothing else. Everything a row shows is an attribute
 * on the panel it opens.
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

  panels.forEach(function (panel, i) {
    var id = panel.getAttribute('data-tab');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-tab' + (panel.classList.contains('active') ? ' active' : '');
    btn.setAttribute('data-tab', id);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', panel.classList.contains('active') ? 'true' : 'false');

    add(btn, 'ev-num', ('0' + (i + 1)).slice(-2));
    add(btn, 'ev-name', panel.getAttribute('data-name') || id);
    add(btn, 'ev-model', panel.getAttribute('data-model') || '');
    add(btn, 'ev-guard', panel.getAttribute('data-guard') || '');

    btn.addEventListener('click', function () { open(i); });
    tabs.push(btn);
    strip.appendChild(btn);
  });

  function add(host, cls, text) {
    var el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    host.appendChild(el);
  }

  var timer = null;

  function open(i) {
    clearTimeout(timer);
    panels.forEach(function (p, n) {
      p.classList.toggle('active', n === i);
      tabs[n].classList.toggle('active', n === i);
      tabs[n].setAttribute('aria-selected', n === i ? 'true' : 'false');
    });
    play(panels[i]);
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
      play(panels[0]);
    }, { rootMargin: '-15% 0px' }).observe(section);
  } else {
    play(panels[0]);
  }
})();

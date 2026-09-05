// The site assistant widget.
//
// Two rules here are load-bearing and neither is a style preference:
//
// 1. NO MODEL OUTPUT EVER REACHES innerHTML. Every reply is put on the page with
//    createElement and textContent. The system prompt tells the model to answer
//    in plain text, and it does — but "the model was asked nicely" is not a
//    guarantee worth betting a script injection on, and the reply is the one
//    string on this page that a stranger had a hand in.
//
// 2. Nothing runs until the load event. The hero has a portrait canvas, a WebGL
//    glow and four other scripts to get through first; a chat widget that fetches
//    a ticket during that is competing with the thing the reader came for.
//
// Colours come from the page's own tokens, so the widget follows the theme
// toggle without knowing the toggle exists.

(function () {
  'use strict';

  var API = '/api/chat';
  var TICKET_API = '/api/chat-ticket';
  var MAX_CHARS = 800;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CSS = [
    '.kchat{position:fixed;right:24px;bottom:24px;z-index:9000;font-family:var(--sans,system-ui,sans-serif)}',
    '.kchat *{box-sizing:border-box}',

    '.kchat-open{display:flex;align-items:center;gap:.55rem;padding:.8rem 1.15rem;border-radius:100px;',
    'border:1px solid var(--border,#2a2a30);background:var(--bg-card,#141418);color:var(--text,#eee);',
    'font-family:inherit;font-size:.85rem;font-weight:500;cursor:pointer;',
    'box-shadow:0 4px 24px rgba(0,0,0,.18);transition:border-color .3s,box-shadow .3s,transform .3s}',
    '.kchat-open:hover{border-color:var(--border-hover,#3a3a44);box-shadow:0 0 30px var(--accent-glow,rgba(8,145,178,.25))}',
    '.kchat-open svg{width:15px;height:15px;flex:none;stroke:var(--accent,#0891b2)}',
    '.kchat-open .kchat-dot{width:6px;height:6px;border-radius:50%;background:var(--accent,#0891b2);flex:none}',

    '.kchat-panel{display:none;flex-direction:column;width:min(380px,calc(100vw - 32px));',
    'height:min(540px,calc(100vh - 120px));border:1px solid var(--border,#2a2a30);border-radius:18px;',
    'background:var(--bg-card,#141418);box-shadow:0 12px 48px rgba(0,0,0,.28);overflow:hidden}',
    '.kchat.is-open .kchat-panel{display:flex}',
    '.kchat.is-open .kchat-open{display:none}',

    '.kchat-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;',
    'padding:.95rem 1.1rem;border-bottom:1px solid var(--border,#2a2a30);flex:none}',
    '.kchat-title{font-family:var(--mono,ui-monospace,monospace);font-size:.66rem;letter-spacing:.2em;',
    'text-transform:uppercase;color:var(--text-dim,#8a8a95)}',
    '.kchat-min{background:none;border:none;color:var(--text-dim,#8a8a95);cursor:pointer;padding:4px;',
    'line-height:0;border-radius:6px}',
    '.kchat-min:hover{color:var(--text,#eee)}',
    '.kchat-min svg{width:16px;height:16px}',

    '.kchat-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:1.1rem;',
    'display:flex;flex-direction:column;gap:.85rem}',
    '.kchat-msg{font-size:.875rem;line-height:1.6;font-weight:300;max-width:88%;',
    'white-space:pre-wrap;overflow-wrap:anywhere}',
    '.kchat-msg.is-bot{color:var(--text-muted,#b5b5bd);align-self:flex-start}',
    '.kchat-msg.is-you{color:var(--text,#eee);align-self:flex-end;background:var(--bg,#0c0c0f);',
    'border:1px solid var(--border,#2a2a30);border-radius:14px;padding:.6rem .85rem}',
    '.kchat-msg.is-err{color:#ef4444}',
    // overflow-wrap:anywhere is already on .kchat-msg, which is what stops a long
    // App Store URL widening the panel past its own border.
    '.kchat-link{color:var(--accent,#7c5cff);text-decoration:underline;',
    'text-underline-offset:2px;text-decoration-thickness:1px}',
    '.kchat-link:hover{text-decoration-thickness:2px}',

    '.kchat-note{font-family:var(--mono,ui-monospace,monospace);font-size:.62rem;letter-spacing:.08em;',
    'color:var(--text-dim,#8a8a95);line-height:1.6}',

    '.kchat-seed{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.2rem}',
    '.kchat-seed button{font-family:inherit;font-size:.75rem;color:var(--text-muted,#b5b5bd);',
    'background:none;border:1px solid var(--border,#2a2a30);border-radius:100px;padding:.35rem .7rem;',
    'cursor:pointer;transition:border-color .2s,color .2s}',
    '.kchat-seed button:hover{border-color:var(--accent,#0891b2);color:var(--text,#eee)}',

    '.kchat-typing{display:flex;gap:4px;align-items:center;height:1.2em}',
    '.kchat-typing i{width:5px;height:5px;border-radius:50%;background:var(--text-dim,#8a8a95);',
    'animation:kchatpulse 1.2s ease-in-out infinite}',
    '.kchat-typing i:nth-child(2){animation-delay:.15s}',
    '.kchat-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes kchatpulse{0%,60%,100%{opacity:.25}30%{opacity:1}}',

    '.kchat-foot{flex:none;border-top:1px solid var(--border,#2a2a30);padding:.7rem .8rem .8rem}',
    '.kchat-form{display:flex;align-items:flex-end;gap:.5rem}',
    '.kchat-input{flex:1;min-width:0;background:none;border:none;resize:none;color:var(--text,#eee);',
    'font-family:inherit;font-size:.875rem;font-weight:300;line-height:1.5;max-height:96px;padding:.4rem 0}',
    '.kchat-input:focus{outline:none}',
    '.kchat-input::placeholder{color:var(--text-dim,#8a8a95)}',
    '.kchat-send{flex:none;width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;',
    'background:var(--accent,#0891b2);color:var(--bg,#0c0c0f);display:grid;place-items:center;',
    'transition:opacity .2s}',
    '.kchat-send:disabled{opacity:.35;cursor:not-allowed}',
    '.kchat-send svg{width:14px;height:14px}',

    '@media (max-width:520px){.kchat{right:16px;bottom:16px;left:16px}',
    '.kchat-panel{width:100%;height:min(70vh,520px)}',
    '.kchat-open{margin-left:auto}}',

    reduced ? '.kchat-typing i{animation:none;opacity:.6}' : ''
  ].join('');

  // ------------------------------------------------------------------ dom

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt; // never innerHTML
    return n;
  }

  function icon(paths, stroke) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', stroke || 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    paths.forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  // ---------------------------------------------------------------- state

  var ticket = null;
  var history = [];
  var busy = false;

  function getTicket(force) {
    if (ticket && !force) return Promise.resolve(ticket);
    return fetch(TICKET_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(function (r) {
        if (!r.ok) throw new Error('ticket ' + r.status);
        return r.json();
      })
      .then(function (d) {
        ticket = d.ticket;
        return ticket;
      });
  }

  // ------------------------------------------------------------------ ui

  function init() {
    var style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = el('div', 'kchat');

    // launcher
    var open = el('button', 'kchat-open');
    open.type = 'button';
    open.setAttribute('aria-expanded', 'false');
    open.appendChild(el('span', 'kchat-dot'));
    open.appendChild(document.createTextNode('Talk to Me'));

    // panel
    var panel = el('div', 'kchat-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Kim’s AI assistant');

    var head = el('div', 'kchat-head');
    head.appendChild(el('span', 'kchat-title', 'AI assistant'));
    // Minimize, not close: the panel folds back to the pill and the conversation
    // is still there when it reopens. A cross would promise it was thrown away.
    var min = el('button', 'kchat-min');
    min.type = 'button';
    min.setAttribute('aria-label', 'Minimize');
    min.title = 'Minimize';
    min.appendChild(icon(['m6 9 6 6 6-6']));
    head.appendChild(min);

    var log = el('div', 'kchat-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');

    var foot = el('div', 'kchat-foot');
    var form = el('form', 'kchat-form');
    var input = el('textarea', 'kchat-input');
    input.rows = 1;
    input.maxLength = MAX_CHARS;
    input.placeholder = 'Ask about a project, a stack, the numbers…';
    input.setAttribute('aria-label', 'Your question');
    var send = el('button', 'kchat-send');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    send.appendChild(icon(['M5 12h14', 'm12 5 7 7-7 7']));
    form.appendChild(input);
    form.appendChild(send);
    foot.appendChild(form);

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(foot);
    root.appendChild(open);
    root.appendChild(panel);
    document.body.appendChild(root);

    // ---------------------------------------------------------- messages

    function scroll() {
      log.scrollTop = log.scrollHeight;
    }

    // A URL in a reply was arriving as dead text, so "here's the link" gave the
    // reader something to retype. This makes them clickable WITHOUT relaxing the
    // rule the whole widget is built on: the text is still never assigned to
    // innerHTML. Each run is a text node, each link an <a> built by createElement
    // with its href assigned as a property, so a crafted string cannot become
    // markup. The scheme is matched literally as http:// or https://, which is
    // what keeps javascript: and data: out — they cannot match the pattern.
    // Two alternatives, URL first so an address inside a path stays part of the
    // URL rather than being torn out of it. An email gets a mailto: href built
    // here rather than matched from the text, so the only two schemes this can
    // ever produce are http(s) and mailto.
    var URL_RE = /(https?:\/\/[^\s<>"']+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

    function linkify(node, text) {
      var at = 0;
      var m;
      URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(text))) {
        // Trailing sentence punctuation belongs to the sentence, not the URL.
        // A closing bracket only belongs to the URL if an opening one opened it.
        var url = m[0];
        var trail = '';
        for (;;) {
          var last = url.charAt(url.length - 1);
          if ('.,;:!?'.indexOf(last) >= 0 || (last === ')' && url.indexOf('(') < 0)) {
            trail = last + trail;
            url = url.slice(0, -1);
          } else break;
        }
        if (m.index > at) node.appendChild(document.createTextNode(text.slice(at, m.index)));
        var a = document.createElement('a');
        a.href = m[1] ? url : 'mailto:' + url;
        a.textContent = url;
        // Only web links open a tab. A mailto: with target=_blank leaves an
        // empty tab behind in some browsers once the mail client takes over.
        if (m[1]) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        a.className = 'kchat-link';
        node.appendChild(a);
        if (trail) node.appendChild(document.createTextNode(trail));
        at = m.index + m[0].length;
      }
      if (at < text.length) node.appendChild(document.createTextNode(text.slice(at)));
    }

    function say(text, kind) {
      var n = el('div', 'kchat-msg ' + kind);
      linkify(n, String(text == null ? '' : text));
      log.appendChild(n);
      scroll();
      return n;
    }

    function thinking() {
      var n = el('div', 'kchat-msg is-bot');
      var t = el('span', 'kchat-typing');
      t.appendChild(el('i'));
      t.appendChild(el('i'));
      t.appendChild(el('i'));
      n.appendChild(t);
      log.appendChild(n);
      scroll();
      return n;
    }

    function greet() {
      say(
        'Ask me about my projects, the technologies behind them or my experience — I answer from what this page says and nothing else.',
        'is-bot'
      );
      var seeds = el('div', 'kchat-seed');
      [
        'What are you working on right now?',
        'Where have you used TypeScript?',
        'What’s the AI showcase about?'
      ].forEach(function (q) {
        var b = el('button', null, q);
        b.type = 'button';
        b.addEventListener('click', function () {
          ask(q);
        });
        seeds.appendChild(b);
      });
      log.appendChild(seeds);
      scroll();
    }

    // ------------------------------------------------------------- send

    function ask(question) {
      if (busy) return;
      question = String(question || '').trim();
      if (!question) return;

      busy = true;
      send.disabled = true;
      input.value = '';
      input.style.height = 'auto';

      // Drop the seed suggestions once a conversation starts.
      var seeds = log.querySelector('.kchat-seed');
      if (seeds) seeds.remove();

      say(question, 'is-you');
      var wait = thinking();

      var sent = history.slice();

      post(question, sent, false)
        .then(function (reply) {
          wait.remove();
          say(reply, 'is-bot');
          history = sent.concat(
            [{ role: 'user', content: question }, { role: 'assistant', content: reply }]
          );
        })
        .catch(function (err) {
          wait.remove();
          say(
            err && err.message
              ? err.message
              : 'Something went wrong. The form at the bottom of the page reaches Kim directly.',
            'is-bot is-err'
          );
        })
        .then(function () {
          busy = false;
          send.disabled = false;
          input.focus();
        });
    }

    // One retry, and only for a 401 — an expired ticket is the expected case
    // after a reader leaves the tab open, and it should not look like an error.
    function post(question, sent, retried) {
      return getTicket(retried)
        .then(function (tk) {
          return fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket: tk, message: question, history: sent })
          });
        })
        .then(function (r) {
          if (r.status === 401 && !retried) {
            ticket = null;
            return post(question, sent, true);
          }
          return r.json().then(function (d) {
            if (!r.ok) throw new Error(d && d.error ? d.error : 'That did not work.');
            return d.reply;
          });
        });
    }

    // -------------------------------------------------------------- wire

    var greeted = false;
    function show() {
      root.classList.add('is-open');
      open.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        greet();
        // Warm the ticket now rather than on the first question, so the first
        // answer is not two round trips deep.
        getTicket(false).catch(function () {});
      }
      input.focus();
    }

    function hide() {
      root.classList.remove('is-open');
      open.setAttribute('aria-expanded', 'false');
      open.focus();
    }

    open.addEventListener('click', show);
    min.addEventListener('click', hide);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) hide();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(input.value);
    });

    // Enter sends, Shift+Enter breaks the line — but only where there is a real
    // keyboard. On a phone Enter has to stay a newline or the reader cannot
    // write a second sentence.
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (window.matchMedia('(pointer: coarse)').matches) return;
      e.preventDefault();
      ask(input.value);
    });

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();

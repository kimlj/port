/* Cockpit film: a 93.6-second tour of Cockpit, told the way the hero film is.
 *
 * RENDER IS A PURE FUNCTION OF TIME. render(t) sets every canvas pixel and
 * every DOM style from t alone: no element carries state from one frame to
 * the next. That makes seeking, chapter clicks and the audio resync free, and
 * it is what lets the MP4 be exported frame by frame (?render, then
 * cockpitFilm.seek(t) and a screenshot per frame).
 *
 * THE PICTURE IS THREE LAYERS. A canvas underneath draws the aurora, a field
 * of 2,000 particles that streak at the cuts and assemble into the Cockpit
 * mark, and the Knowledge graph. Above it, real HTML recreations of Cockpit's
 * panels (Aurora tokens) move in CSS 3D, so the text stays sharp at any
 * angle. Captions and type sit flat on top.
 *
 * THE SCORE IS SYNTHESISED: Web Audio oscillators and filtered noise on a
 * 100 BPM grid (a bar is 2.4 s). Every scene is a whole number of bars, so
 * every cut lands on a downbeat. The instruments are the hero film's.
 *
 * WHAT IS REAL. Feature behaviour, stage order, roles, schedulers and
 * permissions come from the dsh-workbench docs and source. The Vault figures
 * are real counts taken on 2026-10-19. The pilot avatar was generated through
 * Cockpit's own image rail for this film. Terminal transcripts, test counts,
 * run timings and endpoint latencies are illustrative.
 */
(function initializeCockpitFilm() {
  'use strict';

  var stage = document.getElementById('film-stage');
  var frame = document.getElementById('film-frame');
  if (!stage || !frame) return;

  var W = 1920, H = 1080, BAR = 2.4, BEAT = 0.6;
  var RENDER = /[?&]render\b/.test(location.search);

  /* ---------------------------------------------------------------- helpers */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function P(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function eo(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function eo5(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 5); }
  function ei(x) { x = clamp(x, 0, 1); return x * x * x; }
  function eio(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function back(x) { x = clamp(x, 0, 1); var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function hash(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  /* 0 before a, rises over fi, holds, falls over fo ending at b */
  function win(u, a, b, fi, fo) { return Math.min(eo(P(u, a, a + fi)), 1 - eio(P(u, b - fo, b))); }
  function bump(t, c, rise, fall) {
    if (t < c - rise || t > c + fall * 4) return 0;
    return t < c ? ei(P(t, c - rise, c)) : Math.exp(-(t - c) / fall);
  }
  function fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function el(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function sized(e, w, h) { e.style.width = w + 'px'; if (h) e.style.height = h + 'px'; return e; }

  /* Every DOM element is placed by place(): its centre goes to (x, y, z) in
     its container, then it turns and scales. alphaMul lets a scene fade all
     of its leaves at once, since opacity on a 3D container would flatten it. */
  var alphaMul = 1;
  function place(e, o) {
    var tr = 'translate(-50%,-50%) translate3d(' + (o.x || 0).toFixed(1) + 'px,' + (o.y || 0).toFixed(1) + 'px,' + (o.z || 0).toFixed(1) + 'px)';
    if (o.rx) tr += ' rotateX(' + o.rx.toFixed(2) + 'deg)';
    if (o.ry) tr += ' rotateY(' + o.ry.toFixed(2) + 'deg)';
    if (o.rz) tr += ' rotateZ(' + o.rz.toFixed(2) + 'deg)';
    if (o.s != null && o.s !== 1) tr += ' scale(' + o.s.toFixed(4) + ')';
    e.style.transform = tr;
    var op = (o.o == null ? 1 : o.o) * alphaMul;
    op = op < 0.002 ? 0 : op > 0.998 ? 1 : op;
    e.style.opacity = op;
    e.style.visibility = op === 0 ? 'hidden' : 'visible';
    var f = o.blur > 0.05 ? 'blur(' + o.blur.toFixed(2) + 'px)' : '';
    if (o.f) f += ' ' + o.f;
    e.style.filter = f;
  }
  function sheen(e, x) { e.style.setProperty('--sh', x.toFixed(3)); }

  /* --------------------------------------------------------------- palette */

  var C = {
    blue: '79,140,255', violet: '167,139,250', emerald: '52,211,153', amber: '251,191,36',
    cyan: '103,232,249', rose: '251,113,133', magenta: '208,98,255', white: '235,242,255'
  };
  var TOOL = { claude: '#e8845c', codex: '#e5e7eb', open: '#f5c542', hermes: '#c084fc', pwsh: '#60a5fa', ds: '#6f8bff' };
  var LOGO_STOPS = [[0, [0, 232, 255]], [0.4, [30, 123, 255]], [0.7, [107, 77, 255]], [1, [224, 92, 255]]];
  function logoRGB(f) {
    for (var i = 1; i < LOGO_STOPS.length; i++) {
      if (f <= LOGO_STOPS[i][0]) {
        var a = LOGO_STOPS[i - 1], b = LOGO_STOPS[i], x = (f - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map(function (k) { return Math.round(lerp(a[1][k], b[1][k], x)); }).join(',');
      }
    }
    return LOGO_STOPS[LOGO_STOPS.length - 1][1].join(',');
  }

  var LOGO_N = 0;
  function logoSVG(style) {
    var n = ++LOGO_N;
    return LOGO_SVG.replace(/LG/g, 'LG' + n).replace(/LH/g, 'LH' + n).replace('<svg ', '<svg' + (style ? ' style="' + style + '"' : '') + ' ');
  }
  var LOGO_SVG = '<svg viewBox="0 0 850 740" aria-hidden="true"><defs>' +
    '<linearGradient id="LG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#00e8ff"/><stop offset=".42" stop-color="#1e7bff"/><stop offset=".72" stop-color="#6b4dff"/><stop offset="1" stop-color="#e05cff"/></linearGradient>' +
    '<linearGradient id="LH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
    '<g fill="url(#LG)" stroke="url(#LG)" stroke-width="34" stroke-linejoin="round">' +
    '<polygon points="20,522 140,285 822,22 690,285"/><polygon points="125,718 245,490 618,368 495,600"/></g>' +
    '<g fill="url(#LH)"><polygon points="20,522 140,285 822,22 690,285"/><polygon points="125,718 245,490 618,368 495,600"/></g></svg>';
  var LOGO_POLYS = [[[20, 522], [140, 285], [822, 22], [690, 285]], [[125, 718], [245, 490], [618, 368], [495, 600]]];
  var LOGO_SCALE = 0.56;

  /* ---------------------------------------------------------------- layers */

  var cv = el('canvas', 'bg', null, stage), cx = cv.getContext('2d');
  var world = el('div', 'world', null, stage);
  var over = el('div', 'over', null, stage);
  var cursorLayer = el('div', 'over', null, stage);
  var grain = el('div', 'fx grain', null, stage);
  el('div', 'fx vignette', null, stage);
  var flashEl = el('div', 'fx flash', null, stage);
  var blackEl = el('div', 'fx black', null, stage);
  var K = 1;

  (function makeGrain() {
    var g = document.createElement('canvas'); g.width = g.height = 256;
    var gx = g.getContext('2d'), img = gx.createImageData(256, 256);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(hash(i * 0.731) * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gx.putImageData(img, 0, 0);
    grain.style.backgroundImage = 'url(' + g.toDataURL() + ')';
  })();

  var cursor = el('div', 'cursor', '<svg viewBox="0 0 24 24"><path d="M4 2.5 19.5 13l-7 1.2 3.8 7.3-2.6 1.3-3.8-7.3L4 20.3z" fill="#fff" stroke="#0b1020" stroke-width="1.3" stroke-linejoin="round"/></svg><i class="rip"></i>', cursorLayer);
  var ripple = cursor.querySelector('.rip');
  function hideCursor() { cursor.style.opacity = 0; }
  /* The cursor aims at a real element: its on-screen centre, in stage pixels. */
  function centreOf(e) {
    var r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / W;
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
  }
  function drawCursor(from, to, u, a, b, click, out) {
    var p = eio(P(u, a, b)), x = lerp(from.x, to.x, p), y = lerp(from.y, to.y, p);
    var press = bump(u, click, 0.06, 0.08);
    cursor.style.opacity = win(u, a - 0.2, out, 0.25, 0.3);
    cursor.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (1 - press * 0.15).toFixed(3) + ')';
    var r = P(u, click, click + 0.6);
    ripple.style.opacity = r > 0 && r < 1 ? (1 - r).toFixed(3) : 0;
    ripple.style.transform = 'scale(' + (0.3 + r * 1.6).toFixed(3) + ')';
  }

  /* ---------------------------------------------------------- shared parts */

  /* Terminal lines. Each line: {at, s: [[class, text, dynamicFn?]...], cps}.
     A line with cps types in; without it, it appears whole. Pure in u. */
  function makeLines(parent, lines, maxLines) {
    var inner = el('div', 'term-inner', null, parent);
    var L = lines.map(function (d) {
      var row = el('div', 'tl', null, inner); row.style.display = 'none';
      var total = 0;
      var spans = d.s.map(function (sg) {
        var sp = el('span', sg[0] || '', null, row); sp._t = sg[1]; sp._f = sg[2]; total += sg[1].length; return sp;
      });
      return { row: row, spans: spans, at: d.at, cps: d.cps || 0, total: total, n: -2 };
    });
    var cur = el('span', 'cur');
    return function (u, showCursor) {
      var vis = 0, last = null, typing = false;
      for (var i = 0; i < L.length; i++) {
        var l = L[i], n = u < l.at ? -1 : (l.cps ? Math.min(l.total, Math.floor((u - l.at) * l.cps)) : l.total), j, sp;
        if (n !== l.n) {
          l.n = n; l.row.style.display = n < 0 ? 'none' : '';
          var left = n;
          for (j = 0; j < l.spans.length; j++) {
            sp = l.spans[j];
            if (!sp._f) sp.textContent = sp._t.slice(0, clamp(left, 0, sp._t.length));
            left -= sp._t.length;
          }
        }
        if (n >= 0) {
          vis = i + 1; last = l; typing = n < l.total;
          for (j = 0; j < l.spans.length; j++) { sp = l.spans[j]; if (sp._f) sp.textContent = sp._f(u); }
        }
      }
      if (last && showCursor !== false) {
        if (cur.parentNode !== last.row) last.row.appendChild(cur);
        cur.style.opacity = typing || Math.floor(u * 2.4) % 2 === 0 ? 1 : 0;
      } else if (cur.parentNode) cur.parentNode.removeChild(cur);
      if (maxLines) inner.style.transform = 'translateY(' + (-Math.max(0, vis - maxLines) * 28) + 'px)';
    };
  }
  function makeTerm(parent, o) {
    var root = sized(el('div', 'n pn term', null, parent), o.w, o.h);
    el('div', 'term-hd', '<i style="background:' + o.color + ';color:' + o.color + '"></i><b>' + o.title + '</b>' + (o.cwd ? '<span>' + o.cwd + '</span>' : ''), root);
    var body = el('div', 'term-body', null, root);
    return { el: root, draw: makeLines(body, o.lines, o.maxLines) };
  }

  /* Captions: a kicker that wipes in, a headline whose words rise out of a
     blur one by one (*words* take the Cockpit gradient, | breaks the line),
     and a body that settles under them. */
  function makeCap(parent, c) {
    var box = el('div', 'cap cap-' + (c.pos || 'bl'), null, parent);
    var k = el('div', 'cap-k', '<span>' + c.n + '</span>' + c.k, box);
    k.style.color = c.color || '#7aa7ff';
    var h = el('div', 'cap-h', null, box), words = [], hi = false;
    c.h.split('|').forEach(function (line, li) {
      if (li) el('br', null, null, h);
      line.split(/(\*)/).forEach(function (part) {
        if (part === '*') { hi = !hi; return; }
        part.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { h.appendChild(document.createTextNode(' ')); return; }
          words.push(el('span', 'w8' + (hi ? ' hl' : ''), w, h));
        });
      });
    });
    var b = el('p', 'cap-b', c.b, box);
    box.style.display = 'none';
    return function draw(u, a, z) {
      var on = u > a - 0.05 && u < z;
      box.style.display = on ? '' : 'none';
      if (!on) return;
      var q = eio(P(u, z - 0.55, z));
      box.style.opacity = (1 - q).toFixed(3);
      box.style.transform = 'translateY(' + (-q * 18).toFixed(1) + 'px)';
      box.style.filter = q > 0.01 ? 'blur(' + (q * 8).toFixed(1) + 'px)' : '';
      var kp = eo(P(u, a, a + 0.6));
      k.style.clipPath = 'inset(0 ' + ((1 - kp) * 100).toFixed(1) + '% 0 0)';
      words.forEach(function (w, i) {
        var p = eo5(P(u, a + 0.12 + i * 0.065, a + 0.12 + i * 0.065 + 0.8));
        w.style.opacity = p.toFixed(3);
        w.style.transform = 'translateY(' + ((1 - p) * 46).toFixed(1) + 'px)';
        w.style.filter = p < 0.99 ? 'blur(' + ((1 - p) * 12).toFixed(1) + 'px)' : '';
      });
      var bp = eo(P(u, a + 0.55, a + 1.3));
      b.style.opacity = bp.toFixed(3);
      b.style.transform = 'translateY(' + ((1 - bp) * 16).toFixed(1) + 'px)';
    };
  }
  /* Large centred type, word by word, used by the opening. */
  function makeMega(parent, html, y) {
    var box = el('div', 'mega', null, parent); box.style.top = (540 + y) + 'px';
    var words = [];
    html.split('|').forEach(function (line, li) {
      if (li) el('br', null, null, box);
      line.split(' ').forEach(function (w, i) {
        if (i) box.appendChild(document.createTextNode(' '));
        var m = /^\[(\w+)\](.*)$/.exec(w);
        var s = el('span', 'w8', m ? m[2] : w, box);
        if (m) s.style.color = TOOL[m[1]];
        words.push(s);
      });
    });
    return { box: box, words: words };
  }
  function wordIn(w, p) {
    w.style.opacity = p.toFixed(3);
    w.style.transform = 'translateY(' + ((1 - p) * 40).toFixed(1) + 'px)';
    w.style.filter = p < 0.99 ? 'blur(' + ((1 - p) * 14).toFixed(1) + 'px)' : '';
  }

  function chip(text, color, cls) {
    return '<span class="chip' + (cls ? ' ' + cls : '') + '"' + (color ? ' style="color:' + color + '"' : '') + '>' + (color ? '<i></i>' : '') + '<span style="color:var(--text-2)">' + text + '</span></span>';
  }
  function logoNode(parent, w) {
    var d = el('div', 'n', logoSVG(), parent);
    sized(d, w, Math.round(w * 740 / 850));
    d.firstChild.style.cssText = 'width:100%;height:100%;display:block;overflow:visible';
    return d;
  }

  /* Floor rigs: a plane laid back by rx; cards stand on it facing the camera. */
  function stand(e, x, y, rx, lift, s, o) {
    e.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotateX(' + (-rx).toFixed(2) + 'deg) translateY(' + (-(lift || 0)).toFixed(1) + 'px) scale(' + (s == null ? 1 : s).toFixed(4) + ') translate(-50%,-100%)';
    var op = (o == null ? 1 : o) * alphaMul;
    e.style.opacity = op < 0.002 ? 0 : op;
    e.style.visibility = op < 0.002 ? 'hidden' : 'visible';
  }

  /* ---------------------------------------------------------------- scenes */

  var SCENES = [], CLOCK = 0;
  function scene(id, name, bars, pre, post, build) {
    var s = { id: id, name: name, t0: CLOCK, t1: CLOCK + bars * BAR, pre: pre, post: post, on: false };
    CLOCK += bars * BAR;
    s.s3 = el('div', 'sc', null, world);
    s.s2 = el('div', 'o2', null, over);
    s.build = build;
    SCENES.push(s);
    return s;
  }

  /* 1 · Chaos ------------------------------------------------------------ */
  scene('chaos', 'Intro', 3, 0, 0.1, function (s) {
    var WINS = [
      { k: 'claude', t: 'claude', cwd: '~/port', x: -600, y: -250, z: -150, ry: 20, rx: 6, rz: -3, lines: [
        { at: 0.3, s: [['p', '> '], ['w', 'fix the dock height after reload']], cps: 40 },
        { at: 1.4, s: [['k-claude', '● '], ['', 'Reading workflow-rail.jsx']] },
        { at: 1.8, s: [['k-claude', '● '], ['', 'Update(src/client/shell.jsx)']] },
        { at: 2.2, s: [['m', '  ⎿  '], ['g', '+12'], ['m', ' '], ['r', '−3']] }] },
      { k: 'codex', t: 'codex', cwd: '~/jobsift', x: 470, y: -290, z: -480, ry: -24, rx: 4, rz: 2, lines: [
        { at: 0.3, s: [['p', '› '], ['w', 'plan the schedules migration']], cps: 38 },
        { at: 1.5, s: [['m', '• '], ['', 'Explored schedules.js']] },
        { at: 1.9, s: [['m', '• '], ['', 'Ran npm test']] },
        { at: 2.3, s: [['m', '  └ '], ['g', '214 passed']] }] },
      { k: 'open', t: 'opencode', cwd: '~/Multiwordle', x: -90, y: 70, z: 60, ry: 6, rx: -4, rz: 1, lines: [
        { at: 0.3, s: [['p', '$ '], ['w', 'opencode run "review this diff"']], cps: 40 },
        { at: 1.6, s: [['k-open', '◇ '], ['', 'reading 6 files']] },
        { at: 2.0, s: [['k-open', '◇ '], ['a', '2 suggestions']] }] },
      { k: 'hermes', t: 'hermes', cwd: '~', x: 640, y: 190, z: -160, ry: -28, rx: -6, rz: -2, lines: [
        { at: 0.3, s: [['k-hermes', 'hermes ▸ '], ['w', 'morning brief']], cps: 34 },
        { at: 1.4, s: [['m', '· '], ['', '3 calendar events']] },
        { at: 1.8, s: [['m', '· '], ['', '5 new job matches']] }] },
      { k: 'pwsh', t: 'pwsh', cwd: '~/dsh-workbench', x: -660, y: 300, z: -360, ry: 26, rx: -8, rz: 3, lines: [
        { at: 0.3, s: [['k-pwsh', 'PS> '], ['w', 'git status --short']], cps: 36 },
        { at: 1.2, s: [['a', ' M '], ['', 'src/client/shell.jsx']] },
        { at: 1.6, s: [['k-pwsh', 'PS> '], ['w', 'npm test']] },
        { at: 2.1, s: [['g', '  ✓ 19 passing'], ['m', ' (1.8s)']] }] },
      { k: 'claude', t: 'claude', cwd: '~/mdspromonitor', x: 160, y: -400, z: -950, ry: -10, rx: 10, rz: 0, lines: [
        { at: 0.3, s: [['p', '> '], ['w', 'why is the sheet total off?']], cps: 40 },
        { at: 1.6, s: [['k-claude', '● '], ['', 'Reading reconcile.py']] }] },
      { k: 'codex', t: 'codex', cwd: '~/port', x: -330, y: -60, z: -1150, ry: 12, rx: 0, rz: -4, lines: [
        { at: 0.3, s: [['p', '› '], ['w', 'review the hub chart code']], cps: 38 },
        { at: 1.6, s: [['m', '• '], ['', 'Ran node --test']] }] }
    ];
    WINS.forEach(function (w, i) {
      w.at = 0.85 + i * 0.3;
      w.term = makeTerm(s.s3, { w: 600, h: 300, title: w.t, color: TOOL[w.k], cwd: w.cwd, lines: w.lines });
    });
    var scrim = el('div', 'n', null, s.s2);
    sized(scrim, 1500, 700).style.background = 'radial-gradient(closest-side, rgba(3,6,12,.86), rgba(3,6,12,.5) 60%, transparent)';
    var A = makeMega(s.s2, '[claude]Claude [claude]Code. [codex]Codex. [open]OpenCode. [hermes]Hermes.', -60);
    var B = makeMega(s.s2, 'Every agent in its own window.|None of them talk to each other.', -100);

    return function (u) {
      var camRy = lerp(-7, 6, eio(P(u, 0, 6.2))), camZ = lerp(-120, 80, P(u, 0, 5.8));
      s.s3.style.transform = 'translateZ(' + camZ.toFixed(1) + 'px) rotateY(' + camRy.toFixed(2) + 'deg)';
      var textOn = Math.max(win(u, 0.8, 3.2, 0.5, 0.4), win(u, 3.2, 5.9, 0.4, 0.5));
      WINS.forEach(function (w, i) {
        var p = back(P(u, w.at, w.at + 0.55)), q = eio(P(u, 5.5 + i * 0.05, 6.9 + i * 0.03));
        var bob = Math.sin(u * 0.7 + i * 1.7) * 12;
        var far = w.z < -600 ? 2.5 : 0;
        place(w.term.el, {
          x: lerp(w.x, 0, q), y: lerp(w.y + bob, -40, q), z: lerp(w.z, -2600, ei(q)),
          rx: w.rx * (1 - q), ry: w.ry * (1 - q), rz: w.rz * (1 - q),
          s: lerp(0.86, 1, p), o: clamp(P(u, w.at, w.at + 0.3) * (1 - textOn * 0.38) * (1 - ei(q)), 0, 1),
          blur: (1 - P(u, w.at, w.at + 0.4)) * 14 + far + textOn * 1.2 + q * 8
        });
        w.term.draw(u - w.at, true);
      });
      place(scrim, { y: -60, o: textOn });
      A.box.style.display = u < 3.4 ? '' : 'none';
      A.words.forEach(function (w, i) {
        var a = 0.95 + [0, 0, 1, 2, 3][i] * 0.3 + (i === 1 ? 0.08 : 0);
        var p = eo5(P(u, a, a + 0.7)), q = eio(P(u, 2.85, 3.3));
        wordIn(w, p * (1 - q));
      });
      B.box.style.display = u > 3.0 && u < 6.2 ? '' : 'none';
      B.words.forEach(function (w, i) {
        var a = 3.25 + i * 0.08 + (i > 5 ? 0.35 : 0), p = eo5(P(u, a, a + 0.75)), q = eio(P(u, 5.45, 5.95));
        wordIn(w, p * (1 - q));
      });
    };
  });

  /* 2 · Title ------------------------------------------------------------ */
  var TITLE_LOGO_Y = -95;
  scene('title', 'Cockpit', 2, 0.2, 0.7, function (s) {
    var logo = logoNode(s.s2, Math.round(850 * LOGO_SCALE));
    logo.style.filter = 'drop-shadow(0 0 50px rgba(100,110,255,.55))';
    var word = el('div', 'wordmark', null, s.s2); word.style.top = (540 + 105) + 'px';
    var letters = 'Cockpit'.split('').map(function (ch) { return el('span', null, ch, word); });
    var tag = el('div', 'tagline', 'Agent development control plane', s.s2); tag.style.top = (540 + 285) + 'px';
    return function (u) {
      var z = eio(P(u, 4.15, 4.95)), zs = 1 + z * 0.9, zo = 1 - z, zb = z * 18;
      var lp = eo(P(u, 1.25, 2.0));
      logo.style.transform = 'translate(-50%,-50%) translateY(' + (TITLE_LOGO_Y * zs) + 'px) scale(' + ((0.94 + lp * 0.06) * zs).toFixed(4) + ')';
      logo.style.opacity = (lp * zo).toFixed(3);
      logo.style.filter = 'drop-shadow(0 0 ' + (50 + bump(u, 1.6, 0.3, 0.6) * 60).toFixed(0) + 'px rgba(100,110,255,.55))' + ((1 - lp) * 10 + zb > 0.1 ? ' blur(' + ((1 - lp) * 10 + zb).toFixed(1) + 'px)' : '');
      word.style.transform = 'scale(' + zs.toFixed(4) + ')';
      word.style.transformOrigin = '50% ' + (540 - 645) + 'px';
      letters.forEach(function (l, i) {
        var p = eo5(P(u, 1.55 + i * 0.055, 2.35 + i * 0.055));
        l.style.opacity = (p * zo).toFixed(3);
        l.style.transform = 'translateY(' + ((1 - p) * 60).toFixed(1) + 'px)';
        l.style.filter = (1 - p) * 16 + zb > 0.1 ? 'blur(' + ((1 - p) * 16 + zb).toFixed(1) + 'px)' : '';
        l.style.color = '#fff';
      });
      var tp = eo(P(u, 2.35, 3.1));
      tag.style.opacity = (tp * zo).toFixed(3);
      tag.style.letterSpacing = lerp(0.9, 0.5, tp).toFixed(3) + 'em';
      tag.style.transform = 'scale(' + zs.toFixed(4) + ')';
      tag.style.transformOrigin = '50% ' + (540 - 825) + 'px';
      tag.style.filter = zb > 0.1 ? 'blur(' + zb.toFixed(1) + 'px)' : '';
    };
  });

  /* 3 · Workbench -------------------------------------------------------- */
  scene('workbench', 'Workbench', 4, 0.6, 0.2, function (s) {
    var rig = el('div', 'n', null, s.s3);
    function piece(w, h, x, y, cls) { var e = sized(el('div', 'n pn ' + (cls || ''), null, rig), w - 10, h - 10); e._x = x; e._y = y; return e; }
    var base = sized(el('div', 'n', null, rig), 1500, 880);
    base.style.cssText += ';border-radius:24px;background:rgba(7,11,20,.7);box-shadow:0 80px 200px -40px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.06)';

    var top = piece(1480, 66, 0, -397);
    top.innerHTML = '<div class="tb"><div class="brand"><span style="width:38px;height:33px;display:block">' + logoSVG('width:38px;height:33px') + '</span><span><b>COCKPIT</b><small>Agent Development Control Plane</small></span></div>' +
      '<div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search everything…<kbd>Ctrl K</kbd></div>' +
      '<div class="health"><span class="dot" style="background:var(--emerald);box-shadow:0 0 10px var(--emerald)"></span>System Healthy</div><span class="btn">+ New Session</span></div>';
    var side = piece(250, 798, -615, 33);
    var NAV = [['DB', 'Dashboard'], ['WB', 'Workbench', 1], ['PR', 'Projects'], ['AG', 'Agents'], ['KN', 'Knowledge'], ['IN', 'Infrastructure'], ['AU', 'Automations'], ['IM', 'Images'], ['TL', 'Tools']];
    side.innerHTML = '<div class="nav"><div class="lbl">Product</div>' + NAV.map(function (n) { return '<div class="it' + (n[2] ? ' on' : '') + '"><em>' + n[0] + '</em>' + n[1] + '</div>'; }).join('') +
      '<div class="sep"></div><div class="lbl">Current</div><div class="it"><em>SE</em>Sessions</div><div class="it"><em>CH</em>Chat</div></div>';
    var navItems = side.querySelectorAll('.it');
    var head = piece(870, 72, -55, -330);
    head.innerHTML = '<div class="ph"><span class="fold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span><span><b>dsh-workbench</b><small>…\\deepseek-harness-workspace\\dsh-workbench</small></span>' +
      '<span style="margin-left:14px">' + chip('main') + '</span>' + chip('2 modified', 'var(--amber)') + '<span style="margin-left:auto" class="btn ghost">Split</span><span class="btn">+ Terminal</span></div>';
    var term = piece(870, 726, -55, 69);
    var TABS = [['claude', 'claude', 1], ['codex', 'codex', 2], ['open', 'opencode', 3], ['hermes', 'hermes', 4], ['pwsh', 'pwsh', 5]];
    var tabs = el('div', 'tabs', null, term), hi = el('div', 'tab-hi', null, tabs);
    sized(hi, 150);
    TABS.forEach(function (t) { var e = el('div', 'tab', '<i style="background:' + TOOL[t[0]] + '"></i>' + t[1] + ' <sub>' + t[2] + '</sub>', tabs); sized(e, 150); });
    var bodies = [], tabEls = tabs.querySelectorAll('.tab');
    function body(lines) { var b = el('div', 'term-body', null, term); b.style.cssText = 'position:absolute;left:0;right:0;top:54px;bottom:38px'; bodies.push({ el: b, draw: makeLines(b, lines) }); }
    body([
      { at: 2.1, s: [['p', '> '], ['w', 'redesign the agent cards so a profile reads like a person']], cps: 58 },
      { at: 3.3, s: [['k-claude', '● '], ['', 'Reading '], ['b', 'control-plane.jsx']] },
      { at: 3.65, s: [['k-claude', '● '], ['', 'Update('], ['b', 'src/client/control-plane.jsx'], ['', ')']] },
      { at: 3.95, s: [['m', '  ⎿  '], ['g', '+84'], ['m', '  '], ['r', '−31'], ['m', '  2 hunks']] },
      { at: 4.25, s: [['k-claude', '● '], ['', 'Running '], ['c', 'npm test']] }]);
    body([
      { at: 4.8, s: [['p', '› '], ['w', 'review the schedules provider for timeouts']], cps: 56 },
      { at: 5.75, s: [['m', '• '], ['', 'Explored '], ['b', 'schedules.js'], ['m', ', '], ['b', 'automations.js']] },
      { at: 6.1, s: [['m', '• '], ['', 'Ran '], ['c', 'node --test test/automations.test.mjs']] },
      { at: 6.45, s: [['m', '  └ '], ['g', '38 passed']] },
      { at: 6.7, s: [['', 'Every scheduler call has a timeout. No change needed.']] }]);
    body([
      { at: 7.25, s: [['k-pwsh', 'PS> '], ['w', 'npm test']], cps: 30 },
      { at: 7.7, s: [['g', '  ✓ '], ['', 'navigation.test.mjs          '], ['g', '6 passed']] },
      { at: 7.9, s: [['g', '  ✓ '], ['', 'session-access.test.mjs      '], ['g', '4 passed']] },
      { at: 8.1, s: [['g', '  ✓ '], ['', 'workflow.test.mjs           '], ['g', '41 passed']] },
      { at: 8.35, s: [['w', '  51 passing'], ['m', ' (2.3s)']] }]);
    var status = el('div', 'status', null, term);
    var rail = piece(360, 798, 560, 33);
    rail.innerHTML = '<div class="rail-tabs"><span class="on">Chat</span><span>Home</span><span>Images</span><span>Files</span></div>';
    var m1 = el('div', 'msg me', 'Why does the dock open again after a reload?', rail);
    var m2 = el('div', 'msg bot', '<i>C</i><span></span>', rail), m2t = m2.querySelector('span');
    var M2 = 'The collapsed state lives in memory, so a reload resets it. I\'ll keep it in session storage.';
    var ed = el('div', 'edit', '<span style="color:var(--emerald)">✓</span> EDIT · workflow-rail.jsx<br><span class="g">+12</span> <span class="r">−3</span>  1 hunk<div class="bar"><b></b></div>', rail);
    var edBar = ed.querySelector('.bar b');
    var m3 = el('div', 'msg bot', '<i>C</i><span>Tests pass. Ready for review.</span>', rail);
    var pieces = [
      [top, 0.0, 0, -320, 520, 0, 0], [side, 0.12, -560, 0, 300, 0, -32], [rail, 0.22, 560, 0, 300, 0, 32],
      [head, 0.3, 0, -220, -420, 0, 0], [term, 0.38, 0, 260, 680, 34, 0]
    ];
    var cap = makeCap(s.s2, { n: '01', k: 'Workbench', color: '#7aa7ff', pos: 'bl', h: 'Every coding agent,|*one window.*', b: 'Claude Code, Codex, OpenCode and Hermes run as real terminals in the project I pick, each with its own login, skills and MCP servers.' });

    return function (u) {
      var a = eio(P(u, -0.5, 2.3)), out = eio(P(u, 8.75, 9.75));
      var rx = lerp(34, 9, a) + lerp(0, -3, P(u, 2.3, 9.6)) - out * 8;
      var ry = lerp(-30, -13, a) + lerp(0, 6, P(u, 2.3, 9.6));
      var rz = lerp(7, 1.2, a);
      var z = lerp(-500, 0, a) + out * 900;
      rig.style.transform = 'translate3d(110px,-10px,' + z.toFixed(1) + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg) scale(.86)';
      alphaMul = 1 - out;
      place(base, { z: -6, o: P(u, 1.0, 1.9), blur: out * 10 });
      pieces.forEach(function (pc) {
        var p = eo5(P(u, pc[1] - 0.3, pc[1] + 1.4));
        place(pc[0], { x: pc[0]._x + pc[2] * (1 - p), y: pc[0]._y + pc[3] * (1 - p), z: pc[4] * (1 - p), rx: pc[5] * (1 - p), ry: pc[6] * (1 - p), o: P(u, pc[1] - 0.3, pc[1] + 0.3), blur: (1 - p) * 10 + out * 10 });
        sheen(pc[0], P(u, 1.7 + pc[1] * 0.5, 2.9 + pc[1] * 0.5));
      });
      alphaMul = 1;
      for (var i = 0; i < navItems.length; i++) {
        var np = eo(P(u, 0.7 + i * 0.05, 1.2 + i * 0.05));
        navItems[i].style.opacity = np; navItems[i].style.transform = 'translateX(' + ((1 - np) * -14) + 'px)';
      }
      var idx = u < 4.6 ? 0 : u < 7.0 ? 1 : 2, tabIdx = [0, 1, 4][idx];
      var prevTab = [0, 0, 1][idx], tp = eo(P(u, [0, 4.6, 7.0][idx], [0, 4.6, 7.0][idx] + 0.35));
      hi.style.transform = 'translateX(' + lerp(prevTab * 156, tabIdx * 156, idx ? tp : 1).toFixed(1) + 'px)';
      hi.style.opacity = P(u, 1.6, 2.0);
      for (i = 0; i < tabEls.length; i++) tabEls[i].style.color = i === tabIdx && u > 1.8 ? '#eef2f8' : '';
      bodies.forEach(function (b, j) {
        var op = j === idx ? 1 : 0;
        b.el.style.opacity = op; b.el.style.display = op ? '' : 'none';
        if (op) b.draw(u, true);
      });
      status.textContent = ['● claude code   pty 5 alive   opus · acceptEdits   142k / 200k context', '● codex   pty 5 alive   gpt-5 · read-only sandbox', '● pwsh   pty 5 alive   PowerShell 7.5'][idx];
      status.style.color = idx === 0 ? '#e8845c' : idx === 1 ? '#cbd5e6' : '#60a5fa';
      [[m1, 2.5], [m2, 3.2], [ed, 4.4], [m3, 6.6]].forEach(function (m) {
        var p = eo(P(u, m[1], m[1] + 0.45));
        m[0].style.opacity = p; m[0].style.transform = 'translateY(' + ((1 - p) * 14) + 'px)';
      });
      m2t.textContent = M2.slice(0, Math.floor(clamp((u - 3.3) * 70, 0, M2.length)));
      edBar.style.transform = 'scaleX(' + eo(P(u, 4.6, 6.3)).toFixed(3) + ')';
      cap(u, 1.4, 9.1);
    };
  });

  /* 4 · Agent workflow --------------------------------------------------- */
  scene('workflow', 'Agent workflow', 7, 0.1, 0.2, function (s) {
    // Phase A: the launch modal.
    var modal = sized(el('div', 'n pn modal', null, s.s3), 760);
    modal.innerHTML = '<h3>Orchestrate Agents</h3><div class="sub">One task. Cockpit plans, builds, verifies and reviews it.</div>' +
      '<div class="lbl" style="margin-bottom:8px">Task</div><div class="field"><span class="tx"></span><span class="cur" style="height:19px"></span></div>' +
      '<div class="assign">' +
      '<span class="role">Planner</span><span>' + chip('Codex', TOOL.codex) + '</span><span class="perm">read-only</span>' +
      '<span class="role">Builder</span><span>' + chip('Claude Code', TOOL.claude) + '</span><span class="perm">snapshot worktree</span>' +
      '<span class="role">Reviewer</span><span>' + chip('DeepSeek', TOOL.ds) + '</span><span class="perm">evidence only</span>' +
      '<span class="role">Validator</span><span>' + chip('Codex', TOOL.codex) + '</span><span class="perm">read-only</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span class="lbl" style="margin-right:6px">Checks</span>' + chip('npm test') + chip('node cockpit-app/build.mjs') + '<span class="btn go" style="margin-left:auto">Start workflow</span></div>';
    var mtx = modal.querySelector('.tx'), mcur = modal.querySelector('.cur'), go = modal.querySelector('.go');
    var TASK = 'Let the Workbench dock collapse to its tab row, and keep it collapsed after a reload.';

    // Phase B: the track on a floor.
    var RX = 62;
    var rig = el('div', 'n', null, s.s3);
    var grid = el('div', 'floor-grid', null, rig);
    var NODES = [
      ['PL', 'Plan', 'Codex · read-only'], ['BU', 'Build', 'Claude Code'], ['VE', 'Verify', 'npm test · build'],
      ['RE', 'Review', 'DeepSeek · evidence'], ['VA', 'Validate', 'Codex · read-only'], ['OK', 'Approve', 'Kim'], ['CP', 'Checkpoint', 'git snapshot']
    ];
    var NX = [-1380, -920, -460, 0, 460, 920, 1380], NY = [0, -90, 30, -70, 40, -50, 10];
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'track'); svg.setAttribute('viewBox', '-1800 -700 3600 1400');
    svg.innerHTML = '<defs><linearGradient id="TGw" x1="0" x2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#4f8cff"/><stop offset="1" stop-color="#b06bff"/></linearGradient></defs>';
    rig.appendChild(svg);
    function catmull(pts) {
      var d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6) + ',' + (p2[0] - (p3[0] - p1[0]) / 6) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6) + ',' + p2[0] + ' ' + p2[1];
      }
      return d;
    }
    var mainPts = [[-1800, 40]].concat(NX.map(function (x, i) { return [x, NY[i]]; }));
    var dMain = catmull(mainPts);
    var dLoop = 'M' + NX[3] + ' ' + NY[3] + ' C' + (NX[3] + 60) + ' ' + (NY[3] - 420) + ',' + (NX[1] - 60) + ' ' + (NY[1] - 420) + ',' + NX[1] + ' ' + NY[1];
    function path(d, stroke, w, extra) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', w);
      p.setAttribute('stroke-linecap', 'round');
      if (extra) p.setAttribute('style', extra);
      svg.appendChild(p); return p;
    }
    var baseMain = path(dMain, 'rgba(255,255,255,.13)', 3);
    var baseLoop = path(dLoop, 'rgba(251,113,133,.16)', 3, 'stroke-dasharray:10 14');
    var litMain = path(dMain, 'url(#TGw)', 6, 'filter:drop-shadow(0 0 10px rgba(79,140,255,.9))');
    var litLoop = path(dLoop, '#fb7185', 6, 'filter:drop-shadow(0 0 10px rgba(251,113,133,.9))');
    function sampler(p) {
      var L = p.getTotalLength(), n = 500, pts = [];
      for (var i = 0; i <= n; i++) { var q = p.getPointAtLength(L * i / n); pts.push([q.x, q.y]); }
      return { L: L, at: function (len) { var f = clamp(len / L, 0, 1) * n, i = Math.floor(f), j = Math.min(n, i + 1), x = f - i; return [lerp(pts[i][0], pts[j][0], x), lerp(pts[i][1], pts[j][1], x)]; },
        near: function (x, y) { var best = 0, bd = 1e9; pts.forEach(function (q, i) { var d = (q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y); if (d < bd) { bd = d; best = i; } }); return best / n * L; } };
    }
    var SM = null, SL = null, NL = [];
    function ensureSamples() {
      if (SM) return;
      SM = sampler(baseMain); SL = sampler(baseLoop);
      NL = NX.map(function (x, i) { return SM.near(x, NY[i]); });
      litMain.style.strokeDasharray = SM.L; litLoop.style.strokeDasharray = SL.L;
    }
    var comet = el('div', 'comet', null, rig);
    var cards = NODES.map(function (n, i) {
      var c = el('div', 'n0 pn stagecard', '<div class="top"><span class="ic">' + n[0] + '</span><span><b>' + n[1] + '</b><small>' + n[2] + '</small></span></div><div class="st"><span class="dot"></span><span class="tx"></span></div>' + (i === 5 ? '<span class="approve">Approve</span>' : ''), rig);
      c._ic = c.querySelector('.ic'); c._st = c.querySelector('.st'); c._dot = c.querySelector('.st .dot'); c._tx = c.querySelector('.st .tx'); c._ap = c.querySelector('.approve'); c._key = '';
      return c;
    });
    var finding = el('div', 'n0 finding', '<div class="lbl">Finding · major</div><p>The collapsed dock opens again after a reload.</p><code>src/client/workflow-rail.jsx:212</code>', rig);
    var check = el('div', 'n0 checkpoint', '<div class="lbl">Checkpoint</div><p>Saved and approved</p><code>tree 9f3c2a1 · 3 files · rollback ready</code>', rig);
    var rings = [0, 1, 2].map(function () { return el('div', 'ringfloor', null, rig); });

    /* Each node's story: [from u, state, text]. */
    var STATES = [
      [[0, 'idle', 'Queued'], [4.2, 'active', 'Planning…'], [4.8, 'pass', 'plan.json · 4 steps']],
      [[0, 'idle', 'Queued'], [5.4, 'active', 'Writing +84 −31'], [6.4, 'pass', '+84 −31 · 2 files'], [10.2, 'active', 'Fix 1 of 2 · +12 −3'], [10.6, 'pass', 'Fixed · +12 −3']],
      [[0, 'idle', 'Queued'], [6.9, 'active', 'npm test…'], [7.3, 'pass', '19 passing'], [10.95, 'active', 'npm test…'], [11.2, 'pass', '19 passing']],
      [[0, 'idle', 'Queued'], [7.8, 'active', 'Reading evidence…'], [8.4, 'fail', '1 finding'], [11.6, 'active', 'Reading evidence…'], [11.85, 'pass', 'No findings']],
      [[0, 'idle', 'Queued'], [12.3, 'active', 'Checking acceptance'], [12.55, 'pass', 'Acceptance met']],
      [[0, 'idle', 'Needs Kim'], [13.0, 'wait', 'Waiting for you'], [13.8, 'pass', 'Approved by Kim']],
      [[0, 'idle', 'Queued'], [14.4, 'active', 'Saving…'], [14.6, 'pass', 'Saved · 9f3c2a1']]
    ];
    var SC = { idle: ['rgba(255,255,255,.05)', '#64748b', 'rgba(255,255,255,.09)', '0 0 0 transparent'],
      active: ['rgba(79,140,255,.2)', '#a9c5ff', 'rgba(79,140,255,.7)', '0 0 50px rgba(79,140,255,.55)'],
      pass: ['rgba(52,211,153,.16)', '#6ee7b7', 'rgba(52,211,153,.55)', '0 0 34px rgba(52,211,153,.3)'],
      fail: ['rgba(251,113,133,.18)', '#fda4af', 'rgba(251,113,133,.7)', '0 0 50px rgba(251,113,133,.5)'],
      wait: ['rgba(251,191,36,.16)', '#fcd34d', 'rgba(251,191,36,.7)', '0 0 50px rgba(251,191,36,.45)'] };
    function stateAt(i, u) { var st = STATES[i], cur = st[0]; for (var k = 0; k < st.length; k++) if (u >= st[k][0]) cur = st[k]; return cur; }

    /* Comet keyframes: [u, path, node index or length]. */
    var KF = [[3.6, 'm', -1], [4.2, 'm', 0], [4.8, 'm', 0], [5.4, 'm', 1], [6.4, 'm', 1], [6.9, 'm', 2], [7.3, 'm', 2], [7.8, 'm', 3], [8.95, 'm', 3],
      [8.95, 'l', 0], [10.2, 'l', 1], [10.2, 'm', 1], [10.5, 'm', 1], [10.95, 'm', 2], [11.15, 'm', 2], [11.6, 'm', 3], [11.85, 'm', 3], [12.3, 'm', 4], [12.55, 'm', 4], [13.0, 'm', 5], [13.9, 'm', 5], [14.4, 'm', 6]];
    function kfLen(k) { return k[1] === 'l' ? k[2] * SL.L : k[2] < 0 ? NL[0] - 420 : NL[k[2]]; }
    function cometAt(u) {
      var i = 0;
      for (var k = 0; k < KF.length; k++) if (KF[k][0] <= u) i = k;
      var a = KF[i], b = KF[i + 1], len = kfLen(a), pth = a[1];
      if (b && b[1] === a[1] && b[0] > a[0]) len = lerp(kfLen(a), kfLen(b), eio(P(u, a[0], b[0])));
      var pt = (pth === 'l' ? SL : SM).at(len);
      return { x: pt[0], y: pt[1], loop: pth === 'l', len: len };
    }
    function litAt(u) {
      var m = 0;
      for (var k = 0; k < KF.length; k++) if (KF[k][0] <= u && KF[k][1] === 'm') m = Math.max(m, kfLen(KF[k]));
      var c = cometAt(u);
      return c.loop ? m : Math.max(m, c.len);
    }

    var capA = makeCap(s.s2, { n: '02', k: 'Agent workflow', color: '#7aa7ff', pos: 'tl', h: 'One prompt.|*Four agents.*', b: 'A planner, a builder, my own checks and an independent reviewer, each on the runtime I assign. The host runs it, so closing the window does not stop it.' });
    var capB = makeCap(s.s2, { n: '02', k: 'Agent workflow', color: '#fb7185', pos: 'tl', h: 'Findings go back|*for a fix.*', b: 'The reviewer sees the repository and the evidence, never the builder\'s conversation. After two automatic fixes, it stops and asks me.' });
    var capC = makeCap(s.s2, { n: '02', k: 'Agent workflow', color: '#34d399', pos: 'tl', h: 'Nothing ships|*until I approve.*', b: 'Validation has to pass first. My approval saves a checkpoint I can roll back to.' });

    return function (u) {
      ensureSamples();
      // Modal
      var mi = eo5(P(u, -0.1, 0.9)), mo = eio(P(u, 3.15, 3.75));
      place(modal, { x: 300, y: 70, z: lerp(-500, 0, mi) - mo * 300, ry: lerp(-24, -8, mi) + mo * 10, rx: lerp(10, 2, mi), s: 1 - mo * 0.7, o: P(u, -0.1, 0.4) * (1 - mo), blur: (1 - mi) * 12 + mo * 14 });
      mtx.textContent = TASK.slice(0, Math.floor(clamp((u - 0.55) * 58, 0, TASK.length)));
      mcur.style.opacity = u < 2.1 || Math.floor(u * 2.4) % 2 ? 1 : 0;
      var press = bump(u, 3.0, 0.05, 0.1);
      go.style.transform = 'scale(' + (1 - press * 0.06).toFixed(3) + ')';
      go.style.boxShadow = '0 10px 30px -8px rgba(79,140,255,.7), 0 0 ' + (press * 50).toFixed(0) + 'px rgba(120,170,255,' + press.toFixed(2) + ')';
      if (u > 1.9 && u < 3.6) drawCursor({ x: 1500, y: 1000 }, centreOf(go), u, 2.1, 2.85, 3.0, 3.5);
      else if (u > 12.5 && u < 14.4) {
        var ap = cards[5]._ap;
        drawCursor({ x: 1600, y: 980 }, centreOf(ap), u, 12.95, 13.65, 13.8, 14.25);
      } else hideCursor();

      // Floor
      var fi = eio(P(u, 3.2, 4.4)), pull = eio(P(u, 15.3, 16.7));
      var rx = lerp(86, RX, fi) + pull * 6;
      var c = cometAt(u);
      var camX = 0;
      for (var k = 0; k < 6; k++) camX += cometAt(u - k * 0.09).x;
      camX = clamp(camX / 6, -1100, 1100) * (1 - pull) * 0.82;
      if (u < 3.6) camX = lerp(-1050, cometAt(3.6).x * 0.82, P(u, 3.0, 3.6));
      rig.style.transform = 'translate3d(' + (-camX).toFixed(1) + 'px,' + lerp(250, 175, fi).toFixed(1) + 'px,' + lerp(260, -1300, pull).toFixed(1) + 'px) rotateX(' + rx.toFixed(2) + 'deg)';
      var fo = P(u, 3.3, 4.1) * (1 - P(u, 16.3, 16.8));
      grid.style.opacity = fo;
      svg.style.opacity = fo;
      var lit = litAt(u);
      litMain.style.strokeDashoffset = (SM.L - (u < 3.6 ? 0 : lit)).toFixed(1);
      var lp = c.loop ? c.len / SL.L : u >= 10.2 ? 1 : 0;
      litLoop.style.strokeDashoffset = (SL.L * (1 - lp)).toFixed(1);
      litLoop.style.opacity = u < 10.2 ? 1 : 1 - P(u, 10.6, 11.4) * 0.75;
      comet.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,2px)';
      comet.style.opacity = P(u, 3.6, 3.9) * (1 - P(u, 15.4, 15.9));
      comet.style.background = c.loop ? '#ffe4e8' : '#fff';
      comet.style.boxShadow = c.loop ? '0 0 18px 6px rgba(251,113,133,.95), 0 0 70px 24px rgba(251,113,133,.6)' : '';

      cards.forEach(function (card, i) {
        var st = stateAt(i, u), key = st[1] + st[2];
        if (key !== card._key) {
          card._key = key;
          var sc = SC[st[1]];
          card._ic.style.background = sc[0]; card._ic.style.color = sc[1];
          card._st.style.color = sc[1]; card._st.style.background = sc[0];
          card._dot.style.background = sc[1];
          card.style.boxShadow = '0 50px 120px -30px rgba(0,0,0,.8), inset 0 0 0 1px ' + sc[2] + ', ' + sc[3];
          card._tx.textContent = st[2];
        }
        var pi = back(P(u, 3.7 + i * 0.12, 4.3 + i * 0.12));
        var pop = bump(u, st[0], 0.01, 0.18) * (st[0] > 0 ? 0.08 : 0);
        var glow = st[1] === 'wait' ? 0.5 + 0.5 * Math.sin(u * 9) : 1;
        stand(card, NX[i], NY[i], rx, 18 + (st[1] === 'active' || st[1] === 'wait' ? 14 : 0) * glow, (0.6 + pi * 0.4) * (1 + pop) * 1.1, P(u, 3.7 + i * 0.12, 4.0 + i * 0.12) * (1 - P(u, 16.2, 16.8)));
        if (card._ap) card._ap.style.opacity = u > 13.0 && u < 13.95 ? 1 : 0;
      });
      var fpi = back(P(u, 8.4, 8.9)), fpo = eio(P(u, 9.4, 10.0));
      stand(finding, NX[3], NY[3], rx, 210 + fpo * 60, 0.7 + fpi * 0.3 - fpo * 0.3, P(u, 8.4, 8.6) * (1 - fpo));
      var cpi = back(P(u, 14.6, 15.1));
      stand(check, NX[6], NY[6], rx, 215, 0.7 + cpi * 0.3, P(u, 14.6, 14.8) * (1 - P(u, 16.2, 16.8)));
      rings.forEach(function (r, i) {
        var p = P(u, 14.4 + i * 0.32, 15.9 + i * 0.32);
        r.style.transform = 'translate3d(' + NX[6] + 'px,' + NY[6] + 'px,1px) scale(' + (0.2 + p * 3.2).toFixed(3) + ')';
        r.style.opacity = p > 0 && p < 1 ? (1 - p) : 0;
      });
      capA(u, 0.35, 7.9);
      capB(u, 8.25, 12.6);
      capC(u, 12.9, 16.6);
    };
  });

  /* 5 · Agents ----------------------------------------------------------- */
  scene('agents', 'Agents', 3, 0.1, 0.1, function (s) {
    var rig = el('div', 'n', null, s.s3);
    var A = [
      ['BU', 'Builder', 'Claude Code', TOOL.claude, 'Writes the change in a snapshot worktree, with the plan and any findings in hand.', 'write · snapshot worktree'],
      ['PL', 'Planner', 'Codex', TOOL.codex, 'Turns the task into a structured plan before anyone writes code.', 'read-only sandbox'],
      ['RV', 'Reviewer', 'DeepSeek', TOOL.ds, 'Judges the diff and the evidence without the builder\'s conversation.', 'evidence only · no tools'],
      ['VA', 'Validator', 'Codex', TOOL.codex, 'Checks the acceptance requirements against the final tree.', 'read-only sandbox'],
      ['FE', 'Frontend', 'Claude Code', TOOL.claude, 'A builder specialist for interface work, with its own rules.', 'write · snapshot worktree'],
      ['OS', 'OSS Contributor', 'Claude Code', TOOL.claude, 'Finds open-source issues worth claiming. It never edits.', 'read · gh CLI']
    ];
    var cards = A.map(function (a) {
      var c = el('div', 'n acard', null, rig);
      var f = el('div', 'face front pn', '<div class="av" style="background:radial-gradient(circle at 30% 30%,' + a[3] + ',rgba(20,26,44,1) 75%);box-shadow:0 0 0 3px rgba(255,255,255,.08),0 0 30px ' + a[3] + '55">' + a[0] + '</div><h4>' + a[1] + '</h4>' + chip(a[2], a[3]) + '<p>' + a[4] + '</p><div class="perm">' + a[5] + '</div>', c);
      f.style.position = 'absolute';
      var b = el('div', 'face back', null, c);
      var lg = el('div', null, logoSVG(), b); lg.style.cssText = 'width:120px;height:104px;opacity:.85;filter:drop-shadow(0 0 20px rgba(100,110,255,.6))';
      lg.firstChild.style.cssText = 'width:100%;height:100%';
      c._f = f; c._b = b;
      return c;
    });
    var sug = el('div', 'n', chip('Suggested for UI tasks', '#67e8f9'), rig);
    var cap = makeCap(s.s2, { n: '03', k: 'Agents', color: '#a78bfa', pos: 'tl', h: 'Roles, *not models.*', b: 'Each role is a profile with its own instructions and permissions. Any runtime can fill it, and Cockpit suggests a specialist when the task fits.' });
    return function (u) {
      rig.style.transform = 'translate3d(40px,170px,0px) rotateY(' + lerp(-6, 5, P(u, 0, 7.2)).toFixed(2) + 'deg) scale(.95)';
      cards.forEach(function (c, i) {
        var k = i - 2.5, d = eo5(P(u, 0.25 + i * 0.09, 1.25 + i * 0.09));
        var flip = eio(P(u, 1.0 + i * 0.14, 1.75 + i * 0.14));
        var lift = i === 4 ? eo(P(u, 4.3, 4.9)) * (1 - eio(P(u, 6.2, 6.7))) : 0;
        var out = eio(P(u, 6.45 + i * 0.05, 7.1 + i * 0.05));
        place(c, {
          x: lerp(0, k * 312, d), y: lerp(420, 30 + k * k * 10, d) - lift * 50 + out * 300,
          z: lerp(150, -k * k * 34, d) + lift * 120, rx: lerp(70, 0, d) + out * 30,
          ry: lerp(0, -k * 7, d) + (1 - flip) * 180, rz: lerp(k * 4, k * 1.4, d)
        });
        // Opacity on the card itself would flatten it and show both faces.
        var fo = (P(u, 0.2 + i * 0.09, 0.5 + i * 0.09) * (1 - out)).toFixed(3);
        c._f.style.opacity = fo; c._b.style.opacity = fo;
        c._f.style.boxShadow = lift > 0.01 ? '0 50px 120px -30px rgba(0,0,0,.8), inset 0 0 0 1px rgba(103,232,249,' + (0.2 + lift * 0.5).toFixed(2) + '), 0 0 ' + (lift * 60).toFixed(0) + 'px rgba(103,232,249,.35)' : '';
      });
      var sp = eo(P(u, 4.6, 5.1)) * (1 - eio(P(u, 6.1, 6.5)));
      place(sug, { x: 1.5 * 312, y: -170 - 50 * sp, z: 160, ry: -10, o: sp, s: 0.9 + sp * 0.1 });
      cap(u, 0.6, 6.9);
    };
  });

  /* 6 · Image rail ------------------------------------------------------- */
  var AVATAR = '/assets/cockpit-film/pilot-avatar.webp';
  scene('images', 'Image rail', 4, 0.1, 0.2, function (s) {
    var rig = el('div', 'n', null, s.s3);
    var term = makeTerm(rig, { w: 900, h: 560, title: 'claude', color: TOOL.claude, cwd: 'C:\\Users\\kimju\\Multiwordle', lines: [
      { at: 0.7, s: [['p', '> '], ['w', 'make a new WordWarz avatar: a pilot girl, same style as avatar 20']], cps: 60 },
      { at: 2.05, s: [['v', '● '], ['w', 'cockpit-images'], ['m', ' · '], ['', 'generate_image']] },
      { at: 2.3, s: [['m', '  label       '], ['', 'WordWarz avatar: pilot girl']] },
      { at: 2.5, s: [['m', '  references  '], ['b', '20-archetype-boy-techscientist-vrvisor.png']] },
      { at: 2.75, s: [['m', '  ⎿  '], ['', 'Generating with the Codex image tool '], ['c', '⠋', function (u) { return '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.charAt(Math.floor(u * 12) % 10); }]] },
      { at: 5.5, s: [['m', '  ⎿  '], ['g', 'Saved 01.png · 1254 × 1254']] },
      { at: 6.0, s: [['k-claude', '● '], ['', 'Same line weight and framing as avatar 20.']] },
      { at: 6.3, s: [['', '  It is in the rail. Approve it, or tell me what to change.']] },
      { at: 7.2, s: [['p', '> '], ['w', 'approved. add her to the avatar set']], cps: 48 }] });
    var rail = sized(el('div', 'n pn', null, rig), 420, 660);
    rail.innerHTML = '<div class="rail-tabs"><span>Chat</span><span class="on">Images</span><span>Files</span></div>' +
      '<div class="rail-card"><div class="ttl">WordWarz avatar: pilot girl</div><div class="meta">' + chip('wordwarz', '#a78bfa') + chip('round 1') + '</div>' +
      '<div class="imgbox"><img alt="" src="' + AVATAR + '"><div class="gen"><div class="shimmer"></div><svg class="prog" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/><circle class="arc" cx="40" cy="40" r="34" fill="none" stroke="url(#PG)" stroke-width="5" stroke-linecap="round" transform="rotate(-90 40 40)" stroke-dasharray="213.6"/><defs><linearGradient id="PG"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#b06bff"/></linearGradient></defs></svg><span class="tm" style="position:relative">Generating · 0:00</span></div><div class="scan"></div></div>' +
      '<div class="st" style="margin-top:14px;font:500 13px var(--mono);color:var(--muted)"></div></div>';
    var img = rail.querySelector('img'), gen = rail.querySelector('.gen'), arc = rail.querySelector('.arc'), tm = rail.querySelector('.tm'), scan = rail.querySelector('.scan'), rst = rail.querySelector('.st'), shim = rail.querySelector('.shimmer');
    var hero = el('div', 'n hero-img', '<img alt="" src="' + AVATAR + '">', rig);
    var cap = makeCap(s.s2, { n: '04', k: 'Image rail', color: '#d062ff', pos: 'tl', h: 'Agents draw|*into the rail.*', b: 'Claude Code and Codex terminals opened in Cockpit get an image tool. The result lands beside the conversation that asked for it, and I approve it there in chat.' });
    return function (u) {
      var a = eo5(P(u, -0.2, 1.4)), out = eio(P(u, 9.0, 9.7));
      rig.style.transform = 'translate3d(0px,90px,' + lerp(-400, 0, a).toFixed(1) + 'px) rotateY(' + lerp(16, 4, eio(P(u, 0, 9.6))).toFixed(2) + 'deg) rotateX(' + lerp(10, 3, a).toFixed(2) + 'deg)';
      var hp = eo5(P(u, 6.7, 7.8)), dim = hp * (1 - out) * 0.7;
      place(term.el, { x: -40, y: 95, z: 0, ry: 6, o: P(u, -0.2, 0.4) * (1 - dim) * (1 - out), blur: (1 - a) * 8 + dim * 6 });
      term.draw(u, true);
      place(rail, { x: 640, y: 40, z: 60, ry: -14, o: P(u, 0.2, 0.7) * (1 - dim) * (1 - out), blur: (1 - eo5(P(u, 0.2, 1.4))) * 8 + dim * 6 });
      sheen(rail, P(u, 1.0, 2.0));
      var g = P(u, 2.75, 5.45), rv = eio(P(u, 5.4, 6.6));
      arc.style.strokeDashoffset = (213.6 * (1 - eo(g))).toFixed(1);
      tm.textContent = 'Generating · 0:' + ('0' + Math.floor(g * 43)).slice(-2);
      shim.style.transform = 'rotate(' + (u * 120).toFixed(1) + 'deg)';
      gen.style.opacity = u < 2.75 ? 0.35 : (1 - rv).toFixed(3);
      img.style.opacity = rv > 0 ? 1 : 0;
      img.style.filter = 'blur(' + ((1 - rv) * 28).toFixed(1) + 'px) saturate(' + rv.toFixed(2) + ') brightness(' + (1 + (1 - rv) * 0.8).toFixed(2) + ')';
      scan.style.top = (rv * 356).toFixed(1) + 'px';
      scan.style.opacity = rv > 0 && rv < 1 ? 1 : 0;
      rst.innerHTML = u < 2.75 ? 'Waiting for the agent' : rv < 1 ? '<span style="color:#7aa7ff">●</span> Codex · gpt-image-2' : '<span style="color:var(--emerald)">●</span> Saved · 01.png · approve in chat';
      place(hero, { x: lerp(640, 260, hp), y: lerp(20, 10, hp), z: lerp(60, 340, hp), ry: lerp(-14, -8, hp) + Math.sin(u * 1.1) * 3 * hp, rx: Math.sin(u * 0.8) * 2 * hp, s: lerp(0.62, 1, hp), o: P(u, 6.7, 6.9) * (1 - out), blur: out * 10 });
      cap(u, 0.5, 9.2);
    };
  });

  /* 7 · Automations ------------------------------------------------------ */
  scene('auto', 'Automations', 4, 0.1, 0.2, function (s) {
    var rig = el('div', 'n', null, s.s3);
    var list = sized(el('div', 'n pn auto', null, rig), 1040);
    var SCHED = { ts: ['Task Scheduler', '#60a5fa'], sd: ['systemd', '#34d399'], cr: ['cron', '#67e8f9'], gh: ['GitHub Actions', '#a78bfa'], he: ['Hermes', '#fbbf24'] };
    var ROWS = [
      ['jobsift pipeline', 'sd', 'every 30 min', 'ok', '2m ago', 1452],
      ['Claude usage sync', 'ts', 'hourly', 'ok', '18m ago', 2520],
      ['Contribution figures', 'gh', 'daily 06:00', 'ok', '6h ago', 41000],
      ['VPS backup', 'cr', 'nightly 02:30', 'ok', '10h ago', 30200],
      ['Morning brief', 'he', 'weekdays 07:30', 'ok', '5h ago', 63000],
      ['OSS Hunter', 'ts', 'weekly', 'warn', '2d ago', 340000]
    ];
    list.innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><h3>Automations</h3><span style="margin-left:auto" class="btn ghost">Playground</span><span class="btn">Run now</span></div>' +
      '<div style="display:flex;gap:8px;margin:14px 0 18px">' + Object.keys(SCHED).map(function (k) { return chip(SCHED[k][0], SCHED[k][1]); }).join('') + '</div>' +
      '<div class="row hd"><span>Name</span><span>Scheduler</span><span>Schedule</span><span>Last run</span><span>Next</span></div>' +
      ROWS.map(function (r) {
        return '<div class="row"><span style="color:var(--text)">' + r[0] + '</span><span>' + chip(SCHED[r[1]][0], SCHED[r[1]][1]) + '</span><span class="s">' + r[2] + '</span><span class="s"><span class="dot" style="background:' + (r[3] === 'ok' ? 'var(--emerald)' : 'var(--amber)') + ';margin-right:8px"></span>' + (r[3] === 'ok' ? r[4] : 'attention') + '</span><span class="s nx"></span></div>';
      }).join('');
    var rows = list.querySelectorAll('.row:not(.hd)'), nexts = list.querySelectorAll('.nx');
    var run = sized(el('div', 'n pn gantt', null, rig), 800);
    var STEPS = [['Collect listings', 0, 4.2, '#4f8cff'], ['Remove duplicates', 4.2, 0.6, '#67e8f9'], ['Assess with AI', 4.8, 18.4, '#a78bfa'], ['Write to Google Sheets', 23.2, 1.1, '#34d399'], ['Telegram alerts', 24.3, 0.3, '#fbbf24']];
    run.innerHTML = '<div style="display:flex;align-items:center;gap:12px"><b style="font:600 22px var(--display)">jobsift pipeline</b><span class="m" style="font:500 13px var(--mono)">run 1842</span><span style="margin-left:auto">' + chip('Instrumented', '#a78bfa') + '</span></div>' +
      '<div style="display:flex;gap:16px;margin:8px 0 16px;font:400 12.5px var(--mono);color:var(--faint)"><span>Observed</span><span>Reported</span><span style="color:#c4b5fd">Instrumented ✓</span></div>' +
      STEPS.map(function (st) { return '<div class="g-row"><span>' + st[0] + '</span><div class="g-track"><div class="g-bar" style="left:' + (st[1] / 25 * 100) + '%;width:' + (st[2] / 25 * 100) + '%;background:' + st[3] + ';box-shadow:0 0 16px ' + st[3] + '"></div></div><span class="g-d"></span></div>'; }).join('') +
      '<div style="display:flex;align-items:center;gap:10px;margin-top:16px"><span class="fin" style="font:500 14px var(--mono);color:var(--muted)"></span><span style="margin-left:auto">' + chip('Exceptions · 0 open', '#34d399') + '</span></div>';
    var bars = run.querySelectorAll('.g-bar'), durs = run.querySelectorAll('.g-d'), fin = run.querySelector('.fin');
    var retry = el('span', 'retry', chip('retry 1', '#fbbf24'), run.querySelectorAll('.g-track')[2]);
    retry.style.left = ((4.8 + 6.1) / 25 * 100) + '%';
    var cap = makeCap(s.s2, { n: '05', k: 'Automations', color: '#fbbf24', pos: 'tl', h: 'Every schedule,|*every scheduler.*', b: 'Task Scheduler, systemd, cron, GitHub Actions and Hermes jobs in one list. Instrumented runs report their real steps and retries, and the page says how much it really knows.' });
    return function (u) {
      var a = eo5(P(u, -0.2, 1.3)), out = eio(P(u, 8.9, 9.7));
      rig.style.transform = 'translate3d(0px,70px,' + (lerp(-300, 0, a) + out * 500).toFixed(1) + 'px) rotateY(' + lerp(-14, -4, P(u, 0, 9.6)).toFixed(2) + 'deg) rotateX(' + lerp(12, 4, a).toFixed(2) + 'deg)';
      alphaMul = 1 - out;
      var rp = eo5(P(u, 2.6, 3.5));
      place(list, { x: 330, y: 70, z: -60 - rp * 120, o: P(u, -0.2, 0.3) * (1 - rp * 0.35), blur: (1 - a) * 10 + rp * 2.5 + out * 10 });
      for (var i = 0; i < rows.length; i++) {
        var p = eo(P(u, 0.6 + i * 0.1, 1.1 + i * 0.1));
        rows[i].style.opacity = p; rows[i].style.transform = 'translateX(' + ((1 - p) * 40) + 'px)';
        var hiRow = i === 0 ? win(u, 2.2, 9.6, 0.3, 0.3) : 0;
        rows[i].style.background = hiRow ? 'rgba(79,140,255,' + (0.12 * hiRow).toFixed(3) + ')' : '';
        rows[i].style.boxShadow = hiRow ? 'inset 0 0 0 1px rgba(79,140,255,' + (0.4 * hiRow).toFixed(3) + ')' : '';
        var left = Math.max(0, ROWS[i][5] - Math.floor(u * 6));
        nexts[i].textContent = 'in ' + (left >= 3600 ? Math.floor(left / 3600) + 'h ' + Math.floor(left % 3600 / 60) + 'm' : Math.floor(left / 60) + 'm ' + ('0' + left % 60).slice(-2) + 's');
      }
      place(run, { x: -250, y: 180, z: lerp(-200, 240, rp), ry: 14, rx: -2, o: P(u, 2.6, 3.0), blur: (1 - rp) * 12 + out * 10 });
      sheen(run, P(u, 3.0, 4.0));
      var r = clamp((u - 3.4) / 3.6, 0, 1) * 24.6;
      for (i = 0; i < STEPS.length; i++) {
        var st = STEPS[i], f = clamp((r - st[1]) / st[2], 0, 1);
        bars[i].style.transform = 'scaleX(' + f.toFixed(4) + ')';
        bars[i].style.opacity = f > 0 ? 1 : 0;
        durs[i].innerHTML = f <= 0 ? '' : f < 1 ? (r - st[1]).toFixed(1) + ' s' : '<span style="color:var(--emerald)">✓</span> ' + st[2].toFixed(1) + ' s';
      }
      retry.style.opacity = r > 4.8 + 6.1 ? 1 : 0;
      fin.innerHTML = r <= 0 ? '' : r < 24.6 ? 'Running · ' + r.toFixed(1) + ' s' : '<span style="color:var(--emerald)">●</span> Finished · 24.6 s · 4 alerts sent';
      alphaMul = 1;
      cap(u, 0.5, 9.1);
    };
  });

  /* 8 · Infrastructure --------------------------------------------------- */
  scene('infra', 'Infrastructure', 3, 0.1, 0.2, function (s) {
    var RX = 58;
    var rig = el('div', 'n', null, s.s3);
    var grid = el('div', 'floor-grid', null, rig);
    function gauge(label, v, col) {
      return '<div class="gauge"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/><circle class="ga" data-v="' + v + '" cx="42" cy="42" r="34" fill="none" stroke="' + col + '" stroke-width="7" stroke-linecap="round" transform="rotate(-90 42 42)" stroke-dasharray="213.6" stroke-dashoffset="213.6" style="filter:drop-shadow(0 0 6px ' + col + ')"/><text x="42" y="48" text-anchor="middle" fill="#eef2f8" font-family="Inter" font-weight="600" font-size="18" class="gv">0%</text></svg>' + label + '</div>';
    }
    function li(name, right, col) { return '<div class="li"><span class="dot" style="background:' + col + ';box-shadow:0 0 8px ' + col + '"></span>' + name + '<span class="r">' + right + '</span></div>'; }
    var NODES = [
      { x: -600, y: 60, h: '<h4>This PC</h4><div class="sub">Windows 11 · local</div>' + li('Cockpit Control', ':3080 · running', '#34d399') + li('Preview', 'disposable', '#64748b') + li('Docker Desktop', 'running', '#34d399') + '<div class="gauges">' + gauge('CPU', 14, '#4f8cff') + gauge('RAM', 58, '#a78bfa') + '</div>' },
      { x: 0, y: -260, h: '<h4>kimlj droplet</h4><div class="sub">Ubuntu · 1 vCPU · 2 GB</div>' + li('Caddy', '3 sites', '#34d399') + li('jobsift', 'systemd · active', '#34d399') + li('fail2ban', 'active', '#34d399') + '<div class="gauges">' + gauge('RAM', 43, '#67e8f9') + gauge('Disk', 42, '#fbbf24') + '</div>' },
      { x: 560, y: 60, h: '<h4>Endpoints</h4><div class="sub">HTTPS checks · read-only</div>' + li('kimlj.dev', '200 · 84 ms', '#34d399') + li('wordwarz.io', '200 · 112 ms', '#34d399') + li('mdsprosolutions.com', '200 · 96 ms', '#34d399') + li('hub status API', '200 · 140 ms', '#34d399') }
    ];
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'track'); svg.setAttribute('viewBox', '-1800 -700 3600 1400');
    var LINKS = [[0, 1], [1, 2], [0, 2]];
    var paths = LINKS.map(function (l) {
      var a = NODES[l[0]], b = NODES[l[1]], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (l[0] === 0 && l[1] === 2 ? 220 : -60);
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + a.x + ' ' + a.y + ' Q' + mx + ' ' + my + ' ' + b.x + ' ' + b.y);
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'rgba(103,232,249,.55)'); p.setAttribute('stroke-width', '3');
      p.setAttribute('stroke-dasharray', '14 18'); p.setAttribute('style', 'filter:drop-shadow(0 0 6px rgba(103,232,249,.8))');
      svg.appendChild(p); return p;
    });
    var packets = [];
    paths.forEach(function (p, i) {
      for (var k = 0; k < 3; k++) {
        var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '9'); c.setAttribute('fill', '#e0fbff');
        c.setAttribute('style', 'filter:drop-shadow(0 0 10px #67e8f9) drop-shadow(0 0 22px #4f8cff)');
        svg.appendChild(c); packets.push({ c: c, p: p, k: k, i: i });
      }
    });
    rig.appendChild(svg);
    var pads = NODES.map(function (n) { var d = el('div', 'ringfloor', null, rig); d.style.boxShadow = '0 0 0 2px rgba(103,232,249,.5), 0 0 40px rgba(103,232,249,.3)'; return d; });
    var cards = NODES.map(function (n) { var c = el('div', 'n0 pn infra', n.h, rig); c._g = c.querySelectorAll('.ga'); c._v = c.querySelectorAll('.gv'); return c; });
    var lens = null;
    var cap = makeCap(s.s2, { n: '06', k: 'Infrastructure', color: '#67e8f9', pos: 'tl', h: 'Read from|*the source.*', b: 'Machines, containers, services and endpoints, read from the systems that own them. Every check is read-only, and no agent tool can reach it.' });
    return function (u) {
      if (!lens) lens = paths.map(function (p) { return p.getTotalLength(); });
      var a = eio(P(u, -0.3, 1.6)), out = eio(P(u, 6.5, 7.3));
      var rx = lerp(80, RX, a);
      rig.style.transform = 'translate3d(' + lerp(60, 110, P(u, 0, 7.2)).toFixed(1) + 'px,260px,' + (lerp(-300, -20, a) - out * 600).toFixed(1) + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateZ(' + lerp(-4, 3, P(u, 0, 7.2)).toFixed(2) + 'deg)';
      var fo = P(u, 0, 0.8) * (1 - out);
      grid.style.opacity = fo; svg.style.opacity = fo * P(u, 0.8, 1.4);
      paths.forEach(function (p, i) { p.style.strokeDashoffset = (-u * 70).toFixed(1); });
      packets.forEach(function (q) {
        var f = (u * 0.55 + q.k / 3 + q.i * 0.17) % 1, pt = q.p.getPointAtLength(f * lens[q.i]);
        q.c.setAttribute('cx', pt.x.toFixed(1)); q.c.setAttribute('cy', pt.y.toFixed(1));
        q.c.style.opacity = Math.sin(f * Math.PI).toFixed(3);
      });
      cards.forEach(function (c, i) {
        var n = NODES[i], p = back(P(u, 0.5 + i * 0.18, 1.2 + i * 0.18));
        stand(c, n.x, n.y, rx, 30 + Math.sin(u * 1.3 + i) * 6, 0.65 + 0.35 * p, P(u, 0.5 + i * 0.18, 0.8 + i * 0.18) * (1 - out));
        for (var g = 0; g < c._g.length; g++) {
          var v = +c._g[g].getAttribute('data-v'), gp = eo(P(u, 1.3 + i * 0.2, 2.6 + i * 0.2)) * v;
          c._g[g].style.strokeDashoffset = (213.6 * (1 - gp / 100)).toFixed(1);
          c._v[g].textContent = Math.round(gp) + '%';
        }
        var pr = ((u - 0.6 - i * 0.4) % 1.6) / 1.6;
        pads[i].style.transform = 'translate3d(' + n.x + 'px,' + n.y + 'px,1px) scale(' + (0.6 + pr * 1.3).toFixed(3) + ')';
        pads[i].style.opacity = u > 0.6 ? ((1 - pr) * fo).toFixed(3) : 0;
      });
      cap(u, 0.4, 6.8);
    };
  });

  /* 9 · Knowledge -------------------------------------------------------- */
  /* Note counts are the Vault's own, counted 2026-10-19: 316 Markdown notes,
     of which these six areas hold 207; the rest are drawn unlabelled. */
  var HUBS = [
    { n: 'Projects', c: 26, rgb: C.blue, p: [-430, -150, 120] },
    { n: 'Decisions', c: 24, rgb: C.violet, p: [-170, 240, -200] },
    { n: 'Debugging', c: 102, rgb: C.rose, p: [300, -40, 60] },
    { n: 'Engineering', c: 19, rgb: C.cyan, p: [560, 250, -150] },
    { n: 'Concepts', c: 12, rgb: C.emerald, p: [-600, 230, -90] },
    { n: 'Playbooks', c: 24, rgb: C.amber, p: [40, -340, -260] }
  ];
  var GRAPH = (function () {
    var nodes = [], edges = [];
    HUBS.forEach(function (h, hi) {
      nodes.push({ x: h.p[0], y: h.p[1], z: h.p[2], hub: hi, isHub: true, t: 0.3 + hi * 0.32, r: 15 });
      var hubIdx = nodes.length - 1, spread = h.c > 50 ? 250 : 170;
      for (var i = 0; i < h.c; i++) {
        var s = hi * 1000 + i, th = hash(s * 1.3) * Math.PI * 2, ph = Math.acos(2 * hash(s * 2.7) - 1), r = 60 + spread * Math.sqrt(hash(s * 4.1));
        nodes.push({ x: h.p[0] + r * Math.sin(ph) * Math.cos(th), y: h.p[1] + r * Math.cos(ph) * 0.8, z: h.p[2] + r * Math.sin(ph) * Math.sin(th), hub: hi, t: 0.5 + hi * 0.32 + hash(s * 5.3) * 1.6, r: 3.2 + hash(s * 6.1) * 2.2 });
        edges.push([hubIdx, nodes.length - 1, 0.32]);
      }
    });
    for (var j = 0; j < 109; j++) {
      var th = hash(j * 9.1) * Math.PI * 2, y = (hash(j * 3.3) - 0.5) * 900, r = 500 + hash(j * 7.7) * 400;
      nodes.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r * 0.7, hub: -1, t: 1.2 + hash(j * 2.2) * 2.2, r: 2.4 });
    }
    for (var k = 0; k < 110; k++) {
      var a = Math.floor(hash(k * 11.3) * nodes.length), b = Math.floor(hash(k * 17.9) * nodes.length);
      if (a !== b) edges.push([a, b, 0.1]);
    }
    // The highlighted note is the first Decision (ADR-015 on screen).
    var focus = 0; for (var q = 0; q < nodes.length; q++) if (nodes[q].hub === 1 && !nodes[q].isHub) { focus = q; break; }
    return { nodes: nodes, edges: edges, focus: focus, newNode: { x: -330, y: -260, z: 220 } };
  })();
  scene('know', 'Knowledge', 5, 0.1, 0.3, function (s) {
    var labels = HUBS.map(function (h) { return el('div', 'hub-l', '<span class="dot" style="background:rgb(' + h.rgb + ');box-shadow:0 0 10px rgb(' + h.rgb + ')"></span>' + h.n + ' <small>' + h.c + '</small>', s.s2); });
    var note = sized(el('div', 'n pn note', null, s.s2), 540);
    note.innerHTML = chip('Decision', '#a78bfa') + '<h4>ADR-015 · The Workbench extends DSH, and its terminals stay out of reach</h4><p>Built as upstream DSH plus one local plugin. The DSH model has no path to the human terminals: no tool is registered, and the socket fails closed.</p><div class="tags">' + chip('#cockpit') + chip('#security') + chip('#architecture') + '</div>';
    var read = el('div', 'n', '<span class="chip" style="height:40px;font-size:14px;padding:0 16px;color:#e8845c"><i></i><span style="color:var(--text-2)">Claude Code read this before planning</span></span>', s.s2);
    var wrote = el('div', 'hub-l', '<span class="dot" style="background:#34d399;box-shadow:0 0 10px #34d399"></span>New log line <small>dsh-workbench.md</small>', s.s2);
    var stat = el('div', 'stat', '<div><b class="sv">0</b>notes</div><div><b>Markdown</b>Obsidian · local git</div>', s.s2);
    stat.style.right = '96px'; stat.style.bottom = '96px';
    var sv = stat.querySelector('.sv');
    var cap = makeCap(s.s2, { n: '07', k: 'Knowledge', color: '#a78bfa', pos: 'bl', h: 'A vault|*every agent reads.*', b: 'My Obsidian notes, decisions and debugging history as one live graph. Agents read it before they plan, and write back what they learned.' });
    s.graphLabels = function (proj, u, foc, vis) {
      labels.forEach(function (l, i) {
        var q = proj[i];
        if (!q) { l.style.opacity = 0; return; }
        var o = vis * P(u, 0.5 + i * 0.32, 1.0 + i * 0.32) * (i === 1 ? 1 : 1 - foc * 0.75);
        l.style.opacity = o.toFixed(3);
        l.style.transform = 'translate(' + (q.x + W / 2 + 22).toFixed(1) + 'px,' + (q.y + H / 2 - 18).toFixed(1) + 'px)';
      });
      var nq = proj.newNode;
      var wo = vis * win(u, 9.1, 11.6, 0.4, 0.5);
      wrote.style.opacity = wo.toFixed(3);
      if (nq) wrote.style.transform = 'translate(' + (nq.x + W / 2 + 22).toFixed(1) + 'px,' + (nq.y + H / 2 - 18).toFixed(1) + 'px)';
    };
    return function (u) {
      var np = eo5(P(u, 5.5, 6.3)) * (1 - eio(P(u, 8.5, 9.1)));
      place(note, { x: 520, y: -60, z: 0, s: 0.94 + np * 0.06, o: np, blur: (1 - np) * 10 });
      var rp = eo(P(u, 6.6, 7.1)) * (1 - eio(P(u, 8.5, 9.1)));
      place(read, { x: 520, y: 205 + (1 - rp) * 16, o: rp });
      var so = win(u, 1.0, 11.6, 0.6, 0.6);
      stat.style.opacity = so.toFixed(3);
      sv.textContent = Math.round(316 * eo(P(u, 1.0, 3.4)));
      cap(u, 0.5, 11.5);
    };
  });

  /* 10 · Outro ----------------------------------------------------------- */
  var OUTRO_LOGO_Y = -205, OUTRO_LOGO_S = 0.62;
  scene('outro', 'Built with AI', 4, 0.2, 0, function (s) {
    var MINI = [
      ['Workbench', '#4f8cff', '<rect x="0" y="6" width="300" height="108" rx="10" fill="rgba(5,8,15,.8)"/><circle cx="18" cy="24" r="4" fill="#e8845c"/><circle cx="34" cy="24" r="4" fill="#e5e7eb"/><circle cx="50" cy="24" r="4" fill="#f5c542"/><rect x="14" y="44" width="180" height="6" rx="3" fill="#7aa7ff"/><rect x="14" y="60" width="120" height="6" rx="3" fill="#475569"/><rect x="14" y="76" width="150" height="6" rx="3" fill="#34d399"/>'],
      ['Agent workflow', '#22d3ee', '<path d="M10 60 C80 20,120 100,150 60 S240 20,290 60" stroke="url(#mg)" stroke-width="4" fill="none"/><g fill="#eef2f8"><circle cx="10" cy="60" r="7"/><circle cx="80" cy="44" r="7"/><circle cx="150" cy="60" r="7"/><circle cx="220" cy="48" r="7"/><circle cx="290" cy="60" r="7" fill="#34d399"/></g>'],
      ['Agents', '#a78bfa', '<circle cx="60" cy="60" r="34" fill="#e8845c" opacity=".85"/><circle cx="150" cy="60" r="34" fill="#e5e7eb" opacity=".85"/><circle cx="240" cy="60" r="34" fill="#6f8bff" opacity=".85"/>'],
      ['Image rail', '#d062ff', '<image href="' + AVATAR + '" x="90" y="0" width="120" height="120"/>'],
      ['Automations', '#fbbf24', '<rect x="0" y="16" width="120" height="12" rx="6" fill="#4f8cff"/><rect x="120" y="44" width="40" height="12" rx="6" fill="#67e8f9"/><rect x="160" y="72" width="110" height="12" rx="6" fill="#a78bfa"/><rect x="270" y="100" width="30" height="12" rx="6" fill="#34d399"/>'],
      ['Infrastructure', '#67e8f9', '<path d="M40 90 L150 30 L260 90 Z" stroke="#67e8f9" stroke-width="3" fill="none" stroke-dasharray="8 8"/><g fill="#0b1020" stroke="#67e8f9" stroke-width="3"><circle cx="40" cy="90" r="14"/><circle cx="150" cy="30" r="14"/><circle cx="260" cy="90" r="14"/></g>'],
      ['Knowledge', '#a78bfa', '<g stroke="rgba(167,139,250,.5)"><line x1="150" y1="60" x2="70" y2="30"/><line x1="150" y1="60" x2="230" y2="24"/><line x1="150" y1="60" x2="90" y2="100"/><line x1="150" y1="60" x2="220" y2="96"/></g><circle cx="150" cy="60" r="12" fill="#a78bfa"/><g fill="#fb7185"><circle cx="70" cy="30" r="6"/><circle cx="230" cy="24" r="6" fill="#4f8cff"/><circle cx="90" cy="100" r="6" fill="#34d399"/><circle cx="220" cy="96" r="6" fill="#fbbf24"/></g>']
    ];
    var minis = MINI.map(function (m) {
      return el('div', 'n pn mini', '<div class="t"><i style="background:' + m[1] + ';box-shadow:0 0 12px ' + m[1] + '"></i>' + m[0] + '</div><svg viewBox="0 0 300 120"><defs><linearGradient id="mg"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#b06bff"/></linearGradient></defs>' + m[2] + '</svg>', s.s3);
    });
    var logo = logoNode(s.s2, Math.round(850 * LOGO_SCALE));
    var word = el('div', 'wordmark', null, s.s2); word.style.top = (540 - 60) + 'px'; word.style.fontSize = '132px';
    var letters = 'Cockpit'.split('').map(function (ch) { return el('span', null, ch, word); });
    var credit = el('div', 'credit', 'Designed and built by <b>Kim Julongbayan</b><br>with Claude Code, Codex and DeepSeek', s.s2); credit.style.top = (540 + 130) + 'px';
    var url = el('div', 'url', '<span class="hl">kimlj.dev</span>', s.s2); url.style.top = (540 + 280) + 'px';
    return function (u) {
      var spin = u * 16, col = eio(P(u, 3.1, 4.6));
      minis.forEach(function (m, i) {
        var a = (i / MINI.length) * 360 + spin, rad = a * Math.PI / 180, R = lerp(980, 0, col) * eo5(P(u, -0.2, 1.2));
        var inP = eo5(P(u, 0.0 + i * 0.08, 0.9 + i * 0.08));
        place(m, { x: Math.sin(rad) * R, y: -30 + Math.cos(rad) * 70 * (1 - col), z: Math.cos(rad) * R - 300 + (1 - inP) * -900, s: 1 - col * 0.8, o: inP * (1 - ei(col)), blur: (1 - inP) * 10 + col * 6 });
      });
      s.s3.style.transform = 'rotateX(10deg)';
      var lp = eo(P(u, 4.85, 5.6));
      logo.style.transform = 'translate(-50%,-50%) translateY(' + OUTRO_LOGO_Y + 'px) scale(' + ((0.94 + lp * 0.06) * OUTRO_LOGO_S).toFixed(4) + ')';
      logo.style.opacity = lp.toFixed(3);
      logo.style.filter = 'drop-shadow(0 0 ' + (40 + bump(u, 5.0, 0.3, 0.6) * 70).toFixed(0) + 'px rgba(100,110,255,.6))' + (lp < 0.99 ? ' blur(' + ((1 - lp) * 10).toFixed(1) + 'px)' : '');
      letters.forEach(function (l, i) {
        var p = eo5(P(u, 5.15 + i * 0.05, 5.95 + i * 0.05));
        wordIn(l, p); l.style.color = '#fff';
      });
      var cp = eo(P(u, 6.0, 6.8)), up = eo(P(u, 6.6, 7.4));
      credit.style.opacity = cp; credit.style.transform = 'translateY(' + ((1 - cp) * 18) + 'px)';
      url.style.opacity = up; url.style.letterSpacing = lerp(0.5, 0.14, up) + 'em';
    };
  });

  var DUR = CLOCK;
  SCENES.forEach(function (s) { s.draw = s.build(s); });

  /* ---------------------------------------------------------------- canvas */

  function makeSprite(rgb, core) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,' + (core == null ? 1 : core) + ')');
    gr.addColorStop(0.16, 'rgba(' + rgb + ',1)');
    gr.addColorStop(0.42, 'rgba(' + rgb + ',.32)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  var SPR_FIELD = makeSprite('170,200,255', 0.9);
  var SPR_LOGO = []; for (var li = 0; li < 10; li++) SPR_LOGO.push(makeSprite(logoRGB(li / 9)));
  var SPR = {}; Object.keys(C).forEach(function (k) { SPR[C[k]] = makeSprite(C[k]); });
  var SPR_GREY = makeSprite('120,135,165', 0.5);

  var CAMZ = 1500, FOC = 1100;
  var NP = 2000, PX = new Float32Array(NP), PY = new Float32Array(NP), PZ = new Float32Array(NP), PS = new Float32Array(NP);
  var LX = new Float32Array(NP), LY = new Float32Array(NP), LC = new Uint8Array(NP);
  (function seedParticles() {
    function inside(poly, x, y) {
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
      }
      return true;
    }
    var n = 0, s = 0;
    while (n < NP) {
      s++;
      var x = hash(s * 1.91) * 850, y = hash(s * 3.77) * 740;
      if (inside(LOGO_POLYS[0], x, y) || inside(LOGO_POLYS[1], x, y)) {
        LX[n] = (x - 425) * LOGO_SCALE; LY[n] = (y - 370) * LOGO_SCALE;
        LC[n] = Math.round(clamp((x / 850) * 0.75 + (1 - y / 740) * 0.25, 0, 1) * 9);
        n++;
      }
      if (s > NP * 10) break;
    }
    for (var i = 0; i < NP; i++) {
      PX[i] = (hash(i * 3.1) - 0.5) * 3800; PY[i] = (hash(i * 7.3) - 0.5) * 2300;
      PZ[i] = hash(i * 1.7) * 3000 - 1600; PS[i] = hash(i * 5.9);
    }
  })();
  /* How far the field has flowed toward the camera by time t. Bursts at the
     cuts are integrals of eased windows, so the flow stays a function of t. */
  var BURSTS = [[5.6, 7.6, 2600], [11.6, 12.6, 700], [21.0, 22.2, 900], [38.0, 38.9, 450], [45.2, 46.0, 450], [54.8, 55.6, 450], [64.4, 65.2, 450], [71.4, 72.6, 800], [83.4, 84.6, 600], [87.2, 89.0, 2400]];
  function flow(t) {
    var d = 38 * t;
    for (var i = 0; i < BURSTS.length; i++) d += BURSTS[i][2] * eio(P(t, BURSTS[i][0], BURSTS[i][1]));
    return d;
  }
  function logoW(t) {
    return Math.max(eio(P(t, 6.6, 8.6)) * (1 - eio(P(t, 11.3, 12.3))), eio(P(t, 87.3, 88.9)));
  }
  function fieldAmt(t) {
    var a = 0.55 + 0.45 * P(t, 0, 1.5);
    if (t > 12.6 && t < 84) a *= 0.55;
    return a;
  }

  function drawParticles(t) {
    var f0 = flow(t), dz = f0 - flow(t - 0.045), w = logoW(t), fa = fieldAmt(t);
    var outro = t > 80, ly0 = outro ? OUTRO_LOGO_Y : TITLE_LOGO_Y, lsc = outro ? OUTRO_LOGO_S : 1;
    var logoAlpha = outro ? 1 - 0.65 * P(t, 89.3, 90.4) : 1 - 0.6 * P(t, 8.4, 9.2);
    var streak = dz > 6;
    cx.globalCompositeOperation = 'lighter';
    if (streak) cx.lineCap = 'round';
    for (var i = 0; i < NP; i++) {
      var z = ((PZ[i] + f0 + 1600) % 3000 + 3000) % 3000 - 1600;
      var x = PX[i] + Math.sin(t * 0.13 + i) * 30, y = PY[i] + Math.cos(t * 0.11 + i * 1.3) * 22;
      var wi = w > 0 ? eio(clamp(w * 1.45 - PS[i] * 0.45, 0, 1)) : 0;
      if (wi > 0) {
        var jitter = Math.sin(t * 2 + i) * 1.4 * (1 - wi);
        x = lerp(x, LX[i] * lsc + jitter, wi); y = lerp(y, LY[i] * lsc + ly0, wi); z = lerp(z, CAMZ - FOC, wi);
      }
      var depth = CAMZ - z;
      if (depth < 120) continue;
      var sc = FOC / depth, sx = x * sc, sy = y * sc;
      if (sx < -1000 || sx > 1000 || sy < -580 || sy > 580) continue;
      var near = clamp((z + 1600) / 2600, 0, 1);
      var a = (0.15 + near * 0.75) * (1 - P(z, 1250, 1400)) * fa;
      if (wi > 0) a = lerp(a, 0.95 * logoAlpha, wi);
      if (a < 0.01) continue;
      var size = (wi > 0.5 ? 6 : 3.4 + PS[i] * 4) * sc;
      if (streak && wi < 0.5) {
        var pz = z - dz, pd = CAMZ - pz, ps = FOC / pd, px = x * ps, py = y * ps;
        cx.strokeStyle = 'rgba(170,200,255,' + (a * 0.6).toFixed(3) + ')';
        cx.lineWidth = Math.max(0.6, size * 0.35);
        cx.beginPath(); cx.moveTo(px, py); cx.lineTo(sx, sy); cx.stroke();
      }
      cx.globalAlpha = a;
      cx.drawImage(wi > 0.5 ? SPR_LOGO[LC[i]] : SPR_FIELD, sx - size, sy - size, size * 2, size * 2);
    }
    cx.globalAlpha = 1;
  }

  /* The aurora: four slow washes, plus one that takes the colour of the
     moment (rose for the finding, emerald for the checkpoint, …). */
  function blob(x, y, r, rgb, a) {
    if (a <= 0.003) return;
    var g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  var MOODS = [[0, C.blue], [21.6, C.blue], [29.9, C.rose], [33.2, C.emerald], [34.5, C.amber], [35.6, C.emerald], [38.4, C.violet], [45.6, C.magenta], [55.2, C.amber], [64.8, C.cyan], [72, C.violet], [84, C.blue]];
  function mood(t) { var m = MOODS[0][1]; for (var i = 0; i < MOODS.length; i++) if (t >= MOODS[i][0]) m = MOODS[i][1]; return m; }
  function drawAurora(t) {
    cx.globalCompositeOperation = 'lighter';
    var amt = 0.35 + 0.65 * P(t, 0.5, 4);
    blob(-520 + Math.sin(t * 0.07) * 380, -260 + Math.cos(t * 0.05) * 160, 1000, C.blue, 0.2 * amt);
    blob(560 + Math.cos(t * 0.06 + 1) * 360, 160 + Math.sin(t * 0.08) * 180, 950, '124,108,255', 0.17 * amt);
    blob(Math.sin(t * 0.045 + 2) * 600, 420, 800, '34,211,238', 0.08 * amt);
    blob(Math.cos(t * 0.05) * 300, -460, 700, '208,98,255', 0.06 * amt);
    blob(Math.sin(t * 0.09) * 260, 120, 900, mood(t), 0.1 * amt);
  }

  /* Knowledge graph, drawn on the canvas with its labels laid over it. */
  var KS = null;
  SCENES.forEach(function (s) { if (s.id === 'know') KS = s; });
  function drawGraph(t) {
    var u = t - KS.t0, N = GRAPH.nodes, vis = P(u, 0, 0.6) * (1 - eio(P(u, 11.3, 12.2)));
    if (vis <= 0) return;
    var ang = -0.55 + u * 0.085, tilt = 0.26, ca = Math.cos(ang), sa = Math.sin(ang), cb = Math.cos(tilt), sb = Math.sin(tilt);
    var foc = eio(P(u, 4.7, 6.0)) * (1 - eio(P(u, 8.4, 9.6)));
    var D = lerp(1650, 1000, foc) + (1 - eo(P(u, 0, 3))) * 600, F = 1450;
    var hubF = N[GRAPH.focus];
    function rot(x, y, z) { var x1 = x * ca + z * sa, z1 = -x * sa + z * ca; return [x1, y * cb - z1 * sb, y * sb + z1 * cb]; }
    var fr = rot(hubF.x, hubF.y, hubF.z), ox = -fr[0] * foc, oy = -fr[1] * foc, oz = -fr[2] * foc;
    var shX = lerp(250, -330, foc), shY = lerp(-60, 0, foc);
    var proj = new Array(N.length);
    function project(x, y, z) {
      var r = rot(x, y, z), zz = r[2] + oz, d = D - zz;
      if (d < 100) return null;
      var s = F / d;
      return { x: (r[0] + ox) * s + shX, y: (r[1] + oy) * s + shY, s: s, z: zz };
    }
    for (var i = 0; i < N.length; i++) {
      var n = N[i], ap = eo5(P(u, n.t, n.t + 1.3));
      if (ap <= 0) { proj[i] = null; continue; }
      var k = 1 - ap;
      var q = project(n.x * (1 + k * 1.6), n.y * (1 + k * 1.6), n.z - k * 1500);
      if (q) q.a = P(u, n.t, n.t + 0.5) * vis;
      proj[i] = q;
    }
    cx.globalCompositeOperation = 'lighter';
    cx.lineWidth = 1;
    GRAPH.edges.forEach(function (e) {
      var a = proj[e[0]], b = proj[e[1]];
      if (!a || !b) return;
      var h = N[e[1]].hub >= 0 ? N[e[1]].hub : N[e[0]].hub;
      var rgb = h >= 0 ? HUBS[h].rgb : '120,135,165';
      var al = Math.min(a.a, b.a) * e[2] * (foc > 0 && N[e[0]].hub !== 1 ? 1 - foc * 0.6 : 1);
      if (al < 0.01) return;
      cx.strokeStyle = 'rgba(' + rgb + ',' + al.toFixed(3) + ')';
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    });
    for (i = 0; i < N.length; i++) {
      var p = proj[i]; if (!p || p.a < 0.01) continue;
      n = N[i];
      var spr = n.hub >= 0 ? SPR[HUBS[n.hub].rgb] : SPR_GREY;
      var size = n.r * p.s * (n.isHub ? 2.6 : 2.2) * (i === GRAPH.focus ? 1 + foc * 1.4 : 1);
      var dimO = foc > 0 && n.hub !== 1 ? 1 - foc * 0.55 : 1;
      cx.globalAlpha = clamp(p.a * dimO, 0, 1);
      cx.drawImage(spr, p.x - size, p.y - size, size * 2, size * 2);
      if (n.isHub) {
        cx.globalAlpha = p.a * 0.6;
        cx.strokeStyle = 'rgba(' + HUBS[n.hub].rgb + ',.8)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(p.x, p.y, size * 0.9, 0, Math.PI * 2); cx.stroke();
      }
    }
    cx.globalAlpha = 1;
    var fq = proj[GRAPH.focus], cardO = eo5(P(u, 5.5, 6.3)) * (1 - eio(P(u, 8.5, 9.1)));
    if (fq && cardO > 0) {
      cx.strokeStyle = 'rgba(167,139,250,' + (0.85 * cardO).toFixed(3) + ')'; cx.lineWidth = 2;
      cx.beginPath(); cx.arc(fq.x, fq.y, 22 + Math.sin(u * 4) * 3, 0, Math.PI * 2); cx.stroke();
      var g = cx.createLinearGradient(fq.x, fq.y, 520 - 270, -60);
      g.addColorStop(0, 'rgba(167,139,250,' + cardO.toFixed(3) + ')'); g.addColorStop(1, 'rgba(79,140,255,' + (cardO * 0.6).toFixed(3) + ')');
      cx.strokeStyle = g; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(fq.x + 22, fq.y); cx.bezierCurveTo(fq.x + 160, fq.y, 520 - 400, -60, 520 - 270, -60); cx.stroke();
    }
    var nn = GRAPH.newNode, nq = project(nn.x, nn.y, nn.z), np = P(u, 9.0, 9.5) * vis;
    if (nq && np > 0) {
      var hq = proj[0];
      if (hq) { cx.strokeStyle = 'rgba(52,211,153,' + (0.7 * np).toFixed(3) + ')'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(hq.x, hq.y); cx.lineTo(nq.x, nq.y); cx.stroke(); }
      cx.globalAlpha = np; var ns = 9 * nq.s * 2.4 * (1 + bump(u, 9.2, 0.1, 0.3));
      cx.drawImage(SPR[C.emerald], nq.x - ns, nq.y - ns, ns * 2, ns * 2); cx.globalAlpha = 1;
      for (var r = 0; r < 2; r++) {
        var rp = ((u - 9.0 - r * 0.6) % 1.2) / 1.2;
        if (u - 9.0 - r * 0.6 < 0) continue;
        cx.strokeStyle = 'rgba(52,211,153,' + ((1 - rp) * 0.8 * np).toFixed(3) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(nq.x, nq.y, 10 + rp * 60, 0, Math.PI * 2); cx.stroke();
      }
    }
    var hubsProj = HUBS.map(function (h, hi) { var idx = 0, c = 0; for (var j = 0; j < N.length; j++) if (N[j].isHub && N[j].hub === hi) { idx = j; break; } return proj[idx]; });
    hubsProj.newNode = nq;
    KS.graphLabels(hubsProj, u, foc, vis);
  }

  function drawCanvas(t) {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalCompositeOperation = 'source-over';
    cx.globalAlpha = 1;
    cx.fillStyle = '#05080f'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.setTransform(K, 0, 0, K, W / 2 * K, H / 2 * K);
    drawAurora(t);
    drawParticles(t);
    if (KS && t > KS.t0 - 0.1 && t < KS.t1 + 0.4) drawGraph(t);
  }

  /* ------------------------------------------------------------- composite */

  var FLASHES = [[7.2, 0.06, 0.35, 0.9], [12.0, 0.1, 0.3, 0.22], [21.6, 0.1, 0.3, 0.25], [24.6, 0.05, 0.2, 0.1], [35.4, 0.05, 0.3, 0.16], [36.0, 0.05, 0.4, 0.2], [38.4, 0.1, 0.3, 0.18], [45.6, 0.1, 0.3, 0.18], [51.0, 0.05, 0.4, 0.22], [55.2, 0.1, 0.3, 0.16], [64.8, 0.1, 0.3, 0.16], [72.0, 0.1, 0.3, 0.2], [84.0, 0.1, 0.3, 0.16], [88.8, 0.06, 0.45, 0.85]];
  function render(t) {
    t = clamp(t, 0, DUR - 0.0005);
    drawCanvas(t);
    var anyCursor = false;
    SCENES.forEach(function (s) {
      var on = t >= s.t0 - s.pre && t < s.t1 + s.post;
      if (on !== s.on) { s.on = on; s.s3.style.display = s.s2.style.display = on ? 'block' : 'none'; }
      if (on) { alphaMul = 1; s.draw(t - s.t0); if (s.id === 'workflow') anyCursor = true; }
    });
    if (!anyCursor) hideCursor();
    var fl = 0;
    FLASHES.forEach(function (f) { fl += bump(t, f[0], f[1], f[2]) * f[3]; });
    flashEl.style.opacity = clamp(fl, 0, 1).toFixed(3);
    blackEl.style.opacity = Math.max(1 - eo(P(t, 0, 0.8)), eio(P(t, DUR - 1.3, DUR - 0.05))).toFixed(3);
    grain.style.backgroundPosition = Math.floor(hash(Math.floor(t * 24)) * 256) + 'px ' + Math.floor(hash(Math.floor(t * 24) + 0.5) * 256) + 'px';
  }

  /* ----------------------------------------------------------------- score */

  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var SCORE = [];
  function ev(t, k, a, d, h) { SCORE.push({ t: t, k: k, a: a || [], d: d || 0, h: !!h }); }
  var CH = {
    Dm: { pad: [50, 53, 57, 60, 64], root: 38, arp: [62, 65, 69, 72, 74, 72, 69, 65] },
    Bb: { pad: [46, 53, 57, 60, 62], root: 34, arp: [62, 65, 70, 74, 77, 74, 70, 65] },
    F: { pad: [53, 57, 60, 64, 67], root: 41, arp: [60, 65, 69, 72, 77, 72, 69, 65] },
    C: { pad: [48, 55, 60, 62, 64], root: 36, arp: [60, 64, 67, 72, 74, 72, 67, 64] }
  };
  function bar(b) { return b * BAR; }
  /* One bar of the groove. o: {kick: 'four'|'two'|'half'|0, snare, hats, arp, sub, pad, bright, ticks} */
  function groove(b, chord, o) {
    var t0 = bar(b), c = CH[chord], i;
    if (o.pad !== 0) ev(t0, 'pad', [c.pad, o.pad || 1, o.bright || 1600, 0.6], BAR, true);
    if (o.sub !== 0) for (i = 0; i < (o.sub === 'pulse' ? 8 : 1); i++) ev(t0 + i * BEAT / 2 * (o.sub === 'pulse' ? 1 : 0), 'sub', [c.root, o.sub === 'pulse' ? 0.16 : 0.2, 0.15], o.sub === 'pulse' ? 0.22 : BAR - 0.3);
    var kicks = o.kick === 'four' ? [0, 1, 2, 3] : o.kick === 'two' ? [0, 2] : o.kick === 'half' ? [0] : [];
    kicks.forEach(function (k) { ev(t0 + k * BEAT, 'kick', [0.5]); });
    if (o.snare) [1, 3].forEach(function (k) { if (o.snare === 'half' && k === 1) return; ev(t0 + k * BEAT, 'snare', [0.08]); });
    if (o.hats) for (i = 0; i < 4; i++) ev(t0 + i * BEAT + BEAT / 2, 'hat', [0.035, 0.12]);
    if (o.ticks) for (i = 0; i < 16; i++) ev(t0 + i * BEAT / 4, 'tick', [i % 4 === 0 ? 0.03 : 0.016]);
    if (o.arp) for (i = 0; i < 8; i++) ev(t0 + i * BEAT / 2, o.arp === 'bell' ? 'bell' : 'pluck', o.arp === 'bell' ? [c.arp[i] + 12, 0.022, 1.2] : [c.arp[i], 0.05, o.bright ? o.bright * 1.3 : 2400]);
  }
  (function writeScore() {
    var i;
    // Chaos: a low drone, a clock, a note for every window that opens.
    ev(0, 'pad', [[38, 45, 50, 53], 1.4, 520, 1.5], 7.0, true);
    ev(0, 'sub', [26, 0.12, 1], 6.8, true);
    for (i = 0; i < 24; i++) if (i >= 4) ev(i * BEAT / 2, 'tick', [i % 2 ? 0.014 : 0.024]);
    [74, 77, 79, 81, 84, 86, 81].forEach(function (m, k) { ev(0.85 + k * 0.3, 'pluck', [m, 0.045, 3200]); });
    ev(4.8, 'riser', [2.4]);
    ev(5.9, 'whoosh', [1.3, 0.09, 1]);
    // Title
    ev(7.2, 'boom', [0.55]); ev(7.2, 'crash', [0.11, 3]); ev(7.2, 'sub', [38, 0.32, 1.2], 2.2);
    ev(7.2, 'pad', [[50, 53, 57, 60, 64, 69], 1.25, 2300, 1.4], 4.6, true);
    [[8.85, 74], [9.15, 81], [9.45, 86], [9.9, 77]].forEach(function (b) { ev(b[0], 'bell', [b[1], 0.05, 2.4]); });
    ev(11.2, 'whoosh', [0.8, 0.1, 1]);
    // Workbench
    groove(5, 'Dm', { kick: 'two', hats: true, arp: 'pluck', bright: 1500 });
    groove(6, 'Bb', { kick: 'four', snare: true, hats: true, arp: 'pluck', bright: 1900 });
    groove(7, 'F', { kick: 'four', snare: true, hats: true, arp: 'pluck', bright: 2200 });
    groove(8, 'C', { kick: 'four', snare: true, hats: true, arp: 'pluck', bright: 2500 });
    ev(bar(9) - 1.2, 'riser', [1.2]);
    // Workflow
    ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C'].forEach(function (ch, k) {
      groove(9 + k, ch, { kick: k === 0 ? 'two' : 'four', snare: k > 0, hats: true, arp: 'pluck', bright: 2000 + k * 150, sub: k === 3 ? 'pulse' : undefined });
    });
    var W0 = bar(9);
    ev(W0 + 3.0, 'tick', [0.12]); ev(W0 + 3.0, 'bell', [81, 0.04, 1.4]); ev(W0 + 3.1, 'whoosh', [0.9, 0.08, 1]);
    [[4.2, 74], [5.4, 77], [7.3, 81], [7.8, 84]].forEach(function (b) { ev(W0 + b[0], 'bell', [b[1], 0.04, 1.6]); });
    ev(W0 + 8.4, 'pad', [[49, 50, 56], 1.8, 900, 0.8], 1.0); ev(W0 + 8.4, 'boom', [0.28]); ev(W0 + 8.4, 'snare', [0.12]);
    ev(W0 + 8.95, 'whoosh', [1.25, 0.1, -1]);
    [[10.6, 77], [11.2, 81], [11.85, 86], [11.9, 81], [12.55, 84]].forEach(function (b) { ev(W0 + b[0], 'bell', [b[1], 0.04, 1.8]); });
    ev(W0 + 13.8, 'crash', [0.08, 2]); [86, 81, 74].forEach(function (m, k) { ev(W0 + 13.8 + k * 0.06, 'bell', [m, 0.05, 2.4]); });
    ev(W0 + 14.4, 'boom', [0.3]); ev(W0 + 14.4, 'bell', [93, 0.03, 2.6]);
    // Agents
    groove(16, 'Bb', { kick: 'half', snare: 'half', hats: true, pad: 1.1, bright: 1400 });
    groove(17, 'F', { kick: 'half', snare: 'half', hats: true, pad: 1.1, bright: 1500 });
    groove(18, 'C', { kick: 'half', snare: 'half', hats: true, pad: 1.1, bright: 1600 });
    [69, 72, 74, 77, 81, 84].forEach(function (m, k) { ev(bar(16) + 1.05 + k * 0.14, 'pluck', [m, 0.05, 3000]); ev(bar(16) + 1.05 + k * 0.14, 'tick', [0.04]); });
    ev(bar(16) + 4.6, 'bell', [81, 0.04, 2]);
    // Image rail
    ['Dm', 'Bb', 'F', 'C'].forEach(function (ch, k) { groove(19 + k, ch, { kick: 'two', snare: k > 1, hats: true, arp: 'bell', bright: 1700 + k * 200 }); });
    var I0 = bar(19);
    ev(I0 + 2.05, 'tick', [0.1]); ev(I0 + 2.05, 'bell', [86, 0.035, 1.4]);
    ev(I0 + 4.2, 'riser', [1.2]);
    ev(I0 + 5.4, 'crash', [0.07, 2.4]); [86, 89, 93, 98].forEach(function (m, k) { ev(I0 + 5.4 + k * 0.08, 'bell', [m, 0.04, 2]); });
    ev(I0 + 6.7, 'whoosh', [1.0, 0.07, 1]);
    // Automations
    ['Dm', 'Bb', 'F', 'C'].forEach(function (ch, k) { groove(23 + k, ch, { kick: 'four', snare: k > 0, hats: true, ticks: true, arp: 'pluck', bright: 2100 + k * 150 }); });
    var A0 = bar(23);
    [3.91, 4.0, 6.7, 6.86, 6.9].forEach(function (u, k) { ev(A0 + u, 'pluck', [[74, 77, 81, 84, 86][k], 0.06, 3600]); });
    ev(A0 + 4.95, 'pluck', [70, 0.05, 1800]);
    ev(A0 + 2.6, 'whoosh', [0.8, 0.07, 1]);
    // Infrastructure
    ['Bb', 'F', 'C'].forEach(function (ch, k) { groove(27 + k, ch, { kick: 'two', snare: true, hats: true, sub: 'pulse', bright: 1800 }); });
    for (i = 0; i < 5; i++) ev(bar(27) + 0.6 + i * 1.6, 'bell', [93, 0.016, 0.8]);
    // Knowledge
    ev(bar(30), 'pad', [[50, 57, 62, 64, 69], 1.3, 1500, 1.2], BAR * 2, true);
    ev(bar(30), 'sub', [38, 0.16, 1], BAR * 2 - 0.4);
    [74, 77, 81, 84, 86, 89].forEach(function (m, k) { ev(bar(30) + 0.4 + k * 0.32, 'bell', [m, 0.035, 2.4]); });
    ['F', 'C', 'Dm'].forEach(function (ch, k) { groove(32 + k, ch, { kick: k ? 'four' : 'two', snare: k > 0, hats: true, arp: 'bell', bright: 1700 }); });
    ev(bar(30) + 4.8, 'whoosh', [1.0, 0.07, 1]);
    ev(bar(30) + 6.6, 'bell', [81, 0.035, 2]);
    ev(bar(30) + 9.0, 'bell', [86, 0.04, 2]); ev(bar(30) + 9.0, 'bell', [93, 0.025, 2]);
    // Outro
    groove(35, 'Bb', { kick: 'four', snare: true, hats: true, arp: 'pluck', bright: 2400 });
    groove(36, 'C', { kick: 'four', snare: true, hats: true, arp: 'pluck', bright: 2800 });
    ev(bar(36), 'riser', [2.4]);
    ev(bar(37), 'boom', [0.55]); ev(bar(37), 'crash', [0.12, 3.5]); ev(bar(37), 'sub', [38, 0.32, 1.5], 2.8);
    ev(bar(37), 'pad', [[50, 53, 57, 60, 64, 69], 1.35, 2200, 1.6], 3.0, true);
    [[0.8, 74], [1.2, 81], [1.6, 86], [2.2, 89], [2.9, 81]].forEach(function (b) { ev(bar(37) + b[0], 'bell', [b[1], 0.045, 2.6]); });
    SCORE.sort(function (a, b) { return a.t - b.t; });
  })();

  function makeNoise(c) {
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = hash(i * 0.913) * 2 - 1;
    return buf;
  }
  function makeVerb(c) {
    var len = Math.floor(c.sampleRate * 3), buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (hash(i * 1.37 + ch * 7.1) * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    var v = c.createConvolver(); v.buffer = buf; return v;
  }
  function out(S, node, wetAmt) {
    node.connect(S.bus);
    if (wetAmt) { var w = S.c.createGain(); w.gain.value = wetAmt; node.connect(w); w.connect(S.wet); }
  }
  function envGain(S, t, v, att, tau, wet) {
    var g = S.c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + att);
    g.gain.setTargetAtTime(0, t + att, tau);
    out(S, g, wet);
    return g;
  }
  function noiseSrc(S, t, dur) {
    var n = S.c.createBufferSource(); n.buffer = S.noise; n.loop = true;
    n.start(t, hash(t) * 1.5); n.stop(t + dur); return n;
  }
  var INST = {
    pad: function (S, t, a, d) {
      var notes = a[0], lvl = a[1], cut = a[2], rel = a[3] || 1.4, c = S.c;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.4;
      f.frequency.setValueAtTime(cut * 0.6, t); f.frequency.linearRampToValueAtTime(cut, t + d);
      var g = c.createGain(), att = Math.min(0.9, d * 0.4);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03 * lvl, t + att);
      g.gain.setValueAtTime(0.03 * lvl, t + d); g.gain.linearRampToValueAtTime(0, t + d + rel);
      f.connect(g); out(S, g, 0.5);
      notes.forEach(function (m) {
        [-7, 7].forEach(function (cents) {
          var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = m2f(m); o.detune.value = cents;
          o.connect(f); o.start(t); o.stop(t + d + rel + 0.05);
        });
      });
    },
    sub: function (S, t, a, d) {
      var c = S.c, o = c.createOscillator(), g = c.createGain(), rel = a[2] || 0.4;
      o.type = 'sine'; o.frequency.value = m2f(a[0]);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a[1], t + 0.03);
      g.gain.setValueAtTime(a[1], t + d); g.gain.linearRampToValueAtTime(0, t + d + rel);
      o.connect(g); out(S, g, 0); o.start(t); o.stop(t + d + rel + 0.05);
    },
    pluck: function (S, t, a) {
      var c = S.c, o = c.createOscillator(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = m2f(a[0]);
      f.type = 'lowpass'; f.frequency.setValueAtTime(Math.min(a[2] || 2400, 12000), t);
      f.frequency.setTargetAtTime(250, t, 0.09);
      var g = envGain(S, t, a[1], 0.004, 0.11, 0.35);
      o.connect(f); f.connect(g); o.start(t); o.stop(t + 0.8);
    },
    bell: function (S, t, a) {
      var c = S.c, fq = m2f(a[0]), dur = a[2] || 2;
      var car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
      car.frequency.value = fq; mod.frequency.value = fq * 3.5;
      mg.gain.setValueAtTime(fq * 1.6, t); mg.gain.setTargetAtTime(0, t, 0.25);
      mod.connect(mg); mg.connect(car.frequency);
      var g = envGain(S, t, a[1], 0.003, dur / 5, 0.55);
      car.connect(g); car.start(t); mod.start(t); car.stop(t + dur + 0.5); mod.stop(t + dur + 0.5);
    },
    kick: function (S, t, a) {
      var c = S.c, o = c.createOscillator();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      var g = envGain(S, t, a[0], 0.002, 0.09, 0);
      o.connect(g); o.start(t); o.stop(t + 0.7);
    },
    hat: function (S, t, a) {
      var n = noiseSrc(S, t, 0.3), f = S.c.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 7500;
      var g = envGain(S, t, a[0], 0.001, a[1] / 3, 0.1);
      n.connect(f); f.connect(g);
    },
    snare: function (S, t, a) {
      var n = noiseSrc(S, t, 0.5), f = S.c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      var g = envGain(S, t, a[0], 0.001, 0.06, 0.4);
      n.connect(f); f.connect(g);
    },
    tick: function (S, t, a) {
      var n = noiseSrc(S, t, 0.1), f = S.c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 2.5;
      var g = envGain(S, t, a[0], 0.001, 0.012, 0.15);
      n.connect(f); f.connect(g);
    },
    whoosh: function (S, t, a) {
      var dur = a[0], n = noiseSrc(S, t, dur + 0.3), f = S.c.createBiquadFilter(), g = S.c.createGain();
      f.type = 'bandpass'; f.Q.value = 1.1;
      f.frequency.setValueAtTime(a[2] > 0 ? 300 : 4200, t); f.frequency.exponentialRampToValueAtTime(a[2] > 0 ? 4200 : 300, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a[1], t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur + 0.2);
      n.connect(f); f.connect(g); out(S, g, 0.5);
    },
    riser: function (S, t, a) {
      var c = S.c, dur = a[0];
      var n = noiseSrc(S, t, dur), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur);
      n.connect(f); f.connect(g); out(S, g, 0.4);
      var o = c.createOscillator(), og = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(m2f(50), t); o.frequency.exponentialRampToValueAtTime(m2f(74), t + dur);
      var of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.setValueAtTime(500, t); of.frequency.exponentialRampToValueAtTime(3500, t + dur);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.03, t + dur - 0.05); og.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(of); of.connect(og); out(S, og, 0.3); o.start(t); o.stop(t + dur + 0.05);
    },
    boom: function (S, t, a) {
      var o = S.c.createOscillator();
      o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
      var g = envGain(S, t, a[0], 0.005, 0.6, 0.3);
      o.connect(g); o.start(t); o.stop(t + 3.5);
    },
    crash: function (S, t, a) {
      var dur = a[1] || 2.5, n = noiseSrc(S, t, dur + 1), f = S.c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(9000, t); f.frequency.setTargetAtTime(1600, t, dur / 3);
      var g = envGain(S, t, a[0], 0.004, dur / 4, 0.6);
      n.connect(f); f.connect(g);
    }
  };
  function buildChain(c) {
    var master = c.createGain(), comp = c.createDynamicsCompressor(), verbRet = c.createGain(), verb = makeVerb(c);
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    master.gain.value = 0.85; verbRet.gain.value = 0.32;
    verb.connect(verbRet); verbRet.connect(master);
    master.connect(comp); comp.connect(c.destination);
    return { master: master, verb: verb, noise: makeNoise(c) };
  }
  function newSession(c, chain) {
    var S = { c: c, bus: c.createGain(), wet: c.createGain(), noise: chain.noise };
    S.bus.connect(chain.master); S.wet.connect(chain.verb);
    return S;
  }
  function endSession(S) {
    if (!S) return;
    var t = S.c.currentTime;
    [S.bus, S.wet].forEach(function (g) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.08); });
    setTimeout(function () { try { S.bus.disconnect(); S.wet.disconnect(); } catch (e) { /* already gone */ } }, 300);
  }
  function fire(S, e, when) { INST[e.k](S, when, e.a, e.d); }

  var AC = window.AudioContext || window.webkitAudioContext;
  /* The picture always runs on the performance clock, and the score is
     scheduled against it. An AudioContext can sit suspended, or report
     "running" while its clock never moves (no output device), and the film
     must play either way; the audio joins at whatever second it has reached.
     Over 94 seconds the two clocks drift by milliseconds, not frames. */
  var au = { c: null, chain: null, S: null, on: false, synced: false, base: 0, idx: 0 };
  function audioStart(t) {
    if (!AC) return false;
    if (!au.c) { au.c = new AC(); au.chain = buildChain(au.c); }
    if (au.c.state !== 'running') au.c.resume();
    endSession(au.S);
    au.S = newSession(au.c, au.chain);
    au.on = true; au.synced = false;
    audioSync(t);
    return true;
  }
  function audioSync(t) {
    if (au.c.state !== 'running') return;
    var now = au.c.currentTime + 0.06;
    au.base = now - t; au.idx = 0; au.synced = true;
    while (au.idx < SCORE.length && SCORE[au.idx].t < t) {
      var e = SCORE[au.idx++];
      if (e.h && e.t + e.d > t + 0.3) fire(au.S, { k: e.k, a: e.a, d: e.t + e.d - t }, now);
    }
  }
  function audioStop() { endSession(au.S); au.S = null; au.on = false; au.synced = false; }
  function audioPump(t) {
    while (au.idx < SCORE.length && SCORE[au.idx].t < t + 0.45) {
      var e = SCORE[au.idx++];
      fire(au.S, e, Math.max(au.c.currentTime, au.base + e.t));
    }
  }
  function renderAudio(rate) {
    rate = rate || 48000;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var c = new OAC(2, Math.ceil(rate * (DUR + 1)), rate), chain = buildChain(c), S = newSession(c, chain);
    SCORE.forEach(function (e) { fire(S, e, e.t); });
    return c.startRendering();
  }
  function wavBase64(buf) {
    var n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1), bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
    var peak = 0;
    for (var i = 0; i < n; i++) {
      var l = clamp(L[i], -1, 1), r = clamp(R[i], -1, 1);
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
      dv.setInt16(44 + i * 4, l * 32767, true); dv.setInt16(46 + i * 4, r * 32767, true);
    }
    var s = '', CH = 0x8000;
    for (i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return { b64: btoa(s), peak: peak };
  }

  /* ----------------------------------------------------------------- clock */

  var started = false, playing = false, filmT = 0, perfBase = 0, raf = 0, soundOn = true, userPaused = false, autoPaused = false;
  function clock() {
    if (!playing) return filmT;
    return (performance.now() - perfBase) / 1000;
  }
  function tick() {
    raf = 0;
    if (!playing) return;
    var t = clock();
    if (t >= DUR) { filmT = DUR; playing = false; audioStop(); render(DUR); ended(); updateUI(); return; }
    filmT = Math.max(0, t);
    if (au.on && !au.synced) audioSync(filmT);
    if (au.on && au.synced) audioPump(filmT);
    render(filmT);
    updateTime(filmT);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (filmT >= DUR - 0.05) filmT = 0;
    playing = true; userPaused = false;
    perfBase = performance.now() - filmT * 1000;
    if (!(soundOn && audioStart(filmT))) au.on = false;
    if (!raf) raf = requestAnimationFrame(tick);
    updateUI();
  }
  function pause(byUser) {
    filmT = clock(); playing = false; audioStop();
    if (byUser) userPaused = true;
    updateUI();
  }
  function seek(t) {
    filmT = clamp(t, 0, DUR);
    if (playing) { perfBase = performance.now() - filmT * 1000; if (au.on) audioStart(filmT); }
    render(filmT); updateTime(filmT);
  }

  /* -------------------------------------------------------------- controls */

  var startBtn = document.getElementById('film-start'), controls = document.getElementById('film-controls');
  var playBtn = document.getElementById('film-play'), soundBtn = document.getElementById('film-sound'), fullBtn = document.getElementById('film-full');
  var track = document.getElementById('film-track'), fill = document.getElementById('film-fill'), timeEl = document.getElementById('film-time');
  var ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="m17 9 5 6m0-6-5 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
  };
  function updateTime(t) {
    if (!fill) return;
    fill.style.transform = 'scaleX(' + (t / DUR).toFixed(4) + ')';
    timeEl.textContent = fmtTime(t) + ' / ' + fmtTime(DUR);
    track.setAttribute('aria-valuenow', Math.round(t));
  }
  function updateUI() {
    if (!playBtn) return;
    playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    soundBtn.innerHTML = soundOn ? ICON.sound : ICON.mute;
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute' : 'Unmute');
    updateTime(filmT);
  }
  function ended() {
    startBtn.hidden = false;
    startBtn.querySelector('.label b').textContent = 'Watch again';
  }
  function fit() {
    var k = frame.clientWidth / W;
    stage.style.transform = 'scale(' + k + ')';
    var want = clamp(k * (window.devicePixelRatio || 1), 0.5, 1.5);
    if (RENDER) want = 1;
    if (Math.abs(want - K) > 0.05 || cv.width === 300) {
      K = want; cv.width = Math.round(W * K); cv.height = Math.round(H * K);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      render(filmT);
    }
  }

  if (RENDER) {
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#000';
    document.querySelector('.about').style.display = 'none';
    var film = document.querySelector('.film'); film.style.cssText = 'display:block;padding:0;min-height:0';
    frame.style.cssText = 'width:1920px;height:1080px;border-radius:0;box-shadow:none';
    startBtn.hidden = true; controls.style.display = 'none';
  }

  if (!RENDER) {
    SCENES.forEach(function (s) {
      if (s.id === 'title' || s.id === 'outro') return;
      var c = el('button', 'chap', '<span>' + s.name + '</span>', track);
      c.type = 'button'; c.style.left = (s.t0 / DUR * 100) + '%'; c.style.border = '0'; c.style.padding = '0'; c.style.cursor = 'pointer';
      c.setAttribute('aria-label', 'Jump to ' + s.name);
      c.addEventListener('click', function (e) { e.stopPropagation(); seek(s.t0 + 0.01); if (!playing) play(); });
    });
    startBtn.addEventListener('click', function () {
      startBtn.hidden = true;
      frame.classList.add('show-controls');
      setTimeout(function () { frame.classList.remove('show-controls'); }, 2500);
      // The poster is a frame from the title; the film itself starts at zero.
      if (!started) { started = true; filmT = 0; }
      play();
    });
    playBtn.addEventListener('click', function () { if (playing) pause(true); else play(); });
    soundBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      if (playing) {
        var t = clock();
        if (soundOn) audioStart(t); else { audioStop(); perfBase = performance.now() - t * 1000; }
      }
      updateUI();
    });
    fullBtn.innerHTML = ICON.full;
    fullBtn.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (frame.requestFullscreen) frame.requestFullscreen();
    });
    track.addEventListener('click', function (e) {
      var r = track.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width * DUR);
    });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { seek(filmT + 5); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { seek(filmT - 5); e.preventDefault(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === ' ' && startBtn.hidden && document.activeElement !== playBtn) { e.preventDefault(); if (playing) pause(true); else play(); }
      if (e.key === 'm' || e.key === 'M') soundBtn.click();
      if (e.key === 'f' || e.key === 'F') fullBtn.click();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.intersectionRatio < 0.4 && playing) { pause(false); autoPaused = true; }
          else if (en.intersectionRatio >= 0.4 && autoPaused && !userPaused) { autoPaused = false; play(); }
        });
      }, { threshold: [0, 0.4, 1] }).observe(frame);
    }
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    updateUI();
  }

  /* The poster is the title card: the mark, assembled. */
  var POSTER = 10.2;
  var ready = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(function (res) { var i = new Image(); i.onload = i.onerror = res; i.src = AVATAR; })
  ]);
  filmT = RENDER ? 0 : POSTER;
  fit();
  render(filmT);
  ready.then(function () { render(filmT); });

  window.cockpitFilm = {
    duration: DUR,
    ready: ready,
    scenes: SCENES.map(function (s) { return { id: s.id, name: s.name, t0: s.t0, t1: s.t1 }; }),
    seek: function (t) { filmT = t; render(t); },
    play: play,
    pause: function () { pause(true); },
    renderAudio: function () { return renderAudio(48000).then(wavBase64); }
  };
})();

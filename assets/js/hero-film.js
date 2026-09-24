/* Hero film — a 57.6-second story told before the hero, then handed to it.
 *
 * One particle system, one clock, one score. Every particle is a day of the
 * contribution calendar first, and the same 2,191 particles become a sphere, a
 * player network, fifteen people clocking in, a job pipeline and finally the
 * portrait, which dissolves into the real one as the hero arrives underneath.
 *
 * RENDER IS A PURE FUNCTION OF TIME. No particle carries velocity from one frame
 * to the next: its position is a blend of two formations, both functions of t,
 * so seeking, pausing, chapter clicks and the audio resync after a tab switch
 * all cost nothing and cannot drift. A spring simulation would look the same
 * for the first play and be unseekable forever after.
 *
 * THE FIGURES ARE THE PAGE'S OWN. Contributions and Claude hours come from the
 * same JSON snapshots the Activity panel draws; WordWarz and MDS Pro figures are
 * read out of their project cards; nothing numeric is written in this file, so
 * the film cannot disagree with the page below it. A figure that fails to load
 * drops its caption line rather than showing a stale or guessed number.
 *
 * THE SCORE IS SYNTHESISED, not a file: Web Audio oscillators and filtered
 * noise, scheduled on a 100 BPM grid the scenes are cut to (a bar is 2.4s, the
 * film is 24 bars). Browsers refuse audible autoplay, so the film starts silent
 * and the sound button joins the score at whatever second the film has reached.
 * With sound on, the AudioContext's clock drives the picture rather than the
 * other way round — audio cannot be nudged without a click, pictures can.
 *
 * It plays once per visitor per fortnight (the head script decides, so the
 * hero never flashes before the film covers it); reduced motion and returning
 * visitors get the hero as it always was, plus a chip to play the story.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var hero = document.querySelector('.hero');
  var cv = document.createElement('canvas');
  var ctx = cv.getContext && cv.getContext('2d');
  if (!hero || !ctx || !window.requestAnimationFrame) {
    root.classList.remove('ev-film-boot');
    return;
  }

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BAR = 2.4, BEAT = 0.6, DUR = 24 * BAR;          /* 57.6s */
  var REVEAL_AT = 55.3;                                /* hero content starts arriving */
  var SEEN_KEY = 'heroFilmSeen';

  var CHAPTERS = [
    { t: 0, n: 'hello, world' },
    { t: 2 * BAR, n: 'Practice' },
    { t: 6 * BAR, n: 'AI' },
    { t: 10 * BAR, n: 'WordWarz.io' },
    { t: 14 * BAR, n: 'MDS Pro' },
    { t: 18 * BAR, n: 'Pipelines' },
    { t: 21 * BAR, n: 'Kim' }
  ];

  /* ---------------------------------------------------------------- helpers */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function frac(x) { return x - Math.floor(x); }
  function hash(n) { return frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ------------------------------------------------------------- the days */

  var DAY0 = Date.UTC(2021, 0, 1), YEARS = 6;
  var N = Math.round((Date.UTC(2027, 0, 1) - DAY0) / 864e5);   /* one particle per day, 2021–2026 */
  var calCol = new Int16Array(N), calRow = new Int8Array(N), calYb = new Int8Array(N);
  var lvl = new Int8Array(N), future = new Uint8Array(N), cum = new Int32Array(N);
  var iso = new Array(N);
  (function () {
    for (var i = 0; i < N; i++) {
      var ms = DAY0 + i * 864e5, d = new Date(ms), y = d.getUTCFullYear(), jan1 = Date.UTC(y, 0, 1);
      calYb[i] = y - 2021;
      calRow[i] = d.getUTCDay();
      calCol[i] = Math.floor(((ms - jan1) / 864e5 + new Date(jan1).getUTCDay()) / 7);
      iso[i] = d.toISOString().slice(0, 10);
    }
  })();
  var I_DEC = iso.indexOf('2022-12-11');   /* the first ChatGPT conversation */

  var H1 = new Float32Array(N), H2 = new Float32Array(N), H3 = new Float32Array(N), H4 = new Float32Array(N);
  var SX = new Float32Array(N), SY = new Float32Array(N), SZ = new Float32Array(N);
  for (var i0 = 0; i0 < N; i0++) {
    H1[i0] = hash(i0 + 1); H2[i0] = hash(i0 * 3.1 + 7); H3[i0] = hash(i0 * 7.7 + 13); H4[i0] = hash(i0 * 1.3 + 29);
    var sy = 1 - 2 * (i0 + 0.5) / N, sr = Math.sqrt(1 - sy * sy), ph = i0 * 2.399963;
    SX[i0] = Math.cos(ph) * sr; SY[i0] = sy; SZ[i0] = Math.sin(ph) * sr;
  }

  /* ------------------------------------------------------------- the data */

  var data = { contrib: null, contribSince: '', contribAsOf: '', claude: null, ww: null, mds: null };

  function cardMetrics(name) {
    var card = document.querySelector('.work-item[data-name="' + name + '"]');
    if (!card) return null;
    return {
      nums: [].map.call(card.querySelectorAll('.project-metric-num'), function (n) { return n.textContent.trim(); }),
      text: card.textContent
    };
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthOf(isoStr) { var d = new Date(isoStr); return isNaN(d) ? '' : MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

  (function () {
    var w = cardMetrics('WordWarz.io');
    if (w && w.nums.length >= 4) {
      data.ww = { players: parseInt(w.nums[0].replace(/,/g, ''), 10), games: parseInt(w.nums[1].replace(/,/g, ''), 10), daily: w.nums[3] };
    }
    var m = cardMetrics('MDS Pro Solutions');
    if (m && m.nums.length) {
      var rls = m.text.match(/(\d+)\s+RLS policies across\s+(\d+)\s+migrations/);
      data.mds = { users: parseInt(m.nums[0], 10), rls: rls ? rls[1] : null, migrations: rls ? rls[2] : null };
    }
  })();

  function getJSON(url) {
    if (!window.fetch) return Promise.reject();
    return fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw r.status; return r.json(); });
  }
  getJSON('assets/contributions.json').then(function (j) {
    if (!j || !j.days) return;
    var cut = j.generatedAt ? j.generatedAt.slice(0, 10) : '9999';
    var run = 0, first = null;
    for (var i = 0; i < N; i++) {
      if (iso[i] > cut) { future[i] = 1; cum[i] = run; continue; }
      var c = j.days[iso[i]] || 0;
      if (c && !first) first = iso[i];
      run += c; cum[i] = run;
      lvl[i] = !c ? 0 : c < 3 ? 1 : c < 7 ? 2 : c < 15 ? 3 : 4;
    }
    data.contrib = run;
    data.contribSince = first ? monthOf(first) : '';
    data.contribAsOf = monthOf(j.generatedAt);
  }).catch(function () {});
  getJSON('assets/claude-usage.json').then(function (j) {
    if (j && j.hours && j.prompts) {
      data.claude = { hours: j.hours.total, prompts: j.prompts.total, projects: j.prompts.projects, asOf: monthOf(j.generatedAt) };
    }
  }).catch(function () {});

  /* ------------------------------------------------------------ the theme */

  var col = {}, LUT = [], dark = true, sprite = null;
  function rgbOf(v, fb) {
    v = (v || '').trim();
    if (v.charAt(0) === '#') {
      if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    }
    var m = v.match(/[\d.]+/g);
    return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : fb;
  }
  function css(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }
  function readTheme() {
    var cs = getComputedStyle(root);
    col.accent = rgbOf(cs.getPropertyValue('--accent'), [200, 255, 0]);
    col.g2 = rgbOf(cs.getPropertyValue('--gradient-2'), [0, 255, 200]);
    col.text = rgbOf(cs.getPropertyValue('--text'), [240, 240, 242]);
    col.muted = rgbOf(cs.getPropertyValue('--text-muted'), [138, 138, 149]);
    col.dim = rgbOf(cs.getPropertyValue('--text-dim'), [85, 85, 95]);
    col.bg = rgbOf(cs.getPropertyValue('--bg'), [10, 10, 11]);
    col.card = rgbOf(cs.getPropertyValue('--bg-card'), [17, 17, 19]);
    col.border = rgbOf(cs.getPropertyValue('--border'), [34, 34, 37]);
    dark = root.getAttribute('data-theme') !== 'light';
    LUT = [];
    for (var k = 0; k < 16; k++) {
      var f = k / 15;
      LUT.push(css([
        Math.round(col.accent[0] + (col.g2[0] - col.accent[0]) * f),
        Math.round(col.accent[1] + (col.g2[1] - col.accent[1]) * f),
        Math.round(col.accent[2] + (col.g2[2] - col.accent[2]) * f)]));
    }
    LUT.border = css(col.border);
    LUT.dim = css(col.dim);
    /* one soft halo, tinted halfway between the two gradient stops */
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    var sc = sprite.getContext('2d'), g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    var mid = [(col.accent[0] + col.g2[0]) >> 1, (col.accent[1] + col.g2[1]) >> 1, (col.accent[2] + col.g2[2]) >> 1];
    g.addColorStop(0, css(mid, 0.9)); g.addColorStop(0.25, css(mid, 0.28)); g.addColorStop(1, css(mid, 0));
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
  }

  /* ----------------------------------------------------------- the layout */

  var W = 0, H = 0, dpr = 1, wide = true;
  var st = {}, cal = {}, board = {}, pr = {}, open = { cx: 0, cy: 0 };
  var OPEN_TEXT = 'hello, world';
  var fontMono = "'JetBrains Mono', monospace", fontSans = "'DM Sans', sans-serif";

  function layout() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W * H * dpr * dpr > 4.2e6) dpr = Math.max(1, Math.sqrt(4.2e6 / (W * H)));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    wide = W >= 900;
    var vh = Math.min(H, window.innerHeight || H);
    if (wide) {
      st.x = W * 0.44; st.y = 96; st.w = W * 0.51; st.h = vh - 96 - 120;
    } else {
      st.x = 16; st.y = 84; st.w = W - 32; st.h = Math.max(220, vh * 0.5 - 84);
    }
    st.cx = st.x + st.w / 2; st.cy = st.y + st.h / 2;
    st.m = Math.min(st.w, st.h);

    var labelW = wide ? 44 : 30;
    cal.p = Math.min((st.w - labelW) / 53, st.h / (YEARS * 7 + (YEARS - 1) * 1.6));
    cal.gap = cal.p * 1.6;
    var cw = labelW + 53 * cal.p, ch = YEARS * 7 * cal.p + (YEARS - 1) * cal.gap;
    cal.x0 = st.x + (st.w - cw) / 2 + labelW + cal.p / 2;
    cal.y0 = st.cy - ch / 2 + cal.p / 2;

    board.t = Math.min(st.w / 6.4, st.h / 7.4, 64);
    board.g = board.t * 0.12;
    board.x0 = st.cx - (5 * board.t + 4 * board.g) / 2;
    board.y0 = st.cy - (6 * board.t + 5 * board.g) / 2;

    open.size = clamp(W * 0.034, 22, 46);
    open.y = (wide ? H / 2 : Math.min(H, vh) * 0.42);
    /* where the caret stops: the burst point, known before the first frame so a
       seek straight into chapter one still has somewhere to burst from */
    ctx.font = '400 ' + open.size + 'px ' + fontMono;
    var fw = ctx.measureText(OPEN_TEXT).width, pw = ctx.measureText('> ').width;
    open.x0 = W / 2 - (fw + pw) / 2 + pw;
    open.cx = open.x0 + fw + 4 + open.size * 0.3; open.cy = open.y;

    var av = hero.querySelector('.hero-avatar'), img = av && av.querySelector('img');
    if (wide && img && getComputedStyle(av).display !== 'none') {
      var hr = hero.getBoundingClientRect(), r = img.getBoundingClientRect();
      pr.x = r.left - hr.left; pr.y = r.top - hr.top; pr.w = r.width; pr.h = r.height;
    } else {
      pr.w = pr.h = Math.min(W * 0.72, st.h * 1.02, 380);
      pr.x = W / 2 - pr.w / 2; pr.y = st.cy - pr.h / 2;
    }
  }

  /* ----------------------------------------------------- the portrait's points */

  /* A halftone, not a stipple. The photograph is a cut-out whose suit and hair
     are near-black, so points sampled by brightness drew a face on a vase with
     no shoulders. Instead every cell of the silhouette gets one particle and the
     tone sets its size — the same squares the calendar was drawn in — and the
     grid is the finest one the 2,191 particles can fill. */
  var TU = new Float32Array(N), TV = new Float32Array(N), TL = new Float32Array(N), portraitOK = false, PG = 1, PCOUNT = 0;
  function samplePortrait(img) {
    try {
      var oc = document.createElement('canvas'), ox = oc.getContext('2d', { willReadFrequently: true });
      var iw = img.naturalWidth, ih = img.naturalHeight, s = Math.min(iw, ih);
      function grid(G) {
        oc.width = oc.height = G;
        ox.clearRect(0, 0, G, G);
        ox.drawImage(img, (iw - s) / 2, 0, s, s, 0, 0, G, G);     /* cover, top — as the hero crops it */
        var px = ox.getImageData(0, 0, G, G).data, cells = [];
        for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
          var o = (y * G + x) * 4;
          if (px[o + 3] < 120) continue;
          cells.push(x, y, (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255);
        }
        return cells;
      }
      var lo = 20, hi = 160, best = null, bestG = 0;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1, c = grid(mid);
        if (c.length / 3 <= N) { best = c; bestG = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (!best || best.length / 3 < 300) return;
      PG = bestG; PCOUNT = best.length / 3;
      /* stretch the silhouette's own tonal range, or a face lit this evenly
         comes out as one flat block of full-size squares */
      var lums = [];
      for (var q = 2; q < best.length; q += 3) lums.push(best[q]);
      lums.sort(function (x, y) { return x - y; });
      var lo5 = lums[Math.floor(lums.length * 0.05)], hi95 = lums[Math.floor(lums.length * 0.95)] || 1;
      for (q = 2; q < best.length; q += 3) best[q] = Math.pow(clamp((best[q] - lo5) / Math.max(0.05, hi95 - lo5), 0, 1), 1.3);
      for (var i = 0; i < N; i++) {
        if (i < PCOUNT) {
          TU[i] = (best[i * 3] + 0.5) / PG; TV[i] = (best[i * 3 + 1] + 0.5) / PG; TL[i] = best[i * 3 + 2];
        } else {
          /* the particles the grid had no cell for settle as a halo and go out */
          var a = i * 2.399963, r = 0.52 + 0.2 * H1[i];
          TU[i] = 0.5 + Math.cos(a) * r; TV[i] = 0.5 + Math.sin(a) * r; TL[i] = -1;
        }
      }
      portraitOK = true;
    } catch (e) { /* tainted or undecodable: the finale falls back to a ring */ }
  }
  (function () {
    var src = hero.querySelector('.hero-avatar img');
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () { samplePortrait(img); };
    img.src = (src && src.getAttribute('src')) || 'assets/profile.webp';
  })();

  /* ------------------------------------------------------------ formations
     Each writes {x, y, s, a, c} for particle i at time t. c is a position on
     the accent → gradient-2 ramp, or -1 (border ink) / -2 (dim ink). */

  var fr = {};   /* per-frame constants, filled by prep() */

  function fOpen(i, t, o) { o.x = open.cx; o.y = open.cy; o.s = 1.5; o.a = 0; o.c = 0; }

  function calArrive(i) { return 4.5 + 0.25 + (i / N) * 6.6 + 0.9; }
  function fCal(i, t, o) {
    o.x = cal.x0 + calCol[i] * cal.p;
    o.y = cal.y0 + calYb[i] * (7 * cal.p + cal.gap) + calRow[i] * cal.p;
    o.s = cal.p * 0.76;
    if (future[i]) { o.a = 0; o.c = 0; return; }
    var L = lvl[i];
    if (!L) { o.c = -1; o.a = 1; } else { o.c = L >= 4 ? 0.5 : 0; o.a = 0.25 + L * 0.19; }
    var f = 1 - (t - calArrive(i)) / 0.7;
    if (L && f > 0 && f < 1) { o.a += f * 0.7; o.s *= 1 + f * 0.7; }
    if (fr.calDim > 0 && i !== I_DEC) o.a *= 1 - fr.calDim * 0.6;
  }

  function fSphere(i, t, o) {
    var x = SX[i] * fr.ca + SZ[i] * fr.sa, z = -SX[i] * fr.sa + SZ[i] * fr.ca, y = SY[i];
    var y2 = y * fr.ct - z * fr.stl, z2 = y * fr.stl + z * fr.ct;
    var p = 3.2 / (3.2 - z2), d = (z2 + 1) / 2;
    o.x = st.cx + x * fr.R * p; o.y = st.cy + y2 * fr.R * p;
    o.s = (0.9 + 1.7 * d) * p * (wide ? 1 : 0.8);
    o.a = 0.14 + 0.78 * d; o.c = (y2 + 1) / 2;
  }

  function fDust(i, t, o) {
    o.x = W * H1[i] + Math.sin(t * 0.3 + i) * 10;
    o.y = H * H2[i] + Math.cos(t * 0.25 + i * 0.7) * 10;
    o.s = 1 + H3[i] * 1.3; o.a = 0.08 + 0.14 * H3[i]; o.c = H4[i];
  }

  function fNet(i, t, o) {
    if (i >= fr.players) { fDust(i, t, o); o.a *= 0.45; return; }
    var rr = 0.26 + 0.74 * Math.sqrt(H1[i]), ang = i * 2.399963 + t * 0.07 * (1.2 - rr);
    o.x = st.cx + Math.cos(ang) * fr.Rx * rr; o.y = st.cy + Math.sin(ang) * fr.Ry * rr;
    o.s = 1.8 + H2[i] * 1.4; o.a = (0.5 + 0.45 * H3[i]) * (0.78 + 0.22 * Math.sin(t * 3 + i)); o.c = H4[i] * 0.9;
  }

  function nodePos(k, out) {
    var a = -Math.PI / 2 + k * 2 * Math.PI / fr.K;
    out.x = st.cx + Math.cos(a) * st.w * (wide ? 0.42 : 0.43);
    out.y = st.cy + Math.sin(a) * st.h * 0.41;
  }
  var NP = {};
  function fClusters(i, t, o) {
    var k = i % fr.K;
    nodePos(k, NP);
    var rn = st.m * (wide ? 0.05 : 0.055) * (1 + 0.1 * Math.sin(t * 2.4 + k));
    var ang = H1[i] * 6.2832 + t * 0.4 * (H2[i] - 0.5), rad = rn * Math.sqrt(H2[i]);
    o.x = NP.x + Math.cos(ang) * rad; o.y = NP.y + Math.sin(ang) * rad;
    o.s = 1.3 + H3[i] * 1.1; o.a = 0.32 + 0.4 * H3[i] + fr.flash[k] * 0.5; o.c = k / (fr.K - 1);
  }

  var GATES = [0.25, 0.55];
  function fStream(i, t, o) {
    var ph = frac(H1[i] + (t - 43.2) * 0.14);
    var band = 0.62 - 0.5 * smooth(ph / 0.9);
    o.x = st.x + ph * st.w;
    o.y = st.cy + (H2[i] - 0.5) * st.h * band + Math.sin(ph * 14 + i) * 2;
    o.a = 0.5; o.s = 1.5; o.c = 0.1;
    var d;
    if (ph > GATES[0] && H3[i] >= 0.3) {
      d = ph - GATES[0]; o.y += d * d * st.h * 5; o.a *= Math.max(0, 1 - d * 5); o.c = -2;
    } else if (ph > GATES[1] && H3[i] >= 0.07) {
      d = ph - GATES[1]; o.y += d * d * st.h * 5; o.a *= Math.max(0, 1 - d * 5); o.c = -2;
    } else if (ph > GATES[1]) {
      var k = clamp((ph - GATES[1]) * 3.2, 0, 1);
      o.y = st.cy + (o.y - st.cy) * (1 - k); o.a = 0.95; o.s = 2.6; o.c = 0.9;
    }
    o.a *= smooth(ph / 0.04) * (1 - smooth((ph - 0.86) / 0.05));
  }

  function fPortrait(i, t, o) {
    if (portraitOK) {
      o.x = pr.x + TU[i] * pr.w; o.y = pr.y + TV[i] * pr.h;
      if (TL[i] < 0) { o.s = 1.2; o.a = 0.3 * (1 - smooth((t - 51.6) / 1.2)); o.c = H2[i]; }
      else {
        /* light-on-dark in the dark theme, ink-on-paper in the light one, so the
           face is never shown as its own negative */
        var tone = dark ? TL[i] : 1 - TL[i];
        var shim = 1 + 0.12 * Math.sin(t * 2.2 - TV[i] * 9 + TU[i] * 4);
        o.s = (pr.w / PG) * (0.22 + 0.7 * Math.pow(tone, 0.9)) * shim;
        o.a = 0.3 + 0.7 * tone; o.c = TV[i] * 0.9;
      }
    } else {
      var a = i * 2.399963, r = pr.w * (0.36 + 0.12 * H1[i]);
      o.x = pr.x + pr.w / 2 + Math.cos(a) * r; o.y = pr.y + pr.h / 2 + Math.sin(a) * r;
      o.s = 1.6; o.a = 0.6; o.c = H2[i];
    }
    o.a *= 1 - smooth((t - 55.4) / 1.9);
  }

  var FORMS = [
    { t: 0, f: fOpen },
    { t: 4.5, f: fCal, dur: 0.9, sw: 0.5, d: function (i) { return 0.25 + (i / N) * 6.6; } },
    { t: 17.0, f: fSphere, dur: 1.7, sw: 0.9, d: function (i) { return (i / N) * 1.5; } },
    { t: 24.0, f: fDust, dur: 1.3, sw: 0.4, d: function (i) { return H1[i] * 0.5; } },
    { t: 28.9, f: fNet, dur: 1.4, sw: 0.6, d: function (i) { return H2[i] * 0.7; } },
    { t: 33.6, f: fClusters, dur: 1.5, sw: 0.7, d: function (i) { return H3[i] * 0.8; } },
    { t: 43.2, f: fStream, dur: 1.3, sw: 0.5, d: function (i) { return H4[i] * 0.9; } },
    { t: 50.4, f: fPortrait, dur: 1.9, sw: 1.1, d: function (i) { return TV[i] * 0.6 + H1[i] * 0.5; } }
  ];

  var A = {}, B = {}, P = {};
  function place(i, t, k, o) {
    var F = FORMS[k];
    if (!k) { F.f(i, t, o); return; }
    var local = t - F.t - F.d(i);
    if (local <= 0) { FORMS[k - 1].f(i, t, o); return; }
    if (local >= F.dur) { F.f(i, t, o); return; }
    FORMS[k - 1].f(i, t, A); F.f(i, t, B);
    var e = ease(local / F.dur), dx = B.x - A.x, dy = B.y - A.y;
    var sw = Math.sin(Math.PI * e) * F.sw * (H4[i] - 0.5) * 0.8;
    o.x = A.x + dx * e - dy * sw; o.y = A.y + dy * e + dx * sw;
    o.s = A.s + (B.s - A.s) * e; o.a = A.a + (B.a - A.a) * e;
    o.c = (A.c < 0 || B.c < 0) ? (e < 0.5 ? A.c : B.c) : A.c + (B.c - A.c) * e;
  }

  function formAt(t) { var k = 0; while (k + 1 < FORMS.length && t >= FORMS[k + 1].t) k++; return k; }

  /* ledger arrivals, shared by picture and score so the ping IS the row */
  var LEDGER = [];
  for (var e0 = 0; e0 < 28; e0++) LEDGER.push({ t: 34.6 + e0 * 0.3, node: (e0 * 7) % 15 });
  var ALERTS = [44.4, 45.6, 46.8, 48.0, 49.2];

  /* the bot's game: feedback is computed, never typed in, so it is always legal */
  var TARGET = 'SHIPS', GUESSES = ['CRANE', 'SLOTH', 'SHIPS'], ROW_T = [24.9, 26.1, 27.3];
  var MARKS = GUESSES.map(function (g) {
    var res = [0, 0, 0, 0, 0], pool = {}, j;
    for (j = 0; j < 5; j++) { if (g[j] === TARGET[j]) res[j] = 2; else pool[TARGET[j]] = (pool[TARGET[j]] || 0) + 1; }
    for (j = 0; j < 5; j++) if (res[j] !== 2 && pool[g[j]]) { res[j] = 1; pool[g[j]]--; }
    return res;
  });
  function typeT(r, j) { return ROW_T[r] + j * 0.075; }
  function flipT(r, j) { return ROW_T[r] + 0.6 + j * 0.15; }

  function prep(t) {
    fr.calDim = smooth((t - 14.4) / 0.8);
    var ang = t * 0.42, tl = 0.38 + 0.08 * Math.sin(t * 0.5);
    fr.ca = Math.cos(ang); fr.sa = Math.sin(ang); fr.ct = Math.cos(tl); fr.stl = Math.sin(tl);
    fr.R = st.m * 0.4 * (1 + 0.035 * Math.exp(-((t % BEAT) / BEAT) * 6));
    fr.players = data.ww ? Math.min(data.ww.players, N) : Math.round(N * 0.26);
    var R = st.m * 0.46;
    fr.Ry = R; fr.Rx = Math.min(st.w * 0.47, R * (st.w > st.h ? 1.3 : 1));
    fr.K = data.mds && data.mds.users > 1 ? Math.min(data.mds.users, 24) : 15;
    fr.flash = fr.flash || new Float32Array(24);
    for (var k = 0; k < 24; k++) fr.flash[k] = 0;
    for (var e = 0; e < LEDGER.length; e++) {
      var dt = t - (LEDGER[e].t - 0.45);
      if (dt > 0 && dt < 0.5) { var n = LEDGER[e].node % fr.K; fr.flash[n] = Math.max(fr.flash[n], 1 - dt / 0.5); }
    }
  }

  /* ---------------------------------------------------------------- drawing */

  var PX = new Float32Array(N), PY = new Float32Array(N), PS = new Float32Array(N), PA = new Float32Array(N), PC = new Float32Array(N);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function env(t, a, b, fin, fout) { return smooth((t - a) / (fin || 0.5)) * (1 - smooth((t - (b - (fout || 0.5))) / (fout || 0.5))); }

  function render(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var bgA = 1 - smooth((t - 55.0) / 1.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = css(col.bg, bgA);
    ctx.fillRect(0, 0, W, H);
    /* a slow bloom that follows the action, so the dark is never flat */
    var gx = wide ? st.cx : W / 2, gy = st.cy;
    var gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.6);
    gl.addColorStop(0, css(col.accent, (dark ? 0.06 : 0.05) * bgA * (0.8 + 0.2 * Math.sin(t * 0.8))));
    gl.addColorStop(1, css(col.accent, 0));
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

    prep(t);
    var k = formAt(t);
    for (var i = 0; i < N; i++) {
      place(i, t, k, P);
      PX[i] = P.x; PY[i] = P.y; PS[i] = P.s; PA[i] = P.a > 1 ? 1 : P.a; PC[i] = P.c;
    }

    if (t < 5.4) drawOpen(t);
    if (t > 4.6 && t < 17.8) drawCalLabels(t);
    if (t > 24 && t < 30) drawBoard(t);
    if (t > 29.2 && t < 34.2) drawNetwork(t);
    if (t > 33.6 && t < 43.8) drawLedger(t);
    if (t > 43.2 && t < 50.8) drawPipeline(t);
    if (t > 50.4) drawFinale(t);

    /* particles: cores, then halos on the brightest */
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    for (i = 0; i < N; i++) {
      var a = PA[i];
      if (a < 0.02) continue;
      var c = PC[i];
      ctx.fillStyle = c === -1 ? LUT.border : c === -2 ? LUT.dim : LUT[(clamp(c, 0, 1) * 15) | 0];
      ctx.globalAlpha = a;
      var s = PS[i];
      ctx.fillRect(PX[i] - s / 2, PY[i] - s / 2, s, s);
    }
    if (k >= 2 || (t > 4.6 && t < 12.5)) {
      for (i = 0; i < N; i += 2) {
        if (PA[i] < 0.45 || PC[i] < 0) continue;
        var hs = PS[i] * 7;
        ctx.globalAlpha = PA[i] * (dark ? 0.22 : 0.12);
        ctx.drawImage(sprite, PX[i] - hs / 2, PY[i] - hs / 2, hs, hs);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    if (t > 17.6 && t < 24.4) drawSynapses(t);
    if (t > 14.2 && t < 17.8) drawDecHighlight(t);
  }

  function drawOpen(t) {
    var text = OPEN_TEXT, n = t < 0.5 ? 0 : Math.min(text.length, Math.floor((t - 0.5) / 0.15) + 1);
    var a = 1 - smooth((t - 4.4) / 0.7);
    ctx.font = '400 ' + open.size + 'px ' + fontMono;
    ctx.textBaseline = 'middle';
    var pw = ctx.measureText('> ').width, x0 = open.x0, y = open.y;
    ctx.globalAlpha = a;
    ctx.fillStyle = css(col.accent);
    ctx.fillText('>', x0 - pw, y);
    ctx.fillStyle = css(col.text);
    ctx.fillText(text.slice(0, n), x0, y);
    var cx = x0 + ctx.measureText(text.slice(0, n)).width + 4;
    var blink = (t > 0.5 && t < 2.4) || (t % BEAT) < BEAT / 2;
    if (blink) { ctx.fillStyle = css(col.accent); ctx.fillRect(cx, y - open.size * 0.55, open.size * 0.55, open.size * 1.1); }
    var da = env(t, 3.0, 5.2, 0.4, 0.7);
    if (da > 0) {
      ctx.globalAlpha = da;
      ctx.font = '400 ' + Math.round(open.size * 0.36) + 'px ' + fontMono;
      ctx.textAlign = 'center';
      ctx.fillStyle = css(col.muted);
      ctx.fillText('2021-02-04  ·  first contribution on GitHub', W / 2, y + open.size * 1.5);
      ctx.textAlign = 'left';
    }
    /* the shockwave the history bursts out of */
    if (t > 4.5) {
      var p = (t - 4.5) / 0.9;
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = css(col.accent); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(open.cx, open.cy, 6 + p * Math.max(W, H) * 0.4, 0, 6.2832); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCalLabels(t) {
    var a = env(t, 4.8, 17.6, 0.8, 0.6);
    ctx.globalAlpha = a;
    ctx.font = '400 ' + Math.max(9, Math.round(cal.p * 0.95)) + 'px ' + fontMono;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = css(col.dim);
    for (var y = 0; y < YEARS; y++) {
      ctx.fillText(String(2021 + y), cal.x0 - cal.p * 1.4, cal.y0 + y * (7 * cal.p + cal.gap) + 3 * cal.p);
    }
    ctx.textAlign = 'left';
    /* the reading head sweeping through history */
    var head = Math.floor(((t - 5.65) / 6.6) * N);
    if (head >= 0 && head < N && !future[head]) {
      var hx = cal.x0 + calCol[head] * cal.p, hy = cal.y0 + calYb[head] * (7 * cal.p + cal.gap) + calRow[head] * cal.p;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = css(col.accent); ctx.lineWidth = 1;
      ctx.strokeRect(hx - cal.p * 1.2, hy - cal.p * 1.2, cal.p * 2.4, cal.p * 2.4);
    }
    ctx.globalAlpha = 1;
  }

  function drawDecHighlight(t) {
    if (I_DEC < 0) return;
    var a = env(t, 14.4, 17.6, 0.4, 0.5);
    var i = I_DEC, x = PX[i], y = PY[i];
    var p = ((t - 14.4) % 1.2) / 1.2;
    ctx.globalAlpha = a * (1 - p);
    ctx.strokeStyle = css(col.g2); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, cal.p * (1 + p * 5), 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.fillStyle = css(col.g2);
    ctx.fillRect(x - cal.p * 0.6, y - cal.p * 0.6, cal.p * 1.2, cal.p * 1.2);
    ctx.font = '500 ' + (wide ? 12 : 10) + 'px ' + fontMono;
    ctx.textBaseline = 'bottom';
    var label = '11 Dec 2022 — first ChatGPT conversation';
    var lw = ctx.measureText(label).width;
    var lx = clamp(x - lw / 2, 8, W - lw - 8);
    ctx.fillText(label, lx, y - cal.p * 2.2);
    ctx.globalAlpha = 1;
  }

  function drawSynapses(t) {
    var a = env(t, 17.8, 24.3, 0.9, 0.5);
    if (a <= 0) return;
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(col.accent);
    for (var s = 0; s < 160; s++) {
      var i = (s * 13) % (N - 34), j = i + 34;
      var d = Math.min(PA[i], PA[j]);
      if (d < 0.5) continue;
      ctx.globalAlpha = a * (d - 0.45) * 0.35;
      ctx.beginPath(); ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[j], PY[j]); ctx.stroke();
      /* a prompt travelling the edge */
      var ph = frac(t * 0.9 + hash(s));
      if (hash(s + 50) < 0.3) {
        ctx.globalAlpha = a * d;
        ctx.fillStyle = css(col.g2);
        ctx.fillRect(PX[i] + (PX[j] - PX[i]) * ph - 1.2, PY[i] + (PY[j] - PY[i]) * ph - 1.2, 2.4, 2.4);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBoard(t) {
    var T = board.t, g = board.g, a = 1 - smooth((t - 29.2) / 0.6);
    var fs = Math.round(T * 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 ' + fs + 'px ' + fontSans;
    for (var r = 0; r < 6; r++) for (var j = 0; j < 5; j++) {
      var pop = ease((t - 24.1 - (r * 5 + j) * 0.018) / 0.35);
      if (pop <= 0) continue;
      var x = board.x0 + j * (T + g), y = board.y0 + r * (T + g);
      var hop = 0;
      if (r === 2 && t > 28.8) hop = Math.max(0, Math.sin(clamp((t - 28.8 - j * 0.08) / 0.35, 0, 1) * Math.PI)) * T * 0.14;
      var sc = pop * (1 - smooth((t - 29.2) / 0.6) * 0.3), sy = 1, mark = -1, letter = '';
      if (r < 3) {
        if (t >= typeT(r, j)) letter = GUESSES[r][j];
        var ft = (t - flipT(r, j)) / 0.3;
        if (ft > 0) { sy = Math.abs(Math.cos(Math.PI * clamp(ft, 0, 1))); if (ft >= 0.5) mark = MARKS[r][j]; }
      }
      var w = T * sc, h = T * sc * sy, cx = x + T / 2, cy = y + T / 2 - hop;
      ctx.globalAlpha = a;
      rr(cx - w / 2, cy - h / 2, w, h, Math.min(6, h / 2));
      if (mark === 2) { ctx.fillStyle = css(col.accent); ctx.fill(); }
      else if (mark === 1) { ctx.fillStyle = css(col.g2, 0.85); ctx.fill(); }
      else if (mark === 0) { ctx.fillStyle = css(col.dim, 0.55); ctx.fill(); }
      else {
        ctx.fillStyle = css(col.card, 0.9); ctx.fill();
        ctx.strokeStyle = css(letter ? col.muted : col.border); ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (letter && h > 4) {
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(1, sy || 0.001);
        ctx.fillStyle = css(mark >= 1 ? col.bg : col.text);
        ctx.fillText(letter, 0, 1);
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  function drawNetwork(t) {
    var a = env(t, 29.3, 34.1, 0.6, 0.6);
    var np = fr.players;
    ctx.lineWidth = 1;
    for (var s = 0; s < 44; s++) {
      var cyc = t * 1.7 + s * 0.137, ep = Math.floor(cyc), ph = cyc - ep;
      var i = Math.floor(hash(s * 97 + ep * 13) * np);
      var la = a * Math.sin(Math.PI * ph);
      ctx.globalAlpha = la * 0.3;
      ctx.strokeStyle = css(col.accent);
      ctx.beginPath(); ctx.moveTo(PX[i], PY[i]); ctx.lineTo(st.cx, st.cy); ctx.stroke();
      var dir = s % 2 ? ph : 1 - ph;
      ctx.globalAlpha = la;
      ctx.fillStyle = css(col.g2);
      ctx.fillRect(PX[i] + (st.cx - PX[i]) * dir - 1.5, PY[i] + (st.cy - PY[i]) * dir - 1.5, 3, 3);
    }
    var pulse = Math.exp(-((t % BEAT) / BEAT) * 5);
    ctx.globalAlpha = a;
    ctx.fillStyle = css(col.accent);
    ctx.beginPath(); ctx.arc(st.cx, st.cy, 6 + pulse * 2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * pulse * 0.6;
    ctx.strokeStyle = css(col.accent);
    ctx.beginPath(); ctx.arc(st.cx, st.cy, 10 + (1 - pulse) * 26, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = a * 0.8;
    ctx.font = '400 10px ' + fontMono; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = css(col.muted);
    ctx.fillText('websocket', st.cx, st.cy + 16);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }

  var KINDS = ['clock_in', 'clock_in', 'break_start', 'clock_out', 'break_end', 'clock_in'];
  function drawLedger(t) {
    var a = env(t, 33.9, 43.6, 0.6, 0.6);
    var lw = Math.min(st.w * (wide ? 0.46 : 0.6), 330), rh = wide ? 22 : 17, rows = 6;
    var lh = rh * (rows + 1.6), lx = st.cx - lw / 2, ly = st.cy - lh / 2;
    var fs = wide ? 11 : 9;
    /* spokes and packets */
    ctx.lineWidth = 1;
    for (var k = 0; k < fr.K; k++) {
      nodePos(k, NP);
      ctx.globalAlpha = a * 0.25; ctx.strokeStyle = css(col.border);
      ctx.beginPath(); ctx.moveTo(NP.x, NP.y); ctx.lineTo(st.cx, st.cy); ctx.stroke();
    }
    var shown = 0;
    for (var e = 0; e < LEDGER.length; e++) {
      var L = LEDGER[e], dep = L.t - 0.45;
      if (t >= L.t) shown = e + 1;
      if (t < dep || t > L.t) continue;
      nodePos(L.node % fr.K, NP);
      var p = ease((t - dep) / 0.45);
      ctx.globalAlpha = a;
      ctx.fillStyle = css(col.g2);
      ctx.beginPath(); ctx.arc(NP.x + (st.cx - NP.x) * p, NP.y + (st.cy - NP.y) * p, 2.6, 0, 6.2832); ctx.fill();
    }
    /* the panel: append-only, newest at the bottom */
    ctx.globalAlpha = a;
    rr(lx, ly, lw, lh, 10);
    ctx.fillStyle = css(col.card, 0.94); ctx.fill();
    ctx.strokeStyle = css(col.border); ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '500 ' + fs + 'px ' + fontMono; ctx.textBaseline = 'middle';
    ctx.fillStyle = css(col.accent);
    ctx.fillText('punches · server-stamped · append-only', lx + 14, ly + rh * 0.8);
    ctx.fillStyle = css(col.border); ctx.fillRect(lx + 1, ly + rh * 1.5, lw - 2, 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(lx, ly + rh * 1.55, lw, rh * rows + 2); ctx.clip();
    var slide = shown ? ease((t - LEDGER[shown - 1].t) / 0.22) : 1;
    for (var r = 0; r < rows + 1; r++) {
      var idx = shown - 1 - r;
      if (idx < 0) break;
      var y = ly + rh * 1.55 + rh * (rows - 0.5 - r) + rh * (1 - slide);
      var fresh = r === 0 ? 1 - smooth((t - LEDGER[idx].t) / 0.6) : 0;
      ctx.globalAlpha = a * (0.55 + 0.45 * fresh + (r === 0 ? 0.2 : 0));
      if (fresh > 0) { ctx.fillStyle = css(col.accent, 0.08 * fresh); ctx.fillRect(lx + 1, y - rh / 2, lw - 2, rh); }
      ctx.fillStyle = css(fresh > 0.2 ? col.text : col.muted);
      ctx.fillText(KINDS[idx % KINDS.length], lx + 14, y);
      ctx.fillStyle = css(col.dim);
      ctx.fillText('now()', lx + lw * 0.52, y);
      ctx.fillStyle = css(col.accent);
      ctx.fillText('rls ✓', lx + lw - 14 - ctx.measureText('rls ✓').width, y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPipeline(t) {
    var a = env(t, 43.4, 50.7, 0.6, 0.5);
    var top = st.y + st.h * 0.12, bot = st.y + st.h * 0.88;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = css(col.border);
    var gs = [GATES[0], GATES[1]];
    for (var g = 0; g < gs.length; g++) {
      var gx = st.x + gs[g] * st.w;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bot); ctx.stroke();
    }
    ctx.setLineDash([]);
    var fs = wide ? 11 : 9;
    ctx.font = '500 ' + fs + 'px ' + fontMono; ctx.textBaseline = 'bottom';
    ctx.fillStyle = css(col.muted);
    var labels = [[0.02, 'boards + inbox'], [GATES[0], 'hard filters'], [GATES[1], 'LLM score'], [0.88, 'alert']];
    for (var l = 0; l < labels.length; l++) {
      var lx = st.x + labels[l][0] * st.w, tw = ctx.measureText(labels[l][1]).width;
      ctx.globalAlpha = a;
      ctx.fillText(labels[l][1], l === 0 ? lx : l === 3 ? Math.min(lx - tw / 2, st.x + st.w - tw) : lx - tw / 2, top - 8);
    }
    var ax = st.x + 0.88 * st.w, ay = st.cy;
    ctx.globalAlpha = a;
    ctx.fillStyle = css(col.g2);
    ctx.beginPath(); ctx.arc(ax, ay, 5, 0, 6.2832); ctx.fill();
    for (var p = 0; p < ALERTS.length; p++) {
      var d = (t - ALERTS[p]) / 0.9;
      if (d < 0 || d > 1) continue;
      ctx.globalAlpha = a * (1 - d);
      ctx.strokeStyle = css(col.g2); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ax, ay, 6 + d * 30, 0, 6.2832); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFinale(t) {
    var a = smooth((t - 50.8) / 1.2) * (1 - smooth((t - 55.4) / 1.8));
    if (a <= 0) return;
    var cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2, r = pr.w * 0.62;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, css(col.accent, (dark ? 0.1 : 0.08) * a));
    g.addColorStop(1, css(col.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  /* --------------------------------------------------------------- captions */

  function contribStat(p) {
    if (data.contrib == null) return '';
    var head = Math.floor(clamp((filmT - 5.65) / 6.6, 0, 1) * (N - 1));
    return '<b>' + fmt(cum[head]) + '</b> contributions' + (data.contribSince ? ' · since ' + data.contribSince : '') +
      (data.contribAsOf ? ' · as of ' + data.contribAsOf : '');
  }
  function claudeStat(p) {
    var c = data.claude;
    if (!c) return '';
    return '<b>' + fmt(c.hours * p) + '</b> hours in Claude Code · <b>' + fmt(c.prompts * p) + '</b> prompts · <b>' +
      fmt(c.projects * p) + '</b> projects' + (c.asOf ? ' · as of ' + c.asOf : '');
  }
  function wwStat(p) {
    var w = data.ww;
    if (!w || isNaN(w.players)) return '';
    return '<b>' + fmt(w.players * p) + '</b> players · <b>' + fmt(w.games * p) + '</b> multiplayer games · <b>' +
      w.daily + '</b> a day';
  }
  function mdsStat(p) {
    var m = data.mds;
    if (!m || isNaN(m.users)) return '';
    return '<b>' + m.users + '</b> daily users' + (m.rls ? ' · <b>' + m.rls + '</b> RLS policies · <b>' + m.migrations + '</b> migrations' : '');
  }

  var CUES = [
    { s: 'kick', t0: 5.0, t1: 14.1, h: '01 — Practice' },
    { s: 'big', t0: 5.3, t1: 9.1, h: 'Five years of *building*.' },
    { s: 'big', t0: 9.3, t1: 14.1, h: 'On and off — then *all at once*.' },
    { s: 'stat', t0: 5.8, t1: 14.1, f: contribStat },

    { s: 'kick', t0: 14.6, t1: 23.8, h: '02 — AI' },
    { s: 'big', t0: 14.8, t1: 18.6, h: 'Eleven days after ChatGPT opened, I was *in it*.' },
    { s: 'big', t0: 18.9, t1: 23.8, h: 'Now AI is how I *build*.' },
    { s: 'stat', t0: 19.4, t1: 23.8, f: claudeStat },

    { s: 'kick', t0: 24.2, t1: 33.4, h: '03 — WordWarz.io' },
    { s: 'big', t0: 24.4, t1: 28.9, h: 'A real-time multiplayer *word game*.' },
    { s: 'sub', t0: 25.0, t1: 28.9, h: 'Its bot guesses by Shannon entropy — maximum information per guess.' },
    { s: 'big', t0: 29.2, t1: 33.4, h: 'Grown by *word of mouth*.' },
    { s: 'sub', t0: 29.7, t1: 33.4, h: 'Live on the App Store. No ads, no marketing spend.' },
    { s: 'stat', t0: 30.0, t1: 33.4, f: wwStat },

    { s: 'kick', t0: 33.8, t1: 43.0, h: '04 — MDS Pro Solutions' },
    { s: 'big', t0: 34.0, t1: 38.5, h: 'A US healthcare company runs its *payroll* on my code.' },
    { s: 'sub', t0: 34.6, t1: 38.5, h: 'Sole developer. In production, used every workday.' },
    { s: 'big', t0: 38.7, t1: 43.0, h: 'The server sets the time. *No row is edited in place.*' },
    { s: 'stat', t0: 39.2, t1: 43.0, f: mdsStat },

    { s: 'kick', t0: 43.4, t1: 50.2, h: '05 — Pipelines' },
    { s: 'big', t0: 43.6, t1: 47.1, h: 'Software that does the *reading* for me.' },
    { s: 'sub', t0: 44.2, t1: 47.1, h: 'Jobsift — hard filters first, an LLM call only where it’s earned.' },
    { s: 'big', t0: 47.3, t1: 50.2, h: 'Database to *deploy*, end to end.' },
    { s: 'stat', t0: 47.7, t1: 50.2, h: 'TypeScript · React · Node · Python · Postgres · Docker · Claude API' },

    { s: 'kick', t0: 51.0, t1: 55.3, h: '06 — Every project, built solo' },
    { s: 'big', t0: 51.2, t1: 55.3, h: 'Kim *Julongbayan*' },
    { s: 'sub', t0: 52.2, t1: 55.3, h: 'I turn ideas into real products.' }
  ];

  var caps = document.createElement('div');
  caps.className = 'ev-film-caps ev-film-layer';
  caps.setAttribute('aria-hidden', 'true');
  var slots = {};
  ['kick', 'big', 'sub', 'stat'].forEach(function (s) {
    var d = document.createElement('div');
    d.className = 'ev-film-slot ev-film-' + s;
    caps.appendChild(d); slots[s] = d;
  });
  CUES.forEach(function (c) {
    var el = document.createElement('div');
    el.className = 'ev-film-cue';
    if (c.h) {
      if (c.s === 'big') {
        /* words rise one after another; *starred* runs set in the accent italic */
        var html = '', inEm = false;
        c.h.split(' ').forEach(function (w) {
          var open = w.charAt(0) === '*', close = w.replace(/[.,]$/, '').slice(-1) === '*';
          if (open) inEm = true;
          var word = w.replace(/\*/g, '');
          html += '<span class="ev-w' + (inEm ? ' ev-em' : '') + '">' + word + '</span> ';
          if (close) inEm = false;
        });
        el.innerHTML = html;
        c.words = [].slice.call(el.querySelectorAll('.ev-w'));
      } else {
        el.textContent = c.h;
      }
    }
    c.el = el; c.on = false; c.last = '';
    el.style.opacity = '0';
    slots[c.s].appendChild(el);
  });

  /* A slot is as tall as its live cue, eased, rather than as tall as its
     tallest cue: a one-line headline no longer leaves a three-line hole above
     the figures under it. */
  var SLOTS = ['kick', 'big', 'sub', 'stat'];
  function measureCaps() {
    CUES.forEach(function (c) { c.hgt = c.el.offsetHeight; });
  }
  function updateCaps(t) {
    var sh = { kick: 0, big: 0, sub: 0, stat: 0 };
    for (var q = 0; q < CUES.length; q++) {
      var cq = CUES[q];
      var wq = smooth((t - cq.t0 + 0.1) / 0.5) * (1 - smooth((t - (cq.t1 - 0.2)) / 0.5));
      if (wq > 0 && cq.hgt * wq > sh[cq.s]) sh[cq.s] = cq.hgt * wq;
    }
    for (q = 0; q < SLOTS.length; q++) slots[SLOTS[q]].style.height = sh[SLOTS[q]].toFixed(1) + 'px';
    for (var i = 0; i < CUES.length; i++) {
      var c = CUES[i], live = t > c.t0 - 0.05 && t < c.t1 + 0.05;
      if (!live) { if (c.on) { c.el.style.opacity = '0'; c.el.style.visibility = 'hidden'; c.on = false; } continue; }
      if (!c.on) { c.el.style.visibility = 'visible'; c.on = true; }
      var inn = smooth((t - c.t0) / 0.6), out = smooth((t - (c.t1 - 0.45)) / 0.45);
      if (c.f) {
        var s = c.f(ease((t - c.t0) / 1.4));
        if (s !== c.last) { c.el.innerHTML = s; c.last = s; }
      }
      if (c.words) {
        for (var w = 0; w < c.words.length; w++) {
          var e = ease((t - c.t0 - w * 0.07) / 0.55);
          c.words[w].style.opacity = e.toFixed(3);
          c.words[w].style.transform = 'translateY(' + ((1 - e) * 0.45).toFixed(3) + 'em)';
        }
        c.el.style.opacity = (1 - out).toFixed(3);
      } else {
        c.el.style.opacity = (inn * (1 - out)).toFixed(3);
      }
      c.el.style.transform = 'translateY(' + (((1 - inn) * 10 - out * 8)).toFixed(2) + 'px)';
    }
  }

  /* --------------------------------------------------------------- controls */

  var ICON = {
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 7 5.5z"/></svg>',
    soundOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    soundOn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    skip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13a1 1 0 0 0 1.55.83L15 13.7V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.3L6.55 4.67A1 1 0 0 0 5 5.5z"/></svg>',
    replay: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>'
  };

  var ui = document.createElement('div');
  ui.className = 'ev-film-ui ev-film-layer';
  ui.setAttribute('role', 'group');
  ui.setAttribute('aria-label', 'Intro film');
  ui.innerHTML =
    '<span class="ev-film-name"></span>' +
    '<div class="ev-film-track"></div>' +
    '<span class="ev-film-time"></span>' +
    '<button type="button" class="ev-film-btn ev-film-pp" aria-label="Pause">' + ICON.pause + '</button>' +
    '<button type="button" class="ev-film-btn ev-film-sound is-hint" aria-pressed="false">' + ICON.soundOff + '<span>Sound on</span></button>' +
    '<button type="button" class="ev-film-btn ev-film-skip">' + ICON.skip + '<span>Skip</span></button>';
  var nameEl = ui.querySelector('.ev-film-name'), timeEl = ui.querySelector('.ev-film-time');
  var track = ui.querySelector('.ev-film-track'), ppBtn = ui.querySelector('.ev-film-pp');
  var soundBtn = ui.querySelector('.ev-film-sound'), skipBtn = ui.querySelector('.ev-film-skip');
  var fills = CHAPTERS.map(function (c, k) {
    var end = k + 1 < CHAPTERS.length ? CHAPTERS[k + 1].t : DUR;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ev-film-seg';
    b.style.flexGrow = String(end - c.t);
    b.setAttribute('aria-label', 'Chapter ' + (k + 1) + ': ' + c.n);
    b.innerHTML = '<span></span>';
    b.addEventListener('click', function () { seek(c.t + 0.01); if (!playing) play(); });
    track.appendChild(b);
    return { el: b.firstChild, t0: c.t, t1: end };
  });

  var chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'ev-film-replay ev-film-layer';
  chip.innerHTML = ICON.play + '<span>Play my story <em>· 58s, with sound</em></span>';

  var lastName = '', lastTime = '';
  function updateUI(t) {
    for (var k = 0; k < fills.length; k++) {
      var f = fills[k], p = clamp((t - f.t0) / (f.t1 - f.t0), 0, 1);
      f.el.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    var ch = CHAPTERS[0];
    for (k = 0; k < CHAPTERS.length; k++) if (t >= CHAPTERS[k].t) ch = CHAPTERS[k];
    var n = String(CHAPTERS.indexOf(ch)).padStart(2, '0') + ' · ' + ch.n;
    if (n !== lastName) { nameEl.textContent = n; lastName = n; }
    var s = Math.floor(t), tm = '0:' + String(s).padStart(2, '0') + ' / 0:' + Math.round(DUR);
    if (tm !== lastTime) { timeEl.textContent = tm; lastTime = tm; }
  }

  /* ------------------------------------------------------------------ audio */

  var AC = window.AudioContext || window.webkitAudioContext;
  var au = { c: null, master: null, bus: null, wet: null, on: false, base: 0, idx: 0, noise: null, verb: null };

  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var SCORE = (function () {
    var E = [];
    function ev(t, k, a, d, hold) { E.push({ t: t, k: k, a: a, d: d || 0, h: !!hold }); }
    var PROG = [[50, 53, 57, 60, 64], [46, 53, 57, 62, 65], [48, 53, 57, 60, 64], [48, 55, 60, 62, 67]];
    var BASS = [38, 34, 36, 36], PAT = [0, 2, 4, 1, 3, 2, 4, 3], PENT = [62, 65, 67, 69, 72, 74, 77, 79, 81];
    var j, b;

    /* cold open: a drone, keys, two bells */
    ev(0, 'pad', [[38, 50, 57], 0.7, 520], 4.8, true);
    ev(0, 'sub', [38, 0.07], 4.8, true);
    for (j = 0; j < 12; j++) ev(0.5 + j * 0.15, 'tick', [j % 4 === 0 ? 0.07 : 0.045]);
    ev(3.0, 'bell', [81, 0.07, 2.4]); ev(3.3, 'bell', [86, 0.05, 2.4]);
    ev(3.9, 'whoosh', [0.6, 0.07, 1]);
    ev(4.5, 'kick', [0.45]); ev(4.5, 'crash', [0.05, 1.8]);

    for (b = 2; b < 21; b++) {
      var ci = (b - 2) % 4, ch = PROG[ci], t0 = b * BAR, bright = 650 + (b - 2) * 120;
      ev(t0, 'pad', [ch, 1, bright], BAR, true);
      ev(t0, 'sub', [BASS[ci], b < 6 ? 0.07 : 0.1], BAR, true);
      var step = b < 6 ? 0.3 : 0.15, vol = b < 6 ? 0.045 : (b >= 10 && b < 12 ? 0.028 : 0.05);
      for (j = 0; j < BAR / step - 0.01; j++) {
        var tt = t0 + j * step;
        if (tt >= 50.1) break;
        ev(tt, 'pluck', [ch[PAT[j % 8] % ch.length] + 12, vol * (j % 4 === 0 ? 1.3 : 1), bright * 2.2]);
      }
      for (var bt = 0; bt < 4; bt++) {
        var tb = t0 + bt * BEAT;
        if (tb >= 50.1) break;
        if (b >= 4 && (b >= 6 || bt % 2 === 0)) ev(tb, 'kick', [b < 6 ? 0.32 : 0.46]);
        if (b >= 6) ev(tb + 0.3, 'hat', [0.03, 0.05]);
        if (b >= 14 && bt % 2 === 1) ev(tb, 'snare', [0.06]);
      }
      if (b >= 14 && b < 18) for (j = 0; j < 16; j++) ev(t0 + j * 0.15, 'tick', [0.018 + (j % 4 === 0 ? 0.012 : 0)]);
      if (b >= 19) for (j = 0; j < 16; j++) { if (t0 + j * 0.15 < 50.1) ev(t0 + j * 0.15, 'hat', [0.012 + j * 0.0012, 0.03]); }
    }
    /* the calendar filling: sparse high notes, thickening as the years do */
    for (j = 0; j < 44; j++) {
      var ts = 5.0 + j * 0.15;
      if (hash(j + 400) < 0.12 + (j / 44) * 0.5) ev(ts, 'pluck', [PENT[Math.floor(hash(j + 900) * PENT.length)] + 12, 0.025, 6000]);
    }
    ev(14.5, 'bell', [86, 0.08, 3]); ev(14.8, 'bell', [93, 0.045, 3]);
    [16.6, 23.6, 28.7, 33.2, 42.8].forEach(function (t) { ev(t, 'whoosh', [0.5, 0.05, 1]); });
    /* the board: a key for every letter, a note for every flip */
    var WIN = [74, 77, 79, 81, 86];
    for (var r = 0; r < 3; r++) for (j = 0; j < 5; j++) {
      ev(typeT(r, j), 'tick', [0.04]);
      var mk = MARKS[r][j], ft = flipT(r, j) + 0.15;
      if (mk === 2) ev(ft, 'bell', [WIN[j], 0.06, 1.4]);
      else if (mk === 1) ev(ft, 'bell', [76, 0.05, 1.2]);
      else ev(ft, 'pluck', [57, 0.06, 700]);
    }
    [74, 77, 81, 86, 89].forEach(function (m, k) { ev(28.8 + k * 0.075, 'bell', [m, 0.055, 2]); });
    for (j = 0; j < 27; j++) if (hash(j + 1300) < 0.35) ev(29.4 + j * 0.15, 'pluck', [PENT[Math.floor(hash(j + 1700) * 9)] + 24, 0.02, 7000]);
    LEDGER.forEach(function (L, e) { ev(L.t, 'bell', [[74, 77, 79, 81, 84][e % 5], 0.03, 0.8]); });
    ALERTS.forEach(function (t) { ev(t, 'bell', [86, 0.055, 1.6]); });
    ev(47.4, 'riser', [3.0]);
    /* the portrait: impact, a major chord after twenty bars of minor, and the name */
    ev(50.4, 'kick', [0.7]); ev(50.4, 'boom', [0.45]); ev(50.4, 'crash', [0.09, 3.2]);
    ev(50.4, 'pad', [[50, 54, 57, 61, 64, 69], 1.25, 2400, 3.2], 6.2, true);
    ev(50.4, 'sub', [38, 0.13, 3.0], 6.2, true);
    [69, 74, 78, 81].forEach(function (m, k) { ev(51.0 + k * 0.3, 'bell', [m, 0.06, 3]); });
    ev(53.1, 'bell', [86, 0.05, 3.5]);
    ev(55.3, 'bell', [90, 0.04, 3.5]); ev(55.2, 'whoosh', [1.2, 0.04, -1]);
    return E.sort(function (x, y) { return x.t - y.t; });
  })();

  function makeNoise(c) {
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function makeVerb(c) {
    var len = Math.floor(c.sampleRate * 3), buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    var v = c.createConvolver(); v.buffer = buf; return v;
  }
  /* S is a sound session: {c, bus, wet, noise}. A seek ends one and starts another. */
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
    n.start(t, Math.random()); n.stop(t + dur); return n;
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
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a[1], t + 0.08);
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
      var lo = 300, hi = 4200;
      f.frequency.setValueAtTime(a[2] > 0 ? lo : hi, t); f.frequency.exponentialRampToValueAtTime(a[2] > 0 ? hi : lo, t + dur);
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

  /* One chain per context: sessions feed a master through a gentle compressor. */
  function buildChain(c) {
    var master = c.createGain(), comp = c.createDynamicsCompressor(), verbRet = c.createGain(), verb = makeVerb(c);
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    master.gain.value = 0.85;
    verbRet.gain.value = 0.32;
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
    [S.bus, S.wet].forEach(function (g) {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.08);
    });
    setTimeout(function () { try { S.bus.disconnect(); S.wet.disconnect(); } catch (e) { /* already gone */ } }, 300);
  }
  function fire(S, ev, when, from) {
    if (from > ev.t) {
      /* joining a held note late: only pads and drones make sense mid-way */
      if (!ev.h) return;
      var left = ev.d - (from - ev.t);
      if (left < 0.25) return;
      INST[ev.k](S, when, ev.a, left);
    } else {
      INST[ev.k](S, when, ev.a, ev.d);
    }
  }

  /* start the score at film time T, clocked from now */
  function audioSync(T) {
    if (!au.on) return;
    endSession(au.S);
    au.S = newSession(au.c, au.chain);
    au.base = au.c.currentTime + 0.06 - T;
    au.idx = 0;
    while (au.idx < SCORE.length && SCORE[au.idx].t < T) {
      var ev = SCORE[au.idx++];
      if (ev.h && ev.t + ev.d > T + 0.25) fire(au.S, ev, au.c.currentTime + 0.06, T);
    }
  }
  function audioPump(T) {
    if (!au.on || !au.S) return;
    var ahead = T + 0.25;
    while (au.idx < SCORE.length && SCORE[au.idx].t < ahead) {
      var ev = SCORE[au.idx++], when = au.base + ev.t;
      if (when < au.c.currentTime - 0.03) continue;
      fire(au.S, ev, Math.max(when, au.c.currentTime), ev.t);
    }
  }
  function soundOn() {
    if (!AC) return false;
    if (!au.c) {
      try { au.c = new AC(); } catch (e) { return false; }
      au.chain = buildChain(au.c);
    }
    var T = clockNow();
    if (au.c.state === 'suspended') au.c.resume();
    au.chain.master.gain.cancelScheduledValues(au.c.currentTime);
    au.chain.master.gain.setValueAtTime(0.85, au.c.currentTime);
    au.on = true;
    audioSync(T);
    if (!playing) au.c.suspend();
    return true;
  }
  function soundOff() {
    if (!au.on) return;
    var T = clockNow();
    au.on = false;
    perfBase = performance.now() - T * 1000;
    endSession(au.S); au.S = null;
    var c = au.c;
    setTimeout(function () { if (!au.on && c.state === 'running') c.suspend(); }, 400);
  }

  /* Offline render of the whole score, for checking levels without speakers:
     heroFilm.renderOffline().then(console.log) → peak and loudness per second. */
  function renderOffline() {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var c = new OAC(2, 44100 * Math.ceil(DUR + 4), 44100), chain = buildChain(c), S = newSession(c, chain);
    SCORE.forEach(function (ev) { fire(S, ev, 0.05 + ev.t, ev.t); });
    return c.startRendering().then(function (buf) {
      var L = buf.getChannelData(0), R = buf.getChannelData(1), sr = buf.sampleRate, peak = 0, clipped = 0, perSec = [];
      for (var s = 0; s < Math.floor(L.length / sr); s++) {
        var sum = 0, pk = 0;
        for (var i = s * sr; i < (s + 1) * sr; i++) {
          var v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
          if (v > pk) pk = v;
          if (v >= 0.999) clipped++;
          sum += L[i] * L[i];
        }
        peak = Math.max(peak, pk);
        perSec.push({ s: s, peak: +pk.toFixed(3), rmsDb: +(10 * Math.log10(sum / sr + 1e-12)).toFixed(1) });
      }
      return { peak: +peak.toFixed(3), clipped: clipped, perSec: perSec, buffer: buf };
    });
  }

  /* ------------------------------------------------------------------ clock */

  var playing = false, state = 'idle', filmT = 0, pausedAt = 0, perfBase = 0, raf = 0;
  var userPaused = false, autoPaused = false, revealed = true;

  function clockNow() {
    if (!playing) return pausedAt;
    if (au.on) return au.c.currentTime - au.base;
    return (performance.now() - perfBase) / 1000;
  }

  function frame() {
    raf = 0;
    if (!playing) return;
    var t = clockNow();
    if (t >= DUR) { finish(); return; }
    if (t < 0) t = 0;
    filmT = t;
    audioPump(t);
    render(t);
    updateCaps(t);
    updateUI(t);
    if (t >= REVEAL_AT && !revealed) reveal();
    if (t < REVEAL_AT - 0.5 && revealed) conceal();
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (state !== 'film') return;
    if (playing) return;
    playing = true;
    perfBase = performance.now() - pausedAt * 1000;
    if (au.on && au.c.state === 'suspended') au.c.resume();
    ppBtn.innerHTML = ICON.pause; ppBtn.setAttribute('aria-label', 'Pause');
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (!playing) return;
    pausedAt = clockNow();
    playing = false;
    if (au.on && au.c.state === 'running') au.c.suspend();
    ppBtn.innerHTML = ICON.play; ppBtn.setAttribute('aria-label', 'Play');
  }
  function seek(T) {
    T = clamp(T, 0, DUR - 0.05);
    pausedAt = T; filmT = T;
    perfBase = performance.now() - T * 1000;
    if (au.on) {
      if (au.c.state === 'suspended' && playing) au.c.resume();
      audioSync(T);
    }
    if (!playing) { render(T); updateCaps(T); updateUI(T); if (T >= REVEAL_AT) reveal(); else conceal(); }
  }

  function conceal() { revealed = false; hero.classList.add('ev-film-on'); }
  /* removing the class restarts the hero's own entrance animations — the ones
     that were held back under the film — so the page arrives exactly as it
     always has, just later */
  function reveal() { revealed = true; hero.classList.remove('ev-film-on'); }

  function start() {
    state = 'film';
    hero.classList.add('ev-film-active');
    hero.classList.remove('ev-film-ended');
    conceal();
    layout();
    measureCaps();
    seek(0);
    userPaused = false;
    play();
  }
  function finish() {
    playing = false;
    state = 'done';
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    reveal();
    hero.classList.remove('ev-film-active');
    hero.classList.add('ev-film-ended');
    storeSet(SEEN_KEY, String(Date.now()));
    if (au.on) {
      var c = au.c;
      /* the last chord is still ringing: let it, then stop the context */
      setTimeout(function () { if (state !== 'film' && c.state === 'running') c.suspend(); }, 5000);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

  /* ----------------------------------------------------------------- wiring */

  cv.className = 'ev-film-canvas ev-film-layer';
  cv.setAttribute('aria-hidden', 'true');
  hero.appendChild(cv);
  hero.appendChild(caps);
  hero.appendChild(ui);
  hero.appendChild(chip);
  readTheme();

  ppBtn.addEventListener('click', function () {
    if (playing) { userPaused = true; pause(); } else { userPaused = false; play(); }
  });
  soundBtn.addEventListener('click', function () {
    soundBtn.classList.remove('is-hint');
    if (au.on) soundOff(); else if (!soundOn()) return;
    soundBtn.setAttribute('aria-pressed', String(au.on));
    soundBtn.innerHTML = (au.on ? ICON.soundOn : ICON.soundOff) + '<span>' + (au.on ? 'Sound off' : 'Sound on') + '</span>';
  });
  skipBtn.addEventListener('click', function () {
    if (au.on) { endSession(au.S); au.S = null; }
    finish();
  });
  chip.addEventListener('click', function () {
    /* the chip says "with sound", and a click is the gesture that allows it */
    start();
    if (!au.on && soundOn()) {
      soundBtn.classList.remove('is-hint');
      soundBtn.setAttribute('aria-pressed', 'true');
      soundBtn.innerHTML = ICON.soundOn + '<span>Sound off</span>';
    }
  });

  new MutationObserver(function () { readTheme(); if (!playing && state === 'film') render(filmT); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (state === 'film') { layout(); measureCaps(); if (!playing) render(filmT); } }, 120);
  });

  /* off screen or in a background tab, the story waits for its reader */
  function autoPause(off) {
    if (state !== 'film') return;
    if (off && playing) { autoPaused = true; pause(); }
    else if (!off && autoPaused && !userPaused) { autoPaused = false; play(); }
  }
  document.addEventListener('visibilitychange', function () { autoPause(document.hidden); });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) { autoPause(en[0].intersectionRatio < 0.35); }, { threshold: [0, 0.35, 0.6] }).observe(hero);
  }

  window.heroFilm = {
    play: function () { if (state !== 'film') start(); else play(); },
    pause: pause,
    seek: function (t) { if (state !== 'film') { start(); pause(); } seek(t); },
    renderOffline: renderOffline,
    get time() { return clockNow(); },
    duration: DUR
  };

  var forced = /[?&]film\b/.test(location.search);
  var boot = root.classList.contains('ev-film-boot');
  root.classList.remove('ev-film-boot');
  hero.classList.add('ev-film-ready');
  if ((boot || forced) && !(reduced && !forced)) {
    /* fonts first — the opening line is typeset on the canvas, and a fallback
       face measured now would put the caret in the wrong place */
    var go = function () { if (state === 'idle') start(); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 700); }
    else go();
    conceal();
  } else {
    hero.classList.add('ev-film-ended');
  }
})();

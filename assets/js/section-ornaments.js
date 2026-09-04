/* Section ornaments — the descent from Projects to the footer, carried by three
 * systems that share one canvas, one measurement pass and one frame loop.
 *
 * They are divided by territory, which is the whole reason they can coexist:
 *
 *   Halftone Drift   the whole plane, behind everything — the hero's dots,
 *                    thinned, continuing down the page
 *   Signal Trace     the left gutter, alone — one unbroken line that jogs at
 *                    each section, branches, and fills as you descend
 *   Registration     the right gutter and the section corners — a ruler that
 *                    runs the whole descent, and brackets that do not
 *
 * That last distinction is the point. The ruler is everywhere because scroll
 * position is true everywhere; brackets and a measured height appear only on
 * sections that actually display figures, found by looking for the elements
 * that hold them rather than by naming sections here — so the marks stay honest
 * if the page is rearranged, and a mark on screen always means something is
 * being measured rather than being measurement-flavoured wallpaper.
 *
 * One fixed, viewport-sized canvas rather than one canvas over the whole run:
 * the run is several thousand pixels tall, which at any device ratio is past
 * what a canvas can allocate, and drawing only what is on screen makes the cost
 * independent of how long the page gets.
 */
(function () {
  'use strict';

  var start = document.getElementById('projects');
  var foot = document.querySelector('footer');
  if (!start || !foot || !window.matchMedia) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* All three run at every width; what changes is their scale. A phone has a
     24px gutter rather than a 5vw one, so the trace routes in a narrower set of
     lanes, the marks tuck in tighter and the ruler's ticks shorten — the systems
     are not a desktop luxury, they just have less room to say it in. Below this
     bound there is genuinely nowhere to put a rail beside the text. */
  var RAIL_MIN = 380;
  var narrow = false;

  var GAP = 34,        /* px between dots in the field */
      BAND = 140,      /* how far a dot rises before it recycles */
      REPEL_R = 104, REPEL_F = 1.5,
      SPRING = 0.028, DAMP = 0.90;

  /* ── shared measurement, in run-relative coordinates ────────── */

  var runTop = 0, runH = 0, docBot = 0, vw = 0, vh = 0, dpr = 1;
  var stops = [];      /* run-relative y of every section top, plus the footer */
  var figures = [];    /* sections that display measured figures */

  function docTop(el) {
    return el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
  }

  /* clientWidth, not innerWidth: innerWidth counts the scrollbar, so a canvas
     sized from it runs its right edge underneath one — which is exactly where
     the ruler lives, and why the ticks were being drawn behind the scrollbar
     while the readout, positioned by CSS, landed correctly. */
  function viewport() {
    var d = document.documentElement;
    vw = d.clientWidth || innerWidth;
    vh = d.clientHeight || innerHeight;
    narrow = vw < 768;
  }

  /* The page's own gutter, which is 5vw above the phone breakpoint and a fixed
     1.5rem below it. Read rather than assumed, so the ornaments stay pinned to
     the text's edge if that padding is ever changed. */
  function gutter() {
    var sec = document.querySelector('section[id]');
    var pad = sec ? parseFloat(getComputedStyle(sec).paddingLeft) : 0;
    return pad || vw * 0.05;
  }

  function measure() {
    viewport();
    runTop = docTop(start);
    docBot = docTop(foot) + foot.offsetHeight;
    runH = Math.max(1, docBot - runTop);

    stops = [];
    var secs = document.querySelectorAll('section[id]');
    for (var i = 0; i < secs.length; i++) {
      var y = docTop(secs[i]) - runTop;
      if (y >= -1) stops.push(y);
    }
    stops.push(docTop(foot) - runTop);

    figures = [];
    for (var j = 0; j < secs.length; j++) {
      /* "reports figures" is asked of the DOM, not asserted here: a section
         qualifies because it contains the elements that hold measured numbers. */
      if (!secs[j].querySelector('.stat-number, .ai-hero-num')) continue;
      var t = docTop(secs[j]) - runTop;
      if (t < -1) continue;
      figures.push({ el: secs[j], top: t, h: secs[j].offsetHeight });
    }
  }

  /* ── the layers ─────────────────────────────────────────────── */

  var cv = document.createElement('canvas');
  var ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  cv.className = 'orn-canvas';
  cv.setAttribute('aria-hidden', 'true');

  var marks = document.createElement('div');
  marks.className = 'orn-marks';
  marks.setAttribute('aria-hidden', 'true');

  var read = document.createElement('div');
  read.className = 'orn-read';
  read.setAttribute('aria-hidden', 'true');

  /* Order is the stacking order here, since both sit at z-index 0: the canvas
     goes in first so the field and the trace paint under the marks rather than
     speckling over a bracket. */
  document.body.insertBefore(marks, document.body.firstChild);
  document.body.insertBefore(cv, document.body.firstChild);
  document.body.appendChild(read);

  /* ── the drift field ────────────────────────────────────────── */

  var P = [];

  /* The field runs the whole page, hero included — it is the atmosphere the
     portrait's dots sit in, so stopping it at Projects left the one section
     built out of dots as the only one without any behind it. The trace and the
     rule still begin at Projects: those are about the descent, and the hero is
     not part of it. */
  function seedField() {
    P = [];
    /* A phone's screen is a third the area but its GPU is a lot less than a
       third as fast, so the field thins rather than merely being cropped. */
    var gap = narrow ? GAP * 1.35 : GAP;
    for (var y = 0; y < docBot; y += gap) {
      for (var x = 0; x < vw; x += gap) {
        /* Weighted toward the gutters. The middle keeps some field so the page
           does not read as two decorated edges around an undecorated column,
           but at a third of the weight so it stays behind the copy. */
        var t = Math.abs(x / vw - 0.5) * 2;
        if (t < 0.64 && Math.random() > 0.34) continue;
        P.push({
          hx: x + Math.random() * (gap - 6),
          hy: y + Math.random() * (gap - 6),
          ox: 0, oy: 0, vx: 0, vy: 0,
          r: 0.55 + Math.random() * 0.75,
          a: 0.4 + Math.random() * 0.6,
          ph: Math.random() * BAND,
          sp: 0.10 + Math.random() * 0.16
        });
      }
    }
    /* generated row-major, so it is already sorted by home y — which is what
       lets the frame binary-search straight to the dots that are on screen */
  }

  function firstVisible(top) {
    var lo = 0, hi = P.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (P[mid].hy < top) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  /* ── the trace ──────────────────────────────────────────────── */

  var path = [], segLen = [], traceLen = 0, branches = [];

  function buildTrace() {
    path = []; segLen = []; traceLen = 0; branches = [];
    if (vw < RAIL_MIN || !stops.length) return;

    var lanes = narrow ? [5, 13, 8, 15, 10] : [18, 32, 22, 36, 26];
    path.push([lanes[0], runTop]);
    for (var i = 0; i < stops.length; i++) {
      var y = runTop + stops[i];
      var px = lanes[i % lanes.length], nx = lanes[(i + 1) % lanes.length];
      path.push([px, y - 18]);
      path.push([nx, y + 18]);
    }
    path.push([lanes[stops.length % lanes.length], runTop + runH]);

    for (var s = 1; s < path.length; s++) {
      var dx = path[s][0] - path[s - 1][0], dy = path[s][1] - path[s - 1][1];
      var l = Math.sqrt(dx * dx + dy * dy);
      segLen.push(l);
      traceLen += l;
    }

    /* Branches: split at a boundary, run one section alongside, merge at the
       next. Two of them, spread through the run — a git graph read vertically,
       and the one place the second brand colour appears on the page. */
    for (var b = 1; b + 1 < stops.length; b += 3) {
      var y0 = runTop + stops[b] + 18, y1 = runTop + stops[b + 1] + 18;
      if (y1 - y0 < 200) continue;
      var lx = lanes[(b + 1) % lanes.length], mx = lanes[(b + 2) % lanes.length];
      var out = narrow ? 9 : 24;
      branches.push([[lx, y0], [lx + out, y0 + 26], [lx + out, y1 - 26], [mx, y1]]);
    }
  }

  /* How far through the run the reader is, as 0..1.
     Measured at the middle of the viewport rather than its top, so the trace
     reaches a node as the section it marks arrives rather than a screen early —
     but then rescaled, because the middle cannot travel the whole run: at
     maximum scroll it is still half a viewport short of the bottom. Left raw,
     the fill topped out near 0.97 and the last stretch of trace, the footer
     node included, could never light no matter how far you scrolled. */
  function progress() {
    var sy = window.scrollY || window.pageYOffset;
    var raw = (sy + vh * 0.5 - runTop) / runH;
    var span = 1 - (vh * 0.5) / runH;
    var t = span > 0.001 ? raw / span : raw;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function pointAt(dist) {
    var acc = 0;
    for (var i = 0; i < segLen.length; i++) {
      if (acc + segLen[i] >= dist) {
        var u = segLen[i] ? (dist - acc) / segLen[i] : 0;
        return [path[i][0] + (path[i + 1][0] - path[i][0]) * u,
                path[i][1] + (path[i + 1][1] - path[i][1]) * u];
      }
      acc += segLen[i];
    }
    return path[path.length - 1] || [0, 0];
  }

  /* ── the marks ──────────────────────────────────────────────── */

  function buildMarks() {
    marks.innerHTML = '';
    marks.style.top = runTop + 'px';
    marks.style.height = runH + 'px';
    if (vw < RAIL_MIN) return;

    var gut = gutter(), reach = narrow ? 6 : 14;
    for (var i = 0; i < figures.length; i++) {
      var f = figures[i];
      var x0 = gut - reach, x1 = vw - gut + reach;
      var y0 = f.top + (narrow ? 18 : 30), y1 = f.top + f.h - (narrow ? 18 : 30);
      corner(x0, y0, 1, 1);
      corner(x1, y0, -1, 1);
      corner(x0, y1, 1, -1);
      corner(x1, y1, -1, -1);

      var tag = document.createElement('span');
      tag.className = 'orn-dim';
      tag.textContent = Math.round(f.h) + 'px';
      tag.style.left = (x1 - 4) + 'px';
      tag.style.top = (y0 - 3) + 'px';
      marks.appendChild(tag);
    }
  }

  function corner(x, y, sx, sy) {
    var el = document.createElement('i');
    el.className = 'orn-corner';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'scale(' + sx + ',' + sy + ')';
    marks.appendChild(el);
  }

  /* ── the title block, where the drawing terminates ──────────── */

  (function titleBlock() {
    var block = document.createElement('div');
    block.className = 'orn-block';
    var rev = new Date(document.lastModified);
    var pairs = [
      ['Sheet', location.hostname || 'kimlj.com'],
      ['Sections', String(document.querySelectorAll('section[id]').length).padStart(2, '0')],
      ['Projects', String(document.querySelectorAll('.project-card').length).padStart(2, '0')],
      ['Rev', isNaN(rev) ? '—' : rev.getFullYear() + '.' + String(rev.getMonth() + 1).padStart(2, '0')]
    ];
    for (var i = 0; i < pairs.length; i++) {
      var cell = document.createElement('div');
      var k = document.createElement('span');
      k.textContent = pairs[i][0];
      var v = document.createElement('b');
      v.textContent = pairs[i][1];
      cell.appendChild(k);
      cell.appendChild(v);
      block.appendChild(cell);
    }
    foot.parentNode.insertBefore(block, foot);
  })();

  /* ── input ──────────────────────────────────────────────────── */

  var ptr = { x: -1e5, y: -1e5, on: false };
  if (!reduced) {
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    }, { passive: true });
    addEventListener('pointerleave', function () { ptr.on = false; }, { passive: true });
  }

  /* ── the frame ──────────────────────────────────────────────── */

  var last = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(40, now - last) / 16.67; last = now;
    if (document.hidden) return;

    /* Document coordinates throughout, rather than coordinates relative to the
       trace's run. The field starts at the top of the page and the trace starts
       at Projects, so the two no longer share an origin, and the page's own is
       the only one both can be expressed in. */
    var top = window.scrollY || window.pageYOffset;
    if (top > docBot || top + vh < 0) { ctx.clearRect(0, 0, vw, vh); return; }

    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(0, -top);

    drawField(top, dt);
    drawTrace(top, now);
    drawRuler(top);

    ctx.restore();
  }

  function drawField(top, dt) {
    if (!P.length) return;
    var lo = firstVisible(top - 20), buckets = [[], [], []];

    for (var i = lo; i < P.length; i++) {
      var p = P[i];
      if (p.hy - BAND > top + vh) break;   /* sorted, so the rest are below too */

      if (!reduced) {
        p.ph += p.sp * dt;
        if (p.ph > BAND) p.ph -= BAND;
      }
      var y = p.hy - p.ph;

      if (ptr.on) {
        var dx = p.hx + p.ox - ptr.x, dy = y + p.oy - (ptr.y + top);
        var d2 = dx * dx + dy * dy;
        if (d2 < REPEL_R * REPEL_R) {
          var d = Math.sqrt(d2) || 0.001, f = (1 - d / REPEL_R) * REPEL_F;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
      }
      p.vx = (p.vx - p.ox * SPRING) * DAMP;
      p.vy = (p.vy - p.oy * SPRING) * DAMP;
      p.ox += p.vx; p.oy += p.vy;

      /* Fades in as it appears and out as it recycles, so the wrap that keeps
         this field bounded — and therefore searchable — is never visible. */
      var w = Math.sin(Math.PI * (p.ph / BAND));
      var a = p.a * w;
      if (a < 0.06) continue;
      p.dy = y;
      buckets[a < 0.34 ? 0 : a < 0.62 ? 1 : 2].push(p);
    }

    var levels = [0.08, 0.16, 0.28];
    for (var b = 0; b < 3; b++) {
      if (!buckets[b].length) continue;
      ctx.beginPath();
      for (var j = 0; j < buckets[b].length; j++) {
        var q = buckets[b][j], qx = q.hx + q.ox, qy = q.dy + q.oy;
        ctx.moveTo(qx + q.r, qy);
        ctx.arc(qx, qy, q.r, 0, 6.283);
      }
      ctx.fillStyle = 'rgba(' + ink + ',' + levels[b] + ')';
      ctx.fill();
    }
  }

  function drawTrace(top, now) {
    if (!path.length) return;

    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (var i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.strokeStyle = rail;
    ctx.stroke();

    for (var b = 0; b < branches.length; b++) {
      ctx.beginPath();
      ctx.moveTo(branches[b][0][0], branches[b][0][1]);
      for (var s = 1; s < branches[b].length; s++) ctx.lineTo(branches[b][s][0], branches[b][s][1]);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(' + ink2 + ',0.34)';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    var lit = progress() * traceLen, acc = 0;
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (var k = 0; k < segLen.length; k++) {
      if (acc + segLen[k] < lit) {
        ctx.lineTo(path[k + 1][0], path[k + 1][1]);
        acc += segLen[k];
      } else {
        var pt = pointAt(lit);
        ctx.lineTo(pt[0], pt[1]);
        break;
      }
    }
    ctx.strokeStyle = 'rgba(' + ink + ',0.85)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.lineWidth = 1;

    /* nodes, lit as the fill passes them */
    for (var n = 0; n < stops.length; n++) {
      var ny = runTop + stops[n] + 18;
      if (ny < top - 40 || ny > top + vh + 40) continue;
      var nx = path[Math.min(path.length - 1, n * 2 + 2)][0];
      var on = pointAt(lit)[1] >= ny;
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, 6.283);
      ctx.fillStyle = on ? 'rgba(' + ink + ',0.10)' : bgc;
      ctx.fill();
      ctx.strokeStyle = on ? 'rgba(' + ink + ',0.9)' : rail;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (reduced) return;
    var u = ((now % 9000) / 9000);
    var pp = pointAt(u * traceLen);
    if (pp[1] > top - 20 && pp[1] < top + vh + 20) {
      ctx.beginPath();
      ctx.arc(pp[0], pp[1], 2.2, 0, 6.283);
      ctx.fillStyle = 'rgba(' + ink + ',0.95)';
      ctx.fill();
    }
  }

  function drawRuler(top) {
    if (vw < RAIL_MIN) return;
    var x = vw - (narrow ? 7 : 14);
    var minor = narrow ? 3 : 5, major = narrow ? 6 : 9;
    var from = Math.max(runTop, runTop + Math.floor((top - runTop - 20) / 14) * 14);
    var to = Math.min(runTop + runH, top + vh + 20);

    /* Snapped to the device grid before drawing. A 1px hairline landing on a
       fractional device row is antialiased across two of them and loses half
       its contrast, which on this ground is the difference between a rule you
       can see and one you cannot. */
    function snap(y) { return (Math.round((y - top) * dpr) + 0.5) / dpr + top; }

    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var y = from; y < to; y += 14) {
      if ((y % 70) === 0) continue;
      var sy = snap(y);
      ctx.moveTo(x, sy);
      ctx.lineTo(x + minor, sy);
    }
    ctx.strokeStyle = rail;
    ctx.stroke();

    /* Every fifth tick is longer and carries a trace of the accent, so the rule
       has a cadence to read rather than being an undifferentiated comb. */
    ctx.beginPath();
    for (var my = runTop + Math.floor((from - runTop) / 70) * 70; my < to; my += 70) {
      if (my < from - 70) continue;
      var msy = snap(my);
      ctx.moveTo(x - (narrow ? 2 : 3), msy);
      ctx.lineTo(x + major, msy);
    }
    ctx.strokeStyle = 'rgba(' + ink + ',0.26)';
    ctx.stroke();

    /* The cursor sits at the middle of the viewport because that is where the
       reader is; the ticks scroll past it like tape through a gauge. */
    var cy = snap(top + vh * 0.5);
    if (cy >= runTop && cy <= runTop + runH) {
      ctx.beginPath();
      ctx.moveTo(x - (narrow ? 4 : 7), cy);
      ctx.lineTo(x + (narrow ? 8 : 11), cy);
      ctx.strokeStyle = 'rgba(' + ink + ',0.9)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  /* ── colours, from the theme tokens ─────────────────────────── */

  var ink = '200,255,0', ink2 = '0,255,200', rail = '#26262b', bgc = '#0a0a0b';

  function rgbOf(v, fb) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim());
    if (!m) return fb;
    var n = parseInt(m[1], 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function palette() {
    var cs = getComputedStyle(document.documentElement);
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    ink = rgbOf(cs.getPropertyValue('--accent'), dark ? '200,255,0' : '8,145,178');
    ink2 = rgbOf(cs.getPropertyValue('--gradient-2'), dark ? '0,255,200' : '99,102,241');
    /* --border-hover, not --border: the rule is 1px of unlit hairline on a
       near-black ground, and at --border it is technically drawn and visually
       absent. The corners in the stylesheet take the same token for the same
       reason. */
    rail = (cs.getPropertyValue('--border-hover') || '#333338').trim();
    bgc = (cs.getPropertyValue('--bg') || '#0a0a0b').trim();
  }

  /* ── scroll readout ─────────────────────────────────────────── */

  var ticking = false;
  function readout() {
    ticking = false;
    if (vw < RAIL_MIN) { read.style.opacity = '0'; return; }
    var sy = window.scrollY || window.pageYOffset;
    var raw = (sy + vh * 0.5 - runTop) / runH;
    if (raw < -0.05 || raw > 1.05) { read.style.opacity = '0'; return; }
    read.style.opacity = '1';
    /* the same rescale as the fill, so the two never disagree and the bottom of
       the page reads 100% rather than stalling a few points short */
    read.textContent = String(Math.round(progress() * 100)).padStart(3, '0') + '%';
  }

  addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(readout); }
  }, { passive: true });

  /* ── wiring ─────────────────────────────────────────────────── */

  function resize() {
    viewport();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    /* The backing store is in device pixels and the CSS box is in css pixels;
       set only the first and the element lays out at the backing store's size,
       so at any ratio above 1 the whole drawing is scaled up and its right edge
       — the ruler — is pushed off screen. */
    cv.style.width = vw + 'px';
    cv.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rebuild() {
    measure();
    resize();
    seedField();
    buildTrace();
    buildMarks();
    readout();
  }

  palette();
  rebuild();
  requestAnimationFrame(frame);

  var timer;
  function later() { clearTimeout(timer); timer = setTimeout(rebuild, 180); }
  addEventListener('resize', later);
  addEventListener('load', later);

  /* The run grows as charts render and images land, so its height cannot be
     measured once. Watching the body catches every one of those without this
     having to know which of them exist. */
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);

  new MutationObserver(function () { palette(); }).observe(
    document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

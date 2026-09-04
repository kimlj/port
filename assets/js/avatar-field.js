/* Hero portrait field — the headshot redrawn as a field of dots that assemble
 * on load, scatter away from the cursor, settle back, and ripple on click.
 * Modelled on the dot fields on mdsprosolutions.com (its home figure and its
 * careers hands), rebuilt around a photograph rather than a baked luminance map.
 *
 * Two channels do two different jobs, which is what keeps a photo legible as
 * dots. Alpha decides whether a dot exists at all: profile.webp is a cut-out,
 * so its alpha IS the silhouette and the field ends on the subject's own
 * outline rather than on a circle drawn around it. Luminance only decides how
 * bright and how fat each dot is, over a floor that keeps the darkest of them
 * visible — map existence
 * to luminance instead and near-black hair and a navy suit drop out entirely,
 * leaving a face floating in the dark.
 *
 * Colour is read from the theme tokens, so the ramp follows the accent and
 * flips on the light theme: on a dark page a bright pixel is a bright dot,
 * on a light one it is a sparse pale one, the way ink works on paper.
 *
 * The <img> stays in the markup — it carries the alt text, it is what the
 * canvas samples, and it is what remains visible if any of this fails.
 */
(function () {
  'use strict';

  var wrap = document.querySelector('.hero-avatar');
  if (!wrap) return;
  var img = wrap.querySelector('img');
  if (!img || !img.getAttribute('src')) return;

  var cv = document.createElement('canvas');
  if (!cv.getContext) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var hero = wrap.closest('.hero') || wrap.parentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches;

  var GRID = 112,      /* cells across the portrait — one cell is one dot */
      ACUT = 0.34,     /* alpha below this is background, not subject */
      AFEATHER = 0.86, /* alpha between ACUT and this is dithered, softening the outline */
      FLOOR = 0.14,    /* darkest a lit dot may draw — hair would vanish without it */
      REPEL_R = 118, REPEL_F = 2.4,
      SPRING = 0.021, DAMP = 0.90,
      RIP_SPEED = 620, RIP_BAND = 74, RIP_F = 3.2,
      ENTRY_MS = 2200, ENTRY_HOLD = 900, ENTRY_FADE = 0.20;

  /* ── palette ──────────────────────────────────────────────── */

  function hexRgb(value, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  var dark = true, TIERS = [];

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    dark = document.documentElement.getAttribute('data-theme') !== 'light';
    var accent = hexRgb(cs.getPropertyValue('--accent'), dark ? [200, 255, 0] : [8, 145, 178]);
    var page = hexRgb(cs.getPropertyValue('--bg'), dark ? [10, 10, 11] : [248, 248, 246]);
    /* strongest ink first. On the dark page the ramp climbs toward white so
       highlights read; on the light one it sinks toward black, because a pale
       dot on a pale page is not a dot. */
    TIERS = dark
      ? [mix(accent, [255, 255, 255], 0.60), mix(accent, [255, 255, 255], 0.22),
         accent, mix(accent, page, 0.52)]
      : [mix(accent, [0, 0, 0], 0.52), mix(accent, [0, 0, 0], 0.18),
         accent, mix(accent, page, 0.40)];
    for (var i = 0; i < TIERS.length; i++) TIERS[i] = TIERS[i].join(',');
  }
  readPalette();

  /* ── sampling ─────────────────────────────────────────────── */

  var cells = null;   /* {a, l} per grid cell, sampled once from the photo */

  function sample() {
    var t = document.createElement('canvas');
    t.width = t.height = GRID;
    var tc = t.getContext('2d', { willReadFrequently: true });
    /* The source is square and so is the box it is displayed in, so cover-fit
       is a straight scale — no crop rectangle to reproduce here. */
    tc.drawImage(img, 0, 0, GRID, GRID);
    var d;
    try {
      d = tc.getImageData(0, 0, GRID, GRID).data;
    } catch (e) {
      return false;   /* tainted canvas: leave the plain <img> in place */
    }
    var a = new Float32Array(GRID * GRID), l = new Float32Array(GRID * GRID);
    for (var i = 0; i < a.length; i++) {
      var o = i * 4;
      a[i] = d[o + 3] / 255;
      /* Rec. 601 luma. getImageData is not premultiplied, so a transparent
         pixel's colour is meaningless — but those cells never become dots. */
      l[i] = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
    }
    cells = { a: a, l: l };
    return true;
  }

  /* ── the field ────────────────────────────────────────────── */

  var P = [], GROUPS = [], W = 0, H = 0, size = 0, dpr = 1,
      originX = 0, originY = 0;   /* the portrait's top-left within the hero */

  function style(p) {
    /* ink: how much of this dot there is. Inverted on the light theme, where
       the dark parts of the photo are the parts that need covering. */
    var ink = dark ? p.l : 1 - p.l;
    ink = FLOOR + (1 - FLOOR) * ink;
    p.tier = ink >= 0.86 ? 0 : ink >= 0.62 ? 1 : ink >= 0.40 ? 2 : 3;
    p.r = p.pitch * 0.5 * 0.90 * (0.44 + 0.56 * Math.pow(ink, 0.8));
    p.al = (0.5 + 0.5 * ink) * p.edge;
  }

  function build() {
    var pitch = size / GRID;
    var ox = originX, oy = originY;
    P = [];

    for (var gy = 0; gy < GRID; gy++) {
      /* The photo's subject runs off the bottom of its own frame, so the field
         would otherwise stop on a ruled line and read as a cropped picture
         rather than as something drawn out of the dark. Dithered rather than
         faded with alpha: a dot either exists or it does not, so thinning their
         number is what makes an edge soft. */
      var cut = Math.min(1, (GRID - gy) / (GRID * 0.17));
      for (var gx = 0; gx < GRID; gx++) {
        var k = gy * GRID + gx, av = cells.a[k];
        if (av < ACUT) continue;
        /* the cut-out's own antialiased rim, dithered into a soft outline */
        var edge = Math.min(1, (av - ACUT) / (AFEATHER - ACUT));
        if (edge < 1 && Math.random() > edge) continue;
        if (cut < 1 && Math.random() > cut) continue;

        var p = {
          hx: ox + gx * pitch + pitch / 2, hy: oy + gy * pitch + pitch / 2,
          x: 0, y: 0, vx: 0, vy: 0,
          l: cells.l[k], pitch: pitch, edge: 0.55 + 0.45 * Math.min(edge, cut),
          tier: 0, r: 1, al: 1,
          ph: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 0.6
        };
        style(p);
        P.push(p);
      }
    }

    /* Where each dot falls in from: anywhere in the hero, drawn uniformly across
       the whole section rather than from a ring around the portrait. A dot's
       start bears no relation to where it lands, so the field arrives from every
       corner at once and crosses itself on the way in. Start points are stored
       outright rather than as an angle to travel along, which is what keeps each
       path a straight fall instead of a swirl.

       This is the reason the canvas is the size of the hero: a dot setting off
       from the far corner has to have a canvas to set off from, and anything
       smaller clips the cloud into the shape of its own bounding box. The canvas
       sits under the copy, so the ones crossing the headline pass behind it. */
    for (var i = 0; i < P.length; i++) {
      var q = P[i];
      q.x = q.hx; q.y = q.hy;
      q.sx = Math.random() * W;
      q.sy = Math.random() * H;
      /* a short spread of departure times, so the portrait fills in rather than
         landing all at once — but short enough that it still reads as one move */
      q.ed = Math.random() * 0.26;
    }
    group();
  }

  /* One draw list per colour tier per alpha bucket — sixteen fills for the
     whole field rather than a style change per dot. Nothing after build writes
     a dot's tier, radius or alpha; only x and y ever move. */
  function group() {
    GROUPS = [];
    for (var g = 0; g < TIERS.length * 4; g++) GROUPS.push([]);
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      var b = p.al <= 0.55 ? 0 : p.al <= 0.72 ? 1 : p.al <= 0.88 ? 2 : 3;
      GROUPS[p.tier * 4 + b].push(p);
    }
  }

  function resize() {
    /* The <img> is hidden but still laid out, so it stays the measure of both
       how big the portrait should be and where it sits, and the existing
       breakpoints keep placing it with no second source of truth. Zero width
       means the avatar itself is display:none — a phone — and there is nothing
       to build until a resize gives it a box. */
    var s = img.clientWidth | 0;
    if (!s) return false;

    var hr = hero.getBoundingClientRect(), ir = img.getBoundingClientRect();
    var w = Math.round(hr.width), h = Math.round(hr.height);
    var ox = Math.round(ir.left - hr.left), oy = Math.round(ir.top - hr.top);
    if (s === size && w === W && h === H && ox === originX && oy === originY) return false;

    size = s; W = w; H = h; originX = ox; originY = oy;
    /* Capped at 1.5 rather than 2: this canvas is the whole hero now, and at a
       2x device ratio that is four times the pixels of the box it replaced, for
       dots whose largest radius is under two css pixels. */
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /* ── input ────────────────────────────────────────────────── */

  var ptr = { x: -1e5, y: -1e5, on: false }, ripples = [], box = null;

  if (!coarse && !reduced) {
    /* Scoped to the hero, not the canvas: the canvas is pointer-events:none so
       it can never take an event of its own, and the section is the right scope
       anyway — the portrait answers you being near it, not you landing on a dot. */
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.on = true;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      ptr.on = false; ptr.x = ptr.y = -1e5;
    }, { passive: true });
    hero.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || !box) return;
      ripples.push({ x: e.clientX - box.left, y: e.clientY - box.top, t: performance.now() });
      if (ripples.length > 3) ripples.shift();
    }, { passive: true });
  }

  /* ── loop ─────────────────────────────────────────────────── */

  var running = false, raf = 0, last = 0, entryAt = 0, visible = true;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(40, now - last) / 16.67; last = now;

    box = cv.getBoundingClientRect();
    if (ptr.on) { ptr.x = ptr.cx - box.left; ptr.y = ptr.cy - box.top; }

    var eT = 1;
    if (entryAt) {
      eT = (now - entryAt) / ENTRY_MS;
      if (eT < 0) eT = 0;
      if (eT >= 1) { eT = 1; entryAt = 0; }
    }

    ctx.clearRect(0, 0, W, H);
    var t = now / 1000, i, p;

    for (i = 0; i < P.length; i++) {
      p = P[i];

      /* While it is gathering a dot is placed outright rather than sprung
         toward its cell: the spring is slack by design — tuned for a cursor
         nudging a settled field — and pulling from 380px away with it takes
         seconds and arrives soft. Placing means the offset is exactly zero at
         the end with velocity still zero, so the physics picks the field up
         mid-air with nothing left to correct. */
      if (eT < 1) {
        var eu = (eT - p.ed) / (1 - p.ed);
        if (eu < 0) eu = 0;
        /* Quartic rather than cubic: the dots have to cover most of the
           distance early, or the face is still an undifferentiated blob at the
           halfway mark and only snaps together in the last few frames. This way
           the form is readable by the middle and the rest is it settling. */
        var back = (1 - eu) * (1 - eu) * (1 - eu) * (1 - eu);
        p.x = p.hx + (p.sx - p.hx) * back;
        p.y = p.hy + (p.sy - p.hy) * back;
        continue;
      }

      if (ptr.on) {
        var dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < REPEL_R * REPEL_R) {
          var d = Math.sqrt(d2) || 0.001, f = (1 - d / REPEL_R) * REPEL_F;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
      }

      /* An expanding band, not a filled disc: a click sends out a wave passing
         through, so a dot is pushed as the front reaches it and left where it
         lies once it has gone. */
      for (var ri = 0; ri < ripples.length; ri++) {
        var rp = ripples[ri], age = (now - rp.t) / 1000, rad = age * RIP_SPEED;
        if (rad > W * 1.4) continue;
        var rx = p.x - rp.x, ry = p.y - rp.y;
        var rd = Math.sqrt(rx * rx + ry * ry) || 0.001, off = Math.abs(rd - rad);
        if (off < RIP_BAND) {
          var rf = (1 - off / RIP_BAND) * RIP_F * Math.max(0, 1 - age / 1.4);
          p.vx += (rx / rd) * rf; p.vy += (ry / rd) * rf;
        }
      }

      /* a breath under everything, so a settled field still reads as a field
         of loose specks rather than as a printed halftone */
      var wob = Math.sin(t * 0.6 * p.sp + p.ph) * 0.30;
      p.vx += (p.hx - p.x) * SPRING + wob * 0.03;
      p.vy += (p.hy - p.y) * SPRING;
      p.vx *= DAMP; p.vy *= DAMP;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }

    /* The gather fades up as one, on the context rather than per dot: a per-dot
       alpha would go into the bucket key below and turn sixteen fills into
       hundreds, for a difference nobody can see while the field is in motion. */
    ctx.globalAlpha = eT < ENTRY_FADE ? eT / ENTRY_FADE : 1;

    var buckets = [0.45, 0.65, 0.82, 1.0];
    for (var gi = 0; gi < GROUPS.length; gi++) {
      var list = GROUPS[gi], n = list.length;
      if (!n) continue;
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        p = list[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
      }
      ctx.fillStyle = 'rgba(' + TIERS[gi >> 2] + ',' + buckets[gi & 3] + ')';
      ctx.fill();
    }
  }

  function paintOnce() {
    /* the settled field, one frame, no loop — what reduced motion and an
       offscreen hero both get */
    entryAt = 0; ptr.on = false; ripples.length = 0;
    for (var i = 0; i < P.length; i++) { P[i].x = P[i].hx; P[i].y = P[i].hy; }
    running = true; last = performance.now();
    frame(last);
    cancelAnimationFrame(raf);
    running = false;
  }

  function start() {
    if (running || reduced || !visible) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() { running = false; cancelAnimationFrame(raf); }

  /* ── wiring ───────────────────────────────────────────────── */

  function init() {
    if (!sample()) return;
    cv.className = 'avatar-field';
    cv.setAttribute('aria-hidden', 'true');

    /* Mounted only once there is something to draw. Below the avatar's own
       breakpoint the portrait is display:none, resize() reports no box, and
       neither the canvas nor the class that hides the <img> should exist. */
    function mount() {
      if (cv.parentNode) return;
      /* On the hero rather than inside .hero-avatar: the wrapper is only as big
         as the portrait, and the entrance needs the whole section to fall in
         from. The wrapper keeps the <img>, still what this measures against. */
      hero.appendChild(cv);
      wrap.classList.add('has-field');
    }
    if (resize()) { mount(); build(); }

    if (reduced) {
      paintOnce();
    } else {
      /* The hold lets the headline get moving first — the portrait should not
         be the first thing that happens on the page. */
      entryAt = performance.now() + ENTRY_HOLD;

      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start(); else stop();
        }, { rootMargin: '120px' }).observe(hero);
      } else {
        start();
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });
    }

    /* Resize and theme still have to be answered under reduced motion — the
       field is static there, not absent, and a stale one would be wrong. */
    var resizeTimer;
    addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (resize()) { mount(); build(); if (reduced) paintOnce(); }
      }, 180);
    });

    new MutationObserver(function () {
      readPalette();
      for (var i = 0; i < P.length; i++) style(P[i]);
      group();
      if (reduced) paintOnce();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (img.complete && img.naturalWidth) init();
  else img.addEventListener('load', init, { once: true });
})();

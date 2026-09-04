/* Button fields — the same dot language as the portrait and the headline,
 * scaled down to a button, on every call to action on the page. Each one holds a field of specks clipped to its own pill; they are
 * invisible until the cursor is over the button, and then only the ones near it
 * light, so what you see is a small cloud gathering under the pointer and
 * parting around it.
 *
 * The label is deliberately left alone. Everything else in the hero splits into
 * glyphs that the cursor pushes, but a call to action is a thing you are aiming
 * at, and a label that scatters while you aim is the one place where this
 * effect costs more than it gives. The field goes behind the text instead.
 *
 * This replaces the magnetic pull and the lift-and-glow those buttons had, so
 * the hero answers the cursor one way rather than three.
 */
(function () {
  'use strict';

  /* Every call to action on the page: the two in the hero, "Start a Project"
     under Projects, "Contact Me" under the showcase, and the contact section's
     submit and pills. .btn-primary and .btn-ghost are unqualified deliberately —
     the page has exactly four of them and all four are CTAs, so naming their
     sections instead would just be a list to keep in sync. */
  var TARGETS = '.btn-primary, .btn-ghost, .hero-cta .cv-dropdown-toggle, ' +
                '#contact .pitch-submit, #contact .contact-pill';
  if (!window.matchMedia) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none), (pointer: coarse)').matches) return;

  var GAP = 7,         /* px between dots before jitter */
      JITTER = 2.4,    /* breaks the grid up, so it reads as a scatter */
      GLOW_R = 62,     /* a dot is only visible this near the cursor */
      REPEL_R = 46, REPEL_F = 1.4,
      SPRING = 0.10, DAMP = 0.82,   /* stiffer than the portrait: a button is
                                       small, and a slack spring here reads as
                                       the dots being stuck rather than pushed */
      MAX = 13,        /* a dot pushed further than this leaves the pill */
      BASE_A = 0.62,
      FADE_IN = 0.14, FADE_OUT = 0.08;

  function opaque(value) {
    var m = /^rgba\(\s*[0-9.]+[\s,]+[0-9.]+[\s,]+[0-9.]+[\s,/]+([0-9.]+)/i.exec(String(value || ''));
    return !m || parseFloat(m[1]) >= 0.9;
  }

  function rgb(value, fallback) {
    var v = String(value || '').trim();
    var h = /^#([0-9a-f]{6})$/i.exec(v);
    if (h) {
      var n = parseInt(h[1], 16);
      return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    }
    var m = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(v);
    if (m) return Math.round(+m[1]) + ',' + Math.round(+m[2]) + ',' + Math.round(+m[3]);
    return fallback;
  }

  function make(btn) {
    var ctx, cv = document.createElement('canvas');
    if (!cv.getContext || !(ctx = cv.getContext('2d'))) return;

    /* The label has to move above the canvas, and a positioned canvas paints
       over in-flow content whatever its z-index. Wrapping is also what keeps the
       button's flex gap: hand the flex container a single item and the space
       between the text and its icon goes with it, so the wrapper carries the
       same display, alignment and gap the button was using. */
    var inner = document.createElement('span');
    inner.className = 'btn-inner';
    /* Read the gap off the button rather than assuming one: the hero buttons
       space their label and icon at 0.5rem and the contact pills at 0.6rem, and
       the wrapper has to reproduce whichever it took over. */
    inner.style.gap = getComputedStyle(btn).columnGap || '0.5rem';
    while (btn.firstChild) inner.appendChild(btn.firstChild);

    cv.className = 'btn-field';
    cv.setAttribute('aria-hidden', 'true');
    btn.appendChild(cv);
    btn.appendChild(inner);
    /* Not 'has-field': .hero-avatar already carries that, and a shared class
       name meant this rule's position:relative and overflow:hidden landed on the
       portrait's wrapper too — same specificity, later in the sheet — which quietly
       dropped it out of its absolute placement and into the flow. */
    btn.classList.add('has-btn-field');

    var P = [], W = 0, H = 0, dpr = 1, ink = '200,255,0', inkScale = 1;

    function palette() {
      var cs = getComputedStyle(btn);
      var accent = rgb(getComputedStyle(document.documentElement)
                       .getPropertyValue('--accent'), '200,255,0');
      /* A button filled with the accent is already accent-coloured, so its dots
         take its own text colour and read as specks of the page showing through;
         everything else sits on the page ground and takes the accent. Asked of
         the computed fill rather than of a class, so it covers the hero's
         primary and the contact form's submit without naming either — and the
         opacity test matters, because an outlined pill's hover tint is the
         accent at 8% and would otherwise read as a filled one. */
      var solid = opaque(cs.backgroundColor) && rgb(cs.backgroundColor, '') === accent;
      ink = solid ? rgb(cs.color, '10,10,11') : accent;
      /* Dark specks on a solid accent fill carry far more contrast than accent
         specks on the page do, so the solid button gets less of them or it
         reads as dirt on the paint rather than as a field. */
      inkScale = solid ? 0.55 : 1;
    }

    function build() {
      var r = btn.getBoundingClientRect();
      var w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) return false;
      if (w === W && h === H && P.length) return false;
      W = w; H = h;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      P = [];
      for (var y = GAP / 2; y < H; y += GAP) {
        for (var x = GAP / 2; x < W; x += GAP) {
          var hx = x + (Math.random() - 0.5) * JITTER * 2;
          var hy = y + (Math.random() - 0.5) * JITTER * 2;
          P.push({
            hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0,
            r: 0.7 + Math.random() * 0.7,
            a: 0.55 + Math.random() * 0.45
          });
        }
      }
      return true;
    }

    var ptr = { x: 0, y: 0, cx: 0, cy: 0, on: false };
    var fade = 0, running = false, raf = 0;

    function pump() { if (!running) { running = true; raf = requestAnimationFrame(step); } }

    btn.addEventListener('pointerenter', function () {
      if (build()) palette();
      ptr.on = true;
      pump();
    });
    btn.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.on = true;
      pump();
    }, { passive: true });
    btn.addEventListener('pointerleave', function () {
      ptr.on = false;
      pump();
    }, { passive: true });

    function step() {
      running = false;
      var target = ptr.on ? 1 : 0;
      fade += (target - fade) * (target ? FADE_IN : FADE_OUT);

      var box = cv.getBoundingClientRect();
      var px = ptr.cx - box.left, py = ptr.cy - box.top;

      ctx.clearRect(0, 0, W, H);

      /* Below this the field is gone and there is nothing left to settle, so the
         loop stops rather than idling on a button nobody is pointing at. */
      if (fade < 0.004 && !ptr.on) { fade = 0; return; }

      var buckets = [[], [], [], []];
      for (var i = 0; i < P.length; i++) {
        var p = P[i];

        if (ptr.on) {
          var dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
          if (d2 < REPEL_R * REPEL_R) {
            var d = Math.sqrt(d2) || 0.001, f = (1 - d / REPEL_R) * REPEL_F;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
        }
        p.vx = (p.vx + (p.hx - p.x) * SPRING) * DAMP;
        p.vy = (p.vy + (p.hy - p.y) * SPRING) * DAMP;
        p.x += p.vx; p.y += p.vy;

        var ox = p.x - p.hx, oy = p.y - p.hy;
        if (ox > MAX) p.x = p.hx + MAX; else if (ox < -MAX) p.x = p.hx - MAX;
        if (oy > MAX) p.y = p.hy + MAX; else if (oy < -MAX) p.y = p.hy - MAX;

        /* Visible only near the cursor. A field lit evenly across the pill reads
           as a texture printed on the button; lit around the pointer it reads as
           something the pointer is disturbing. */
        var gx = p.x - px, gy = p.y - py;
        var gd = Math.sqrt(gx * gx + gy * gy);
        if (gd >= GLOW_R) continue;
        var a = fade * BASE_A * inkScale * p.a * (1 - gd / GLOW_R);
        if (a < 0.02) continue;
        buckets[a < 0.12 ? 0 : a < 0.24 ? 1 : a < 0.4 ? 2 : 3].push(p);
      }

      var levels = [0.09, 0.18, 0.32, 0.5];
      for (var b = 0; b < 4; b++) {
        var list = buckets[b];
        if (!list.length) continue;
        ctx.beginPath();
        for (var j = 0; j < list.length; j++) {
          var q = list[j];
          ctx.moveTo(q.x + q.r, q.y);
          ctx.arc(q.x, q.y, q.r, 0, 6.283);
        }
        ctx.fillStyle = 'rgba(' + ink + ',' + levels[b] + ')';
        ctx.fill();
      }

      pump();
    }

    var timer;
    addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { W = H = 0; }, 200);
    });
    new MutationObserver(palette).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-theme'] });
  }

  var btns = document.querySelectorAll(TARGETS);
  for (var i = 0; i < btns.length; i++) make(btns[i]);
})();

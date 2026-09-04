/* Hero particle text — the label and headline behave like a field of loose
 * specks. The cursor pushes each glyph away, a spring pulls it home, and a
 * glyph it shoves hard enough warms to the accent until it settles.
 *
 * Cursor handling follows the drifting fields on mdsprosolutions.com: the
 * listener sits on the section, not on the glyphs. Text is a few hundred thin
 * slivers, so a per-glyph :hover would mean the effect answers you managing to
 * land on a stem rather than you bringing the cursor near the words.
 *
 * Nothing is built for coarse pointers (there is no cursor to answer, and the
 * spans would cost layout for an effect that can never fire) or under
 * prefers-reduced-motion.
 */
(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  if (!hero || !window.matchMedia) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none), (pointer: coarse)').matches) return;

  var SPRING = 0.055,  /* pull back toward the glyph's home position */
      DAMP = 0.86,     /* < 1, so the return overshoots once and settles */
      HOT = 2.5,       /* displacement at which a glyph counts as energised */
      REST = 0.06;     /* below this a glyph is parked and stops being written */

  /* What gets split, and how hard the cursor pushes it. Display type and body
     copy want different numbers for the same feel: the paragraph's line is a
     fifth the height of a headline's, so the headline's reach would swallow
     three lines of it at once and its throw would move a letter clean past its
     neighbours. Radius roughly tracks the type size; max stays under a
     character width so the words never come apart.

     `sway` scales the sideways half of the push. At display size a letter
     thrown sideways reads as play; in a paragraph it opens a gap mid-word and
     reads as broken text, so the body copy keeps almost none of it and the
     cursor passes through as a vertical wave instead.

     `clip` marks the lines whose text is painted through background-clip on an
     ancestor, which is the gradient the headline carries and the only place
     the glyphs have to take that paint over themselves. */
  var TARGETS = [
    { sel: '.hero-label',         radius: 105, force: 1.10, max: 10, sway: 0.60, clip: false },
    { sel: '.hero h1 .hero-line', radius: 132, force: 1.90, max: 32, sway: 1.00, clip: true },
    { sel: '.hero-sub',           radius: 82,  force: 1.00, max: 9,  sway: 0.20, clip: false }
  ];

  /* Each line is its own coordinate space. The hero's entrance animations
     translate .hero-line and .hero-label, and a glyph inside one is carried by
     the same transform — so measuring a glyph against its own line cancels the
     transform out and stays true while the entrance is still playing. */
  var lines = [];

  function split(el, tune) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], node;
    while ((node = walker.nextNode())) nodes.push(node);
    if (!nodes.length) return;

    var glyphs = [];
    for (var n = 0; n < nodes.length; n++) {
      var textNode = nodes[n], text = textNode.nodeValue;
      if (!text || !text.trim()) continue;

      var frag = document.createDocumentFragment();
      var pieces = text.split(/(\s+)/);
      for (var p = 0; p < pieces.length; p++) {
        var piece = pieces[p];
        if (!piece) continue;
        /* Whitespace stays a plain text node so word spacing and wrapping are
           the browser's job, exactly as before the split. */
        if (/^\s+$/.test(piece)) { frag.appendChild(document.createTextNode(piece)); continue; }

        /* Glyph spans are inline-block so a transform applies to them at all,
           and the browser may then break a line between any two of them. The
           word wrapper is what stops the headline hyphenating mid-word. */
        var word = document.createElement('span');
        word.className = 'pw';
        for (var c = 0; c < piece.length; c++) {
          var g = document.createElement('span');
          g.className = 'pg';
          g.textContent = piece.charAt(c);
          word.appendChild(g);
          glyphs.push({
            el: g,
            bx: 0, by: 0,
            ox: 0, oy: 0, vx: 0, vy: 0,
            /* a little per-glyph variance, so the line reads as grains being
               scattered rather than one rubber sheet being pressed */
            mass: 0.72 + Math.random() * 0.56,
            spin: (Math.random() - 0.5) * 2,
            hot: false, moved: false
          });
        }
        frag.appendChild(word);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }

    if (!glyphs.length) return;
    /* tells the stylesheet the line's text has moved into the spans, so the
       line can drop the clipped gradient the spans now carry themselves */
    if (tune.clip) el.classList.add('is-split');
    lines.push({ el: el, glyphs: glyphs, tune: tune });
  }

  for (var t = 0; t < TARGETS.length; t++) {
    var found = hero.querySelectorAll(TARGETS[t].sel);
    for (var f = 0; f < found.length; f++) split(found[f], TARGETS[t]);
  }
  if (!lines.length) return;

  function measure() {
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], lr = line.el.getBoundingClientRect(), gs = line.glyphs;
      for (var j = 0; j < gs.length; j++) {
        var g = gs[j];
        /* measured at rest: any live offset is cleared first, or it would be
           baked into the home position and the glyph would never come back */
        if (g.moved) { g.el.style.transform = ''; g.moved = false; }
        var r = g.el.getBoundingClientRect();
        g.bx = r.left - lr.left + r.width / 2;
        g.by = r.top - lr.top + r.height / 2;
        /* Re-aim the gradient each glyph now carries: sized to the whole line
           and pulled up by the glyph's own depth into it, so the fade reads
           across the headline exactly as it did when the line painted it. */
        if (line.tune.clip) {
          g.el.style.backgroundSize = '100% ' + Math.round(lr.height) + 'px';
          g.el.style.backgroundPositionY = -Math.round(r.top - lr.top) + 'px';
        }
      }
    }
  }

  /* The headline arrives under a translateY reveal that h1's overflow:hidden
     masks. Going live before that lands would let scattered glyphs be clipped
     against the mask edge, so the field waits for the reveal and lifts the clip
     as it starts. The timer is the fallback for a tab that was hidden while the
     animations ran and so never fired animationend. */
  var live = false;
  var h1 = hero.querySelector('h1');

  function start() {
    if (live) return;
    live = true;
    if (h1) h1.classList.add('pg-open');
    measure();
  }

  var pending = lines.length;
  hero.addEventListener('animationend', function (e) {
    /* matched against the split elements themselves rather than a class list,
       so adding a target to TARGETS cannot silently leave this counter short
       and fall through to the timeout */
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].el === e.target) { if (--pending <= 0) start(); return; }
    }
  });
  setTimeout(start, 2400);

  var resizeTimer;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (live) measure(); }, 160);
  });

  /* Viewport coordinates only — converting to line space needs each line's box,
     and reading that here would force layout on every pointer event. The step
     below already reads those boxes once a frame, before it writes anything. */
  var ptr = { x: 0, y: 0, on: false };
  var running = false;

  function pump() {
    if (!running) { running = true; requestAnimationFrame(step); }
  }

  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    if (live) pump();
  }, { passive: true });

  hero.addEventListener('pointerleave', function () {
    ptr.on = false;
    /* the loop keeps running until the springs have settled, rather than
       stopping the moment the cursor goes, so the glyphs return rather than
       freezing wherever they were pushed to */
    if (live) pump();
  }, { passive: true });

  function step() {
    running = false;
    var awake = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], gs = line.glyphs;
      var radius = line.tune.radius, force = line.tune.force,
          max = line.tune.max, sway = line.tune.sway;
      var lr = line.el.getBoundingClientRect();
      var px = ptr.x - lr.left, py = ptr.y - lr.top;

      for (var j = 0; j < gs.length; j++) {
        var g = gs[j];

        if (ptr.on) {
          var dx = g.bx + g.ox - px, dy = g.by + g.oy - py;
          var d2 = dx * dx + dy * dy;
          if (d2 < radius * radius) {
            var d = Math.sqrt(d2) || 0.001;
            var f = (1 - d / radius) * force * g.mass;
            g.vx += (dx / d) * f * sway;
            g.vy += (dy / d) * f;
          }
        }

        g.vx = (g.vx - g.ox * SPRING) * DAMP;
        g.vy = (g.vy - g.oy * SPRING) * DAMP;
        g.ox += g.vx;
        g.oy += g.vy;

        var maxX = max * sway;
        if (g.ox > maxX) g.ox = maxX; else if (g.ox < -maxX) g.ox = -maxX;
        if (g.oy > max) g.oy = max; else if (g.oy < -max) g.oy = -max;

        var mag = Math.abs(g.ox) + Math.abs(g.oy);
        var still = mag < REST && Math.abs(g.vx) + Math.abs(g.vy) < REST;

        if (still) {
          g.ox = g.oy = g.vx = g.vy = 0;
          if (g.moved) { g.el.style.transform = ''; g.moved = false; }
        } else {
          awake = true;
          /* tilt read off the displacement, so a glyph tumbles as it is thrown
             and rights itself on the way home */
          var rot = g.ox * 0.16 * g.spin;
          if (rot > 22) rot = 22; else if (rot < -22) rot = -22;
          /* translate(), not translate3d(): the 3D form promotes each glyph to
             its own compositor layer, which is both wasteful at this count and
             what made the glyphs rasterise wrong. */
          g.el.style.transform = 'translate(' + g.ox.toFixed(2) + 'px,' +
                                 g.oy.toFixed(2) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
          g.moved = true;
        }

        var hot = mag > HOT;
        if (hot !== g.hot) { g.hot = hot; g.el.classList.toggle('is-hot', hot); }
      }
    }

    if (ptr.on || awake) pump();
  }
})();

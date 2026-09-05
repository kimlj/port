/* Hero portrait — the headshot drawn as source code.
 *
 * Every cell of a monospace grid holds one character of real JavaScript, lit to
 * the brightness of the photograph behind it. Up close it is code you can read;
 * at arm's length it is a face. The text is this file: the portrait is drawn out
 * of the program that draws it, fetched at runtime rather than pasted in, so it
 * is never a stale copy of itself.
 *
 * The two channels do the same job they did when this was a field of dots. Alpha
 * decides whether a cell exists at all — profile.webp is a cut-out, so its alpha
 * IS the silhouette and the text ends on the subject's own outline instead of in
 * a rectangle. Luminance only sets how brightly each character burns, over a
 * floor, because near-black hair and a navy suit would otherwise drop out and
 * leave a face floating in the dark.
 *
 * Tone is carried by WHICH character sits in a cell, not only by its colour, and
 * that is the whole difference between this reading as a face and reading as a
 * wall of text. A dot was a mark whose size and alpha were mine to set; a glyph
 * arrives with its own ink, and a '.' next to an 'M' at the same tone differ more
 * in weight than two adjacent tones do — so left to fall in source order the
 * character noise drowns the image it is supposed to carry. Every glyph is
 * therefore measured once, the stream is bucketed by that measurement, and each
 * cell draws the next character whose own density matches the tone it needs.
 * The text stays real code; it is only reordered within the stream.
 *
 * Cost is kept off the frame loop by rendering the settled portrait once into an
 * offscreen canvas: several thousand fillText calls is far too much to repeat
 * sixty times a second, but blitting the result and re-typing only the couple of
 * hundred cells under the cursor is nothing.
 */
(function () {
  'use strict';

  var wrap = document.querySelector('.hero-avatar');
  if (!wrap) return;
  var img = wrap.querySelector('img');
  if (!img || !img.getAttribute('src')) return;

  var cv = document.createElement('canvas');
  var ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;

  var hero = wrap.closest('.hero') || wrap.parentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches;

  var SIZE_PX = 6,      /* the type size, and with it the whole grid: rows are
                           what a face needs, and rows cost font size. 6px gives
                           ~80 rows at the portrait's size; 5px was measurably
                           worse, the glyphs being too small to carry their ink */
      LINE = 6,
      ACUT = 0.34,      /* alpha below this is background, not subject */
      AFEATHER = 0.86,  /* between ACUT and this the edge is dithered soft */
      FLOOR = 0.10,     /* dimmest a lit character may burn */
      GAMMA = 0.85,     /* lifts the mid-tones, where a face's modelling lives */
      TIERS = 8,
      BUCKETS = 8,      /* density classes the character stream is sorted into */
      HOT_R = 84,       /* the cursor disturbs the code within this radius */
      CARET_CPS = 95,   /* cells a second the writing caret advances */
      TRAIL = 16,       /* cells behind it still cooling from being typed */
      PUSH_R = 82,      /* the cursor moves characters within this radius */
      PUSH_F = 2.9,     /* strong enough that the innermost ones clear the well */
      SPRING = 0.055,   /* identical to hero-particles.js: the same hand moves */
      DAMP = 0.86,      /* < 1, so the return overshoots once and settles */
      MAX_OFF = 62,     /* furthest a character is carried from its own cell */
      WELL_R = 48,      /* the clearing the push opens, and the code's window */
      WELL_FADE = 14,   /* characters dissolve across this band at its lip */
      CODE_PX = 9,      /* type size in the well — big enough to actually read */
      CODE_LH = 12,
      CODE_ROWS = 5,    /* lines of source shown, the middle one being the cell's */
      CODE_FADE = 0.16,
      /* Slack around the portrait so a character pushed off the edge is still
         drawn. Without it the field was sliced flat at the border and the push
         read as characters being deleted rather than moved. */
      PAD = 118,
      SCRAMBLE = '{}()[]<>/\\|=+-*;:.,!?&%$#@_~^abcdefghijklmnopqrstuvwxyz0123456789',
      ENTRY_MS = 1500, ENTRY_HOLD = 700, ENTRY_BAND = 9;

  var FALLBACK = 'function build(){var cells=[];for(var y=0;y<rows;y++){' +
    'for(var x=0;x<cols;x++){var a=alpha[y*cols+x];if(a<ACUT)continue;' +
    'cells.push({x:x,y:y,ch:stream.charAt(i++%stream.length),ink:lum});}}' +
    'return cells;}var ctx=canvas.getContext("2d");ctx.font=SIZE+"px mono";';

  /* ── the character stream ───────────────────────────────────── */

  var stream = FALLBACK;
  var srcLines = [];     /* the source as written, for the lens to show */
  var streamLine = null; /* which of those lines each stream character came from */

  function ingest(src) {
    /* Comments out. The prose in this file reads as prose, and a portrait made
       of sentences is a portrait made of the wrong thing — what should show
       through is syntax. Line structure is kept rather than collapsed away with
       the whitespace, because the lens shows code as written and needs it. */
    var stripped = src.replace(/\/\*[\s\S]*?\*\//g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    var raw = stripped.split('\n'), lines = [];
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i].replace(/\t/g, '  ').replace(/\s+$/, '');
      if (line.trim()) lines.push(line);
    }
    if (lines.length < 12) return;

    /* The stream is that same text with its whitespace squeezed out, built here
       rather than separately so every character can record the line it came
       from. That map is what lets the lens magnify a cell into the actual code
       the cell was drawn from, rather than an unrelated snippet. */
    var text = '', owner = [];
    for (var l = 0; l < lines.length; l++) {
      var body = lines[l].trim();
      for (var c = 0; c < body.length; c++) {
        var ch = body.charAt(c);
        if (ch === ' ' && text.charAt(text.length - 1) === ' ') continue;
        text += ch;
        owner.push(l);
      }
      if (text.charAt(text.length - 1) !== ' ') { text += ' '; owner.push(l); }
    }
    if (text.length < 400) return;

    stream = text;
    srcLines = lines;
    streamLine = new Int32Array(owner);
  }

  /* ── sampling ───────────────────────────────────────────────── */

  var cols = 0, rows = 0, cw = 0, size = 0;
  var cells = [], grid = null, at = {};

  var fontStack = 'monospace', gridFont = '6px monospace';

  function metrics() {
    fontStack = (getComputedStyle(document.documentElement)
                   .getPropertyValue('--mono') || 'monospace').trim();
    gridFont = SIZE_PX + 'px ' + fontStack;
    ctx.font = gridFont;
    cw = ctx.measureText('M').width || SIZE_PX * 0.6;
  }

  function sample() {
    var t = document.createElement('canvas');
    t.width = cols; t.height = rows;
    var tc = t.getContext('2d', { willReadFrequently: true });
    /* Drawn straight into a grid that is wider than it is tall, which squashes
       the square source horizontally by exactly the amount the tall character
       cell stretches it back out. The face comes through undistorted. */
    tc.drawImage(img, 0, 0, cols, rows);
    try {
      grid = tc.getImageData(0, 0, cols, rows).data;
    } catch (e) {
      return false;   /* tainted canvas: leave the plain <img> in place */
    }
    return true;
  }

  /* ── tone ───────────────────────────────────────────────────── */

  var dark = true, tint = [], pageColor = '#0a0a0b';

  function hexRgb(v, fb) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim());
    if (!m) return fb;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  function palette() {
    var cs = getComputedStyle(document.documentElement);
    dark = document.documentElement.getAttribute('data-theme') !== 'light';
    var accent = hexRgb(cs.getPropertyValue('--accent'), dark ? [200, 255, 0] : [8, 145, 178]);
    var page = hexRgb(cs.getPropertyValue('--bg'), dark ? [10, 10, 11] : [248, 248, 246]);
    pageColor = 'rgb(' + page[0] + ',' + page[1] + ',' + page[2] + ')';
    var lift = dark ? [255, 255, 255] : [0, 0, 0];
    tint = [];
    for (var i = 0; i < TIERS; i++) {
      /* The tone a tier stands for is the MIDDLE of the band it covers, not its
         top: i/(TIERS-1) hands the top of each band to every tier, which walks
         the whole ramp upward and drops the mid-tones into the white lift —
         the face blows out and its modelling goes with it. */
      var u = (i + 0.5) / TIERS;                   /* 0 dimmest, 1 brightest */
      /* The dimmest tone starts a quarter of the way to the accent rather than
         at the page colour: ending the ramp on the background paints the darkest
         characters in the background's own colour, which spends a whole tone on
         glyphs nobody can see and takes the shadow detail with it. */
      var c = mix(page, accent, 0.26 + 0.74 * Math.min(1, u * 1.30));
      /* Only the top of the range lifts toward white, and not all the way: the
         accent is the portrait's colour, and washing its highlights out to grey
         costs more than the extra contrast buys. */
      if (u > 0.68) c = mix(c, lift, (u - 0.68) / 0.32 * 0.5);
      tint.push('rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
    }
  }

  /* ── glyph density ──────────────────────────────────────────── */

  var lanes = null;   /* stream positions, grouped by how much ink they lay down */
  var dense = SCRAMBLE;   /* the heaviest glyphs, for the cursor and the decode
                             wipe; the literal stands in until they are measured */

  /* Measured, not assumed: coverage depends on the face, its hinting and the
     size it is rasterised at, and a table written by eye would be wrong for any
     font but the one it was written against. */
  function measureGlyphs() {
    var seen = {}, chars = [];
    for (var i = 0; i < stream.length; i++) {
      var ch = stream.charAt(i);
      if (!seen[ch]) { seen[ch] = 1; chars.push(ch); }
    }

    var t = document.createElement('canvas');
    var w = Math.max(2, Math.ceil(cw) + 2), h = LINE + 2;
    t.width = w; t.height = h;
    var tc = t.getContext('2d', { willReadFrequently: true });
    tc.font = ctx.font;
    tc.textBaseline = 'top';
    tc.fillStyle = '#fff';

    var cov = {}, max = 0;
    for (var c = 0; c < chars.length; c++) {
      tc.clearRect(0, 0, w, h);
      tc.fillText(chars[c], 1, 1);
      var d = tc.getImageData(0, 0, w, h).data, sum = 0;
      for (var p = 3; p < d.length; p += 4) sum += d[p];
      var v = sum / (255 * w * h);
      cov[chars[c]] = v;
      if (v > max) max = v;
    }
    if (!max) return false;

    lanes = [];
    for (var b = 0; b < BUCKETS; b++) lanes.push([]);
    for (var k = 0; k < stream.length; k++) {
      var u = (cov[stream.charAt(k)] || 0) / max;
      lanes[Math.min(BUCKETS - 1, (u * BUCKETS) | 0)].push(k);
    }

    /* the top two lanes, deduplicated — what the cursor and the wipe type with,
       so a disturbed cell always reads brighter than the code it replaced */
    var hot = {}, out = '';
    for (var g = BUCKETS - 1; g >= BUCKETS - 2; g--) {
      for (var m = 0; m < lanes[g].length; m++) {
        var hc = stream.charAt(lanes[g][m]);
        if (!hot[hc]) { hot[hc] = 1; out += hc; }
      }
    }
    dense = out || SCRAMBLE;
    return true;
  }

  /* Walks outward from the wanted density to the nearest lane that has anything
     in it, so a stream missing a whole weight class degrades to the closest one
     rather than leaving a hole in the portrait. */
  var lanePtr = [];
  var pickedAt = 0;   /* where in the stream the last pick() came from */

  function pick(ink) {
    pickedAt = 0;
    if (!lanes) return stream.charAt(0);
    var want = Math.min(BUCKETS - 1, (ink * BUCKETS) | 0);
    for (var step = 0; step < BUCKETS; step++) {
      for (var side = 0; side < 2; side++) {
        var b = side ? want + step : want - step;
        if (b < 0 || b >= BUCKETS || !lanes[b].length) continue;
        var n = lanePtr[b] || 0;
        lanePtr[b] = n + 1;
        pickedAt = lanes[b][n % lanes[b].length];
        return stream.charAt(pickedAt);
      }
    }
    return stream.charAt(0);
  }

  /* ── the grid ───────────────────────────────────────────────── */

  function build() {
    cells = [];
    lanePtr = [];
    /* Sparse index from grid cell to the character in it, so the lens can ask
       "is there a glyph here" in one lookup rather than scanning five thousand
       cells for the nearest one. Sparse because most of the grid is background:
       the portrait is a cut-out, and the cells that exist are the subject. */
    at = {};
    for (var y = 0; y < rows; y++) {
      /* The subject runs off the bottom of its own frame, so without this the
         text would stop on a ruled line and read as a cropped screenshot. */
      var cut = Math.min(1, (rows - y) / (rows * 0.14));
      for (var x = 0; x < cols; x++) {
        var o = (y * cols + x) * 4;
        var av = grid[o + 3] / 255;
        if (av < ACUT) continue;
        var edge = Math.min(1, (av - ACUT) / (AFEATHER - ACUT));
        if (edge < 1 && Math.random() > edge) continue;
        if (cut < 1 && Math.random() > cut) continue;

        var lum = (grid[o] * 0.299 + grid[o + 1] * 0.587 + grid[o + 2] * 0.114) / 255;
        var ink = FLOOR + (1 - FLOOR) * Math.pow(dark ? lum : 1 - lum, GAMMA);
        /* pick() before the literal, not inside it: it reports where in the
           stream it took the character from through pickedAt, and that is what
           lets the lens magnify this cell back into its own source line. */
        var ch = pick(ink);
        at[y * cols + x] = cells.length;
        cells.push({
          x: x * cw, y: y * LINE,
          /* the cell's centre, which is what the cursor measures against —
             precomputed because it is read for every awake cell every frame */
          hx: x * cw + cw * 0.5, hy: y * LINE + LINE * 0.5,
          ch: ch,
          si: pickedAt,
          row: y,
          tier: Math.min(TIERS - 1, Math.floor(ink * TIERS)),
          /* displacement and velocity, per character, exactly as the hero
             headline carries them; mass varies so the field does not travel as
             one sheet */
          ox: 0, oy: 0, vx: 0, vy: 0,
          m: 0.88 + Math.random() * 0.3
        });
      }
    }
  }

  /* ── the cache ──────────────────────────────────────────────── */

  var off = document.createElement('canvas'), octx = null, dpr = 1;

  function paintCache() {
    octx = off.getContext('2d');
    off.width = Math.round(size * dpr);
    off.height = Math.round(size * dpr);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, size, size);
    octx.font = gridFont;
    octx.textBaseline = 'top';

    /* One pass per tone rather than a fillStyle write per character: the whole
       portrait costs six state changes instead of several thousand. */
    for (var t = 0; t < TIERS; t++) {
      octx.fillStyle = tint[t];
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].tier === t) octx.fillText(cells[i].ch, cells[i].x, cells[i].y);
      }
    }
  }

  function blit() {
    /* cleared over the whole canvas, which now extends PAD beyond the portrait
       on every side; the drawing origin is still the portrait's top-left */
    ctx.clearRect(-PAD, -PAD, size + PAD * 2, size + PAD * 2);
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, size, size);
  }

  /* ── input ──────────────────────────────────────────────────── */

  var ptr = { cx: 0, cy: 0, on: false };

  if (!coarse && !reduced) {
    /* Listened for on the hero, not the canvas: the canvas is pointer-events
       none, and the portrait should answer you being near it rather than you
       managing to land on a single character. */
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.on = true;
      pump();
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      ptr.on = false; pump();
    }, { passive: true });
  }

  /* ── the frame ──────────────────────────────────────────────── */

  var running = false, entryAt = 0, visible = true, ready = false;
  var caret = 0, lastNow = 0;

  function pump() {
    if (!running && ready && visible) { running = true; requestAnimationFrame(frame); }
  }

  function frame(now) {
    running = false;
    if (!ready) return;

    if (entryAt) {
      var eT = (now - entryAt) / ENTRY_MS;
      if (eT < 0) eT = 0;
      if (eT >= 1) { entryAt = 0; lastNow = now; blit(); pump(); return; }

      /* A decode wipe. Everything above the wave is already itself and comes
         straight off the cache; only a band around the wave is still resolving,
         and it is the only part actually re-typed, which is what keeps the
         entrance as cheap as a steady frame. */
      var wave = eT * (rows + ENTRY_BAND);
      var solid = Math.max(0, (wave - ENTRY_BAND) * LINE);
      ctx.clearRect(0, 0, size, size);
      if (solid > 0) {
        ctx.drawImage(off, 0, 0, off.width, Math.round(solid * dpr), 0, 0, size, solid);
      }
      ctx.textBaseline = 'top';
      ctx.fillStyle = tint[TIERS - 2];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.row < wave - ENTRY_BAND || c.row > wave) continue;
        ctx.fillText(dense.charAt((Math.random() * dense.length) | 0), c.x, c.y);
      }
      pump();
      return;
    }

    blit();
    ctx.textBaseline = 'top';

    if (!reduced) writeCaret(now);

    /* The well opens and closes rather than snapping, and the loop keeps
       running while characters are still on their way home, so the field is
       never left frozen mid-push. */
    var box = cv.getBoundingClientRect();
    var px = ptr.cx - box.left - PAD, py = ptr.cy - box.top - PAD;
    /* Open only over the portrait's own ink. Reading the cell here rather than
       inside drawWell means the same lookup decides both whether the well is
       open and what it is showing, so it can never open over nothing. */
    var hit = ptr.on ? cellUnder(px, py) : null;
    lens += ((hit ? 1 : 0) - lens) * CODE_FADE;
    if (lens < 0.01) { lens = 0; lensLine = -1; }

    var moving = disturb(px, py, !!hit);
    if (lens > 0) drawWell(px, py, hit);

    /* Ambient typing means there is always another frame owed, so the loop no
       longer stops when the cursor leaves — only when the portrait is offscreen,
       the tab is hidden, or motion is turned down. */
    if (!reduced || lens > 0 || moving) pump();  }

  /* ── the writing caret ──────────────────────────────────────────
     Cells were built row by row, so their index order is reading order and
     walking it is a caret moving through the source the way one moves through
     an editor. Nothing is rewritten: the cache stays canonical and the trail is
     drawn over it, so what you see is each character brightening as it is passed
     and cooling behind — the page typing itself out, rather than a portrait
     endlessly reshuffling, which at this cell count would read as static. */
  function writeCaret(now) {
    if (!cells.length) return;
    var dt = lastNow ? Math.min(120, now - lastNow) : 16;
    lastNow = now;
    caret = (caret + CARET_CPS * dt / 1000) % cells.length;

    var head = caret | 0;
    for (var k = 0; k < TRAIL; k++) {
      var idx = head - k;
      if (idx < 0) idx += cells.length;
      var c = cells[idx];
      /* A displaced character is drawn by the field, at its displaced position.
         Painting it here as well would leave a copy of it sitting in the cell
         it has been pushed out of. */
      if (c.ox || c.oy) continue;
      /* the trail cools back toward the tone the cell already holds, so the
         caret leaves no mark once it has gone */
      var heat = 1 - k / TRAIL;
      var t = c.tier + Math.round(heat * (TIERS - 1 - c.tier));
      if (t === c.tier) continue;
      ctx.fillStyle = tint[t];
      ctx.clearRect(c.x, c.y, cw, LINE);
      ctx.fillText(c.ch, c.x, c.y);
    }

    /* the caret itself: a block, the way a terminal draws one */
    var h = cells[head];
    ctx.fillStyle = tint[TIERS - 1];
    ctx.fillRect(h.x, h.y + 1, Math.max(1, cw - 0.5), LINE - 2);
  }

  /* ── the field ──────────────────────────────────────────────────
     The cursor pushes the characters aside, and they spring back when it
     leaves. This is the same motion the headline has — the constants are
     hero-particles.js's own, so the two answer the pointer in one hand — but
     applied per character to a canvas rather than to spans, because there are
     several thousand of these and each one is a glyph in a cached bitmap
     rather than an element with a transform.

     Only the characters the cursor can actually reach are simulated. That is
     not an approximation: a glyph outside the radius takes zero force and is
     already at rest, so computing it changes nothing. What it saves is not the
     arithmetic but the redraw — the settled portrait stays a single blit, and
     only the disturbed neighbourhood is re-typed.

     A character is enlisted when the cursor comes near it and retires when it
     has come to rest, so the work is bounded by the pointer rather than by the
     size of the portrait. */

  var awake = [], isAwake = null;
  /* index, alpha, index, alpha … — flat because it is rebuilt every frame */
  var fading = [];
  var byTier = [];
  for (var t0 = 0; t0 < TIERS; t0++) byTier.push([]);

  function disturb(px, py, on) {
    if (!cells.length) return false;
    if (!isAwake || isAwake.length !== cells.length) {
      isAwake = new Uint8Array(cells.length);
      awake.length = 0;
    }

    /* enlist everything the cursor can reach, walking the grid rather than the
       cell list so the cost is the size of the neighbourhood, not the portrait */
    if (on) {
      var gx0 = Math.max(0, ((px - PUSH_R) / cw) | 0),
          gx1 = Math.min(cols - 1, ((px + PUSH_R) / cw) | 0),
          gy0 = Math.max(0, ((py - PUSH_R) / LINE) | 0),
          gy1 = Math.min(rows - 1, ((py + PUSH_R) / LINE) | 0);
      for (var gy = gy0; gy <= gy1; gy++) {
        var rowOff = gy * cols;
        for (var gx = gx0; gx <= gx1; gx++) {
          var ci = at[rowOff + gx];
          if (ci === undefined || isAwake[ci]) continue;
          isAwake[ci] = 1;
          awake.push(ci);
        }
      }
    }
    if (!awake.length) return false;

    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    var kept = 0;

    for (var k = 0; k < awake.length; k++) {
      var i = awake[k], c = cells[i];

      if (on) {
        var dx = c.hx + c.ox - px, dy = c.hy + c.oy - py;
        var d2 = dx * dx + dy * dy;
        if (d2 < PUSH_R * PUSH_R) {
          var d = Math.sqrt(d2) || 0.001;
          var f = (1 - d / PUSH_R) * PUSH_F * c.m;
          c.vx += (dx / d) * f;
          c.vy += (dy / d) * f;
        }
      }

      c.vx = (c.vx - c.ox * SPRING) * DAMP;
      c.vy = (c.vy - c.oy * SPRING) * DAMP;
      c.ox += c.vx;
      c.oy += c.vy;

      var off2 = c.ox * c.ox + c.oy * c.oy;
      if (off2 > MAX_OFF * MAX_OFF) {
        var s = MAX_OFF / Math.sqrt(off2);
        c.ox *= s; c.oy *= s;
        c.vx *= s; c.vy *= s;
      }

      /* Every character touched this frame is repainted, the retiring ones
         included: the frame that puts a character back in its cell is the one
         that has to draw it there. */
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;

      var settled = c.ox * c.ox + c.oy * c.oy < 0.02 &&
                    c.vx * c.vx + c.vy * c.vy < 0.02;
      if (settled && !on) {
        c.ox = c.oy = c.vx = c.vy = 0;
        isAwake[i] = 0;
      } else {
        awake[kept++] = i;
      }
    }
    awake.length = kept;

    /* The clear has to cover where the characters have been carried to as well
       as the cells they came from, or the far side of a push is left smeared. */
    var x0 = Math.max(-PAD, minX - MAX_OFF - cw),
        y0 = Math.max(-PAD, minY - MAX_OFF - LINE),
        x1 = Math.min(size + PAD, maxX + MAX_OFF + cw * 2),
        y1 = Math.min(size + PAD, maxY + MAX_OFF + LINE * 2);
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);

    /* Everything inside the cleared box is re-typed, moved or not: the blit
       underneath was wiped along with the displaced characters. Bucketed by
       tone so the whole repaint costs eight fillStyle writes rather than one
       per character. */
    for (var t = 0; t < TIERS; t++) byTier[t].length = 0;
    fading.length = 0;

    var cx0 = Math.max(0, (x0 / cw) | 0), cx1 = Math.min(cols - 1, (x1 / cw) | 0),
        cy0 = Math.max(0, (y0 / LINE) | 0), cy1 = Math.min(rows - 1, (y1 / LINE) | 0);
    for (var yy = cy0; yy <= cy1; yy++) {
      var off = yy * cols;
      for (var xx = cx0; xx <= cx1; xx++) {
        var idx = at[off + xx];
        if (idx === undefined) continue;
        if (on) {
          var fc = cells[idx];
          var fx = fc.hx + fc.ox - px, fy = fc.hy + fc.oy - py;
          var fd2 = fx * fx + fy * fy;
          if (fd2 < WELL_R * WELL_R) continue;
          if (fd2 < (WELL_R + WELL_FADE) * (WELL_R + WELL_FADE)) {
            fading.push(idx);
            fading.push((Math.sqrt(fd2) - WELL_R) / WELL_FADE);
            continue;
          }
        }
        byTier[cells[idx].tier].push(idx);
      }
    }

    ctx.font = gridFont;
    ctx.textBaseline = 'top';
    for (var tn = 0; tn < TIERS; tn++) {
      var list = byTier[tn];
      if (!list.length) continue;
      ctx.fillStyle = tint[tn];
      for (var q = 0; q < list.length; q++) {
        var cc = cells[list[q]];
        ctx.fillText(cc.ch, cc.x + cc.ox, cc.y + cc.oy);
      }
    }

    /* The lip, one character at a time because each carries its own alpha.
       There are only ever a couple of hundred of these — the band is thin. */
    for (var fi = 0; fi < fading.length; fi += 2) {
      var fcell = cells[fading[fi]];
      ctx.globalAlpha = fading[fi + 1];
      ctx.fillStyle = tint[fcell.tier];
      ctx.fillText(fcell.ch, fcell.x + fcell.ox, fcell.y + fcell.oy);
    }
    ctx.globalAlpha = 1;

    return awake.length > 0;
  }

  /* ── the well ───────────────────────────────────────────────────
     What the push opens up, it also makes room to read. The characters clear a
     disc around the cursor, and the source those characters came from is set
     inside it at a size you can actually read — the cell knows its own stream
     index, the stream knows which line each index came from, so what appears is
     genuinely the code that character is part of, indented as written.

     This replaces a magnifying glass: a rim, a bezel, a handle and a specular
     arc, drawn over the portrait. The instrument was the wrong idea twice over.
     It said the portrait was something to inspect rather than something to
     disturb, and it had to paint its own ground because it was covering code
     that was still there. Nothing needs covering now. The well is genuinely
     empty, so the source is simply set into it. */

  var lens = 0, lensLine = -1, lensX = 0, lensY = 0;

  /* What is under the pointer, or null if that is background.
     It used to be the nearest cell within 84px, which meant pointing at empty
     space beside the head still found a glyph most of a lens-width away — the
     well opened over blank canvas and showed code that was nowhere near the
     cursor. An exact lookup with a single ring of forgiveness is both correct
     and cheaper: the ring keeps it from flickering as the pointer crosses the
     gap between two characters. */
  function cellUnder(px, py) {
    if (px < 0 || py < 0) return null;
    var cx = (px / cw) | 0, cy = (py / LINE) | 0;
    if (cx >= cols || cy >= rows) return null;
    for (var r = 0; r <= 1; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (r && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          var x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          var i = at[y * cols + x];
          if (i !== undefined) return cells[i];
        }
      }
    }
    return null;
  }

  function drawWell(px, py, cell) {
    if (!srcLines.length || !streamLine) return;

    /* The well keeps its last position and line while it closes, so leaving the
       portrait fades it where it was rather than snapping it elsewhere. */
    if (cell) {
      lensLine = streamLine[cell.si] || 0;
      lensX = px; lensY = py;
    }
    if (lensLine < 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(lensX, lensY, WELL_R, 0, 6.283);
    ctx.clip();

    /* Nothing is painted here at all. The characters have moved out of this
       disc, so the canvas is transparent across it and what shows through is
       the page's own ground — which is what the code should be read against.
       A wash of the accent used to sit here and read as a grey disc laid over
       the portrait, which is the one thing the glass was removed to stop. */
    ctx.font = CODE_PX + 'px ' + fontStack;
    ctx.textBaseline = 'middle';

    var half = (CODE_ROWS - 1) / 2;
    for (var r = -half; r <= half; r++) {
      var idx = lensLine + r;
      if (idx < 0 || idx >= srcLines.length) continue;
      var y = lensY + r * CODE_LH;
      /* the cell's own line is lit; its neighbours give it context and recede */
      ctx.fillStyle = r === 0 ? tint[TIERS - 1] : tint[2];
      ctx.globalAlpha = lens * (r === 0 ? 1 : 0.5);
      ctx.fillText(srcLines[idx], lensX - WELL_R + 6, y);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = gridFont;
    ctx.textBaseline = 'top';
  }

  /* ── wiring ─────────────────────────────────────────────────── */

  function layout() {
    /* The <img> is hidden but still laid out, so it stays the measure of how big
       the portrait is and the existing breakpoints keep sizing it with no second
       source of truth. Zero width means the avatar is display:none — a phone —
       and there is nothing to build. */
    var s = img.clientWidth | 0;
    if (!s) return false;
    var d = Math.min(2, window.devicePixelRatio || 1);
    if (s === size && d === dpr && cols) return false;
    size = s; dpr = d;
    metrics();
    cols = Math.max(1, Math.floor(size / cw));
    rows = Math.max(1, Math.floor(size / LINE));
    var box = size + PAD * 2;
    cv.width = Math.round(box * dpr);
    cv.height = Math.round(box * dpr);
    cv.style.width = box + 'px';
    cv.style.height = box + 'px';
    /* pulled back by the padding so the portrait still sits exactly where the
       <img> does, while the canvas overhangs it on every side */
    cv.style.left = -PAD + 'px';
    cv.style.top = -PAD + 'px';
    /* the translate keeps every drawing coordinate portrait-relative, so
       nothing else in the file has to know the padding exists */
    ctx.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
    return true;
  }

  function recompose() {
    palette();
    measureGlyphs();
    build();
    paintCache();
    ready = true;
  }

  function init() {
    cv.className = 'avatar-field';
    cv.setAttribute('aria-hidden', 'true');

    if (!layout() || !sample()) return;
    wrap.appendChild(cv);

    /* Built here rather than written into the markup: everything above this
       point can bail — no canvas, a tainted sample, an avatar with no box — and
       in every one of those cases the plain photograph is what shows, which a
       caption about source code would be lying about. */
    var cap = document.createElement('p');
    cap.className = 'avatar-caption';
    cap.setAttribute('aria-hidden', 'true');
    cap.appendChild(document.createTextNode('Source-code portrait — typeset from '));
    var f = document.createElement('span');
    f.textContent = 'avatar-field.js';
    cap.appendChild(f);
    wrap.appendChild(cap);

    /* visibility:hidden takes the <img> out of the accessibility tree along with
       its alt text, so the portrait would otherwise have no accessible name at
       all once the field renders. The wrapper takes the name over, and says what
       the picture now is; the caption is then a visual echo of it. */
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label',
      (img.getAttribute('alt') || 'Portrait') + ', drawn as source code');

    wrap.classList.add('has-field');
    recompose();

    if (reduced) {
      blit();
    } else {
      /* the hold lets the headline get moving first — the portrait should not
         be the first thing that happens on the page */
      entryAt = performance.now() + ENTRY_HOLD;
      pump();
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible) pump();
      }, { rootMargin: '120px' }).observe(wrap);
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pump();
    });

    var timer;
    addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (layout() && sample()) { recompose(); blit(); }
      }, 180);
    });

    new MutationObserver(function () { recompose(); blit(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* Fonts first: measureText against a fallback monospace reports a different
     advance than JetBrains Mono, and the entire grid is derived from that one
     number — get it early and the portrait is built at the wrong width. */
  function go() {
    var fonts = document.fonts && document.fonts.ready
      ? document.fonts.ready : Promise.resolve();
    fonts.then(function () {
      if (img.complete && img.naturalWidth) init();
      else img.addEventListener('load', init, { once: true });
    });
  }

  var self = document.querySelector('script[src*="avatar-field"]');
  if (self && window.fetch) {
    fetch(self.getAttribute('src'), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { if (t) ingest(t); })
      .catch(function () {})
      .then(go, go);
  } else {
    go();
  }
})();

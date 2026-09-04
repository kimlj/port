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
      LENS_R = 66,      /* the reading glass the cursor carries */
      LENS_PX = 10,     /* type size inside it — big enough to actually read */
      LENS_LH = 13.5,
      LENS_ROWS = 5,    /* lines of source shown, the middle one being the cell's */
      LENS_FADE = 0.16,
      /* Slack around the portrait so the glass is a whole glass at the edges.
         Drawn inside the portrait's own box it was sliced flat wherever the
         cursor came near a border, which reads as a bug rather than as a lens.
         Sized to clear the lens and its handle at full extension. */
      PAD = 118,
      /* down and to the right, in canvas coordinates where y grows downward */
      HANDLE_ANG = Math.PI / 4,
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
          ch: ch,
          si: pickedAt,
          row: y,
          tier: Math.min(TIERS - 1, Math.floor(ink * TIERS))
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

    /* The lens opens and closes rather than snapping, and the loop keeps running
       while it is still closing so it is never left half open on screen. */
    var box = cv.getBoundingClientRect();
    var px = ptr.cx - box.left - PAD, py = ptr.cy - box.top - PAD;
    /* Open only over the portrait's own ink. Reading the cell here rather than
       inside drawLens means the same lookup decides both whether the glass is
       out and what it is showing, so it can never be open over nothing. */
    var hit = ptr.on ? cellUnder(px, py) : null;
    lens += ((hit ? 1 : 0) - lens) * LENS_FADE;
    if (lens < 0.01) { lens = 0; lensLine = -1; }
    if (lens > 0) drawLens(px, py, hit);

    /* Ambient typing means there is always another frame owed, so the loop no
       longer stops when the cursor leaves — only when the portrait is offscreen,
       the tab is hidden, or motion is turned down. */
    if (!reduced || lens > 0) pump();
  }

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

  /* ── the reading glass ──────────────────────────────────────────
     The cursor carries a lens that magnifies whatever cell is under it back into
     the source it was drawn from — the cell knows its own stream index, the
     stream knows which line each index came from, so what you read is genuinely
     the code that character is part of, indented as written.

     This replaces a scramble that re-rolled the characters near the pointer.
     That was motion for its own sake: it flickered too fast to read and said
     nothing about the picture. A portrait built out of a program should reward
     looking closer by showing you the program. */

  var lens = 0, lensLine = -1, lensX = 0, lensY = 0;

  /* What is under the pointer, or null if that is background.
     It used to be the nearest cell within 84px, which meant pointing at empty
     space beside the head still found a glyph most of a lens-width away and
     magnified it — the lens opened over blank canvas and showed code that was
     nowhere near the cursor. An exact lookup with a single ring of forgiveness
     is both correct and cheaper: the ring keeps it from flickering as the
     pointer crosses the gap between two characters. */
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

  function drawLens(px, py, cell) {
    if (!srcLines.length || !streamLine) return;

    /* The glass keeps its last position and line while it fades out, so leaving
       the portrait closes it where it was rather than snapping it elsewhere. */
    if (cell) {
      lensLine = streamLine[cell.si] || 0;
      lensX = px; lensY = py;
    }
    if (lensLine < 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(lensX, lensY, LENS_R, 0, 6.283);
    ctx.clip();

    /* A ground behind the code: the portrait underneath is dense text, and text
       over text is unreadable however it is coloured. */
    ctx.globalAlpha = lens * 0.94;
    ctx.fillStyle = pageColor;
    ctx.fill();
    /* the faintest wash of the accent, so the disc reads as tinted glass rather
       than as a hole punched through to the background */
    ctx.globalAlpha = lens * 0.05;
    ctx.fillStyle = tint[TIERS - 1];
    ctx.fill();

    ctx.globalAlpha = lens;
    ctx.font = LENS_PX + 'px ' + fontStack;
    ctx.textBaseline = 'middle';

    var half = (LENS_ROWS - 1) / 2;
    for (var r = -half; r <= half; r++) {
      var idx = lensLine + r;
      if (idx < 0 || idx >= srcLines.length) continue;
      var text = srcLines[idx];
      var y = lensY + r * LENS_LH;
      /* the cell's own line is lit; its neighbours give it context and recede */
      ctx.fillStyle = r === 0 ? tint[TIERS - 1] : tint[2];
      ctx.globalAlpha = lens * (r === 0 ? 1 : 0.55);
      ctx.fillText(text, lensX - LENS_R + 10, y);
    }

    ctx.restore();

    /* ── the instrument ──
       A rim, a bezel and a handle, so it reads as a glass being held over the
       code rather than as a circular hole cut in it. Drawn before the rim so
       the rim caps the handle cleanly.

       The handle is pinned to the lower right. It used to point away from the
       portrait's centre, on the theory that is how one would be held — but a
       handle that swings as the cursor moves reads as a spinning object rather
       than as an object being carried, and a real glass keeps its handle where
       the hand is. Fixed is what looks held. */
    var ang = HANDLE_ANG;

    ctx.globalAlpha = lens;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lensX + Math.cos(ang) * (LENS_R + 1), lensY + Math.sin(ang) * (LENS_R + 1));
    ctx.lineTo(lensX + Math.cos(ang) * (LENS_R + 30), lensY + Math.sin(ang) * (LENS_R + 30));
    ctx.strokeStyle = tint[TIERS - 3];
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = tint[TIERS - 1];
    ctx.lineWidth = 3;
    ctx.stroke();

    /* the rim: a heavy ring with a hairline bezel just inside it */
    ctx.beginPath();
    ctx.arc(lensX, lensY, LENS_R, 0, 6.283);
    ctx.strokeStyle = tint[TIERS - 1];
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.globalAlpha = lens * 0.45;
    ctx.beginPath();
    ctx.arc(lensX, lensY, LENS_R - 4, 0, 6.283);
    ctx.strokeStyle = tint[TIERS - 3];
    ctx.lineWidth = 1;
    ctx.stroke();

    /* a specular arc on the shoulder opposite the handle — the one cue that
       says "glass" rather than "ring" */
    ctx.globalAlpha = lens * 0.5;
    ctx.beginPath();
    ctx.arc(lensX, lensY, LENS_R - 9, ang + 2.5, ang + 3.7);
    ctx.strokeStyle = tint[TIERS - 1];
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1;
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

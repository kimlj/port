/* Project Visuals — animated shader layers behind project-card media.
 * Adapted from ThreeUI Community "warp-field" and "data-pixel-arc"
 * (https://github.com/MengTo/threeui), MIT License © 2026 Meng To.
 * Reworked: three.js replaced with hand-rolled perspective projection on a
 * 2D canvas (a starfield needs no scene graph), colors come from the theme
 * tokens, and all cards share ONE rAF loop that only ticks canvases currently
 * in view. Reduced motion renders a single settled frame instead of looping.
 */
(function () {
  'use strict';

  if (navigator.connection && navigator.connection.saveData) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Keyed by the .pv-N class so the choice lives next to the gradient it
     replaces, not inside this file. */
  var MODES = { 'pv-1': 'warp', 'pv-7': 'arc', 'pv-4': 'warp', 'pv-5': 'arc', 'pv-6': 'arc', 'pv-2': 'warp' };

  var items = [];

  function hexRgb(hex, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var pal = null;

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    pal = {
      dark: dark,
      accent: hexRgb(cs.getPropertyValue('--accent'), dark ? [200, 255, 0] : [8, 145, 178]),
      link: hexRgb(cs.getPropertyValue('--gradient-2'), dark ? [0, 255, 200] : [99, 102, 241])
    };
  }

  function makeItem(bgDiv, mode) {
    var host = bgDiv.parentElement;
    var canvas = document.createElement('canvas');
    canvas.className = 'pv-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    bgDiv.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var item = {
      el: host,
      canvas: canvas,
      ctx: ctx,
      mode: mode,
      visible: false,
      w: 0,
      h: 0,
      t: Math.random() * 100,
      state: null,
      init: mode === 'warp' ? initWarp : initArc,
      step: mode === 'warp' ? stepWarp : stepArc
    };
    item.init(item);
    return item;
  }

  function sizeItem(it) {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    it.w = Math.max(1, it.el.clientWidth);
    it.h = Math.max(1, it.el.clientHeight);
    it.canvas.width = Math.round(it.w * dpr);
    it.canvas.height = Math.round(it.h * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- warp: streaks flying past the camera ---- */

  function WARP_COLORS() {
    return [pal.accent.concat(), pal.link.concat(), [235, 245, 240]];
  }

  function initWarp(it) {
    var count = Math.max(36, Math.min(110, Math.round((it.w || 400) * (it.h || 320) / 4200)));
    var stars = [];
    var palette = [0, 0, 1, 2]; // accent-weighted: two lime slots per teal/white
    for (var i = 0; i < count; i++) {
      stars.push({
        ang: Math.random() * Math.PI * 2,
        rad: 20 + Math.random() * 480,
        z: -900 + Math.random() * 1040,
        len: 30 + Math.random() * 90,
        col: palette[(Math.random() * palette.length) | 0]
      });
    }
    it.state = stars;
  }

  function stepWarp(it, dt) {
    var ctx = it.ctx;
    var cx = it.w / 2;
    var cy = it.h * 0.46;
    var focal = it.h * 0.85;
    var cols = WARP_COLORS();
    var dim = pal.dark ? 1 : 0.55;
    var speed = dt * 340;

    ctx.clearRect(0, 0, it.w, it.h);
    ctx.globalCompositeOperation = pal.dark ? 'lighter' : 'source-over';

    for (var i = 0; i < it.state.length; i++) {
      var s = it.state[i];
      s.z += speed;
      if (s.z > 140) {
        s.z = -900 - Math.random() * 200;
        s.rad = 20 + Math.random() * 480;
      }
      if (s.z < 18) continue;

      var x0 = cx + Math.cos(s.ang) * s.rad / s.z * focal;
      var y0 = cy + Math.sin(s.ang) * s.rad / s.z * focal;
      var z1 = s.z + s.len;
      var x1 = cx + Math.cos(s.ang) * s.rad / z1 * focal;
      var y1 = cy + Math.sin(s.ang) * s.rad / z1 * focal;
      if (x0 < -40 || x0 > it.w + 40 || y0 < -40 || y0 > it.h + 40) continue;

      var near = Math.min(1, 300 / s.z);
      var c = cols[s.col];
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (near * 0.75 * dim).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.6, near * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- arc: pixel ridge pulsing along a curve ---- */

  function initArc(it) {
    it.state = { pixelSize: 7 };
  }

  function stepArc(it, dt) {
    var ctx = it.ctx;
    var px = it.state.pixelSize;
    it.t += dt;
    var time = it.t;
    var cols = Math.ceil(it.w / px);
    var rows = Math.ceil(it.h / px);
    var centerY = it.h * 0.42;
    var drop = it.h * 0.78;
    var thick = it.h * 0.32;
    var edge = pal.accent;
    var core = pal.link;
    var dim = pal.dark ? 0.9 : 0.45;

    ctx.clearRect(0, 0, it.w, it.h);

    for (var x = 0; x < cols; x++) {
      var xpos = x * px;
      var nx = (xpos / it.w) * 2 - 1;
      var curveY = centerY + Math.pow(Math.abs(nx), 1.8) * drop;
      // Color slides along the ridge so each card reads slightly different.
      var mixT = Math.min(1, Math.max(0, (nx + 1) / 2 + Math.sin(time * 0.35) * 0.25));
      var r = edge[0] + (core[0] - edge[0]) * mixT;
      var g = edge[1] + (core[1] - edge[1]) * mixT;
      var b = edge[2] + (core[2] - edge[2]) * mixT;

      for (var y = 0; y < rows; y++) {
        var ypos = y * px;
        var dist = Math.abs(ypos - curveY);
        var intensity = 1 - dist / thick;
        if (intensity <= 0.02) continue;
        var wave1 = Math.sin(nx * 4 - time * 1.5) * 0.12;
        var wave2 = Math.cos(ypos * 0.02 + time) * 0.1;
        intensity = Math.min(1, Math.max(0, intensity + wave1 + wave2));
        intensity *= Math.max(0, 1 - Math.pow(Math.abs(nx), 2.5));
        if (intensity <= 0.03) continue;
        ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' +
          (intensity * dim).toFixed(3) + ')';
        ctx.fillRect(xpos, ypos, px - 1.5, px - 1.5);
        if (intensity > 0.72 && pal.dark) {
          ctx.fillStyle = 'rgba(255,255,255,' + ((intensity - 0.72) * 0.9).toFixed(3) + ')';
          ctx.fillRect(xpos, ypos, px - 1.5, px - 1.5);
        }
      }
    }
  }

  document.querySelectorAll('.project-visual-bg').forEach(function (bg) {
    var classes = bg.className.split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      var mode = MODES[classes[i]];
      if (!mode) continue;
      // Cards whose visual is an actual image/video keep their media untouched.
      var host = bg.parentElement;
      if (host && host.querySelector('img, video')) continue;
      var item = makeItem(bg, mode);
      if (item) items.push(item);
      break;
    }
  });

  if (!items.length) return;

  readPalette();

  var rafPending = false;
  var lastNow = 0;

  function tick(now) {
    rafPending = false;
    var dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
    lastNow = now;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].visible) continue;
      items[i].step(items[i], dt);
    }
    if (items.some(function (it) { return it.visible; })) schedule();
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && items.some(function (it) { return it.visible; })) schedule();
  });

  var themeObs = new MutationObserver(function () {
    readPalette();
    if (reduced) items.forEach(function (it) { it.step(it, 0); });
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      items.forEach(function (it) {
        sizeItem(it);
        it.init(it);
        if (reduced) it.step(it, 0);
      });
    }, 150);
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      items.forEach(function (it) {
        if (it.el === entry.target) it.visible = entry.isIntersecting;
      });
    });
    if (items.some(function (it) { return it.visible; }) && !document.hidden && !reduced) schedule();
  }, { threshold: 0 });

  items.forEach(function (it) {
    sizeItem(it);
    io.observe(it.el);
    if (reduced) it.step(it, 0);
  });
})();

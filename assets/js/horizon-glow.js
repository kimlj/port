/* Horizon Glow — animated horizon light behind the contact section.
 * Ported from ThreeUI Community "emerald-horizon"
 * (https://github.com/MengTo/threeui), MIT License © 2026 Meng To.
 * Reworked: three.js replaced with a raw WebGL fullscreen triangle (one quad
 * needs no scene graph), colors come from the theme tokens instead of the
 * hard-coded emerald pair, and the output is alpha-composited glow rather
 * than an opaque background so it can layer over the page. Pauses offscreen,
 * on hidden tabs, and under prefers-reduced-motion (single settled frame).
 */
(function () {
  'use strict';

  var canvas = document.getElementById('horizonCanvas');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { alpha: true, antialias: false }) ||
           canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }

  // Metered connections get a plain contact section.
  if (navigator.connection && navigator.connection.saveData) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  /* Emerald pair swapped for token-driven colors; intensity also drives the
     alpha channel so the glow dissolves into the page instead of painting an
     opaque slab over it. */
  var FRAG = [
    'precision mediump float;',
    'uniform float u_time;',
    'uniform vec2 u_resolution;',
    'uniform float u_alpha;',
    'uniform vec3 u_c1;',
    'uniform vec3 u_c2;',
    'float hash(float n) { return fract(sin(n) * 1e4); }',
    'float noise(float x) {',
    '  float i = floor(x);',
    '  float f = fract(x);',
    '  float u = f * f * (3.0 - 2.0 * f);',
    '  return mix(hash(i), hash(i + 1.0), u);',
    '}',
    'void main() {',
    '  vec2 st = gl_FragCoord.xy / u_resolution.xy;',
    '  float wave1 = sin(st.x * 3.0 + u_time * 0.5) * 0.10;',
    '  float wave2 = sin(st.x * 5.0 - u_time * 0.3) * 0.05;',
    '  float intensity = smoothstep(0.78, 0.02, st.y + wave1 + wave2);',
    '  float variation = noise(st.x * 2.0 + u_time * 0.1) * 0.5 + 0.5;',
    '  intensity *= variation * 1.2;',
    '  intensity *= smoothstep(1.0, 0.55, st.y);',
    '  vec3 finalGlow = mix(u_c1, u_c2, clamp(st.x + sin(u_time * 0.2) * 0.5, 0.0, 1.0));',
    '  vec3 color = finalGlow * pow(intensity, 1.6) * 1.15;',
    '  float vignette = mix(1.0, smoothstep(1.2, 0.45, length(st - vec2(0.5, 0.0))), 0.8);',
    '  color *= vignette;',
    '  float a = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0) * u_alpha;',
    '  gl_FragColor = vec4(color * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    }
    return s;
  }

  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link failed');
  } catch (e) {
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  /* One oversized triangle covers the clip space with no degenerate edge. */
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['u_time', 'u_resolution', 'u_alpha', 'u_c1', 'u_c2'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  var pal = null;

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';

    function hexVec(name, fallback) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(cs.getPropertyValue(name) || '').trim());
      if (!m) return fallback;
      var n = parseInt(m[1], 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    pal = {
      c1: hexVec('--accent', dark ? [0.784, 1, 0] : [0.031, 0.569, 0.698]),
      c2: hexVec('--gradient-2', dark ? [0, 1, 0.784] : [0.392, 0.4, 0.945]),
      alpha: dark ? 0.5 : 0.38
    };
  }

  var width = 0;
  var height = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(tSec) {
    if (!pal) readPalette();
    gl.uniform1f(U.u_time, tSec);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(U.u_alpha, pal.alpha);
    gl.uniform3f(U.u_c1, pal.c1[0], pal.c1[1], pal.c1[2]);
    gl.uniform3f(U.u_c2, pal.c2[0], pal.c2[1], pal.c2[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var running = false;
  var visible = false;
  var rafPending = false;
  var start = performance.now();

  function tick(now) {
    rafPending = false;
    if (!running) return;
    draw((now - start) * 0.001 * 0.55);
    schedule();
  }

  function schedule() {
    if (!running || rafPending) return;
    rafPending = true;
    requestAnimationFrame(tick);
  }

  function startLoop() {
    if (reduced || document.hidden || !visible || running) return;
    running = true;
    schedule();
  }

  function stopLoop() {
    running = false;
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0] && entries[0].isIntersecting;
    if (visible) startLoop();
    else stopLoop();
  }, { threshold: 0 }).observe(canvas);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  var themeObs = new MutationObserver(function () {
    readPalette();
    if (reduced) draw(6.5);
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { resize(); if (reduced) draw(6.5); }, 150);
  });

  readPalette();
  resize();

  if (reduced) {
    draw(6.5);
  } else {
    visible = true;
    startLoop();
  }
})();

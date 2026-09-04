/* Build Activity — one idea, applied to everything in the section.
 *
 * It is a record of accumulation, so the motion is accumulation: every element
 * animates in the direction time runs. Bars grow from zero in month order. The
 * calendars fill in date order. The sparkline draws left to right. The totals
 * count up. Nothing fades, nothing slides in from a side — a fade says "this
 * arrived", and what actually happened is that it added up.
 *
 * The year bars go last, and the "×17 vs 2024" badge lands after them, which
 * makes the badge read as the conclusion of the sequence rather than a label
 * that was there all along.
 *
 * It runs once, when the section is reached. A dashboard that re-animates on
 * every scroll-past reads as a screensaver, and the figures here are a record
 * rather than a live feed.
 *
 * Nothing here builds markup. The panels are drawn by their own scripts from
 * their own data files; this waits for whatever they produced and animates it,
 * so a data file that arrives late, or not at all, costs an animation rather
 * than a section.
 */
(function () {
  'use strict';

  var section = document.getElementById('activity');
  if (!section || !window.matchMedia) return;

  tooltip();   /* wanted whether or not the section is allowed to animate */

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;   /* everything is already at its final value */

  /* The whole sequence is meant to land in about two and a half seconds. Run
     strictly one-after-another it came to six, which is long past the point
     where a reader stops watching a section fill and starts waiting for it. The
     phases overlap instead: each calendar starts while the one before it is
     still going, which keeps 2024 → 2026 readable as an order without paying
     three times for it. */
  var CELL_MS = 1.4,     /* per day */
      YEAR_LAP = 0.55,   /* how far into a year the next one starts */
      BAR_MS = 38,       /* between monthly bars */
      COUNT_MS = 1000;

  /* ── the pieces, read rather than assumed ───────────────────── */

  function find() {
    return {
      stats: section.querySelectorAll('.ai-stat-value'),
      hero: section.querySelector('.ai-hero-num'),
      months: section.querySelectorAll('.ai-month-bar'),
      spark: section.querySelectorAll('.ai-spark-col'),
      years: section.querySelectorAll('.ai-yearbar-fill'),
      yearVals: section.querySelectorAll('.ai-yearbar-value'),
      grids: section.querySelectorAll('.ai-grid'),
      badge: document.getElementById('aiActivityJump')
    };
  }

  /* ── counting ───────────────────────────────────────────────────
     The figure is re-derived from the text already on screen, so the shape a
     panel chose — 43.7M, 15,382, 94% — is preserved and only the number inside
     it moves. Parsing it back out is what lets this animate totals it was never
     told about. */

  function countUp(el, delay) {
    var run = armCount(el);
    if (run) run(delay);
  }

  /* Arming and releasing are separate because the panels paint their final
     values as soon as their data lands. Zeroing at release meant a bar was
     drawn full, snapped to nothing, then grew back — the same figure arriving
     twice. Everything is zeroed the moment it exists; the observer only lets
     it go. */
  function armCount(el) {
    var raw = el.textContent;
    var m = /-?[\d,]*\.?\d+/.exec(raw);
    if (!m) return;
    var target = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;

    var before = raw.slice(0, m.index);
    var after = raw.slice(m.index + m[0].length);
    var decimals = (m[0].split('.')[1] || '').length;
    var grouped = m[0].indexOf(',') !== -1;
    /* the element may carry markup after the number — the % in "94%" is a span */
    var tail = el.querySelector('span');
    var tailHTML = tail ? tail.outerHTML : '';
    if (tailHTML) after = after.replace(tail.textContent, '');

    function write(v) {
      var s = decimals ? v.toFixed(decimals)
                       : String(Math.round(v));
      if (grouped && !decimals) s = Math.round(v).toLocaleString();
      el.textContent = before + s + after;
      if (tailHTML) el.insertAdjacentHTML('beforeend', tailHTML);
    }

    write(0);
    return function release(delay) {
      var start = 0;
      setTimeout(function () {
        requestAnimationFrame(function step(now) {
          if (!start) start = now;
          var t = Math.min(1, (now - start) / COUNT_MS);
          /* decelerating, so it settles rather than stops */
          write(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
          else write(target);
        });
      }, delay);
    };
  }

  /* ── growing ────────────────────────────────────────────────────
     Height is read off the inline style the builder wrote, zeroed, then given
     back on a transition — so this never has to know what the value should be,
     and a chart whose numbers change tomorrow still animates to the right place. */

  function armGrow(nodes, prop) {
    var axis = prop || 'height';
    var vals = [];
    for (var i = 0; i < nodes.length; i++) {
      vals.push(nodes[i].style[axis] || '');
      nodes[i].style.transition = 'none';
      nodes[i].style[axis] = '0';
      nodes[i].style.transformOrigin = 'bottom';
    }
    void section.offsetHeight;   /* one reflow for the whole set */

    return function release(stepMs, delay) {
      for (var j = 0; j < nodes.length; j++) {
        (function (el, val, k) {
          setTimeout(function () {
            el.style.transition = axis + ' 0.62s cubic-bezier(0.22, 1, 0.36, 1)';
            el.style[axis] = val;
          }, delay + k * stepMs);
        })(nodes[j], vals[j], j);
      }
    };
  }

  /* ── the calendars ──────────────────────────────────────────────
     The one that earns its place. Cells are laid out column by column — a week
     per column, Sunday at the top — so walking them in DOM order is walking the
     year in date order, and what you watch is the year being worked rather than
     a grid appearing. */

  function armGrid(grid) {
    var cells = grid.children, n = cells.length;
    for (var i = 0; i < n; i++) {
      cells[i].style.transition = 'none';
      cells[i].style.opacity = '0';
      cells[i].style.transform = 'scale(0.55)';
    }
    void grid.offsetHeight;

    return function release(delay) {
      for (var j = 0; j < n; j++) {
        (function (el, k) {
          setTimeout(function () {
            el.style.transition = 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = '1';
            el.style.transform = 'none';
          }, delay + k * CELL_MS);
        })(cells[j], j);
      }
    };
  }

  /* ── the sequence ───────────────────────────────────────────── */

  /* Four phases. Each is armed the moment its markup exists — zeroed, hidden,
     counted down to nothing — and released when the reader actually reaches it.
     Arming at release meant the panel painted its real figures first and then
     reset to animate them, so every number arrived twice.

     Each watches the exact element it animates, not the section or the panel
     containing it: one observer on the section fired everything while the
     reader was still at the title with the charts 600px below, and one on the
     right-hand panel still started the calendars early, because they sit 300px
     under the year bars they share it with. */

  /* Four groups, each armed the moment ITS OWN markup exists and released when
     the reader reaches it. Per-group rather than all at once because the panels
     are built by different scripts from different files: arming on the first of
     them to land left the year bars — which arrive last — painted at their real
     values and never zeroed, so they were the one chart that appeared, and then
     appeared again as it animated. */

  var groups = [
    { key: 'stats', trigger: '.ai-stats', at: function () {
        return section.querySelectorAll('.ai-stat-value'); },
      arm: function () {
        var els = section.querySelectorAll('.ai-stat-value'), r = [];
        for (var i = 0; i < els.length; i++) r.push(armCount(els[i]));
        var badge = document.getElementById('aiActivityJump');
        if (badge) {
          badge.style.transition = 'none';
          badge.style.opacity = '0';
          void badge.offsetHeight;
        }
        return function () {
          for (var i = 0; i < r.length; i++) if (r[i]) r[i](110 * i);
          if (!badge) return;
          /* the badge sits beside the range at the top of the panel, so it
             belongs to this phase by position even though it is a conclusion
             by meaning */
          setTimeout(function () {
            badge.style.transition = 'opacity 0.6s ease';
            badge.style.opacity = '1';
          }, 110 * r.length + 520);
        };
      } },

    { key: 'hours', trigger: '.ai-charts .ai-chart', at: function () {
        return section.querySelectorAll('.ai-month-bar'); },
      arm: function () {
        var hero = section.querySelector('.ai-hero-num');
        var h = hero ? armCount(hero) : null;
        var months = section.querySelectorAll('.ai-month-bar');
        var spark = section.querySelectorAll('.ai-spark-col');
        var m = months.length ? armGrow(months) : null;
        var sp = spark.length ? armGrow(spark) : null;
        return function () {
          if (h) h(100);
          if (m) m(BAR_MS, 260);
          if (sp) sp(3, 420);
        };
      } },

    { key: 'years', trigger: '#aiYearBars', at: function () {
        return section.querySelectorAll('.ai-yearbar-fill'); },
      arm: function () {
        var fills = section.querySelectorAll('.ai-yearbar-fill');
        var vals = section.querySelectorAll('.ai-yearbar-value');
        var f = armGrow(fills, 'width'), v = [];
        for (var i = 0; i < vals.length; i++) v.push(armCount(vals[i]));
        return function () {
          f(160, 120);
          for (var i = 0; i < v.length; i++) if (v[i]) v[i](120 + i * 160);
        };
      } },

    { key: 'grids', trigger: '#aiActivityYears', at: function () {
        return section.querySelectorAll('.ai-grid'); },
      arm: function () {
        var gs = section.querySelectorAll('.ai-grid'), r = [];
        for (var i = 0; i < gs.length; i++) {
          r.push({ go: armGrid(gs[i]), n: gs[i].children.length });
        }
        return function () {
          /* overlapping, so 2024 → 2026 stays readable as an order without the
             panel waiting through three full fills */
          var at = 120;
          for (var i = 0; i < r.length; i++) {
            r[i].go(at);
            at += r[i].n * CELL_MS * YEAR_LAP;
          }
        };
      } }
  ];

  /* Fires when the element is genuinely in view — a third of the way up the
     screen rather than the instant its top edge crosses the bottom — so a slow
     scroll arrives to watch it rather than to find it already finished. */
  function once(el, fn) {
    if (!el) return;
    if (!window.IntersectionObserver) { fn(); return; }
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      fn();
    }, { rootMargin: '0px 0px -30% 0px' }).observe(el);
  }

  /* ── waiting for the data ───────────────────────────────────────
     Three panels here are built from fetched JSON, so the section can be on
     screen with nothing in it yet. This waits for the grids to exist rather
     than firing on a timer and animating an empty section. */

  var done = 0;

  function sweep() {
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (g.armed || !g.at().length) continue;
      var trigger = document.querySelector(g.trigger);
      if (!trigger) continue;
      g.armed = true;
      done++;
      once(trigger, g.arm());
    }
    return done === groups.length;
  }

  function watch() {
    if (sweep()) return;
    var obs = new MutationObserver(function () {
      if (sweep()) obs.disconnect();
    });
    obs.observe(section, { childList: true, subtree: true });
    /* a panel whose data never lands has nothing to animate, and the observer
       costs a callback per section mutation until then */
    setTimeout(function () { obs.disconnect(); }, 15000);
  }

  /* ── the tooltip ────────────────────────────────────────────────
     The charts used the title attribute, which the browser renders as an
     OS-styled white box that cannot be themed — on this page it looked like a
     bug. One element for the whole section, moved and refilled rather than
     built per cell: there are over a thousand cells and none of them should own
     a node they only need while pointed at.

     The value is lifted out and coloured, so "412 contributions on 2026-08-14"
     leads with the figure rather than reading as a sentence. */
  function tooltip() {
    var tip = null, raf = 0, pending = null;

    section.addEventListener('pointerover', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) return;
      pending = { el: el, text: el.getAttribute('data-tip') };
      if (!raf) raf = requestAnimationFrame(place);
    });

    section.addEventListener('pointerout', function (e) {
      if (!tip || !e.target.closest || !e.target.closest('[data-tip]')) return;
      pending = null;
      tip.classList.remove('is-on');
    });

    /* one rAF per burst of pointerover events, so crossing a row of 53 cells
       measures once rather than 53 times */
    function place() {
      raf = 0;
      if (!pending) return;
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'ai-tip';
        tip.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tip);
      }

      /* "412 contributions on ..." — the number is the part being asked for */
      var m = /^(\S+)(\s[\s\S]*)$/.exec(pending.text);
      tip.textContent = '';
      if (m && /\d/.test(m[1])) {
        var b = document.createElement('b');
        b.textContent = m[1];
        tip.appendChild(b);
        tip.appendChild(document.createTextNode(m[2]));
      } else {
        tip.textContent = pending.text;
      }

      var r = pending.el.getBoundingClientRect();
      var w = tip.offsetWidth;
      /* kept inside the viewport: a cell in the first week of January would
         otherwise put half the tooltip off the left edge */
      var x = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, r.left + r.width / 2));
      tip.style.left = x + 'px';
      tip.style.top = (r.top - 8) + 'px';
      tip.classList.add('is-on');
    }

    /* a scroll moves the cell out from under a tooltip still pointing at where
       it used to be */
    addEventListener('scroll', function () {
      if (tip) { pending = null; tip.classList.remove('is-on'); }
    }, { passive: true });
  }

  /* The outer pass only waits for each panel's data to land — where a group
     begins is the group's own business. */
  watch();
})();

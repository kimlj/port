/*
  Behaviour for /hub. Two jobs: switch panels, and keep the live figures honest.

  Everything the page asserts about a project is already in the markup before
  this file runs, so with the network down or this script blocked the hub is
  still a complete walkthrough - it just stops claiming to know what is up right
  now. That ordering is the point. A presentation surface that renders nothing
  until a fetch resolves is a surface that can fail live, in front of somebody.
*/
(function () {
  'use strict';

  var ENDPOINT = '/api/hub-status';
  var REFRESH_MS = 30000;

  // Set when a figure that had a real number loses its backing, cleared when
  // the upstream answers again. Only ever read to caption the stamp.
  var staleSince = null;

  // ── operator unlock ───────────────────────────────────────────────────
  //
  // /hub?key=... is typed once, before recording. The page itself is static,
  // so the key has to be carried to the function by hand: it is the function
  // that checks it and sets the HttpOnly cookie every later poll rides on.
  //
  // It is read and then removed from the address in the same breath, before
  // anything can be screenshotted and before select() writes a hash - a
  // replaceState to '#panel' resolves against the current URL and would carry
  // the query along with it, putting the key back in the bar for the whole
  // recording. After this line the address is /hub, which is the arrangement
  // the cookie exists to buy.
  var unlockKey = null;
  try {
    var params = new URLSearchParams(location.search);
    unlockKey = params.get('key');
    if (unlockKey) {
      params.delete('key');
      var rest = params.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
  } catch (err) {
    /* no URLSearchParams, or no history; the page works unlocked */
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = {};
  tabs.forEach(function (tab) {
    panels[tab.dataset.target] = document.getElementById('panel-' + tab.dataset.target);
  });

  // ── switching ─────────────────────────────────────────────────────────

  function select(target, opts) {
    var focus = opts && opts.focus;
    tabs.forEach(function (tab) {
      var on = tab.dataset.target === target;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      var panel = panels[tab.dataset.target];
      if (panel) panel.setAttribute('data-active', on ? 'true' : 'false');
      if (on && focus) tab.focus();
    });
    // The panel is the thing being talked about, so it owns the address. A
    // reload mid-recording comes back to the same screen rather than to MDS Pro.
    try {
      history.replaceState(null, '', '#' + target);
    } catch (err) {
      /* file:// and similar; the page works without it */
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      select(tab.dataset.target);
    });
  });

  function currentIndex() {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('aria-selected') === 'true') return i;
    }
    return 0;
  }

  document.addEventListener('keydown', function (e) {
    // Never steal a key from a field. There is none on this page today, and
    // there will be the day somebody adds a search box.
    var el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key >= '1' && e.key <= String(tabs.length)) {
      e.preventDefault();
      select(tabs[Number(e.key) - 1].dataset.target, { focus: true });
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(tabs[(currentIndex() + 1) % tabs.length].dataset.target, { focus: true });
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(tabs[(currentIndex() - 1 + tabs.length) % tabs.length].dataset.target, { focus: true });
    }
  });

  function selectFromHash() {
    var target = (location.hash || '').replace('#', '');
    if (target && panels[target]) select(target);
  }
  selectFromHash();

  // Editing the address, or a back button after the replaceState above, should
  // land on the panel named in the URL rather than leaving the page showing
  // something the address bar contradicts.
  window.addEventListener('hashchange', selectFromHash);

  // ── live data ─────────────────────────────────────────────────────────

  function num(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !isFinite(value)) return null;
    return value.toLocaleString('en-US');
  }

  // ── motion ────────────────────────────────────────────────────────────
  //
  // The same vocabulary as assets/js/activity-motion.js on the portfolio, on
  // purpose: a figure counts up out of its own rendered format, a bar grows
  // from the value its builder wrote, and both run once, when the reader
  // actually reaches them. Two sites by one person should not move two ways.
  //
  // Two rules carried over from that file because each cost a debugging
  // session there:
  //
  //   ARM ON CREATE, RELEASE ON VIEW. A value is zeroed the moment it is
  //   written and let go when it scrolls into view. Zeroing at release paints
  //   the real figure first and then resets it, and every number arrives twice.
  //
  //   PARSE THE FIGURE BACK OUT OF ITS TEXT. "39.2%", "1,334" and "8" keep
  //   the shape num() gave them; only the number inside moves.
  //
  // One rule this file needs and that one does not: hub.js REBUILDS every chart
  // on every 30-second poll. So a block is animated once per page life, and a
  // rebuild after that renders the final state directly - otherwise every chart
  // on the panel would replay twice a minute, which on a recording reads as the
  // page glitching.

  var MOTION = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COUNT_MS = 1000;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  // A little way into the viewport rather than the instant an edge crosses it,
  // so a slow scroll arrives to watch a block fill rather than to find it done.
  // An element in a hidden panel reports not-intersecting until its tab is
  // chosen, which is what makes pressing 2 count the WordWarz figures up.
  //
  // AND IT FIRES AT ONCE WHEN THE DOCUMENT IS HIDDEN. An IntersectionObserver
  // delivers nothing to a hidden document - no rendering steps run, so it never
  // computes an intersection - and every figure armed at zero stays at zero for
  // as long as the page is not in front. On Windows Chrome counts a window
  // covered by another window as hidden, which is precisely a hub sitting
  // behind the app recording it: first version, every tile read 0 until
  // someone clicked the window. Nobody is watching a hidden page animate, so it
  // gets its final state instead - the count's timer backstop lands the figure,
  // bars take their widths, rings their values.
  var waitingForView = [];

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    var waiting = waitingForView;
    waitingForView = [];
    for (var i = 0; i < waiting.length; i++) waiting[i]();
  });

  function onceInView(el, fn) {
    var fired = false;
    var obs = null;
    function run() {
      if (fired) return;
      fired = true;
      if (obs) obs.disconnect();
      fn();
    }
    if (!window.IntersectionObserver || document.hidden) { run(); return; }
    waitingForView.push(run);
    obs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { run(); return; }
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    obs.observe(el);
  }

  function parseFigure(text) {
    var m = /-?[\d,]*\.?\d+/.exec(String(text));
    if (!m) return null;
    var n = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(n)) return null;
    return {
      n: n,
      before: text.slice(0, m.index),
      after: text.slice(m.index + m[0].length),
      decimals: (m[0].split('.')[1] || '').length,
      grouped: m[0].indexOf(',') !== -1
    };
  }

  function writeFigure(el, f, v) {
    var body = f.decimals ? v.toFixed(f.decimals)
      : f.grouped ? Math.round(v).toLocaleString('en-US')
      : String(Math.round(v));
    el.textContent = f.before + body + f.after;
  }

  // Tiles in a row arrive left to right rather than all at once.
  function staggerOf(el) {
    var tile = el.closest('.metric, .stat');
    if (!tile || !tile.parentElement) return 0;
    return Array.prototype.indexOf.call(tile.parentElement.children, tile) * 70;
  }

  // Reads st.target on every frame rather than capturing it, so a poll that
  // lands mid-count steers the running tween to the new figure instead of
  // letting it finish on a stale one and jump.
  function tween(el, st, from, ms, delay) {
    var token = {};
    st.token = token;

    // Backstop. requestAnimationFrame does not run at all in a hidden tab, and
    // this page is routinely a background tab beside the one being recorded -
    // so without this a count armed at zero stays at zero, and the tab's
    // thumbnail, or a window brought forward mid-sentence, shows "0 players".
    // Timers still fire in the background (throttled to about a second), so
    // this lands the real figure shortly after the animation would have ended
    // whether or not a single frame was ever drawn.
    setTimeout(function () {
      if (st.token !== token || st.shown === st.target.n) return;
      st.token = null;
      st.shown = st.target.n;
      el.textContent = st.target.text;
    }, delay + ms + 250);

    setTimeout(function () {
      if (st.token !== token) return;
      var start = 0;
      requestAnimationFrame(function step(now) {
        if (st.token !== token) return;
        if (!start) start = now;
        var t = Math.min(1, (now - start) / ms);
        var f = st.target;
        st.shown = from + (f.n - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) {
          writeFigure(el, f, st.shown);
          requestAnimationFrame(step);
        } else {
          st.shown = f.n;
          el.textContent = f.text;
        }
      });
    }, delay);
  }

  // The one way a figure reaches the page. First value: zeroed and held until
  // seen, then counted up. Later values: a short tween from whatever is on
  // screen, so a live figure changing mid-walkthrough visibly moves rather than
  // silently swapping digits.
  function setFigure(el, text) {
    var f = MOTION ? parseFigure(text) : null;
    var st = el.__fig;
    if (!f) {
      if (st) st.token = null;
      el.textContent = text;
      return;
    }
    f.text = text;

    if (!st) {
      st = el.__fig = { target: f, shown: 0, released: false, token: null };
      // Nothing to count up from zero to zero.
      if (f.n === 0) {
        st.released = true;
        el.textContent = text;
        return;
      }
      writeFigure(el, f, 0);
      onceInView(el, function () {
        st.released = true;
        tween(el, st, 0, COUNT_MS, staggerOf(el));
      });
      return;
    }

    st.target = f;
    if (!st.released) {
      writeFigure(el, f, 0);
      return;
    }
    if (st.shown === f.n) {
      el.textContent = text;
      return;
    }
    tween(el, st, st.shown, 600, 0);
  }

  // A chart block: arm(host) zeroes whatever the builder just made and returns
  // the function that lets it go. Re-armed on every rebuild until the block has
  // been seen, so the release always animates the current nodes and never a
  // set a poll has since thrown away; a no-op for good once it has run.
  function revealOnce(host, arm) {
    if (!MOTION || !host || host.__revealed) return;
    host.__release = arm(host);
    if (host.__watching) return;
    host.__watching = true;
    onceInView(host, function () {
      host.__revealed = true;
      var release = host.__release;
      host.__release = null;
      if (release) {
        // One reflow, so the zeroed state is a computed style the transition
        // can start from - a panel that was display:none a frame ago has none.
        void host.offsetWidth;
        release();
      }
    });
  }

  // Width, height or left, read off the inline style the builder wrote.
  function growProp(selector, prop, stepMs) {
    return function (host) {
      var nodes = host.querySelectorAll(selector);
      var vals = [];
      for (var i = 0; i < nodes.length; i++) {
        vals.push(nodes[i].style[prop]);
        nodes[i].style.transition = 'none';
        nodes[i].style[prop] = '0';
      }
      return function () {
        for (var j = 0; j < nodes.length; j++) {
          nodes[j].style.transition = prop + ' 0.7s ' + EASE + ' ' + (j * stepMs) + 'ms';
          nodes[j].style[prop] = vals[j];
        }
      };
    };
  }

  // SVG columns rise from their feet, swept left to right by their x - which
  // is a percentage of the width, so the sweep takes the same time however
  // many days are in the window.
  function growRects(host) {
    var rects = host.querySelectorAll('rect');
    for (var i = 0; i < rects.length; i++) {
      rects[i].style.transition = 'none';
      rects[i].style.transform = 'scaleY(0)';
    }
    return function () {
      for (var j = 0; j < rects.length; j++) {
        var x = parseFloat(rects[j].getAttribute('x')) || 0;
        rects[j].style.transition = 'transform 0.65s ' + EASE + ' ' + Math.round(x * 8) + 'ms';
        rects[j].style.transform = '';
      }
    };
  }

  // A curve is uncovered from the left rather than grown, because scaling a
  // filled polygon from its base changes its shape on the way up.
  function wipeIn(host) {
    var svg = host.querySelector('svg');
    if (!svg) return null;
    svg.style.transition = 'none';
    svg.style.clipPath = 'inset(0 100% 0 0)';
    return function () {
      svg.style.transition = 'clip-path 1s ' + EASE;
      svg.style.clipPath = 'inset(0 0 0 0)';
    };
  }

  function riseRows(host) {
    var rows = host.querySelectorAll('tbody tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.transition = 'none';
      rows[i].style.opacity = '0';
      rows[i].style.transform = 'translateY(4px)';
    }
    return function () {
      for (var j = 0; j < rows.length; j++) {
        rows[j].style.transition = 'opacity 0.4s ease ' + (j * 35) + 'ms, transform 0.4s ' + EASE + ' ' + (j * 35) + 'ms';
        rows[j].style.opacity = '';
        rows[j].style.transform = '';
      }
    };
  }


  function get(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc === null || acc === undefined ? undefined : acc[key];
    }, obj);
  }

  function setStamp(text) {
    var stamp = document.getElementById('stamp');
    if (stamp) stamp.textContent = text;
  }

  function renderStrip(services) {
    var strip = document.getElementById('strip');
    if (!strip) return;
    strip.textContent = '';
    services.forEach(function (svc) {
      var wrap = document.createElement('div');
      wrap.className = 'svc';

      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('data-state', svc.state);
      wrap.appendChild(dot);

      var name = document.createElement('span');
      name.textContent = svc.name;
      wrap.appendChild(name);

      // Latency is shown for a service that answered. For one that did not, the
      // elapsed time is how long we waited before giving up, which is a fact
      // about this page rather than about the service - so it says why instead.
      var tail = document.createElement('span');
      tail.className = 'lat';
      tail.textContent = svc.state === 'down'
        ? (svc.reason || 'down')
        : svc.latencyMs + 'ms';
      wrap.appendChild(tail);

      strip.appendChild(wrap);
    });
  }

  function renderRailDots(services) {
    document.querySelectorAll('[data-group-dot]').forEach(function (dot) {
      var group = dot.getAttribute('data-group-dot');
      var mine = services.filter(function (s) { return s.group === group; });
      if (!mine.length) return;
      // The worst state in the group wins. A project with one healthy service
      // and one dead one is not healthy, and a green dot beside it would be the
      // single most misleading pixel on the page.
      var state = mine.some(function (s) { return s.state === 'down'; }) ? 'down'
        : mine.some(function (s) { return s.state === 'degraded'; }) ? 'degraded'
        : 'up';
      dot.setAttribute('data-state', state);
    });
  }

  function renderGroupServices(services) {
    document.querySelectorAll('[data-group-services]').forEach(function (host) {
      var group = host.getAttribute('data-group-services');
      host.textContent = '';
      services.filter(function (s) { return s.group === group; }).forEach(function (svc) {
        var row = document.createElement('div');
        row.className = 'svc-row';

        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.setAttribute('data-state', svc.state);
        row.appendChild(dot);

        var text = document.createElement('span');
        var name = document.createElement('span');
        name.className = 'svc-name';
        name.textContent = svc.name;
        text.appendChild(name);
        text.appendChild(document.createElement('br'));
        var note = document.createElement('span');
        note.className = 'svc-note';
        note.textContent = svc.note || '';
        text.appendChild(note);
        row.appendChild(text);

        var lat = document.createElement('span');
        lat.className = 'lat';
        lat.textContent = svc.state === 'down' ? (svc.reason || 'down') : svc.latencyMs + 'ms';
        row.appendChild(lat);

        host.appendChild(row);
      });
    });
  }

  // Returns true if a figure that was showing a real number has stopped being
  // backed by one. That is a different state from never having had it - the
  // markup ships an em dash, so a cold page with a dead upstream says nothing,
  // while a page that has been open all morning keeps a number the upstream can
  // no longer vouch for. The caller says so in the stamp.
  function renderLiveValues(data) {
    var wentStale = false;
    document.querySelectorAll('[data-live]').forEach(function (el) {
      var value = num(get(data, el.getAttribute('data-live')));
      if (value === null) {
        // Leave whatever is there and keep it dimmed. Writing "0" because a
        // fetch failed would put a false number on screen, and 0 players is a
        // claim somebody might read out loud. Blanking it back to an em dash
        // mid-recording is the other wrong answer: the figure was true when it
        // was taken, and the stamp is where that gets said.
        if (el.getAttribute('data-pending') !== 'true') wentStale = true;
        el.setAttribute('data-pending', 'true');
        return;
      }
      setFigure(el, value);
      el.removeAttribute('data-pending');
    });
    return wentStale;
  }

  // ── the WordWarz data blocks ──────────────────────────────────────────
  //
  // Everything below fills values into scaffolding the markup already carries.
  // No heading, caption or caveat is written here: with this file gone the
  // panel still lists what the game measures and every warning about how to
  // read it, which is the half that must never depend on a fetch.
  //
  // All of it is DOM built node by node rather than innerHTML. One field in
  // here is a player's chosen display name, typed by a stranger into a game,
  // and it is the only string on this page that did not come from the owner.
  // textContent is what makes that a name rather than markup.

  function target(name) {
    return document.querySelector('[data-hub="' + name + '"]');
  }


  // Sets a value that is not a plain count - a rate, a date, a composed
  // string - keeping the same pending contract the numbers use: null leaves
  // what is there and dims it rather than writing something false over it.
  function setText(name, text, figure) {
    var el = target(name);
    if (!el) return;
    if (text === null || text === undefined) {
      el.setAttribute('data-pending', 'true');
      return;
    }
    if (figure) setFigure(el, text);
    else el.textContent = text;
    el.removeAttribute('data-pending');
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // A bare YYYY-MM-DD is read by Date.parse as UTC midnight, and
  // toLocaleDateString in any zone behind UTC then names the day before it -
  // so a chart of days would be labelled one day out for a reader in New York
  // and correct for one in Manila. Split by hand instead; the same trap is
  // documented in scripts/fetch-hub-figures.mjs. A full timestamp still goes
  // through Date, where the offset is the point.
  function shortDate(iso) {
    if (typeof iso !== 'string') return null;
    var bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (bare) return MONTHS[Number(bare[2]) - 1] + ' ' + Number(bare[3]);
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function clockTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // ── bar lists ────────────────────────────────────────────────────────

  // rows: [{ label, value, display, share }]. The track is always full width
  // and the fill is a share of the biggest row, so lengths compare against one
  // baseline within a block - never across blocks, which is why no block
  // borrows another's maximum.
  function renderBars(name, rows, opts) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!rows || !rows.length) return;
    if (opts && opts.series) host.setAttribute('data-series', String(opts.series));

    var max = rows.reduce(function (m, r) { return Math.max(m, r.value || 0); }, 0);

    rows.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'bar-row';

      var label = document.createElement('span');
      label.className = 'bar-label';
      label.textContent = row.label;
      // The full label in a tooltip, since the column ellipses anything long
      // and a truncated ELO bucket is unreadable rather than merely short.
      label.title = row.label;
      line.appendChild(label);

      var track = document.createElement('span');
      track.className = 'bar-track';
      var fill = document.createElement('span');
      fill.className = 'bar-fill';
      // max of 0 would divide by zero; a row of zeroes draws as no fill, which
      // is the truthful picture of it.
      fill.style.width = max > 0 ? (row.value / max) * 100 + '%' : '0%';
      track.appendChild(fill);
      line.appendChild(track);

      var value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = row.display !== undefined ? row.display : num(row.value);
      if (row.share) {
        var share = document.createElement('span');
        share.className = 'bar-share';
        share.textContent = ' ' + row.share;
        value.appendChild(share);
      }
      line.appendChild(value);

      host.appendChild(line);
    });
  }

  // ── charts ───────────────────────────────────────────────────────────

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) el.setAttribute(key, attrs[key]);
    }
    return el;
  }

  // One chart function for all three.
  //
  // The bars live in an SVG with preserveAspectRatio="none", so the CSS owns
  // the size and nothing here has to measure anything - measuring would mean
  // reading layout off a panel that is display:none for four of the five tabs,
  // where every box is zero. The LABELS are HTML around that SVG rather than
  // <text> inside it, because a non-uniform scale stretches glyphs with the
  // geometry: the first draft rendered "9" as a flat ellipse and the two clock
  // labels as unreadable smears.
  //
  // Bars are placed on a TIME axis, not on their index in the array. A missing
  // hour has no row, and spacing by index would close the gap up and draw a
  // continuous day - which is the exact claim the caption under the
  // concurrency chart disowns. An unallocated slot draws nothing, so a gap
  // reads as a gap and never as a measured zero.
  //
  // series: [{ key, color }]. Stacked when there is more than one, which is
  // what new-vs-returning needs and the other two do not mind.
  function renderChart(name, points, series, opts) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';

    if (!points || !points.length) {
      var empty = document.createElement('span');
      empty.className = 'dsec-note';
      // Says which of the two it is. "No data" would cover both "nobody
      // played" and "we were not measuring", and those are not the same claim.
      empty.textContent = (opts && opts.emptyText) || 'no samples in this window';
      host.appendChild(empty);
      return;
    }

    var stepMs = opts.stepMs;
    var times = points.map(function (p) { return Date.parse(opts.timeOf(p)); });
    var first = Math.min.apply(null, times);
    var last = Math.max.apply(null, times);
    // +1 because both ends are slots, not fenceposts.
    var slots = Math.max(Math.round((last - first) / stepMs) + 1, 1);

    var max = 0;
    points.forEach(function (p) {
      var total = 0;
      series.forEach(function (s) { total += p[s.key] || 0; });
      max = Math.max(max, total);
    });
    if (max <= 0) max = 1;

    var top = document.createElement('span');
    top.className = 'chart-max';
    top.textContent = num(max);
    host.appendChild(top);

    var svg = svgEl('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': (opts && opts.label) || ''
    });

    [0, 50, 100].forEach(function (y) {
      svg.appendChild(svgEl('line', {
        class: 'chart-grid', x1: 0, x2: 100, y1: y, y2: y,
        'vector-effect': 'non-scaling-stroke'
      }));
    });

    var slot = 100 / slots;
    var barWidth = Math.max(slot * 0.7, 0.3);
    var pad = (slot - barWidth) / 2;

    points.forEach(function (p, i) {
      var index = Math.round((times[i] - first) / stepMs);
      var x = index * slot + pad;
      var y = 100;
      var total = 0;
      series.forEach(function (s) {
        var value = p[s.key] || 0;
        total += value;
        if (value <= 0) return;
        var h = (value / max) * 100;
        y -= h;
        svg.appendChild(svgEl('rect', {
          x: x, y: y, width: barWidth, height: h, fill: s.color
        }));
      });

      // A measured zero gets a floor tick. Without it a sampled hour in which
      // nobody was online draws exactly like an hour that was never sampled,
      // and the caption under the concurrency chart promises those are
      // distinguishable - "they are not drawn as zero, because zero would say
      // it was up and empty". A no-op bar would have made that caption false.
      if (total === 0) {
        svg.appendChild(svgEl('rect', {
          x: x, y: 98.5, width: barWidth, height: 1.5, fill: 'var(--text-dim)'
        }));
      }
    });

    host.appendChild(svg);

    var axis = document.createElement('div');
    axis.className = 'chart-x';
    var a = document.createElement('span');
    a.textContent = opts.labelAt(points[0]) || '';
    var b = document.createElement('span');
    b.textContent = opts.labelAt(points[points.length - 1]) || '';
    axis.appendChild(a);
    axis.appendChild(b);
    host.appendChild(axis);
  }

  // ── the other mark types ─────────────────────────────────────────────
  //
  // Seven blocks in a row were seven horizontal bar lists, which reads as one
  // chart type applied seven times rather than as seven questions answered.
  // Each of these is picked from the shape of its own data, and a bar list is
  // still the right answer where the question is a RANKING - openers and
  // busiest days keep theirs, because "which is biggest" is exactly what a
  // sorted bar list says best.
  //
  // Only the area chart needs SVG. Everything else is HTML boxes with
  // percentage widths and heights, which sidesteps the label-stretching trap
  // in renderChart entirely: there is no non-uniform scale to distort text.

  // Part-to-whole. One bar, segmented, with the legend carrying the numbers.
  // Four slices of a single total is the one case where a shared baseline
  // beats four separate bars, because the question is "how is it divided"
  // rather than "which is biggest".
  function renderSegments(name, rows, colors) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!rows || !rows.length) return;

    var total = rows.reduce(function (sum, r) { return sum + (r.value || 0); }, 0);
    if (total <= 0) return;

    var bar = document.createElement('div');
    bar.className = 'seg';
    rows.forEach(function (row, i) {
      var part = document.createElement('span');
      part.className = 'seg-part';
      part.style.width = (row.value / total) * 100 + '%';
      part.style.background = colors[i % colors.length];
      part.title = row.label + ' — ' + num(row.value);
      bar.appendChild(part);
    });
    host.appendChild(bar);

    var legend = document.createElement('div');
    legend.className = 'seg-legend';
    rows.forEach(function (row, i) {
      var item = document.createElement('div');
      item.className = 'seg-item';

      var swatch = document.createElement('span');
      swatch.className = 'seg-swatch';
      swatch.style.background = colors[i % colors.length];
      item.appendChild(swatch);

      var label = document.createElement('span');
      label.className = 'seg-label';
      label.textContent = row.label;
      item.appendChild(label);

      var value = document.createElement('span');
      value.className = 'seg-value';
      // The share to a whole percent, and the count beside it. A 2% slice is
      // unreadable as a length at this width, so the number is doing that work.
      value.textContent = num(row.value) + ' · ' + Math.round((row.value / total) * 100) + '%';
      item.appendChild(value);

      legend.appendChild(item);
    });
    host.appendChild(legend);
  }

  // A distribution along an ordered axis. Vertical, because the order of the
  // buckets is the information - reading a rating scale left to right is what
  // a histogram is for, and a horizontal list of the same buckets throws that
  // away and invites the reader to sort it by size instead.
  function renderHistogram(name, rows, opts) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!rows || !rows.length) return;

    var max = rows.reduce(function (m, r) { return Math.max(m, r.value || 0); }, 0);
    if (max <= 0) max = 1;

    var scale = document.createElement('span');
    scale.className = 'hist-max';
    scale.textContent = num(max);
    host.appendChild(scale);

    var plot = document.createElement('div');
    plot.className = 'hist';
    rows.forEach(function (row) {
      var col = document.createElement('div');
      col.className = 'hist-col';

      var value = document.createElement('span');
      value.className = 'hist-value';
      value.textContent = num(row.value);
      col.appendChild(value);

      var barWrap = document.createElement('span');
      barWrap.className = 'hist-bar-wrap';
      var bar = document.createElement('span');
      bar.className = 'hist-bar';
      // A floor of 1% so a bucket with a real count is never invisible beside
      // one 30x its size - the same reason the time charts tick a measured
      // zero. An actual zero gets nothing.
      bar.style.height = row.value > 0 ? Math.max((row.value / max) * 100, 1) + '%' : '0';
      if (opts && opts.color) bar.style.background = opts.color;
      barWrap.appendChild(bar);
      col.appendChild(barWrap);

      var label = document.createElement('span');
      label.className = 'hist-label';
      label.textContent = row.label;
      label.title = row.label;
      col.appendChild(label);

      plot.appendChild(col);
    });
    host.appendChild(plot);
  }

  // A filled curve over an ordered axis. For a quantity that is continuous
  // across its axis - days, or lobby size - where the SHAPE is the content and
  // the individual columns are not being read one at a time.
  //
  // Absent entries are filled with zero rather than skipped, and that is only
  // honest for these two series: a day with no games and a lobby size nobody
  // played both genuinely are zero, because the row only exists when something
  // happened. The concurrency chart must never do this - a missing sample there
  // means nobody was watching, which is not a fact about players.
  function renderArea(name, points, opts) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!points || !points.length) return;

    var max = points.reduce(function (m, p) { return Math.max(m, p.value || 0); }, 0);
    if (max <= 0) max = 1;

    var scale = document.createElement('span');
    scale.className = 'chart-max';
    scale.textContent = num(max);
    host.appendChild(scale);

    var svg = svgEl('svg', {
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': (opts && opts.label) || ''
    });

    [0, 50, 100].forEach(function (y) {
      svg.appendChild(svgEl('line', {
        class: 'chart-grid', x1: 0, x2: 100, y1: y, y2: y,
        'vector-effect': 'non-scaling-stroke'
      }));
    });

    var step = points.length > 1 ? 100 / (points.length - 1) : 0;
    var coords = points.map(function (p, i) {
      return [i * step, 100 - ((p.value || 0) / max) * 100];
    });

    var line = coords.map(function (c) { return c[0].toFixed(2) + ',' + c[1].toFixed(2); }).join(' ');
    svg.appendChild(svgEl('polygon', {
      points: '0,100 ' + line + ' 100,100',
      fill: (opts && opts.fill) || 'var(--series-4)',
      opacity: 0.22
    }));
    svg.appendChild(svgEl('polyline', {
      points: line,
      fill: 'none',
      stroke: (opts && opts.color) || 'var(--series-4)',
      'stroke-width': 1.5,
      // Without this the stroke is scaled by the same non-uniform transform as
      // the geometry, so the line is thick where the box is narrow.
      'vector-effect': 'non-scaling-stroke',
      'stroke-linejoin': 'round'
    }));

    host.appendChild(svg);

    var axis = document.createElement('div');
    axis.className = 'chart-x';
    var a = document.createElement('span');
    a.textContent = points[0].label || '';
    var b = document.createElement('span');
    b.textContent = points[points.length - 1].label || '';
    axis.appendChild(a);
    axis.appendChild(b);
    host.appendChild(axis);
  }

  // Five magnitudes that differ by a quarter, on a shared axis that does not
  // start at zero. Bars would have to start at zero or lie, and starting at
  // zero renders 35.3 and 45.5 as near-identical lengths - the difference the
  // block exists to show would be the one thing invisible in it. A dot carries
  // no length, so it makes no claim about the origin and the axis can be tight.
  function renderDotPlot(name, rows, opts) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!rows || !rows.length) return;

    var values = rows.map(function (r) { return r.value || 0; });
    var lo = Math.min.apply(null, values);
    var hi = Math.max.apply(null, values);
    // A little air at each end so the extremes are not pinned to the edges,
    // and a guard for the case where every value is identical.
    var pad = (hi - lo) * 0.15 || Math.max(hi * 0.1, 1);
    lo -= pad;
    hi += pad;
    var span = hi - lo || 1;

    rows.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'dot-row';

      var label = document.createElement('span');
      label.className = 'dot-label';
      label.textContent = row.label;
      label.title = row.label;
      line.appendChild(label);

      var track = document.createElement('span');
      track.className = 'dot-track';
      var dot = document.createElement('span');
      dot.className = 'dot-mark';
      dot.style.left = (((row.value || 0) - lo) / span) * 100 + '%';
      if (opts && opts.color) dot.style.background = opts.color;
      track.appendChild(dot);
      line.appendChild(track);

      var value = document.createElement('span');
      value.className = 'dot-value';
      value.textContent = row.display !== undefined ? row.display : num(row.value);
      if (row.note) {
        var note = document.createElement('span');
        note.className = 'dot-note';
        note.textContent = ' ' + row.note;
        value.appendChild(note);
      }
      line.appendChild(value);

      host.appendChild(line);
    });

    // The axis is not zero-based, so it says where it starts and ends. A tight
    // axis with no scale on it is the chart that lies by omission.
    var axis = document.createElement('div');
    axis.className = 'dot-axis';
    var a = document.createElement('span');
    a.textContent = (opts && opts.format ? opts.format(lo) : num(Math.round(lo)));
    var b = document.createElement('span');
    b.textContent = (opts && opts.format ? opts.format(hi) : num(Math.round(hi)));
    axis.appendChild(a);
    axis.appendChild(b);
    host.appendChild(axis);
  }

  // A total and the share of it still active. The RATIO is the content here -
  // 1,434 devices of which 160 came back this month is a different fact from
  // 150 of which 140 did - and two bars on one scale would have said only that
  // the first number is bigger, which the reader can already see.
  function renderShareTable(name, rows) {
    var host = target(name);
    if (!host) return;
    host.textContent = '';
    if (!rows || !rows.length) return;

    rows.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'share-row';

      var label = document.createElement('span');
      label.className = 'share-label';
      label.textContent = row.label;
      line.appendChild(label);

      var total = document.createElement('span');
      total.className = 'share-total';
      total.textContent = num(row.total);
      line.appendChild(total);

      var gauge = document.createElement('span');
      gauge.className = 'share-gauge';
      var fill = document.createElement('span');
      fill.className = 'share-fill';
      var share = row.total > 0 ? row.active / row.total : 0;
      fill.style.width = share * 100 + '%';
      gauge.appendChild(fill);
      line.appendChild(gauge);

      var pctEl = document.createElement('span');
      pctEl.className = 'share-pct';
      pctEl.textContent = row.total > 0 ? Math.round(share * 100) + '%' : '—';
      line.appendChild(pctEl);

      host.appendChild(line);
    });
  }

  // ── the panel ────────────────────────────────────────────────────────

  function renderWordWarz(data) {
    var panel = document.getElementById('panel-wordwarz');
    if (!panel) return;

    // The operator half is gated on the SERVER having said so, not on the
    // page deciding. With the flag off the blocks below are never filled, so
    // there is nothing behind the CSS to reveal.
    panel.setAttribute('data-op', data.operator ? 'true' : 'false');

    var w = data.wordwarz;
    if (!w || w.error) {
      // Leave every block holding what it had. The stamp is where staleness is
      // announced; blanking thirteen sections mid-recording is the other, worse
      // way to be honest about it.
      return;
    }

    setText('peak24h-at', w.peak24h ? (clockTime(w.peak24h.at) || '') : null);

    // Part-to-whole: one bar, four slices of a single total.
    renderSegments('seg-modes', (w.gamesByMode || []).map(function (m) {
      return { label: m.mode, value: m.games };
    }), ['var(--series-1)', 'var(--series-3)', 'var(--series-4)', 'var(--series-2)']);

    // A rating scale, so it is drawn as one: buckets in rating order, left to
    // right, as columns. Sorting by count would destroy the only thing the
    // block is for.
    //
    // The unrated pile is pulled OUT of the plot rather than drawn in it. It is
    // not a point on the scale - it is everybody who has an account and has not
    // played a ranked game - and at 590 against a busiest real bucket of 74 it
    // would flatten all six into a baseline. It is stated beside the chart
    // instead, which is both the readable answer and the honest one.
    var ELO_ORDER = ['under 900', '900-999', '1001-1099', '1100-1199', '1200+'];
    var eloRows = (w.elo || []).filter(function (e) {
      return ELO_ORDER.indexOf(e.bucket) !== -1;
    }).sort(function (a, b) {
      return ELO_ORDER.indexOf(a.bucket) - ELO_ORDER.indexOf(b.bucket);
    });
    renderHistogram('hist-elo', eloRows.map(function (e) {
      return { label: e.bucket, value: e.accounts };
    }), { color: 'var(--series-3)' });

    var unrated = (w.elo || []).filter(function (e) {
      return ELO_ORDER.indexOf(e.bucket) === -1;
    }).reduce(function (sum, e) { return sum + (e.accounts || 0); }, 0);
    var rated = eloRows.reduce(function (sum, e) { return sum + (e.accounts || 0); }, 0);
    setText('elo-unrated', rated + unrated > 0
      ? num(unrated) + ' of ' + num(rated + unrated) + ' accounts have never played a ranked game'
      : null);

    // The ratio is the content, not the two totals.
    renderShareTable('share-platform', (w.platforms || []).map(function (p) {
      return { label: p.platform, total: p.devices, active: p.active30d };
    }));

    // A unimodal curve over an integer axis. Absent sizes are filled with zero,
    // which is true here: the row exists only when a game of that size was
    // played.
    var sizes = (w.lobbySizes || []);
    var lobbyPoints = [];
    if (sizes.length) {
      var maxSize = sizes.reduce(function (m, l) { return Math.max(m, l.size); }, 0);
      var bySize = {};
      sizes.forEach(function (l) { bySize[l.size] = l.games; });
      for (var size = 1; size <= maxSize; size++) {
        lobbyPoints.push({ label: String(size), value: bySize[size] || 0 });
      }
    }
    renderArea('area-lobby', lobbyPoints, {
      label: 'Games by number of players in the lobby',
      color: 'var(--series-2)', fill: 'var(--series-2)'
    });

    // Kept as horizontal bars, and not for want of an alternative: this is the
    // shape every Wordle player has already read a hundred times, and a reader
    // recognising a chart before reading it is worth more than variety.
    renderBars('bars-guesses', (w.guessDistribution || []).map(function (g) {
      return { label: g.guesses + (g.guesses === 1 ? ' guess' : ' guesses'), value: g.count, display: num(g.count) };
    }), { series: 3 });

    // Ordered by time, not by volume - the question is which mode is slow, and
    // a list ordered by how much it was played answers a different one.
    renderDotPlot('dots-solvetime', (w.solveTimeByMode || []).slice().sort(function (a, b) {
      return (a.avgSeconds || 0) - (b.avgSeconds || 0);
    }).map(function (s) {
      return {
        label: s.mode, value: s.avgSeconds,
        display: s.avgSeconds + 's', note: '(' + num(s.solves) + ')'
      };
    }), {
      color: 'var(--series-4)',
      format: function (v) { return v.toFixed(0) + 's'; }
    });

    renderBars('bars-openers', (w.openers || []).map(function (o) {
      return { label: o.word.toUpperCase(), value: o.count, display: num(o.count) };
    }), { series: 1 });

    renderBars('bars-busiest', (w.busiestDays || []).map(function (d) {
      return { label: shortDate(d.day) || d.day, value: d.games, display: num(d.games) };
    }), { series: 2 });

    var DAY = 86400000;

    renderChart('chart-daily', w.dailyPlayers, [
      { key: 'newPlayers', color: 'var(--series-1)' },
      { key: 'returningPlayers', color: 'var(--series-3)' }
    ], {
      label: 'New and returning players per day',
      stepMs: DAY,
      // The day column is a bare date, which Date.parse reads as UTC midnight.
      // Consistent across every row, so the spacing is right wherever this is
      // read - only the labels localise, and they are drawn from the same string.
      timeOf: function (p) { return p.day; },
      labelAt: function (p) { return shortDate(p.day) || ''; }
    });

    // Columns, not a curve. Thirty discrete daily counts are thirty things that
    // either happened or did not, and an area drawn through them implies a
    // continuous quantity that was sampled - which invites reading a value off
    // the slope between two days, where there is nothing to read.
    //
    // The window is filled in, so a day with no games draws as a measured zero
    // rather than as a gap. That is true HERE and would not be on a sampled
    // series: the games table always exists, so a day with no row really did
    // have no games.
    var byDay = {};
    (w.gamesPerDay || []).forEach(function (d) { byDay[d.day] = d.games; });
    var days = Object.keys(byDay).sort();
    var gamePoints = [];
    if (days.length) {
      var cursor = Date.parse(days[0] + 'T00:00:00Z');
      var end = Date.parse(days[days.length - 1] + 'T00:00:00Z');
      while (cursor <= end) {
        var key = new Date(cursor).toISOString().slice(0, 10);
        gamePoints.push({ day: key, games: byDay[key] || 0 });
        cursor += DAY;
      }
    }
    renderChart('chart-games', gamePoints, [{ key: 'games', color: 'var(--series-4)' }], {
      label: 'Games per day over the last 30 days',
      stepMs: DAY,
      timeOf: function (p) { return p.day; },
      labelAt: function (p) { return shortDate(p.day) || ''; }
    });

    renderRecentGames(w.recentGames);

    revealOnce(target('chart-daily'), growRects);
    revealOnce(target('chart-games'), growRects);
    revealOnce(target('seg-modes'), growProp('.seg-part', 'width', 110));
    revealOnce(target('hist-elo'), growProp('.hist-bar', 'height', 70));
    revealOnce(target('share-platform'), growProp('.share-fill', 'width', 90));
    revealOnce(target('area-lobby'), wipeIn);
    revealOnce(target('bars-guesses'), growProp('.bar-fill', 'width', 45));
    revealOnce(target('dots-solvetime'), growProp('.dot-mark', 'left', 80));
    revealOnce(target('bars-openers'), growProp('.bar-fill', 'width', 35));
    revealOnce(target('bars-busiest'), growProp('.bar-fill', 'width', 35));
    revealOnce(target('tbl-recent'), riseRows);
  }

  function renderRecentGames(rows) {
    var table = target('tbl-recent');
    if (!table) return;
    var body = table.querySelector('tbody');
    if (!body) return;
    body.textContent = '';
    (rows || []).forEach(function (row) {
      var tr = document.createElement('tr');

      [
        num(row.n) || row.n,
        row.mode,
        row.code,
        num(row.players) || row.players,
        null,   // the winner, below, because it needs its own class
        (function () {
          var d = new Date(row.at + (/[Zz+]|\d{2}:\d{2}$/.test(row.at) ? '' : 'Z'));
          return isNaN(d.getTime()) ? row.at
            : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        })()
      ].forEach(function (cell, i) {
        var td = document.createElement('td');
        if (i === 4) {
          // A name a stranger typed into a game. textContent, never innerHTML -
          // this is the only string on the page the owner did not write.
          td.className = row.winner ? 't-winner' : 't-none';
          td.textContent = row.winner || '—';
        } else {
          td.textContent = cell === null || cell === undefined ? '' : String(cell);
        }
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  // The fade at the bottom edge is a claim that there is more below, so it has
  // to stop being made at the end. Passive, because it never prevents default
  // and a scroll handler that blocks the scroll it is watching is the one way
  // to make a long panel feel broken.
  (function watchScrollEnd() {
    var panel = document.querySelector('.panel[data-scrolls="true"]');
    if (!panel) return;
    function check() {
      var atEnd = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
      panel.setAttribute('data-at-end', atEnd ? 'true' : 'false');
    }
    panel.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
  })();

  function refresh() {
    // The key rides along on the first call only. After that the cookie the
    // function set is doing the work, and a key on every poll is a key in
    // every log line for no gain.
    var url = ENDPOINT;
    if (unlockKey) {
      url += '?key=' + encodeURIComponent(unlockKey);
      unlockKey = null;
    }
    fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var services = Array.isArray(data.services) ? data.services : [];
        renderStrip(services);
        renderRailDots(services);
        renderGroupServices(services);
        var stale = renderLiveValues(data);
        if (stale) staleSince = new Date();
        else if (!(data.wordwarz && data.wordwarz.error)) staleSince = null;
        renderWordWarz(data);

        var when = new Date(data.generatedAt);
        var label = isNaN(when.getTime())
          ? 'checked just now'
          : 'checked ' + when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (data.operator) label += ' · operator';
        // The stamp is the page's one claim about its own freshness, and while
        // the stats upstream is down it would otherwise be a lie by omission:
        // a timestamp from this second sitting above figures from before the
        // outage. The probes really were checked then; the figures were not.
        if (staleSince) label += ' · figures held from before the outage';
        setStamp(label);
      })
      .catch(function () {
        // Say the status is unknown rather than showing the last known one as
        // though it were current. The panels keep their static content.
        document.querySelectorAll('.dot, .tab-dot').forEach(function (dot) {
          if (dot.closest('.svc-list') && dot.getAttribute('data-state') === 'up' && !dot.closest('[data-group-services]')) return;
          dot.removeAttribute('data-state');
        });
        setStamp('status unavailable');
      });
  }

  // Each tile's place in its row, for the CSS entrance stagger.
  document.querySelectorAll('.metrics, .stat-row, .bento').forEach(function (row) {
    Array.prototype.forEach.call(row.children, function (tile, i) {
      tile.style.setProperty('--i', i);
    });
  });

  // Figures written straight into the markup - commit counts, MDS Pro's
  // fifteen users - count up on first sight like the fetched ones. Anything
  // that is not a number ("robots.txt", "Looker") is left exactly as written.
  document.querySelectorAll('.metric-value:not([data-live])').forEach(function (el) {
    setFigure(el, el.textContent);
  });

  refresh();
  setInterval(function () {
    // A background tab polling every 30 seconds is a tab warming a droplet for
    // nobody. This page is often left open beside the one being recorded.
    if (document.visibilityState === 'visible') refresh();
  }, REFRESH_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refresh();
  });
})();

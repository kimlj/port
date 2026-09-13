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
      el.textContent = value;
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

  function pct(value, digits) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    return (value * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  // Sets a value that is not a plain count - a rate, a date, a composed
  // string - keeping the same pending contract the numbers use: null leaves
  // what is there and dims it rather than writing something false over it.
  function setText(name, text) {
    var el = target(name);
    if (!el) return;
    if (text === null || text === undefined) {
      el.setAttribute('data-pending', 'true');
      return;
    }
    el.textContent = text;
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

    setText('playRate', pct(w.playRate));
    setText('signInRate', pct(w.signInRate));
    setText('solveRate', pct(w.solveRate));

    setText('largestLobby', w.largestLobby ? num(w.largestLobby.size) : null);
    setText('largestLobby-note', w.largestLobby
      ? w.largestLobby.mode + ' · ' + (shortDate(w.largestLobby.at) || 'unknown date') +
        ' — a floor: bots excluded, and a player with no account yet is not counted'
      : null);

    setText('peak24h-at', w.peak24h ? (clockTime(w.peak24h.at) || '') : null);

    var total = (w.gamesByMode || []).reduce(function (sum, m) { return sum + (m.games || 0); }, 0);
    renderBars('bars-modes', (w.gamesByMode || []).map(function (m) {
      return {
        label: m.mode,
        value: m.games,
        display: num(m.games),
        share: total > 0 ? '(' + Math.round((m.games / total) * 100) + '%)' : ''
      };
    }), { series: 1 });

    // Buckets in rating order rather than in count order, because the shape of
    // a rating distribution is the thing being read and sorting by size
    // destroys it. "never played" and "unrated" sit at the end: they are not
    // points on the scale.
    var ELO_ORDER = ['under 900', '900-999', 'never played (1000)', '1001-1099',
                     '1100-1199', '1200+', 'unrated'];
    renderBars('bars-elo', (w.elo || []).slice().sort(function (a, b) {
      return ELO_ORDER.indexOf(a.bucket) - ELO_ORDER.indexOf(b.bucket);
    }).map(function (e) {
      return { label: e.bucket, value: e.accounts, display: num(e.accounts) };
    }), { series: 3 });

    renderBars('bars-platform', (w.platforms || []).map(function (p) {
      return {
        label: p.platform,
        value: p.devices,
        display: num(p.devices),
        share: '(' + num(p.active30d) + ' active)'
      };
    }), { series: 4 });

    renderBars('bars-lobby', (w.lobbySizes || []).map(function (l) {
      return { label: l.size + (l.size === 1 ? ' player' : ' players'), value: l.games, display: num(l.games) };
    }), { series: 2 });

    renderBars('bars-guesses', (w.guessDistribution || []).map(function (g) {
      return { label: g.guesses + (g.guesses === 1 ? ' guess' : ' guesses'), value: g.count, display: num(g.count) };
    }), { series: 3 });

    // Sorted by time, not by volume: the question is which mode is slow, and a
    // list ordered by how much it was played answers a different one.
    renderBars('bars-solvetime', (w.solveTimeByMode || []).slice().sort(function (a, b) {
      return (a.avgSeconds || 0) - (b.avgSeconds || 0);
    }).map(function (s) {
      return { label: s.mode, value: s.avgSeconds, display: s.avgSeconds + 's', share: '(' + num(s.solves) + ')' };
    }), { series: 4 });

    renderBars('bars-openers', (w.openers || []).map(function (o) {
      return { label: o.word.toUpperCase(), value: o.count, display: num(o.count) };
    }), { series: 1 });

    renderBars('bars-busiest', (w.busiestDays || []).map(function (d) {
      return { label: shortDate(d.day) || d.day, value: d.games, display: num(d.games) };
    }), { series: 2 });

    var HOUR = 3600000;
    var DAY = 86400000;

    renderChart('chart-ccu', w.ccu, [{ key: 'peak', color: 'var(--series-2)' }], {
      label: 'Peak concurrent players per hour over the last 24 hours',
      stepMs: HOUR,
      timeOf: function (p) { return p.at; },
      labelAt: function (p) { return clockTime(p.at) || ''; },
      // The distinction the footnote under this chart is about. No samples at
      // all is the sampler not having run, which is not a fact about players.
      emptyText: 'no samples — the sampler records room state from memory and cannot backfill'
    });

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

    renderChart('chart-games', w.gamesPerDay, [{ key: 'games', color: 'var(--series-4)' }], {
      label: 'Games per day over the last 30 days',
      stepMs: DAY,
      timeOf: function (p) { return p.day; },
      labelAt: function (p) { return shortDate(p.day) || ''; }
    });

    renderRecentGames(w.recentGames);
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

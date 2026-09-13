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

  // Operator view. The public payload deliberately omits the live headcount and
  // the week/month curve, so this tile exists only when the server decided the
  // reader is the owner - it is not hidden markup waiting to be un-hidden.
  function renderOperatorExtras(data) {
    var host = document.querySelector('#panel-wordwarz .metrics');
    if (!host) return;

    var existing = document.getElementById('metric-live-now');
    if (!data.operator || !data.wordwarz || !data.wordwarz.live) {
      if (existing) existing.remove();
      return;
    }

    var tile = existing;
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'metric';
      tile.id = 'metric-live-now';
      tile.setAttribute('data-series', '3');
      tile.innerHTML =
        '<span class="metric-value"></span>' +
        '<span class="metric-label">In a room now</span>' +
        '<span class="metric-note">connected players, seats held for reconnects excluded</span>';
      host.appendChild(tile);
    }
    tile.querySelector('.metric-value').textContent = num(data.wordwarz.live.inRoom) || '0';
  }

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
        renderOperatorExtras(data);

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

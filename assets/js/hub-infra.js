/* Panel 6's figures.

   Three sources, in falling order of freshness, and the panel says which one
   it is showing rather than letting them blur together:

     1. `hub:status` carrying `vps` - the droplet's own collector, reached
        server-side by api/hub-status.js. Live, thirty seconds old at most.
     2. assets/vps-snapshot.json - a dated reading written by
        scripts/fetch-vps-snapshot.mjs. Re-read here so a refreshed snapshot
        reaches a browser holding a cached page.
     3. Whatever the generator wrote into the markup, which is what a reader
        with this file blocked sees, and is the same data as (2).

   The one thing it will not do is fill a field it has no value for. A figure
   that is missing renders as an em dash and carries data-vps-missing, because
   on a panel arguing that reachability is not host health, a plausible number
   is worse than none. */
(function () {
  'use strict';
  var panel = document.getElementById('panel-infrastructure');
  if (!panel) return;

  var note = panel.querySelector('.infra-note');
  var noteBase = note ? note.textContent : '';

  function set(path, value) {
    panel.querySelectorAll('[data-vps="' + path + '"]').forEach(function (el) {
      var missing = value === null || value === undefined || value === '';
      el.textContent = missing ? '—' : value;
      if (missing) el.setAttribute('data-vps-missing', 'true');
      else el.removeAttribute('data-vps-missing');
    });
  }

  function meter(stat, used, total, tone) {
    var host = panel.querySelectorAll('.host-stats .stat')[stat];
    if (!host) return;
    var bar = host.querySelector('.meter');
    if (!bar) return;
    var ok = isFinite(used) && isFinite(total) && total > 0;
    var p = ok ? Math.round((used / total) * 100) : 0;
    bar.querySelector('em').style.setProperty('--pct', p + '%');
    var label = bar.querySelector('b');
    label.textContent = ok ? p + '%' : '—';
    if (ok) label.removeAttribute('data-vps-missing');
    else label.setAttribute('data-vps-missing', 'true');
    if (tone) bar.setAttribute('data-tone', tone);
  }

  function paintHost(h) {
    if (!h) return;
    set('host.name', h.name);
    set('host.ip', h.ip);
    set('host.region', h.region);
    set('host.os', h.os);
    set('host.virt', h.virt);
    set('host.uptimeDays', isFinite(h.uptimeDays) ? h.uptimeDays + ' days' : null);
    if (h.cpu) {
      set('host.cpu.vcpu', isFinite(h.cpu.vcpu) ? h.cpu.vcpu + ' vCPU' : null);
      set('host.cpu.model', h.cpu.model);
    }
    if (h.ram) {
      set('host.ram', isFinite(h.ram.usedMb) ? h.ram.usedMb.toLocaleString('en-US') + ' / ' + h.ram.totalMb.toLocaleString('en-US') + ' MB' : null);
      meter(1, h.ram.usedMb, h.ram.totalMb, 'warn');
    }
    if (h.disk) {
      set('host.disk', isFinite(h.disk.usedGb) ? h.disk.usedGb + ' / ' + h.disk.totalGb + ' GB' : null);
      meter(2, h.disk.usedGb, h.disk.totalGb);
    }
  }

  function paint(d, live) {
    if (!d) return;
    paintHost(d.host);
    if (d.security) set('security.blocked', isFinite(d.security.blocked) ? d.security.blocked.toLocaleString('en-US') : null);
    if (note) {
      var when = isFinite(Date.parse(d.generatedAt)) ? new Date(d.generatedAt) : null;
      note.textContent = live
        ? 'Live from the droplet’s collector, read server-side · ' + (when ? when.toLocaleTimeString() : 'time unavailable') + ' · refreshed every 30s. This page can read and nothing else.'
        : noteBase;
    }
  }

  // The two services the hub already probes get their real state from the poll
  // the page is making anyway. A row the poll does not cover keeps whatever
  // the snapshot said, and is not quietly promoted to "running".
  var PROBED = { 'api.wordwarz.io': 'wordwarz-api', 'mdspro.kimlj.dev': 'mdspro-api' };
  document.addEventListener('hub:status', function (event) {
    var data = event.detail;
    if (data && data.vps) { paint(data.vps, true); return; }
    if (!data || !data.services) return;
    panel.querySelectorAll('.rail-row').forEach(function (row) {
      var id = PROBED[row.firstElementChild.textContent.trim()];
      if (!id) return;
      var svc = (data.services || []).find(function (s) { return s.id === id; });
      var state = row.querySelector('.rail-state');
      if (!svc || !state) return;
      var tone = svc.state === 'up' ? 'running' : svc.state === 'degraded' ? 'degraded' : 'down';
      state.setAttribute('data-state', tone === 'running' ? 'running' : tone);
      state.querySelector('.state-dot').setAttribute('data-state', svc.state);
      state.lastChild.textContent = tone;
    });
  });

  function refresh() {
    fetch('/assets/vps-snapshot.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('snapshot unavailable');
      return r.json();
    }).then(function (d) {
      if (!d || !d.host || !isFinite(Date.parse(d.generatedAt))) throw new Error('invalid snapshot');
      paint(d, false);
    }).catch(function () { /* the markup already carries the last good reading */ });
  }
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 30000);
})();

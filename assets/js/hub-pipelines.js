(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-pipeline]').forEach(function (host) {
    var nodes = Array.from(host.querySelectorAll('.pipeline-node'));
    var output = host.querySelector('[data-output]');
    var counter = host.querySelector('[data-step]');
    var pause = host.querySelector('[data-pause]');
    var index = 0;
    var paused = reduced.matches;
    function paint() {
      nodes.forEach(function (node, i) { node.dataset.current = String(i === index); });
      output.textContent = nodes[index].dataset.detail;
      counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(nodes.length).padStart(2, '0');
      pause.textContent = paused ? 'Play' : 'Pause';
      pause.setAttribute('aria-pressed', String(paused));
    }
    pause.addEventListener('click', function () { paused = !paused; paint(); });
    host.querySelector('[data-next]').addEventListener('click', function () { paused = true; index = (index + 1) % nodes.length; paint(); });
    reduced.addEventListener('change', function () { paused = reduced.matches; paint(); });
    setInterval(function () {
      if (paused || document.hidden || host.closest('.panel').dataset.active !== 'true') return;
      index = (index + 1) % nodes.length;
      paint();
    }, 2800);
    paint();
  });

  document.addEventListener('hub:status', function (event) {
    var data = event.detail;
    var host = document.querySelector('[data-infra-services]');
    var stamp = document.querySelector('[data-infra-stamp]');
    var healthy = document.querySelector('[data-infra="healthy"]');
    var latency = document.querySelector('[data-infra="latency"]');
    if (!host) return;
    if (!data) {
      healthy.textContent = latency.textContent = '—';
      host.querySelectorAll('.dot').forEach(function (dot) { dot.dataset.state = 'unknown'; });
      host.querySelectorAll('.lat').forEach(function (label) { label.textContent = 'unknown'; });
      stamp.textContent = 'Service probes unavailable · host telemetry not connected';
      return;
    }
    var services = (data.services || []).filter(function (s) { return s.id === 'mdspro-api' || s.id === 'wordwarz-api'; });
    var up = services.filter(function (s) { return s.state === 'up' || s.state === 'degraded'; });
    healthy.textContent = services.length === 2 ? String(up.length) : '—';
    latency.textContent = up.length ? String(Math.round(up.reduce(function (sum, s) { return sum + s.latencyMs; }, 0) / up.length)) : '—';
    host.textContent = '';
    ['mdspro-api', 'wordwarz-api'].forEach(function (id) {
      var service = services.find(function (s) { return s.id === id; });
      var row = document.createElement('div'); row.className = 'svc-row';
      var dot = document.createElement('span'); dot.className = 'dot'; dot.dataset.state = service ? service.state : 'unknown';
      var label = document.createElement('span'); label.textContent = id === 'mdspro-api' ? 'MDS Pro API' : 'WordWarz API';
      var status = document.createElement('span'); status.className = 'lat'; status.textContent = service ? service.state + (service.state !== 'down' ? ' \u00b7 ' + service.latencyMs + 'ms' : '') : 'unknown';
      row.append(dot, label, status); host.appendChild(row);
    });
    var checked = new Date(data.generatedAt);
    stamp.textContent = 'Service probes · ' + (isNaN(checked.getTime()) ? 'time unavailable' : checked.toLocaleTimeString()) + ' · refreshed every 30s · host telemetry not connected';
  });

  var evidence = document.querySelector('[data-job-evidence]');
  var view = 'sources';
  var data = null;
  function render() {
    if (!data) return;
    if (view === 'database') {
      evidence.innerHTML = '';
      ['jobs → scored postings', 'processed_emails → inbox deduplication', 'applied_jobs → application receipts', 'sheet_stages → user decisions', 'source_runs → last source check'].forEach(function (line) {
        var row = document.createElement('div'); row.className = 'schema-line'; row.textContent = line; evidence.appendChild(row);
      });
      return;
    }
    var rows = data[view];
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; }).concat([1]));
    evidence.innerHTML = '';
    var grid = document.createElement('div'); grid.className = 'evidence-grid';
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'evidence-row';
      var label = document.createElement('span'); label.textContent = r.name;
      var value = document.createElement('b'); value.textContent = r.count.toLocaleString('en-US');
      var track = document.createElement('i'); var bar = document.createElement('em');
      bar.style.setProperty('--bar', (r.count / max * 100) + '%'); track.appendChild(bar);
      row.append(label, value, track); grid.appendChild(row);
    });
    evidence.appendChild(grid);
  }
  document.querySelectorAll('[data-evidence-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      view = button.dataset.evidenceView;
      document.querySelectorAll('[data-evidence-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      render();
    });
  });
  function refresh() {
    fetch('/assets/jobsift-stats.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Snapshot unavailable');
      return r.json();
    }).then(function (payload) {
      if (!payload.counts || !Array.isArray(payload.sources) || !Array.isArray(payload.stages) || !Number.isFinite(Date.parse(payload.generatedAt))) throw new Error('Invalid snapshot');
      data = payload;
      document.querySelectorAll('[data-job-count]').forEach(function (el) {
        var value = data.counts[el.dataset.jobCount];
        el.textContent = Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
      });
      document.querySelector('[data-job-stamp]').textContent = 'Database snapshot · exported ' + new Date(data.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' PHT · latest job ' + (data.latestJobAt ? new Date(data.latestJobAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric' }) : 'unavailable') + ' · checks every 30s';
      render();
    }).catch(function () {
      var stamp = document.querySelector('[data-job-stamp]');
      if (stamp.textContent.indexOf('Refresh unavailable') !== 0) stamp.textContent = 'Refresh unavailable · ' + stamp.textContent;
    });
  }
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 30000);
})();

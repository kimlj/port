(function () {
  'use strict';
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

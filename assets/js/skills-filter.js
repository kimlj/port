/* Section 04 — the skills list, filtered by the work it came from.
 *
 * The list's whole claim is that every line can be checked against a section
 * above it. Chips let the reader run that check the other way round: pick a
 * piece of work, see what it was built with. On a page arguing for verifiable
 * claims, handing over the query is the argument rather than a flourish.
 *
 * The index is read off the markup — each mention carries the project it
 * belongs to as data-proj, each row the set as data-projs — so there is no
 * second copy of the mapping to fall out of step with the list, the same
 * reason ai-ledger.js builds its rows from the panels.
 *
 * Nothing here is required to read the section. The chips and the tally are
 * created by this file, so with the script gone or failed the list is exactly
 * the list, which is why they are not in the markup.
 */
(function () {
  'use strict';

  var ledger = document.querySelector('#skills .skill-ledger');
  if (!ledger) return;

  var rows = Array.prototype.slice.call(ledger.querySelectorAll('.skill-row[data-projs]'));
  if (!rows.length) return;

  /* Display names for the keys, in the order Selected Work introduces them, so
     the chips read down the page in the order the reader met the work. A key
     with no name here simply gets no chip. */
  var NAMES = {
    ww: 'WordWarz.io',
    mds: 'MDS Pro',
    rcd: 'RecodeAI',
    jm: 'AI Job Matcher',
    jew: 'Job Email Watcher',
    csn: 'Casinore.io',
    pipe: 'AI pipelines',
    site: 'this page'
  };
  var ORDER = ['ww', 'mds', 'rcd', 'jm', 'jew', 'csn', 'pipe', 'site'];

  /* Only offer a chip for work the list actually mentions — a filter that can
     return nothing is a filter that shouldn't have been offered. */
  var present = {};
  rows.forEach(function (row) {
    row.getAttribute('data-projs').split(' ').forEach(function (k) {
      if (k) present[k] = (present[k] || 0) + 1;
    });
  });
  var keys = ORDER.filter(function (k) { return present[k] && NAMES[k]; });
  if (keys.length < 2) return;

  var bar = document.createElement('div');
  bar.className = 'skill-filters';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Filter technologies by project');

  var tally = document.createElement('p');
  tally.className = 'skill-tally';
  /* aria-live so the count is announced when a chip changes it; the dimming
     itself carries no information a screen reader can use. */
  tally.setAttribute('aria-live', 'polite');

  var active = null;
  var chips = keys.map(function (k) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-chip';
    btn.textContent = NAMES[k];
    btn.setAttribute('data-proj', k);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      active = (active === k) ? null : k;
      apply();
    });
    bar.appendChild(btn);
    return btn;
  });

  function apply() {
    rows.forEach(function (row) {
      var on = !active ||
        row.getAttribute('data-projs').split(' ').indexOf(active) > -1;
      row.classList.toggle('is-out', !on);
      Array.prototype.forEach.call(
        row.querySelectorAll('.skill-where span'),
        function (span) {
          span.classList.toggle('is-hit',
            !!active && span.getAttribute('data-proj') === active);
        });
    });

    chips.forEach(function (btn) {
      btn.setAttribute('aria-pressed',
        btn.getAttribute('data-proj') === active ? 'true' : 'false');
    });

    setTally();
  }

  /* The resting line states the whole set rather than sitting empty, so the
     section still says something true to a reader who never clicks. */
  function setTally() {
    while (tally.firstChild) tally.removeChild(tally.firstChild);
    var b = document.createElement('b');
    if (active) {
      b.textContent = present[active];
      tally.appendChild(b);
      tally.appendChild(document.createTextNode(
        ' of ' + rows.length + ' used in ' + NAMES[active] +
        ' · click again to clear'));
    } else {
      b.textContent = rows.length;
      tally.appendChild(b);
      tally.appendChild(document.createTextNode(
        ' technologies across ' + keys.length +
        ' pieces of work · pick one to filter'));
    }
  }

  ledger.parentNode.insertBefore(bar, ledger);
  ledger.parentNode.insertBefore(tally, ledger.nextSibling);
  apply();
})();

/* Section 04 on a phone — the names two-up, the provenance one tap away.
 *
 * Below 640px the list ran to about three and a half screens: one column of 27
 * rows, each stacking its name over the work it was used in. Here the names go
 * two to a line and every group carries a single drawer showing the provenance
 * of whichever of its rows was last tapped.
 *
 * One drawer per group, not one for the list, and it sits after every row in
 * its group — so the tapped row never moves and nothing above the reader's
 * finger shifts. That is also why tapping in one group leaves another group's
 * drawer open: closing a drawer higher up the page would pull the whole list
 * up under the thumb that just tapped. Only what is below the group moves.
 *
 * The drawer's text is read off the row's own .skill-where, so there is no
 * second copy of the provenance to fall out of step with the list — the same
 * reason the chips above read their index off the markup.
 *
 * The structure is built at every width but only wired up below 640px, and the
 * CSS that hides .skill-where is gated on the .ev-tappable class added here.
 * With this file gone the section is exactly the list it always was.
 */
(function () {
  'use strict';

  var ledger = document.querySelector('#skills .skill-ledger');
  if (!ledger) return;

  var groups = Array.prototype.slice.call(ledger.querySelectorAll('.skill-group'));
  if (!groups.length) return;

  var mq = window.matchMedia('(max-width: 640px)');
  var units = [];

  groups.forEach(function (group) {
    var rows = Array.prototype.slice.call(group.querySelectorAll('.skill-row'));
    if (!rows.length) return;

    /* The rows need a wrapper of their own before they can run two-up: the
       group's heading is its sibling, and a grid on the group would column it
       alongside the first row. */
    var body = document.createElement('div');
    body.className = 'ev-group-body';
    group.insertBefore(body, rows[0]);
    rows.forEach(function (row) { body.appendChild(row); });

    var drawer = document.createElement('div');
    drawer.className = 'ev-drawer';
    var clip = document.createElement('div');
    clip.className = 'ev-drawer-clip';
    var inner = document.createElement('div');
    inner.className = 'ev-drawer-inner';
    clip.appendChild(inner);
    drawer.appendChild(clip);
    group.appendChild(drawer);

    var open = null;

    function close() {
      drawer.classList.remove('is-open');
      rows.forEach(function (r) { r.setAttribute('aria-expanded', 'false'); });
      open = null;
    }

    function toggle(row) {
      if (open === row) { close(); return; }
      close();
      row.setAttribute('aria-expanded', 'true');

      while (inner.firstChild) inner.removeChild(inner.firstChild);
      var name = row.querySelector('.skill-name');
      var b = document.createElement('b');
      b.textContent = (name ? name.textContent : '') + ' — ';
      inner.appendChild(b);
      inner.appendChild(document.createTextNode(
        Array.prototype.map.call(
          row.querySelectorAll('.skill-where span'),
          function (s) { return s.textContent; }
        ).join(' · ')));

      drawer.classList.add('is-open');
      open = row;
    }

    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        if (mq.matches) toggle(row);
      });
      /* role="button" promises Enter and Space; the row is a div, so they have
         to be answered here rather than inherited. */
      row.addEventListener('keydown', function (e) {
        if (!mq.matches) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggle(row);
        }
      });
    });

    units.push({ rows: rows, close: close });
  });

  if (!units.length) return;

  /* Nothing is a control above 640px, so the roles come off with the layout —
     27 buttons that do nothing is worse than 27 rows that never claimed to. */
  function sync() {
    var on = mq.matches;
    ledger.classList.toggle('ev-tappable', on);
    units.forEach(function (u) {
      u.close();
      u.rows.forEach(function (row) {
        if (on) {
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.setAttribute('aria-expanded', 'false');
        } else {
          row.removeAttribute('role');
          row.removeAttribute('tabindex');
          row.removeAttribute('aria-expanded');
        }
      });
    });
  }

  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);
  sync();
})();

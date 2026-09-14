(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-workflow]').forEach(function (player) {
    var panel = player.closest('.panel');
    var scenes = Array.from(player.querySelectorAll('[data-scene]'));
    var steps = Array.from(player.querySelectorAll('[data-goto]'));
    var play = player.querySelector('[data-play]');
    var status = player.querySelector('[data-run-status]');
    var index = 0;
    var elapsed = motion.matches ? 8800 : 0;
    var paused = motion.matches;
    var last = performance.now();
    var choice = 'Approved';
    var duration = 8800;
    var beatLength = duration / 4;

    function isVisible() {
      return !document.hidden && panel.dataset.active === 'true' && panel.dataset.consoleMode === 'workflow';
    }
    function paint() {
      var beat = Math.min(3, Math.floor(elapsed / beatLength));
      player.dataset.beat = String(beat);
      player.dataset.paused = String(paused);
      player.dataset.suspended = String(!isVisible());
      player.style.setProperty('--step-progress', String(Math.min(1, elapsed / duration)));
      play.textContent = paused ? 'Play' : 'Pause';
      play.setAttribute('aria-pressed', String(!paused));
      scenes.forEach(function (scene, i) { scene.hidden = i !== index; });
      steps.forEach(function (button, i) {
        button.setAttribute('aria-pressed', String(i === index));
        button.dataset.complete = String(i < index);
      });
      var scene = scenes[index];
      scene.querySelectorAll('[data-reveal]').forEach(function (el) { el.dataset.visible = String(Number(el.dataset.reveal) <= beat); });
      scene.querySelectorAll('[data-until]').forEach(function (el) { el.hidden = beat >= Number(el.dataset.until); });
      scene.querySelectorAll('[data-log]').forEach(function (el, i) {
        el.dataset.state = i < beat ? 'done' : i === beat ? 'current' : 'pending';
        el.setAttribute('aria-hidden', String(i > beat));
      });
      scene.querySelectorAll('[data-count-to]').forEach(function (el) {
        var starts = Number(el.dataset.countBeat) * beatLength;
        var fraction = Math.max(0, Math.min(1, (elapsed - starts) / 900));
        el.textContent = String(Math.round(Number(el.dataset.countTo) * (1 - Math.pow(1 - fraction, 3))));
      });
      scene.querySelectorAll('[data-pending-count]').forEach(function (el) { el.textContent = beat < 2 ? '1' : '0'; });
      player.querySelectorAll('[data-review-value]').forEach(function (el) { el.textContent = choice; });
      player.querySelectorAll('[data-review]').forEach(function (button) { button.dataset.selected = String(beat === 3 && button.dataset.review === choice); button.setAttribute('aria-pressed', button.dataset.selected); });
      var currentLog = scene.querySelector('[data-log="' + beat + '"] > span:nth-child(2)');
      status.textContent = (paused ? 'Paused · ' : 'Replaying · ') + (currentLog ? currentLog.textContent : 'Sample workflow');
    }
    function jump(next, full) {
      index = (next + scenes.length) % scenes.length;
      elapsed = full ? duration : 0;
      if (full) paused = true;
      last = performance.now();
      paint();
    }
    play.addEventListener('click', function () {
      paused = !paused;
      if (!paused && elapsed >= duration) elapsed = 0;
      last = performance.now();
      paint();
    });
    player.querySelector('[data-advance]').addEventListener('click', function () { jump(index + 1, true); });
    player.querySelector('[data-restart]').addEventListener('click', function () {
      choice = 'Approved'; paused = motion.matches; jump(0, motion.matches);
    });
    steps.forEach(function (button) { button.addEventListener('click', function () { jump(Number(button.dataset.goto), true); }); });
    player.querySelectorAll('[data-review]').forEach(function (button) {
      button.addEventListener('click', function () {
        choice = button.dataset.review; elapsed = duration; paused = true; paint();
      });
    });
    panel.querySelectorAll('.console-mode button').forEach(function (button) {
      button.addEventListener('click', function () {
        panel.dataset.consoleMode = button.dataset.consoleMode;
        panel.querySelectorAll('.console-mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        last = performance.now(); paint();
      });
    });
    motion.addEventListener('change', function () {
      paused = motion.matches;
      if (motion.matches) elapsed = duration;
      last = performance.now(); paint();
    });
    document.addEventListener('visibilitychange', function () { last = performance.now(); paint(); });
    new MutationObserver(function () { last = performance.now(); paint(); }).observe(panel, { attributes: true, attributeFilter: ['data-active'] });
    setInterval(function () {
      var now = performance.now();
      var delta = Math.min(now - last, 300);
      last = now;
      if (paused || !isVisible()) return;
      elapsed += delta;
      if (elapsed >= duration) {
        if (index === scenes.length - 1) choice = 'Approved';
        jump(index + 1, false);
      } else paint();
    }, 100);
    paint();
  });
})();

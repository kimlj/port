/* Load demonstrations only when visible, and stop decoding closed panels. */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var videos = Array.from(document.querySelectorAll('video'));
  var seen = new WeakMap();
  function refresh(video) {
    var panel = video.closest('.work-item');
    var allowed = !!seen.get(video) && !document.hidden && (!panel || panel.classList.contains('is-on'));
    if (!allowed) { video.pause(); return; }
    if (!video.dataset.loaded) {
      video.querySelectorAll('source[data-src]').forEach(function (source) {
        source.src = source.dataset.src;
        delete source.dataset.src;
      });
      video.dataset.loaded = 'true';
      video.preload = reduced.matches ? 'metadata' : 'auto';
      video.load();
    }
    if (reduced.matches) { video.pause(); return; }
    var playing = video.play();
    if (playing && playing.catch) playing.catch(function () {});
  }
  function all() { videos.forEach(refresh); }
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { seen.set(entry.target, entry.isIntersecting); refresh(entry.target); });
    }, { rootMargin: '100px', threshold: 0.01 });
    videos.forEach(function (video) { observer.observe(video); });
  } else { videos.forEach(function (video) { seen.set(video, true); }); all(); }
  addEventListener('portfolio:media-change', all);
  document.addEventListener('visibilitychange', all);
  if (reduced.addEventListener) reduced.addEventListener('change', all);
  // Clipped and inactive galleries must not download just because their DOM exists.
  var images = Array.from(document.querySelectorAll('img[data-src]'));
  function loadImage(image) {
    if (!image.dataset.src) return;
    image.src = image.dataset.src;
    image.dataset.loaded = 'true';
    delete image.dataset.src;
  }
  if ('IntersectionObserver' in window) {
    var imageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || !entry.intersectionRect.width || !entry.intersectionRect.height) return;
        loadImage(entry.target);
        imageObserver.unobserve(entry.target);
      });
    }, { rootMargin: '200px', threshold: 0.01 });
    images.forEach(function (image) { imageObserver.observe(image); });
  } else images.forEach(loadImage);
  window.portfolioMedia = { refresh: all };
})();

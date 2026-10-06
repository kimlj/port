# Portfolio performance verification

Measured locally with Lighthouse 13.5.0 and a headless Chromium 154 browser.
The before and after use the same simulated throttling, static server and Brotli.
External challenge requests were blocked equally in both runs. These are local
lab results, not a production PageSpeed retest.

| Mobile metric | Before | After |
|---|---|---|
| Performance | 58 | 94 |
| first-contentful-paint | 1.8 s | 1.4 s |
| largest-contentful-paint | 5.8 s | 2.8 s |
| total-blocking-time | 560 ms | 160 ms |
| cumulative-layout-shift | 0 | 0 |
| speed-index | 6.6 s | 1.4 s |
| mainthread-work-breakdown | 5.9 s | 2.3 s |
| total-byte-weight | Total size was 7,804 KiB | Total size was 329 KiB |

Desktop performance: 97 -> 97. Final accessibility, best practices and
SEO: 100 on both. Agentic browsing: 1/2 -> 2/2 on both.

## Behavior and trade-offs

- Phones show the hero immediately; the film and its heavy setup run on request.
  Desktop retains the original once-per-fortnight autoplay and explicit `?film` links.
- Touch cinematic/ornament rendering has a 30fps budget. The story, soundtrack,
  play/pause/seek/skip controls and scenes remain available.
- Videos, gallery images, adjacent comparison prefetching, activity data and GPU
  effects wait until their sections or panels are needed. A first opening can
  have a loading pause, especially for video over slow connections.
- Image dimensions reserve space. Responsive image rules retain aspect ratios.
  The 512px portrait is chosen for smaller slots; the original serves larger ones.
- Existing fonts, styles and requested weights are self-hosted with original OFL
  licenses. Text contrast is brighter; closed menu controls are inert and its
  expanded state is exposed. Calendar days have valid image roles and labels.
- Build-only esbuild minifies delivered files and inlines font CSS; readable
  source and existing private assistant sync/corpus generation are preserved.

## Verification

The static build and four regression checks pass. Headless browser checks cover
390/768/1440px in light/dark, reduced motion, no overflow, mobile menu/Escape,
lazy project videos, labeled calendar days, phone requested film playback,
desktop autoplay, pause/seek/skip, visible comparison images and next-image
navigation, workflow image aspect ratio, deferred form verification (mock SDK),
and the minified hub without live API data. No real form messages were sent.

Run `npm run build:static` and `npm test` for local checks. The normal production
build still syncs the assistant before publishing its allowlisted public output.

Reports and screenshots are in ignored `.performance-reports/`.

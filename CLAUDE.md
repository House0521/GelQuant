# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Vite HMR)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

No test runner is configured.

## What this app is

**GelQuant** — a browser-only SPA for quantifying protein bands in fluorescence gel images. No backend, no auth, no routing. All processing runs client-side using Canvas/OffscreenCanvas APIs.

## Architecture

`App.svelte` owns all state and orchestrates the workflow:
1. User uploads an image → stored as a data URL and an `Image` object
2. User drags on the canvas to define **lanes** (rectangular column regions)
3. User clicks **Analyze** → `analysis.js` functions run in sequence per lane
4. Results appear as intensity profile charts and a quantification table

**Lane object shape** (held in `App.svelte`'s `lanes` array):
```js
{ id, label, color, x1, x2, y1, y2, profile, smoothedProfile, bands }
```
`profile` and `bands` are `null` until analysis runs; analysis is re-triggered by resetting `analyzed = false` any time settings change (reactive statement in App).

**Analysis pipeline** (`src/lib/analysis.js` — pure functions, no side effects):
- `extractLaneProfile(img, lane, invert)` — draws the lane crop into an OffscreenCanvas, averages pixel luminance per row → `Float32Array`
- `gaussianSmooth(profile, sigma)` — 1-D Gaussian kernel convolution (mirror-padding at edges)
- `detectBands(smoothed, minProminence)` — local maxima with prominence filter; computes trapezoid area per band between midpoint boundaries
- `assignRelative(lanes)` — normalises band areas to the global max across all lanes → adds `relative` (%)

**Components:**
- `ImageCanvas.svelte` — renders the gel on a `<canvas>`, overlays an SVG for lane drawing/selection/resizing. Emits `addlane`, `laneselect`, `laneschange` events up to App.
- `LaneProfile.svelte` — fixed-size SVG line chart (280×120 px chart area) showing raw (faint) and smoothed profiles, with band region overlays.
- `ResultsTable.svelte` — tabular view of all bands; Export CSV triggers a Blob download in App.

**Styling:** dark-only design token system via CSS custom properties defined in `src/app.css` (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-dim`). All component styles are scoped. No CSS framework.

## Key constraints

- Svelte 5 is in use — use runes (`$state`, `$derived`, `$effect`) for any new reactive state rather than the legacy `$:` reactive statement style, unless editing existing code that already uses legacy syntax.
- All image processing must stay client-side (OffscreenCanvas). No file uploads to any server.
- The PWA assets (`public/manifest.json`, `public/sw.js`) are static and manually maintained.

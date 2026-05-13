<script>
  import ImageCanvas from './lib/ImageCanvas.svelte';
  import LaneProfile from './lib/LaneProfile.svelte';
  import ResultsTable from './lib/ResultsTable.svelte';
  import { extractLaneProfile, gaussianSmooth, detectBands, assignRelative } from './lib/analysis.js';

  const COLORS = ['#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#f97316','#22d3ee','#fb7185'];

  let imageDataUrl = null;
  let img = null;
  let lanes = [];
  let selectedId = null;
  let invertMode = false;
  let sigma = 3;
  let minProminence = 200;
  let analyzed = false;
  let analyzing = false;
  let fileInput;
  let zoom = 1;
  let rotation = 0;
  let imgW = 0;
  let imgH = 0;

  // Visual (post-rotation) dimensions — 90/270 swaps W and H
  $: isRotated90 = rotation === 90 || rotation === 270;
  $: visW = isRotated90 ? imgH : imgW;
  $: visH = isRotated90 ? imgW : imgH;

  function zoomIn()  { zoom = parseFloat((zoom + 0.05).toFixed(2)); }
  function zoomOut() { zoom = Math.max(0.01, parseFloat((zoom - 0.05).toFixed(2))); }
  function handleZoomInput(e) {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) zoom = v / 100;
  }
  function rotateLeft()  { rotation = (rotation - 90 + 360) % 360; }
  function rotateRight() { rotation = (rotation + 90) % 360; }
  function resetView()   { zoom = 1; rotation = 0; }

  // Reset analysis when settings change
  $: { invertMode; sigma; minProminence; analyzed = false; }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      imageDataUrl = ev.target.result;
      img = new Image();
      img.src = imageDataUrl;
      lanes = [];
      analyzed = false;
      selectedId = null;
    };
    reader.readAsDataURL(file);
  }

  function handleAddLane({ detail }) {
    const horiz = detail.direction === 'h';
    lanes = [...lanes, {
      id: Date.now(),
      label: `Lane ${lanes.length + 1}`,
      color: COLORS[lanes.length % COLORS.length],
      direction: detail.direction,
      x1: horiz ? 0 : detail.x1,
      x2: horiz ? (img?.naturalWidth ?? 0) : detail.x2,
      y1: horiz ? detail.y1 : 0,
      y2: horiz ? detail.y2 : (img?.naturalHeight ?? 0),
      profile: null,
      smoothedProfile: null,
      bands: [],
    }];
    analyzed = false;
  }

  function handleLanesChange({ detail }) {
    lanes = detail;
    analyzed = false;
  }

  function removeLane(id) {
    lanes = lanes
      .filter(l => l.id !== id)
      .map((l, i) => ({ ...l, label: `Lane ${i + 1}` }));
    if (selectedId === id) selectedId = null;
    analyzed = false;
  }

  function renameLane(id, newLabel) {
    lanes = lanes.map(l => l.id === id ? { ...l, label: newLabel } : l);
  }

  async function analyze() {
    if (!img || !lanes.length || analyzing) return;
    analyzing = true;
    await new Promise(r => {
      if (img.complete && img.naturalHeight > 0) { r(); return; }
      img.onload = r;
      img.onerror = r;
    });
    if (!img.naturalHeight) {
      analyzing = false;
      return;
    }
    const updated = lanes.map(lane => {
      const profile = extractLaneProfile(img, lane, invertMode);
      const smoothedProfile = gaussianSmooth(profile, sigma);
      const bands = detectBands(smoothedProfile, minProminence);
      return { ...lane, profile, smoothedProfile, bands };
    });
    lanes = assignRelative(updated);
    analyzed = true;
    analyzing = false;
  }

  function exportCSV() {
    const rows = lanes.flatMap(l =>
      l.bands.map((b, i) =>
        `${l.label},${i + 1},${b.peak},${b.area.toFixed(1)},${b.prominence.toFixed(1)},${b.relative.toFixed(1)}`
      )
    );
    const csv = ['Lane,Band,Peak (px),Area (AU),Prominence,Relative (%)'].concat(rows).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'gelquant_results.csv',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $: hasProfiles = analyzed && lanes.some(l => l.smoothedProfile?.length);
  $: hasBands = analyzed && lanes.some(l => l.bands?.length);
</script>

<header>
  <span class="logo">GelQuant</span>
  <span class="tagline">Protein fluorescence band analyzer</span>
</header>

<main>
  <aside class="sidebar">
    <section class="panel">
      <h3>Image</h3>
      <input bind:this={fileInput} type="file" accept="image/*" on:change={handleFile} hidden />
      <button class="btn-primary" on:click={() => fileInput.click()}>
        {imageDataUrl ? 'Change Image' : 'Upload Image'}
      </button>
    </section>

    {#if imageDataUrl}
      <section class="panel">
        <h3>Analysis Settings</h3>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={invertMode} />
          Dark bands (invert intensity)
        </label>
        <label class="range-label">
          <div class="param-row">
            <span>Smoothing (σ)</span>
            <input type="number" min="0.5" max="10" step="0.5" bind:value={sigma} class="num-input" />
          </div>
          <input type="range" min="0.5" max="10" step="0.5" bind:value={sigma} />
        </label>
        <label class="range-label">
          <div class="param-row">
            <span>Min prominence</span>
            <input type="number" min="10" max="5000" step="10" bind:value={minProminence} class="num-input" />
          </div>
          <input type="range" min="10" max="5000" step="10" bind:value={minProminence} />
        </label>
      </section>

      <section class="panel">
        <h3>Lanes ({lanes.length})</h3>
        <p class="hint">Drag on image to define a lane<br>Right-click a lane to remove it</p>

        <div class="lane-list">
          {#each lanes as lane (lane.id)}
            <div
              class="lane-row"
              class:selected={selectedId === lane.id}
              on:click={() => selectedId = lane.id}
              on:keydown={e => e.key === 'Enter' && (selectedId = lane.id)}
              role="button"
              tabindex="0">
              <span class="dot" style="background:{lane.color}"></span>
              <input
                class="lane-name"
                value={lane.label}
                on:input={e => renameLane(lane.id, e.target.value)}
                on:click|stopPropagation />
              <button
                class="rm-btn"
                on:click|stopPropagation={() => removeLane(lane.id)}
                aria-label="Remove {lane.label}">×</button>
            </div>
          {/each}
        </div>

        {#if lanes.length > 0}
          <button class="btn-analyze" on:click={analyze} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        {/if}
      </section>
    {/if}
  </aside>

  <div class="workspace">
    {#if imageDataUrl}
      <div class="view-controls">
        <button class="icon-btn" on:click={zoomOut} title="Zoom out">−</button>
        <input
          class="zoom-input"
          type="number"
          min="1"
          step="5"
          value={Math.round(zoom * 100)}
          on:change={handleZoomInput}
          title="Zoom %" />
        <button class="icon-btn" on:click={zoomIn} title="Zoom in">+</button>
        <div class="ctrl-sep"></div>
        <button class="icon-btn" on:click={rotateLeft} title="Rotate 90° left">↺</button>
        <button class="icon-btn" on:click={rotateRight} title="Rotate 90° right">↻</button>
        {#if zoom !== 1 || rotation !== 0}
          <button class="icon-btn reset-btn" on:click={resetView} title="Reset view">Reset</button>
        {/if}
      </div>
      <!-- Outer wrapper reserves the correct layout space for the rotated+scaled image -->
      <div class="canvas-wrapper" style="width:{visW * zoom}px; height:{visH * zoom}px;">
        <!-- Inner div is centered in the wrapper, then rotated+scaled around its own center -->
        <div class="canvas-area" style="
          top:{(visH * zoom - imgH) / 2}px;
          left:{(visW * zoom - imgW) / 2}px;
          width:{imgW}px;
          height:{imgH}px;
          transform: rotate({rotation}deg) scale({zoom});
          transform-origin: center center;
        ">
          <ImageCanvas
            {imageDataUrl}
            {lanes}
            {selectedId}
            {rotation}
            bind:imgW
            bind:imgH
            on:addlane={handleAddLane}
            on:laneselect={({ detail }) => selectedId = detail}
            on:laneschange={handleLanesChange} />
        </div>
      </div>

      {#if hasProfiles}
        <div class="profiles">
          {#each lanes.filter(l => l.smoothedProfile) as lane (lane.id)}
            <LaneProfile {lane} selected={selectedId === lane.id} />
          {/each}
        </div>
      {/if}
      {#if hasBands}
        <ResultsTable {lanes} onexport={exportCSV} />
      {/if}
    {:else}
      <div class="empty">
        <div class="empty-circle"></div>
        <p>Upload a gel image to begin</p>
        <p class="hint">Supports JPEG, PNG, TIFF and other browser-readable formats</p>
      </div>
    {/if}
  </div>
</main>

<style>
  header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex-shrink: 0;
  }
  .logo {
    font-size: 18px;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tagline {
    font-size: 12px;
    color: var(--text-muted);
  }

  main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .panel h3 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin: 0;
  }
  .hint {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .btn-primary {
    padding: 7px 12px;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.85; }

  .btn-analyze {
    padding: 7px 12px;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    margin-top: 4px;
  }
  .btn-analyze:hover { background: var(--accent-dim); }
  .btn-analyze:disabled { opacity: 0.4; cursor: not-allowed; }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text);
  }

  .range-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .range-label input[type="range"] { width: 100%; }
  .param-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .num-input {
    width: 58px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 11px;
    padding: 2px 5px;
    text-align: right;
  }

  .lane-list { display: flex; flex-direction: column; gap: 4px; }

  .lane-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: border-color 0.12s, background 0.12s;
  }
  .lane-row:hover { background: var(--surface2); }
  .lane-row.selected {
    border-color: var(--border);
    background: var(--surface2);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .lane-name {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 13px;
    outline: none;
    min-width: 0;
  }
  .rm-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    transition: color 0.12s;
  }
  .rm-btn:hover { color: #f87171; }

  /* ── View controls toolbar ── */
  .view-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .icon-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    font-size: 15px;
    line-height: 1;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
  }
  .icon-btn:hover { background: var(--accent-dim); color: var(--accent); }
  .reset-btn { font-size: 11px; width: auto; padding: 0 8px; }
  .zoom-input {
    width: 52px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 11px;
    padding: 2px 5px;
    text-align: right;
    height: 28px;
  }
  .ctrl-sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 2px;
  }

  /* ── Workspace ── */
  .workspace {
    flex: 1;
    overflow: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  .canvas-wrapper {
    position: relative;
    flex-shrink: 0;
  }
  .canvas-area {
    position: absolute;
  }

  .profiles {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-muted);
    text-align: center;
    width: 100%;
    min-height: 300px;
  }
  .empty-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px dashed var(--border);
    margin-bottom: 8px;
  }
  .empty p { font-size: 15px; color: var(--text-muted); }
  .empty .hint { font-size: 12px; }
</style>

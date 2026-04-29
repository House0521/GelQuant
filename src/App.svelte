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
  let minProminence = 5;
  let analyzed = false;
  let analyzing = false;
  let fileInput;

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
    lanes = [...lanes, {
      id: Date.now(),
      label: `Lane ${lanes.length + 1}`,
      color: COLORS[lanes.length % COLORS.length],
      x1: detail.x1,
      x2: detail.x2,
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
    await new Promise(r => img.complete ? r() : (img.onload = r));
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
        `${l.label},${i + 1},${b.peak},${b.area.toFixed(1)},${b.relative.toFixed(1)}`
      )
    );
    const csv = ['Lane,Band,Peak (px),Area (AU),Relative (%)'].concat(rows).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'gelquant_results.csv',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $: hasResults = analyzed && lanes.some(l => l.bands?.length);
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
          <span>Smoothing (σ = {sigma})</span>
          <input type="range" min="0.5" max="10" step="0.5" bind:value={sigma} />
        </label>
        <label class="range-label">
          <span>Min prominence = {minProminence}</span>
          <input type="range" min="1" max="50" step="1" bind:value={minProminence} />
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
      <div class="canvas-area">
        <ImageCanvas
          {imageDataUrl}
          {lanes}
          {selectedId}
          on:addlane={handleAddLane}
          on:laneselect={({ detail }) => selectedId = detail}
          on:laneschange={handleLanesChange} />
      </div>

      {#if hasResults}
        <div class="profiles">
          {#each lanes.filter(l => l.smoothedProfile) as lane (lane.id)}
            <LaneProfile {lane} selected={selectedId === lane.id} />
          {/each}
        </div>
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
  .canvas-area { max-width: 100%; }

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

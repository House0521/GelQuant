<script>
  export let lane;
  export let selected = false;

  const PAD = { t: 10, r: 8, b: 20, l: 36 };
  const CHART_H = 120;
  const CHART_W = 280;
  const SVG_W = CHART_W + PAD.l + PAD.r;
  const SVG_H = CHART_H + PAD.t + PAD.b;

  $: rawArr = lane.profile ? Array.from(lane.profile) : [];
  $: smArr = lane.smoothedProfile ? Array.from(lane.smoothedProfile) : [];
  $: displayArr = smArr.length ? smArr : rawArr;
  $: maxV = Math.max(...displayArr, 1);
  $: xScale = CHART_W / Math.max(displayArr.length, 1);

  function toPath(arr) {
    const step = Math.max(1, Math.ceil(arr.length / CHART_W));
    const pts = [];
    for (let i = 0; i < arr.length; i += step) {
      const x = (PAD.l + i * xScale).toFixed(1);
      const y = (PAD.t + CHART_H - (arr[i] / maxV) * CHART_H).toFixed(1);
      pts.push(`${pts.length === 0 ? 'M' : 'L'}${x},${y}`);
    }
    return pts.join(' ');
  }

  $: rawPath = rawArr.length ? toPath(rawArr) : '';
  $: smoothPath = smArr.length ? toPath(smArr) : '';

  $: bandX = pos => (PAD.l + pos * xScale).toFixed(1);
  $: bandW = (s, e) => ((e - s) * xScale).toFixed(1);
</script>

<div class="wrap" class:selected>
  <div class="label" style="color: {lane.color}">{lane.label}</div>
  <svg width={SVG_W} height={SVG_H} role="img" aria-label="Intensity profile for {lane.label}">
    <!-- Axes -->
    <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CHART_H}
      stroke="#475569" stroke-width="1" />
    <line x1={PAD.l} y1={PAD.t + CHART_H} x2={PAD.l + CHART_W} y2={PAD.t + CHART_H}
      stroke="#475569" stroke-width="1" />

    <!-- Y-axis labels -->
    <text x={PAD.l - 4} y={PAD.t + 4} text-anchor="end" font-size="9" fill="#64748b">
      {maxV.toFixed(0)}
    </text>
    <text x={PAD.l - 4} y={PAD.t + CHART_H} text-anchor="end" font-size="9" fill="#64748b">0</text>
    <text x={PAD.l - 4} y={PAD.t + CHART_H / 2 + 3} text-anchor="end" font-size="9" fill="#64748b">
      {(maxV / 2).toFixed(0)}
    </text>
    <line x1={PAD.l - 2} y1={PAD.t + CHART_H / 2} x2={PAD.l + CHART_W} y2={PAD.t + CHART_H / 2}
      stroke="#334155" stroke-width="0.5" stroke-dasharray="3 3" />

    <!-- Band regions -->
    {#each lane.bands as band}
      <rect
        x={bandX(band.start)} y={PAD.t}
        width={bandW(band.start, band.end)}
        height={CHART_H}
        fill="{lane.color}28" />
      <line
        x1={bandX(band.peak)} x2={bandX(band.peak)}
        y1={PAD.t} y2={PAD.t + CHART_H}
        stroke={lane.color} stroke-width="1.5" stroke-dasharray="4 2" opacity="0.8" />
    {/each}

    <!-- Raw profile (faint) -->
    {#if rawPath && smArr.length}
      <path d={rawPath} fill="none" stroke="{lane.color}44" stroke-width="1" />
    {/if}

    <!-- Smoothed profile -->
    {#if smoothPath}
      <path d={smoothPath} fill="none" stroke={lane.color} stroke-width="2" stroke-linejoin="round" />
    {:else if rawPath}
      <path d={rawPath} fill="none" stroke={lane.color} stroke-width="1.5" stroke-linejoin="round" />
    {/if}
  </svg>

  <!-- Band count badge -->
  {#if lane.bands.length}
    <div class="bands-info" style="color: {lane.color}">
      {lane.bands.length} band{lane.bands.length !== 1 ? 's' : ''} detected
    </div>
  {/if}
</div>

<style>
  .wrap {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    transition: border-color 0.15s;
  }
  .wrap.selected {
    border-color: var(--accent);
  }
  .label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .bands-info {
    font-size: 10px;
    opacity: 0.75;
  }
</style>

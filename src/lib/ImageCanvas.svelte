<script>
  import { createEventDispatcher } from 'svelte';

  export let imageDataUrl;
  export let lanes = [];
  export let selectedId = null;

  const dispatch = createEventDispatcher();

  let canvasEl;
  let svgEl;
  let imgW = 0;
  let imgH = 0;

  // Interaction mode
  let mode = 'idle'; // 'idle' | 'drawing' | 'drag-handle'
  let drawX1 = 0;
  let drawX2 = 0;
  let handleLaneId = null;
  let handleEdge = null; // 'y1' | 'y2'

  $: if (imageDataUrl && canvasEl) {
    const image = new Image();
    image.onload = () => {
      imgW = image.naturalWidth;
      imgH = image.naturalHeight;
      canvasEl.width = imgW;
      canvasEl.height = imgH;
      canvasEl.getContext('2d').drawImage(image, 0, 0);
    };
    image.src = imageDataUrl;
  }

  $: fontSize = imgH ? Math.max(16, imgH * 0.04) : 16;
  // Hit area for boundary handles in image coords — large enough to click comfortably
  $: hitSize = imgH ? Math.max(30, imgH * 0.025) : 30;
  // Visual radius of the drag indicator circle
  $: dotR = hitSize * 0.35;

  function getSVGPoint(e) {
    const pt = svgEl.createSVGPoint();
    const src = e.touches ? e.touches[0] : e;
    pt.x = src.clientX;
    pt.y = src.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  function startDragHandle(e, laneId, edge) {
    mode = 'drag-handle';
    handleLaneId = laneId;
    handleEdge = edge;
    e.stopPropagation();
    e.preventDefault();
  }

  function onMouseDown(e) {
    if (e.button === 2) return;
    if (e.touches && e.touches.length > 1) { mode = 'idle'; return; }
    const { x } = getSVGPoint(e);

    // Click inside an existing lane → select it
    for (const lane of lanes) {
      const lx1 = Math.min(lane.x1, lane.x2);
      const lx2 = Math.max(lane.x1, lane.x2);
      if (x >= lx1 && x <= lx2) {
        dispatch('laneselect', lane.id);
        return;
      }
    }

    // Otherwise start drawing a new lane
    mode = 'drawing';
    drawX1 = x;
    drawX2 = x;
    if (!e.touches) e.preventDefault();
  }

  function onMouseMove(e) {
    if (e.touches && e.touches.length > 1) { mode = 'idle'; return; }
    if (mode === 'drawing') {
      drawX2 = getSVGPoint(e).x;
      if (!e.touches) e.preventDefault();
    } else if (mode === 'drag-handle') {
      const { y } = getSVGPoint(e);
      dispatch('laneschange', lanes.map(l => {
        if (l.id !== handleLaneId) return l;
        if (handleEdge === 'y1') {
          return { ...l, y1: Math.max(0, Math.min(l.y2 - 10, Math.round(y))) };
        } else {
          return { ...l, y2: Math.max(l.y1 + 10, Math.min(imgH, Math.round(y))) };
        }
      }));
      if (!e.touches) e.preventDefault();
    }
  }

  function onMouseUp() {
    if (mode === 'drawing' && Math.abs(drawX2 - drawX1) >= 5) {
      dispatch('addlane', {
        x1: Math.min(drawX1, drawX2),
        x2: Math.max(drawX1, drawX2),
      });
    }
    mode = 'idle';
    drawX1 = drawX2 = 0;
    handleLaneId = null;
    handleEdge = null;
  }

  function onContextMenu(e) {
    e.preventDefault();
    const { x } = getSVGPoint(e);
    for (const lane of lanes) {
      const lx1 = Math.min(lane.x1, lane.x2);
      const lx2 = Math.max(lane.x1, lane.x2);
      if (x >= lx1 && x <= lx2) {
        dispatch('laneschange',
          lanes.filter(l => l.id !== lane.id).map((l, i) => ({ ...l, label: `Lane ${i + 1}` }))
        );
        return;
      }
    }
  }
</script>

<div class="container">
  <canvas bind:this={canvasEl}></canvas>

  {#if imgW && imgH}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svgEl}
      viewBox="0 0 {imgW} {imgH}"
      class="overlay"
      on:mousedown={onMouseDown}
      on:mousemove={onMouseMove}
      on:mouseup={onMouseUp}
      on:mouseleave={onMouseUp}
      on:contextmenu={onContextMenu}
      on:touchstart={onMouseDown}
      on:touchmove={onMouseMove}
      on:touchend={onMouseUp}
      role="application"
      aria-label="Gel image canvas — drag to define lanes, right-click to remove">

      {#each lanes as lane (lane.id)}
        {@const lx1 = Math.min(lane.x1, lane.x2)}
        {@const lw = Math.abs(lane.x2 - lane.x1)}
        {@const ly1 = lane.y1 ?? 0}
        {@const ly2 = lane.y2 ?? imgH}
        {@const lh = ly2 - ly1}
        {@const cx = lx1 + lw / 2}
        {@const isSelected = selectedId === lane.id}

        <!-- Lane fill -->
        <rect
          x={lx1} y={ly1} width={lw} height={lh}
          fill="{lane.color}{isSelected ? '44' : '22'}"
          stroke={lane.color}
          stroke-width={isSelected ? 4 : 2}
          style="cursor: pointer"
          role="button"
          tabindex="0"
          aria-label="Select {lane.label}"
          on:click|stopPropagation={() => dispatch('laneselect', lane.id)}
          on:keydown={e => e.key === 'Enter' && dispatch('laneselect', lane.id)} />

        <!-- Lane label -->
        <text
          x={cx} y={ly1 + fontSize * 1.3}
          text-anchor="middle"
          font-size={fontSize}
          font-family="system-ui, sans-serif"
          font-weight="700"
          fill={lane.color}
          pointer-events="none">{lane.label}</text>

        <!-- TOP boundary handle -->
        <!-- Invisible wide hit area -->
        <rect
          x={lx1} y={ly1 - hitSize / 2}
          width={lw} height={hitSize}
          fill="transparent"
          style="cursor: ns-resize"
          role="slider"
          tabindex="0"
          aria-label="Top boundary of {lane.label}"
          aria-valuenow={ly1}
          on:mousedown|stopPropagation={e => startDragHandle(e, lane.id, 'y1')}
          on:touchstart|stopPropagation={e => startDragHandle(e, lane.id, 'y1')} />
        <!-- Visual dashed line -->
        <line
          x1={lx1} x2={lx1 + lw}
          y1={ly1} y2={ly1}
          stroke={lane.color} stroke-width="3"
          stroke-dasharray="10 5"
          pointer-events="none" />
        <!-- Drag indicator dot -->
        <circle
          cx={cx} cy={ly1} r={dotR}
          fill={lane.color} opacity="0.85"
          pointer-events="none" />

        <!-- BOTTOM boundary handle -->
        <rect
          x={lx1} y={ly2 - hitSize / 2}
          width={lw} height={hitSize}
          fill="transparent"
          style="cursor: ns-resize"
          role="slider"
          tabindex="0"
          aria-label="Bottom boundary of {lane.label}"
          aria-valuenow={ly2}
          on:mousedown|stopPropagation={e => startDragHandle(e, lane.id, 'y2')}
          on:touchstart|stopPropagation={e => startDragHandle(e, lane.id, 'y2')} />
        <line
          x1={lx1} x2={lx1 + lw}
          y1={ly2} y2={ly2}
          stroke={lane.color} stroke-width="3"
          stroke-dasharray="10 5"
          pointer-events="none" />
        <circle
          cx={cx} cy={ly2} r={dotR}
          fill={lane.color} opacity="0.85"
          pointer-events="none" />
      {/each}

      <!-- New-lane drawing preview -->
      {#if mode === 'drawing'}
        {@const dx = Math.min(drawX1, drawX2)}
        {@const dw = Math.abs(drawX2 - drawX1)}
        <rect
          x={dx} y={0} width={dw} height={imgH}
          fill="rgba(255,255,255,0.08)"
          stroke="white"
          stroke-width="3"
          stroke-dasharray="12 6"
          pointer-events="none" />
      {/if}
    </svg>
  {/if}
</div>

<style>
  .container {
    position: relative;
    display: inline-block;
    max-width: 100%;
    cursor: crosshair;
  }

  canvas {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: pinch-zoom;
  }
</style>

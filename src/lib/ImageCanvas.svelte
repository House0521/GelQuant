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
  let drawing = false;
  let drawX1 = 0;
  let drawX2 = 0;

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

  function getSVGPoint(e) {
    const pt = svgEl.createSVGPoint();
    const src = e.touches ? e.touches[0] : e;
    pt.x = src.clientX;
    pt.y = src.clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  function onMouseDown(e) {
    if (e.button === 2) return;
    const { x } = getSVGPoint(e);

    for (const lane of lanes) {
      const lx1 = Math.min(lane.x1, lane.x2);
      const lx2 = Math.max(lane.x1, lane.x2);
      if (x >= lx1 && x <= lx2) {
        dispatch('laneselect', lane.id);
        return;
      }
    }

    drawing = true;
    drawX1 = x;
    drawX2 = x;
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!drawing) return;
    drawX2 = getSVGPoint(e).x;
    e.preventDefault();
  }

  function onMouseUp() {
    if (!drawing) return;
    drawing = false;
    if (Math.abs(drawX2 - drawX1) >= 5) {
      dispatch('addlane', {
        x1: Math.min(drawX1, drawX2),
        x2: Math.max(drawX1, drawX2),
      });
    }
    drawX1 = drawX2 = 0;
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
      role="application"
      aria-label="Gel image canvas — drag to define lanes, right-click to remove">

      {#each lanes as lane (lane.id)}
        {@const lx1 = Math.min(lane.x1, lane.x2)}
        {@const lw = Math.abs(lane.x2 - lane.x1)}
        {@const isSelected = selectedId === lane.id}
        <rect
          x={lx1} y={0} width={lw} height={imgH}
          fill="{lane.color}{isSelected ? '44' : '22'}"
          stroke={lane.color}
          stroke-width={isSelected ? 4 : 2}
          style="cursor: pointer"
          role="button"
          tabindex="0"
          aria-label="Select {lane.label}"
          on:click|stopPropagation={() => dispatch('laneselect', lane.id)}
          on:keydown={e => e.key === 'Enter' && dispatch('laneselect', lane.id)} />
        <text
          x={lx1 + lw / 2} y={fontSize * 1.3}
          text-anchor="middle"
          font-size={fontSize}
          font-family="system-ui, sans-serif"
          font-weight="700"
          fill={lane.color}
          pointer-events="none">{lane.label}</text>
      {/each}

      {#if drawing}
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
  }
</style>

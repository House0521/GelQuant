<script>
  export let lanes = [];
  export let onexport = null;

  $: rows = lanes.flatMap(lane =>
    (lane.bands || []).map((band, i) => ({
      laneLabel: lane.label,
      laneColor: lane.color,
      band: i + 1,
      peak: band.peak,
      area: band.area != null ? band.area.toFixed(1) : '—',
      prominence: band.prominence != null ? band.prominence.toFixed(1) : '—',
      relative: band.relative != null ? band.relative.toFixed(1) : '—',
    }))
  );
</script>

{#if rows.length}
  <div class="table-wrap">
    <div class="table-top">
      <span class="title">Quantification Results</span>
      {#if onexport}
        <button class="export-btn" on:click={onexport}>Export CSV</button>
      {/if}
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Lane</th>
            <th>Band</th>
            <th>Peak (px)</th>
            <th>Area (AU)</th>
            <th>Prominence</th>
            <th>Relative (%)</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr>
              <td>
                <span class="dot" style="background:{row.laneColor}"></span>
                {row.laneLabel}
              </td>
              <td>{row.band}</td>
              <td>{row.peak}</td>
              <td>{row.area}</td>
              <td>{row.prominence}</td>
              <td><strong>{row.relative}</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 680px;
  }
  .table-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .export-btn {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .export-btn:hover { background: var(--accent-dim); }
  .scroll { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  thead { background: var(--surface2); }
  th {
    padding: 7px 14px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }
</style>

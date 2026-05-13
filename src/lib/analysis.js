export function extractLaneProfile(img, lane, invert = false) {
  const x1 = Math.round(Math.min(lane.x1, lane.x2));
  const x2 = Math.round(Math.max(lane.x1, lane.x2));
  const y1 = Math.round(Math.max(0, lane.y1 ?? 0));
  const y2 = Math.round(Math.min(img.naturalHeight, lane.y2 ?? img.naturalHeight));
  const laneW = x2 - x1;
  const laneH = y2 - y1;

  if (laneW <= 0 || laneH <= 0) return new Float32Array(0);

  const canvas = new OffscreenCanvas(laneW, laneH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x1, y1, laneW, laneH, 0, 0, laneW, laneH);
  const { data } = ctx.getImageData(0, 0, laneW, laneH);

  // Precompute luminance for all pixels once.
  const lum = new Float32Array(laneW * laneH);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum[j] = invert ? 255 - v : v;
  }

  // Per-column minimum across all rows: the stable dark floor of each column
  // (background outside the band, or the inter-band gap for band columns).
  // Subtracting this means columns outside the actual band contribute zero
  // regardless of how wide the lane is drawn, without over-subtracting when
  // the band fills the full lane width.
  const colMin = new Float32Array(laneW).fill(255);
  for (let y = 0; y < laneH; y++) {
    for (let x = 0; x < laneW; x++) {
      const v = lum[y * laneW + x];
      if (v < colMin[x]) colMin[x] = v;
    }
  }

  const profile = new Float32Array(laneH);
  for (let y = 0; y < laneH; y++) {
    let sum = 0;
    for (let x = 0; x < laneW; x++) sum += lum[y * laneW + x] - colMin[x];
    profile[y] = sum;
  }
  return profile;
}

export function gaussianSmooth(profile, sigma = 3) {
  const r = Math.ceil(3 * sigma);
  const n = 2 * r + 1;
  const k = new Float32Array(n);
  let ksum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - r;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    ksum += k[i];
  }
  for (let i = 0; i < n; i++) k[i] /= ksum;

  const len = profile.length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let v = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.max(0, Math.min(len - 1, i + j - r));
      v += profile[idx] * k[j];
    }
    out[i] = v;
  }
  return out;
}

export function detectBands(smoothed, minProminence = 5) {
  const len = smoothed.length;
  const peaks = [];

  for (let i = 1; i < len - 1; i++) {
    if (smoothed[i] >= smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) {
      let lMin = smoothed[i];
      for (let j = i - 1; j >= 0; j--) {
        if (smoothed[j] > smoothed[i]) break;
        lMin = Math.min(lMin, smoothed[j]);
      }
      let rMin = smoothed[i];
      for (let j = i + 1; j < len; j++) {
        if (smoothed[j] > smoothed[i]) break;
        rMin = Math.min(rMin, smoothed[j]);
      }
      const prominence = smoothed[i] - Math.max(lMin, rMin);
      if (prominence >= minProminence) {
        peaks.push({ peak: i, height: smoothed[i], prominence });
      }
    }
  }

  for (let i = 0; i < peaks.length; i++) {
    const start = i === 0 ? 0
      : Math.round((peaks[i - 1].peak + peaks[i].peak) / 2);
    const end = i === peaks.length - 1 ? len
      : Math.round((peaks[i].peak + peaks[i + 1].peak) / 2);
    peaks[i].start = start;
    peaks[i].end = end;

    const base = Math.min(smoothed[start] ?? 0, smoothed[end - 1] ?? 0);
    let area = 0;
    for (let y = start; y < end; y++) area += Math.max(0, smoothed[y] - base);
    peaks[i].area = area;
  }

  return peaks;
}

export function assignRelative(lanes) {
  const maxArea = Math.max(...lanes.flatMap(l => l.bands.map(b => b.area)), 1);
  return lanes.map(lane => ({
    ...lane,
    bands: lane.bands.map(b => ({ ...b, relative: (b.area / maxArea) * 100 })),
  }));
}

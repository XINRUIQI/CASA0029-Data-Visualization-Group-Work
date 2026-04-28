/** Build monotonic timestamps (same units as `currentTime`) along a 3-D path */
export function buildTripTimestamps(coords, tStart, tEnd) {
  if (!coords?.length) return [];
  const n = coords.length;
  if (n === 1) return [tStart];
  let totalLen = 0;
  const segLens = [];
  for (let i = 1; i < n; i++) {
    const a = coords[i - 1], b = coords[i];
    const dx = (b[0] - a[0]) * 102500;
    const dy = (b[1] - a[1]) * 111000;
    const dz = (b[2] ?? 0) - (a[2] ?? 0);
    const sl = Math.hypot(dx, dy, dz) || 0.001;
    segLens.push(sl);
    totalLen += sl;
  }
  const times = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) times.push(tStart);
    else {
      acc += segLens[i - 1];
      times.push(tStart + (acc / totalLen) * (tEnd - tStart));
    }
  }
  return times;
}

/**
 * Pre-compute ALL Page6 (Post-Analysis) display data for budgets 20 / 50 / 100.
 * Includes accessibility-demand data per budget.
 *
 * Run:  node scripts/precompute_page6.mjs
 * Output: public/data/page6_precomputed.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { cellToLatLng } from 'h3-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, '../public/data');
const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), 'utf8'));

const COVERAGE_RADIUS_KM = 3;
const FRICTION_REDUCTION  = 0.7;
const BUDGETS = [20, 50, 100];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compositeScore(s) {
  const d = s.demand_norm ?? 0, f = s.friction_norm ?? 0, i = s.intensity_norm ?? 0;
  return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i;
}

function computeGini(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (2 * (i + 1) - n - 1) * sorted[i];
  return sum / (n * n * mean);
}

function r(v, d = 6) { return +v.toFixed(d); }

// ── Load ────────────────────────────────────────────────────────────
console.log('Loading source data …');
const h3Demand       = read('h3_demand.json');
const h3Gap          = read('page2_h3_gap.json');
const h3Takeout      = read('h3_takeout.json');
const candidates     = read('page6_candidate_sites.json');
const odRaw          = read('page2_od_analysis.json');
const odAnalysis     = odRaw.features?.map(f => f.properties) ?? [];

let accData = null;
try { accData = read('page6_accessibility.json'); } catch { /* optional */ }

// ── Pre-decode H3 → lat/lng ─────────────────────────────────────────
console.log('Decoding H3 coordinates …');
const h3Coords = new Map();
for (const g of h3Gap) {
  try { const [lat, lng] = cellToLatLng(g.h3); h3Coords.set(g.h3, { lat, lng }); }
  catch {}
}
for (const d of h3Demand) {
  if (!h3Coords.has(d.h3)) {
    try { const [lat, lng] = cellToLatLng(d.h3); h3Coords.set(d.h3, { lat, lng }); }
    catch {}
  }
}

// ── baseMergedHex (budget-independent base + per-budget acc fields) ──
console.log('Building baseMergedHex …');
const gapMap     = new Map(h3Gap.map(g => [g.h3, g]));
const takeoutMap = new Map(h3Takeout.map(t => [t.h3, t]));
const accMap     = accData ? new Map(accData.map(a => [a.h3, a])) : null;

const baseMergedHex = h3Demand.map(d => {
  const gap = gapMap.get(d.h3);
  const coord = h3Coords.get(d.h3);
  const acc = accMap?.get(d.h3);
  const row = {
    h3:   d.h3,
    _lon: coord ? r(coord.lng, 5) : 0,
    dp:   d.dp || 0,
    fr:   gap?.avg_friction || 0,
    gi:   gap?.gap_index    || 0,
    dn:   gap?.demand_norm  || 0,
  };
  if (acc) {
    row.lai   = acc.lai   ?? 0;
    row.adb   = acc.adb   ?? 0;
    row.ada20 = acc.ada20 ?? 0;  row.fai20 = acc.fai20 ?? 0;
    row.ada50 = acc.ada50 ?? 0;  row.fai50 = acc.fai50 ?? 0;
    row.ada100= acc.ada100?? 0;  row.fai100= acc.fai100?? 0;
  }
  return row;
});

const dpVals = baseMergedHex.map(d => d.dp).filter(v => v > 0);
const dpBounds = dpVals.length ? [Math.min(...dpVals), Math.max(...dpVals)] : [0, 200];

// ── Score & sort candidates once ────────────────────────────────────
const scored = candidates
  .map(s => ({ ...s, score: r(compositeScore(s)) }))
  .sort((a, b) => b.score - a.score);

// ── Hex coords for coverage/efficiency (friction > 0 subset) ────────
const frictionHexes = h3Gap
  .filter(g => g.avg_friction > 0)
  .map(g => {
    const c = h3Coords.get(g.h3);
    return c ? { h3: g.h3, lat: c.lat, lng: c.lng, friction: g.avg_friction } : null;
  })
  .filter(Boolean);

const totalFriction = frictionHexes.reduce((s, h) => s + h.friction, 0);
const totalHexes    = frictionHexes.length;
const beforeFrictions = frictionHexes.map(h => h.friction);

// ── Efficiency curve (budget-independent) ───────────────────────────
console.log('Computing efficiency curve …');
const efficiencyCurve = [{ sites: 0, coverage: 0, reduction: 0 }];
const milestones = new Set([1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
const covEff = new Set();
let frSaved = 0;
for (let i = 0; i < Math.min(scored.length, 100); i++) {
  const site = scored[i];
  for (const hex of frictionHexes) {
    if (!covEff.has(hex.h3) && haversineKm(hex.lat, hex.lng, site.lat, site.lon) <= COVERAGE_RADIUS_KM) {
      covEff.add(hex.h3);
      frSaved += hex.friction * FRICTION_REDUCTION;
    }
  }
  if (milestones.has(i + 1)) {
    efficiencyCurve.push({
      sites: i + 1,
      coverage: r(covEff.size / totalHexes * 100, 1),
      reduction: r(frSaved / totalFriction * 100, 1),
    });
  }
}

// ── Per-budget data ─────────────────────────────────────────────────
const budgets = {};

for (const budget of BUDGETS) {
  console.log(`  budget = ${budget} …`);
  const selected = scored.slice(0, budget);

  const coveredH3 = [];
  for (const hex of h3Gap) {
    const c = h3Coords.get(hex.h3);
    if (!c) continue;
    if (selected.some(s => haversineKm(c.lat, c.lng, s.lat, s.lon) <= COVERAGE_RADIUS_KM))
      coveredH3.push(hex.h3);
  }
  const covSet = new Set(coveredH3);

  const afterFrictions = frictionHexes.map(h =>
    covSet.has(h.h3) ? h.friction * (1 - FRICTION_REDUCTION) : h.friction
  );

  const avgBefore = beforeFrictions.reduce((a, b) => a + b, 0) / beforeFrictions.length;
  const avgAfter  = afterFrictions.reduce((a, b) => a + b, 0) / afterFrictions.length;
  const coveragePct      = totalHexes > 0 ? covSet.size / totalHexes * 100 : 0;
  const frictionReduction = avgBefore > 0 ? (avgBefore - avgAfter) / avgBefore * 100 : 0;

  const metrics = {
    avgFrictionBefore: r(avgBefore, 3),
    avgFrictionAfter:  r(avgAfter, 3),
    frictionReduction: r(frictionReduction, 1),
    coveredHexes:      covSet.size,
    totalHexes,
    coveragePct: r(coveragePct, 1),
    numSites:    selected.length,
  };

  const binW = 0.02;
  const maxV = Math.max(...beforeFrictions, ...afterFrictions, 0);
  const bins = [];
  for (let i = 0; i <= maxV + binW; i += binW) bins.push({ range: r(i, 3), before: 0, after: 0 });
  beforeFrictions.forEach(v => { const idx = Math.min(Math.floor(v / binW), bins.length - 1); if (idx >= 0) bins[idx].before++; });
  afterFrictions.forEach(v  => { const idx = Math.min(Math.floor(v / binW), bins.length - 1); if (idx >= 0) bins[idx].after++; });
  const frictionDistData = bins.filter(d => d.before > 0 || d.after > 0);

  const n = odAnalysis.length || 1;
  const avg = (key) => r(odAnalysis.reduce((s, d) => s + (d[key] || 0), 0) / n, 2);
  const covPct = coveragePct / 100;
  const rf = 1 - covPct * FRICTION_REDUCTION;
  const barrierComparison = [
    { type: 'Water',    before: avg('n_water_crossings'),         after: r(avg('n_water_crossings')         * rf, 2) },
    { type: 'Waterway', before: avg('n_waterway_crossings'),      after: r(avg('n_waterway_crossings')      * rf, 2) },
    { type: 'Railway',  before: avg('n_railway_crossings'),       after: r(avg('n_railway_crossings')       * rf, 2) },
    { type: 'Highway',  before: avg('n_highway_major_crossings'), after: r(avg('n_highway_major_crossings') * rf, 2) },
  ];

  const topImproved = frictionHexes
    .filter(h => covSet.has(h.h3))
    .map(h => ({ h3: h.h3, before: r(h.friction), after: r(h.friction * (1 - FRICTION_REDUCTION)), delta: r(h.friction * FRICTION_REDUCTION) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);

  const highDemand   = h3Takeout.filter(d => (d.takeout_demand_index || 0) > 0.3);
  const coveredHigh  = highDemand.filter(d => covSet.has(d.h3));
  const demandCoverage = highDemand.length ? [
    { name: 'Covered',   value: coveredHigh.length,                     fill: '#00e896' },
    { name: 'Uncovered', value: highDemand.length - coveredHigh.length, fill: '#ff3264' },
  ] : null;

  const giniData = beforeFrictions.length ? {
    before: r(computeGini(beforeFrictions), 4),
    after:  r(computeGini(afterFrictions), 4),
  } : null;

  const siteRoi = selected.map(s => ({
    score:   r(s.score, 4),
    covered: frictionHexes.filter(h => haversineKm(h.lat, h.lng, s.lat, s.lon) <= COVERAGE_RADIUS_KM).length,
  }));

  budgets[budget] = {
    selectedSites: selected.map(s => ({ lat: s.lat, lon: s.lon, score: r(s.score, 4) })),
    coveredH3,
    metrics,
    frictionDistData,
    barrierComparison,
    topImproved,
    demandCoverage,
    giniData,
    siteRoi,
  };
}

// ── Write output ────────────────────────────────────────────────────
const output = { baseMergedHex, dpBounds, efficiencyCurve, budgets };
const json = JSON.stringify(output);
const outPath = resolve(DATA, 'page6_precomputed.json');
writeFileSync(outPath, json);
const kb = (Buffer.byteLength(json) / 1024).toFixed(0);
console.log(`\nDone → ${outPath}  (${kb} KB)`);

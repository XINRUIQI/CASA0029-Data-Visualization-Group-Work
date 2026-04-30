import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cellToLatLng } from 'h3-js';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER } from '../../config';
import { publicDataUrl } from '../../config';
import MapControls from '../../components/MapControls';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
         ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend } from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Page6PostAnalysis.css';

const COVERAGE_RADIUS_KM = 3;
const FRICTION_REDUCTION = 0.7;

const LAYER_MODES = [
  { id: 'supply',    label: 'Gap',       color: '#5A89A6' },
  { id: 'friction',  label: 'Burden',    color: '#ff3264' },
  { id: 'composite', label: 'Composite', color: '#c864ff' },
];

const BARRIER_TYPES = [
  { id: 'water',         label: 'Water',      color: '#4688dc' },
  { id: 'waterway',      label: 'Waterway',   color: '#64a0f0' },
  { id: 'railway',       label: 'Railway',    color: '#888' },
  { id: 'highway_major', label: 'Expressway', color: '#dc3c3c' },
];

const BARRIER_COLORS = {
  water:         [70, 130, 220, 140],
  waterway:      [100, 160, 240, 100],
  railway:       [160, 160, 160, 180],
  highway_major: [220, 60, 60, 140],
};

const BUDGETS = [20, 50, 100];

const VIEW = {
  longitude: 114.15,
  latitude:  22.62,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compositeScore(site) {
  const d = site.demand_norm ?? 0;
  const f = site.friction_norm ?? 0;
  const i = site.intensity_norm ?? 0;
  return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i;
}

const SUPPLY_RAMP = [
  [216, 232, 242],
  [184, 214, 230],
  [148, 194, 216],
  [116, 170, 198],
  [90, 137, 166],
  [66, 112, 148],
  [44, 88, 126],
  [26, 62, 100],
  [10, 38, 72],
];

function rampLerp(ramp, v01) {
  const t = Math.max(0, Math.min(1, v01));
  const n = ramp.length - 1;
  const idx = t * n;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, n);
  const f = idx - lo;
  const c0 = ramp[lo];
  const c1 = ramp[hi];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

const TT_STYLE = { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 };

function computeGini(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sum / (n * n * mean);
}

function hexColor(mode, d, dpBounds) {
  if (!d) return [80, 80, 80, 40];

  const dp = d.dp || 0;
  const fr = d.avg_friction || 0;

  if (mode === 'supply') {
    if (dp <= 0) return [0, 0, 0, 0];
    const lo = dpBounds?.[0] ?? 0;
    const hi = dpBounds?.[1] ?? 200;
    const v = Math.max(0, Math.min(1, (dp - lo) / (hi - lo)));
    const rgb = rampLerp(SUPPLY_RAMP, v);
    return [...rgb, Math.round(90 + 165 * v)];
  }

  if (mode === 'friction' && !(fr > 0))
    return [0, 0, 0, 0];

  if (mode === 'friction') {
    const t = Math.min(Math.max(fr, 0), 1);
    const v = Math.pow(Math.min(1, t * 1.18), 0.38);
    return [255, Math.round(235 * (1 - v)), Math.round(175 * (1 - v)), Math.round(28 + 227 * v)];
  }

  if (mode === 'composite') {
    const gi = d.gap_index || 0;
    if (gi <= 0) return [0, 0, 0, 0];
    const v = Math.pow(Math.min(gi, 1), 0.45);
    return [Math.round(118 + 137 * v), Math.round(238 * (1 - v)), Math.round(168 + 87 * v), Math.round(26 + 229 * v)];
  }

  return [80, 80, 80, 40];
}

export default function Page7PostAnalysis() {
  const [barriers, setBarriers]           = useState({});
  const [h3Demand, setH3Demand]           = useState(null);
  const [h3Gap, setH3Gap]                 = useState(null);
  const [h3Takeout, setH3Takeout]         = useState(null);
  const [candidateSites, setCandidateSites] = useState(null);
  const [routes, setRoutes]               = useState(null);
  const [odAnalysis, setOdAnalysis]       = useState(null);

  const [viewState, setViewState]         = useState(VIEW);
  const [activeMode, setActiveMode]       = useState('supply');
  const [budget, setBudget]               = useState(50);
  const [showCoverage, setShowCoverage]   = useState(true);
  const [hoveredHex, setHoveredHex]       = useState(null);
  const [sliderPct, setSliderPct]         = useState(15);
  const mapCardRef = useRef(null);
  const dragging   = useRef(false);

  const onSliderDown = useCallback((e) => {
    dragging.current = true;
    e.target.setPointerCapture(e.pointerId);
  }, []);

  const onSliderMove = useCallback((e) => {
    if (!dragging.current || !mapCardRef.current) return;
    const rect = mapCardRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPct(Math.max(2, Math.min(98, pct)));
  }, []);

  const onSliderUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    ['water', 'waterway', 'railway', 'highway_major'].forEach(t => {
      fetch(publicDataUrl(`data/page2_barrier_${t}.json`))
        .then(r => r.json())
        .then(data => setBarriers(prev => ({ ...prev, [t]: data })))
        .catch(() => {});
    });
    fetch(publicDataUrl('data/h3_demand.json')).then(r => r.json()).then(setH3Demand).catch(() => {});
    fetch(publicDataUrl('data/page2_h3_gap.json')).then(r => r.json()).then(setH3Gap).catch(() => {});
    fetch(publicDataUrl('data/h3_takeout.json')).then(r => r.json()).then(setH3Takeout).catch(() => {});
    fetch(publicDataUrl('data/page6_candidate_sites.json')).then(r => r.json()).then(setCandidateSites).catch(() => {});
    fetch(publicDataUrl('data/page2_routes.json')).then(r => r.json()).then(setRoutes).catch(() => {});
    fetch(publicDataUrl('data/page2_od_analysis.json'))
      .then(r => r.json())
      .then(data => setOdAnalysis(data?.features?.map(f => f.properties) || []))
      .catch(() => {});
  }, []);

  const selectedSites = useMemo(() => {
    if (!candidateSites) return [];
    const scored = candidateSites.map(s => ({ ...s, score: compositeScore(s) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, budget);
  }, [candidateSites, budget]);

  const coverageSet = useMemo(() => {
    if (!h3Gap?.length || !selectedSites.length) return new Set();
    const set = new Set();
    for (const hex of h3Gap) {
      try {
        const [lat, lng] = cellToLatLng(hex.h3);
        if (selectedSites.some(s => haversineKm(lat, lng, s.lat, s.lon) <= COVERAGE_RADIUS_KM)) {
          set.add(hex.h3);
        }
      } catch { /* skip invalid h3 */ }
    }
    return set;
  }, [h3Gap, selectedSites]);

  const mergedHex = useMemo(() => {
    if (!h3Demand) return null;
    const gapMap     = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    const takeoutMap = new window.Map((h3Takeout || []).map(t => [t.h3, t]));

    return h3Demand.map(d => {
      const gap = gapMap.get(d.h3);
      const tk  = takeoutMap.get(d.h3);
      const isCovered   = coverageSet.has(d.h3);
      const frictionMul = isCovered ? (1 - FRICTION_REDUCTION) : 1;
      let lon = 0;
      try { [, lon] = cellToLatLng(d.h3); } catch { /* skip */ }

      return {
        ...d,
        _lon: lon,
        dp:                  d.dp || 0,
        avg_friction:        (gap?.avg_friction || 0) * frictionMul,
        avg_friction_before: gap?.avg_friction || 0,
        gap_index:           (gap?.gap_index || 0) * (isCovered ? 0.4 : 1),
        gap_index_before:    gap?.gap_index || 0,
        food_count:    d.food    || gap?.food_count    || 0,
        retail_count:  d.retail  || gap?.retail_count   || 0,
        edu_count:     d.edu     || gap?.education_count || 0,
        med_count:     d.med     || gap?.medical_count  || 0,
        scenic_count:  d.scenic  || gap?.scenic_count   || 0,
        leisure_count: d.leisure || gap?.leisure_count   || 0,
        pop_count:             tk?.pop_count            || gap?.pop_count || 0,
        takeout_demand_index:  tk?.takeout_demand_index || 0,
        relief_vulnerability: (gap?.relief_vulnerability || 0) * (isCovered ? 0.3 : 1),
        covered: isCovered,
      };
    });
  }, [h3Demand, h3Gap, h3Takeout, coverageSet]);

  const metrics = useMemo(() => {
    if (!h3Gap?.length || !mergedHex?.length) return null;

    const beforeFrictions = h3Gap.filter(g => g.avg_friction > 0).map(g => g.avg_friction);
    const afterFrictions  = mergedHex.filter(h => h.avg_friction_before > 0).map(h => h.avg_friction);

    const avgBefore = beforeFrictions.length
      ? beforeFrictions.reduce((a, b) => a + b, 0) / beforeFrictions.length : 0;
    const avgAfter = afterFrictions.length
      ? afterFrictions.reduce((a, b) => a + b, 0) / afterFrictions.length : 0;

    const coveredCount     = coverageSet.size;
    const totalWithFriction = beforeFrictions.length;
    const coveragePct      = totalWithFriction > 0 ? (coveredCount / totalWithFriction * 100) : 0;
    const frictionReduction = avgBefore > 0 ? ((avgBefore - avgAfter) / avgBefore * 100) : 0;

    return {
      avgFrictionBefore: avgBefore.toFixed(3),
      avgFrictionAfter:  avgAfter.toFixed(3),
      frictionReduction: frictionReduction.toFixed(1),
      coveredHexes:      coveredCount,
      totalHexes:        totalWithFriction,
      coveragePct:       coveragePct.toFixed(1),
      numSites:          selectedSites.length,
    };
  }, [h3Gap, mergedHex, coverageSet, selectedSites]);

  const frictionDistData = useMemo(() => {
    if (!h3Gap?.length || !mergedHex?.length) return [];
    const binW = 0.02;
    const beforeVals = h3Gap.filter(g => g.avg_friction > 0).map(g => g.avg_friction);
    const afterVals = mergedHex.filter(h => h.avg_friction_before > 0).map(h => h.avg_friction);
    const maxV = Math.max(...beforeVals, ...afterVals, 0);
    const result = [];
    for (let i = 0; i <= maxV + binW; i += binW) {
      result.push({ range: +i.toFixed(3), before: 0, after: 0 });
    }
    beforeVals.forEach(v => {
      const idx = Math.min(Math.floor(v / binW), result.length - 1);
      if (idx >= 0) result[idx].before++;
    });
    afterVals.forEach(v => {
      const idx = Math.min(Math.floor(v / binW), result.length - 1);
      if (idx >= 0) result[idx].after++;
    });
    return result.filter(d => d.before > 0 || d.after > 0);
  }, [h3Gap, mergedHex]);

  const efficiencyCurve = useMemo(() => {
    if (!candidateSites?.length || !h3Gap?.length) return [];
    const scored = candidateSites.map(s => ({ ...s, score: compositeScore(s) }));
    scored.sort((a, b) => b.score - a.score);
    const hexCoords = h3Gap.filter(g => g.avg_friction > 0).map(g => {
      try {
        const [lat, lng] = cellToLatLng(g.h3);
        return { h3: g.h3, lat, lng, friction: g.avg_friction };
      } catch { return null; }
    }).filter(Boolean);
    const totalFriction = hexCoords.reduce((s, h) => s + h.friction, 0);
    const totalHexes = hexCoords.length;
    if (!totalHexes || !totalFriction) return [];
    const maxSites = Math.min(scored.length, 100);
    const milestones = new Set([1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const coveredS = new Set();
    let frictionSaved = 0;
    const result = [{ sites: 0, coverage: 0, reduction: 0 }];
    for (let i = 0; i < maxSites; i++) {
      const site = scored[i];
      for (const hex of hexCoords) {
        if (!coveredS.has(hex.h3) && haversineKm(hex.lat, hex.lng, site.lat, site.lon) <= COVERAGE_RADIUS_KM) {
          coveredS.add(hex.h3);
          frictionSaved += hex.friction * FRICTION_REDUCTION;
        }
      }
      if (milestones.has(i + 1)) {
        result.push({
          sites: i + 1,
          coverage: +(coveredS.size / totalHexes * 100).toFixed(1),
          reduction: +(frictionSaved / totalFriction * 100).toFixed(1),
        });
      }
    }
    return result;
  }, [candidateSites, h3Gap]);

  const barrierComparison = useMemo(() => {
    if (!odAnalysis?.length || !metrics) return null;
    const n = odAnalysis.length;
    const avg = (key) => +(odAnalysis.reduce((s, d) => s + (d[key] || 0), 0) / n).toFixed(2);
    const covPct = +metrics.coveragePct / 100;
    const rf = 1 - covPct * FRICTION_REDUCTION;
    return [
      { type: 'Water', before: avg('n_water_crossings'), after: +(avg('n_water_crossings') * rf).toFixed(2) },
      { type: 'Waterway', before: avg('n_waterway_crossings'), after: +(avg('n_waterway_crossings') * rf).toFixed(2) },
      { type: 'Railway', before: avg('n_railway_crossings'), after: +(avg('n_railway_crossings') * rf).toFixed(2) },
      { type: 'Highway', before: avg('n_highway_major_crossings'), after: +(avg('n_highway_major_crossings') * rf).toFixed(2) },
    ];
  }, [odAnalysis, metrics]);

  const topImproved = useMemo(() => {
    if (!mergedHex?.length) return [];
    return mergedHex
      .filter(h => h.covered && h.avg_friction_before > 0)
      .map(h => ({
        h3: h.h3,
        before: h.avg_friction_before,
        after: h.avg_friction,
        delta: h.avg_friction_before - h.avg_friction,
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  }, [mergedHex]);

  const demandCoverage = useMemo(() => {
    if (!h3Takeout?.length || !coverageSet.size) return null;
    const highDemand = h3Takeout.filter(d => (d.takeout_demand_index || 0) > 0.3);
    if (!highDemand.length) return null;
    const coveredHigh = highDemand.filter(d => coverageSet.has(d.h3));
    return [
      { name: 'Covered', value: coveredHigh.length, fill: '#00e896' },
      { name: 'Uncovered', value: highDemand.length - coveredHigh.length, fill: '#ff3264' },
    ];
  }, [h3Takeout, coverageSet]);

  const giniData = useMemo(() => {
    if (!h3Gap?.length || !mergedHex?.length) return null;
    const beforeVals = h3Gap.filter(g => g.avg_friction > 0).map(g => g.avg_friction);
    const afterVals = mergedHex.filter(h => h.avg_friction_before > 0).map(h => h.avg_friction);
    if (!beforeVals.length) return null;
    return {
      before: +computeGini(beforeVals).toFixed(4),
      after: +computeGini(afterVals).toFixed(4),
    };
  }, [h3Gap, mergedHex]);

  const siteRoi = useMemo(() => {
    if (!selectedSites.length || !h3Gap?.length) return [];
    const hexCoords = h3Gap.filter(g => g.avg_friction > 0).map(g => {
      try {
        const [lat, lng] = cellToLatLng(g.h3);
        return { lat, lng };
      } catch { return null; }
    }).filter(Boolean);
    return selectedSites.map(s => ({
      score: +s.score.toFixed(4),
      covered: hexCoords.filter(h => haversineKm(h.lat, h.lng, s.lat, s.lon) <= COVERAGE_RADIUS_KM).length,
    }));
  }, [selectedSites, h3Gap]);

  const toggleBarrier = (id) => {
    setActiveBarriers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dpBounds = useMemo(() => {
    if (!mergedHex?.length) return [0, 200];
    const vals = mergedHex.map(d => d.dp || 0).filter(v => v > 0);
    if (!vals.length) return [0, 200];
    return [Math.min(...vals), Math.max(...vals)];
  }, [mergedHex]);

  const splitLon = useMemo(() => {
    const w = mapCardRef.current?.clientWidth || 800;
    const degPerPx = 360 / (Math.pow(2, viewState.zoom) * 512);
    return viewState.longitude + (w * sliderPct / 100 - w / 2) * degPerPx;
  }, [viewState.longitude, viewState.zoom, sliderPct]);

  const layers = useMemo(() => {
    const result = [];

    if (mergedHex) {
      result.push(new H3HexagonLayer({
        id: 'analysis-hex',
        data: mergedHex,
        getHexagon: d => d.h3,
        getFillColor: d => {
          if (d._lon < splitLon) {
            const beforeD = { ...d, avg_friction: d.avg_friction_before, gap_index: d.gap_index_before };
            return hexColor(activeMode, beforeD, dpBounds);
          }
          return hexColor(activeMode, d, dpBounds);
        },
        extruded: false,
        pickable: true,
        stroked: false,
        updateTriggers: { getFillColor: [activeMode, coverageSet, dpBounds, splitLon] },
        onHover: info => setHoveredHex(info.object || null),
      }));
    }

    if (showCoverage && selectedSites.length) {
      const afterSites = selectedSites.filter(s => s.lon >= splitLon);
      result.push(new ScatterplotLayer({
        id: 'drone-coverage',
        data: afterSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: COVERAGE_RADIUS_KM * 1000,
        getFillColor: [0, 232, 150, 15],
        getLineColor: [0, 232, 150, 60],
        lineWidthMinPixels: 1,
        stroked: true, filled: true,
        updateTriggers: { data: [splitLon] },
      }));
    }

    if (selectedSites.length) {
      const afterSites = selectedSites.filter(s => s.lon >= splitLon);
      result.push(new ScatterplotLayer({
        id: 'drone-glow',
        data: afterSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 600,
        getFillColor: [0, 232, 150, 50],
        radiusMinPixels: 10, radiusMaxPixels: 30,
        updateTriggers: { data: [splitLon] },
      }));
      result.push(new ScatterplotLayer({
        id: 'drone-sites',
        data: afterSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 150,
        getFillColor: [0, 232, 150, 220],
        radiusMinPixels: 4, radiusMaxPixels: 12,
        pickable: true,
        updateTriggers: { data: [splitLon] },
      }));
    }

    return result;
  }, [activeMode, mergedHex, showCoverage, selectedSites, coverageSet, dpBounds, splitLon]);

  return (
    <section id="page-7" className="page page-7-post">
      {/* ═══ TOP BAR ═══ */}
      <div className="p6-topbar">
        <div className="p6-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p6-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => setActiveMode(m.id)}
              style={{ '--tab-color': m.color }}
            >
              <span className="p6-tab-dot" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="p6-budget-group">
          <span className="p6-budget-label">Sites:</span>
          {BUDGETS.map(b => (
            <button
              key={b}
              className={`p6-budget-btn ${budget === b ? 'active' : ''}`}
              onClick={() => setBudget(b)}
            >+{b}</button>
          ))}
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="p6-main">
        {/* ─── LEFT: map (66.67%) ─── */}
        <div className="p6-map-half">
        <div className="p6-map-card" ref={mapCardRef}
          onPointerMove={onSliderMove} onPointerUp={onSliderUp} onPointerLeave={onSliderUp}>
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }) => setViewState(vs)}
            controller={true}
            layers={layers}
            style={{ width: '100%', height: '100%' }}
            useDevicePixels={false}
          >
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/light-v11"
              reuseMaps
            />
          </DeckGL>
          <MapControls
            viewState={viewState}
            onResetView={() => setViewState(VIEW)}
            onResetBearing={() => setViewState(v => ({ ...v, bearing: 0, pitch: 0 }))}
          />

          {hoveredHex && (
            <div className="p6-hex-tooltip">
              {activeMode === 'supply' && (
                <div className="p6-hv-row">
                  <div className="p6-hv"><span>Gap</span> {hoveredHex.dp?.toFixed(1) ?? '—'}</div>
                </div>
              )}
              {activeMode === 'friction' && (
                <div className="p6-hv-row">
                  <div className="p6-hv"><span>Burden</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                  {hoveredHex.covered && (
                    <div className="p6-hv p6-hv-strike"><span>Before</span> {hoveredHex.avg_friction_before?.toFixed(3) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p6-hv-badge">Drone covered</div>}
                </div>
              )}
              {activeMode === 'composite' && (
                <div className="p6-hv-row">
                  <div className="p6-hv"><span>Gap</span> {hoveredHex.gap_index?.toFixed(4) ?? '—'}</div>
                  {hoveredHex.covered && (
                    <div className="p6-hv p6-hv-strike"><span>Before</span> {hoveredHex.gap_index_before?.toFixed(4) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p6-hv-badge">Drone covered</div>}
                </div>
              )}
            </div>
          )}

          {/* ── Before / After slider ── */}
          <div className="p6-slider-line" style={{ left: `${sliderPct}%` }}>
            <div className="p6-slider-handle" onPointerDown={onSliderDown}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
                <path d="M8 5l-5 7 5 7M16 5l5 7-5 7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="p6-slider-label p6-slider-before" style={{ right: `${100 - sliderPct + 2}%` }}>BEFORE</div>
          <div className="p6-slider-label p6-slider-after" style={{ left: `${sliderPct + 2}%` }}>AFTER</div>

          <div className="p6-summary-bar">
            +{selectedSites.length} drone sites: burden reduced by {metrics?.frictionReduction ?? '—'}% in covered areas
          </div>
        </div>
        </div>

        {/* ─── RIGHT: panel (33.33%) ─── */}
        <div className="p6-panel-half">
        <div className="p6-panel">
          <h3 className="p6-panel-title">Before vs After Drone Deployment</h3>

          {metrics && (
            <div className="p6-metrics">
              <div className="p6-metric-card">
                <div className="p6m-val" style={{ color: '#ff3264' }}>
                  {metrics.avgFrictionAfter}
                </div>
                <div className="p6m-lab">Avg Burden</div>
              </div>

              <>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#00e896' }}>
                      -{metrics.frictionReduction}%
                    </div>
                    <div className="p6m-lab">Burden Reduction</div>
                  </div>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#64c8ff' }}>
                      {metrics.coveragePct}%
                    </div>
                    <div className="p6m-lab">Area Covered</div>
                  </div>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#ffa028' }}>
                      +{metrics.numSites}
                    </div>
                    <div className="p6m-lab">Drone Sites</div>
                  </div>
                </>
            </div>
          )}

          {metrics && (
            <div className="p6-comparison">
              <h4>Burden Comparison</h4>
              <div className="p6-comp-row">
                <span className="p6-comp-label">Before</span>
                <div className="p6-comp-track">
                  <div
                    className="p6-comp-fill p6-comp-before"
                    style={{ width: '100%' }}
                  />
                </div>
                <span className="p6-comp-val">{metrics.avgFrictionBefore}</span>
              </div>
              <div className="p6-comp-row">
                <span className="p6-comp-label">After</span>
                <div className="p6-comp-track">
                  <div
                    className="p6-comp-fill p6-comp-after"
                    style={{ width: `${(+metrics.avgFrictionAfter / Math.max(+metrics.avgFrictionBefore, 0.001)) * 100}%` }}
                  />
                </div>
                <span className="p6-comp-val">{metrics.avgFrictionAfter}</span>
              </div>
              <div className="p6-comp-row">
                <span className="p6-comp-label">Covered</span>
                <div className="p6-comp-track">
                  <div
                    className="p6-comp-fill p6-comp-coverage"
                    style={{ width: `${metrics.coveragePct}%` }}
                  />
                </div>
                <span className="p6-comp-val">{metrics.coveredHexes}/{metrics.totalHexes}</span>
              </div>
            </div>
          )}

          {/* ═══ CHARTS ═══ */}
          {frictionDistData.length > 0 && (
            <div className="p6-chart-section">
              <h4>Burden Distribution</h4>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={frictionDistData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="range" tick={{ fill: '#A09888', fontSize: 8 }}
                    tickFormatter={v => v.toFixed(2)} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#A09888', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    labelFormatter={l => `Burden ${Number(l).toFixed(3)}`}
                    formatter={(v, name) => [v, name === 'before' ? 'Before' : 'After']} />
                  <Area type="monotone" dataKey="before" stroke="#ff3264" fill="#ff3264"
                    fillOpacity={0.2} strokeWidth={1.5} name="before" />
                  <Area type="monotone" dataKey="after" stroke="#00e896" fill="#00e896"
                    fillOpacity={0.2} strokeWidth={1.5} name="after" />
                  <Legend formatter={v => v === 'before' ? 'Before' : 'After'} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="p6-chart-note">
Green curve shifts left — burden reduced in covered hexagons.
              </p>
            </div>
          )}

          {efficiencyCurve.length > 1 && (
            <div className="p6-chart-section">
              <h4>Budget Efficiency</h4>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={efficiencyCurve} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="sites" tick={{ fill: '#A09888', fontSize: 8 }}
                    label={{ value: 'Sites', position: 'bottom', fill: '#999', fontSize: 8, offset: -2 }} />
                  <YAxis tick={{ fill: '#A09888', fontSize: 8 }}
                    label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#999', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [`${v}%`, name === 'coverage' ? 'Coverage' : 'Burden ↓']} />
                  <Area type="monotone" dataKey="coverage" stroke="#64c8ff" fill="#64c8ff"
                    fillOpacity={0.15} strokeWidth={1.5} name="coverage" />
                  <Area type="monotone" dataKey="reduction" stroke="#00e896" fill="#00e896"
                    fillOpacity={0.15} strokeWidth={1.5} name="reduction" />
                  <Legend formatter={v => v === 'coverage' ? 'Coverage %' : 'Burden Reduction %'} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="p6-chart-note">Diminishing returns: early sites cover the most high-burden area.</p>
            </div>
          )}

          {barrierComparison && (
            <div className="p6-chart-section">
              <h4>Barrier Crossings / Trip</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barrierComparison} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="type" tick={{ fill: '#A09888', fontSize: 8 }} />
                  <YAxis tick={{ fill: '#A09888', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="before" fill="#ff3264" fillOpacity={0.6} name="Before" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="after" fill="#00e896" fillOpacity={0.6} name="After" radius={[3, 3, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {topImproved.length > 0 && (
            <div className="p6-chart-section">
              <h4>Most Improved Hexagons</h4>
              <div className="p6-improved-list">
                {topImproved.map((hex, i) => (
                  <div key={hex.h3} className="p6-imp-row">
                    <span className="p6-imp-rank">#{i + 1}</span>
                    <div className="p6-imp-bars">
                      <div className="p6-imp-before"
                        style={{ width: `${(hex.before / topImproved[0].before) * 100}%` }} />
                      <div className="p6-imp-after"
                        style={{ width: `${(hex.after / topImproved[0].before) * 100}%` }} />
                    </div>
                    <span className="p6-imp-delta">-{(hex.delta / hex.before * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <p className="p6-chart-note">Red = before, green = after. Covered hexagons with largest burden drop.</p>
            </div>
          )}

          {demandCoverage && (
            <div className="p6-chart-section">
              <h4>High-Demand Area Coverage</h4>
              <div className="p6-donut-wrap">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={demandCoverage} cx="50%" cy="50%"
                      innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {demandCoverage.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE}
                      formatter={(v, name) => [v, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="p6-donut-center">
                  {((demandCoverage[0].value / Math.max(demandCoverage[0].value + demandCoverage[1].value, 1)) * 100).toFixed(0)}%
                </div>
              </div>
              <p className="p6-chart-note">High-demand hexagons (index &gt; 0.3) covered by drone sites.</p>
            </div>
          )}

          {giniData && (
            <div className="p6-chart-section">
              <h4>Spatial Equity (Gini)</h4>
              <div className="p6-gini">
                <div className="p6-gini-row">
                  <span className="p6-gini-label">Before</span>
                  <div className="p6-gini-track">
                    <div className="p6-gini-fill p6-gini-before"
                      style={{ width: `${Math.min(giniData.before * 100, 100)}%` }} />
                  </div>
                  <span className="p6-gini-val">{giniData.before.toFixed(4)}</span>
                </div>
                <div className="p6-gini-row">
                  <span className="p6-gini-label">After</span>
                  <div className="p6-gini-track">
                    <div className="p6-gini-fill p6-gini-after"
                      style={{ width: `${Math.min(giniData.after * 100, 100)}%` }} />
                  </div>
                  <span className="p6-gini-val">{giniData.after.toFixed(4)}</span>
                </div>
              </div>
              <p className="p6-chart-note">
                Lower = more equal distribution.
                {giniData.before > 0 && ` Change: ${((giniData.before - giniData.after) / giniData.before * 100).toFixed(1)}% more equitable.`}
              </p>
            </div>
          )}

          {siteRoi.length > 0 && (
            <div className="p6-chart-section">
              <h4>Site ROI (Score vs Coverage)</h4>
              <ResponsiveContainer width="100%" height={150}>
                <ScatterChart margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="score" type="number" name="Score"
                    tick={{ fill: '#A09888', fontSize: 8 }}
                    label={{ value: 'Score', position: 'bottom', fill: '#999', fontSize: 8, offset: -2 }} />
                  <YAxis dataKey="covered" type="number" name="Hexes Covered"
                    tick={{ fill: '#A09888', fontSize: 8 }}
                    label={{ value: 'Hexes', angle: -90, position: 'insideLeft', fill: '#999', fontSize: 8 }} />
                  <ZAxis range={[20, 20]} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [v, name]} />
                  <Scatter data={siteRoi} fill="#ffa028" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="p6-chart-note">Each dot = one drone site. Top-right = best return on investment.</p>
            </div>
          )}

          {(
            <div className="p6-budget-info">
              <h4>Drone Site Budget</h4>
              <p className="p6-budget-desc">
                Adding <strong>{selectedSites.length}</strong> drone sites (ranked by composite
                score: 0.4·D·F + 0.3·I·F + 0.3·D·I) with a 3 km coverage radius reduces
                average ground burden by <strong>{metrics?.frictionReduction ?? '—'}%</strong>.
              </p>
              <div className="p6-budget-visual">
                {BUDGETS.map(b => (
                  <button
                    key={b}
                    className={`p6-bv-btn ${budget === b ? 'active' : ''}`}
                    onClick={() => setBudget(b)}
                  >
                    <div className="p6-bv-num">+{b}</div>
                    <div className="p6-bv-label">sites</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p6-insight">
            <p>
              Drag the slider to compare. With <strong>{selectedSites.length}</strong> strategically
              placed drone sites,
              {metrics ? ` ${metrics.coveragePct}% of high-burden areas are now covered. ` : ' '}
              Hexagons within the 3 km coverage radius show dramatically reduced burden
              as drones bypass ground barriers entirely.
            </p>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

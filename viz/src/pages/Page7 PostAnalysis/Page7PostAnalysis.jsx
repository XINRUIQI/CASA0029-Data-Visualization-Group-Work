import { useState, useEffect, useMemo } from 'react';
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
import './Page7PostAnalysis.css';

const COVERAGE_RADIUS_KM = 3;
const FRICTION_REDUCTION = 0.7;

const LAYER_MODES = [
  { id: 'friction', label: 'Friction', color: '#ff3264' },
  { id: 'priority', label: 'Priority', color: '#c864ff' },
  { id: 'relief',   label: 'Relief',   color: '#e05030' },
  { id: 'demand',   label: 'Demand',   color: '#ff4500' },
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
  longitude: SHENZHEN_CENTER[0],
  latitude:  SHENZHEN_CENTER[1],
  zoom: 11,
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

function hexColor(mode, d) {
  if (!d) return [80, 80, 80, 40];

  const fr  = d.avg_friction || 0;
  const tdi = d.takeout_demand_index || 0;

  if ((mode === 'friction' || mode === 'priority') && !(fr > 0))
    return [0, 0, 0, 0];

  if (mode === 'demand') {
    const v = Math.min(tdi, 1);
    return [255, Math.round(100 * (1 - v)), Math.round(50 * (1 - v)), Math.round(15 + 220 * v)];
  }

  if (mode === 'friction') {
    const t = Math.min(Math.max(fr, 0), 1);
    const v = Math.pow(Math.min(1, t * 1.18), 0.38);
    return [255, Math.round(235 * (1 - v)), Math.round(175 * (1 - v)), Math.round(28 + 227 * v)];
  }

  if (mode === 'priority') {
    const dv  = Math.min(tdi, 1);
    const fv  = Math.min(fr, 1);
    const raw = Math.min(1, dv * fv);
    const v   = Math.pow(Math.min(1, raw * 1.28), 0.34);
    return [Math.round(118 + 137 * v), Math.round(238 * (1 - v)), Math.round(168 + 87 * v), Math.round(26 + 229 * v)];
  }

  if (mode === 'relief') {
    const rv = d.relief_vulnerability || 0;
    if (rv <= 0) return [0, 0, 0, 0];
    const v = Math.pow(Math.min(rv / 0.14, 1), 0.45);
    return [
      Math.round(255 * v),
      Math.round(100 + 80 * (1 - v)),
      Math.round(50 * (1 - v)),
      Math.round(30 + 225 * v),
    ];
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
  const [activeMode, setActiveMode]       = useState('friction');
  const [viewMode, setViewMode]           = useState('after');
  const [budget, setBudget]               = useState(50);
  const [activeBarriers, setActiveBarriers] = useState(new Set(['water', 'railway', 'highway_major']));
  const [showBarriers, setShowBarriers]   = useState(true);
  const [showRoutes, setShowRoutes]       = useState(false);
  const [showCoverage, setShowCoverage]   = useState(true);
  const [hoveredHex, setHoveredHex]       = useState(null);

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
      const isCovered   = viewMode === 'after' && coverageSet.has(d.h3);
      const frictionMul = isCovered ? (1 - FRICTION_REDUCTION) : 1;

      return {
        ...d,
        avg_friction:        (gap?.avg_friction || 0) * frictionMul,
        avg_friction_before: gap?.avg_friction || 0,
        gap_index:           (gap?.gap_index || 0) * (isCovered ? 0.4 : 1),
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
  }, [h3Demand, h3Gap, h3Takeout, viewMode, coverageSet]);

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

  const layers = useMemo(() => {
    const result = [];

    if (showBarriers && barriers && activeMode !== 'demand') {
      Object.entries(barriers)
        .filter(([type]) => activeBarriers.has(type))
        .forEach(([type, data]) => {
          result.push(new GeoJsonLayer({
            id: `barrier-${type}`, data,
            getFillColor: BARRIER_COLORS[type],
            getLineColor: BARRIER_COLORS[type],
            getLineWidth: type === 'railway' ? 3 : 2,
            lineWidthMinPixels: 1, opacity: 0.6, pickable: false,
          }));
        });
    }

    if (mergedHex) {
      result.push(new H3HexagonLayer({
        id: 'analysis-hex',
        data: mergedHex,
        getHexagon: d => d.h3,
        getFillColor: d => hexColor(activeMode, d),
        extruded: false,
        pickable: true,
        stroked: false,
        updateTriggers: { getFillColor: [activeMode, viewMode, coverageSet] },
        onHover: info => setHoveredHex(info.object || null),
      }));
    }

    if (showRoutes && routes) {
      result.push(new GeoJsonLayer({
        id: 'od-routes', data: routes,
        getLineColor: f => {
          const fr = f.properties?.ground_friction ?? 0;
          const v  = Math.min(fr / 0.6, 1);
          return [0, Math.round(255 * (1 - v * 0.6)), Math.round(220 - 100 * v), 50 + Math.round(130 * v)];
        },
        getLineWidth: 1.5,
        lineWidthMinPixels: 0.5, lineWidthMaxPixels: 3, pickable: false,
      }));
    }

    if (viewMode === 'after' && showCoverage && selectedSites.length) {
      result.push(new ScatterplotLayer({
        id: 'drone-coverage',
        data: selectedSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: COVERAGE_RADIUS_KM * 1000,
        getFillColor: [0, 232, 150, 15],
        getLineColor: [0, 232, 150, 60],
        lineWidthMinPixels: 1,
        stroked: true, filled: true,
      }));
    }

    if (viewMode === 'after' && selectedSites.length) {
      result.push(new ScatterplotLayer({
        id: 'drone-glow',
        data: selectedSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 600,
        getFillColor: [0, 232, 150, 50],
        radiusMinPixels: 10, radiusMaxPixels: 30,
      }));
      result.push(new ScatterplotLayer({
        id: 'drone-sites',
        data: selectedSites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 150,
        getFillColor: [0, 232, 150, 220],
        radiusMinPixels: 4, radiusMaxPixels: 12,
        pickable: true,
      }));
    }

    return result;
  }, [barriers, activeBarriers, showBarriers, activeMode, mergedHex,
      routes, showRoutes, viewMode, showCoverage, selectedSites, coverageSet]);

  return (
    <section id="page-7" className="page page-7-post">
      {/* ═══ TOP BAR ═══ */}
      <div className="p7-topbar">
        <div className="p7-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p7-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => setActiveMode(m.id)}
              style={{ '--tab-color': m.color }}
            >
              <span className="p7-tab-dot" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="p7-view-toggle">
          <button
            className={`p7-vt-btn ${viewMode === 'before' ? 'active' : ''}`}
            onClick={() => setViewMode('before')}
          >Before</button>
          <button
            className={`p7-vt-btn ${viewMode === 'after' ? 'active' : ''}`}
            onClick={() => setViewMode('after')}
          >After Drones</button>
        </div>

        {viewMode === 'after' && (
          <div className="p7-budget-group">
            <span className="p7-budget-label">Sites:</span>
            {BUDGETS.map(b => (
              <button
                key={b}
                className={`p7-budget-btn ${budget === b ? 'active' : ''}`}
                onClick={() => setBudget(b)}
              >+{b}</button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="p7-main">
        {/* ─── MAP ─── */}
        <div className="p7-map-area">
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
            <div className="p7-hex-tooltip">
              {activeMode === 'friction' && (
                <div className="p7-hv-row">
                  <div className="p7-hv"><span>Friction</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                  {viewMode === 'after' && hoveredHex.covered && (
                    <div className="p7-hv p7-hv-strike"><span>Before</span> {hoveredHex.avg_friction_before?.toFixed(3) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p7-hv-badge">Drone covered</div>}
                </div>
              )}
              {activeMode === 'priority' && (
                <div className="p7-hv-row">
                  <div className="p7-hv">
                    <span>D×F</span>
                    {(Math.min(hoveredHex.takeout_demand_index ?? 0, 1) * Math.min(hoveredHex.avg_friction ?? 0, 1)).toFixed(4)}
                  </div>
                  {hoveredHex.covered && <div className="p7-hv-badge">Drone covered</div>}
                </div>
              )}
              {activeMode === 'relief' && (
                <div className="p7-hv-row">
                  <div className="p7-hv"><span>Relief</span> {hoveredHex.relief_vulnerability?.toFixed(4) ?? '—'}</div>
                  <div className="p7-hv"><span>Friction</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                  {hoveredHex.covered && <div className="p7-hv-badge">Drone covered</div>}
                </div>
              )}
              {activeMode === 'demand' && (
                <div className="p7-hv-row">
                  <div className="p7-hv"><span>Demand</span> {hoveredHex.takeout_demand_index?.toFixed(3) ?? '—'}</div>
                </div>
              )}
            </div>
          )}

          {(activeMode === 'friction' || activeMode === 'priority' || activeMode === 'relief') && (
            <div className="p7-barrier-float">
              <div className="p7-bf-title">
                <label>
                  <input type="checkbox" checked={showBarriers} onChange={e => setShowBarriers(e.target.checked)} />
                  Barrier Layers
                </label>
              </div>
              {BARRIER_TYPES.map(b => (
                <button
                  key={b.id}
                  className={`p7-bf-chip ${activeBarriers.has(b.id) ? 'on' : ''}`}
                  onClick={() => toggleBarrier(b.id)}
                  style={{ '--chip-color': b.color }}
                >
                  <span className="p7-chip-dot" />
                  {b.label}
                </button>
              ))}
              {activeMode === 'priority' && (
                <div className="p7-bf-title" style={{ marginTop: 8 }}>
                  <label>
                    <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />
                    OD Routes
                  </label>
                </div>
              )}
              {viewMode === 'after' && (
                <div className="p7-bf-title" style={{ marginTop: 8 }}>
                  <label>
                    <input type="checkbox" checked={showCoverage} onChange={e => setShowCoverage(e.target.checked)} />
                    Coverage Circles
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="p7-summary-bar">
            {viewMode === 'before'
              ? 'Ground friction before drone deployment — same as original analysis'
              : `After +${selectedSites.length} drone sites: friction reduced by ${metrics?.frictionReduction ?? '—'}% in covered areas`}
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="p7-panel">
          <h3 className="p7-panel-title">
            {viewMode === 'before' ? 'Before Drones' : 'After Drone Deployment'}
          </h3>

          {metrics && (
            <div className="p7-metrics">
              <div className="p7-metric-card">
                <div className="p7m-val" style={{ color: '#ff3264' }}>
                  {viewMode === 'before' ? metrics.avgFrictionBefore : metrics.avgFrictionAfter}
                </div>
                <div className="p7m-lab">Avg Friction</div>
              </div>

              {viewMode === 'after' && (
                <>
                  <div className="p7-metric-card">
                    <div className="p7m-val" style={{ color: '#00e896' }}>
                      -{metrics.frictionReduction}%
                    </div>
                    <div className="p7m-lab">Friction Reduction</div>
                  </div>
                  <div className="p7-metric-card">
                    <div className="p7m-val" style={{ color: '#64c8ff' }}>
                      {metrics.coveragePct}%
                    </div>
                    <div className="p7m-lab">Area Covered</div>
                  </div>
                  <div className="p7-metric-card">
                    <div className="p7m-val" style={{ color: '#ffa028' }}>
                      +{metrics.numSites}
                    </div>
                    <div className="p7m-lab">Drone Sites</div>
                  </div>
                </>
              )}
            </div>
          )}

          {viewMode === 'after' && metrics && (
            <div className="p7-comparison">
              <h4>Friction Comparison</h4>
              <div className="p7-comp-row">
                <span className="p7-comp-label">Before</span>
                <div className="p7-comp-track">
                  <div
                    className="p7-comp-fill p7-comp-before"
                    style={{ width: '100%' }}
                  />
                </div>
                <span className="p7-comp-val">{metrics.avgFrictionBefore}</span>
              </div>
              <div className="p7-comp-row">
                <span className="p7-comp-label">After</span>
                <div className="p7-comp-track">
                  <div
                    className="p7-comp-fill p7-comp-after"
                    style={{ width: `${(+metrics.avgFrictionAfter / Math.max(+metrics.avgFrictionBefore, 0.001)) * 100}%` }}
                  />
                </div>
                <span className="p7-comp-val">{metrics.avgFrictionAfter}</span>
              </div>
              <div className="p7-comp-row">
                <span className="p7-comp-label">Covered</span>
                <div className="p7-comp-track">
                  <div
                    className="p7-comp-fill p7-comp-coverage"
                    style={{ width: `${metrics.coveragePct}%` }}
                  />
                </div>
                <span className="p7-comp-val">{metrics.coveredHexes}/{metrics.totalHexes}</span>
              </div>
            </div>
          )}

          {/* ═══ CHARTS ═══ */}
          {frictionDistData.length > 0 && (
            <div className="p7-chart-section">
              <h4>Friction Distribution</h4>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={frictionDistData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,50,110,0.1)" />
                  <XAxis dataKey="range" tick={{ fill: '#9888a8', fontSize: 8 }}
                    tickFormatter={v => v.toFixed(2)} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#9888a8', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    labelFormatter={l => `Friction ${Number(l).toFixed(3)}`}
                    formatter={(v, name) => [v, name === 'before' ? 'Before' : 'After']} />
                  <Area type="monotone" dataKey="before" stroke="#ff3264" fill="#ff3264"
                    fillOpacity={0.2} strokeWidth={1.5} name="before" />
                  {viewMode === 'after' && (
                    <Area type="monotone" dataKey="after" stroke="#00e896" fill="#00e896"
                      fillOpacity={0.2} strokeWidth={1.5} name="after" />
                  )}
                  <Legend formatter={v => v === 'before' ? 'Before' : 'After'} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="p7-chart-note">
                {viewMode === 'after'
                  ? 'Green curve shifts left — friction reduced in covered hexagons.'
                  : 'Original friction distribution across all hexagons.'}
              </p>
            </div>
          )}

          {viewMode === 'after' && efficiencyCurve.length > 1 && (
            <div className="p7-chart-section">
              <h4>Budget Efficiency</h4>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={efficiencyCurve} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,50,110,0.1)" />
                  <XAxis dataKey="sites" tick={{ fill: '#9888a8', fontSize: 8 }}
                    label={{ value: 'Sites', position: 'bottom', fill: '#999', fontSize: 8, offset: -2 }} />
                  <YAxis tick={{ fill: '#9888a8', fontSize: 8 }}
                    label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#999', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [`${v}%`, name === 'coverage' ? 'Coverage' : 'Friction ↓']} />
                  <Area type="monotone" dataKey="coverage" stroke="#64c8ff" fill="#64c8ff"
                    fillOpacity={0.15} strokeWidth={1.5} name="coverage" />
                  <Area type="monotone" dataKey="reduction" stroke="#00e896" fill="#00e896"
                    fillOpacity={0.15} strokeWidth={1.5} name="reduction" />
                  <Legend formatter={v => v === 'coverage' ? 'Coverage %' : 'Friction Reduction %'} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="p7-chart-note">Diminishing returns: early sites cover the most high-friction area.</p>
            </div>
          )}

          {viewMode === 'after' && barrierComparison && (
            <div className="p7-chart-section">
              <h4>Barrier Crossings / Trip</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barrierComparison} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,50,110,0.1)" />
                  <XAxis dataKey="type" tick={{ fill: '#9888a8', fontSize: 8 }} />
                  <YAxis tick={{ fill: '#9888a8', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="before" fill="#ff3264" fillOpacity={0.6} name="Before" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="after" fill="#00e896" fillOpacity={0.6} name="After" radius={[3, 3, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {viewMode === 'after' && topImproved.length > 0 && (
            <div className="p7-chart-section">
              <h4>Most Improved Hexagons</h4>
              <div className="p7-improved-list">
                {topImproved.map((hex, i) => (
                  <div key={hex.h3} className="p7-imp-row">
                    <span className="p7-imp-rank">#{i + 1}</span>
                    <div className="p7-imp-bars">
                      <div className="p7-imp-before"
                        style={{ width: `${(hex.before / topImproved[0].before) * 100}%` }} />
                      <div className="p7-imp-after"
                        style={{ width: `${(hex.after / topImproved[0].before) * 100}%` }} />
                    </div>
                    <span className="p7-imp-delta">-{(hex.delta / hex.before * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <p className="p7-chart-note">Red = before, green = after. Covered hexagons with largest friction drop.</p>
            </div>
          )}

          {viewMode === 'after' && demandCoverage && (
            <div className="p7-chart-section">
              <h4>High-Demand Area Coverage</h4>
              <div className="p7-donut-wrap">
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
                <div className="p7-donut-center">
                  {((demandCoverage[0].value / Math.max(demandCoverage[0].value + demandCoverage[1].value, 1)) * 100).toFixed(0)}%
                </div>
              </div>
              <p className="p7-chart-note">High-demand hexagons (index &gt; 0.3) covered by drone sites.</p>
            </div>
          )}

          {viewMode === 'after' && giniData && (
            <div className="p7-chart-section">
              <h4>Spatial Equity (Gini)</h4>
              <div className="p7-gini">
                <div className="p7-gini-row">
                  <span className="p7-gini-label">Before</span>
                  <div className="p7-gini-track">
                    <div className="p7-gini-fill p7-gini-before"
                      style={{ width: `${Math.min(giniData.before * 100, 100)}%` }} />
                  </div>
                  <span className="p7-gini-val">{giniData.before.toFixed(4)}</span>
                </div>
                <div className="p7-gini-row">
                  <span className="p7-gini-label">After</span>
                  <div className="p7-gini-track">
                    <div className="p7-gini-fill p7-gini-after"
                      style={{ width: `${Math.min(giniData.after * 100, 100)}%` }} />
                  </div>
                  <span className="p7-gini-val">{giniData.after.toFixed(4)}</span>
                </div>
              </div>
              <p className="p7-chart-note">
                Lower = more equal distribution.
                {giniData.before > 0 && ` Change: ${((giniData.before - giniData.after) / giniData.before * 100).toFixed(1)}% more equitable.`}
              </p>
            </div>
          )}

          {viewMode === 'after' && siteRoi.length > 0 && (
            <div className="p7-chart-section">
              <h4>Site ROI (Score vs Coverage)</h4>
              <ResponsiveContainer width="100%" height={150}>
                <ScatterChart margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(90,50,110,0.1)" />
                  <XAxis dataKey="score" type="number" name="Score"
                    tick={{ fill: '#9888a8', fontSize: 8 }}
                    label={{ value: 'Score', position: 'bottom', fill: '#999', fontSize: 8, offset: -2 }} />
                  <YAxis dataKey="covered" type="number" name="Hexes Covered"
                    tick={{ fill: '#9888a8', fontSize: 8 }}
                    label={{ value: 'Hexes', angle: -90, position: 'insideLeft', fill: '#999', fontSize: 8 }} />
                  <ZAxis range={[20, 20]} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [v, name]} />
                  <Scatter data={siteRoi} fill="#ffa028" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="p7-chart-note">Each dot = one drone site. Top-right = best return on investment.</p>
            </div>
          )}

          {viewMode === 'after' && (
            <div className="p7-budget-info">
              <h4>Drone Site Budget</h4>
              <p className="p7-budget-desc">
                Adding <strong>{selectedSites.length}</strong> drone sites (ranked by composite
                score: 0.4·D·F + 0.3·I·F + 0.3·D·I) with a 3 km coverage radius reduces
                average ground friction by <strong>{metrics?.frictionReduction ?? '—'}%</strong>.
              </p>
              <div className="p7-budget-visual">
                {BUDGETS.map(b => (
                  <button
                    key={b}
                    className={`p7-bv-btn ${budget === b ? 'active' : ''}`}
                    onClick={() => setBudget(b)}
                  >
                    <div className="p7-bv-num">+{b}</div>
                    <div className="p7-bv-label">sites</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p7-insight">
            {viewMode === 'before' ? (
              <p>
                This map shows the original ground friction landscape across Shenzhen.
                Water bodies, railways, and expressways create systematic delivery barriers,
                forcing detours that compound into measurable friction. Toggle to
                <strong> After Drones</strong> to see how strategic drone placement transforms
                this landscape.
              </p>
            ) : (
              <p>
                With <strong>{selectedSites.length}</strong> strategically placed drone sites,
                {metrics ? ` ${metrics.coveragePct}% of high-friction areas are now covered. ` : ' '}
                Hexagons within the 3 km coverage radius show dramatically reduced friction
                as drones bypass ground barriers entirely — flying straight where vehicles
                must detour around water, railways, and expressways.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

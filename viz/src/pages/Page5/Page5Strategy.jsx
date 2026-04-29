import { useState, useEffect, useMemo, useCallback } from 'react';
import Page5Map from './Page5Map';
import Page5Panel from './Page5Panel';
import { publicDataUrl } from '../../config';
import { latLngToCell, gridDisk } from 'h3-js';
import './Page5.css';

const N = 80;

function sampleRoutes(features, n) {
  const inBounds = features.filter(f => {
    const [lng, lat] = f.geometry.coordinates[0];
    return lng > 113.7 && lng < 114.6 && lat > 22.4 && lat < 22.8;
  });
  const step = Math.max(1, Math.floor(inBounds.length / n));
  const picked = [];
  for (let i = 0; i < inBounds.length && picked.length < n; i += step) {
    const coords = inBounds[i].geometry.coordinates;
    picked.push({
      id: picked.length,
      origin: coords[0],
      destination: coords[coords.length - 1],
    });
  }
  return picked;
}

function shortName(full) {
  return full ? full.split(',')[0].trim() : full;
}

async function reverseGeocode([lng, lat]) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=en`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const json = await res.json();
    return shortName(json.display_name) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

/* ── Page6 optimization logic (moved here) ── */
const OPT_STRATEGIES = [
  { id: 'demand',   label: 'Demand-first',   desc: 'GAP = demand − supply (supply ≈ 1 − friction); rank high→low' },
  { id: 'friction', label: 'Friction-first', desc: 'Rank by ground-friction intensity, high→low' },
  { id: 'gap',      label: 'Composite',      desc: '0.4·D·F + 0.3·I·F + 0.3·D·I (urgent→not-urgent)' },
];
const OPT_BUDGETS = [20, 50, 100];

function scoreFor(site, strategy) {
  const d = site.demand_norm ?? 0;
  const f = site.friction_norm ?? 0;
  const i = site.intensity_norm ?? 0;
  if (strategy === 'demand') return d;
  if (strategy === 'friction') return f;
  return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i;
}

export default function Page5Strategy() {
  const [buildingData,    setBuildingData]    = useState(null);
  const [rawRoutes,       setRawRoutes]       = useState(null);
  const [comparisonRoute, setComparisonRoute] = useState(null);
  const [pickMode,        setPickMode]        = useState(null);
  const [injectedPoint,   setInjectedPoint]   = useState(null);

  /* ── Optimization state (from Page6) ── */
  const [optStrategy, setOptStrategy] = useState('gap');
  const [optBudget,   setOptBudget]   = useState(20);
  const [optSites,    setOptSites]    = useState(null);
  const [optH3Demand, setOptH3Demand] = useState(null);
  const [optHovered,  setOptHovered]  = useState(null);
  const [optShowCov,  setOptShowCov]  = useState(true);
  const [optView,     setOptView]     = useState('after');

  useEffect(() => {
    fetch(publicDataUrl('data/buildings_all.geojson'))
      .then(r => r.json()).then(setBuildingData).catch(() => {});
    fetch(publicDataUrl('data/page2_routes.json'))
      .then(r => r.json()).then(d => setRawRoutes(d.features)).catch(() => {});

    /* fetch optimization data (from Page6) */
    fetch(publicDataUrl('data/page6_candidate_sites.json'))
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { if (Array.isArray(d)) setOptSites(d); })
      .catch(() => setOptSites([]));
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setOptH3Demand)
      .catch(() => {});
  }, []);

  const routes = useMemo(
    () => (rawRoutes ? sampleRoutes(rawRoutes, N) : []),
    [rawRoutes]
  );

  const h3Cells = useMemo(() => {
    try {
      const center = latLngToCell(22.53, 114.058, 9);
      return gridDisk(center, 6).map((h3, i) => ({
        h3,
        v: Math.sin(i * 0.31) * 0.5 + Math.cos(i * 0.17) * 0.35 + 0.5,
      }));
    }
    catch {
      return [];
    }
  }, []);

  const tallBuildings = useMemo(() => {
    if (!buildingData) return [];
    return buildingData.features
      .filter(f => (f.properties?.height ?? 0) > 110)
      .map(f => {
        const outerRing = f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates[0][0]
          : f.geometry.coordinates[0];
        const lngs = outerRing.map(c => c[0]);
        const lats  = outerRing.map(c => c[1]);
        const centroid = [
          (Math.max(...lngs) + Math.min(...lngs)) / 2,
          (Math.max(...lats) + Math.min(...lats)) / 2,
        ];
        const dx = (Math.max(...lngs) - Math.min(...lngs)) * 102500;
        const dy = (Math.max(...lats) - Math.min(...lats)) * 111000;
        const radiusM = Math.sqrt(dx * dx + dy * dy) / 2;
        return { centroid, radiusM };
      });
  }, [buildingData]);

  /* ── Optimization ranking (from Page6) ── */
  const optRanked = useMemo(() => {
    if (!optSites) return [];
    const scored = optSites.map(s => ({ ...s, score: scoreFor(s, optStrategy) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [optSites, optStrategy]);

  const optCurrent = useMemo(() => optRanked.slice(0, optBudget), [optRanked, optBudget]);

  const clearComparisonRoute = useCallback(() => {
    setComparisonRoute(null);
  }, []);

  const handleMapClick = async (coords) => {
    if (!pickMode) return;
    const name = await reverseGeocode(coords);
    setInjectedPoint({ mode: pickMode, coords, name });
    setPickMode(null);
  };

  return (
    <section id="page-5" className="page page-5">
      {/* ── Optimization controls (from Page6) ── */}
      <div className="p5-opt-bar">
        <div className="p5-opt-group">
          <span className="p5-opt-label">Strategy</span>
          <div className="p5-opt-btns">
            {OPT_STRATEGIES.map(s => (
              <button key={s.id}
                className={`p5-opt-btn p5-opt-strat ${optStrategy === s.id ? 'active' : ''}`}
                onClick={() => setOptStrategy(s.id)} title={s.desc}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="p5-opt-group">
          <span className="p5-opt-label">Budget</span>
          <div className="p5-opt-btns">
            {OPT_BUDGETS.map(b => (
              <button key={b}
                className={`p5-opt-btn p5-opt-budget ${optBudget === b ? 'active' : ''}`}
                onClick={() => setOptBudget(b)}>+{b}</button>
            ))}
          </div>
        </div>
        <div className="p5-opt-group">
          <span className="p5-opt-label">View</span>
          <div className="p5-opt-btns">
            <button className={`p5-opt-btn p5-opt-view ${optView === 'before' ? 'active' : ''}`}
              onClick={() => setOptView('before')}>Before</button>
            <button className={`p5-opt-btn p5-opt-view ${optView === 'after' ? 'active' : ''}`}
              onClick={() => setOptView('after')}>After</button>
          </div>
        </div>
        <label className="p5-opt-check">
          <input type="checkbox" checked={optShowCov} onChange={e => setOptShowCov(e.target.checked)} />
          Coverage
        </label>
      </div>

      {optHovered && (
        <div className="p5-opt-tooltip">
          <span className="p5-opt-tt-rank">#{optHovered.rank}</span>
          <span className="p5-opt-tt-score">Score: {(optHovered.score || 0).toFixed(3)}</span>
        </div>
      )}

      {!comparisonRoute && (
        <div className="p5-enter-hint" role="status">
          <span className="p5-enter-hint-kicker">Getting started</span>
          <span className="p5-enter-hint-text">
            A sample route <strong>compares automatically</strong> when the page loads. Use the <strong>left panel</strong> to change addresses or <em>Pick</em> on the map, then tap <strong>Compare routes</strong> to refresh.
          </span>
          <span className="p5-enter-hint-sub">Background arcs show sample OD flows — your comparison overlays on top when ready.</span>
        </div>
      )}
      <Page5Map
        buildingData={buildingData}
        routes={routes}
        comparisonRoute={comparisonRoute}
        pickMode={pickMode}
        onMapClick={handleMapClick}
        h3Cells={h3Cells}
        optSites={optCurrent}
        optAllSites={optRanked}
        optH3Demand={optH3Demand}
        optShowCoverage={optShowCov}
        optShowBeforeAfter={optView}
        onOptHoverSite={setOptHovered}
      />
      <Page5Panel
        onResult={setComparisonRoute}
        onClear={clearComparisonRoute}
        pickMode={pickMode}
        setPickMode={setPickMode}
        injectedPoint={injectedPoint}
        tallBuildings={tallBuildings}
      />
    </section>
  );
}

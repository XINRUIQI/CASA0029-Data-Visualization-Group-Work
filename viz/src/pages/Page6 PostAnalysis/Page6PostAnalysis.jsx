import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MAPBOX_TOKEN } from '../../config';
import { publicDataUrl } from '../../config';
import MapControls from '../../components/MapControls';
import { AreaChart, Area, PieChart, Pie, Cell,
         ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend } from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Page6PostAnalysis.css';

const FRICTION_REDUCTION = 0.7;

const LAYER_MODES = [
  { id: 'acc_demand', label: 'GAP',       color: '#64c8ff' },
  { id: 'friction',   label: 'Burden',    color: '#ff3264' },
  { id: 'composite',  label: 'Composite', color: '#c864ff' },
];

const BUDGETS = [20, 50, 100];

const VIEW = {
  longitude: 114.15,
  latitude:  22.62,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

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

function hexColor(mode, d) {
  if (!d) return [80, 80, 80, 40];

  if (mode === 'acc_demand') {
    const ad = d._ad ?? 0;
    if (ad === 0 && (d.dn ?? 0) === 0) return [0, 0, 0, 0];
    if (ad <= 0) {
      return [216, 232, 242, 120];
    }
    const v = Math.min(ad / 3, 1);
    const rgb = rampLerp(SUPPLY_RAMP, v);
    return [...rgb, Math.round(60 + 195 * v)];
  }

  const fr = d.avg_friction || 0;

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
  const [precomputed, setPrecomputed] = useState(null);

  const [viewState, setViewState]         = useState(VIEW);
  const [activeMode, setActiveMode]       = useState('acc_demand');
  const [budget, setBudget]               = useState(50);
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
    fetch(publicDataUrl('data/page6_precomputed.json'))
      .then(r => r.json())
      .then(setPrecomputed)
      .catch(() => {});
  }, []);

  const budgetData      = precomputed?.budgets?.[budget];
  const selectedSites   = budgetData?.selectedSites ?? [];
  const metrics         = budgetData?.metrics ?? null;
  const frictionDistData = budgetData?.frictionDistData ?? [];

  const coveredSet = useMemo(() => {
    return new Set(budgetData?.coveredH3 ?? []);
  }, [budgetData]);

  const adaKey = `ada${budget}`;
  const faiKey = `fai${budget}`;

  const mergedHex = useMemo(() => {
    if (!precomputed?.baseMergedHex) return null;
    return precomputed.baseMergedHex.map(d => {
      const covered = coveredSet.has(d.h3);
      return {
        h3: d.h3,
        _lon: d._lon,
        dp: d.dp,
        dn: d.dn,
        avg_friction: d.fr * (covered ? (1 - FRICTION_REDUCTION) : 1),
        avg_friction_before: d.fr,
        gap_index: d.gi * (covered ? 0.4 : 1),
        gap_index_before: d.gi,
        covered,
        lai: d.lai ?? 0,
        acc_demand_before: d.adb ?? 0,
        acc_demand_after: d[adaKey] ?? d.adb ?? 0,
        _fai: d[faiKey] ?? d.lai ?? 0,
      };
    });
  }, [precomputed, coveredSet, adaKey, faiKey]);

  const [beforeColors, afterColors] = useMemo(() => {
    if (!mergedHex) return [null, null];
    const before = new window.Map();
    const after  = new window.Map();
    for (const d of mergedHex) {
      before.set(d.h3, hexColor(activeMode, {
        ...d,
        avg_friction: d.avg_friction_before,
        gap_index: d.gap_index_before,
        _ad: d.acc_demand_before,
      }));
      after.set(d.h3, hexColor(activeMode, {
        ...d,
        _ad: d.acc_demand_after,
      }));
    }
    return [before, after];
  }, [mergedHex, activeMode]);

  const coverageComparison = useMemo(() => {
    if (!precomputed?.budgets) return null;
    const items = BUDGETS.map(b => {
      const m = precomputed.budgets[b]?.metrics;
      if (!m) return null;
      const covered = +m.coveredHexes, total = +m.totalHexes;
      if (!total) return null;
      return {
        budget: b, covered, uncovered: total - covered, total,
        pct: +m.coveragePct,
        data: [
          { name: 'Covered', value: covered, fill: '#F2EBD9' },
          { name: 'Uncovered', value: total - covered, fill: 'rgba(168,196,212,0.25)' },
        ],
      };
    }).filter(Boolean);
    return items.length ? items : null;
  }, [precomputed]);

  const frDemandData = useMemo(() => {
    if (!mergedHex?.length) return null;
    let pts = mergedHex.filter(d => d.avg_friction_before > 0 && d.dn > 0)
      .map(d => ({ friction: +d.avg_friction_before.toFixed(3), demand: +d.dn.toFixed(3), covered: d.covered ? 1 : 0 }));
    if (pts.length > 500) { const every = Math.ceil(pts.length / 500); pts = pts.filter((_, i) => i % every === 0); }
    return pts.length ? pts : null;
  }, [mergedHex]);

  const budgetHeatmap = useMemo(() => {
    if (!precomputed?.budgets || !precomputed?.baseMergedHex) return null;
    const base = precomputed.baseMergedHex;
    const labels = ['A-D Gap ↓', 'Burden ↓', 'Composite ↓'];
    const rows = BUDGETS.map(b => {
      const bd = precomputed.budgets[b];
      if (!bd?.metrics) return null;
      const m = bd.metrics;
      const covSet = new Set(bd.coveredH3 ?? []);
      const adaKey = `ada${b}`;
      let negBefore = 0, negAfter = 0, giBefore = 0, giAfter = 0;
      for (const d of base) {
        if ((d.adb ?? 0) < 0) negBefore++;
        if ((d[adaKey] ?? d.adb ?? 0) < 0) negAfter++;
        if (d.gi > 0) { giBefore += d.gi; giAfter += d.gi * (covSet.has(d.h3) ? 0.4 : 1); }
      }
      return {
        budget: b,
        values: [
          negBefore > 0 ? +((negBefore - negAfter) / negBefore * 100).toFixed(1) : 0,
          +m.frictionReduction,
          giBefore > 0 ? +((giBefore - giAfter) / giBefore * 100).toFixed(1) : 0,
        ],
      };
    }).filter(Boolean);
    if (rows.length < 2) return null;
    const maxVals = labels.map((_, ci) => Math.max(...rows.map(r => r.values[ci])));
    return { rows, labels, maxVals };
  }, [precomputed]);

  const splitLon = useMemo(() => {
    const w = mapCardRef.current?.clientWidth || 800;
    const degPerPx = 360 / (Math.pow(2, viewState.zoom) * 512);
    return viewState.longitude + (w * sliderPct / 100 - w / 2) * degPerPx;
  }, [viewState.longitude, viewState.zoom, sliderPct]);

  const splitLonRef = useRef(splitLon);
  splitLonRef.current = splitLon;

  const layers = useMemo(() => {
    const result = [];

    if (mergedHex && beforeColors && afterColors) {
      result.push(new H3HexagonLayer({
        id: 'analysis-hex',
        data: mergedHex,
        getHexagon: d => d.h3,
        getFillColor: d => {
          const cache = d._lon < splitLonRef.current ? beforeColors : afterColors;
          return cache.get(d.h3) || [0, 0, 0, 0];
        },
        extruded: false,
        pickable: true,
        stroked: false,
        updateTriggers: { getFillColor: [beforeColors, afterColors, splitLon] },
        onHover: info => setHoveredHex(info.object || null),
      }));
    }

    return result;
  }, [mergedHex, beforeColors, afterColors, selectedSites, splitLon]);

  return (
    <section id="page-6" className="page page-7-post">
      {/* ═══ OPTIMIZATION RESULTS ═══ */}
      <div className="p6-opt-section">
        <h2 className="p6-opt-h2">Optimisation Results</h2>
        <p className="p6-opt-sub">Comparing key indicators before and after drone site deployment.</p>
        <div className="p6-charts-grid">
          {frictionDistData.length > 0 && (
            <div className="p6-xc">
              <h4 className="p6-xc-title">Burden Distribution</h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={frictionDistData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="range" tick={{ fill: '#F2EBD9', fontSize: 8 }}
                    tickFormatter={v => v.toFixed(2)} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#F2EBD9', fontSize: 8 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    labelFormatter={l => `Burden ${Number(l).toFixed(3)}`}
                    formatter={(v, name) => [v, name === 'before' ? 'Before' : 'After']} />
                  <Area type="monotone" dataKey="before" stroke="#ff3264" fill="#ff3264"
                    fillOpacity={0.2} strokeWidth={1.5} name="before" />
                  <Area type="monotone" dataKey="after" stroke="#F2EBD9" fill="#F2EBD9"
                    fillOpacity={0.2} strokeWidth={1.5} name="after" />
                  <Legend formatter={v => v === 'before' ? 'Before' : 'After'} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="p6-xc-note">After-curve shifts left — burden reduced in drone-covered hexagons.</p>
            </div>
          )}

          {coverageComparison && (
            <div className="p6-xc">
              <h4 className="p6-xc-title">Drone Service Coverage</h4>
              <div className="p6-cov-row">
                {coverageComparison.map(item => (
                  <div key={item.budget} className={`p6-cov-item ${budget === item.budget ? 'active' : ''}`}>
                    <div className="p6-donut-wrap p6-donut-mini">
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie data={item.data} cx="50%" cy="50%"
                            innerRadius={30} outerRadius={48} paddingAngle={2} dataKey="value"
                            startAngle={90} endAngle={-270}>
                            {item.data.map((d, i) => (
                              <Cell key={i} fill={d.fill} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TT_STYLE} formatter={(v, name) => [v, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="p6-donut-center p6-donut-center-sm">{item.pct}%</div>
                    </div>
                    <div className="p6-cov-label">+{item.budget} sites</div>
                    <div className="p6-cov-detail">{item.covered}/{item.total}</div>
                  </div>
                ))}
              </div>
              <p className="p6-xc-note">
                Hexagons within 3 km of a drone site are counted as covered. Current budget highlighted.
              </p>
            </div>
          )}

          {frDemandData && (
            <div className="p6-xc">
              <h4 className="p6-xc-title">Burden  vs Demand (by Coverage)</h4>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.1)" />
                  <XAxis dataKey="friction" type="number" name="Friction" tick={{ fill: '#F2EBD9', fontSize: 8 }}
                    label={{ value: 'Friction', position: 'bottom', fill: '#F2EBD9', fontSize: 8, offset: -2 }} />
                  <YAxis dataKey="demand" type="number" name="Demand" tick={{ fill: '#F2EBD9', fontSize: 8 }}
                    label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: '#F2EBD9', fontSize: 8 }} />
                  <ZAxis range={[15, 15]} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v, n]} />
                  <Scatter data={frDemandData}>
                    {frDemandData.map((d, i) => (
                      <Cell key={i} fill={d.covered ? '#F2EBD9' : '#ff3264'} fillOpacity={0.6} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <p className="p6-xc-note">Light dots = drone-covered. Top-right quadrant = highest priority for intervention.</p>
            </div>
          )}

          {budgetHeatmap && (
            <div className="p6-xc">
              <h4 className="p6-xc-title">Budget × Metric Comparison</h4>
              <div className="p6-heatmap">
                <div className="p6-hm-header">
                  <div className="p6-hm-corner" />
                  {budgetHeatmap.labels.map(l => <div key={l} className="p6-hm-col-label">{l}</div>)}
                </div>
                {budgetHeatmap.rows.map(r => (
                  <div key={r.budget} className="p6-hm-row">
                    <div className="p6-hm-row-label">+{r.budget}</div>
                    {r.values.map((v, ci) => {
                      const intensity = budgetHeatmap.maxVals[ci] > 0 ? v / budgetHeatmap.maxVals[ci] : 0;
                      return (
                        <div key={ci} className="p6-hm-cell" style={{ background: `rgba(242,235,217,${(0.3 + intensity * 0.6).toFixed(2)})` }}>
                          {v.toFixed(1)}%
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="p6-xc-note">Darker cells = stronger improvement. Compare coverage and burden reduction across budgets.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CONTROL BAR ═══ */}
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
            <div className="p6-hex-tooltip" style={{ color: '#2E4A5E' }}>
              {activeMode === 'acc_demand' && (
                <div className="p6-hv-row">
                  <div className="p6-hv" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>GAP</span> {hoveredHex.acc_demand_after?.toFixed(3) ?? '—'}</div>
                  {hoveredHex.covered && (
                    <div className="p6-hv p6-hv-strike" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>Before</span> {hoveredHex.acc_demand_before?.toFixed(3) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p6-hv-badge" style={{ color: '#2E4A5E' }}>Drone covered</div>}
                </div>
              )}
              {activeMode === 'friction' && (
                <div className="p6-hv-row">
                  <div className="p6-hv" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>Burden</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                  {hoveredHex.covered && (
                    <div className="p6-hv p6-hv-strike" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>Before</span> {hoveredHex.avg_friction_before?.toFixed(3) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p6-hv-badge" style={{ color: '#2E4A5E' }}>Drone covered</div>}
                </div>
              )}
              {activeMode === 'composite' && (
                <div className="p6-hv-row">
                  <div className="p6-hv" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>Gap</span> {hoveredHex.gap_index?.toFixed(4) ?? '—'}</div>
                  {hoveredHex.covered && (
                    <div className="p6-hv p6-hv-strike" style={{ color: '#2E4A5E' }}><span style={{ color: '#2E4A5E' }}>Before</span> {hoveredHex.gap_index_before?.toFixed(4) ?? '—'}</div>
                  )}
                  {hoveredHex.covered && <div className="p6-hv-badge" style={{ color: '#2E4A5E' }}>Drone covered</div>}
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

          {/* ── Map Legend ── */}
          <div className="p6-map-legend">
            {activeMode === 'acc_demand' && (
              <>
                <span className="p6-ml-title">A − D</span>
                {[
                  { color: 'rgb(216,232,242)', label: '≤ 0' },
                  { color: 'rgb(184,214,230)', label: '0.3' },
                  { color: 'rgb(148,194,216)', label: '0.5' },
                  { color: 'rgb(90,137,166)', label: '1.0' },
                  { color: 'rgb(44,88,126)', label: '2.0' },
                  { color: 'rgb(10,38,72)', label: '≥ 3' },
                ].map(s => (
                  <div key={s.label} className="p6-ml-item">
                    <span className="p6-ml-swatch" style={{ background: s.color }} />
                    <span className="p6-ml-label">{s.label}</span>
                  </div>
                ))}
              </>
            )}
            {activeMode === 'friction' && (
              <>
                <span className="p6-ml-title">Burden</span>
                {[
                  { color: 'rgb(255,235,175)', label: '0' },
                  { color: 'rgb(255,200,130)', label: '0.1' },
                  { color: 'rgb(255,160,90)', label: '0.2' },
                  { color: 'rgb(255,120,60)', label: '0.3' },
                  { color: 'rgb(255,80,30)', label: '0.4' },
                  { color: 'rgb(240,40,10)', label: '> 0.5' },
                ].map(s => (
                  <div key={s.label} className="p6-ml-item">
                    <span className="p6-ml-swatch" style={{ background: s.color }} />
                    <span className="p6-ml-label">{s.label}</span>
                  </div>
                ))}
              </>
            )}
            {activeMode === 'composite' && (
              <>
                <span className="p6-ml-title">Composite</span>
                {[
                  { color: 'rgb(118,238,168)', label: '0' },
                  { color: 'rgb(160,180,190)', label: '0.1' },
                  { color: 'rgb(190,140,200)', label: '0.2' },
                  { color: 'rgb(210,100,210)', label: '0.4' },
                  { color: 'rgb(235,60,230)', label: '0.6' },
                  { color: 'rgb(255,0,255)', label: '> 0.8' },
                ].map(s => (
                  <div key={s.label} className="p6-ml-item">
                    <span className="p6-ml-swatch" style={{ background: s.color }} />
                    <span className="p6-ml-label">{s.label}</span>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
        </div>

        {/* ─── RIGHT: panel (33.33%) ─── */}
        <div className="p6-panel-half">
        <div className="p6-panel">
          <h3 className="p6-panel-title">
            {activeMode === 'acc_demand' && 'Accessibility − Demand Gap'}
            {activeMode === 'friction' && 'Ground Burden'}
            {activeMode === 'composite' && 'Composite Gap Index'}
          </h3>

          <div className="p6-method-note">
            {activeMode === 'acc_demand' && (
              <p>
                This view compares <strong>local delivery demand</strong> with <strong>accessibility to nearby drone sites</strong>. The gap is calculated as <strong>A − D</strong>, where <strong>A</strong> represents accessibility to drone sites within a <strong>3 km service range</strong>, and <strong>D</strong> represents the <strong>normalised demand index</strong>.
                <br /><br />
                Areas with <strong>lower values</strong> indicate <strong>under-served zones</strong> where demand is stronger than current drone-site accessibility.
                <br /><br />
                After adding <strong>optimised drone sites</strong>, more high-demand cells become reachable, reducing the <strong>accessibility-demand gap</strong>.
              </p>
            )}
            {activeMode === 'friction' && (
              <p>
                This view maps the physical burden of <strong>road-based delivery</strong>. The burden score combines <strong>detour ratio, barrier crossings, congestion effects</strong>, and dependence on <strong>bridges or tunnels</strong>. <strong>Higher values</strong> indicate areas where ground delivery is more difficult, costly, or indirect.
                <br /><br />
                After adding <strong>optimised drone sites</strong>, covered areas are assumed to experience lower ground burden because part of the delivery route can shift from the <strong>road network</strong> to <strong>aerial movement</strong>.
              </p>
            )}
            {activeMode === 'composite' && (
              <p>
                This view combines <strong>accessibility gap</strong> and <strong>ground burden</strong> into a single <strong>priority score</strong>. <strong>High composite values</strong> indicate areas where delivery demand is poorly served and ground delivery is difficult. These are the zones where new drone sites may provide the <strong>greatest spatial benefit</strong>.
                <br /><br />
                By placing drone sites in <strong>high-priority cells</strong>, the optimisation aims to improve accessibility while reducing ground burden in areas where the need is strongest.

              </p>
            )}
          </div>

          {metrics && (
            <div className="p6-metrics">
              <div className="p6-metric-card">
                <div className="p6m-val" style={{ color: '#E8A88B' }}>
                  {metrics.avgFrictionAfter}
                </div>
                <div className="p6m-lab">Avg Burden</div>
              </div>

              <>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#E8A88B' }}>
                      -{metrics.frictionReduction}%
                    </div>
                    <div className="p6m-lab">Burden Reduction</div>
                  </div>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#E8A88B' }}>
                      {metrics.coveragePct}%
                    </div>
                    <div className="p6m-lab">Area Covered</div>
                  </div>
                  <div className="p6-metric-card">
                    <div className="p6m-val" style={{ color: '#E8A88B' }}>
                      +{metrics.numSites}
                    </div>
                    <div className="p6m-lab">Drone Sites</div>
                  </div>
                </>
            </div>
          )}

        </div>
        </div>
      </div>
    </section>
  );
}

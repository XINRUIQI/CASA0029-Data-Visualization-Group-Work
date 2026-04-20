import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import Page2FrictionMap from './Page2FrictionMap';
import Page2FrictionCharts from './Page2FrictionCharts';
import { publicDataUrl } from '../../config';
import './Page2FullMap.css';

const LAYER_MODES = [
  { id: 'demand', label: 'Demand', color: '#ff8c00' },
  { id: 'friction', label: 'Friction', color: '#ff3264' },
  { id: 'overlap', label: 'Overlap', color: '#c864ff' },
  { id: 'takeout', label: 'Takeout', color: '#ff4500' },
  { id: 'coverage', label: 'Coverage', color: '#00c8ff' },
];

const BARRIER_TYPES = [
  { id: 'water', label: 'Water', color: '#4688dc' },
  { id: 'waterway', label: 'Waterway', color: '#64a0f0' },
  { id: 'railway', label: 'Railway', color: '#888' },
  { id: 'highway_major', label: 'Expressway', color: '#dc3c3c' },
];

const MODE_DESC = {
  demand: '490K+ POIs reveal delivery pressure — darker = higher demand',
  friction: 'Detour, barriers, congestion compound into ground friction',
  overlap: 'High demand × high friction = where drones create the most value',
  takeout: 'Population × residential × food POI — who orders takeout?',
  coverage: 'Food accessibility — how many restaurants within 2km of each cell',
};

const POI_ITEMS = [
  { key: 'food_count', label: 'Food', color: '#ff8c00' },
  { key: 'retail_count', label: 'Retail', color: '#ff3264' },
  { key: 'edu_count', label: 'Education', color: '#64c8ff' },
  { key: 'med_count', label: 'Medical', color: '#00e896' },
  { key: 'scenic_count', label: 'Scenic', color: '#c864ff' },
  { key: 'leisure_count', label: 'Leisure', color: '#ffa028' },
];

export default function Page2FullMap() {
  const navigate = useNavigate();
  const [barriers, setBarriers] = useState({});
  const [demandGrid, setDemandGrid] = useState(null);
  const [h3Gap, setH3Gap] = useState(null);
  const [h3Takeout, setH3Takeout] = useState(null);
  const [odAnalysis, setOdAnalysis] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [activeMode, setActiveMode] = useState('overlap');
  const [activeBarriers, setActiveBarriers] = useState(new Set(['water', 'railway', 'highway_major']));
  const [hoveredHex, setHoveredHex] = useState(null);
  const [showBarriers, setShowBarriers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [highlightFilter, setHighlightFilter] = useState(null);
  const [hourlyDemand, setHourlyDemand] = useState(null);
  const [selectedHour, setSelectedHour] = useState(11);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(null);

  useEffect(() => {
    ['water', 'waterway', 'railway', 'highway_major'].forEach(t => {
      fetch(publicDataUrl(`data/page2_barrier_${t}.json`))
        .then(r => r.json())
        .then(data => setBarriers(prev => ({ ...prev, [t]: data })))
        .catch(() => {});
    });
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => r.json())
      .then(setDemandGrid)
      .catch(() => {});
    fetch(publicDataUrl('data/page2_h3_gap.json'))
      .then(r => r.json())
      .then(setH3Gap)
      .catch(() => {});
    fetch(publicDataUrl('data/h3_takeout.json'))
      .then(r => r.json())
      .then(setH3Takeout)
      .catch(() => {});
    fetch(publicDataUrl('data/page2_od_analysis.json'))
      .then(r => r.json())
      .then(data => setOdAnalysis(data?.features?.map(f => f.properties) || []))
      .catch(() => {});
    fetch(publicDataUrl('data/page2_routes.json'))
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => {});
    fetch(publicDataUrl('data/page2_hourly_demand.json'))
      .then(r => r.json())
      .then(data => {
        const total = data.reduce((s, d) => s + d.orders, 0);
        setHourlyDemand(data.map(d => ({
          ...d,
          label: `${String(d.hour).padStart(2, '0')}:00`,
          pct: +((d.orders / total) * 100).toFixed(2),
        })));
      })
      .catch(() => {});
  }, []);

  const timeWeight = useMemo(() => {
    if (!hourlyDemand || activeMode !== 'demand') return 1;
    const maxOrders = Math.max(...hourlyDemand.map(d => d.orders));
    if (maxOrders === 0) return 1;
    const entry = hourlyDemand.find(d => d.hour === selectedHour);
    return entry ? entry.orders / maxOrders : 1;
  }, [hourlyDemand, selectedHour, activeMode]);

  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      setSelectedHour(h => (h + 1) % 24);
    }, 600);
    return () => clearInterval(playRef.current);
  }, [playing]);

  const liveMetrics = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const ratios = odAnalysis.map(d => d.detour_ratio).filter(Boolean);
    const cong = odAnalysis.map(d => d.congestion_amplifier).filter(Boolean);
    const waterCross = odAnalysis.filter(d => d.crosses_water).length;
    return {
      avgDetour: (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2),
      peakCong: Math.max(...cong).toFixed(2),
      waterPct: ((waterCross / odAnalysis.length) * 100).toFixed(1),
    };
  }, [odAnalysis]);

  const toggleBarrier = (id) => {
    setActiveBarriers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChartHighlight = useCallback((filter) => {
    setHighlightFilter(() => filter);
  }, []);

  const poiMax = hoveredHex
    ? Math.max(...POI_ITEMS.map(p => hoveredHex[p.key] || 0), 1)
    : 1;

  return (
    <div className="p3f">
      <button
        className="p2f-back"
        onClick={() => navigate('/', { state: { scrollTo: 'page-2' } })}
      >
        ← Back to Main
      </button>

      <div className="p2f-topbar">
        <div className="p2f-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p2f-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => { setActiveMode(m.id); setHighlightFilter(null); }}
              style={{ '--tab-color': m.color }}
            >
              <span className="p2f-tab-dot" />
              {m.label}
            </button>
          ))}
        </div>
        {highlightFilter && (
          <button className="p2f-clear-hl" onClick={() => setHighlightFilter(null)}>
            Clear highlight ×
          </button>
        )}
      </div>

      <div className="p2f-main">
        <div className="p2f-map-area">
          <Page2FrictionMap
            barriers={barriers}
            activeBarriers={activeBarriers}
            showBarriers={showBarriers}
            activeMode={activeMode}
            h3Demand={demandGrid}
            h3Gap={h3Gap}
            h3Takeout={h3Takeout}
            routes={routes}
            showRoutes={showRoutes}
            onHoverHex={setHoveredHex}
            highlightFilter={highlightFilter}
            timeWeight={timeWeight}
          />

          {/* Hover tooltip — expanded with POI + pop */}
          {hoveredHex && (
            <div className="p2f-hex-tooltip">
              <div className="p2f-hv-row">
                <div className="p2f-hv"><span>Demand</span> {hoveredHex.dp?.toFixed(1) ?? '—'}</div>
                <div className="p2f-hv"><span>Friction</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                <div className="p2f-hv"><span>Gap</span> {hoveredHex.gap_index?.toFixed(4) ?? '—'}</div>
                <div className="p2f-hv"><span>Pop</span> {hoveredHex.pop_count?.toFixed(0) ?? '—'}</div>
              </div>
              {(activeMode === 'takeout' || activeMode === 'coverage') && (
                <div className="p2f-hv-row" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
                  <div className="p2f-hv"><span>Orders</span> {hoveredHex.real_order_count?.toLocaleString() ?? '—'}</div>
                  <div className="p2f-hv"><span>Takeout</span> {hoveredHex.takeout_demand_index?.toFixed(3) ?? '—'}</div>
                  <div className="p2f-hv"><span>1km</span> {hoveredHex.food_access_1km?.toLocaleString() ?? '—'}</div>
                  <div className="p2f-hv"><span>2km</span> {hoveredHex.food_access_2km?.toLocaleString() ?? '—'}</div>
                  <div className="p2f-hv"><span>3km</span> {hoveredHex.food_access_3km?.toLocaleString() ?? '—'}</div>
                </div>
              )}
              <div className="p2f-hv-poi">
                {POI_ITEMS.map(p => {
                  const v = hoveredHex[p.key] || 0;
                  if (v === 0) return null;
                  return (
                    <div key={p.key} className="p2f-poi-bar">
                      <span className="p2f-poi-label">{p.label}</span>
                      <div className="p2f-poi-track">
                        <div
                          className="p2f-poi-fill"
                          style={{ width: `${(v / poiMax) * 100}%`, background: p.color }}
                        />
                      </div>
                      <span className="p2f-poi-val">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p2f-barrier-float">
            <div className="p2f-bf-title">
              <label>
                <input type="checkbox" checked={showBarriers} onChange={e => setShowBarriers(e.target.checked)} />
                Barrier Layers
              </label>
            </div>
            {BARRIER_TYPES.map(b => (
              <button
                key={b.id}
                className={`p2f-bf-chip ${activeBarriers.has(b.id) ? 'on' : ''}`}
                onClick={() => toggleBarrier(b.id)}
                style={{ '--chip-color': b.color }}
              >
                <span className="p2f-chip-dot" />
                {b.label}
              </button>
            ))}
            <div className="p2f-bf-title" style={{ marginTop: 8 }}>
              <label>
                <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />
                OD Routes ({routes?.features?.length ?? 0})
              </label>
            </div>
          </div>

          {/* Demand mode: 24h timeline with slider */}
          {activeMode === 'demand' && hourlyDemand && (
            <div className="p2f-timeline">
              <div className="p2f-tl-header">
                <button
                  className={`p2f-tl-play ${playing ? 'active' : ''}`}
                  onClick={() => setPlaying(p => !p)}
                >
                  {playing ? '⏸' : '▶'}
                </button>
                <span className="p2f-tl-time">{String(selectedHour).padStart(2, '0')}:00</span>
                <span className="p2f-tl-weight">weight: {timeWeight.toFixed(3)}</span>
                <span className="p2f-tl-label">Meituan 654K orders</span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={hourlyDemand} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff8c00" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#ff8c00" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label" tick={{ fill: '#666', fontSize: 8 }}
                    axisLine={false} tickLine={false}
                    interval={3}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                    formatter={(v) => [`${v}%`, 'Share']}
                    labelFormatter={(l) => l}
                  />
                  <ReferenceArea
                    x1={`${String(selectedHour).padStart(2, '0')}:00`}
                    x2={`${String(selectedHour).padStart(2, '0')}:00`}
                    stroke="#00ffc8" strokeWidth={2} strokeOpacity={0.8}
                  />
                  <Area
                    type="monotone" dataKey="pct"
                    stroke="#ff8c00" strokeWidth={1.5}
                    fill="url(#demandGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <input
                type="range" min={0} max={23} step={1}
                value={selectedHour}
                onChange={(e) => { setSelectedHour(+e.target.value); setPlaying(false); }}
                className="p2f-tl-slider"
              />
            </div>
          )}

          <div className="p2f-summary-bar">
            {MODE_DESC[activeMode]}
          </div>
        </div>

        <div className="p2f-panel">
          <Page2FrictionCharts
            activeMode={activeMode}
            hoveredHex={hoveredHex}
            h3Gap={h3Gap}
            h3Takeout={h3Takeout}
            odAnalysis={odAnalysis}
            liveMetrics={liveMetrics}
            onHighlight={handleChartHighlight}
          />
        </div>
      </div>
    </div>
  );
}

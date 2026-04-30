import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import Page2FrictionMap from './Page2FrictionMap';
import Page2FrictionCharts from './Page2FrictionCharts';
import { publicDataUrl } from '../../config';
import './Page2FullMap.css';

const LAYER_MODES = [
  { id: 'demand', label: 'Demand', color: '#81D8D0' },
  { id: 'supply', label: 'Supply', color: '#5A89A6' },
  { id: 'friction', label: 'Burden', color: '#ff4500' },
  { id: 'priority', label: 'Composite', color: '#9C68C0' },
];

const BARRIER_TYPES = [
  { id: 'water', label: 'Water', color: '#4688dc' },
  { id: 'waterway', label: 'Waterway', color: '#64a0f0' },
  { id: 'railway', label: 'Railway', color: '#888' },
  { id: 'highway_major', label: 'Expressway', color: '#dc3c3c' },
];

const MODE_DESC = {
  supply: null,
  demand: null,
  friction: null,
  priority: null,
};

export default function Page2FullMap() {
  const navigate = useNavigate();
  const [barriers, setBarriers] = useState({});
  const [demandGrid, setDemandGrid] = useState(null);
  const [h3Gap, setH3Gap] = useState(null);
  const [h3Takeout, setH3Takeout] = useState(null);
  const [odAnalysis, setOdAnalysis] = useState(null);
  const [activeMode, setActiveMode] = useState('demand');
  const [activeBarriers, setActiveBarriers] = useState(new Set(['water', 'railway', 'highway_major']));
  const [hoveredHex, setHoveredHex] = useState(null);
  const [showBarriers, setShowBarriers] = useState(true);
  const [showOdArcs, setShowOdArcs] = useState(false);
  const [highlightFilter, setHighlightFilter] = useState(null);
  const [hourlyDemand, setHourlyDemand] = useState(null);
  const [selectedHour, setSelectedHour] = useState(11);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(null);
  const [selectedH3, setSelectedH3] = useState(null);

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

  useEffect(() => {
    if (activeMode !== 'demand') setPlaying(false);
  }, [activeMode]);

  useEffect(() => {
    setSelectedH3(null);
  }, [activeMode]);

  useEffect(() => {
    if (activeMode !== 'friction') setShowOdArcs(false);
  }, [activeMode]);

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

  return (
    <div className="p2f p2f--light">
      <div className="p2f-hero-bar">
        <button
          className="p2f-back"
          onClick={() => {
            navigate('/', { state: { scrollTo: 'page-2' } });
          }}
        >
          ← Back
        </button>
        <div className="p2f-hero-text">
          <h2 className="p2f-hero-title">Where is delivery demand concentrated?</h2>
          <p className="p2f-hero-desc">
            This map identifies potential drone delivery demand hotspots by combining real orders, population, food POIs, residential areas, and land use.
          </p>
        </div>
      </div>

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
        {(highlightFilter || selectedH3) && (
          <button
            className="p2f-clear-hl"
            onClick={() => {
              setHighlightFilter(null);
              setSelectedH3(null);
            }}
          >
            Clear highlight ×
          </button>
        )}
      </div>

      <div className="p2f-main">
        <div
          className={
            'p2f-map-area' +
            (activeMode === 'friction' ? ' p2f-map-area--friction' : '') +
            (activeMode === 'demand' && hourlyDemand
              ? ' p2f-map-area--timeline' +
                ' p2f-map-area--timeline-demand'
              : '')
          }
        >
          <Page2FrictionMap
            barriers={barriers}
            activeBarriers={activeBarriers}
            showBarriers={
              showBarriers && activeMode === 'friction'
            }
            activeMode={activeMode}
            h3Demand={demandGrid}
            h3Gap={h3Gap}
            h3Takeout={h3Takeout}
            onHoverHex={setHoveredHex}
            highlightFilter={highlightFilter}
            timeWeight={timeWeight}
            odAnalysis={odAnalysis}
            showOdArcs={showOdArcs}
            hoveredHexData={hoveredHex}
            selectedDemandH3={selectedH3}
            onDemandHexClick={(h3) => {
              setSelectedH3(h3);
              setHighlightFilter(null);
            }}
          />

          {/* Hover tooltip — per–active-mode metrics on the hex grid */}
          {hoveredHex && (
            <div
              className="p2f-hex-tooltip"
              style={
                hoveredHex._x != null
                  ? { left: hoveredHex._x + 16, top: hoveredHex._y - 8, transform: 'none' }
                  : undefined
              }
            >
              <div className="p2f-tt-mode">{activeMode === 'supply' ? 'Supply Count' : activeMode === 'priority' ? 'Composite' : activeMode === 'friction' ? 'Burden' : activeMode}</div>
              {activeMode === 'demand' && (
                <div className="p2f-tt-grid">
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{hoveredHex.real_order_count?.toLocaleString() ?? '—'}</span>
                    <span className="p2f-tt-label">Real Orders</span>
                  </div>
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{hoveredHex.takeout_demand_index?.toFixed(3) ?? '—'}</span>
                    <span className="p2f-tt-label">Demand Index</span>
                  </div>
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{Math.round(hoveredHex.pop_count ?? 0).toLocaleString()}</span>
                    <span className="p2f-tt-label">Population</span>
                  </div>
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{Math.round(hoveredHex.xiaoqu_count ?? 0).toLocaleString()}</span>
                    <span className="p2f-tt-label">Residential</span>
                  </div>
                </div>
              )}
              {activeMode === 'supply' && (
                <div className="p2f-tt-grid p2f-tt-grid--single">
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{hoveredHex.dp?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>
              )}
              {activeMode === 'friction' && (
                <div className="p2f-tt-grid p2f-tt-grid--single">
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">{hoveredHex.avg_friction?.toFixed(3) ?? '—'}</span>
                    <span className="p2f-tt-label">Burden</span>
                  </div>
                </div>
              )}
              {activeMode === 'priority' && (
                <div className="p2f-tt-grid p2f-tt-grid--single">
                  <div className="p2f-tt-item">
                    <span className="p2f-tt-val">
                      {(hoveredHex.gap_index ?? 0).toFixed(4)}
                    </span>
                    <span className="p2f-tt-label">Gap Index</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMode === 'friction' && (
            <div className="p2f-barrier-float">
              <>
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
              </>
              <div className="p2f-bf-title" style={{ marginTop: 8 }}>
                <label>
                  <input type="checkbox" checked={showOdArcs} onChange={e => setShowOdArcs(e.target.checked)} />
                  OD Flow Arcs ({odAnalysis?.length ?? 0})
                </label>
              </div>
            </div>
          )}

          {activeMode === 'demand' && (
            <div className="p2f-demand-legend" aria-hidden="false">
              <div className="p2f-dl-title">Demand index</div>
              <div className="p2f-dl-bar p2f-dl-bar--demand" />
              <div className="p2f-dl-labels">
                <span>0</span>
                <span>1</span>
              </div>
            </div>
          )}

          {activeMode === 'supply' && (
            <div className="p2f-demand-legend" aria-hidden="false">
              <div className="p2f-dl-title">Supply Count</div>
              <div className="p2f-dl-bar p2f-dl-bar--supply" />
              <div className="p2f-dl-labels">
                <span>Lower</span>
                <span>Higher</span>
              </div>
            </div>
          )}

          {activeMode === 'friction' && (
            <div className="p2f-demand-legend" aria-hidden="false">
              <div className="p2f-dl-title">Ground burden</div>
              <div className="p2f-dl-bar p2f-dl-bar--friction" />
              <div className="p2f-dl-labels">
                <span>0</span>
                <span>1</span>
              </div>
            </div>
          )}

          {activeMode === 'priority' && (
            <div className="p2f-demand-legend" aria-hidden="false">
              <div className="p2f-dl-title">Composite score</div>
              <div className="p2f-dl-bar p2f-dl-bar--composite" />
              <div className="p2f-dl-labels">
                <span>0</span>
                <span>1</span>
              </div>
              <p className="p2f-dl-note">Gap Index</p>
            </div>
          )}

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
                <span className="p2f-tl-weight">Use timeslide to view order volumes for different time periods.</span>
              </div>
              <div className="p2f-tl-chart-wrap">
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={hourlyDemand} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                    <defs>
                      <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#81D8D0" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#81D8D0" stopOpacity={0.05} />
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
                    <Area
                      type="monotone" dataKey="pct"
                      stroke="#81D8D0" strokeWidth={1.5}
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
            </div>
          )}

          {MODE_DESC[activeMode] && (
            <div className="p2f-summary-bar">
              {MODE_DESC[activeMode]}
            </div>
          )}
        </div>

        <div className="p2f-panel">
          <div className="p2f-panel-header">
            <h3 className="p2f-panel-title">Where is delivery demand concentrated?</h3>
            <p className="p2f-panel-subtitle">This map identifies potential drone delivery demand hotspots by combining real orders, population, food POIs, residential areas, and land use.</p>
            {activeMode === 'demand' && (
              <div className="p2f-panel-formula">
                <p><strong>Demand Index</strong> is a weighted composite indicator measuring delivery demand intensity per hexagon:</p>
                <p className="p2f-panel-formula-eq">Demand Index = 0.5 × Orders<sub>norm</sub> + 0.3 × Population<sub>norm</sub> + 0.2 × Residential<sub>norm</sub></p>
                <ul>
                  <li><strong>Real Orders</strong> = real delivery order count</li>
                  <li><strong>Orders</strong> = normalized real delivery order count</li>
                  <li><strong>Population</strong> = normalized population count</li>
                  <li><strong>Residential</strong> = normalized residential POI count</li>
                </ul>
              </div>
            )}
            {activeMode === 'supply' && (
              <div className="p2f-panel-formula">
                <p><strong>Supply Count</strong> is a weighted composite indicator measuring POI supply density per hexagon:</p>
                <p className="p2f-panel-formula-eq">Supply Count = Σ (Category_weight × POI_count)</p>
                <p>Higher count → greater supply concentration, more delivery destinations.</p>
              </div>
            )}
            {activeMode === 'friction' && (
              <div className="p2f-panel-formula">
                <p><strong>Ground Burden</strong> is a normalised composite of route-level barriers:</p>
                <p className="p2f-panel-formula-eq">Burden = w₁·Detour + w₂·Barrier + w₃·Congestion + w₄·Bridge + w₅·Tunnel</p>
                <p>Each component is min-max normalised to [0, 1]. Per-hex value = mean of all route samples passing through.</p>
              </div>
            )}
          </div>
          <Page2FrictionCharts
            activeMode={activeMode}
            hoveredHex={selectedH3 ? hoveredHex : hoveredHex}
            selectedHex={selectedH3}
            h3Demand={demandGrid}
            h3Gap={h3Gap}
            h3Takeout={h3Takeout}
            odAnalysis={odAnalysis}
            liveMetrics={liveMetrics}
            onHighlight={handleChartHighlight}
            timeWeight={timeWeight}
          />
        </div>
      </div>
    </div>
  );
}

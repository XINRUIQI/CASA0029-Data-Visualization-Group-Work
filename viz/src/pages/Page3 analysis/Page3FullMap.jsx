import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Page3FrictionMap from './Page3FrictionMap';
import Page3FrictionCharts from './Page3FrictionCharts';
import { publicDataUrl } from '../../config';
import './Page3FullMap.css';

const LAYER_MODES = [
  { id: 'demand', label: 'Demand', color: '#ff8c00' },
  { id: 'friction', label: 'Friction', color: '#ff3264' },
  { id: 'overlap', label: 'Overlap', color: '#c864ff' },
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
};

const POI_ITEMS = [
  { key: 'food_count', label: 'Food', color: '#ff8c00' },
  { key: 'retail_count', label: 'Retail', color: '#ff3264' },
  { key: 'edu_count', label: 'Education', color: '#64c8ff' },
  { key: 'med_count', label: 'Medical', color: '#00e896' },
  { key: 'scenic_count', label: 'Scenic', color: '#c864ff' },
  { key: 'leisure_count', label: 'Leisure', color: '#ffa028' },
];

export default function Page3FullMap() {
  const navigate = useNavigate();
  const [barriers, setBarriers] = useState({});
  const [demandGrid, setDemandGrid] = useState(null);
  const [h3Gap, setH3Gap] = useState(null);
  const [odAnalysis, setOdAnalysis] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [activeMode, setActiveMode] = useState('overlap');
  const [activeBarriers, setActiveBarriers] = useState(new Set(['water', 'railway', 'highway_major']));
  const [hoveredHex, setHoveredHex] = useState(null);
  const [showBarriers, setShowBarriers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [highlightFilter, setHighlightFilter] = useState(null);

  useEffect(() => {
    ['water', 'waterway', 'railway', 'highway_major'].forEach(t => {
      fetch(publicDataUrl(`data/page3_barrier_${t}.json`))
        .then(r => r.json())
        .then(data => setBarriers(prev => ({ ...prev, [t]: data })))
        .catch(() => {});
    });
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => r.json())
      .then(setDemandGrid)
      .catch(() => {});
    fetch(publicDataUrl('data/page3_h3_gap.json'))
      .then(r => r.json())
      .then(setH3Gap)
      .catch(() => {});
    fetch(publicDataUrl('data/page3_od_analysis.json'))
      .then(r => r.json())
      .then(data => setOdAnalysis(data?.features?.map(f => f.properties) || []))
      .catch(() => {});
    fetch(publicDataUrl('data/page3_routes.json'))
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => {});
  }, []);

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
        className="p3f-back"
        onClick={() => navigate('/', { state: { scrollTo: 'page-3' } })}
      >
        ← Back to Main
      </button>

      <div className="p3f-topbar">
        <div className="p3f-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p3f-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => { setActiveMode(m.id); setHighlightFilter(null); }}
              style={{ '--tab-color': m.color }}
            >
              <span className="p3f-tab-dot" />
              {m.label}
            </button>
          ))}
        </div>
        {highlightFilter && (
          <button className="p3f-clear-hl" onClick={() => setHighlightFilter(null)}>
            Clear highlight ×
          </button>
        )}
      </div>

      <div className="p3f-main">
        <div className="p3f-map-area">
          <Page3FrictionMap
            barriers={barriers}
            activeBarriers={activeBarriers}
            showBarriers={showBarriers}
            activeMode={activeMode}
            h3Demand={demandGrid}
            h3Gap={h3Gap}
            routes={routes}
            showRoutes={showRoutes}
            onHoverHex={setHoveredHex}
            highlightFilter={highlightFilter}
          />

          {/* Hover tooltip — expanded with POI + pop */}
          {hoveredHex && (
            <div className="p3f-hex-tooltip">
              <div className="p3f-hv-row">
                <div className="p3f-hv"><span>Demand</span> {hoveredHex.dp?.toFixed(1) ?? '—'}</div>
                <div className="p3f-hv"><span>Friction</span> {hoveredHex.avg_friction?.toFixed(3) ?? '—'}</div>
                <div className="p3f-hv"><span>Gap</span> {hoveredHex.gap_index?.toFixed(4) ?? '—'}</div>
                <div className="p3f-hv"><span>Pop</span> {hoveredHex.pop_count?.toFixed(0) ?? '—'}</div>
              </div>
              <div className="p3f-hv-poi">
                {POI_ITEMS.map(p => {
                  const v = hoveredHex[p.key] || 0;
                  if (v === 0) return null;
                  return (
                    <div key={p.key} className="p3f-poi-bar">
                      <span className="p3f-poi-label">{p.label}</span>
                      <div className="p3f-poi-track">
                        <div
                          className="p3f-poi-fill"
                          style={{ width: `${(v / poiMax) * 100}%`, background: p.color }}
                        />
                      </div>
                      <span className="p3f-poi-val">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p3f-barrier-float">
            <div className="p3f-bf-title">
              <label>
                <input type="checkbox" checked={showBarriers} onChange={e => setShowBarriers(e.target.checked)} />
                Barrier Layers
              </label>
            </div>
            {BARRIER_TYPES.map(b => (
              <button
                key={b.id}
                className={`p3f-bf-chip ${activeBarriers.has(b.id) ? 'on' : ''}`}
                onClick={() => toggleBarrier(b.id)}
                style={{ '--chip-color': b.color }}
              >
                <span className="p3f-chip-dot" />
                {b.label}
              </button>
            ))}
            <div className="p3f-bf-title" style={{ marginTop: 8 }}>
              <label>
                <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />
                OD Routes ({routes?.features?.length ?? 0})
              </label>
            </div>
          </div>

          <div className="p3f-summary-bar">
            {MODE_DESC[activeMode]}
          </div>
        </div>

        <div className="p3f-panel">
          <Page3FrictionCharts
            activeMode={activeMode}
            hoveredHex={hoveredHex}
            h3Gap={h3Gap}
            odAnalysis={odAnalysis}
            liveMetrics={liveMetrics}
            onHighlight={handleChartHighlight}
          />
        </div>
      </div>
    </div>
  );
}

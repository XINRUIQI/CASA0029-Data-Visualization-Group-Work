import { useState, useEffect } from 'react';
import Page3FrictionMap from './Page3FrictionMap';
import Page3FrictionCharts from './Page3FrictionCharts';
import { publicDataUrl } from '../../config';
import './Page3Friction.css';

const LAYER_MODES = [
  { id: 'demand', label: 'Demand', color: '#ff8c00' },
  { id: 'friction', label: 'Friction', color: '#ff3264' },
  { id: 'overlap', label: 'Overlap', color: '#c864ff' },
  { id: 'observed', label: 'Observed vs Random', color: '#00e896' },
];

const BARRIER_TYPES = [
  { id: 'water', label: 'Water', color: '#4688dc' },
  { id: 'waterway', label: 'Waterway', color: '#64a0f0' },
  { id: 'railway', label: 'Railway', color: '#888' },
  { id: 'highway_major', label: 'Expressway', color: '#dc3c3c' },
];

const SCENARIO_FILTERS = ['all', 'meal_delivery', 'parcel_delivery', 'park', 'cross_border', 'medical'];

export default function Page3Friction() {
  const [barriers, setBarriers] = useState({});
  const [h3Demand, setH3Demand] = useState(null);
  const [h3Gap, setH3Gap] = useState(null);
  const [odAnalysis, setOdAnalysis] = useState(null);
  const [observedSites, setObservedSites] = useState([]);
  const [activeMode, setActiveMode] = useState('overlap');
  const [activeBarriers, setActiveBarriers] = useState(new Set(['water', 'railway', 'highway_major']));
  const [hoveredHex, setHoveredHex] = useState(null);
  const [showBarriers, setShowBarriers] = useState(true);
  const [scenarioFilter, setScenarioFilter] = useState('all');

  useEffect(() => {
    ['water', 'waterway', 'railway', 'highway_major'].forEach(t => {
      fetch(publicDataUrl(`data/page3_barrier_${t}.json`))
        .then(r => r.json())
        .then(data => setBarriers(prev => ({ ...prev, [t]: data })))
        .catch(() => {});
    });
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => r.json())
      .then(setH3Demand)
      .catch(() => {});
    fetch(publicDataUrl('data/page3_h3_gap.json'))
      .then(r => r.json())
      .then(setH3Gap)
      .catch(() => {});
    fetch(publicDataUrl('data/page2_sites.json'))
      .then(r => r.json())
      .then(setObservedSites)
      .catch(() => {});
    fetch(publicDataUrl('data/page3_od_analysis.json'))
      .then(r => r.json())
      .then(data => setOdAnalysis(data?.features?.map(f => f.properties) || []))
      .catch(() => {});
  }, []);

  const toggleBarrier = (id) => {
    setActiveBarriers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <section id="page-3" className="page page-3-friction">
      {/* ═══ TOP BAR ═══ */}
      <div className="p2-topbar">
        <div className="p2-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p2-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => setActiveMode(m.id)}
              style={{ '--tab-color': m.color }}
            >
              <span className="tab-indicator" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Scenario type filter */}
        {(activeMode === 'observed' || activeMode === 'overlap') && (
          <div className="p2-scenario-filter">
            {SCENARIO_FILTERS.map(s => (
              <button
                key={s}
                className={`p2-sf-btn ${scenarioFilter === s ? 'active' : ''}`}
                onClick={() => setScenarioFilter(s)}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="p2-main">
        <div className="p2-map-area">
          <Page3FrictionMap
            barriers={barriers}
            activeBarriers={activeBarriers}
            showBarriers={showBarriers}
            activeMode={activeMode}
            h3Demand={h3Demand}
            h3Gap={h3Gap}
            observedSites={observedSites}
            scenarioFilter={scenarioFilter}
            onHoverHex={setHoveredHex}
          />

          {hoveredHex && (
            <div className="p2-hex-tooltip">
              <div className="hex-val"><span>Demand</span> {hoveredHex.demand?.toFixed(1) ?? '—'}</div>
              <div className="hex-val"><span>Friction</span> {hoveredHex.friction?.toFixed(3) ?? '—'}</div>
              <div className="hex-val"><span>Gap</span> {hoveredHex.gap?.toFixed(4) ?? '—'}</div>
            </div>
          )}

          <div className="p2-barrier-float">
            <div className="bf-title">
              <label>
                <input type="checkbox" checked={showBarriers} onChange={e => setShowBarriers(e.target.checked)} />
                Barrier Layers
              </label>
            </div>
            {BARRIER_TYPES.map(b => (
              <button
                key={b.id}
                className={`bf-chip ${activeBarriers.has(b.id) ? 'on' : ''}`}
                onClick={() => toggleBarrier(b.id)}
                style={{ '--chip-color': b.color }}
              >
                <span className="chip-dot" />
                {b.label}
              </button>
            ))}
          </div>

          <div className="p2-summary-bar">
            {activeMode === 'overlap'
              ? 'High demand + high friction = where drones create the most value'
              : activeMode === 'demand'
              ? '490K POIs reveal delivery pressure — darker = higher demand'
              : activeMode === 'friction'
              ? 'Detour, barriers, congestion compound into ground friction'
              : 'Observed sites cluster in high-friction overlap zones, not in demand-only areas'}
          </div>
        </div>

        <div className="p2-analysis-panel">
          <Page3FrictionCharts activeMode={activeMode} hoveredHex={hoveredHex} h3Gap={h3Gap} odAnalysis={odAnalysis} />
        </div>
      </div>
    </section>
  );
}

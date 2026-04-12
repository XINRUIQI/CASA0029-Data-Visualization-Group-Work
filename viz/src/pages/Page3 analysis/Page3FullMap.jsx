import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Page3FrictionMap from './Page3FrictionMap';
import Page3FrictionCharts from './Page3FrictionCharts';
import { publicDataUrl } from '../../config';
import './Page3FullMap.css';

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

const SCENARIO_FILTERS = ['all', 'meal_delivery', 'parcel_delivery', 'park_internal', 'cross_border', 'medical'];

const OBSERVED_SITES = [
  { lon: 114.00, lat: 22.52, scenario: 'meal_delivery', name: 'Shenzhen Bay' },
  { lon: 114.06, lat: 22.52, scenario: 'cross_border', name: 'Futian Port' },
  { lon: 114.06, lat: 22.56, scenario: 'park_internal', name: 'Lianhua Mountain' },
  { lon: 114.03, lat: 22.65, scenario: 'parcel_delivery', name: 'Longhua' },
  { lon: 114.12, lat: 22.55, scenario: 'meal_delivery', name: 'Luohu CBD' },
  { lon: 113.93, lat: 22.56, scenario: 'parcel_delivery', name: 'Nanshan' },
  { lon: 114.25, lat: 22.72, scenario: 'medical', name: 'Longgang Hospital' },
  { lon: 113.88, lat: 22.72, scenario: 'meal_delivery', name: "Bao'an Center" },
];

const MODE_DESC = {
  demand: '490K+ POIs reveal delivery pressure — darker = higher demand',
  friction: 'Detour, barriers, congestion compound into ground friction',
  overlap: 'High demand × high friction = where drones create the most value',
  observed: 'Observed sites cluster in high-friction overlap zones, not in demand-only areas',
};

export default function Page3FullMap() {
  const navigate = useNavigate();
  const [barriers, setBarriers] = useState({});
  const [demandGrid, setDemandGrid] = useState(null);
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
      .then(setDemandGrid)
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
    <div className="p3f">
      {/* Back button */}
      <button
        className="p3f-back"
        onClick={() => navigate('/', { state: { scrollTo: 'page-3' } })}
      >
        ← Back to Main
      </button>

      {/* Top bar */}
      <div className="p3f-topbar">
        <div className="p3f-tab-group">
          {LAYER_MODES.map(m => (
            <button
              key={m.id}
              className={`p3f-tab ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => setActiveMode(m.id)}
              style={{ '--tab-color': m.color }}
            >
              <span className="p3f-tab-dot" />
              {m.label}
            </button>
          ))}
        </div>

        {(activeMode === 'observed' || activeMode === 'overlap') && (
          <div className="p3f-scenario-filter">
            {SCENARIO_FILTERS.map(s => (
              <button
                key={s}
                className={`p3f-sf-btn ${scenarioFilter === s ? 'active' : ''}`}
                onClick={() => setScenarioFilter(s)}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="p3f-main">
        <div className="p3f-map-area">
          <Page3FrictionMap
            barriers={barriers}
            activeBarriers={activeBarriers}
            showBarriers={showBarriers}
            activeMode={activeMode}
            demandGrid={demandGrid}
            observedSites={OBSERVED_SITES}
            scenarioFilter={scenarioFilter}
            onHoverHex={setHoveredHex}
          />

          {hoveredHex && (
            <div className="p3f-hex-tooltip">
              <div className="p3f-hv"><span>Demand</span> {hoveredHex.demand?.toFixed(1) ?? '—'}</div>
              <div className="p3f-hv"><span>Friction</span> {hoveredHex.friction?.toFixed(3) ?? '—'}</div>
              <div className="p3f-hv"><span>Gap</span> {hoveredHex.gap?.toFixed(4) ?? '—'}</div>
            </div>
          )}

          {/* Barrier controls */}
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
          </div>

          {/* Bottom description */}
          <div className="p3f-summary-bar">
            {MODE_DESC[activeMode]}
          </div>
        </div>

        {/* Right panel — charts */}
        <div className="p3f-panel">
          <Page3FrictionCharts activeMode={activeMode} hoveredHex={hoveredHex} />
        </div>
      </div>
    </div>
  );
}

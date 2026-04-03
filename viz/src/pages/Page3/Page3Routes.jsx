import { useState, useEffect } from 'react';
import Page3Map from './Page3Map';
import Page3Exploded from './Page3Exploded';
import { publicDataUrl } from '../../config';
import './Page3.css';

const ROUTE_CASES = [
  {
    id: 'park', label: 'Park / Waterfront', title: 'Lianhua Mountain Park',
    origin: [114.048, 22.548], destination: [114.060, 22.558],
    ground_dist: 4.2, air_dist: 1.5, detour: 2.80, tt_ground: 18, tt_air: 4,
    barriers: ['water', 'highway_major'], judgment: 'drone-suitable',
    description: 'Hilltop destination inside a park. Ground route must circle the mountain. Drone flies direct over canopy.',
  },
  {
    id: 'campus', label: 'Campus / Enclosed', title: 'Shenzhen University',
    origin: [113.928, 22.534], destination: [113.937, 22.540],
    ground_dist: 2.8, air_dist: 1.1, detour: 2.55, tt_ground: 14, tt_air: 3,
    barriers: ['highway_major'], judgment: 'drone-suitable',
    description: 'Gated campus with limited entry points. Rider must queue at gate. Drone lands on rooftop pad.',
  },
  {
    id: 'mall', label: 'Mall Edge', title: 'MixC World (Nanshan)',
    origin: [113.950, 22.530], destination: [113.942, 22.525],
    ground_dist: 1.6, air_dist: 1.0, detour: 1.60, tt_ground: 12, tt_air: 3,
    barriers: [], judgment: 'hybrid',
    description: 'Dense commercial area. Short distance but heavy congestion at peak. Drone advantage mainly during rush hour.',
  },
  {
    id: 'barrier', label: 'Barrier Crossing', title: 'Cross-river: Futian → Luohu',
    origin: [114.055, 22.525], destination: [114.120, 22.550],
    ground_dist: 12.5, air_dist: 7.2, detour: 1.74, tt_ground: 35, tt_air: 8,
    barriers: ['water', 'railway', 'highway_major'], judgment: 'drone-suitable',
    description: 'Route must cross river via bridge, navigate around railway, use expressway interchange. Triple barrier compound.',
  },
];

const JUDGMENT_STYLES = {
  'drone-suitable': { color: '#00e896', label: 'Drone Preferred' },
  'hybrid': { color: '#ffa028', label: 'Hybrid' },
  'ground-preferred': { color: '#888', label: 'Ground OK' },
};

export default function Page3Routes() {
  const [activeCase, setActiveCase] = useState(ROUTE_CASES[0]);
  const [showGround, setShowGround] = useState(true);
  const [showAir, setShowAir] = useState(true);
  const [showBarriers, setShowBarriers] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [showExploded, setShowExploded] = useState(false);
  const [barriers, setBarriers] = useState({});

  useEffect(() => {
    ['water', 'waterway', 'railway', 'highway_major'].forEach(t => {
      fetch(publicDataUrl(`data/barrier_${t}.json`))
        .then(r => r.json())
        .then(data => setBarriers(prev => ({ ...prev, [t]: data })))
        .catch(() => {});
    });
  }, []);

  // Animation loop
  useEffect(() => {
    if (!animating) return;
    const interval = setInterval(() => {
      setAnimProgress(p => {
        if (p >= 1) { setAnimating(false); return 0; }
        return p + 0.008;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [animating]);

  const currentCase = {
    ...activeCase,
    origin: reversed ? activeCase.destination : activeCase.origin,
    destination: reversed ? activeCase.origin : activeCase.destination,
  };

  const jStyle = JUDGMENT_STYLES[activeCase.judgment];

  return (
    <section id="page-3" className="page page-3">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="p3-sidebar">
        <h2>Route Relief Simulation</h2>
        <p className="p3-intro">Where does air outperform ground?</p>

        <div className="p3-case-list">
          {ROUTE_CASES.map(c => (
            <button
              key={c.id}
              className={`p3-case-btn ${activeCase.id === c.id ? 'active' : ''}`}
              onClick={() => { setActiveCase(c); setReversed(false); setAnimating(false); setAnimProgress(0); }}
            >
              <span className={`p3-case-dot ${c.judgment}`} />
              {c.label}
            </button>
          ))}
        </div>

        <div className="p3-case-detail">
          <h3>{activeCase.title}</h3>
          <p className="p3-case-desc">{activeCase.description}</p>
          <div className="p3-judgment" style={{ borderColor: jStyle.color }}>
            <span style={{ color: jStyle.color }}>{jStyle.label}</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="p3-toggles">
          <label className="p3-toggle">
            <input type="checkbox" checked={showGround} onChange={e => setShowGround(e.target.checked)} />
            <span className="p3-tg-line" style={{ background: '#ff5050' }} />
            Ground route
          </label>
          <label className="p3-toggle">
            <input type="checkbox" checked={showAir} onChange={e => setShowAir(e.target.checked)} />
            <span className="p3-tg-line" style={{ background: '#00ccff' }} />
            Air route
          </label>
          <label className="p3-toggle">
            <input type="checkbox" checked={showBarriers} onChange={e => setShowBarriers(e.target.checked)} />
            <span className="p3-tg-line" style={{ background: '#ffa028' }} />
            Barriers
          </label>
          <label className="p3-toggle">
            <input type="checkbox" checked={showBuildings} onChange={e => setShowBuildings(e.target.checked)} />
            <span className="p3-tg-line" style={{ background: '#666' }} />
            3D Buildings
          </label>
        </div>

        {/* O/D swap + animation */}
        <div className="p3-actions">
          <button className="p3-action-btn" onClick={() => setReversed(r => !r)}>
            <span>⇄</span> Swap O / D
          </button>
          <button
            className={`p3-action-btn ${animating ? 'playing' : ''}`}
            onClick={() => { setAnimProgress(0); setAnimating(true); }}
          >
            <span>{animating ? '⏸' : '▶'}</span> {animating ? 'Flying...' : 'Play Flight'}
          </button>
          <button className="p3-action-btn" onClick={() => setShowExploded(e => !e)}>
            <span>🔍</span> {showExploded ? 'Hide Layers' : 'Exploded View'}
          </button>
        </div>
      </div>

      {/* ═══ CENTER MAP ═══ */}
      <div className="p3-map-area">
        <Page3Map
          activeCase={currentCase}
          showGround={showGround}
          showAir={showAir}
          showBarriers={showBarriers}
          showBuildings={showBuildings}
          barriers={barriers}
          animProgress={animating ? animProgress : null}
        />
      </div>

      {/* ═══ EXPLODED VIEW OVERLAY ═══ */}
      {showExploded && (
        <div className="p3-exploded-overlay">
          <Page3Exploded activeCase={activeCase} onClose={() => setShowExploded(false)} />
        </div>
      )}

      {/* ═══ BOTTOM METRICS ═══ */}
      <div className="p3-metrics-bar">
        <div className="p3-metric">
          <div className="pm-label">Ground</div>
          <div className="pm-value" style={{ color: '#ff5050' }}>{activeCase.ground_dist} km · {activeCase.tt_ground} min</div>
        </div>
        <div className="p3-metric">
          <div className="pm-label">Air</div>
          <div className="pm-value" style={{ color: '#00ccff' }}>{activeCase.air_dist} km · {activeCase.tt_air} min</div>
        </div>
        <div className="p3-metric">
          <div className="pm-label">Detour Ratio</div>
          <div className="pm-value">{activeCase.detour.toFixed(2)}x</div>
        </div>
        <div className="p3-metric">
          <div className="pm-label">Time Saved</div>
          <div className="pm-value" style={{ color: '#00e896' }}>{activeCase.tt_ground - activeCase.tt_air} min ({Math.round((1 - activeCase.tt_air / activeCase.tt_ground) * 100)}%)</div>
        </div>
        <div className="p3-metric">
          <div className="pm-label">Barriers</div>
          <div className="pm-value">{activeCase.barriers.length > 0 ? activeCase.barriers.join(' + ') : 'none'}</div>
        </div>
        <div className="p3-metric highlight" style={{ borderColor: jStyle.color }}>
          <div className="pm-label">Judgment</div>
          <div className="pm-value" style={{ color: jStyle.color }}>{jStyle.label}</div>
        </div>
      </div>
    </section>
  );
}

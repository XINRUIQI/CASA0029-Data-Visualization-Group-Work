import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CloudDiveBg from './CloudDiveBg';
// ── Alternative backgrounds (uncomment one to switch) ──
// import IsometricCityBg from './IsometricCityBg';  // Option B: 3D isometric colorful city (Three.js)
// import HexGridBg from './HexGridBg';               // Option C: Canvas hex grid pulse
// import GridScrollBg from './GridScrollBg';          // Option D: PostNew-style scrolling tile grid
import './Page2Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

export default function Page2Entry() {
  const navigate = useNavigate();
  const [showContent, setShowContent] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setShowContent(true);
  }, []);

  return (
    <section id="page-2" className="page page-2-entry">
      {/* ── Current: Cloud dive animation (sky → clouds → city → text fade in) ── */}
      <CloudDiveBg onIntroComplete={handleIntroComplete} />
      {/* ── Option B: 3D isometric city. Use with showContent=true, remove CloudDiveBg ──
      <IsometricCityBg />
      */}
      {/* ── Option C: Hex grid pulse. Use with showContent=true ──
      <HexGridBg />
      */}
      {/* ── Option D: Scrolling tile grid. Use with showContent=true ──
      <GridScrollBg />
      */}

      <div className={`p2e-content ${showContent ? 'p2e-visible' : ''}`}>
        <p className="p2e-kicker">Chapter 2</p>
        <h1 className="p2e-title">Where Is Ground Delivery Most Constrained?</h1>
        <p className="p2e-subtitle">
        Mapping demand hotspots, urban barriers, and delivery inefficiency
        </p>
        <p className="p2e-desc">
        Before optimising drone delivery hubs, we first examine where delivery demand is concentrated and where ground transport faces spatial barriers. Rivers, railways, and expressways can create detours and reduce last-mile efficiency. By mapping demand, barriers, and supply–demand mismatch, this section identifies areas where drone delivery may provide the greatest benefit.
        </p>

        <div className="p2e-stats">
          {STATS.map(s => (
            <div key={s.label} className="p2e-stat-card">
              <div className="p2e-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="p2e-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <button className="p2e-enter-btn" onClick={() => navigate('/analysis')}>
          <span className="p2e-btn-text">Enter Interactive Analysis Map</span>
          <span className="p2e-btn-arrow">→</span>
        </button>
      </div>
    </section>
  );
}

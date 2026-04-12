import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CloudDiveBg from './CloudDiveBg';
// ── Alternative backgrounds (uncomment one to switch) ──
// import IsometricCityBg from './IsometricCityBg';  // Option B: 3D isometric colorful city (Three.js)
// import HexGridBg from './HexGridBg';               // Option C: Canvas hex grid pulse
// import GridScrollBg from './GridScrollBg';          // Option D: PostNew-style scrolling tile grid
import './Page3Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

export default function Page3Entry() {
  const navigate = useNavigate();
  const [showContent, setShowContent] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setShowContent(true);
  }, []);

  return (
    <section id="page-3" className="page page-3-entry">
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

      <div className={`p3e-content ${showContent ? 'p3e-visible' : ''}`}>
        <p className="p3e-kicker">Chapter 3</p>
        <h1 className="p3e-title">Ground Delivery Analysis</h1>
        <p className="p3e-subtitle">
          Demand Heatmap · Ground Friction · Supply-Demand Overlap
        </p>
        <p className="p3e-desc">
          Ground delivery in Shenzhen faces multiple barriers — rivers, railways, and expressways —
          causing detours and inefficiency. Explore the interactive map to uncover
          the spatial challenges of last-mile delivery.
        </p>

        <div className="p3e-stats">
          {STATS.map(s => (
            <div key={s.label} className="p3e-stat-card">
              <div className="p3e-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="p3e-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <button className="p3e-enter-btn" onClick={() => navigate('/analysis')}>
          <span className="p3e-btn-text">Enter Interactive Analysis Map</span>
          <span className="p3e-btn-arrow">→</span>
        </button>
      </div>
    </section>
  );
}

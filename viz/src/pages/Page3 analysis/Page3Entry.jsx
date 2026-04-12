import { useNavigate } from 'react-router-dom';
import IsometricCityBg from './IsometricCityBg';
import './Page3Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

export default function Page3Entry() {
  const navigate = useNavigate();

  return (
    <section id="page-3" className="page page-3-entry">
      <IsometricCityBg />
      <div className="p3e-overlay" />

      <div className="p3e-content">
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

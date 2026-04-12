import { useNavigate } from 'react-router-dom';
import HexGridBg from './HexGridBg';
import './Page3Entry.css';

const STATS = [
  { value: '490K+', label: 'POI 配送目的地', color: '#ff8c00' },
  { value: '4 类', label: '地面障碍', color: '#ff3264' },
  { value: '1.5×', label: '平均绕行比', color: '#c864ff' },
];

export default function Page3Entry() {
  const navigate = useNavigate();

  return (
    <section id="page-3" className="page page-3-entry">
      <HexGridBg />
      <div className="p3e-overlay" />

      <div className="p3e-content">
        <p className="p3e-kicker">Chapter 3</p>
        <h1 className="p3e-title">深圳地面现状分析</h1>
        <p className="p3e-subtitle">
          需求热力 · 地面摩擦 · 供需叠置
        </p>
        <p className="p3e-desc">
          地面配送面临水系、铁路、高速公路等多重障碍，导致绕行和低效。
          点击下方进入交互式地图，探索深圳末端配送的空间困境。
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
          <span className="p3e-btn-text">进入交互式分析地图</span>
          <span className="p3e-btn-arrow">→</span>
        </button>
      </div>
    </section>
  );
}

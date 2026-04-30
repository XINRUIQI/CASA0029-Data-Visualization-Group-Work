import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GroundFrictionBoxChart } from '../Page4/Page4Charts';
import { publicDataUrl } from '../../config';
import '../Page4/Page4.css';
import './Page2Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

const SECTION_TITLE = 'Where Is Ground Delivery Most Constrained?';
const SECTION_SUB =
  'High demand, road barriers, and longer delivery routes.';
const SECTION_BODY =
  'Before optimising drone delivery hubs, we first examine where delivery demand is concentrated and where '
  + 'ground transport faces spatial barriers. Rivers, railways, and expressways can create create barriers '
  + 'to delivery and increase pressure on ground transport. By mapping demand, barriers, and supply–demand mismatch,  '
  + 'this section identifies areas where drone delivery may provide the greatest benefit.';

export default function Page2Entry() {
  const navigate = useNavigate();
  const [odData, setOdData] = useState(null);

  useEffect(() => {
    fetch(publicDataUrl('data/page2_od_analysis.json'))
      .then(r => r.json())
      .then(setOdData)
      .catch(() => {});
  }, []);

  return (
    <section id="page-2" className="page page-2-entry page-2-entry--settled page-2-entry--no-intro">
      <div className="p2e-surface p2e-surface--down">
        <div className="p2e-content p2e-visible">
          <p className="p2e-kicker">Chapter 2</p>
          <h2 className="p2e-title">{SECTION_TITLE}</h2>
          <p className="p2e-subtitle">{SECTION_SUB}</p>
          <p className="p2e-desc">{SECTION_BODY}</p>

          <div className="p2e-stats">
            {STATS.map(s => (
              <div key={s.label} className="p2e-stat-card">
                <div className="p2e-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="p2e-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {odData && (
            <div className="p2e-box-chart-wrap">
              <GroundFrictionBoxChart odData={odData} />
            </div>
          )}

          <button className="p2e-enter-btn" onClick={() => navigate('/analysis')}>
            <span className="p2e-btn-text">Enter Interactive Analysis Map</span>
            <span className="p2e-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

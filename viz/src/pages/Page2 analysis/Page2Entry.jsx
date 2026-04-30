import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { H3DimensionBoxChart } from '../Page4/Page4Charts';
import { publicDataUrl } from '../../config';
import '../Page4/Page4.css';
import './Page2Entry.css';

const SECTION_TITLE_1 = 'Where Should Drone Delivery';
const SECTION_TITLE_2 = 'Be Prioritised?';
const SECTION_SUB =
  'An interactive spatial diagnosis combining delivery demand, urban supply, ground burden, and composite gap scores to identify priority areas for future drone sites.';

export default function Page2Entry() {
  const navigate = useNavigate();
  const [h3Demand, setH3Demand] = useState(null);
  const [h3Takeout, setH3Takeout] = useState(null);
  const [h3Gap, setH3Gap] = useState(null);

  useEffect(() => {
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => r.json()).then(setH3Demand).catch(() => {});
    fetch(publicDataUrl('data/h3_takeout.json'))
      .then(r => r.json()).then(setH3Takeout).catch(() => {});
    fetch(publicDataUrl('data/page2_h3_gap.json'))
      .then(r => r.json()).then(setH3Gap).catch(() => {});

    const prefetchUrls = [
      'data/page2_od_analysis.json',
      'data/page2_hourly_demand.json',
    ];
    prefetchUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = publicDataUrl(url);
      document.head.appendChild(link);
    });
  }, []);

  const stats = useMemo(() => {
    const items = [
      { value: '490K+', label: 'Demand Locations', color: '#81D8D0' },
    ];

    if (h3Demand?.length) {
      const supplyVals = h3Demand.map(d => d.dp ?? 0).filter(v => v > 0);
      const total = supplyVals.reduce((a, b) => a + b, 0);
      items.push({ value: `${(total / 1000).toFixed(0)}K+`, label: 'Supply Counts', color: '#e0c260' });
    } else {
      items.push({ value: '—', label: 'Supply Counts', color: '#e0c260' });
    }

    if (h3Gap?.length) {
      const frictions = h3Gap.map(d => d.avg_friction ?? 0).filter(v => v > 0);
      const avg = frictions.length ? (frictions.reduce((a, b) => a + b, 0) / frictions.length) : 0;
      items.push({ value: `${(avg * 100).toFixed(0)}%`, label: 'Avg Ground Burden', color: '#ff8c00' });
    } else {
      items.push({ value: '—', label: 'Avg Ground Burden', color: '#ff8c00' });
    }

    if (h3Gap?.length) {
      const highGap = h3Gap.filter(d => (d.gap_index ?? 0) > 0.2);
      items.push({ value: highGap.length, label: 'High-Gap Zones', color: '#42a5f5' });
    } else {
      items.push({ value: '—', label: 'High-Gap Zones', color: '#42a5f5' });
    }

    return items;
  }, [h3Demand, h3Takeout, h3Gap]);

  const dataReady = h3Demand || h3Takeout || h3Gap;

  return (
    <section id="page-2" className="page page-2-entry">
      <div className="p2e-surface">
        <div className="p2e-content">
          <h2 className="p2e-title">{SECTION_TITLE_1}<br />{SECTION_TITLE_2}</h2>
          <p className="p2e-subtitle">{SECTION_SUB}</p>

          <div className="p2e-stats">
            {stats.map(s => (
              <div key={s.label} className="p2e-stat-card">
                <div className="p2e-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="p2e-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {dataReady && (
            <div className="p2e-box-chart-wrap">
              <H3DimensionBoxChart h3Demand={h3Demand} h3Takeout={h3Takeout} h3Gap={h3Gap} />
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

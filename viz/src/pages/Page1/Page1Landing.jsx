import { useState, useEffect, useRef, useMemo } from 'react';
import Page1Map from './Page1Map';
import { publicDataUrl } from '../../config';
import './Page1.css';

const TIMELINE = [
  { year: '2022', event: 'Low-altitude economy enters government agenda', type: 'policy' },
  { year: '2023.06', event: 'SF Fengyi: 100+ daily drone flights in Longhua', type: 'milestone' },
  { year: '2023.12', event: 'China\'s first low-altitude legislation passed', type: 'policy' },
  { year: '2024.02', event: 'Shenzhen Low-Altitude Economy Regulation takes effect', type: 'policy' },
  { year: '2024.10', event: 'Meituan: first cross-border drone delivery route', type: 'milestone' },
  { year: '2024.12', event: '483 pads · 250 routes · 776K flights', type: 'data' },
  { year: '2025', event: '75% airspace open · 1,000+ routes target', type: 'target' },
  { year: '2026', event: 'Cross-border drone logistics sandbox with HK', type: 'target' },
];

const CASES = [
  { id: 1, title: 'Shenzhen Bay Meal Delivery', operator: 'Meituan', scenario: 'meal_delivery', summary: '3km direct flight, 15 min vs 35 min ground. Peak-hour advantage 2.3x.', loc: [114.00, 22.52] },
  { id: 2, title: 'Futian Port Cross-border', operator: 'Meituan', scenario: 'cross_border', summary: 'First normalized cross-border drone route at a port of entry.', loc: [114.06, 22.52] },
  { id: 3, title: 'Lianhua Mountain Park', operator: 'Meituan', scenario: 'park_internal', summary: 'Coffee delivery from base to hilltop. Solving in-park last-mile.', loc: [114.06, 22.56] },
  { id: 4, title: 'Longhua Parcel Network', operator: 'SF Fengyi', scenario: 'parcel_delivery', summary: '100+ daily flights covering main commercial and residential areas.', loc: [114.03, 22.65] },
];

const SCENARIO_TYPES = ['all', 'meal_delivery', 'cross_border', 'park_internal', 'parcel_delivery'];

export const COMPOUND_COLORS = {
  residential: { rgb: [255, 107, 107], hex: '#ff6b6b', label: 'Residential' },
  park:        { rgb: [0, 232, 150],   hex: '#00e896', label: 'Park' },
  commercial:  { rgb: [255, 160, 40],  hex: '#ffa028', label: 'Commercial' },
  campus:      { rgb: [200, 100, 255], hex: '#c864ff', label: 'Campus' },
  industrial:  { rgb: [100, 200, 255], hex: '#64c8ff', label: 'Industrial' },
};

const COMPOUND_TYPES = ['all', ...Object.keys(COMPOUND_COLORS)];

export default function Page1Landing() {
  const [showPlanned, setShowPlanned] = useState(true);
  const [showExisting, setShowExisting] = useState(true);
  const [sites, setSites] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [activeTimeline, setActiveTimeline] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [compoundFilter, setCompoundFilter] = useState('all');
  const heroRef = useRef(null);

  useEffect(() => {
    fetch(publicDataUrl('data/vertiport_sites.json'))
      .then(r => r.json())
      .then(setSites)
      .catch(() => {});
  }, []);

  const filteredSites = useMemo(() => {
    if (!sites) return null;
    if (compoundFilter === 'all') return sites;
    return sites.filter(s => s.compound_type === compoundFilter);
  }, [sites, compoundFilter]);

  const siteStats = useMemo(() => {
    if (!sites) return null;
    const byStatus = { existing: 0, planned: 0 };
    const byCompound = {};
    sites.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byCompound[s.compound_type] = (byCompound[s.compound_type] || 0) + 1;
    });
    return { byStatus, byCompound, total: sites.length };
  }, [sites]);

  const scenarioStats = useMemo(() => {
    const counts = {};
    CASES.forEach(c => {
      counts[c.scenario] = (counts[c.scenario] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredCases = useMemo(() => {
    if (typeFilter === 'all') return CASES;
    return CASES.filter(c => c.scenario === typeFilter);
  }, [typeFilter]);

  return (
    <section id="page-1" className="page page-1">
      {/* ═══ HERO ═══ */}
      <div className="p1-hero" ref={heroRef}>
        <div className="p1-hero-bg" />
        <div className="p1-hero-content">
          <div className="p1-badge">CASA0029 · Data Visualization</div>
          <h1 className="p1-title">
            <span className="p1-title-line">Where do drones</span>
            <span className="p1-title-line accent">enter the city?</span>
          </h1>
          <p className="p1-subtitle">
            Shenzhen is not imagining the future — it is already building it.<br />
            483 launch pads. 250 routes. 776,000 cargo flights in 2024.
          </p>
          <a href="#p1-learning" className="p1-cta">
            <span>Explore the story</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
        <div className="p1-scroll-hint">scroll</div>
      </div>

      {/* ═══ LEARNING CITY (新增) ═══ */}
      <div className="p1-learning" id="p1-learning">
        <div className="p1-learning-content">
          <h2>Why Shenzhen?</h2>
          <p className="p1-learning-lead">
            Shenzhen is not a speculative test case — it is a <strong>learning city</strong> where 
            drone logistics is already operational at scale, backed by policy, infrastructure, 
            and real-world deployment.
          </p>
          <div className="p1-learning-points">
            <div className="lp-item">
              <div className="lp-icon">📋</div>
              <div>
                <strong>Policy foundation</strong>
                <p>China's first dedicated low-altitude economy legislation (Dec 2023), with clear airspace, licensing, and safety frameworks.</p>
              </div>
            </div>
            <div className="lp-item">
              <div className="lp-icon">🏗</div>
              <div>
                <strong>Infrastructure at scale</strong>
                <p>483 launch pads, 80,000 5G base stations, 23,000+ 5G-A upgrades for sub-120m continuous coverage.</p>
              </div>
            </div>
            <div className="lp-item">
              <div className="lp-icon">🚁</div>
              <div>
                <strong>Observed deployment</strong>
                <p>Multiple operators (Meituan, SF Fengyi, EHang) running commercial routes across meal delivery, parcels, medical, and cross-border scenarios.</p>
              </div>
            </div>
            <div className="lp-item">
              <div className="lp-icon">🔬</div>
              <div>
                <strong>Transferable insights</strong>
                <p>Patterns discovered here — demand × friction overlap, barrier-crossing logic, site selection rules — can be tested in other cities like DFW.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TIMELINE ═══ */}
      <div className="p1-timeline-section" id="p1-timeline">
        <h2 className="p1-section-title">The Rise of Low-Altitude Logistics</h2>
        <div className="p1-timeline">
          {TIMELINE.map((t, i) => (
            <div
              key={i}
              className={`p1-tl-item ${t.type} ${activeTimeline === i ? 'active' : ''}`}
              onMouseEnter={() => setActiveTimeline(i)}
              onMouseLeave={() => setActiveTimeline(null)}
            >
              <div className="tl-dot" />
              <div className="tl-year">{t.year}</div>
              <div className="tl-event">{t.event}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <div className="p1-stats">
        {[
          { num: '483', label: 'Launch pads built', icon: '🛬' },
          { num: '250', label: 'Active drone routes', icon: '🛤' },
          { num: '776K', label: 'Cargo flights (2024)', icon: '📦' },
          { num: '1,700+', label: 'Low-altitude companies', icon: '🏢' },
        ].map((s, i) => (
          <div key={i} className="p1-stat-card" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-num">{s.num}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ MAP + CASES + STATS PANEL ═══ */}
      <div className="p1-map-section" id="p1-map">
        {/* Left: cases + type filter */}
        <div className="p1-cases-panel">
          <h2>Case Studies</h2>

          <div className="p1-type-filter">
            {SCENARIO_TYPES.map(t => (
              <button
                key={t}
                className={`p1-filter-btn ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'all' ? 'All' : t.replace('_', ' ')}
              </button>
            ))}
          </div>

          <p className="p1-cases-intro">Click a case to fly to its location.</p>
          {filteredCases.map(c => (
            <div
              key={c.id}
              className={`p1-case-card ${activeCase?.id === c.id ? 'active' : ''}`}
              onClick={() => setActiveCase(activeCase?.id === c.id ? null : c)}
            >
              <div className="case-header">
                <span className={`case-tag ${c.scenario}`}>{c.scenario.replace('_', ' ')}</span>
                <span className="case-operator">{c.operator}</span>
              </div>
              <div className="case-title">{c.title}</div>
              <div className="case-summary">{c.summary}</div>
            </div>
          ))}
        </div>

        {/* Center: map */}
        <div className="p1-map-container">
          <Page1Map
            data={filteredSites}
            showPlanned={showPlanned}
            showExisting={showExisting}
            flyTo={activeCase?.loc}
          />
        </div>

        {/* Right: controls + stats */}
        <div className="p1-controls-panel">
          <h3>Infrastructure Layers</h3>
          <label className="p1-toggle">
            <input type="checkbox" checked={showExisting} onChange={e => setShowExisting(e.target.checked)} />
            <span className="toggle-label">
              <span className="legend-dot existing" />
              Existing sites
            </span>
          </label>
          <label className="p1-toggle">
            <input type="checkbox" checked={showPlanned} onChange={e => setShowPlanned(e.target.checked)} />
            <span className="toggle-label">
              <span className="legend-dot planned" />
              Planned sites
            </span>
          </label>

          {/* Compound type filter & legend */}
          <div className="p1-compound-legend">
            <h4>Site Context</h4>
            {COMPOUND_TYPES.map(t => {
              const info = COMPOUND_COLORS[t];
              const isActive = compoundFilter === t;
              return (
                <button
                  key={t}
                  className={`p1-compound-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setCompoundFilter(isActive ? 'all' : t)}
                >
                  {t !== 'all' && (
                    <span className="legend-dot" style={{ background: info.hex }} />
                  )}
                  <span>{t === 'all' ? 'All types' : info.label}</span>
                  {siteStats && t !== 'all' && (
                    <span className="compound-count">{siteStats.byCompound[t] || 0}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Site statistics */}
          {siteStats && (
            <div className="p1-site-stats">
              <h4>Site Statistics</h4>
              <div className="ss-row">
                <span>Total sites</span>
                <span className="ss-val">{siteStats.total}</span>
              </div>
              <div className="ss-row">
                <span><span className="legend-dot existing" /> Existing</span>
                <span className="ss-val">{siteStats.byStatus.existing}</span>
              </div>
              <div className="ss-row">
                <span><span className="legend-dot planned" /> Planned</span>
                <span className="ss-val">{siteStats.byStatus.planned}</span>
              </div>
              <div className="ss-divider" />
              {Object.entries(siteStats.byCompound)
                .sort(([,a], [,b]) => b - a)
                .map(([k, v]) => (
                <div className="ss-row" key={k}>
                  <span>
                    <span className="legend-dot" style={{ background: COMPOUND_COLORS[k]?.hex || '#888' }} />
                    {' '}{COMPOUND_COLORS[k]?.label || k}
                  </span>
                  <div className="ss-bar-wrap">
                    <div
                      className="ss-bar"
                      style={{
                        width: `${(v / siteStats.total) * 100}%`,
                        background: COMPOUND_COLORS[k]?.hex || '#888',
                      }}
                    />
                    <span className="ss-val">{v}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p1-scenario-stats">
            <h4>Scenario Types</h4>
            {Object.entries(scenarioStats).map(([k, v]) => (
              <div className="ss-row" key={k}>
                <span className={`case-tag mini ${k}`}>{k.replace('_', ' ')}</span>
                <span className="ss-val">{v}</span>
              </div>
            ))}
          </div>

          <div className="p1-source-note">
            <h4>Data Sources</h4>
            <p>Shenzhen Transport Bureau, 2024</p>
            <p>Geofabrik / OpenStreetMap</p>
            <p>WorldPop / AMap POI</p>
          </div>
        </div>
      </div>
    </section>
  );
}

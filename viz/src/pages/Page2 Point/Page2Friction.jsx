import { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import Page2Map from './Page2Map';
import { publicDataUrl, POI_COLORS } from '../../config';
import { PoiPinIcon } from './poiIcons';
import { COMPOUND_COLORS } from '../Page1 overview/Page1Landing';
import './Page2.css';

const SCENARIOS = [
  {
    id: 'food', color: '#ff6b35', icon: '🍱',
    name: 'Food Delivery',
    desc: 'Hot meal last-mile in dense urban areas',
    origin: 'Restaurant', dest: 'Residence / Office',
    distance: '1–5 km', time: '15–30 min',
    why: 'Bypasses traffic; preserves food temperature',
    spatial: 'Dense commercial clusters',
  },
  {
    id: 'express', color: '#64c8ff', icon: '📦',
    name: 'Express Parcel',
    desc: 'E-commerce & courier last-mile delivery',
    origin: 'Sorting Centre', dest: 'Residential Compound',
    distance: '3–8 km', time: 'Same / Next Day',
    why: 'Skips elevator queues; serves gated compounds',
    spatial: 'Compound clusters city-wide',
  },
  {
    id: 'medical', color: '#ff4d6d', icon: '🏥',
    name: 'Medical Emergency',
    desc: 'Urgent drugs, blood & AED delivery',
    origin: 'Hospital / Pharmacy', dest: 'Emergency Scene',
    distance: '1–10 km', time: '< 10 min',
    why: 'Life-critical; ground blocked by congestion',
    spatial: 'Hospitals & dense districts',
  },
  {
    id: 'park', color: '#1a9640', icon: '🌿',
    name: 'Scenic / Park',
    desc: 'In-park goods delivery for visitors',
    origin: 'Service Point', dest: 'Visitor Location',
    distance: '0.5–3 km', time: '20–40 min',
    why: 'No vehicle access; creates novel experience',
    spatial: 'Coastal parks & green zones',
  },
  {
    id: 'cross', color: '#c8a200', icon: '🛃',
    name: 'Cross-border',
    desc: 'Shenzhen–HK small parcel rapid clearance',
    origin: 'SZ Border Zone', dest: 'Hong Kong',
    distance: '5–20 km', time: 'Same Day',
    why: 'Bypasses customs queues; speed advantage',
    spatial: 'Port & boundary zones',
  },
];

const RADAR_DATA = [
  { metric: 'Frequency',    food: 9, express: 8, medical: 3, park: 4, cross: 2 },
  { metric: 'Urgency',      food: 8, express: 5, medical: 10, park: 4, cross: 7 },
  { metric: 'Ground Diff',  food: 6, express: 5, medical: 9, park: 8, cross: 10 },
  { metric: 'Social Value', food: 7, express: 6, medical: 10, park: 5, cross: 9 },
  { metric: 'Drone Fit',    food: 8, express: 6, medical: 10, park: 7, cross: 9 },
];

const TABS = [
  {
    id: 1, label: 'Sites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 2, label: 'Context',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 3, label: 'Routes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17c3-3 6-5 9-5s6 2 9-2"/>
        <path d="M3 7c3 3 6 5 9 5s6-2 9 2"/>
        <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 4, label: 'Coverage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
];


export default function Page2Friction() {
  const [sites, setSites]           = useState(null);
  const [routes, setRoutes]         = useState(null);
  const [boundary, setBoundary]     = useState(null);
  const [hexGrid, setHexGrid]       = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const [activeTab, setActiveTab]   = useState(1);
  const [showCommercial, setShowCommercial] = useState(true);
  const [showLastMile, setShowLastMile]     = useState(true);
  const [compoundFilter, setCompoundFilter] = useState('all');
  const [contextChartType, setContextChartType] = useState('residential');
  const [focusDistrict, setFocusDistrict] = useState(null);

  const handleDistrictFocus = useCallback((v) => {
    setFocusDistrict(v ? { featureName: v.featureName, bbox: v.bbox } : null);
  }, []);

  useEffect(() => {
    const url = publicDataUrl('data/vertiport_sites.json');
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSites)
      .catch(err => setLoadError(err.message));

    fetch(publicDataUrl('data/shenzhen_boundary.json'))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setBoundary)
      .catch(e => console.error('[boundary] failed:', e));

    fetch(publicDataUrl('data/sz_hex_grid_res8.json'))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setHexGrid)
      .catch(e => console.error('[hexGrid] failed:', e));
  }, []);

  useEffect(() => {
    if (activeTab === 3 && !routes) {
      fetch(publicDataUrl('data/routes.json'))
        .then(r => r.json())
        .then(setRoutes)
        .catch(() => {});
    }
  }, [activeTab, routes]);

  const filteredSites = useMemo(() => {
    if (!sites) return null;
    let s = sites;
    if (activeTab === 2) {
      if (compoundFilter !== 'all') s = s.filter(x => x.dominant_poi === compoundFilter);
    } else {
      if (compoundFilter !== 'all') s = s.filter(x => x.compound_type === compoundFilter);
      if (!showCommercial) s = s.filter(x => x.zone_type !== 'commercial');
      if (!showLastMile)   s = s.filter(x => x.zone_type !== 'last_mile');
    }
    return s;
  }, [sites, activeTab, compoundFilter, showCommercial, showLastMile]);

  const siteStats = useMemo(() => {
    if (!sites) return null;
    const byStatus = { existing: 0, planned: 0 };
    const byCompound = {};
    const byPoiType = {};
    sites.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byCompound[s.compound_type] = (byCompound[s.compound_type] || 0) + 1;
      if (s.dominant_poi) byPoiType[s.dominant_poi] = (byPoiType[s.dominant_poi] || 0) + 1;
    });
    return { byStatus, byCompound, byPoiType, total: sites.length };
  }, [sites]);

  function getDistrictView(districtName) {
    if (!boundary) return null;
    const feature = boundary.features.find(f => {
      const en = DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '');
      return en === districtName;
    });
    if (!feature) return null;
    const coords = [];
    const geom = feature.geometry;
    if (geom.type === 'Polygon') geom.coordinates[0].forEach(c => coords.push(c));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p[0].forEach(c => coords.push(c)));
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    return {
      bbox:        [minLon, minLat, maxLon, maxLat],
      featureName: feature.properties.name,
    };
  }

  const DISTRICT_EN = {
    '光明区': 'Guangming', '坪山区': 'Pingshan', '龙华区': 'Longhua',
    '盐田区': 'Yantian',  '龙岗区': 'Longgang', '宝安区': "Bao'an",
    '南山区': 'Nanshan',  '福田区': 'Futian',   '罗湖区': 'Luohu',
  };

  const DISTRICT_POP = {
    'Guangming': 100, 'Pingshan': 64,  'Longhua': 292,
    'Yantian':   24,  'Longgang': 393, "Bao'an":  420,
    'Nanshan':   188, 'Futian':   153, 'Luohu':   116,
  };

  const districtContextStats = useMemo(() => {
    if (!sites || !boundary) return [];
    const types = Object.keys(POI_COLORS);
    return boundary.features.map(feature => {
      const name = DISTRICT_EN[feature.properties.name] || feature.properties.name.replace('区', '');
      const row = { name };
      types.forEach(t => { row[t] = 0; });
      sites.forEach(s => {
        const pt = turfPoint([s.lon, s.lat]);
        if (booleanPointInPolygon(pt, feature)) {
          const poi = s.dominant_poi;
          if (poi && row[poi] !== undefined) row[poi]++;
        }
      });
      return row;
    }).sort((a, b) => {
      const sumA = types.reduce((s, k) => s + a[k], 0);
      const sumB = types.reduce((s, k) => s + b[k], 0);
      return sumB - sumA;
    });
  }, [sites, boundary]);

  const districtCoverageStats = useMemo(() => {
    if (!sites || !boundary) return [];
    return boundary.features.map(feature => {
      const name = DISTRICT_EN[feature.properties.name] || feature.properties.name.replace('区', '');
      let total = 0;
      sites.forEach(s => {
        const pt = turfPoint([s.lon, s.lat]);
        if (booleanPointInPolygon(pt, feature)) total++;
      });
      const pop = DISTRICT_POP[name] || 1;
      return {
        name,
        total,
        ratio: parseFloat((total / pop).toFixed(2)),
      };
    }).sort((a, b) => b.ratio - a.ratio);
  }, [sites, boundary]);

  const districtStats = useMemo(() => {
    if (!sites || !boundary) return [];
    return boundary.features.map(feature => {
      const name = DISTRICT_EN[feature.properties.name] || feature.properties.name.replace('区', '');
      let commercial = 0, last_mile = 0;
      sites.forEach(s => {
        const pt = turfPoint([s.lon, s.lat]);
        if (booleanPointInPolygon(pt, feature)) {
          if (s.zone_type === 'commercial') commercial++;
          else if (s.zone_type === 'last_mile') last_mile++;
        }
      });
      return { name, commercial, last_mile };
    }).sort((a, b) => (b.commercial + b.last_mile) - (a.commercial + a.last_mile));
  }, [sites, boundary]);

  const chartData = useMemo(() => {
    if (!siteStats) return [];
    return Object.entries(siteStats.byCompound)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        name: COMPOUND_COLORS[key]?.label || key,
        count, color: COMPOUND_COLORS[key]?.hex || '#888', key,
      }));
  }, [siteStats]);

  return (
    <section id="page-2" className="page page-2">
      <div className="p2-layout">

        {/* ── LEFT: map (50%) ── */}
        <div className="p2-map-half">


          {/* 下方：左侧 tab + 右侧地图 */}
          <div className="p2-map-body">

            {/* 左侧：4 个切页 tab */}
            <div className="p2-tab-sidebar">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`p2-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(tab.id); setCompoundFilter('all'); }}
                >
                  <span className="p2-tab-icon">{tab.icon}</span>
                  <span className="p2-tab-label">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 右侧：地图卡片 */}
            <div className="p2-map-card">
              <Page2Map
                data={filteredSites}
                routes={routes}
                boundary={boundary}
                hexGrid={hexGrid}
                activeTab={activeTab}
                compoundFilter={compoundFilter}
                focusDistrict={focusDistrict}
                districtStats={districtStats}
                onDistrictFocus={handleDistrictFocus}
              />

            </div>
          </div>

          {/* ── 地图与图表之间的图例条（可点击） ── */}
          <div className="p2-inline-legend">
            {activeTab === 1 && <>
              <button className={`p2-il-btn ${showCommercial ? 'active' : ''}`} style={{ '--ilc': '#ffa028' }}
                onClick={() => setShowCommercial(v => !v)}>
                <svg viewBox="0 0 40 52" width={11} height={14} style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill="#ffa028" />
                  <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
                </svg>
                Hub Sites <span className="p2-il-count">45</span>
              </button>
              <button className={`p2-il-btn ${showLastMile ? 'active' : ''}`} style={{ '--ilc': '#c864ff' }}
                onClick={() => setShowLastMile(v => !v)}>
                <svg viewBox="0 0 40 52" width={11} height={14} style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill="#c864ff" />
                  <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
                </svg>
                Last-mile <span className="p2-il-count">161</span>
              </button>
            </>}
            {activeTab === 4 && [
              { color: '#111118', label: '0' },
              { color: '#0d3060', label: '< 50' },
              { color: '#0a5a8a', label: '50–100' },
              { color: '#0b7a6a', label: '100–200' },
              { color: '#1a9640', label: '200–400' },
              { color: '#c8a200', label: '400–800' },
              { color: '#d04800', label: '800–1500' },
              { color: '#b50000', label: '> 1500' },
            ].map(({ color, label }) => (
              <div key={label} className="p2-il-btn" style={{ cursor: 'default', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            ))}
            {activeTab === 2 && Object.entries(POI_COLORS).map(([k, v]) => (
              <button key={k}
                className={`p2-il-btn ${compoundFilter === k ? 'active' : compoundFilter === 'all' ? '' : 'dim'}`}
                style={{ '--ilc': v.hex, color: '#fff' }}
                onClick={() => {
                  const next = compoundFilter === k ? 'all' : k;
                  setCompoundFilter(next);
                  setContextChartType(next === 'all' ? 'retail' : next);
                }}>
                <PoiPinIcon type={k} size={16} />
                {v.label}
              </button>
            ))}
          </div>

          {/* ── 地图下方：行政区统计 ── */}
          <div className="p2-district-card">
            <div className="p2-district-header">
              <div className="p2p-section-label">Sites by District</div>
            </div>
            {activeTab !== 2 && activeTab !== 4 && districtStats.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtStats} margin={{ left: 16, right: 60, top: 30, bottom: 36 }} barCategoryGap="28%" barGap={3}>
                  <CartesianGrid vertical={true} horizontal={true} stroke="rgba(200,200,210,0.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#ddd', fontSize: 12, textAnchor: 'middle' }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} interval={0}
                    label={{ value: 'District', position: 'right', dy: -20, fill: '#888', fontSize: 11, dominantBaseline: 'central' }} />
                  <YAxis type="number" tick={{ fill: '#ddd', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} width={42}
                    label={{ value: 'Sites (n)', angle: 0, position: 'top', fill: '#888', fontSize: 11, dy: -6, dx: 20, textAnchor: 'middle' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f0f24', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#aaa' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    formatter={(value, name) => [value, name === 'commercial' ? 'Hub Sites' : 'Last-mile Sites']}
                  />
                  <Bar dataKey="commercial" name="commercial" fill="#ffa028" fillOpacity={showCommercial ? 0.85 : 0.15} maxBarSize={22} cursor="pointer"
                    onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                    <LabelList dataKey="commercial" position="top" style={{ fill: showCommercial ? '#fff' : 'transparent', fontSize: 10 }} formatter={v => v > 0 ? v : ''} />
                  </Bar>
                  <Bar dataKey="last_mile" name="last_mile" fill="#c864ff" fillOpacity={showLastMile ? 0.85 : 0.15} maxBarSize={22} cursor="pointer"
                    onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                    <LabelList dataKey="last_mile" position="top" style={{ fill: showLastMile ? '#fff' : 'transparent', fontSize: 10 }} formatter={v => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === 4 && districtCoverageStats.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtCoverageStats} margin={{ left: 16, right: 60, top: 30, bottom: 36 }} barCategoryGap="35%">
                  <CartesianGrid vertical={true} horizontal={true} stroke="rgba(200,200,210,0.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#ddd', fontSize: 12, textAnchor: 'middle' }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} interval={0}
                    label={{ value: 'District', position: 'right', dy: -20, fill: '#888', fontSize: 11, dominantBaseline: 'central' }} />
                  <YAxis type="number" tick={{ fill: '#ddd', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} width={42}
                    label={{ value: 'Sites / 万人', angle: 0, position: 'top', fill: '#888', fontSize: 11, dy: -6, dx: 30, textAnchor: 'middle' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f0f24', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#aaa' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    formatter={(value, name) => [
                      name === 'ratio' ? `${value} sites/万人` : value,
                      name === 'ratio' ? 'Coverage Rate' : 'Total Sites',
                    ]}
                  />
                  <Bar dataKey="ratio" name="ratio" maxBarSize={28} cursor="pointer"
                    fill="#e03030" fillOpacity={0.85}
                    onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                    <LabelList dataKey="ratio" position="top" style={{ fill: '#fff', fontSize: 10 }} formatter={v => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === 2 && districtContextStats.length > 0 && (<>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtContextStats} margin={{ left: 16, right: 60, top: 16, bottom: 36 }} barCategoryGap="35%">
                  <CartesianGrid vertical={true} horizontal={true} stroke="rgba(200,200,210,0.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#ddd', fontSize: 11, textAnchor: 'middle' }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} interval={0}
                    label={{ value: 'District', position: 'right', dy: -20, fill: '#888', fontSize: 11, dominantBaseline: 'central' }} />
                  <YAxis type="number" tick={{ fill: '#ddd', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.5)' }} tickLine={{ stroke: 'rgba(255,255,255,0.5)' }} width={42}
                    label={{ value: 'Sites (n)', angle: 0, position: 'top', fill: '#888', fontSize: 11, dy: -6, dx: 20, textAnchor: 'middle' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f0f24', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#aaa' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    formatter={v => [v, POI_COLORS[contextChartType]?.label]}
                  />
                  <Bar dataKey={contextChartType} fill={POI_COLORS[contextChartType]?.hex} fillOpacity={0.85} maxBarSize={28} cursor="pointer"
                    onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                    <LabelList dataKey={contextChartType} position="top" style={{ fill: '#fff', fontSize: 10 }} formatter={v => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>)}
          </div>
        </div>

        {/* ── RIGHT: panel (50%) ── */}
        <div className="p2-panel-half">
        <div className="p2-panel-card">
          <div className="p2p-header">
            <div className="p2p-tag">Infrastructure · Shenzhen 2024</div>
            <h2 className="p2p-title">Vertiport Site Distribution</h2>
            <p className="p2p-desc">
              Influenced by terrain, zoning policy, and operator strategies,
              vertiport sites cluster near commercial hubs, parks, and residential
              compounds. Existing pads reflect demand; planned pads signal expansion.
            </p>
          </div>

          {loadError && <div className="p2p-loading" style={{ color: '#ff6b6b' }}>加载失败：{loadError}</div>}

          {siteStats ? (
            <div className="p2p-kpis">
              <div className="p2p-kpi">
                <div className="kpi-val">{siteStats.total}</div>
                <div className="kpi-lab">Total Sites</div>
              </div>
              <div className="p2p-kpi">
                <div className="kpi-val" style={{ color: '#00e896' }}>{siteStats.byStatus.existing ?? 0}</div>
                <div className="kpi-lab">Existing</div>
              </div>
              <div className="p2p-kpi">
                <div className="kpi-val" style={{ color: '#64c8ff' }}>{siteStats.byStatus.planned ?? 0}</div>
                <div className="kpi-lab">Planned</div>
              </div>
            </div>
          ) : (
            <div className="p2p-loading">Loading sites…</div>
          )}

          <div className="p2p-section p2p-chart-section">
            <div className="p2p-section-label">Sites by Context</div>
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 30, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 11 }} width={68} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f0f24', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#aaa' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" name="Sites"
                    shape={(props) => {
                      const { x, y, width, height, payload } = props;
                      const opacity = compoundFilter === 'all' || compoundFilter === payload.key ? 0.85 : 0.25;
                      return <rect x={x} y={y} width={Math.max(width, 0)} height={Math.max(height, 0)} fill={payload.color} fillOpacity={opacity} rx={4} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="p2p-footer">
            <span>Source: Shenzhen Transport Bureau, 2024</span>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

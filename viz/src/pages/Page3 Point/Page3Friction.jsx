import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import Page3Map from './Page3Map';
import { publicDataUrl, POI_COLORS } from '../../config';
import { PoiPinIcon } from './poiIcons';
import { COMPOUND_COLORS } from '../Page1 overview/Page1Landing';
import './Page3.css';

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

const TAB_HERO = {
  1: {
    title: 'What Drone Delivery Infrastructure Already Exists?',
    desc: 'Shenzhen has developed an initial drone delivery infrastructure network, including commercial-area hubs and last-mile delivery points. Existing and planned sites are distributed across different districts, providing a baseline for understanding current service capacity and identifying where additional hubs may be needed.',
  },
  2: {
    title: 'What Surrounds Existing Drone Sites?',
    desc: 'We analysed Supply count (POIs) within a 500m catchment around each take-off and landing hubs. For each site, the dominant POI category is used to describe its surrounding urban function.',
  },
  3: {
    title: 'Which Landing Points Can Each Departure Hub Reach?',
    desc: 'This map simulates potential aerial connections from each departure hub to landing hub within a 3 km flight range.',
  },
  4: {
    title: 'How Many People Does Each Drone Site Serve?',
    desc: 'This map evaluates drone site availability by calculating the number of existing drone take-off and landing sites relative to the resident population within each grid. Higher values indicate more drone sites available per resident, while lower values suggest potential under-provision and higher service pressure.',
  },
};

const TABS = [
  {
    id: 3, label: 'ROUTES',
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
    id: 1, label: 'SITES',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 2, label: 'CONTEXT',
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
    id: 4, label: 'COVERAGE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
];


export default function Page3Friction() {
  const [sites, setSites]           = useState(null);
  const [routes, setRoutes]         = useState(null);
  const [boundary, setBoundary]     = useState(null);
  const [hexGrid, setHexGrid]       = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const [activeTab, setActiveTab]   = useState(3);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [showCommercial, setShowCommercial] = useState(true);
  const [showLastMile, setShowLastMile]     = useState(true);
  const [compoundFilter, setCompoundFilter] = useState('all');
  const [contextChartType, setContextChartType] = useState('retail');
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
    const byZone = { commercial: 0, last_mile: 0 };
    sites.forEach(s => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      byCompound[s.compound_type] = (byCompound[s.compound_type] || 0) + 1;
      if (s.dominant_poi) byPoiType[s.dominant_poi] = (byPoiType[s.dominant_poi] || 0) + 1;
      if (s.zone_type && byZone[s.zone_type] !== undefined) byZone[s.zone_type]++;
    });
    return { byStatus, byCompound, byPoiType, byZone, total: sites.length };
  }, [sites]);

  const panelMeta = useMemo(() => {
    const takeoff = siteStats?.byZone?.commercial ?? 0;
    const landing = siteStats?.byZone?.last_mile ?? 0;
    switch (activeTab) {
      case 1:
        return {
          title: 'Take-off & Landing Network',
          subtitle: 'highlight',
        };
      case 2:
        return {
          title: 'Urban Context',
          subtitle: 'Functional POI Layers Informing Vertiport Placement Strategy',
        };
      case 3:
        return {
          title: 'Aerial Routes',
          subtitle: 'Simulated Flight Paths Connecting Vertiport Nodes',
        };
      case 4:
        return {
          title: 'Accessibility Coverage',
          subtitle: 'Population Served per Vertiport (10,000 persons per site)',
        };
      default:
        return { title: '', subtitle: '' };
    }
  }, [activeTab, siteStats]);

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

  const siteDistrictMap = useMemo(() => {
    if (!sites || !boundary) return null;
    return sites.map(s => {
      const pt = turfPoint([s.lon, s.lat]);
      for (const f of boundary.features) {
        if (booleanPointInPolygon(pt, f))
          return DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '');
      }
      return null;
    });
  }, [sites, boundary]);

  const districtContextStats = useMemo(() => {
    if (!siteDistrictMap || !sites || !boundary) return [];
    const types = Object.keys(POI_COLORS);
    const buckets = {};
    boundary.features.forEach(f => {
      const name = DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '');
      const row = { name };
      types.forEach(t => { row[t] = 0; });
      buckets[name] = row;
    });
    sites.forEach((s, i) => {
      const dist = siteDistrictMap[i];
      if (dist && buckets[dist]) {
        const poi = s.dominant_poi;
        if (poi && buckets[dist][poi] !== undefined) buckets[dist][poi]++;
      }
    });
    return Object.values(buckets).sort((a, b) => {
      const sumA = types.reduce((s, k) => s + a[k], 0);
      const sumB = types.reduce((s, k) => s + b[k], 0);
      return sumB - sumA;
    });
  }, [sites, siteDistrictMap, boundary]);

  const districtCoverageStats = useMemo(() => {
    if (!siteDistrictMap || !sites || !boundary) return [];
    const counts = {};
    boundary.features.forEach(f => {
      const name = DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '');
      counts[name] = 0;
    });
    siteDistrictMap.forEach(dist => { if (dist && counts[dist] !== undefined) counts[dist]++; });
    return Object.entries(counts).map(([name, total]) => {
      const pop = DISTRICT_POP[name] || 1;
      return { name, total, ratio: parseFloat((total / pop).toFixed(2)) };
    }).sort((a, b) => b.ratio - a.ratio);
  }, [siteDistrictMap, sites, boundary]);

  const districtStats = useMemo(() => {
    if (!siteDistrictMap || !sites || !boundary) return [];
    const buckets = {};
    boundary.features.forEach(f => {
      const name = DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '');
      buckets[name] = { name, commercial: 0, last_mile: 0 };
    });
    sites.forEach((s, i) => {
      const dist = siteDistrictMap[i];
      if (dist && buckets[dist]) {
        if (s.zone_type === 'commercial') buckets[dist].commercial++;
        else if (s.zone_type === 'last_mile') buckets[dist].last_mile++;
      }
    });
    return Object.values(buckets).sort((a, b) => (b.commercial + b.last_mile) - (a.commercial + a.last_mile));
  }, [sites, siteDistrictMap, boundary]);

  const chartData = useMemo(() => {
    if (!siteStats) return [];
    return Object.entries(siteStats.byCompound)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        name: COMPOUND_COLORS[key]?.label || key,
        count, color: COMPOUND_COLORS[key]?.hex || '#888', key,
      }));
  }, [siteStats]);

  const FLIGHT_RADIUS_KM = 3;
  function haversineKm(a, b) {
    const R = 6371;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  const odMatrix = useMemo(() => {
    if (!sites || !boundary || !siteDistrictMap) return null;
    const names = boundary.features.map(f =>
      DISTRICT_EN[f.properties.name] || f.properties.name.replace('区', '')
    );
    const hubIndices = [], lmIndices = [];
    sites.forEach((s, i) => {
      if (s.zone_type === 'commercial') hubIndices.push(i);
      else if (s.zone_type === 'last_mile') lmIndices.push(i);
    });
    const matrix = {};
    names.forEach(o => { matrix[o] = {}; names.forEach(d => { matrix[o][d] = 0; }); });
    let maxVal = 0;
    hubIndices.forEach(hi => {
      const hub = sites[hi];
      const oName = siteDistrictMap[hi];
      if (!oName) return;
      lmIndices.forEach(li => {
        const lm = sites[li];
        if (haversineKm([hub.lon, hub.lat], [lm.lon, lm.lat]) <= FLIGHT_RADIUS_KM) {
          const dName = siteDistrictMap[li];
          if (!dName) return;
          matrix[oName][dName]++;
          if (matrix[oName][dName] > maxVal) maxVal = matrix[oName][dName];
        }
      });
    });
    const sorted = [...names].sort((a, b) => {
      const sumA = names.reduce((s, n) => s + matrix[a][n] + matrix[n][a], 0);
      const sumB = names.reduce((s, n) => s + matrix[b][n] + matrix[n][b], 0);
      return sumB - sumA;
    });
    return { names: sorted, matrix, maxVal };
  }, [sites, boundary, siteDistrictMap]);

  return (
    <section id="page-3" className="page page-3">
      <div className="p3-section-header">
        <h2 className="p3-section-title">How Does the Existing Drone Network Perform?</h2>
        <p className="p3-section-subtitle">Four diagnostic views examine current drone infrastructure from routes, site distribution, surrounding urban context, and population-based availability.</p>
      </div>
      <div className="p3-layout">

        {/* LEFT: tabs + legend + map */}
        <div className="p3-left">
          <div className="p3-tab-sidebar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`p3-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setCompoundFilter(tab.id === 2 ? 'retail' : 'all'); setContextChartType('retail'); setFocusDistrict(null); setViewResetKey(k => k + 1); }}
              >
                <span className="p3-tab-icon">{tab.icon}</span>
                <span className="p3-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p3-map-wrap">
            {activeTab === 1 && (
              <div className="p3-inline-legend">
                <span className="p3-mil-item" role="button" tabIndex={0}
                  style={{ opacity: showCommercial ? 1 : 0.4 }}
                  onClick={() => setShowCommercial(v => !v)}>
                  <svg viewBox="0 0 40 52" width={11} height={14} style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill="#ffa028" />
                    <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
                  </svg>
                  <span className="p3-mil-label">Departure Hubs</span>
                  <span className="p3-mil-count">45</span>
                </span>
                <span className="p3-mil-item" role="button" tabIndex={0}
                  style={{ opacity: showLastMile ? 1 : 0.4 }}
                  onClick={() => setShowLastMile(v => !v)}>
                  <svg viewBox="0 0 40 52" width={11} height={14} style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill="#c864ff" />
                    <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
                  </svg>
                  <span className="p3-mil-label">Landing Hubs</span>
                  <span className="p3-mil-count">161</span>
                </span>
              </div>
            )}

            {(activeTab === 2 || activeTab === 4) && (
                <div className="p3-inline-legend">
                  {activeTab === 2 && (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'rgba(240,235,224,0.75)', fontWeight: 500 }}>
                        Dominant Supply Type
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(240,235,224,0.4)' }}>
                        Click a category to filter drone hubs and update the district chart.
                      </span>
                    </div>
                  )}
                  {activeTab === 4 && <>
                    <span style={{ width: '100%', fontSize: 11, color: 'rgba(240,235,224,0.75)', fontWeight: 500, marginBottom: 2 }}>
                      Coverage (10k persons per site)
                    </span>
                  </>}
                  {activeTab === 4 && (
                    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {[
                        { color: '#111118', label: '0' },
                        { color: '#0d3060', label: '< 50' },
                        { color: '#0a5a8a', label: '50–100' },
                        { color: '#0b7a6a', label: '100–200' },
                        { color: '#1a9640', label: '200–400' },
                        { color: '#c8a200', label: '400–800' },
                        { color: '#d04800', label: '800–1500' },
                        { color: '#b50000', label: '> 1500' },
                      ].map(({ color, label }) => (
                        <div key={label} className="p3-il-btn" style={{ cursor: 'default', gap: 6, justifyContent: 'center' }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                          <span style={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 2 && Object.entries(POI_COLORS).filter(([k]) => k !== 'medical').map(([k, v]) => (
                    <button key={k}
                      className={`p3-il-btn ${compoundFilter === k ? 'active' : compoundFilter === 'all' ? '' : 'dim'}`}
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
            )}

            <div className="p3-map-card">
              <Page3Map
                data={filteredSites}
                routes={routes}
                boundary={boundary}
                hexGrid={hexGrid}
                activeTab={activeTab}
                compoundFilter={compoundFilter}
                focusDistrict={focusDistrict}
                districtStats={districtStats}
                onDistrictFocus={handleDistrictFocus}
                viewResetKey={viewResetKey}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: hero text + chart */}
        <div className="p3-right">
          <div className="p3-hero-header">
            <h2 className="p3-hero-title">{TAB_HERO[activeTab]?.title}</h2>
            {TAB_HERO[activeTab]?.desc && (
              <p className="p3-hero-desc">{TAB_HERO[activeTab].desc}</p>
            )}
          </div>
          <div className="p3-chart-section">
              {activeTab === 1 && districtStats.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: 0.3, padding: '6px 0 2px' }}>
                    Distribution of Departure Hubs and Landing Hubs by District
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={districtStats} margin={{ left: 4, right: 8, top: 32, bottom: 4 }} barCategoryGap="28%" barGap={3}>
                        <CartesianGrid vertical={false} horizontal stroke="rgba(200,200,210,0.12)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis type="number" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} width={28}
                          label={{ value: 'Sites', angle: 0, position: 'top', fill: '#aaa', fontSize: 10, dy: -6, dx: 14 }} />
                        <Tooltip contentStyle={{ background: '#2E5E7E', border: '1px solid rgba(168,196,212,0.2)', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: '#aaa' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          formatter={(v, name) => [v, name === 'commercial' ? 'Departure Hubs' : 'Landing Hubs']} />
                        <Bar dataKey="commercial" fill="#ffa028" fillOpacity={0.85} maxBarSize={18} cursor="pointer"
                          onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                          <LabelList dataKey="commercial" position="top" style={{ fill: '#ccc', fontSize: 9 }} formatter={v => v > 0 ? v : ''} />
                        </Bar>
                        <Bar dataKey="last_mile" fill="#c864ff" fillOpacity={0.85} maxBarSize={18} cursor="pointer"
                          onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                          <LabelList dataKey="last_mile" position="top" style={{ fill: '#ccc', fontSize: 9 }} formatter={v => v > 0 ? v : ''} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '4px 0 6px', fontSize: 11, color: '#aaa' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ffa028', display: 'inline-block' }} />
                      Departure Hubs
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#c864ff', display: 'inline-block' }} />
                      Landing Hubs
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 2 && districtContextStats.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: 0.3, padding: '6px 0 2px' }}>
                    {compoundFilter === 'all'
                      ? 'Drone Hubs with Surrounding POI Context by District'
                      : `${POI_COLORS[contextChartType]?.label ?? contextChartType}-dominant Drone Sites by District`}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={districtContextStats} margin={{ left: 4, right: 8, top: 32, bottom: 4 }} barCategoryGap="35%">
                    <CartesianGrid vertical={false} horizontal stroke="rgba(200,200,210,0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis type="number" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} width={28}
                      label={{ value: 'Sites', angle: 0, position: 'top', fill: '#aaa', fontSize: 10, dy: -6, dx: 14 }} />
                    <Tooltip contentStyle={{ background: '#2E5E7E', border: '1px solid rgba(168,196,212,0.2)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#aaa' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      formatter={v => [v, POI_COLORS[contextChartType]?.label]} />
                    <Bar dataKey={contextChartType} fill={POI_COLORS[contextChartType]?.hex} fillOpacity={0.85} maxBarSize={22} cursor="pointer"
                      onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                      <LabelList dataKey={contextChartType} position="top" style={{ fill: '#ccc', fontSize: 9 }} formatter={v => v > 0 ? v : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === 3 && odMatrix && (
                <div className="p3-od-matrix">
                  <div className="p3-od-title">Inter-District Route Connections</div>
                  <div className="p3-od-grid" style={{
                    gridTemplateColumns: `80px repeat(${odMatrix.names.length}, 1fr)`,
                    gridTemplateRows: `24px repeat(${odMatrix.names.length}, 1fr)`,
                  }}>
                    <div className="p3-od-corner" />
                    {odMatrix.names.map(n => (
                      <div key={`h-${n}`} className="p3-od-col-label">{n}</div>
                    ))}
                    {odMatrix.names.map(origin => (
                      <React.Fragment key={origin}>
                        <div className="p3-od-row-label">{origin}</div>
                        {odMatrix.names.map(dest => {
                          const val = odMatrix.matrix[origin][dest];
                          const intensity = odMatrix.maxVal > 0 ? val / odMatrix.maxVal : 0;
                          return (
                            <div
                              key={`${origin}-${dest}`}
                              className="p3-od-cell"
                              style={{
                                background: val === 0
                                  ? 'rgba(168,196,212,0.06)'
                                  : `rgba(255,122,92,${0.15 + intensity * 0.85})`,
                              }}
                              title={`${origin} → ${dest}: ${val} routes`}
                            >
                              {val > 0 && <span className="p3-od-val">{val}</span>}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="p3-od-caption">
                    <span className="p3-od-cap-label">Origin (Departure Hub) →</span>
                    <div className="p3-od-scale">
                      <span style={{ background: 'rgba(255,122,92,0.15)' }} />
                      <span style={{ background: 'rgba(255,122,92,0.5)' }} />
                      <span style={{ background: 'rgba(255,122,92,1)' }} />
                    </div>
                    <span className="p3-od-cap-label">0 — {odMatrix.maxVal} routes</span>
                  </div>
                </div>
              )}

              {activeTab === 4 && districtCoverageStats.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: 0.3, padding: '6px 0 2px' }}>
                    Drone Site Availability by District
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={districtCoverageStats} margin={{ left: 4, right: 8, top: 32, bottom: 4 }} barCategoryGap="35%">
                        <CartesianGrid vertical={false} horizontal stroke="rgba(200,200,210,0.12)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis type="number" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} width={28}
                          label={{ value: 'per 10k', angle: 0, position: 'top', fill: '#aaa', fontSize: 10, dy: -6, dx: 18 }} />
                        <Tooltip contentStyle={{ background: '#2E5E7E', border: '1px solid rgba(168,196,212,0.2)', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: '#aaa' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          formatter={(v, name) => [name === 'ratio' ? `${v} sites/10k pop` : v, 'Coverage Rate']} />
                        <Bar dataKey="ratio" fill="#e03030" fillOpacity={0.85} maxBarSize={22} cursor="pointer"
                          onClick={d => { const v = getDistrictView(d.name); if (v) setFocusDistrict(v); }}>
                          <LabelList dataKey="ratio" position="top" style={{ fill: '#ccc', fontSize: 9 }} formatter={v => v > 0 ? v : ''} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
          </div>
        </div>

      </div>
    </section>
  );
}

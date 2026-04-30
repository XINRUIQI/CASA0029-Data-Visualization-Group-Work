import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
         ScatterChart, Scatter, ZAxis, CartesianGrid, ReferenceArea, ReferenceLine,
         AreaChart, Area, LineChart, Line, Treemap } from 'recharts';
import { GroundFrictionBoxChart } from '../Page4/Page4Charts';
import '../Page4/Page4.css';
import './Page2FrictionCharts.css';

const TT_STYLE = { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 };
const TT_SUPPLY = { background: '#5A89A6', border: '1px solid #4a7898', borderRadius: 8, fontSize: 11, color: '#F0EBE0' };

const POI_RADAR_INFO =
  "Each axis = that category's share of the citywide total (eight summed category counts on the H3 grid).";

const DEMAND_DIST_INFO =
  'Cumulative concentration curve (coverage curve): hexagons with takeout_demand_index > 0 are sorted from highest '
  + 'to lowest demand. Horizontal axis = cumulative share of hex counts along that rank order; vertical axis = '
  + 'cumulative share of summed fused demand index (same composition as map colouring). '
  + 'The dashed diagonal would mean uniform concentration — equal hex shares contribute equal demand shares; '
  + 'a steep bend toward the upper-left means demand is concentrated in relatively few hexagons. '
  + 'Weights per hex: 50% normalized orders + 30% pop + 20% residential (convert_all_to_h3.py); '
  + 'map visuals also multiply by Meituan hourly weight.';


const REAL_ORDERS_SCATTER_INFO =
  'Each point is one H3 hexagon. Axes: population (horizontal) vs real order count in that hex (vertical). '
  + 'Only cells with at least one RL-Dispatch order are shown.';

/** POI shares inside one H3 cell — colours aligned with radar categories */
const SUPPLY_TREEMAP_CATS = [
  { key: 'food_count', label: 'Food', color: '#ff8c00' },
  { key: 'retail_count', label: 'Retail', color: '#ff3264' },
  { key: 'service_count', label: 'Service', color: '#64c8ff' },
  { key: 'office_count', label: 'Office', color: '#6c8cff' },
  { key: 'education_count', label: 'Education', color: '#00e896' },
  { key: 'medical_count', label: 'Medical', color: '#ffa028' },
  { key: 'scenic_count', label: 'Scenic', color: '#c864ff' },
  { key: 'leisure_count', label: 'Leisure', color: '#50b0ff' },
];

function syntheticSupplyRowFromHover(hex) {
  if (!hex) return null;
  return {
    food_count: hex.food_count ?? hex.food ?? 0,
    retail_count: hex.retail_count ?? hex.retail ?? 0,
    service_count: hex.service_count ?? hex.service ?? 0,
    office_count: hex.office_count ?? hex.office ?? 0,
    education_count: hex.education_count ?? hex.edu ?? 0,
    medical_count: hex.medical_count ?? hex.med ?? 0,
    scenic_count: hex.scenic_count ?? hex.scenic ?? 0,
    leisure_count: hex.leisure_count ?? hex.leisure ?? 0,
  };
}

function buildSupplyTreemapLeaves(row) {
  if (!row) return [];
  return SUPPLY_TREEMAP_CATS.map(cat => ({
    name: cat.label,
    catKey: cat.key,
    value: Math.max(0, Number(row[cat.key]) || 0),
    fill: cat.color,
  })).filter(x => x.value > 0);
}

function interpretSupplyTreemap(leaves, sum) {
  if (!leaves.length || sum <= 0) return null;
  const sorted = [...leaves].sort((a, b) => b.value - a.value);
  const max = sorted[0];
  const second = sorted[1];
  if (sorted.length >= 2 && second.value / max.value >= 0.72) {
    return 'Mixed-use — comparable POI blocks';
  }
  if (max.catKey === 'food_count') {
    return 'Dining-led — food venues dominate supply-side POIs';
  }
  if (max.catKey === 'office_count') {
    return 'Office-led — workplace clusters shape demand pressure';
  }
  return `${max.name}-led`;
}

const SUPPLY_ACCESS_RADII = [
  { key: 'food_access_3km', label: '3 km', cityIndex: 2 },
  { key: 'food_access_2km', label: '2 km', cityIndex: 1 },
  { key: 'food_access_1km', label: '1 km', cityIndex: 0 },
];

function SupplyTreemapCell(props) {
  const { x, y, width, height, name, fill, value, totalSum } = props;
  if (width <= 0 || height <= 0) return null;
  const bg = fill || '#706860';
  const fontSize = width > 76 ? 12 : width > 48 ? 10 : width > 34 ? 9 : 8;
  const showLabel = width > 34 && height > 16;
  const pct = totalSum > 0 ? ((value / totalSum) * 100).toFixed(0) : '0';
  const showPct = width > 42 && height > 30;
  return (
    <g className="p2c-treemap-cell">
      <rect
        x={x} y={y} width={width} height={height}
        rx={2} ry={2} fill={bg} stroke="#ffffff" strokeWidth={1}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPct ? 6 : 0)}
          textAnchor="middle" dominantBaseline="central"
          fill="#ffffff" fontSize={fontSize} fontWeight={600}
          style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
        >
          {name}
        </text>
      )}
      {showLabel && showPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.8)" fontSize={fontSize - 1} fontWeight={400}
          style={{ pointerEvents: 'none' }}
        >
          {pct}%
        </text>
      )}
    </g>
  );
}

function Page2FrictionCharts({
  activeMode, hoveredHex, selectedHex, h3Demand, h3Gap, h3Takeout, odAnalysis, liveMetrics, onHighlight,
  timeWeight = 1,
}) {
  const gapByH3All = useMemo(() => new Map((h3Gap || []).map(g => [g.h3, g])), [h3Gap]);
  const takeoutByH3 = useMemo(() => new Map((h3Takeout || []).map(t => [t.h3, t])), [h3Takeout]);
  const demandByH3 = useMemo(() => new Map((h3Demand || []).map(d => [d.h3, d])), [h3Demand]);

  const activeHex = useMemo(() => {
    if (selectedHex) {
      const g = gapByH3All.get(selectedHex);
      const t = takeoutByH3.get(selectedHex);
      const d = demandByH3.get(selectedHex);
      if (g || t || d) {
        return {
          h3: selectedHex,
          ...d,
          ...g,
          ...t,
        };
      }
    }
    return hoveredHex;
  }, [selectedHex, hoveredHex, gapByH3All, takeoutByH3, demandByH3]);
  const scatterData = useMemo(() => {
    if (!h3Gap?.length) return [];
    return h3Gap
      .filter(d => d.demand_pressure > 0 || d.avg_friction > 0)
      .map(d => ({
        demand: +(d.demand_pressure ?? 0).toFixed(2),
        friction: +(d.avg_friction ?? 0).toFixed(3),
        gap: +(d.gap_index ?? 0).toFixed(4),
      }));
  }, [h3Gap]);

  const FRICTION_DIMS = [
    { key: 'avg_detour', label: 'Detour', color: '#ff8c00' },
    { key: 'avg_congestion', label: 'Congestion', color: '#ff3264' },
    { key: 'avg_friction', label: 'Overall friction', color: '#c864ff' },
    { key: 'demand_pressure', label: 'Supply pressure', color: '#6c8cff' },
    { key: 'intensity_index', label: 'Intensity', color: '#00e896' },
  ];

  const frictionCityAvg = useMemo(() => {
    if (!h3Gap?.length) return null;
    const avgs = {};
    FRICTION_DIMS.forEach(({ key }) => {
      const vals = h3Gap.map(d => Number(d[key]) || 0).filter(v => v > 0);
      avgs[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    return avgs;
  }, [h3Gap]);

  const frictionDiverging = useMemo(() => {
    if (!frictionCityAvg) return null;
    const hexRow = activeHex || {};
    const hasHex = Boolean(activeHex?.h3);
    const bars = FRICTION_DIMS.map(({ key, label, color }) => {
      const cityVal = frictionCityAvg[key] || 0;
      const hexVal = Number(hexRow[key]) || 0;
      const pctDiff = cityVal > 0 && hasHex
        ? ((hexVal - cityVal) / cityVal) * 100
        : 0;
      return {
        key,
        label,
        color,
        cityVal,
        hexVal: hasHex ? hexVal : cityVal,
        pctDiff: +pctDiff.toFixed(1),
      };
    });
    return { bars, hasHex };
  }, [frictionCityAvg, activeHex]);

  const handleScatterClick = (entry) => {
    const pt = entry?.payload ?? entry;
    if (!pt?.demand && pt?.demand !== 0) return;
    const d = pt.demand;
    const f = pt.friction;
    onHighlight?.((hex) => {
      const dp = hex.dp || 0;
      const fr = hex.avg_friction || 0;
      if (Math.abs(dp - d) < 1 && Math.abs(fr - f) < 0.05) return true;
      return false;
    });
  };

  const poiRanking = useMemo(() => {
    if (!h3Gap?.length) return [];
    const cats = [
      { key: 'food_count', name: 'Food & Dining', color: '#ff8c00' },
      { key: 'retail_count', name: 'Retail', color: '#ff3264' },
      { key: 'service_count', name: 'Service', color: '#64c8ff' },
      { key: 'office_count', name: 'Office', color: '#6c8cff' },
      { key: 'education_count', name: 'Education', color: '#00e896' },
      { key: 'medical_count', name: 'Medical', color: '#ffa028' },
      { key: 'scenic_count', name: 'Scenic', color: '#c864ff' },
      { key: 'leisure_count', name: 'Leisure', color: '#50b0ff' },
    ];
    return cats
      .map(c => ({
        ...c,
        total: h3Gap.reduce((s, d) => s + (d[c.key] || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [h3Gap]);

  const poiRadar = useMemo(() => {
    if (!poiRanking.length) return [];
    const sumTotals = poiRanking.reduce((s, p) => s + p.total, 0) || 1;
    return poiRanking.map(p => ({
      axis: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name,
      value: +(p.total / sumTotals).toFixed(4),
      total: p.total,
      color: p.color,
    }));
  }, [poiRanking]);

  const poiRadarRMax = useMemo(() => {
    if (!poiRadar.length) return 1;
    return Math.max(...poiRadar.map(d => d.value), 1e-6);
  }, [poiRadar]);

  const [poiSupplyInfoOpen, setPoiSupplyInfoOpen] = useState(false);
  const [demandDistInfoOpen, setDemandDistInfoOpen] = useState(false);
  const [ordersScatterInfoOpen, setOrdersScatterInfoOpen] = useState(false);
  const [treemapInfoOpen, setTreemapInfoOpen] = useState(false);
  const [bulletInfoOpen, setBulletInfoOpen] = useState(false);
  const poiSupplyInfoRef = useRef(null);
  const demandDistInfoRef = useRef(null);
  const ordersScatterInfoRef = useRef(null);
  const treemapInfoRef = useRef(null);
  const bulletInfoRef = useRef(null);

  const gapByH3 = useMemo(() => new Map((h3Gap || []).map(g => [g.h3, g])), [h3Gap]);

  /** Mean POI count per hex (citywide), same keys as SUPPLY_TREEMAP_CATS */
  const supplyCityAvgRow = useMemo(() => {
    if (!h3Gap?.length) return null;
    const n = h3Gap.length;
    const row = {};
    SUPPLY_TREEMAP_CATS.forEach((cat) => {
      const sum = h3Gap.reduce((s, d) => s + (Number(d[cat.key]) || 0), 0);
      row[cat.key] = sum / n;
    });
    return row;
  }, [h3Gap]);

  const supplyTreemapRow = useMemo(() => {
    if (activeHex?.h3) {
      const gapRow = gapByH3.get(activeHex.h3);
      if (gapRow) return gapRow;
      return syntheticSupplyRowFromHover(activeHex);
    }
    return supplyCityAvgRow;
  }, [activeHex, gapByH3, supplyCityAvgRow]);

  const supplyTreemapRaw = useMemo(() => buildSupplyTreemapLeaves(supplyTreemapRow), [supplyTreemapRow]);

  const supplyTreemapSum = useMemo(() => supplyTreemapRaw.reduce((s, x) => s + x.value, 0), [supplyTreemapRaw]);

  const supplyTreemapLeaves = useMemo(
    () => supplyTreemapRaw.map(leaf => ({ ...leaf, totalSum: supplyTreemapSum })),
    [supplyTreemapRaw, supplyTreemapSum],
  );

  const supplyTreemapReadout = useMemo(
    () => interpretSupplyTreemap(supplyTreemapLeaves, supplyTreemapSum),
    [supplyTreemapLeaves, supplyTreemapSum],
  );

  useEffect(() => {
    if (activeMode !== 'supply') { setPoiSupplyInfoOpen(false); setTreemapInfoOpen(false); setBulletInfoOpen(false); }
    if (activeMode !== 'demand') {
      setDemandDistInfoOpen(false);
      setOrdersScatterInfoOpen(false);
    }
  }, [activeMode]);

  useEffect(() => {
    if (!poiSupplyInfoOpen && !demandDistInfoOpen && !ordersScatterInfoOpen && !treemapInfoOpen && !bulletInfoOpen) return;
    const onDoc = (e) => {
      if (poiSupplyInfoOpen && !poiSupplyInfoRef.current?.contains(e.target)) setPoiSupplyInfoOpen(false);
      if (demandDistInfoOpen && !demandDistInfoRef.current?.contains(e.target)) setDemandDistInfoOpen(false);
      if (ordersScatterInfoOpen && !ordersScatterInfoRef.current?.contains(e.target)) setOrdersScatterInfoOpen(false);
      if (treemapInfoOpen && !treemapInfoRef.current?.contains(e.target)) setTreemapInfoOpen(false);
      if (bulletInfoOpen && !bulletInfoRef.current?.contains(e.target)) setBulletInfoOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [poiSupplyInfoOpen, demandDistInfoOpen, ordersScatterInfoOpen, treemapInfoOpen, bulletInfoOpen]);

  const demandCoverage = useMemo(() => {
    if (!h3Takeout?.length) return null;
    const vals = h3Takeout
      .map(d => Math.max(0, d.takeout_demand_index || 0))
      .filter(v => v > 0)
      .sort((a, b) => b - a);
    if (!vals.length) return null;
    const total = vals.reduce((s, v) => s + v, 0);
    if (total <= 0) return null;
    const n = vals.length;
    const pts = [{ pctHex: 0, pctDemand: 0 }];
    let cum = 0;
    vals.forEach((v, i) => {
      cum += v;
      pts.push({
        pctHex: ((i + 1) / n) * 100,
        pctDemand: (cum / total) * 100,
      });
    });
    const kTop = Math.min(n, Math.ceil(0.2 * n));
    const cumTop = vals.slice(0, kTop).reduce((s, x) => s + x, 0);
    const pctDemandTop20 = (cumTop / total) * 100;
    const pctHexTop20 = (kTop / n) * 100;
    return { pts, n, pctDemandTop20, kTop, pctHexTop20 };
  }, [h3Takeout]);

  const orderVsProxy = useMemo(() => {
    if (!h3Takeout?.length) return [];
    return h3Takeout
      .filter(d => (d.real_order_count || 0) > 0)
      .map(d => ({
        orders: d.real_order_count || 0,
        pop: +(d.pop_count || 0).toFixed(0),
        food: d.food_count || 0,
        tdi: +(d.takeout_demand_index || 0).toFixed(3),
      }));
  }, [h3Takeout]);

  const topPriorityHexagons = useMemo(() => {
    if (!h3Gap?.length) return [];
    const rows = [];
    for (const g of h3Gap) {
      const score = g.gap_index ?? 0;
      if (score <= 0) continue;
      rows.push({ h3: g.h3, score });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [h3Gap]);

  const congestionDensity = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const raw = odAnalysis.map(d => d.congestion_amplifier).filter(v => v != null && v > 0);
    if (raw.length < 5) return null;
    const step = 0.05;
    const maxX = Math.min(3.5, Math.max(...raw) + 0.1);
    const bins = [];
    for (let x = 0; x <= maxX; x += step) {
      const lo = x;
      const hi = x + step;
      const count = raw.filter(v => v >= lo && v < hi).length;
      bins.push({ x: +(x + step / 2).toFixed(3), count });
    }
    const peak = Math.max(1, ...bins.map(b => b.count));
    return { bins, peak, n: raw.length };
  }, [odAnalysis]);

  const foodAccessCity = useMemo(() => {
    if (!h3Takeout?.length) return null;
    const active = h3Takeout.filter(d => (d.takeout_demand_index || 0) > 0);
    if (!active.length) return null;
    const avg = (key) => +(active.reduce((s, d) => s + (d[key] || 0), 0) / active.length).toFixed(1);
    return [
      { radius: '1 km', count: avg('food_access_1km') },
      { radius: '2 km', count: avg('food_access_2km') },
      { radius: '3 km', count: avg('food_access_3km') },
    ];
  }, [h3Takeout]);

  const foodAccessBullet = useMemo(() => {
    if (!foodAccessCity?.length) return null;
    const rows = SUPPLY_ACCESS_RADII.map(({ key, label, cityIndex }) => {
      const avg = Number(foodAccessCity[cityIndex]?.count ?? 0);
      let selected = avg;
      if (activeHex?.h3 != null) {
        selected = Number(activeHex[key] ?? 0);
      }
      return {
        label,
        selected: Math.max(0, selected),
        avg: Math.max(0, avg),
      };
    });
    const peak = Math.max(1, ...rows.flatMap((r) => [r.selected, r.avg]));
    const maxScale = peak * 1.06;
    return {
      rows,
      maxScale,
      hasHex: Boolean(activeHex?.h3),
    };
  }, [foodAccessCity, activeHex]);

  const isSupply = activeMode === 'supply';
  const isFriction = activeMode === 'friction';
  const isPriority = activeMode === 'priority';
  const isDemand = activeMode === 'demand';

  const treemapIsHex = Boolean(activeHex?.h3);

  return (
    <div className="p2c">


      {/* Supply mode: POI ranking */}
      {isSupply && poiRadar.length > 0 && (
        <div className="p2c-section">
          <div className="p2c-section-head" ref={poiSupplyInfoRef}>
            <h4>Supply Contribution</h4>
            <div className="p2c-head-actions">
              <button
                type="button"
                className="p2c-info-icon"
                aria-label="About this chart"
                aria-expanded={poiSupplyInfoOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setPoiSupplyInfoOpen((o) => !o);
                }}
              >
                i
              </button>
              {poiSupplyInfoOpen && (
                <div className="p2c-info-popover" role="tooltip">
                  {POI_RADAR_INFO}
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={poiRadar} cx="50%" cy="52%" outerRadius="72%">
              <PolarGrid stroke="rgba(168, 196, 212, 0.15)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#888', fontSize: 9 }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, poiRadarRMax]} />
              <Radar
                name="Share of citywide POI pool"
                dataKey="value"
                stroke="#ff8c00"
                fill="#ff8c00"
                fillOpacity={0.22}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={TT_STYLE}
                formatter={(v, _n, item) => {
                  const row = item?.payload;
                  const raw = row?.total;
                  const pct = typeof v === 'number' ? (v * 100).toFixed(1) : '0';
                  return [
                    `${pct}% of summed categories (${raw != null ? raw.toLocaleString() : '—'} POIs)`,
                    row?.axis || '',
                  ];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Supply mode: hex POI treemap — city average when idle; hovered hex on hover */}
      {isSupply && (
        <div className="p2c-section p2c-supply-treemap-section">
          <div className="p2c-section-head" ref={treemapInfoRef}>
            <h4>
              Hex Supply structure
              {treemapIsHex ? (
                <span className="p2c-fa-badge">Hovered hex</span>
              ) : (
                <span className="p2c-fa-badge p2c-fa-badge--avg">City average</span>
              )}
            </h4>
            <div className="p2c-head-actions">
              <button
                type="button"
                className="p2c-info-icon"
                aria-label="About this chart"
                aria-expanded={treemapInfoOpen}
                onClick={(e) => { e.stopPropagation(); setTreemapInfoOpen(o => !o); }}
              >
                i
              </button>
              {treemapInfoOpen && (
                <div className="p2c-info-popover" role="tooltip">
                  Each block = one POI category. Area is proportional to POI count in this hex (or city average when no hex is hovered). Percentage = share of total POIs in this hex.
                </div>
              )}
            </div>
          </div>
          {supplyTreemapLeaves.length > 0 ? (
            <>
              <div className="p2c-treemap-chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <Treemap
                    data={supplyTreemapLeaves}
                    dataKey="value"
                    nameKey="name"
                    stroke="#ffffff"
                    strokeWidth={1}
                    aspectRatio={4 / 3}
                    isAnimationActive={false}
                    content={<SupplyTreemapCell />}
                  >
                    <Tooltip
                      contentStyle={TT_SUPPLY}
                      labelStyle={{ color: '#F0EBE0' }}
                      itemStyle={{ color: '#F0EBE0' }}
                      formatter={(value, _name, item) => {
                        const row = item?.payload;
                        const nm = row?.name ?? '';
                        const v = Number(value);
                        const fmt = Number.isFinite(v) ? v.toFixed(2) : '—';
                        const pct = supplyTreemapSum > 0 ? ((v / supplyTreemapSum) * 100).toFixed(1) : '0';
                        return [`${fmt} (${pct}%)`, nm];
                      }}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </div>
              {supplyTreemapReadout && (
                <p className="p2c-treemap-readout">{supplyTreemapReadout}</p>
              )}
            </>
          ) : (
            <p className="p2c-note">Supply POI aggregates unavailable.</p>
          )}
        </div>
      )}

      {/* Supply mode — Bullet chart: supply accessibility vs city baseline */}
      {isSupply && foodAccessBullet && (
        <div className="p2c-section p2c-bullet-section">
          <div className="p2c-section-head" ref={bulletInfoRef}>
            <h4>
              Hex Supply Accessibility
              {foodAccessBullet.hasHex ? (
                <span className="p2c-fa-badge">Selected H3</span>
              ) : (
                <span className="p2c-fa-badge p2c-fa-badge--avg">City baseline</span>
              )}
            </h4>
            <div className="p2c-head-actions">
              <button
                type="button"
                className="p2c-info-icon"
                aria-label="About this chart"
                aria-expanded={bulletInfoOpen}
                onClick={(e) => { e.stopPropagation(); setBulletInfoOpen(o => !o); }}
              >
                i
              </button>
              {bulletInfoOpen && (
                <div className="p2c-info-popover" role="tooltip">
                  Weighted supply accessibility at 1/2/3 km radii. Food POIs carry the largest weight (60%), with retail (20%) and service (20%) as secondary factors. Grey band = city average; orange bar = hovered hex value; marker = baseline.
                </div>
              )}
            </div>
          </div>

          <div className="p2c-bullet-rows">
            {foodAccessBullet.rows.map((row) => {
              const { maxScale } = foodAccessBullet;
              const pct = (v) => `${Math.min(100, (v / maxScale) * 100)}%`;
              return (
                <div key={row.label} className="p2c-bullet-row">
                  <span className="p2c-bullet-y">{row.label}</span>
                  <div className="p2c-bullet-track-wrap">
                    <div className="p2c-bullet-track" role="presentation">
                      <div
                        className="p2c-bullet-city"
                        style={{ width: pct(row.avg) }}
                        title={`City avg ${row.avg}`}
                      />
                      <div
                        className="p2c-bullet-marker"
                        style={{ left: pct(row.avg) }}
                      />
                      <div
                        className="p2c-bullet-selected"
                        style={{ width: pct(row.selected) }}
                        title={`Selected ${row.selected}`}
                      />
                    </div>
                  </div>
                  <span className="p2c-bullet-caption">
                    {Math.round(row.selected)}
                    {' '}
                    / avg {Math.round(row.avg)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p2c-bullet-axis-foot">
            <span>0</span>
            <span className="p2c-bullet-axis-title">Supply accessibility index</span>
            <span>{Math.ceil(foodAccessBullet.maxScale)}</span>
          </div>

          <div className="p2c-bullet-legend" aria-hidden="true">
            <span>
              <span className="p2c-bullet-lg-swatch p2c-bullet-lg-city" />
              City average
            </span>
            <span>
              <span className="p2c-bullet-lg-swatch p2c-bullet-lg-selected" />
              Selected H3
            </span>
          </div>

        </div>
      )}

      {/* Priority: supply vs friction scatter */}
      {isPriority && scatterData.length > 0 && (
        <div className="p2c-section">
          <h4>Supply vs Friction (per hex) <span className="p2c-click-hint">click to highlight</span></h4>
          <ResponsiveContainer width="100%" height={210}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis dataKey="demand" type="number" name="Supply"
                tick={{ fill: '#A09888', fontSize: 9 }} axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
                label={{ value: 'Supply', position: 'bottom', fill: '#555', fontSize: 10, offset: 2 }}
              />
              <YAxis dataKey="friction" type="number" name="Friction"
                tick={{ fill: '#A09888', fontSize: 9 }} axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
                label={{ value: 'Friction', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
              />
              <ZAxis dataKey="gap" range={[8, 8]} />
              <Tooltip contentStyle={TT_STYLE}
                formatter={(v, name) => [typeof v === 'number' ? v.toFixed(3) : v, name]}
              />
              <ReferenceArea
                x1={scatterData.reduce((m, d) => Math.max(m, d.demand), 0) * 0.5}
                x2={scatterData.reduce((m, d) => Math.max(m, d.demand), 0)}
                y1={scatterData.reduce((m, d) => Math.max(m, d.friction), 0) * 0.5}
                y2={scatterData.reduce((m, d) => Math.max(m, d.friction), 0)}
                fill="#c864ff" fillOpacity={0.06} stroke="#c864ff" strokeOpacity={0.2} strokeDasharray="4 4"
                label={{ value: 'Pain Zone', fill: '#c864ff', fontSize: 9, position: 'insideTopRight' }}
              />
              <Scatter data={scatterData} fill="#ff8c00" fillOpacity={0.5} r={2}
                onClick={handleScatterClick} cursor="pointer"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {isPriority && topPriorityHexagons.length > 0 && (
        <div className="p2c-section">
          <h4>Top 10 Composite (Gap Index) <span className="p2c-click-hint">click to highlight</span></h4>
          <div className="p2c-hex-rank">
            {topPriorityHexagons.map(hex => {
              const maxS = topPriorityHexagons[0].score || 1;
              const barW = (hex.score / maxS) * 100;
              return (
                <div
                  key={hex.h3}
                  className="p2c-hr-row"
                  onClick={() => onHighlight?.((cell) => cell.h3 === hex.h3)}
                >
                  <span className="p2c-hr-rank">#{hex.rank}</span>
                  <div className="p2c-hr-body">
                    <div className="p2c-hr-bar-wrap">
                      <div
                        className="p2c-hr-bar"
                        style={{ width: `${barW}%`, background: '#c864ff' }}
                      />
                      <span className="p2c-hr-dp">{hex.score.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friction mode charts */}
      {isFriction && (
        <>
          {frictionDiverging && (
            <div className="p2c-section p2c-diverging-section">
              <h4>
                Friction vs City Average
                {frictionDiverging.hasHex ? (
                  <span className="p2c-fa-badge">Hovered H3</span>
                ) : (
                  <span className="p2c-fa-badge p2c-fa-badge--avg">Baseline</span>
                )}
              </h4>
              <div className="p2c-diverging-rows">
                {frictionDiverging.bars.map((b) => {
                  const maxAbs = Math.max(
                    1,
                    ...frictionDiverging.bars.map((x) => Math.abs(x.pctDiff)),
                  );
                  const scale = Math.min(50, (Math.abs(b.pctDiff) / maxAbs) * 50);
                  const isPositive = b.pctDiff >= 0;
                  return (
                    <div key={b.key} className="p2c-dv-row">
                      <span className="p2c-dv-label">{b.label}</span>
                      <div className="p2c-dv-track">
                        <div className="p2c-dv-center" />
                        <div
                          className={`p2c-dv-bar ${isPositive ? 'p2c-dv-bar--pos' : 'p2c-dv-bar--neg'}`}
                          style={{
                            width: `${scale}%`,
                            left: isPositive ? '50%' : `${50 - scale}%`,
                            background: b.color,
                          }}
                        />
                      </div>
                      <span
                        className="p2c-dv-pct"
                        style={{ color: b.pctDiff > 0 ? '#e65100' : b.pctDiff < 0 ? '#2e7d32' : '#888' }}
                      >
                        {b.pctDiff > 0 ? '+' : ''}{b.pctDiff}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="p2c-note">
                {frictionDiverging.hasHex
                  ? 'Centre = city mean; bar direction = how this hex deviates.'
                  : 'Hover a hexagon to compare its friction profile against the city average.'}
              </p>
            </div>
          )}

          {congestionDensity && (
            <div className="p2c-section">
              <h4>How Much Congestion Increases Travel Time</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={congestionDensity.bins} margin={{ left: 5, right: 10, top: 22, bottom: 20 }}>
                  <defs>
                    <linearGradient id="congDensGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff3264" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#ff3264" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.12)" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 'dataMax']}
                    tick={{ fill: '#888', fontSize: 9 }}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{ value: 'Peak / Free-flow ratio', position: 'bottom', fill: '#888', fontSize: 9, offset: 2 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={TT_STYLE}
                    formatter={(v) => [v, 'OD pairs']}
                    labelFormatter={(l) => `ratio ${Number(l).toFixed(2)}×`}
                  />

                  {/* Threshold bands */}
                  <ReferenceArea x1={1.5} x2={2.0} fill="#ff3264" fillOpacity={0.06}
                    label={{ value: 'High', fill: '#ff3264', fontSize: 8, position: 'insideTopRight' }}
                  />
                  <ReferenceArea x1={2.0} x2={3.5} fill="#ff3264" fillOpacity={0.12}
                    label={{ value: 'Severe', fill: '#d32f2f', fontSize: 8, position: 'insideTopRight' }}
                  />

                  <ReferenceLine x={1.0} stroke="#00e896" strokeDasharray="4 4" strokeWidth={1.2}
                    label={{ value: '1.0', fill: '#00e896', fontSize: 8, position: 'top' }}
                  />
                  <ReferenceLine x={1.2} stroke="#ffa028" strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: '1.2', fill: '#ffa028', fontSize: 8, position: 'top' }}
                  />
                  <ReferenceLine x={1.5} stroke="#ff3264" strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: '1.5', fill: '#ff3264', fontSize: 8, position: 'top' }}
                  />
                  <ReferenceLine x={2.0} stroke="#d32f2f" strokeDasharray="4 4" strokeWidth={1.2}
                    label={{ value: '2.0', fill: '#d32f2f', fontSize: 8, position: 'top' }}
                  />

                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#ff3264"
                    strokeWidth={1.5}
                    fill="url(#congDensGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="p2c-cong-bands">
                <span className="p2c-cb" style={{ color: '#00e896' }}>≈1.0 No amp.</span>
                <span className="p2c-cb" style={{ color: '#ffa028' }}>1.0–1.2 Low</span>
                <span className="p2c-cb" style={{ color: '#ff3264' }}>1.2–1.5 Mod.</span>
                <span className="p2c-cb p2c-cb--alert">1.5–2.0 High</span>
                <span className="p2c-cb p2c-cb--severe">&gt;2.0 Severe</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Demand mode charts */}
      {isDemand && (
        <>
          {orderVsProxy.length > 0 && (
            <div className="p2c-section">
              <div ref={ordersScatterInfoRef}>
                <h4 className="p2c-title-with-info">
                  Where Do Real Orders Cluster?
                  <button
                    type="button"
                    className="p2c-info-icon"
                    aria-label="About this chart"
                    aria-expanded={ordersScatterInfoOpen}
                    onClick={(e) => { e.stopPropagation(); setOrdersScatterInfoOpen(o => !o); }}
                  >
                    i
                  </button>
                  {ordersScatterInfoOpen && (
                    <div className="p2c-info-popover" role="tooltip">
                      Hexagons with zero real orders are excluded from this plot.
                    </div>
                  )}
                </h4>
                <p className="p2c-subtitle">Does demand follow population, or do some areas overperform?</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
                  <XAxis dataKey="pop" type="number" name="Population"
                    tick={{ fill: '#A09888', fontSize: 9 }} axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
                    label={{ value: 'Population', position: 'bottom', fill: '#555', fontSize: 10, offset: 2 }}
                  />
                  <YAxis dataKey="orders" type="number" name="Orders"
                    tick={{ fill: '#A09888', fontSize: 9 }} axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
                    label={{ value: 'Real Orders', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
                  />
                  <ZAxis range={[8, 8]} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString() : v, name]} />
                  <Scatter data={orderVsProxy} fill="#81D8D0" fillOpacity={0.5} r={2.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {demandCoverage && (
            <div className="p2c-section">
              <div ref={demandDistInfoRef}>
                <h4 className="p2c-title-with-info">
                  How Concentrated Is Delivery Demand?
                  <button
                    type="button"
                    className="p2c-info-icon"
                    aria-label="About this chart"
                    aria-expanded={demandDistInfoOpen}
                    onClick={(e) => { e.stopPropagation(); setDemandDistInfoOpen(o => !o); }}
                  >
                    i
                  </button>
                  {demandDistInfoOpen && (
                    <div className="p2c-info-popover" role="tooltip">
                      Hexagons are ranked from highest to lowest Demand Index.<br />
                      The X-axis shows the cumulative share of valid hexagons included in this ranked order.<br />
                      The Y-axis shows the cumulative share of total Demand Index contributed by those hexagons.<br />
                      Hexagons with zero real orders are excluded from this plot.
                    </div>
                  )}
                </h4>
                <p className="p2c-subtitle">The top 20% of hexagons capture about {demandCoverage.pctDemandTop20.toFixed(0)}% of total demand.</p>
              </div>
              <div className="p2c-demand-ccurve-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={demandCoverage.pts} margin={{ left: 16, right: 12, top: 24, bottom: 18 }}>
                    <defs>
                      <linearGradient id="demCovGradP2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#81D8D0" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#81D8D0" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
                    <XAxis
                      dataKey="pctHex"
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: '#A09888', fontSize: 9 }}
                      tickFormatter={(v) => `${Math.round(v)}%`}
                      label={{
                        value: 'Share of hexagons, ranked by demand',
                        position: 'bottom',
                        fill: '#706860',
                        fontSize: 9,
                        offset: -2,
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      width={44}
                      tick={{ fill: '#555', fontSize: 9 }}
                      tickFormatter={(v) => `${Math.round(v)}%`}
                      label={{
                        value: 'Share of total demand',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#706860',
                        fontSize: 9,
                        offset: 4,
                      }}
                    />
                    <Tooltip
                      contentStyle={TT_STYLE}
                      formatter={(value, name, item) => {
                        const p = item?.payload;
                        if (p && typeof p.pctHex === 'number' && typeof p.pctDemand === 'number') {
                          return [
                            `${p.pctDemand.toFixed(1)}% cumulative demand · ${p.pctHex.toFixed(1)}% cumulative hex`,
                            'Coverage',
                          ];
                        }
                        return [`${typeof value === 'number' ? value.toFixed(1) : value}%`, name];
                      }}
                    />
                    <ReferenceLine
                      segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                      stroke="#666"
                      strokeDasharray="5 5"
                      strokeOpacity={0.72}
                    />
                    <ReferenceLine
                      x={20}
                      stroke="#00ffc8"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{
                        value: '~top 20% hex band',
                        fill: '#00c8a8',
                        fontSize: 8,
                        position: 'top',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pctDemand"
                      stroke="none"
                      fill="url(#demCovGradP2)"
                    />
                    <Line
                      type="monotone"
                      dataKey="pctDemand"
                      stroke="#81D8D0"
                      strokeWidth={2}
                      dot={false}
                      name="Cumulative demand %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

export default React.memo(Page2FrictionCharts, (prev, next) => {
  if (prev.activeMode !== next.activeMode) return false;
  if (prev.timeWeight !== next.timeWeight) return false;
  if (prev.h3Demand !== next.h3Demand) return false;
  if (prev.h3Gap !== next.h3Gap) return false;
  if (prev.h3Takeout !== next.h3Takeout) return false;
  if (prev.odAnalysis !== next.odAnalysis) return false;
  if (prev.onHighlight !== next.onHighlight) return false;
  if (prev.selectedHex !== next.selectedHex) return false;
  if (next.selectedHex) return true;
  const mode = next.activeMode;
  if (mode === 'priority') return true;
  if (prev.hoveredHex?.h3 !== next.hoveredHex?.h3) return false;
  return true;
});

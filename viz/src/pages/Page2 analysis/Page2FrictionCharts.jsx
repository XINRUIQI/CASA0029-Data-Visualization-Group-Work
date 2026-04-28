import { useMemo, useState, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
         ScatterChart, Scatter, ZAxis, CartesianGrid, ReferenceArea, ReferenceLine,
         AreaChart, Area, Legend } from 'recharts';
import './Page2FrictionCharts.css';

const TT_STYLE = { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 };

const POI_RADAR_INFO =
  'Each axis = that category’s share of the citywide total (eight summed category counts on the H3 grid). '
  + 'Only a few spokes look long because food, retail, and service dominate the aggregate — scenic/leisure/medical '
  + 'are small slices of the same 100%. The outer ring is scaled to the largest slice so side-by-side contrasts '
  + 'stay faithful; use the tooltip for exact percentages.';

const DEMAND_DIST_INFO =
  'Histogram of fused demand index (takeout_demand_index) for H3 hexagons with index > 0. Bars are 0.05-wide bins '
  + 'on the index scale; bar height = count of hexagons in that bin. Per-hex index: 50% min–max normalized real '
  + 'orders + 30% population + 20% residential (see convert_all_to_h3.py). On the map, Demand mode '
  + 'also multiplies hex colour by a time-of-day weight from the Meituan hourly profile.';

const GROUND_AIR_INFO =
  'Each point is one origin–destination pair: horizontal axis = straight-line (bee-line) distance in km; '
  + 'vertical axis = ground routing distance in km (road network shortest path). Points above the dashed y = x line '
  + 'mean the ground trip is longer than the direct span — i.e. detour from barriers, grid layout, and one-way rules. '
  + 'The vertical gap to that line is extra ground kilometrage; flying a similar straight path is one way to read '
  + 'potential distance savings for drones (airspace and climb not modeled). Subsampled OD pairs for clarity.';

const REAL_ORDERS_SCATTER_INFO =
  'Each point is one H3 hexagon. Axes: population (horizontal) vs real order count in that hex (vertical). '
  + 'Only cells with at least one RL-Dispatch order are shown.';

function buildBins(values, binWidth) {
  const bins = {};
  values.forEach(v => {
    const key = (Math.floor(v / binWidth) * binWidth).toFixed(1);
    bins[key] = (bins[key] || 0) + 1;
  });
  return Object.entries(bins)
    .map(([k, v]) => ({ range: k, count: v }))
    .sort((a, b) => parseFloat(a.range) - parseFloat(b.range));
}

export default function Page2FrictionCharts({
  activeMode, hoveredHex, h3Demand, h3Gap, h3Takeout, odAnalysis, liveMetrics, onHighlight,
  timeWeight = 1,
}) {
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

  const barrierCrossings = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const n = odAnalysis.length;
    const avg = (key) => +(odAnalysis.reduce((s, d) => s + (d[key] || 0), 0) / n).toFixed(2);
    return [
      { type: 'Water', avg: avg('n_water_crossings'), color: '#4688dc' },
      { type: 'Waterway', avg: avg('n_waterway_crossings'), color: '#64a0f0' },
      { type: 'Railway', avg: avg('n_railway_crossings'), color: '#aaa' },
      { type: 'Highway', avg: avg('n_highway_major_crossings'), color: '#dc3c3c' },
    ];
  }, [odAnalysis]);

  const barrierCrossingMax = useMemo(() => {
    if (!barrierCrossings?.length) return 0.01;
    return Math.max(...barrierCrossings.map(b => b.avg), 0.01);
  }, [barrierCrossings]);

  const distCompare = useMemo(() => {
    if (!odAnalysis?.length) return [];
    return odAnalysis.filter((_, i) => i % 6 === 0).map((d, i) => ({
      idx: i,
      ground: +((d.net_m || 0) / 1000).toFixed(1),
      air: +((d.fly_m || 0) / 1000).toFixed(1),
    }));
  }, [odAnalysis]);

  const frictionComposition = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const avg = (key) => {
      const vals = odAnalysis.map(d => d[key]).filter(v => v != null && v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    return [
      { axis: 'Detour', value: +avg('detour_norm').toFixed(3) },
      { axis: 'Barrier', value: +avg('barrier_norm').toFixed(3) },
      { axis: 'Bridge dep.', value: +avg('bridge_score').toFixed(3) },
      { axis: 'Tunnel dep.', value: +avg('tunnel_score').toFixed(3) },
      { axis: 'Congestion', value: +avg('congestion_norm').toFixed(3) },
    ];
  }, [odAnalysis]);

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

  const topHexagons = useMemo(() => {
    if (!h3Gap?.length) return [];
    const POI_KEYS = [
      { key: 'food_count', label: 'Food', color: '#ff8c00' },
      { key: 'retail_count', label: 'Retail', color: '#ff3264' },
      { key: 'education_count', label: 'Edu', color: '#00e896' },
      { key: 'medical_count', label: 'Med', color: '#ffa028' },
      { key: 'scenic_count', label: 'Scenic', color: '#c864ff' },
      { key: 'office_count', label: 'Office', color: '#6c8cff' },
    ];
    return [...h3Gap]
      .sort((a, b) => (b.demand_pressure || 0) - (a.demand_pressure || 0))
      .slice(0, 10)
      .map((d, i) => {
        const pois = POI_KEYS
          .map(p => ({ ...p, count: d[p.key] || 0 }))
          .filter(p => p.count > 0)
          .sort((a, b) => b.count - a.count);
        const maxPoi = pois.length > 0 ? pois[0].count : 1;
        return {
          rank: i + 1,
          h3: d.h3,
          dp: d.demand_pressure || 0,
          pois,
          maxPoi,
        };
      });
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

  const [selectedHex, setSelectedHex] = useState(null);
  const [poiSupplyInfoOpen, setPoiSupplyInfoOpen] = useState(false);
  const [demandDistInfoOpen, setDemandDistInfoOpen] = useState(false);
  const [groundAirInfoOpen, setGroundAirInfoOpen] = useState(false);
  const [ordersScatterInfoOpen, setOrdersScatterInfoOpen] = useState(false);
  const poiSupplyInfoRef = useRef(null);
  const demandDistInfoRef = useRef(null);
  const groundAirInfoRef = useRef(null);
  const ordersScatterInfoRef = useRef(null);

  useEffect(() => {
    if (activeMode !== 'supply') setPoiSupplyInfoOpen(false);
    if (activeMode !== 'demand') {
      setDemandDistInfoOpen(false);
      setOrdersScatterInfoOpen(false);
    }
    if (activeMode !== 'friction') setGroundAirInfoOpen(false);
  }, [activeMode]);

  useEffect(() => {
    if (!poiSupplyInfoOpen && !demandDistInfoOpen && !groundAirInfoOpen && !ordersScatterInfoOpen) return;
    const onDoc = (e) => {
      if (poiSupplyInfoOpen && !poiSupplyInfoRef.current?.contains(e.target)) setPoiSupplyInfoOpen(false);
      if (demandDistInfoOpen && !demandDistInfoRef.current?.contains(e.target)) setDemandDistInfoOpen(false);
      if (groundAirInfoOpen && !groundAirInfoRef.current?.contains(e.target)) setGroundAirInfoOpen(false);
      if (ordersScatterInfoOpen && !ordersScatterInfoRef.current?.contains(e.target)) setOrdersScatterInfoOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [poiSupplyInfoOpen, demandDistInfoOpen, groundAirInfoOpen, ordersScatterInfoOpen]);

  const takeoutBins = useMemo(() => {
    if (!h3Takeout?.length) return [];
    const vals = h3Takeout.map(d => d.takeout_demand_index || 0).filter(v => v > 0);
    return buildBins(vals, 0.05);
  }, [h3Takeout]);

  const topTakeout = useMemo(() => {
    if (!h3Takeout?.length) return [];
    return [...h3Takeout]
      .sort((a, b) => (b.takeout_demand_index || 0) - (a.takeout_demand_index || 0))
      .slice(0, 8)
      .map((d, i) => ({
        rank: i + 1,
        h3: d.h3,
        tdi: +(d.takeout_demand_index || 0).toFixed(3),
        orders: d.real_order_count || 0,
        pop: d.pop_count || 0,
        food: d.food_count || 0,
        access: d.food_access_2km || 0,
      }));
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
    if (!h3Demand?.length) return [];
    const gapMap = new Map((h3Gap || []).map(g => [g.h3, g]));
    const takeoutMap = new Map((h3Takeout || []).map(t => [t.h3, t]));
    const rows = [];
    for (const d of h3Demand) {
      const g = gapMap.get(d.h3);
      const tk = takeoutMap.get(d.h3);
      const fr = g?.avg_friction ?? 0;
      if (!(fr > 0)) continue;
      const tdi = tk?.takeout_demand_index ?? 0;
      const dv = Math.min(tdi, 1) * timeWeight;
      const fv = Math.min(fr, 1);
      const score = dv * fv;
      if (score <= 0) continue;
      rows.push({ h3: d.h3, score });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [h3Demand, h3Gap, h3Takeout, timeWeight]);

  const congestionBins = useMemo(() => {
    if (!odAnalysis?.length) return [];
    const vals = odAnalysis.map(d => d.congestion_amplifier).filter(v => v != null && v > 0);
    return buildBins(vals, 0.2);
  }, [odAnalysis]);

  const freeVsPeak = useMemo(() => {
    if (!odAnalysis?.length) return [];
    return odAnalysis.filter((_, i) => i % 4 === 0).map(d => ({
      free: +((d.tt_free_s || 0) / 60).toFixed(1),
      peak: +((d.tt_peak_s || 0) / 60).toFixed(1),
    }));
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

  const foodAccessData = useMemo(() => {
    if (hoveredHex && (hoveredHex.food_access_1km > 0 || hoveredHex.food_access_2km > 0 || hoveredHex.food_access_3km > 0)) {
      return {
        isHex: true,
        data: [
          { radius: '1 km', count: hoveredHex.food_access_1km || 0, avg: foodAccessCity?.[0]?.count || 0 },
          { radius: '2 km', count: hoveredHex.food_access_2km || 0, avg: foodAccessCity?.[1]?.count || 0 },
          { radius: '3 km', count: hoveredHex.food_access_3km || 0, avg: foodAccessCity?.[2]?.count || 0 },
        ],
      };
    }
    if (!foodAccessCity) return null;
    return { isHex: false, data: foodAccessCity };
  }, [hoveredHex, foodAccessCity]);

  const isSupply = activeMode === 'supply';
  const isFriction = activeMode === 'friction';
  const isPriority = activeMode === 'priority';
  const isDemand = activeMode === 'demand';

  return (
    <div className="p2c">
      {/* Key metrics — OD-level friction stats; Friction only */}
      {isFriction && (
        <div className="p2c-metrics">
          <div className="p2c-metric">
            <div className="m-value" style={{ color: '#ff8c00' }}>{liveMetrics?.avgDetour ?? '—'}</div>
            <div className="m-label">Avg detour ratio</div>
          </div>
          <div className="p2c-metric">
            <div className="m-value" style={{ color: '#ff3264' }}>{liveMetrics?.peakCong ? `${liveMetrics.peakCong}×` : '—'}</div>
            <div className="m-label">Peak congestion</div>
          </div>
          <div className="p2c-metric">
            <div className="m-value" style={{ color: '#c864ff' }}>{liveMetrics?.waterPct ? `${liveMetrics.waterPct}%` : '—'}</div>
            <div className="m-label">ODs cross water</div>
          </div>
        </div>
      )}

      {/* Supply mode: POI ranking */}
      {isSupply && poiRadar.length > 0 && (
        <div className="p2c-section">
          <div className="p2c-section-head" ref={poiSupplyInfoRef}>
            <h4>POI Supply Contribution</h4>
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
              <PolarGrid stroke="rgba(90, 50, 110, 0.15)" />
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

      {/* Supply mode: Top 10 hexagons */}
      {isSupply && topHexagons.length > 0 && (
        <div className="p2c-section">
          <h4>Top 10 Supply Hexagons <span className="p2c-click-hint">click for detail</span></h4>
          <div className="p2c-hex-rank">
            {topHexagons.map(hex => {
              const barW = (hex.dp / topHexagons[0].dp) * 100;
              return (
                <div
                  key={hex.h3}
                  className={`p2c-hr-row ${selectedHex?.h3 === hex.h3 ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedHex(selectedHex?.h3 === hex.h3 ? null : hex);
                    const target = hex.h3;
                    onHighlight?.((d) => d.h3 === target);
                  }}
                >
                  <span className="p2c-hr-rank">#{hex.rank}</span>
                  <div className="p2c-hr-body">
                    <div className="p2c-hr-bar-wrap">
                      <div className="p2c-hr-bar" style={{ width: `${barW}%` }} />
                      <span className="p2c-hr-dp">{hex.dp.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail popup */}
          {selectedHex && (
            <div className="p2c-hex-detail">
              <div className="p2c-hd-header">
                <span className="p2c-hd-rank">#{selectedHex.rank}</span>
                <span className="p2c-hd-dp">Supply Pressure: <strong>{selectedHex.dp.toFixed(2)}</strong></span>
                <button className="p2c-hd-close" onClick={() => { setSelectedHex(null); onHighlight?.(null); }}>×</button>
              </div>
              <div className="p2c-hd-top-pois">
                Top POI: {selectedHex.pois.slice(0, 2).map((p, i) => (
                  <span key={p.key} style={{ color: p.color, fontWeight: 600 }}>
                    {i > 0 && ', '}{p.label} ({p.count})
                  </span>
                ))}
              </div>
              <div className="p2c-hd-id">H3: {selectedHex.h3}</div>
            </div>
          )}
        </div>
      )}

      {/* Supply mode: Food Accessibility */}
      {isSupply && foodAccessData && (
        <div className="p2c-section">
          <h4>
            Food Accessibility
            {foodAccessData.isHex
              ? <span className="p2c-fa-badge">Hovered Hex</span>
              : <span className="p2c-fa-badge p2c-fa-badge--avg">City Avg</span>
            }
          </h4>
          <div className="p2c-food-access">
            {foodAccessData.data.map((d, i) => {
              const colors = ['#ff4500', '#ff8c00', '#ffc040'];
              const allVals = foodAccessData.data.map(x => x.count);
              if (foodAccessData.isHex) allVals.push(...foodAccessData.data.map(x => x.avg));
              const maxVal = Math.max(...allVals, 1);
              return (
                <div key={d.radius} className="p2c-fa-row-group">
                  <div className="p2c-fa-row">
                    <span className="p2c-fa-label" style={{ color: colors[i] }}>{d.radius}</span>
                    <div className="p2c-fa-track">
                      <div className="p2c-fa-fill" style={{ width: `${(d.count / maxVal) * 100}%`, background: colors[i] }} />
                    </div>
                    <span className="p2c-fa-val">{d.count}</span>
                  </div>
                  {foodAccessData.isHex && (
                    <div className="p2c-fa-row p2c-fa-row--avg">
                      <span className="p2c-fa-label" style={{ color: '#b0a0b8', fontSize: '0.6rem' }}>avg</span>
                      <div className="p2c-fa-track">
                        <div className="p2c-fa-fill p2c-fa-fill--avg" style={{ width: `${(d.avg / maxVal) * 100}%` }} />
                      </div>
                      <span className="p2c-fa-val" style={{ color: '#b0a0b8' }}>{d.avg}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="p2c-note">
            {foodAccessData.isHex
              ? 'This hex vs city average. Hover other hexagons to compare.'
              : 'Hover a hexagon on the map to see its food accessibility.'}
          </p>
        </div>
      )}

      {/* Priority: supply vs friction scatter */}
      {isPriority && scatterData.length > 0 && (
        <div className="p2c-section">
          <h4>Supply vs Friction (per hex) <span className="p2c-click-hint">click to highlight</span></h4>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis dataKey="demand" type="number" name="Supply"
                tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                label={{ value: 'Supply', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis dataKey="friction" type="number" name="Friction"
                tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
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
          <p className="p2c-note">Top-right = high supply + high friction. Click a point to highlight its hex on the map.</p>
        </div>
      )}

      {isPriority && topPriorityHexagons.length > 0 && (
        <div className="p2c-section">
          <h4>Top 10 Priority (D×F) <span className="p2c-click-hint">click to highlight</span></h4>
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
          {frictionComposition && (
            <div className="p2c-section">
              <h4>Friction Composition</h4>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={frictionComposition} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="rgba(90, 50, 110, 0.15)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#888', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
                  <Radar dataKey="value" stroke="#c864ff" fill="#c864ff" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {barrierCrossings && (
            <div className="p2c-section">
              <h4>Avg crossings / trip</h4>
              <div className="p2c-crossing-lanes">
                {barrierCrossings.map(b => (
                  <div key={b.type} className="p2c-crossing-lane">
                    <span className="p2c-crossing-name" style={{ color: b.color }}>{b.type}</span>
                    <div className="p2c-crossing-track">
                      <div
                        className="p2c-crossing-fill"
                        style={{
                          width: `${Math.min(100, (b.avg / barrierCrossingMax) * 100)}%`,
                          background: b.color,
                        }}
                      />
                    </div>
                    <span className="p2c-crossing-num">{b.avg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {congestionBins.length > 0 && (
            <div className="p2c-section">
              <h4>Congestion Amplifier</h4>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={congestionBins} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="range" tick={{ fill: '#9888a8', fontSize: 9 }}
                    label={{ value: 'Peak / Free-flow', position: 'bottom', fill: '#555', fontSize: 9, offset: -2 }} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v) => [v, 'OD pairs']}
                    labelFormatter={(l) => `${l}×`}
                  />
                  <ReferenceLine x="1.0" stroke="#00e896" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Bar dataKey="count" fill="#ff3264" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="p2c-note">Peak-hour travel time vs free-flow. Higher = more congestion impact.</p>
            </div>
          )}

          {freeVsPeak.length > 0 && (
            <div className="p2c-section">
              <h4>Free-flow vs Peak Time (min)</h4>
              <ResponsiveContainer width="100%" height={160}>
                <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
                  <XAxis dataKey="free" type="number" name="Free-flow"
                    tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                    label={{ value: 'Free-flow (min)', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
                  />
                  <YAxis dataKey="peak" type="number" name="Peak"
                    tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                    label={{ value: 'Peak (min)', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
                  />
                  <ZAxis range={[8, 8]} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v, name) => [`${v} min`, name]} />
                  <Scatter data={freeVsPeak} fill="#ff8c00" fillOpacity={0.4} r={2} />
                  <ReferenceLine
                    segment={[{ x: 0, y: 0 }, { x: Math.max(...freeVsPeak.map(d => d.free)), y: Math.max(...freeVsPeak.map(d => d.free)) }]}
                    stroke="#444" strokeDasharray="4 4"
                    label={{ value: 'y = x', fill: '#555', fontSize: 8, position: 'insideTopLeft' }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="p2c-note">Points above the diagonal: peak congestion adds extra travel time.</p>
            </div>
          )}
        </>
      )}

      {/* Demand mode charts */}
      {isDemand && (
        <>
          {orderVsProxy.length > 0 && (
            <div className="p2c-section">
              <div className="p2c-section-head" ref={ordersScatterInfoRef}>
                <h4>Real Orders vs Population</h4>
                <div className="p2c-head-actions">
                  <button
                    type="button"
                    className="p2c-info-icon"
                    aria-label="About this chart"
                    aria-expanded={ordersScatterInfoOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrdersScatterInfoOpen((o) => !o);
                    }}
                  >
                    i
                  </button>
                  {ordersScatterInfoOpen && (
                    <div className="p2c-info-popover" role="tooltip">
                      <strong>{orderVsProxy.length.toLocaleString()} hexagons</strong>
                      {' '}with real delivery orders (RL-Dispatch). {REAL_ORDERS_SCATTER_INFO}
                    </div>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
                  <XAxis dataKey="pop" type="number" name="Population"
                    tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                    label={{ value: 'Population', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
                  />
                  <YAxis dataKey="orders" type="number" name="Orders"
                    tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                    label={{ value: 'Real Orders', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
                  />
                  <ZAxis range={[8, 8]} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString() : v, name]} />
                  <Scatter data={orderVsProxy} fill="#ff4500" fillOpacity={0.4} r={2.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {takeoutBins.length > 0 && (
            <div className="p2c-section">
              <div className="p2c-section-head" ref={demandDistInfoRef}>
                <h4>Demand Distribution</h4>
                <div className="p2c-head-actions">
                  <button
                    type="button"
                    className="p2c-info-icon"
                    aria-label="About this chart"
                    aria-expanded={demandDistInfoOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDemandDistInfoOpen((o) => !o);
                    }}
                  >
                    i
                  </button>
                  {demandDistInfoOpen && (
                    <div className="p2c-info-popover" role="tooltip">
                      {DEMAND_DIST_INFO}
                    </div>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={takeoutBins} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="range" tick={{ fill: '#9888a8', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v) => [v, 'Hexagons']}
                    labelFormatter={(l) => `Index ${l}`}
                  />
                  <Bar dataKey="count" fill="#ff4500" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {topTakeout.length > 0 && (
            <div className="p2c-section">
              <h4>Top Demand Hexagons</h4>
              <div className="p2c-hex-rank">
                {topTakeout.map(hex => {
                  const barW = (hex.tdi / topTakeout[0].tdi) * 100;
                  return (
                    <div
                      key={hex.h3}
                      className="p2c-hr-row"
                      onClick={() => {
                        const target = hex.h3;
                        onHighlight?.((d) => d.h3 === target);
                      }}
                    >
                      <span className="p2c-hr-rank">#{hex.rank}</span>
                      <div className="p2c-hr-body">
                        <div className="p2c-hr-bar-wrap">
                          <div className="p2c-hr-bar" style={{ width: `${barW}%`, background: '#ff4500' }} />
                          <span className="p2c-hr-dp">{hex.tdi}</span>
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#777' }}>
                          {hex.orders > 0 ? `${hex.orders.toLocaleString()} orders · ` : ''}pop {hex.pop.toFixed(0)} · food {hex.food}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Ground vs Air — OD sample; Friction only */}
      {distCompare.length > 0 && isFriction && (
        <div className="p2c-section">
          <div className="p2c-section-head" ref={groundAirInfoRef}>
            <h4>Ground vs Air Distance (km)</h4>
            <div className="p2c-head-actions">
              <button
                type="button"
                className="p2c-info-icon"
                aria-label="About this chart"
                aria-expanded={groundAirInfoOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setGroundAirInfoOpen((o) => !o);
                }}
              >
                i
              </button>
              {groundAirInfoOpen && (
                <div className="p2c-info-popover" role="tooltip">
                  {GROUND_AIR_INFO}
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis dataKey="air" type="number" name="Air (km)"
                tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                label={{ value: 'Straight-line (km)', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis dataKey="ground" type="number" name="Ground (km)"
                tick={{ fill: '#9888a8', fontSize: 9 }} axisLine={{ stroke: 'rgba(90, 50, 110, 0.15)' }}
                label={{ value: 'Ground (km)', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
              />
              <ZAxis range={[10, 10]} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v, name) => [`${v} km`, name]} />
              <Scatter data={distCompare} fill="#64c8ff" fillOpacity={0.45} r={2.5} />
              <ReferenceArea
                x1={0} x2={Math.max(...distCompare.map(d => d.air))}
                y1={0} y2={Math.max(...distCompare.map(d => d.air))}
                fill="transparent" stroke="#444" strokeDasharray="4 4"
                label={{ value: 'y = x', fill: '#555', fontSize: 8, position: 'insideTopLeft' }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
         ScatterChart, Scatter, ZAxis, CartesianGrid, ReferenceArea } from 'recharts';
import './Page2FrictionCharts.css';

const TT_STYLE = { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 };

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
  activeMode, hoveredHex, h3Gap, odAnalysis, liveMetrics, onHighlight
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

  const detourBins = useMemo(() => {
    if (!odAnalysis?.length) return [];
    return buildBins(odAnalysis.map(d => d.detour_ratio).filter(Boolean), 0.1);
  }, [odAnalysis]);

  const detourStats = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const ratios = odAnalysis.map(d => d.detour_ratio).filter(Boolean).sort((a, b) => a - b);
    const n = ratios.length;
    return {
      median: ratios[Math.floor(n / 2)]?.toFixed(2),
      p90: ratios[Math.floor(n * 0.9)]?.toFixed(2),
      max: ratios[n - 1]?.toFixed(2),
    };
  }, [odAnalysis]);

  const congestionBins = useMemo(() => {
    if (!odAnalysis?.length) return [];
    return buildBins(odAnalysis.map(d => d.congestion_amplifier).filter(Boolean), 0.1);
  }, [odAnalysis]);

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

  const distCompare = useMemo(() => {
    if (!odAnalysis?.length) return [];
    return odAnalysis.filter((_, i) => i % 6 === 0).map((d, i) => ({
      idx: i,
      ground: +((d.net_m || 0) / 1000).toFixed(1),
      air: +((d.fly_m || 0) / 1000).toFixed(1),
    }));
  }, [odAnalysis]);

  const barrierRates = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const n = odAnalysis.length;
    const pct = (key) => +((odAnalysis.filter(d => d[key]).length / n) * 100).toFixed(1);
    return [
      { name: 'Water', rate: pct('crosses_water'), color: '#4688dc' },
      { name: 'Waterway', rate: pct('crosses_waterway'), color: '#64a0f0' },
      { name: 'Railway', rate: pct('crosses_railway'), color: '#aaa' },
      { name: 'Highway', rate: pct('crosses_highway_major'), color: '#dc3c3c' },
    ];
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

  const featureImportance = useMemo(() => {
    if (!odAnalysis?.length) return null;
    const fields = [
      { key: 'detour_norm', name: 'Detour ratio', color: '#ff8c00' },
      { key: 'barrier_norm', name: 'Barrier cross.', color: '#4688dc' },
      { key: 'congestion_norm', name: 'Congestion', color: '#ff3264' },
      { key: 'bridge_score', name: 'Bridge dep.', color: '#aaa' },
      { key: 'tunnel_score', name: 'Tunnel dep.', color: '#888' },
    ];
    const frictions = odAnalysis.map(d => d.ground_friction || 0);
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const fMean = mean(frictions);
    const fVar = mean(frictions.map(v => (v - fMean) ** 2));
    if (fVar === 0) return null;

    const corrs = fields.map(f => {
      const vals = odAnalysis.map(d => d[f.key] || 0);
      const vMean = mean(vals);
      const cov = mean(vals.map((v, i) => (v - vMean) * (frictions[i] - fMean)));
      const vStd = Math.sqrt(mean(vals.map(v => (v - vMean) ** 2)));
      const r = vStd > 0 ? Math.abs(cov / (vStd * Math.sqrt(fVar))) : 0;
      return { ...f, imp: +r.toFixed(3) };
    });

    const total = corrs.reduce((s, c) => s + c.imp, 0) || 1;
    return corrs.map(c => ({ ...c, imp: +(c.imp / total).toFixed(3) }));
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

  const handleDetourBinClick = (data) => {
    if (!data?.range) return;
    const lo = parseFloat(data.range);
    const hi = lo + 0.1;
    onHighlight?.((hex) => {
      const fr = hex.avg_friction || 0;
      if (fr >= (lo - 1) * 0.15 && fr < hi * 0.15) return true;
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

  const [selectedHex, setSelectedHex] = useState(null);

  const isDemand = activeMode === 'demand';
  const isFriction = activeMode === 'friction';
  const isOverlap = activeMode === 'overlap';

  return (
    <div className="p2c">
      {/* Key metrics — live from data */}
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

      {/* Demand mode: POI ranking */}
      {isDemand && poiRanking.length > 0 && (
        <div className="p2c-section">
          <h4>POI Demand Contribution</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={poiRanking} layout="vertical" margin={{ left: 80, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: '#555', fontSize: 9 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 10 }} width={75} />
              <Tooltip
                contentStyle={TT_STYLE}
                formatter={(v) => [v.toLocaleString(), 'Total POIs']}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {poiRanking.map((c, i) => <Cell key={i} fill={c.color} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="p2c-note">
            Which POI category drives the most delivery demand across Shenzhen?
          </p>
        </div>
      )}

      {/* Demand mode: Top 10 hexagons */}
      {isDemand && topHexagons.length > 0 && (
        <div className="p2c-section">
          <h4>Top 10 Demand Hexagons <span className="p2c-click-hint">click for detail</span></h4>
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
                <span className="p2c-hd-dp">Demand Pressure: <strong>{selectedHex.dp.toFixed(2)}</strong></span>
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

      {/* Demand + Overlap: scatter */}
      {(isDemand || isOverlap) && scatterData.length > 0 && (
        <div className="p2c-section">
          <h4>Demand vs Friction (per hex) <span className="p2c-click-hint">click to highlight</span></h4>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis dataKey="demand" type="number" name="Demand"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
                label={{ value: 'Demand', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis dataKey="friction" type="number" name="Friction"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
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
          <p className="p2c-note">Top-right = high demand + high friction. Click a point to highlight its hex on the map.</p>
        </div>
      )}

      {/* Friction mode charts */}
      {(isFriction || isOverlap) && (
        <>
          {barrierRates && (
            <div className="p2c-section">
              <h4>Barrier Crossing Rate (%)</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barrierRates} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#555', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#aaa' }} />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {barrierRates.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {frictionComposition && (
            <div className="p2c-section">
              <h4>Friction Composition</h4>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={frictionComposition} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#2a2a4a" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#888', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
                  <Radar dataKey="value" stroke="#c864ff" fill="#c864ff" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {featureImportance && (
            <div className="p2c-section">
              <h4>Feature Importance</h4>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={featureImportance} layout="vertical" margin={{ left: 85, right: 10, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 'auto']} tick={{ fill: '#555', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="imp" radius={[0, 4, 4, 0]} name="Importance">
                    {featureImportance.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {detourBins.length > 0 && (
            <div className="p2c-section">
              <h4>Detour Ratio Distribution <span className="p2c-click-hint">click bin to highlight</span></h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={detourBins} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
                  onClick={(e) => e?.activePayload?.[0] && handleDetourBinClick(e.activePayload[0].payload)}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis dataKey="range" tick={{ fill: '#666', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v) => [v, 'OD pairs']}
                    labelFormatter={(l) => `Detour ${l}×–${(parseFloat(l) + 0.1).toFixed(1)}×`}
                  />
                  <Bar dataKey="count" fill="#ff3264" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {detourStats && (
                <div className="p2c-detour-stats">
                  <span>Median <strong>{detourStats.median}×</strong></span>
                  <span>P90 <strong>{detourStats.p90}×</strong></span>
                  <span>Max <strong>{detourStats.max}×</strong></span>
                </div>
              )}
            </div>
          )}

          {congestionBins.length > 0 && (
            <div className="p2c-section">
              <h4>Congestion Amplifier Distribution</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={congestionBins} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="range" tick={{ fill: '#666', fontSize: 9 }}
                    label={{ value: 'Peak / Free-flow', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
                  />
                  <YAxis tick={{ fill: '#555', fontSize: 9 }} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v) => [v, 'OD pairs']}
                    labelFormatter={(l) => `${l}×–${(parseFloat(l) + 0.1).toFixed(1)}× slowdown`}
                  />
                  <Bar dataKey="count" fill="#ffa028" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {barrierCrossings && (
            <div className="p2c-section">
              <h4>Avg Barrier Crossings per Trip</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barrierCrossings} layout="vertical" margin={{ left: 65, right: 10, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} />
                  <YAxis type="category" dataKey="type" tick={{ fill: '#999', fontSize: 11 }} width={62} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v) => [v, 'avg crossings']} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {barrierCrossings.map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.8} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="p2c-note">
                Each delivery crosses ~{barrierCrossings.reduce((s, b) => s + b.avg, 0).toFixed(1)} barriers on average.
              </p>
            </div>
          )}
        </>
      )}

      {/* Ground vs Air — shown in all modes */}
      {distCompare.length > 0 && (
        <div className="p2c-section">
          <h4>Ground vs Air Distance (km)</h4>
          <ResponsiveContainer width="100%" height={160}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis dataKey="air" type="number" name="Air (km)"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
                label={{ value: 'Straight-line (km)', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis dataKey="ground" type="number" name="Ground (km)"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
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
          <p className="p2c-note">Points above y=x = ground detour. Gap = distance drones save.</p>
        </div>
      )}
    </div>
  );
}

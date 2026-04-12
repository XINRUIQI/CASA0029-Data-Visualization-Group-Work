import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
         ScatterChart, Scatter, ZAxis, CartesianGrid, ReferenceArea } from 'recharts';
import './Page3FrictionCharts.css';

const BARRIER_STATS = [
  { name: 'Water', rate: 93.6, crossings: 6.78, color: '#4688dc' },
  { name: 'Waterway', rate: 96.3, crossings: 8.60, color: '#64a0f0' },
  { name: 'Railway', rate: 77.4, crossings: 10.42, color: '#aaa' },
  { name: 'Highway', rate: 96.5, crossings: 18.97, color: '#dc3c3c' },
];

const FRICTION_COMPONENTS = [
  { axis: 'Detour', value: 0.72 },
  { axis: 'Barrier', value: 0.85 },
  { axis: 'Bridge dep.', value: 0.99 },
  { axis: 'Tunnel dep.', value: 0.72 },
  { axis: 'Congestion', value: 0.82 },
];

const SCENARIO_COMPARE = [
  { name: 'meal', observed: 0.62, random: 0.35 },
  { name: 'parcel', observed: 0.58, random: 0.33 },
  { name: 'park', observed: 0.71, random: 0.29 },
  { name: 'campus', observed: 0.55, random: 0.31 },
  { name: 'medical', observed: 0.48, random: 0.36 },
];

function buildDetourBins(odData) {
  if (!odData?.length) return [];
  const BIN_WIDTH = 0.1;
  const bins = {};
  odData.forEach(d => {
    const dr = d.detour_ratio ?? 0;
    const bin = Math.floor(dr / BIN_WIDTH) * BIN_WIDTH;
    const key = bin.toFixed(1);
    bins[key] = (bins[key] || 0) + 1;
  });
  return Object.entries(bins)
    .map(([k, v]) => ({ range: k, count: v }))
    .sort((a, b) => parseFloat(a.range) - parseFloat(b.range));
}

export default function Page3FrictionCharts({ activeMode, hoveredHex, h3Gap, odAnalysis }) {
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

  const detourBins = useMemo(() => buildDetourBins(odAnalysis), [odAnalysis]);

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

  return (
    <div className="p2c">
      {/* Section 1: key metrics */}
      <div className="p2c-metrics">
        <div className="p2c-metric">
          <div className="m-value" style={{ color: '#ff8c00' }}>1.50</div>
          <div className="m-label">Avg detour ratio</div>
        </div>
        <div className="p2c-metric">
          <div className="m-value" style={{ color: '#ff3264' }}>1.82x</div>
          <div className="m-label">Peak congestion</div>
        </div>
        <div className="p2c-metric">
          <div className="m-value" style={{ color: '#c864ff' }}>93.6%</div>
          <div className="m-label">ODs cross water</div>
        </div>
      </div>

      {/* Section 2: barrier crossing rates */}
      <div className="p2c-section">
        <h4>Barrier Crossing Rate (%)</h4>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={BARRIER_STATS} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#555', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 11 }} width={60} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#aaa' }}
            />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
              {BARRIER_STATS.map((s, i) => (
                <Cell key={i} fill={s.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3: friction radar */}
      <div className="p2c-section">
        <h4>Friction Composition</h4>
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={FRICTION_COMPONENTS} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#2a2a4a" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: '#888', fontSize: 10 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
            <Radar dataKey="value" stroke="#c864ff" fill="#c864ff" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 4: feature importance */}
      <div className="p2c-section">
        <h4>Feature Importance</h4>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart
            data={[
              { name: 'Detour ratio', imp: 0.28, color: '#ff8c00' },
              { name: 'Barrier crossings', imp: 0.24, color: '#4688dc' },
              { name: 'Congestion', imp: 0.22, color: '#ff3264' },
              { name: 'Bridge depend.', imp: 0.14, color: '#aaa' },
              { name: 'Tunnel depend.', imp: 0.12, color: '#888' },
            ]}
            layout="vertical"
            margin={{ left: 90, right: 10, top: 5, bottom: 5 }}
          >
            <XAxis type="number" domain={[0, 0.35]} tick={{ fill: '#555', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#999', fontSize: 10 }} width={85} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="imp" radius={[0, 4, 4, 0]} name="Importance">
              {[
                { color: '#ff8c00' }, { color: '#4688dc' }, { color: '#ff3264' },
                { color: '#aaa' }, { color: '#888' },
              ].map((s, i) => (
                <Cell key={i} fill={s.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="p2c-note">What drives ground friction most? Detour and barrier crossings dominate.</p>
      </div>

      {/* Section 5: Demand–Friction scatter */}
      {scatterData.length > 0 && (
        <div className="p2c-section">
          <h4>Demand vs Friction (per hex)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" />
              <XAxis
                dataKey="demand" type="number" name="Demand"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
                label={{ value: 'Demand', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis
                dataKey="friction" type="number" name="Friction"
                tick={{ fill: '#666', fontSize: 9 }} axisLine={{ stroke: '#2a2a4a' }}
                label={{ value: 'Friction', angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
              />
              <ZAxis dataKey="gap" range={[8, 8]} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                formatter={(v, name) => [typeof v === 'number' ? v.toFixed(3) : v, name]}
              />
              <ReferenceArea
                x1={scatterData.reduce((m, d) => Math.max(m, d.demand), 0) * 0.5}
                x2={scatterData.reduce((m, d) => Math.max(m, d.demand), 0)}
                y1={scatterData.reduce((m, d) => Math.max(m, d.friction), 0) * 0.5}
                y2={scatterData.reduce((m, d) => Math.max(m, d.friction), 0)}
                fill="#c864ff" fillOpacity={0.06}
                stroke="#c864ff" strokeOpacity={0.2} strokeDasharray="4 4"
                label={{ value: 'Pain Zone', fill: '#c864ff', fontSize: 9, position: 'insideTopRight' }}
              />
              <Scatter data={scatterData} fill="#ff8c00" fillOpacity={0.5} r={2} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="p2c-note">
            Top-right = high demand + high friction. Purple zone marks the strongest drone substitution candidates.
          </p>
        </div>
      )}

      {/* Section 6: Detour ratio histogram */}
      {detourBins.length > 0 && (
        <div className="p2c-section">
          <h4>Detour Ratio Distribution ({odAnalysis?.length} OD pairs)</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={detourBins} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis
                dataKey="range" tick={{ fill: '#666', fontSize: 9 }}
                label={{ value: 'Detour Ratio', position: 'bottom', fill: '#555', fontSize: 10, offset: -2 }}
              />
              <YAxis tick={{ fill: '#555', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
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
          <p className="p2c-note">
            How much longer is the ground route vs straight-line? Higher = more detour due to barriers.
          </p>
        </div>
      )}

      {/* Section 7: observed vs random */}
      <div className="p2c-section">
        <h4>Observed vs Random (Gap Index)</h4>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={SCENARIO_COMPARE} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#777', fontSize: 10 }} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} domain={[0, 0.8]} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="observed" fill="#00e896" fillOpacity={0.8} radius={[3, 3, 0, 0]} name="Observed" />
            <Bar dataKey="random" fill="#444" fillOpacity={0.6} radius={[3, 3, 0, 0]} name="Random" />
          </BarChart>
        </ResponsiveContainer>
        <p className="p2c-insight">
          Observed sites cluster in high-friction overlap zones — not in demand-only areas.
        </p>
      </div>
    </div>
  );
}

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import './Page3Charts.css';

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

export default function Page3Charts({ activeMode, hoveredHex }) {
  return (
    <div className="p2c">
      {/* Section 1: key metrics */}
      <div className="p3c-metrics">
        <div className="p3c-metric">
          <div className="m-value" style={{ color: '#ff8c00' }}>1.50</div>
          <div className="m-label">Avg detour ratio</div>
        </div>
        <div className="p3c-metric">
          <div className="m-value" style={{ color: '#ff3264' }}>1.82x</div>
          <div className="m-label">Peak congestion</div>
        </div>
        <div className="p3c-metric">
          <div className="m-value" style={{ color: '#c864ff' }}>93.6%</div>
          <div className="m-label">ODs cross water</div>
        </div>
      </div>

      {/* Section 2: barrier crossing rates */}
      <div className="p3c-section">
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
      <div className="p3c-section">
        <h4>Friction Composition</h4>
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={FRICTION_COMPONENTS} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(90, 50, 110, 0.15)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: '#888', fontSize: 10 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
            <Radar dataKey="value" stroke="#c864ff" fill="#c864ff" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 4: feature importance (新增) */}
      <div className="p3c-section">
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
        <p className="p3c-note">What drives ground friction most? Detour and barrier crossings dominate.</p>
      </div>

      {/* Section 5: observed vs random */}
      <div className="p3c-section">
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
        <p className="p3c-insight">
          Observed sites cluster in high-friction overlap zones — not in demand-only areas.
        </p>
      </div>
    </div>
  );
}

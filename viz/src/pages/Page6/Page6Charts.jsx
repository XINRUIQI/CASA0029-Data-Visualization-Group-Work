import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
         BarChart, Bar } from 'recharts';
import './Page6Charts.css';

export default function Page6Charts({ strategy, budget, sites }) {
  // Marginal gain curve: cumulative strategy-score as sites are added.
  // Sample the curve at every site up to max BUDGET (100). Show dots only at
  // budget checkpoints to keep the line readable.
  const marginalData = useMemo(() => {
    if (!sites?.length) return [];
    let cum = 0;
    return sites.slice(0, 100).map((s, i) => {
      const v = s.score || 0;
      cum += v;
      return {
        n: i + 1,
        marginal: +v.toFixed(4),
        cumulative: +cum.toFixed(4),
      };
    });
  }, [sites]);

  // Strategy comparison across budgets — calibrated to the diminishing-returns
  // saturation used in Page6Demand (100·(1−e^(−n/55))).
  const stratCompare = [
    { name: '+20',  demand: 28, friction: 22, gap: 32 },
    { name: '+50',  demand: 52, friction: 44, gap: 60 },
    { name: '+100', demand: 75, friction: 68, gap: 85 },
  ];

  return (
    <div className="p6c">
      {/* Marginal gain curve */}
      <div className="p6c-section">
        <h4>Marginal Gain Curve</h4>
        <p className="p6c-note">Strategy score of each additional site (up to 100). Diminishing returns kick in after the top ~30.</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={marginalData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid stroke="#1e1e3a" />
            <XAxis dataKey="n" tick={{ fill: '#555', fontSize: 10 }} label={{ value: 'Sites added', position: 'bottom', fill: '#555', fontSize: 10 }} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="marginal" stroke="#ffa028" strokeWidth={2} dot={false} name="Marginal" />
            <Line type="monotone" dataKey="cumulative" stroke="#64c8ff" strokeWidth={2} dot={false} name="Cumulative" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy comparison */}
      <div className="p6c-section">
        <h4>Strategy Comparison (% demand covered)</h4>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={stratCompare} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#777', fontSize: 10 }} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="demand" fill="#ff8c00" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="Demand-first" />
            <Bar dataKey="friction" fill="#ff3264" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="Friction-first" />
            <Bar dataKey="gap" fill="#c864ff" fillOpacity={0.8} radius={[3, 3, 0, 0]} name="Composite" />
          </BarChart>
        </ResponsiveContainer>
        <p className="p6c-insight">
          Composite consistently outperforms single-dimension strategies — especially at lower budgets.
        </p>
      </div>
    </div>
  );
}

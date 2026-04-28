import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, ComposedChart,
} from 'recharts';
import './Page6Charts.css';

const CLASS_COLORS = { hub: '#ff3232', station: '#ffb400', endpoint: '#64c8ff' };
const CLASS_ORDER  = ['hub', 'station', 'endpoint'];
const COMPOUND_COLORS = {
  residential: '#64c8ff', commercial: '#ffa028', industrial: '#ff3264',
  campus: '#c864ff', park: '#00e896',
};

export default function Page6Charts({ strategy, budget, sites, coverageTable }) {

  const currentSites = useMemo(() => sites?.slice(0, budget) || [], [sites, budget]);

  /* ── 1  Marginal gain curve (original) ── */
  const marginalData = useMemo(() => {
    if (!sites?.length) return [];
    let cum = 0;
    return sites.slice(0, 100).map((s, i) => {
      const v = s.score || 0;
      cum += v;
      return { n: i + 1, marginal: +v.toFixed(4), cumulative: +cum.toFixed(4) };
    });
  }, [sites]);

  /* ── 2  Strategy comparison (original, hardcoded demo) ── */
  const stratCompare = [
    { name: '+20',  demand: 28, friction: 22, gap: 32 },
    { name: '+50',  demand: 52, friction: 44, gap: 60 },
    { name: '+100', demand: 75, friction: 68, gap: 85 },
  ];

  /* ── 3  Coverage growth curve ── */
  const coverageData = useMemo(() => {
    if (!coverageTable?.length) return [];
    return [...coverageTable]
      .sort((a, b) => a.n_sites - b.n_sites)
      .map(d => ({
        n: d.n_sites,
        demand: +d.demand_coverage_pct.toFixed(1),
        pop: +d.pop_coverage_pct.toFixed(1),
        area: +d.coverage_area_pct.toFixed(1),
      }));
  }, [coverageTable]);

  /* ── 4  Site class donut ── */
  const classDonut = useMemo(() => {
    if (!currentSites.length) return [];
    const counts = {};
    currentSites.forEach(s => { counts[s.site_class] = (counts[s.site_class] || 0) + 1; });
    return CLASS_ORDER.filter(c => counts[c]).map(c => ({ name: c, value: counts[c] }));
  }, [currentSites]);

  /* ── 5  Radar: avg dimensions per class ── */
  const radarData = useMemo(() => {
    if (!currentSites.length) return [];
    const dims = ['demand_norm', 'friction_norm', 'intensity_norm'];
    const labels = ['Demand', 'Friction', 'Intensity'];
    const groups = {};
    CLASS_ORDER.forEach(c => { groups[c] = { count: 0, sums: [0, 0, 0] }; });
    currentSites.forEach(s => {
      const g = groups[s.site_class];
      if (!g) return;
      g.count++;
      dims.forEach((d, i) => { g.sums[i] += (s[d] || 0); });
    });
    return labels.map((label, i) => {
      const row = { dim: label };
      CLASS_ORDER.forEach(c => {
        const g = groups[c];
        row[c] = g.count ? +(g.sums[i] / g.count).toFixed(3) : 0;
      });
      return row;
    });
  }, [currentSites]);

  /* ── 6  Coverage comparison (demand vs pop vs area) ── */
  const coverageCompare = useMemo(() => {
    if (!coverageTable?.length) return [];
    return [...coverageTable]
      .sort((a, b) => a.n_sites - b.n_sites)
      .map(d => ({
        name: `+${d.n_sites}`,
        demand: +d.demand_coverage_pct.toFixed(1),
        pop: +d.pop_coverage_pct.toFixed(1),
        area: +d.coverage_area_pct.toFixed(1),
      }));
  }, [coverageTable]);

  /* ── 7  Land use distribution ── */
  const landUseData = useMemo(() => {
    if (!currentSites.length) return [];
    const counts = {};
    currentSites.forEach(s => {
      const t = s.nearest_compound_type || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [currentSites]);

  /* ── 8  Pareto (individual score + cumulative %) ── */
  const paretoData = useMemo(() => {
    if (!currentSites.length) return [];
    const totalScore = currentSites.reduce((s, d) => s + (d.score || 0), 0);
    let cum = 0;
    return currentSites.map((s, i) => {
      cum += (s.score || 0);
      return {
        rank: i + 1,
        score: +(s.score || 0).toFixed(4),
        cumPct: totalScore > 0 ? +((cum / totalScore) * 100).toFixed(1) : 0,
      };
    });
  }, [currentSites]);

  /* ── 9  Friction breakdown (detour vs congestion) ── */
  const frictionBreak = useMemo(() => {
    if (!currentSites.length) return [];
    const top = currentSites.slice(0, Math.min(20, currentSites.length));
    return top.map((s, i) => {
      const det = s.avg_detour || 0;
      const cong = s.avg_congestion || 0;
      const total = det + cong || 1;
      return {
        rank: `#${i + 1}`,
        detour: +((det / total) * 100).toFixed(1),
        congestion: +((cong / total) * 100).toFixed(1),
      };
    });
  }, [currentSites]);

  const tooltipStyle = { background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 };

  return (
    <div className="p6c">

      {/* ═══ 1  Marginal Gain Curve ═══ */}
      <div className="p6c-section">
        <h4>Marginal Gain Curve</h4>
        <p className="p6c-note">Strategy score of each additional site (up to 100). Diminishing returns kick in after the top ~30.</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={marginalData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid stroke="#1e1e3a" />
            <XAxis dataKey="n" tick={{ fill: '#555', fontSize: 10 }} label={{ value: 'Sites added', position: 'bottom', fill: '#555', fontSize: 10 }} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="marginal" stroke="#ffa028" strokeWidth={2} dot={false} name="Marginal" />
            <Line type="monotone" dataKey="cumulative" stroke="#64c8ff" strokeWidth={2} dot={false} name="Cumulative" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ 2  Strategy Comparison ═══ */}
      <div className="p6c-section">
        <h4>Strategy Comparison (% demand covered)</h4>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={stratCompare} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#777', fontSize: 10 }} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="demand" fill="#ff8c00" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="Demand-first" />
            <Bar dataKey="friction" fill="#ff3264" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="Friction-first" />
            <Bar dataKey="gap" fill="#c864ff" fillOpacity={0.8} radius={[3, 3, 0, 0]} name="Composite" />
          </BarChart>
        </ResponsiveContainer>
        <p className="p6c-insight">
          Composite consistently outperforms single-dimension strategies — especially at lower budgets.
        </p>
      </div>

      {/* ═══ 3  Coverage Growth Curve ═══ */}
      {coverageData.length > 0 && (
        <div className="p6c-section">
          <h4>Coverage Growth Curve</h4>
          <p className="p6c-note">How demand, population & area coverage scale with new sites — diminishing returns are clear.</p>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={coverageData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="#1e1e3a" />
              <XAxis dataKey="n" tick={{ fill: '#555', fontSize: 10 }} label={{ value: 'Sites added', position: 'bottom', fill: '#555', fontSize: 10 }} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="demand" stroke="#ffa028" fill="#ffa028" fillOpacity={0.15} strokeWidth={2} name="Demand %" />
              <Area type="monotone" dataKey="pop" stroke="#c864ff" fill="#c864ff" fillOpacity={0.1} strokeWidth={2} name="Population %" />
              <Area type="monotone" dataKey="area" stroke="#64c8ff" fill="#64c8ff" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 4" name="Area %" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8a78a0' }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="p6c-insight">
            Demand coverage rises much faster than raw area — the algorithm prioritises high-value zones first.
          </p>
        </div>
      )}

      {/* ═══ 4  Site Class Donut + 5  Radar  (side by side) ═══ */}
      {(classDonut.length > 0 || radarData.length > 0) && (
        <div className="p6c-duo">
          {classDonut.length > 0 && (
            <div className="p6c-section p6c-half">
              <h4>Site Type Mix</h4>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={classDonut} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={36} outerRadius={60}
                    paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    style={{ fontSize: 10 }}>
                    {classDonut.map(d => (
                      <Cell key={d.name} fill={CLASS_COLORS[d.name] || '#888'} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {radarData.length > 0 && (
            <div className="p6c-section p6c-half">
              <h4>Dimension Profile</h4>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart cx="50%" cy="50%" outerRadius={50} data={radarData}>
                  <PolarGrid stroke="#2a1e3a" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: '#8a78a0', fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fill: '#555', fontSize: 8 }} domain={[0, 1]} />
                  {CLASS_ORDER.map(c => (
                    <Radar key={c} dataKey={c} stroke={CLASS_COLORS[c]} fill={CLASS_COLORS[c]}
                      fillOpacity={0.12} strokeWidth={1.5} name={c} />
                  ))}
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8a78a0' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══ 6  Coverage Breakdown (demand vs pop vs area) ═══ */}
      {coverageCompare.length > 0 && (
        <div className="p6c-section">
          <h4>Coverage Breakdown by Budget</h4>
          <p className="p6c-note">Demand coverage outpaces population and raw area — proving the algorithm targets high-demand zones.</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={coverageCompare} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: '#777', fontSize: 10 }} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="demand" fill="#ffa028" fillOpacity={0.75} radius={[3, 3, 0, 0]} name="Demand %" />
              <Bar dataKey="pop" fill="#c864ff" fillOpacity={0.65} radius={[3, 3, 0, 0]} name="Population %" />
              <Bar dataKey="area" fill="#64c8ff" fillOpacity={0.55} radius={[3, 3, 0, 0]} name="Area %" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8a78a0' }} />
            </BarChart>
          </ResponsiveContainer>
          <p className="p6c-insight">
            With just 20 sites, demand coverage (~46%) already far exceeds area coverage (~18%) — an efficient allocation.
          </p>
        </div>
      )}

      {/* ═══ 7  Land Use Distribution ═══ */}
      {landUseData.length > 0 && (
        <div className="p6c-section">
          <h4>Surrounding Land Use</h4>
          <p className="p6c-note">What types of compounds surround the selected sites? Switch strategies to see how preferences shift.</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={landUseData} layout="vertical" margin={{ left: 70, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#8a78a0', fontSize: 10 }} width={65} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Sites">
                {landUseData.map(d => (
                  <Cell key={d.name} fill={COMPOUND_COLORS[d.name] || '#888'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ 8  Pareto Chart ═══ */}
      {paretoData.length > 0 && (
        <div className="p6c-section">
          <h4>Pareto — Cumulative Contribution</h4>
          <p className="p6c-note">Individual site scores (bars) vs cumulative share (line). The classic 80/20 pattern.</p>
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={paretoData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="#1e1e3a" />
              <XAxis dataKey="rank" tick={{ fill: '#555', fontSize: 9 }} label={{ value: 'Rank', position: 'bottom', fill: '#555', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#555', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="left" dataKey="score" fill="#ffa028" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="Score" />
              <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#00e896" strokeWidth={2} dot={false} name="Cumulative %" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="p6c-insight">
            The top ~30% of selected sites capture over 60% of the total strategic value.
          </p>
        </div>
      )}

      {/* ═══ 9  Friction Breakdown ═══ */}
      {frictionBreak.length > 0 && (
        <div className="p6c-section">
          <h4>Friction Breakdown (top {Math.min(20, currentSites.length)})</h4>
          <p className="p6c-note">What drives ground-friction at each site — detour vs congestion?</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={frictionBreak} layout="vertical" margin={{ left: 30, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <YAxis dataKey="rank" type="category" tick={{ fill: '#8a78a0', fontSize: 9 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="detour" stackId="a" fill="#ff8c00" fillOpacity={0.7} name="Detour %" />
              <Bar dataKey="congestion" stackId="a" fill="#ff3264" fillOpacity={0.7} radius={[0, 3, 3, 0]} name="Congestion %" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#8a78a0' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

const TT_STYLE = {
  background: '#0f0f24',
  border: '1px solid #2a2a4a',
  borderRadius: 8,
  fontSize: 12,
};

/**
 * "The Current Mismatch" — stacked horizontal bars showing what share of
 * Shenzhen's population and POIs the existing 34 vertiports actually cover
 * (at 3 km and 5 km flight radii). Drives home the "supply ≠ demand" point.
 */
export function MismatchChart({ coverage }) {
  if (!coverage?.radii) return null;
  const r3 = coverage.radii['3km'];
  const r5 = coverage.radii['5km'];

  const rows = [
    { label: 'Population · 3 km', covered: r3.population_coverage_pct, total: 100 },
    { label: 'POI · 3 km',        covered: r3.poi_coverage_pct,        total: 100 },
    { label: 'Population · 5 km', covered: r5.population_coverage_pct, total: 100 },
    { label: 'POI · 5 km',        covered: r5.poi_coverage_pct,        total: 100 },
  ];

  return (
    <div className="p4-chart">
      <div className="p4-chart-kpis">
        <div className="p4-kpi">
          <div className="p4-kpi-val">{coverage.site_count}</div>
          <div className="p4-kpi-lab">Existing vertiports</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>
            {(100 - r3.population_coverage_pct).toFixed(1)}%
          </div>
          <div className="p4-kpi-lab">Population outside 3 km</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>
            {(100 - r3.poi_coverage_pct).toFixed(1)}%
          </div>
          <div className="p4-kpi-lab">POIs outside 3 km</div>
        </div>
      </div>

      <div className="p4-bars">
        {rows.map(r => (
          <div className="p4-bar-row" key={r.label}>
            <div className="p4-bar-label">{r.label}</div>
            <div className="p4-bar-track">
              <div
                className="p4-bar-fill"
                style={{ width: `${r.covered}%` }}
              />
              <span className="p4-bar-val">{r.covered.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <p className="p4-chart-note">
        Covered vs. uncovered share at 3 km and 5 km flight radii.
        More than half of Shenzhen still sits outside any vertiport's reach.
      </p>
    </div>
  );
}

/**
 * "The Optimisation Logic" — diminishing-returns curve from the greedy
 * complementarity simulation. Shows how quickly demand/pop/area coverage
 * climbs as the algorithm adds complementary sites one by one.
 */
export function OptimisationChart({ strategy }) {
  if (!strategy?.length) return null;

  const data = strategy.map(d => ({
    n:      d.n_sites,
    demand: d.demand_coverage_pct,
    pop:    d.pop_coverage_pct,
    area:   d.coverage_area_pct,
  }));

  return (
    <div className="p4-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 14, right: 24, bottom: 28, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2040" vertical={false} />
          <XAxis
            dataKey="n"
            type="number"
            scale="log"
            domain={[3, 100]}
            ticks={[3, 5, 10, 20, 50, 100]}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: '#2a2a4a' }}
            tickLine={false}
            label={{
              value: 'Number of sites (log)',
              position: 'bottom',
              fill: '#666',
              fontSize: 11,
              offset: 6,
            }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: '#2a2a4a' }}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={TT_STYLE}
            labelStyle={{ color: '#aaa' }}
            formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
            labelFormatter={l => `${l} sites`}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, color: '#aaa', paddingBottom: 4 }}
            iconType="plainline"
            iconSize={18}
          />
          <Line
            type="monotone"
            dataKey="demand"
            name="Demand coverage"
            stroke="#ff7a5c"
            strokeWidth={2.2}
            dot={{ r: 3, stroke: '#ff7a5c', fill: '#0a0a1a', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="pop"
            name="Population coverage"
            stroke="#64c8ff"
            strokeWidth={2}
            dot={{ r: 3, stroke: '#64c8ff', fill: '#0a0a1a', strokeWidth: 1.5 }}
          />
          <Line
            type="monotone"
            dataKey="area"
            name="Area coverage"
            stroke="#8a8d99"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            dot={{ r: 2.5, stroke: '#8a8d99', fill: '#0a0a1a', strokeWidth: 1.2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="p4-chart-note">
        Greedy complementarity simulation: each added site maximises
        <em> newly</em> covered demand. Marginal gain shrinks quickly &mdash;
        the first 20 sites win almost half of the demand.
      </p>
    </div>
  );
}

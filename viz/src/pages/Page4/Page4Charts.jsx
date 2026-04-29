import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, ScatterChart, Scatter,
  ZAxis, Cell, AreaChart, Area,
} from 'recharts';

const TT_STYLE = {
  background: '#2E5E7E',
  border: '1px solid rgba(168, 196, 212, 0.2)',
  borderRadius: 8,
  fontSize: 12,
};

/* ═══════════════════════════════════════════════════════════
   1 · MismatchChart — horizontal coverage bars (existing)
   ═══════════════════════════════════════════════════════════ */
export function MismatchChart({ coverage }) {
  if (!coverage?.radii) return null;
  const r3 = coverage.radii['3km'];
  const r5 = coverage.radii['5km'];

  const rows = [
    { label: 'Population · 3 km', covered: r3.population_coverage_pct },
    { label: 'POI · 3 km',        covered: r3.poi_coverage_pct },
    { label: 'Population · 5 km', covered: r5.population_coverage_pct },
    { label: 'POI · 5 km',        covered: r5.poi_coverage_pct },
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
              <div className="p4-bar-fill" style={{ width: `${r.covered}%` }} />
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

/* ═══════════════════════════════════════════════════════════
   2 · OptimisationChart — diminishing-returns curve (existing)
   ═══════════════════════════════════════════════════════════ */
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
        <LineChart data={data} margin={{ top: 14, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.08)" vertical={false} />
          <XAxis
            dataKey="n" type="number" scale="log"
            domain={[3, 100]} ticks={[3, 5, 10, 20, 50, 100]}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
            tickLine={false}
            label={{ value: 'Number of sites (log)', position: 'bottom', fill: '#666', fontSize: 11, offset: 6 }}
          />
          <YAxis
            domain={[0, 100]} tickFormatter={v => `${v}%`}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }}
            tickLine={false} width={42}
          />
          <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#aaa' }}
            formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
            labelFormatter={l => `${l} sites`} />
          <Legend verticalAlign="top" align="right"
            wrapperStyle={{ fontSize: 11, color: '#aaa', paddingBottom: 4 }}
            iconType="plainline" iconSize={18} />
          <Line type="monotone" dataKey="demand" name="Demand coverage"
            stroke="#ff7a5c" strokeWidth={2.2}
            dot={{ r: 3, stroke: '#ff7a5c', fill: '#5A89A6', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="pop" name="Population coverage"
            stroke="#64c8ff" strokeWidth={2}
            dot={{ r: 3, stroke: '#64c8ff', fill: '#5A89A6', strokeWidth: 1.5 }} />
          <Line type="monotone" dataKey="area" name="Area coverage"
            stroke="#8a8d99" strokeWidth={1.8} strokeDasharray="4 3"
            dot={{ r: 2.5, stroke: '#8a8d99', fill: '#5A89A6', strokeWidth: 1.2 }} />
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

/* ═══════════════════════════════════════════════════════════
   3 · ZoneTypeMismatchChart — site zone types vs demand POI split
   ═══════════════════════════════════════════════════════════ */
const ZONE_COLORS = {
  residential: '#ffa726',
  park:        '#66bb6a',
  commercial:  '#42a5f5',
  campus:      '#ab47bc',
};

const POI_COLORS = {
  food:      '#ff7a5c',
  retail:    '#ffb07a',
  service:   '#64c8ff',
  medical:   '#66bb6a',
  education: '#ab47bc',
  office:    '#8a8d99',
  leisure:   '#e0c260',
  scenic:    '#4caf88',
};

export function ZoneTypeMismatchChart({ zoneSummary, demandData }) {
  const chartData = useMemo(() => {
    if (!zoneSummary?.length || !demandData?.length) return null;

    const siteTotal = zoneSummary.reduce((s, z) => s + z.count, 0);
    const siteBars = zoneSummary.map(z => ({
      name: z.label_en,
      pct: +((z.count / siteTotal) * 100).toFixed(1),
      color: ZONE_COLORS[z.type] || '#888',
    }));

    const poiTotals = {};
    demandData.forEach(d => {
      ['food', 'retail', 'service', 'med', 'edu', 'office', 'leisure', 'scenic'].forEach(k => {
        const label = k === 'med' ? 'medical' : k === 'edu' ? 'education' : k;
        poiTotals[label] = (poiTotals[label] || 0) + (d[k] || 0);
      });
    });
    const poiSum = Object.values(poiTotals).reduce((a, b) => a + b, 0);
    const demandBars = Object.entries(poiTotals)
      .map(([name, v]) => ({ name, pct: +((v / poiSum) * 100).toFixed(1), color: POI_COLORS[name] || '#888' }))
      .sort((a, b) => b.pct - a.pct);

    return { siteBars, demandBars };
  }, [zoneSummary, demandData]);

  if (!chartData) return null;

  const DualBar = ({ title, items, maxVal }) => (
    <div className="p4-dual-col">
      <div className="p4-dual-title">{title}</div>
      {items.map(d => (
        <div className="p4-hbar-row" key={d.name}>
          <span className="p4-hbar-name">{d.name}</span>
          <div className="p4-hbar-track">
            <div className="p4-hbar-fill" style={{ width: `${(d.pct / maxVal) * 100}%`, background: d.color }} />
          </div>
          <span className="p4-hbar-pct">{d.pct}%</span>
        </div>
      ))}
    </div>
  );

  const maxVal = Math.max(
    ...chartData.siteBars.map(d => d.pct),
    ...chartData.demandBars.map(d => d.pct),
  );

  return (
    <div className="p4-chart">
      <div className="p4-dual-grid">
        <DualBar title="Site zone distribution" items={chartData.siteBars} maxVal={maxVal} />
        <DualBar title="Demand POI distribution" items={chartData.demandBars} maxVal={maxVal} />
      </div>
      <p className="p4-chart-note">
        Existing vertiports cluster in <em>commercial</em> and <em>residential</em> zones,
        but the strongest delivery demand comes from <em>food</em> and <em>retail</em> POIs
        — many of which sit outside any vertiport's service range.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4 · DistanceDistributionChart — gap zone distance histogram
   ═══════════════════════════════════════════════════════════ */
export function DistanceDistributionChart({ gapZones }) {
  const { bins, cumLine, stats } = useMemo(() => {
    if (!gapZones?.length) return {};
    const distances = gapZones.map(z => z.dist / 1000);
    const maxD = Math.ceil(Math.max(...distances));
    const binSize = 1;
    const numBins = Math.min(maxD, 16);
    const binsArr = Array.from({ length: numBins }, (_, i) => ({
      range: `${i}–${i + binSize}`,
      km: i + binSize * 0.5,
      count: 0,
    }));
    distances.forEach(d => {
      const idx = Math.min(Math.floor(d / binSize), numBins - 1);
      binsArr[idx].count++;
    });

    const total = distances.length;
    let cum = 0;
    const cumArr = binsArr.map(b => {
      cum += b.count;
      return { km: b.km, cumPct: +((cum / total) * 100).toFixed(1) };
    });

    const avg = distances.reduce((a, b) => a + b, 0) / total;
    const median = [...distances].sort((a, b) => a - b)[Math.floor(total / 2)];
    const beyond5 = distances.filter(d => d > 5).length;

    return {
      bins: binsArr,
      cumLine: cumArr,
      stats: {
        total,
        avg: avg.toFixed(1),
        median: median.toFixed(1),
        beyond5,
        beyond5Pct: ((beyond5 / total) * 100).toFixed(1),
      },
    };
  }, [gapZones]);

  if (!bins) return null;

  return (
    <div className="p4-chart">
      <div className="p4-chart-kpis">
        <div className="p4-kpi">
          <div className="p4-kpi-val">{stats.total}</div>
          <div className="p4-kpi-lab">Underserved hexagons</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val">{stats.avg} km</div>
          <div className="p4-kpi-lab">Avg. distance to nearest site</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>{stats.beyond5Pct}%</div>
          <div className="p4-kpi-lab">Beyond 5 km range</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={bins} margin={{ top: 10, right: 30, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.08)" vertical={false} />
          <XAxis dataKey="range" tick={{ fill: '#888', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false}
            label={{ value: 'Distance to nearest vertiport (km)', position: 'bottom', fill: '#666', fontSize: 11, offset: 6 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false} width={36} />
          <Tooltip contentStyle={TT_STYLE}
            formatter={(v, name) => [v, name === 'count' ? 'Hex count' : name]}
            labelFormatter={l => `${l} km`} />
          <Bar dataKey="count" name="Hex count" radius={[3, 3, 0, 0]}>
            {bins.map((b, i) => (
              <Cell key={i} fill={b.km > 5 ? '#ff7a5c' : 'rgba(168, 196, 212, 0.25)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="p4-chart-note">
        Distribution of underserved hexagons by distance to the nearest vertiport.
        Bars in <em>red</em> mark zones beyond the effective 5 km drone flight radius —
        accounting for <em>{stats.beyond5Pct}%</em> of all gap zones.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   5 · FrictionDemandScatter — quadrant scatter: friction × demand
   ═══════════════════════════════════════════════════════════ */
export function FrictionDemandScatter({ h3Gap }) {
  const { data, stats } = useMemo(() => {
    if (!h3Gap?.length) return {};
    const filtered = h3Gap.filter(d => d.demand_pressure > 0 || d.avg_friction > 0);
    const maxDp = Math.max(...filtered.map(d => d.demand_pressure));
    const maxFr = Math.max(...filtered.map(d => d.avg_friction));

    const points = filtered.map(d => ({
      friction: +d.avg_friction.toFixed(3),
      demand: +d.demand_pressure.toFixed(1),
      pop: Math.round(d.pop_count),
      covered: d.covered_by_10,
    }));

    const highNeed = filtered.filter(d =>
      d.demand_pressure > maxDp * 0.3 && d.avg_friction > maxFr * 0.3 && !d.covered_by_10
    );

    return {
      data: points,
      stats: {
        total: filtered.length,
        uncovered: filtered.filter(d => !d.covered_by_10).length,
        highNeed: highNeed.length,
        maxDp: Math.ceil(maxDp),
        maxFr: +maxFr.toFixed(2),
      },
    };
  }, [h3Gap]);

  if (!data) return null;

  return (
    <div className="p4-chart">
      <div className="p4-chart-kpis">
        <div className="p4-kpi">
          <div className="p4-kpi-val">{stats.total}</div>
          <div className="p4-kpi-lab">Active hexagons</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>{stats.uncovered}</div>
          <div className="p4-kpi-lab">Not covered by vertiports</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>{stats.highNeed}</div>
          <div className="p4-kpi-lab">High demand + high friction</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 14, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.08)" />
          <XAxis dataKey="friction" type="number" name="Ground friction"
            domain={[0, 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false}
            label={{ value: 'Ground friction index', position: 'bottom', fill: '#666', fontSize: 11, offset: 10 }} />
          <YAxis dataKey="demand" type="number" name="Demand pressure"
            domain={[0, 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false} width={48}
            label={{ value: 'Demand pressure', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11, offset: 4 }} />
          <ZAxis dataKey="pop" range={[20, 200]} name="Population" />
          <Tooltip contentStyle={TT_STYLE} cursor={{ strokeDasharray: '3 3' }}
            formatter={(v, name) => {
              if (name === 'Ground friction') return [v.toFixed(3), name];
              if (name === 'Demand pressure') return [v.toFixed(1), name];
              return [v.toLocaleString(), name];
            }} />
          <Scatter name="Covered" data={data.filter(d => d.covered)} fill="rgba(168,196,212,0.2)" />
          <Scatter name="Not covered" data={data.filter(d => !d.covered)} fill="#ff7a5c" fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>

      <p className="p4-chart-note">
        Each dot is a H3 hexagon. <em>Red</em> = not covered by any existing vertiport.
        The top-right quadrant — high demand pressure <strong>and</strong> high ground friction
        — represents areas that <em>need drones most but have none</em>.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   6 · GroundFrictionBoxChart — OD route friction distributions
   ═══════════════════════════════════════════════════════════ */
function computeBoxStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const min = sorted[0];
  const max = sorted[n - 1];
  const avg = values.reduce((a, b) => a + b, 0) / n;
  return { min, q1, median, q3, max, avg, n };
}

export function GroundFrictionBoxChart({ odData }) {
  const metrics = useMemo(() => {
    if (!odData?.features?.length) return null;
    const props = odData.features.map(f => f.properties);

    const detour = computeBoxStats(props.map(p => p.detour_ratio));
    const congestion = computeBoxStats(props.map(p => p.congestion_amplifier));
    const friction = computeBoxStats(props.map(p => p.ground_friction));
    const barriers = computeBoxStats(props.map(p => p.n_barrier_total));

    return [
      { name: 'Detour ratio', ...detour, color: '#ff7a5c', unit: '×' },
      { name: 'Congestion amp.', ...congestion, color: '#ffb07a', unit: '×' },
      { name: 'Ground friction', ...friction, color: '#ab47bc', unit: '' },
      { name: 'Barriers / route', ...barriers, color: '#42a5f5', unit: '' },
    ];
  }, [odData]);

  if (!metrics) return null;

  const boxWidth = 680;

  return (
    <div className="p4-chart">
      <div className="p4-chart-kpis">
        <div className="p4-kpi">
          <div className="p4-kpi-val">{metrics[0].n}</div>
          <div className="p4-kpi-lab">OD route pairs analysed</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>
            {metrics[0].median.toFixed(2)}{metrics[0].unit}
          </div>
          <div className="p4-kpi-lab">Median detour ratio</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ffb07a' }}>
            {metrics[1].median.toFixed(2)}{metrics[1].unit}
          </div>
          <div className="p4-kpi-lab">Median congestion amplifier</div>
        </div>
      </div>

      <div className="p4-box-chart">
        {metrics.map(m => {
          const scale = (v) => ((v - m.min) / (m.max - m.min)) * 100;
          return (
            <div className="p4-box-row" key={m.name}>
              <div className="p4-box-label">{m.name}</div>
              <div className="p4-box-track">
                <div className="p4-box-whisker"
                  style={{ left: `${scale(m.min)}%`, width: `${scale(m.max) - scale(m.min)}%` }}>
                  <div className="p4-box-whisker-line" style={{ background: m.color }} />
                </div>
                <div className="p4-box-rect"
                  style={{
                    left: `${scale(m.q1)}%`,
                    width: `${scale(m.q3) - scale(m.q1)}%`,
                    background: m.color,
                    opacity: 0.3,
                  }} />
                <div className="p4-box-median"
                  style={{ left: `${scale(m.median)}%`, background: m.color }} />
              </div>
              <div className="p4-box-vals">
                <span>Q1 {m.q1.toFixed(2)}</span>
                <span style={{ fontWeight: 700 }}>Med {m.median.toFixed(2)}</span>
                <span>Q3 {m.q3.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="p4-chart-note">
        Ground-level OD route metrics. Median detour ratio of <em>{metrics[0].median.toFixed(2)}×</em> means
        ground couriers travel {((metrics[0].median - 1) * 100).toFixed(0)}% further than a straight line.
        Peak-hour congestion amplifies travel time by <em>{metrics[1].median.toFixed(1)}×</em> —
        exactly the gap drones can bypass.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   7 · DemandVulnerabilityBubble — intensity vs vulnerability
   ═══════════════════════════════════════════════════════════ */
export function DemandVulnerabilityBubble({ h3Gap }) {
  const { data, stats } = useMemo(() => {
    if (!h3Gap?.length) return {};
    const active = h3Gap.filter(d => d.intensity_index > 0 && d.relief_vulnerability > 0);
    const maxInt = Math.max(...active.map(d => d.intensity_index));
    const maxVul = Math.max(...active.map(d => d.relief_vulnerability));

    const pts = active.map(d => ({
      intensity: +d.intensity_index.toFixed(4),
      vulnerability: +d.relief_vulnerability.toFixed(4),
      pop: Math.round(d.pop_count),
      covered: d.covered_by_10,
    }));

    const critical = active.filter(d =>
      d.intensity_index > maxInt * 0.25 &&
      d.relief_vulnerability > maxVul * 0.25 &&
      !d.covered_by_10
    );

    return {
      data: pts,
      stats: {
        total: active.length,
        critical: critical.length,
        critPop: Math.round(critical.reduce((s, d) => s + d.pop_count, 0)),
      },
    };
  }, [h3Gap]);

  if (!data) return null;

  return (
    <div className="p4-chart">
      <div className="p4-chart-kpis">
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>{stats.critical}</div>
          <div className="p4-kpi-lab">Critical uncovered zones</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val" style={{ color: '#ff7a5c' }}>
            {(stats.critPop / 1000).toFixed(0)}k
          </div>
          <div className="p4-kpi-lab">Population in critical zones</div>
        </div>
        <div className="p4-kpi">
          <div className="p4-kpi-val">{data.length}</div>
          <div className="p4-kpi-lab">Hexagons with active demand</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 14, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.08)" />
          <XAxis dataKey="intensity" type="number" name="Intensity"
            domain={[0, 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false}
            label={{ value: 'Intensity index', position: 'bottom', fill: '#666', fontSize: 11, offset: 10 }} />
          <YAxis dataKey="vulnerability" type="number" name="Vulnerability"
            domain={[0, 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false} width={52}
            label={{ value: 'Relief vulnerability', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11, offset: 4 }} />
          <ZAxis dataKey="pop" range={[20, 300]} name="Population" />
          <Tooltip contentStyle={TT_STYLE} cursor={{ strokeDasharray: '3 3' }}
            formatter={(v, name) => {
              if (name === 'Population') return [v.toLocaleString(), name];
              return [v.toFixed(4), name];
            }} />
          <Scatter name="Covered" data={data.filter(d => d.covered)} fill="rgba(168,196,212,0.18)" />
          <Scatter name="Uncovered" data={data.filter(d => !d.covered)} fill="#ff7a5c" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>

      <p className="p4-chart-note">
        Bubble size = population. <em>Red</em> dots are hexagons <strong>not</strong> covered
        by any vertiport. Top-right = high demand intensity <em>and</em> high service vulnerability
        — the most underserved communities in Shenzhen.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   8 · EnhancedKpiCards — augmented headline KPIs
   ═══════════════════════════════════════════════════════════ */
export function EnhancedKpiCards({ coverage, gapZones, h3Gap, odData }) {
  const kpis = useMemo(() => {
    const items = [];

    if (coverage?.radii) {
      const r3 = coverage.radii['3km'];
      items.push({
        val: `${(100 - r3.population_coverage_pct).toFixed(0)}%`,
        lab: 'Population outside 3 km',
        accent: true,
      });
    }

    if (gapZones?.length) {
      const distances = gapZones.map(z => z.dist / 1000);
      const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
      items.push({
        val: `${avg.toFixed(1)} km`,
        lab: 'Avg. distance to nearest site',
        accent: true,
      });
    }

    if (h3Gap?.length) {
      const highDemand = h3Gap.filter(d => d.demand_pressure > 10);
      const uncoveredHigh = highDemand.filter(d => !d.covered_by_10);
      const pct = highDemand.length ? ((uncoveredHigh.length / highDemand.length) * 100).toFixed(0) : 0;
      items.push({
        val: `${pct}%`,
        lab: 'High-demand hexes uncovered',
        accent: true,
      });
    }

    if (odData?.features?.length) {
      const props = odData.features.map(f => f.properties);
      const avgDetour = props.reduce((s, p) => s + p.detour_ratio, 0) / props.length;
      items.push({
        val: `${avgDetour.toFixed(2)}×`,
        lab: 'Avg. ground detour ratio',
        accent: false,
      });
    }

    if (odData?.features?.length) {
      const props = odData.features.map(f => f.properties);
      const avgCong = props.reduce((s, p) => s + p.congestion_amplifier, 0) / props.length;
      items.push({
        val: `${avgCong.toFixed(1)}×`,
        lab: 'Avg. peak congestion multiplier',
        accent: false,
      });
    }

    if (coverage) {
      items.push({
        val: coverage.site_count,
        lab: 'Existing vertiport sites',
        accent: false,
      });
    }

    return items;
  }, [coverage, gapZones, h3Gap, odData]);

  if (!kpis.length) return null;

  return (
    <div className="p4-chart">
      <div className="p4-enhanced-kpis">
        {kpis.map((k, i) => (
          <div className="p4-kpi" key={i}>
            <div className="p4-kpi-val" style={k.accent ? { color: '#ff7a5c' } : undefined}>
              {k.val}
            </div>
            <div className="p4-kpi-lab">{k.lab}</div>
          </div>
        ))}
      </div>
      <p className="p4-chart-note">
        Key metrics quantifying the gap between Shenzhen's drone infrastructure and actual delivery demand.
      </p>
    </div>
  );
}

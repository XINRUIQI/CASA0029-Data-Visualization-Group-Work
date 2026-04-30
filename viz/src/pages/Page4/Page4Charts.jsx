import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, ScatterChart, Scatter,
  ZAxis, Cell, AreaChart, Area, ReferenceArea, Label,
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
   4 · DistanceDistributionChart — violin plot with threshold
   ═══════════════════════════════════════════════════════════ */

function gaussianKDE(data, bandwidth, nPoints = 80, forceMin) {
  const min = forceMin ?? Math.min(...data);
  const max = Math.max(...data);
  const step = (max - min) / (nPoints - 1);
  const points = [];
  for (let i = 0; i < nPoints; i++) {
    const x = min + i * step;
    let density = 0;
    for (const d of data) {
      const z = (x - d) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= data.length * bandwidth * Math.sqrt(2 * Math.PI);
    points.push({ x, density });
  }
  return points;
}

export function DistanceDistributionChart({ gapZones }) {
  const chartData = useMemo(() => {
    if (!gapZones?.length) return null;
    const distances = gapZones.map(z => z.dist / 1000);
    const sorted = [...distances].sort((a, b) => a - b);
    const n = sorted.length;

    const avg = distances.reduce((a, b) => a + b, 0) / n;
    const beyond3 = distances.filter(d => d > 3).length;
    const beyond3Pct = ((beyond3 / n) * 100).toFixed(1);

    const iqr = sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)];
    const bandwidth = 0.9 * Math.min(
      Math.sqrt(distances.reduce((s, d) => s + (d - avg) ** 2, 0) / n),
      iqr / 1.34
    ) * Math.pow(n, -0.2);

    const kde = gaussianKDE(distances, bandwidth || 1, 100, 0);
    const maxDensity = Math.max(...kde.map(p => p.density));
    const maxX = Math.ceil(sorted[n - 1] / 2) * 2;
    const maxCount = Math.ceil(maxDensity * n * (sorted[n - 1] / 100));

    return { kde, maxDensity, maxX, avg, n, beyond3, beyond3Pct, maxCount };
  }, [gapZones]);

  if (!chartData) return null;

  const { kde, maxDensity, maxX, avg, n, beyond3Pct } = chartData;

  const binWidth = (Math.max(...kde.map(p => p.x)) - Math.min(...kde.map(p => p.x))) / (kde.length - 1);
  const maxCountDisplay = Math.ceil(maxDensity * n * binWidth);
  const yTickStep = Math.max(1, Math.ceil(maxCountDisplay / 4 / 10) * 10);

  const W = 600, H = 300;
  const padTop = 20, padBot = 50, padLeft = 60, padRight = 20;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBot;

  const xScale = (val) => padLeft + (val / maxX) * plotW;
  const yScale = (density) => padTop + plotH - (density / maxDensity) * plotH;
  const countToY = (count) => padTop + plotH - (count / maxCountDisplay) * plotH;

  const areaPath = kde.map((p, i) => {
    const x = xScale(p.x);
    const y = yScale(p.density);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ` L ${xScale(kde[kde.length - 1].x)} ${padTop + plotH} L ${xScale(0)} ${padTop + plotH} Z`;

  const x3km = xScale(3);

  const xTicks = [];
  for (let v = 0; v <= maxX; v += 1) xTicks.push(v);

  const yCountTicks = [];
  for (let v = 0; v <= maxCountDisplay; v += yTickStep) yCountTicks.push(v);

  return (
    <div className="p4-chart">
      <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 600, height: 'auto' }}>
          {/* Y-axis grid + labels */}
          {yCountTicks.map(v => {
            const y = countToY(v);
            return (
              <g key={v}>
                <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y}
                  stroke="rgba(46,94,126,0.08)" strokeWidth="1" />
                <text x={padLeft - 8} y={y + 4}
                  textAnchor="end" fill="#6B6050" fontSize="9">
                  {v}
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {xTicks.map(v => (
            <g key={v}>
              <line x1={xScale(v)} x2={xScale(v)} y1={padTop + plotH} y2={padTop + plotH + 4}
                stroke="#999" strokeWidth="1" />
              <text x={xScale(v)} y={padTop + plotH + 18}
                textAnchor="middle" fill="#6B6050" fontSize="10">
                {v}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={padLeft + plotW / 2} y={H - 6}
            textAnchor="middle" fill="#6B6050" fontSize="11">
            Distance to nearest site (km)
          </text>
          <text x={16} y={padTop + plotH / 2}
            textAnchor="middle" fill="#6B6050" fontSize="11"
            transform={`rotate(-90, 16, ${padTop + plotH / 2})`}>
            Gap zone number
          </text>

          {/* KDE area */}
          <path d={areaPath}
            fill="rgba(46,94,126,0.2)" stroke="#2E5E7E" strokeWidth="1.8" />

          {/* 3 km vertical threshold */}
          <line x1={x3km} x2={x3km} y1={padTop} y2={padTop + plotH}
            stroke="#2E5E7E" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={x3km + 6} y={padTop + 14}
            fill="#2E5E7E" fontSize="10" fontWeight="600">
            3 km drone range
          </text>

          {/* Axis lines */}
          <line x1={padLeft} x2={padLeft + plotW} y1={padTop + plotH} y2={padTop + plotH}
            stroke="#ccc" strokeWidth="1" />
          <line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + plotH}
            stroke="#ccc" strokeWidth="1" />
        </svg>
      </div>

      <p className="p4-chart-note">
        Each area is measured by its distance to the nearest drone site. The dashed line shows the
        3 km drone range. All <em>{beyond3Pct}%</em> of areas are beyond this range, with an
        average distance of <em>{avg.toFixed(1)} km</em>. This highlights a major coverage gap in the current drone delivery network.
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
    const minDp = Math.min(...filtered.map(d => d.demand_pressure));
    const dpRange = maxDp - minDp || 1;
    const maxFr = Math.max(...filtered.map(d => d.avg_friction));

    const points = filtered.map(d => ({
      friction: +d.avg_friction.toFixed(3),
      demand: +((d.demand_pressure - minDp) / dpRange).toFixed(4),
      pop: Math.round(d.pop_count),
      covered: d.covered_by_10,
    }));

    const highNeed = filtered.filter(d =>
      (d.demand_pressure - minDp) / dpRange > 0.3 && d.avg_friction > maxFr * 0.3 && !d.covered_by_10
    );

    const frThreshold = +(maxFr * 0.3).toFixed(3);
    const dpThreshold = 0.3;

    return {
      data: points,
      stats: {
        total: filtered.length,
        uncovered: filtered.filter(d => !d.covered_by_10).length,
        highNeed: highNeed.length,
        maxDp: 1,
        maxFr: +maxFr.toFixed(2),
        frThreshold,
        dpThreshold,
      },
    };
  }, [h3Gap]);

  if (!data) return null;

  return (
    <div className="p4-chart">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 14, right: 20, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,196,212,0.08)" />
          <XAxis dataKey="friction" type="number" name="Ground burden"
            domain={[0, 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false}
            label={{ value: 'Ground burden', position: 'bottom', fill: '#666', fontSize: 11, offset: 10 }} />
          <YAxis dataKey="demand" type="number" name="Demand index"
            domain={[0, 1]}
            tick={{ fill: '#888', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(168, 196, 212, 0.15)' }} tickLine={false} width={48}
            label={{ value: 'Demand index', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11, offset: 4 }} />
          <ZAxis dataKey="pop" range={[20, 200]} name="Population" />
          <ReferenceArea
            x1={stats.frThreshold} x2={stats.maxFr}
            y1={stats.dpThreshold} y2={stats.maxDp}
            fill="#ff7a5c" fillOpacity={0.06}
            stroke="#ff7a5c" strokeOpacity={0.5} strokeDasharray="4 3"
          >
            <Label
              value={`Priority zone (${stats.highNeed})`}
              position="insideTopRight"
              style={{ fill: '#ff7a5c', fontSize: 11, fontWeight: 700 }}
            />
          </ReferenceArea>
          <Tooltip contentStyle={TT_STYLE} cursor={{ strokeDasharray: '3 3' }}
            formatter={(v, name) => {
              if (name === 'Ground burden') return [v.toFixed(3), name];
              if (name === 'Demand index') return [v.toFixed(3), name];
              return [v.toLocaleString(), name];
            }} />
          <Scatter name="Covered" data={data.filter(d => d.covered)} fill="#5A89A6" fillOpacity={0.45} />
          <Scatter name="Not covered" data={data.filter(d => !d.covered)} fill="#ff7a5c" fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>

      <p className="p4-chart-note">
        Each dot represents one H3 hexagon. <span style={{ color: '#ff7a5c', fontWeight: 600 }}>Orange dots</span> are
        areas not served by current drone sites. The top-right area highlights places with both high demand and high
        ground difficulty — <em style={{ color: '#ff7a5c' }}>these are the strongest candidates for new drone sites</em>.
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
      { name: 'Detour (vs straight line)', ...detour, color: '#ff7a5c', unit: '×' },
      { name: 'Traffic Delay', ...congestion, color: '#ffb07a', unit: '×' },
      { name: 'Barriers per trip', ...barriers, color: '#4caf50', unit: '' },
      { name: 'Ground burden', ...friction, color: '#ab47bc', unit: '' },
    ];
  }, [odData]);

  if (!metrics) return null;

  const boxWidth = 680;

  return (
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
export function EnhancedKpiCards({ coverage, gapZones, h3Gap }) {
  const kpis = useMemo(() => {
    const items = [];

    if (coverage?.radii) {
      const r3 = coverage.radii['3km'];
      items.push({
        val: `${(100 - r3.population_coverage_pct).toFixed(0)}%`,
        lab: 'Population outside 3 km range',
        accent: true,
      });
    }

    if (gapZones?.length) {
      const distances = gapZones.map(z => z.dist / 1000);
      const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
      items.push({
        val: `${avg.toFixed(1)} km`,
        lab: 'Average distance to nearest site',
        accent: true,
      });
    }

    if (h3Gap?.length) {
      const highDemand = h3Gap.filter(d => d.demand_pressure > 10);
      const uncoveredHigh = highDemand.filter(d => !d.covered_by_10);
      const pct = highDemand.length ? ((uncoveredHigh.length / highDemand.length) * 100).toFixed(0) : 0;
      items.push({
        val: `${pct}%`,
        lab: 'High-demand hexagons uncovered',
        accent: true,
      });
    }

    if (h3Gap?.length) {
      const maxDp = Math.max(...h3Gap.map(d => d.demand_pressure));
      const maxFr = Math.max(...h3Gap.map(d => d.avg_friction));
      const critical = h3Gap.filter(d =>
        d.demand_pressure > maxDp * 0.3 && d.avg_friction > maxFr * 0.3 && !d.covered_by_10
      );
      items.push({
        val: critical.length,
        lab: 'Critical uncovered zones',
        accent: true,
      });
    }

    return items;
  }, [coverage, gapZones, h3Gap]);

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
        Together, these indicators show that the next step is not simply to add more drone sites,
        but to place them where demand, friction, and coverage gaps overlap.
      </p>
    </div>
  );
}

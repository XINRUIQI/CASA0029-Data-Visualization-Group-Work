import { useEffect, useState, useMemo } from 'react';
import Page4Map from './Page4Map';
import {
  DistanceDistributionChart,
  FrictionDemandScatter,
  EnhancedKpiCards,
} from './Page4Charts';
import { publicDataUrl } from '../../config';
import './Page4.css';

const STRATEGIES = [
  { id: 'demand',   label: 'Demand-first',  desc: 'GAP = demand − supply (supply ≈ 1 − friction); rank high→low' },
  { id: 'friction', label: 'Friction-first', desc: 'Rank by ground-friction intensity, high→low' },
  { id: 'gap',      label: 'Composite',     desc: '0.4·D·F + 0.3·I·F + 0.3·D·I (urgent→not-urgent)' },
];

const BUDGETS = [20, 50, 100];

function scoreFor(site, strategy) {
  const d = site.demand_norm ?? 0;
  const f = site.friction_norm ?? 0;
  const i = site.intensity_norm ?? 0;
  if (strategy === 'demand')   return d;
  if (strategy === 'friction') return f;
  return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i;
}

export default function Page4Placeholder() {
  const [sites, setSites]         = useState(null);
  const [boundary, setBoundary]   = useState(null);
  const [hexGrid, setHexGrid]     = useState(null);
  const [coverage, setCoverage]   = useState(null);
  const [gapZones, setGapZones]       = useState(null);
  const [h3Gap, setH3Gap]             = useState(null);
  const [odData, setOdData]                   = useState(null);
  const [allCandidates, setAllCandidates]     = useState(null);

  const [strategy, setStrategy] = useState('gap');
  const [budget, setBudget]     = useState(20);

  useEffect(() => {
    fetch(publicDataUrl('data/vertiport_sites.json'))
      .then(r => r.json()).then(setSites).catch(() => {});
    fetch(publicDataUrl('data/shenzhen_boundary.json'))
      .then(r => r.json()).then(setBoundary).catch(() => {});
    fetch(publicDataUrl('data/sz_hex_grid_res8.json'))
      .then(r => r.json()).then(setHexGrid).catch(() => {});
    fetch(publicDataUrl('data/page3_coverage.json'))
      .then(r => r.json()).then(setCoverage).catch(() => {});
    fetch(publicDataUrl('data/page3_gap_zones.json'))
      .then(r => r.json()).then(setGapZones).catch(() => {});
    fetch(publicDataUrl('data/h3_gap.json'))
      .then(r => r.json()).then(setH3Gap).catch(() => {});
    fetch(publicDataUrl('data/page2_od_analysis.json'))
      .then(r => r.json()).then(setOdData).catch(() => {});
    fetch(publicDataUrl('data/page6_candidate_sites.json'))
      .then(r => r.json()).then(setAllCandidates).catch(() => {});
  }, []);

  const candidateSites = useMemo(() => {
    if (!allCandidates?.length) return allCandidates;
    const scored = allCandidates.map(s => ({ ...s, score: scoreFor(s, strategy) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, budget);
  }, [allCandidates, strategy, budget]);

  return (
    <section id="page-4" className="page page-4">

      {/* ── Section 1: Headline KPIs ── */}
      <div className="p4-text">
        <div className="p4-eyebrow">From Status Quo to Strategy</div>

        <div className="p4-section">
          <h3 className="p4-col-title">The Gap at a Glance</h3>
          <div className="p4-col-body">
            <p>
              Six numbers that expose the mismatch between Shenzhen's drone
              infrastructure and its real delivery demand — from population
              coverage to ground-level detour penalties.
            </p>
          </div>
          <EnhancedKpiCards coverage={coverage} gapZones={gapZones}
            h3Gap={h3Gap} odData={odData} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 4: Distance distribution ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">Distance to the Nearest Drone Site</h3>
          <div className="p4-col-body">
            <p>
              Most areas are not just slightly out of reach — they are far beyond
              the <strong>3 km drone range</strong>.
            </p>
          </div>
          <DistanceDistributionChart gapZones={gapZones} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 5: Friction × Demand scatter ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">High Friction, High Demand — Zero Coverage</h3>
          <div className="p4-col-body">
            <p>
              Each dot represents one H3 hexagon. The horizontal axis measures
              ground-level friction (detours, barriers, congestion) while the
              vertical axis measures delivery demand pressure.
              <strong> Red dots in the top-right quadrant mark areas with the
              greatest need for drones — yet no vertiport serves them</strong>.
            </p>
          </div>
          <FrictionDemandScatter h3Gap={h3Gap} />
        </div>


      </div>

      {/* ── BOTTOM: strategy / budget selectors + map ── */}
      <div className="p4-map-wrap">
        <div className="p4-map-controls-bar">
          <div className="p4-ctrl-group">
            <span className="p4-ctrl-label">Strategy</span>
            <div className="p4-toggle-group">
              {STRATEGIES.map(s => (
                <button key={s.id}
                  className={`p4-toggle-btn ${strategy === s.id ? 'active' : ''}`}
                  onClick={() => setStrategy(s.id)}
                  title={s.desc}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="p4-ctrl-group">
            <span className="p4-ctrl-label">Budget</span>
            <div className="p4-toggle-group">
              {BUDGETS.map(b => (
                <button key={b}
                  className={`p4-toggle-btn ${budget === b ? 'active' : ''}`}
                  onClick={() => setBudget(b)}>+{b}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="p4-map">
          <Page4Map sites={sites} candidateSites={candidateSites}
            boundary={boundary} hexGrid={hexGrid} />
        </div>
      </div>

    </section>
  );
}

import { useEffect, useState, useMemo, useRef } from 'react';
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
  { id: 'burden', label: 'Burden-first', desc: 'Rank by ground-level delivery burden, high→low' },
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
  const [allCandidates, setAllCandidates]     = useState(null);

  const [strategy, setStrategy] = useState('gap');
  const [budget, setBudget]     = useState(20);
  const [algoInfoOpen, setAlgoInfoOpen] = useState(false);
  const algoInfoRef = useRef(null);

  useEffect(() => {
    if (!algoInfoOpen) return;
    const onDoc = (e) => {
      if (!algoInfoRef.current?.contains(e.target)) setAlgoInfoOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [algoInfoOpen]);

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
        <div className="p4-eyebrow">From Current Network to Optimisation Need</div>

        <div className="p4-section">
          <h3 className="p4-col-title" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: '#2E5E7E', marginTop: '-20px' }}>From Gap to Action</h3>
          <div className="p4-col-body" style={{ marginTop: '16px' }}>
            <p>
              The existing drone network does not fully match Shenzhen's delivery demand.
              Many residents and high-demand areas remain outside the 3 km service range,
              while some locations combine strong demand, high ground burden, and no nearby
              drone site. These gaps define where optimisation is needed most.
            </p>
          </div>
          <EnhancedKpiCards coverage={coverage} gapZones={gapZones}
            h3Gap={h3Gap} />
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
          <h3 className="p4-col-title">High Burden, High Demand — Zero Coverage</h3>
          <div className="p4-col-body">
            <p>
              High-demand areas with difficult ground delivery are still not served by drones.
            </p>
          </div>
          <FrictionDemandScatter h3Gap={h3Gap} />
        </div>


      </div>

      {/* ── BOTTOM: strategy / budget selectors + map ── */}
      <div className="p4-map-wrap">
        <div className="p4-map-title-row" ref={algoInfoRef}>
          <h3 className="p4-col-title" style={{ marginBottom: 0 }}>Where to Add Sites?</h3>
          <button
            className="p4-algo-info-btn"
            onClick={() => setAlgoInfoOpen(o => !o)}
            aria-label="Algorithm info"
            aria-expanded={algoInfoOpen}
          >i</button>
          {algoInfoOpen && (
            <div className="p4-algo-info-popover">
              <strong>Site selection algorithm</strong>
              <p>Each candidate site is scored using three normalised dimensions from the composite analysis pipeline:</p>
              <ul>
                <li><strong>Demand-first</strong> — ranks by demand_norm (delivery demand pressure)</li>
                <li><strong>Burden-first</strong> — ranks by burden_norm (ground-transport difficulty)</li>
                <li><strong>Composite</strong> — 0.4·D·F + 0.3·I·F + 0.3·D·I, where D = demand, F = friction, I = intensity</li>
              </ul>
              <p>Sites are ranked high → low by strategy score; the top N (budget) are selected. All inputs are min-max normalised to [0, 1].</p>
            </div>
          )}
        </div>
        <p className="p4-col-body" style={{ textAlign: 'center', marginTop: 16, marginBottom: 18 }}>
        This interactive map shows optimal locations for adding new drone sites under different strategies and budget constraints. By comparing demand-driven, burden-based, and composite approaches, it highlights how additional sites can be added to improve spatial accessibility across the network.
        </p>
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

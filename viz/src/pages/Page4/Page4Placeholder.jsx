import { useEffect, useState } from 'react';
import Page4Map from './Page4Map';
import {
  MismatchChart,
  OptimisationChart,
  ZoneTypeMismatchChart,
  DistanceDistributionChart,
  FrictionDemandScatter,
  GroundFrictionBoxChart,
  DemandVulnerabilityBubble,
  EnhancedKpiCards,
} from './Page4Charts';
import { publicDataUrl } from '../../config';
import './Page4.css';

export default function Page4Placeholder() {
  const [sites, setSites]         = useState(null);
  const [boundary, setBoundary]   = useState(null);
  const [hexGrid, setHexGrid]     = useState(null);
  const [coverage, setCoverage]   = useState(null);
  const [strategy, setStrategy]   = useState(null);
  const [zoneSummary, setZoneSummary] = useState(null);
  const [demandData, setDemandData]   = useState(null);
  const [gapZones, setGapZones]       = useState(null);
  const [h3Gap, setH3Gap]             = useState(null);
  const [odData, setOdData]                   = useState(null);
  const [candidateSites, setCandidateSites]   = useState(null);

  useEffect(() => {
    fetch(publicDataUrl('data/vertiport_sites.json'))
      .then(r => r.json()).then(setSites).catch(() => {});
    fetch(publicDataUrl('data/shenzhen_boundary.json'))
      .then(r => r.json()).then(setBoundary).catch(() => {});
    fetch(publicDataUrl('data/sz_hex_grid_res8.json'))
      .then(r => r.json()).then(setHexGrid).catch(() => {});
    fetch(publicDataUrl('data/page3_coverage.json'))
      .then(r => r.json()).then(setCoverage).catch(() => {});
    fetch(publicDataUrl('data/page6_strategy_coverage.json'))
      .then(r => r.json()).then(setStrategy).catch(() => {});
    fetch(publicDataUrl('data/page3_zone_summary.json'))
      .then(r => r.json()).then(setZoneSummary).catch(() => {});
    fetch(publicDataUrl('data/h3_demand.json'))
      .then(r => r.json()).then(setDemandData).catch(() => {});
    fetch(publicDataUrl('data/page3_gap_zones.json'))
      .then(r => r.json()).then(setGapZones).catch(() => {});
    fetch(publicDataUrl('data/h3_gap.json'))
      .then(r => r.json()).then(setH3Gap).catch(() => {});
    fetch(publicDataUrl('data/page2_od_analysis.json'))
      .then(r => r.json()).then(setOdData).catch(() => {});
    fetch(publicDataUrl('data/page6_candidate_sites.json'))
      .then(r => r.json()).then(setCandidateSites).catch(() => {});
  }, []);

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

        {/* ── Section 2: Current Mismatch bars ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">The Current Mismatch</h3>
          <div className="p4-col-body">
            <p>
              Shenzhen already hosts the densest drone-delivery network in China, but
              <strong> where vertiports sit is not where demand actually lives</strong>.
              Existing sites cluster inside a handful of commercial cores — Futian CBD,
              Nanshan tech parks — while the districts that suffer the worst ground
              friction remain almost entirely uncovered.
            </p>
          </div>
          <MismatchChart coverage={coverage} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 3: Zone type mismatch ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">Supply vs. Demand — A Structural Misfit</h3>
          <div className="p4-col-body">
            <p>
              The left column shows where existing vertiports are sited by zone type;
              the right shows how real delivery demand is distributed across POI
              categories. <strong>Commercial zones dominate the supply side, but food
              and retail POIs — concentrated in residential neighbourhoods — drive
              the overwhelming majority of demand</strong>.
            </p>
          </div>
          <ZoneTypeMismatchChart zoneSummary={zoneSummary} demandData={demandData} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 4: Distance distribution ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">How Far Is "Too Far"?</h3>
          <div className="p4-col-body">
            <p>
              For each underserved hexagon, we compute the straight-line distance to
              the nearest existing vertiport. The histogram below reveals that the
              majority of gap zones sit <strong>well beyond the effective 5 km drone
              flight radius</strong> — meaning ground couriers, not drones, still
              handle these deliveries.
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

        <div className="p4-divider" />

        {/* ── Section 6: Ground friction box plot ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">Ground Delivery — The Hidden Costs</h3>
          <div className="p4-col-body">
            <p>
              Analysis of origin–destination route pairs across Shenzhen shows how
              much ground logistics actually costs in terms of detour, congestion,
              and physical barriers. The box plots summarise each metric's
              distribution — the wider the box, the more variability; the further
              right the median, the worse the problem.
            </p>
          </div>
          <GroundFrictionBoxChart odData={odData} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 7: Demand vulnerability bubble ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">Demand Intensity vs. Service Vulnerability</h3>
          <div className="p4-col-body">
            <p>
              A complementary view: the horizontal axis captures how
              <em> intense</em> an area's delivery activity is, while the vertical
              axis measures <em>relief vulnerability</em> — a composite score
              reflecting how badly an area needs drone service based on its
              combined demand gap and friction. Bubble size encodes population.
            </p>
          </div>
          <DemandVulnerabilityBubble h3Gap={h3Gap} />
        </div>

        <div className="p4-divider" />

        {/* ── Section 8: Optimisation logic ── */}
        <div className="p4-section">
          <h3 className="p4-col-title">The Optimisation Logic</h3>
          <div className="p4-col-body">
            <p>
              Instead of asking "which site earns money", we ask
              <strong> which hexagons combine high demand with high ground friction</strong>
              — the grids that truly deserve an aerial shortcut. A greedy,
              complementarity-aware search is then run within a
              <strong> 3 km flight radius</strong>: every new vertiport must cover as much
              still-unserved pain as possible.
            </p>
          </div>
          <OptimisationChart strategy={strategy} />
        </div>
      </div>

      {/* ── BOTTOM: smaller, centered map card ── */}
      <div className="p4-map-wrap">
        <div className="p4-map">
          <Page4Map sites={sites} candidateSites={candidateSites}
            boundary={boundary} hexGrid={hexGrid} />
        </div>
      </div>

    </section>
  );
}

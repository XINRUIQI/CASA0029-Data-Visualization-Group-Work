import { useEffect, useState } from 'react';
import Page4Map from './Page4Map';
import { MismatchChart, OptimisationChart } from './Page4Charts';
import { publicDataUrl } from '../../config';
import './Page4.css';

export default function Page4Placeholder() {
  const [sites, setSites]         = useState(null);
  const [boundary, setBoundary]   = useState(null);
  const [hexGrid, setHexGrid]     = useState(null);
  const [coverage, setCoverage]   = useState(null);
  const [strategy, setStrategy]   = useState(null);

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
  }, []);

  return (
    <section id="page-4" className="page page-4">

      {/* ── TOP: centered text ── */}
      <div className="p4-text">
        <div className="p4-eyebrow">From Status Quo to Strategy</div>

        <div className="p4-section">
          <h3 className="p4-col-title">The Current Mismatch</h3>
          <div className="p4-col-body">
            <p>
              Shenzhen already hosts the densest drone-delivery network in China, but
              <strong> where vertiports sit is not where demand actually lives</strong>.
              Existing sites cluster inside a handful of commercial cores — Futian CBD,
              Nanshan tech parks — while the districts that suffer the worst ground
              friction (northwest Bao'an, southern Longgang, the hill-and-highway belt
              between Guangming and Pingshan) remain almost entirely uncovered.
            </p>
            <p>
              Operators optimise siting around single-route profitability, which
              produces <strong>redundant coverage in hot zones and chronic blind spots
              in cold ones</strong>: several vertiports stack within the same tech park,
              while residential compounds and urban villages just 3 km away have no
              landing point at all. Last-mile ground delivery is then forced through
              the high-friction gaps — across rivers, over elevated expressways —
              inflating its cost by <strong>1.5×–2×</strong> precisely where drones were
              supposed to help.
            </p>
          </div>

          <MismatchChart coverage={coverage} />
        </div>

        <div className="p4-section">
          <h3 className="p4-col-title">The Optimisation Logic</h3>
          <div className="p4-col-body">
            <p>
              Instead of asking "which site earns money", we ask
              <strong> which hexagons combine high demand with high ground friction</strong>
              — the grids that truly deserve an aerial shortcut. Multiplying the two
              gives a single pain score, <em>demand pressure × ground friction</em>,
              used as the only ranking signal for siting.
            </p>
            <p>
              A greedy, complementarity-aware search is then run within a
              <strong> 3 km flight radius</strong>: every new vertiport must cover as much
              still-unserved pain as possible, without overlapping existing coverage.
              Mixed-use parcels (residential + retail + food) are preferred so a single
              site can serve several delivery scenarios at once.
            </p>
            <p>
              The map below shows today's result. Each pin is an existing vertiport,
              and the hex grid marks the areas evaluated by this logic — making it
              easy to see which parts of Shenzhen are already saturated and which
              still sit outside any 3 km service range.
            </p>
          </div>

          <OptimisationChart strategy={strategy} />
        </div>
      </div>

      {/* ── BOTTOM: smaller, centered map card ── */}
      <div className="p4-map-wrap">
        <div className="p4-map">
          <Page4Map sites={sites} boundary={boundary} hexGrid={hexGrid} />
        </div>
      </div>

    </section>
  );
}

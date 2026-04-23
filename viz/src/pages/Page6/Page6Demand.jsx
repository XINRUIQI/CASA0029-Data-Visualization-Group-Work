import { useState, useEffect, useMemo } from 'react';
import Page6Map from './Page6Map';
import Page6Charts from './Page6Charts';
import { publicDataUrl } from '../../config';
import './Page6.css';

const CLASS_LABELS = {
  hub:      'Commercial area pick-up/drop-off points',
  station:  'Commercial area pick-up/drop-off points',
  endpoint: 'Last-mile pick-up/drop-off points',
};
const siteLabel = (cls) => CLASS_LABELS[cls] || cls;

const STRATEGIES = [
  { id: 'demand',   label: 'Demand-first',   desc: 'GAP = demand − supply (supply ≈ 1 − friction); rank high→low' },
  { id: 'friction', label: 'Friction-first', desc: 'Rank by ground-friction intensity, high→low' },
  { id: 'gap',      label: 'Composite',      desc: '0.4·D·F + 0.3·I·F + 0.3·D·I (urgent→not-urgent)' },
];

const BUDGETS = [20, 50, 100];

// Per-strategy score: higher = higher priority. See the write-up in the chat
// or the README for the formulas. All inputs are already min-max normalized to
// [0,1] by the upstream composite-analysis pipeline.
function scoreFor(site, strategy) {
  const d = site.demand_norm ?? 0;
  const f = site.friction_norm ?? 0;
  const i = site.intensity_norm ?? 0;
  if (strategy === 'demand') {
    // GAP = demand − supply, supply proxy = 1 − friction_norm
    // => score ∈ [−1, 1], high = "high demand AND hard to reach"
    return d - (1 - f);
  }
  if (strategy === 'friction') {
    return f;
  }
  // composite (matches the notebook's gap_index formula)
  return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i;
}

// Linear interpolation on the empirically-simulated coverage curve
// (from the notebook's 3 km buffer + cKDTree strategy simulator).
// Falls back to the exponential estimate if the table hasn't loaded yet.
function estimateCoverage(nSites, table) {
  if (!table?.length) {
    return 100 * (1 - Math.exp(-nSites / 55));
  }
  const sorted = [...table].sort((a, b) => a.n_sites - b.n_sites);
  if (nSites <= sorted[0].n_sites) return sorted[0].demand_coverage_pct;
  if (nSites >= sorted[sorted.length - 1].n_sites) return sorted[sorted.length - 1].demand_coverage_pct;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (nSites >= a.n_sites && nSites <= b.n_sites) {
      const t = (nSites - a.n_sites) / (b.n_sites - a.n_sites);
      return a.demand_coverage_pct + t * (b.demand_coverage_pct - a.demand_coverage_pct);
    }
  }
  return sorted[sorted.length - 1].demand_coverage_pct;
}

export default function Page6Demand() {
  const [strategy, setStrategy] = useState('gap');
  const [budget, setBudget] = useState(20);
  const [sites, setSites] = useState(null);
  const [h3Demand, setH3Demand] = useState(null);
  const [coverageTable, setCoverageTable] = useState(null);
  const [hoveredSite, setHoveredSite] = useState(null);
  const [selectedSiteDetail, setSelectedSiteDetail] = useState(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showCoveredOnly, setShowCoveredOnly] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState('after');
  const [dataStatus, setDataStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    setDataStatus('loading');
    Promise.allSettled([
      fetch(publicDataUrl('data/page6_candidate_sites.json')).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      fetch(publicDataUrl('data/h3_demand.json')).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      fetch(publicDataUrl('data/page6_strategy_coverage.json')).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
    ]).then(([sitesRes, gridRes, covRes]) => {
      if (cancelled) return;
      if (sitesRes.status === 'fulfilled' && Array.isArray(sitesRes.value)) {
        setSites(sitesRes.value);
      } else {
        setSites([]);
      }
      if (gridRes.status === 'fulfilled') setH3Demand(gridRes.value);
      else setH3Demand(null);
      if (covRes.status === 'fulfilled' && Array.isArray(covRes.value)) {
        setCoverageTable(covRes.value);
      }
      const sitesFailed = sitesRes.status !== 'fulfilled';
      setDataStatus(sitesFailed ? 'error' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rankedSites = useMemo(() => {
    if (!sites) return [];
    const scored = sites.map(s => ({ ...s, score: scoreFor(s, strategy) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [sites, strategy]);

  const currentSites = rankedSites.slice(0, budget);

  const metrics = useMemo(() => {
    if (!currentSites.length) return null;
    const avgScore = currentSites.reduce((s, d) => s + (d.score || 0), 0) / currentSites.length;
    // coverageEst comes from the upstream 3 km buffer simulator
    // (page6_strategy_coverage.json) — interpolated at the current budget.
    const coverageEst = estimateCoverage(currentSites.length, coverageTable);
    const mismatchBefore = 85;
    const mismatchAfter = 100 - coverageEst;
    const mismatchClosure = ((mismatchBefore - mismatchAfter) / mismatchBefore * 100);
    return {
      sites: currentSites.length,
      avgGap: avgScore.toFixed(3),
      coverageEst: coverageEst.toFixed(0),
      marginalGain: currentSites.length > 1
        ? (currentSites[currentSites.length - 1]?.score || 0).toFixed(3)
        : '—',
      mismatchClosure: mismatchClosure.toFixed(0),
    };
  }, [currentSites, coverageTable]);

  return (
    <section id="page-6" className="page page-6">
      {/* ═══ MAIN (Left text panel | Right map) ═══ */}
      <div className="p6-main">
        {/* ─── LEFT PANEL ─── */}
        <div className="p6-panel">
          <div className="p6-intro">
            <h2 className="p6-title">Where should new sites be added?</h2>
            <p className="p6-lede">
              An incremental complementarity simulation: pick a <strong>strategy</strong> and a{' '}
              <strong>budget</strong> to see which new pick-up / drop-off sites close the biggest
              gap between drone-delivery demand and the current ground-friction bottlenecks.
            </p>
          </div>

          {/* Controls */}
          <div className="p6-controls">
            <div className="p6-ctrl-row">
              <span className="p6-ctrl-label">Strategy</span>
              <div className="p6-strategy-group">
                {STRATEGIES.map(s => (
                  <button key={s.id} className={`p6-strat-btn ${strategy === s.id ? 'active' : ''}`}
                    onClick={() => setStrategy(s.id)} title={s.desc}>{s.label}</button>
                ))}
              </div>
            </div>
            <div className="p6-ctrl-row">
              <span className="p6-ctrl-label">Budget</span>
              <div className="p6-budget-group">
                {BUDGETS.map(b => (
                  <button key={b} className={`p6-budget-btn ${budget === b ? 'active' : ''}`}
                    onClick={() => setBudget(b)}>+{b}</button>
                ))}
              </div>
            </div>
            <div className="p6-ctrl-row">
              <span className="p6-ctrl-label">View</span>
              <div className="p6-view-toggle">
                <button className={`p6-vt-btn ${showBeforeAfter === 'before' ? 'active' : ''}`}
                  onClick={() => setShowBeforeAfter('before')}>Before</button>
                <button className={`p6-vt-btn ${showBeforeAfter === 'after' ? 'active' : ''}`}
                  onClick={() => setShowBeforeAfter('after')}>After</button>
              </div>
            </div>
          </div>

          {dataStatus === 'loading' && (
            <p className="p6-panel-status">正在加载候选点与需求栅格…</p>
          )}
          {dataStatus === 'error' && (
            <div className="p6-panel-error">
              <p><strong>候选点数据未能加载</strong></p>
              <p className="p6-panel-error-detail">
                若站点部署在 GitHub Pages 子路径下，必须使用带 <code>base</code> 前缀的数据地址（已修复）。
                请重新构建并部署；本地预览请运行 <code>npm run build && npm run preview</code>。
              </p>
            </div>
          )}
          {dataStatus === 'ready' && metrics && (
            <>
              <h3>Strategy: {STRATEGIES.find(s => s.id === strategy)?.label}</h3>
              <p className="p6-strat-desc">{STRATEGIES.find(s => s.id === strategy)?.desc}</p>

              <div className="p6-metrics-grid">
                <div className="p6-m-card">
                  <div className="p6m-val" style={{ color: '#64c8ff' }}>+{metrics.sites}</div>
                  <div className="p6m-lab">New sites</div>
                </div>
                <div className="p6-m-card">
                  <div className="p6m-val" style={{ color: '#00e896' }}>{metrics.coverageEst}%</div>
                  <div className="p6m-lab">Demand covered</div>
                </div>
                <div className="p6-m-card">
                  <div className="p6m-val" style={{ color: '#ffa028' }}>{metrics.marginalGain}</div>
                  <div className="p6m-lab">Marginal gain (last)</div>
                </div>
                <div className="p6-m-card">
                  <div className="p6m-val" style={{ color: '#c864ff' }}>{metrics.mismatchClosure}%</div>
                  <div className="p6m-lab">Mismatch closure</div>
                </div>
              </div>

              {/* Click site detail panel */}
              {selectedSiteDetail && (
                <div className="p6-site-detail">
                  <div className="sd-header">
                    <span className="sd-rank">#{selectedSiteDetail.rank}</span>
                    <span className={`rk-class ${selectedSiteDetail.site_class}`}>{siteLabel(selectedSiteDetail.site_class)}</span>
                    <button className="sd-close" onClick={() => setSelectedSiteDetail(null)}>x</button>
                  </div>
                  <div className="sd-row">
                    <span>Strategy score</span>
                    <span className="sd-val">{(selectedSiteDetail.score || 0).toFixed(4)}</span>
                  </div>
                  <div className="sd-row">
                    <span>Demand / Friction / Intensity</span>
                    <span className="sd-val">
                      {(selectedSiteDetail.demand_norm || 0).toFixed(2)} /{' '}
                      {(selectedSiteDetail.friction_norm || 0).toFixed(2)} /{' '}
                      {(selectedSiteDetail.intensity_norm || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="sd-row">
                    <span>Composite gap_index</span>
                    <span className="sd-val">{(selectedSiteDetail.gap_index || 0).toFixed(4)}</span>
                  </div>
                  <div className="sd-row">
                    <span>Position</span>
                    <span className="sd-val">{selectedSiteDetail.lon?.toFixed(4)}, {selectedSiteDetail.lat?.toFixed(4)}</span>
                  </div>
                  <div className="sd-row">
                    <span>Coverage radius</span>
                    <span className="sd-val">3 km</span>
                  </div>
                  <div className="sd-row">
                    <span>Marginal contribution</span>
                    <span className="sd-val" style={{ color: '#00e896' }}>
                      +{((selectedSiteDetail.score || 0) / (rankedSites[0]?.score || 1) * 100).toFixed(1)}% relative
                    </span>
                  </div>
                </div>
              )}

              <Page6Charts strategy={strategy} budget={budget} sites={rankedSites} />
            </>
          )}
          {dataStatus === 'ready' && !metrics && (
            <p className="p6-panel-status">候选点列表为空，无法计算策略指标。</p>
          )}
        </div>

        {/* ─── RIGHT MAP ─── */}
        <div className="p6-map-area">
          <div className="p6-map-frame">
            <Page6Map
              sites={currentSites}
              allSites={rankedSites}
              h3Demand={h3Demand}
              showCoverage={showCoverage}
              showCoveredOnly={showCoveredOnly}
              showBeforeAfter={showBeforeAfter}
              onHoverSite={setHoveredSite}
              onClickSite={setSelectedSiteDetail}
            />

            {hoveredSite && (
              <div className="p6-site-tooltip">
                <div className="st-rank">#{hoveredSite.rank}</div>
                <div className="st-class">{siteLabel(hoveredSite.site_class)}</div>
                <div className="st-gap">Score: {(hoveredSite.score || 0).toFixed(3)}</div>
              </div>
            )}

            {/* Map controls */}
            <div className="p6-map-controls">
              <label>
                <input type="checkbox" checked={showCoverage} onChange={e => setShowCoverage(e.target.checked)} />
                3km coverage circles
              </label>
              <label>
                <input type="checkbox" checked={showCoveredOnly} onChange={e => setShowCoveredOnly(e.target.checked)} />
                Show covered hex only
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

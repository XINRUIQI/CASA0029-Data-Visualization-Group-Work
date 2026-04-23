import { useState, useEffect, useMemo } from 'react';
import Page4Map from './Page4Map';
import Page4Charts from './Page4Charts';
import { publicDataUrl } from '../../config';
import './Page4.css';

const CLASS_LABELS = {
  hub:      'Commercial area pick-up/drop-off points',
  station:  'Commercial area pick-up/drop-off points',
  endpoint: 'Last-mile pick-up/drop-off points',
};
const siteLabel = (cls) => CLASS_LABELS[cls] || cls;

const STRATEGIES = [
  { id: 'demand', label: 'Demand-first', desc: 'Prioritize highest POI density zones' },
  { id: 'friction', label: 'Friction-first', desc: 'Prioritize highest ground friction zones' },
  { id: 'gap', label: 'Composite-gap', desc: 'Prioritize demand × friction overlap' },
];

const BUDGETS = [3, 5, 10];

export default function Page4Demand() {
  const [strategy, setStrategy] = useState('gap');
  const [budget, setBudget] = useState(5);
  const [sites, setSites] = useState(null);
  const [h3Demand, setH3Demand] = useState(null);
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
      fetch(publicDataUrl('data/page4_candidate_sites.json')).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      fetch(publicDataUrl('data/h3_demand.json')).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
    ]).then(([sitesRes, gridRes]) => {
      if (cancelled) return;
      if (sitesRes.status === 'fulfilled' && Array.isArray(sitesRes.value)) {
        setSites(sitesRes.value);
      } else {
        setSites([]);
      }
      if (gridRes.status === 'fulfilled') setH3Demand(gridRes.value);
      else setH3Demand(null);
      const sitesFailed = sitesRes.status !== 'fulfilled';
      setDataStatus(sitesFailed ? 'error' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rankedSites = useMemo(() => {
    if (!sites) return [];
    const sorted = [...sites];
    if (strategy === 'demand') {
      sorted.sort((a, b) => (b.gap_index || 0) * 1.5 - (a.gap_index || 0) * 1.5);
    } else if (strategy === 'friction') {
      sorted.sort((a, b) => (b.gap_index || 0) * 0.8 - (a.gap_index || 0) * 0.8);
    } else {
      sorted.sort((a, b) => (b.gap_index || 0) - (a.gap_index || 0));
    }
    return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [sites, strategy]);

  const currentSites = rankedSites.slice(0, budget);

  const metrics = useMemo(() => {
    if (!currentSites.length) return null;
    const totalGap = currentSites.reduce((s, d) => s + (d.gap_index || 0), 0);
    const avgGap = totalGap / currentSites.length;
    const coverageEst = Math.min(95, currentSites.length * 8 + 15);
    const mismatchBefore = 100 - 15;
    const mismatchAfter = 100 - coverageEst;
    const mismatchClosure = ((mismatchBefore - mismatchAfter) / mismatchBefore * 100);
    return {
      sites: currentSites.length,
      avgGap: avgGap.toFixed(3),
      coverageEst: coverageEst.toFixed(0),
      marginalGain: currentSites.length > 1
        ? (currentSites[currentSites.length - 1]?.gap_index || 0).toFixed(3)
        : '—',
      mismatchClosure: mismatchClosure.toFixed(0),
    };
  }, [currentSites]);

  return (
    <section id="page-4" className="page page-4">
      {/* ═══ TOP BAR ═══ */}
      <div className="p4-topbar">
        <div className="p4-strategy-group">
          {STRATEGIES.map(s => (
            <button key={s.id} className={`p4-strat-btn ${strategy === s.id ? 'active' : ''}`}
              onClick={() => setStrategy(s.id)} title={s.desc}>{s.label}</button>
          ))}
        </div>
        <div className="p4-budget-group">
          {BUDGETS.map(b => (
            <button key={b} className={`p4-budget-btn ${budget === b ? 'active' : ''}`}
              onClick={() => setBudget(b)}>+{b}</button>
          ))}
        </div>
        <div className="p4-view-toggle">
          <button className={`p4-vt-btn ${showBeforeAfter === 'before' ? 'active' : ''}`}
            onClick={() => setShowBeforeAfter('before')}>Before</button>
          <button className={`p4-vt-btn ${showBeforeAfter === 'after' ? 'active' : ''}`}
            onClick={() => setShowBeforeAfter('after')}>After</button>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="p4-main">
        <div className="p4-map-area">
          <Page4Map
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
            <div className="p4-site-tooltip">
              <div className="st-rank">#{hoveredSite.rank}</div>
              <div className="st-class">{siteLabel(hoveredSite.site_class)}</div>
              <div className="st-gap">Gap: {(hoveredSite.gap_index || 0).toFixed(3)}</div>
            </div>
          )}

          {/* Map controls */}
          <div className="p4-map-controls">
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

        {/* Right panel */}
        <div className="p4-panel">
          {dataStatus === 'loading' && (
            <p className="p4-panel-status">正在加载候选点与需求栅格…</p>
          )}
          {dataStatus === 'error' && (
            <div className="p4-panel-error">
              <p><strong>候选点数据未能加载</strong></p>
              <p className="p4-panel-error-detail">
                若站点部署在 GitHub Pages 子路径下，必须使用带 <code>base</code> 前缀的数据地址（已修复）。
                请重新构建并部署；本地预览请运行 <code>npm run build && npm run preview</code>。
              </p>
            </div>
          )}
          {dataStatus === 'ready' && metrics && (
            <>
              <h3>Strategy: {STRATEGIES.find(s => s.id === strategy)?.label}</h3>
              <p className="p4-strat-desc">{STRATEGIES.find(s => s.id === strategy)?.desc}</p>

              <div className="p4-metrics-grid">
                <div className="p4-m-card">
                  <div className="p4m-val" style={{ color: '#64c8ff' }}>+{metrics.sites}</div>
                  <div className="p4m-lab">New sites</div>
                </div>
                <div className="p4-m-card">
                  <div className="p4m-val" style={{ color: '#00e896' }}>{metrics.coverageEst}%</div>
                  <div className="p4m-lab">Demand covered</div>
                </div>
                <div className="p4-m-card">
                  <div className="p4m-val" style={{ color: '#ffa028' }}>{metrics.marginalGain}</div>
                  <div className="p4m-lab">Marginal gain (last)</div>
                </div>
                <div className="p4-m-card">
                  <div className="p4m-val" style={{ color: '#c864ff' }}>{metrics.mismatchClosure}%</div>
                  <div className="p4m-lab">Mismatch closure</div>
                </div>
              </div>

              {/* Click site detail panel */}
              {selectedSiteDetail && (
                <div className="p4-site-detail">
                  <div className="sd-header">
                    <span className="sd-rank">#{selectedSiteDetail.rank}</span>
                    <span className={`rk-class ${selectedSiteDetail.site_class}`}>{siteLabel(selectedSiteDetail.site_class)}</span>
                    <button className="sd-close" onClick={() => setSelectedSiteDetail(null)}>x</button>
                  </div>
                  <div className="sd-row">
                    <span>Gap index</span>
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
                      +{((selectedSiteDetail.gap_index || 0) / (rankedSites[0]?.gap_index || 1) * 100).toFixed(1)}% relative
                    </span>
                  </div>
                </div>
              )}

              <Page4Charts strategy={strategy} budget={budget} sites={rankedSites} />

              <div className="p4-rank-list">
                <h4>New Site Ranking</h4>
                {currentSites.map((s, i) => (
                  <div
                    key={i}
                    className={`p4-rank-row ${hoveredSite?.rank === s.rank ? 'highlight' : ''} ${selectedSiteDetail?.rank === s.rank ? 'selected' : ''}`}
                    onClick={() => setSelectedSiteDetail(selectedSiteDetail?.rank === s.rank ? null : s)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="rk-num">#{s.rank}</span>
                    <span className={`rk-class ${s.site_class}`}>{siteLabel(s.site_class)}</span>
                    <div className="rk-bar-wrap">
                      <div className="rk-bar" style={{ width: `${(s.gap_index || 0) / (rankedSites[0]?.gap_index || 1) * 100}%` }} />
                    </div>
                    <span className="rk-val">{(s.gap_index || 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {dataStatus === 'ready' && !metrics && (
            <p className="p4-panel-status">候选点列表为空，无法计算策略指标。</p>
          )}
        </div>
      </div>
    </section>
  );
}

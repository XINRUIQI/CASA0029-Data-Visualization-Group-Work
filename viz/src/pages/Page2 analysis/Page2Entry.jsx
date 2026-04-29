import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Page2Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

export default function Page2Entry() {
  const navigate = useNavigate();
  const [heroOpen, setHeroOpen] = useState(false);
  const [stageRevealed, setStageRevealed] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setShowContent(true);
  }, []);

  const goToMainStage = useCallback(() => {
    setStageRevealed(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => handleIntroComplete(), 80);
    return () => clearTimeout(t);
  }, [handleIntroComplete]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHeroOpen(true);
      setStageRevealed(true);
      return;
    }
    const id = requestAnimationFrame(() => setHeroOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (stageRevealed) return;
    const el = document.getElementById('page-2');
    if (!el) return;
    const onWheel = (e) => {
      if (e.deltaY > 12) goToMainStage();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stageRevealed, goToMainStage]);

  useEffect(() => {
    if (stageRevealed) return;
    let startY = null;
    const el = document.getElementById('page-2');
    if (!el) return;
    const onStart = (e) => {
      startY = e.touches[0]?.clientY ?? null;
    };
    const onEnd = (e) => {
      if (startY == null) return;
      const endY = e.changedTouches[0]?.clientY;
      if (endY != null && startY - endY > 48) goToMainStage();
      startY = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [stageRevealed, goToMainStage]);

  return (
    <section id="page-2" className={`page page-2-entry ${stageRevealed ? 'page-2-entry--unlocked' : ''}`}>
      <div className={`p2e-scroll-stack ${stageRevealed ? 'p2e-scroll-stack--up' : ''}`}>
        <div className={`p2e-panel p2e-panel--hero ${heroOpen ? 'p2e-panel--hero--open' : ''}`}>
          <div className={`p2e-metalab-hero ${heroOpen ? 'p2e-metalab-hero--open' : ''}`}>
            <p className="p2e-metalab-kicker">Chapter 2 · Friction analysis</p>
            <h1 className="p2e-metalab-title">
              Where Is Ground Delivery Most Constrained?
            </h1>
            <div className="p2e-metalab-meta">
              <div className="p2e-metalab-meta-col">
                <span className="p2e-metalab-meta-label">Focus</span>
                <span className="p2e-metalab-meta-value">Urban barriers &amp; demand</span>
              </div>
              <div className="p2e-metalab-meta-col">
                <span className="p2e-metalab-meta-label">Data</span>
                <span className="p2e-metalab-meta-value">H3 grid · OD samples · Barriers</span>
              </div>
              <div className="p2e-metalab-meta-col">
                <span className="p2e-metalab-meta-label">Outputs</span>
                <span className="p2e-metalab-meta-value">Maps · Priority layer</span>
              </div>
            </div>
            <button type="button" className="p2e-metalab-cta" onClick={goToMainStage}>
              Continue
              <span className="p2e-metalab-cta-arrow" aria-hidden>↑</span>
            </button>
            <p className="p2e-metalab-hint">上滑 · 横向展开下一屏</p>
          </div>
        </div>

        <div className={`p2e-panel p2e-panel--main ${stageRevealed ? 'p2e-panel--main--open' : ''}`}>
          <div className={`p2e-content ${showContent ? 'p2e-visible' : ''}`}>
            <p className="p2e-kicker">Chapter 2</p>
            <h2 className="p2e-title">Where Is Ground Delivery Most Constrained?</h2>
            <p className="p2e-subtitle">
              Mapping demand hotspots, urban barriers, and delivery inefficiency
            </p>
            <p className="p2e-desc">
              Before optimising drone delivery hubs, we first examine where delivery demand is concentrated and where
              ground transport faces spatial barriers. Rivers, railways, and expressways can create detours and reduce
              last-mile efficiency. By mapping demand, barriers, and supply–demand mismatch, this section identifies areas
              where drone delivery may provide the greatest benefit.
            </p>

            <div className="p2e-stats">
              {STATS.map(s => (
                <div key={s.label} className="p2e-stat-card">
                  <div className="p2e-stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="p2e-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <button className="p2e-enter-btn" onClick={() => navigate('/analysis')}>
              <span className="p2e-btn-text">Enter Interactive Analysis Map</span>
              <span className="p2e-btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

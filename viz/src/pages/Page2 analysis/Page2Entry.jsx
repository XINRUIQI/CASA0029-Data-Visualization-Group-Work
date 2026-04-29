import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Page2Entry.css';

const STATS = [
  { value: '490K+', label: 'Delivery Destinations', color: '#ff8c00' },
  { value: '4', label: 'Barrier Types', color: '#ff3264' },
  { value: '1.5×', label: 'Avg Detour Ratio', color: '#c864ff' },
];

const SECTION_TITLE = 'Where Is Ground Delivery Most Constrained?';
const SECTION_SUB =
  'Mapping demand hotspots, urban barriers, and delivery inefficiency';
const SECTION_BODY =
  'Before optimising drone delivery hubs, we first examine where delivery demand is concentrated and where '
  + 'ground transport faces spatial barriers. Rivers, railways, and expressways can create detours and reduce '
  + 'last-mile efficiency. By mapping demand, barriers, and supply–demand mismatch, this section identifies areas '
  + 'where drone delivery may provide the greatest benefit.';

const AUTO_DROP_DELAY_MS = 2000;

function readNoIntroFromEntry(location) {
  if (typeof window === 'undefined') return false;
  if (location?.state?.page2SkipIntro === true) return true;
  try {
    return sessionStorage.getItem('page2SkipIntro') === '1';
  } catch {
    return false;
  }
}

export default function Page2Entry() {
  const navigate = useNavigate();
  const location = useLocation();
  const [noIntro] = useState(() => readNoIntroFromEntry(location));
  const clearedStorage = useRef(false);

  const [surfaceDown, setSurfaceDown] = useState(false);
  const [showContent, setShowContent] = useState(noIntro);

  const goDropHalf = useCallback(() => {
    setSurfaceDown(true);
  }, []);

  useEffect(() => {
    if (!noIntro || clearedStorage.current) return;
    clearedStorage.current = true;
    try {
      sessionStorage.removeItem('page2SkipIntro');
    } catch { /* ignore */ }
  }, [noIntro]);

  useEffect(() => {
    if (noIntro) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShowContent(true);
      setSurfaceDown(true);
      return;
    }
    const id = requestAnimationFrame(() => setShowContent(true));
    return () => cancelAnimationFrame(id);
  }, [noIntro]);

  useEffect(() => {
    if (noIntro || surfaceDown) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setSurfaceDown(true), AUTO_DROP_DELAY_MS);
    return () => clearTimeout(t);
  }, [noIntro, surfaceDown]);

  useEffect(() => {
    if (noIntro || surfaceDown) return;
    const el = document.getElementById('page-2');
    if (!el) return;
    const onWheel = (e) => {
      if (e.deltaY > 12) goDropHalf();
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [noIntro, surfaceDown, goDropHalf]);

  useEffect(() => {
    if (noIntro || surfaceDown) return;
    let startY = null;
    const el = document.getElementById('page-2');
    if (!el) return;
    const onStart = (e) => {
      startY = e.touches[0]?.clientY ?? null;
    };
    const onEnd = (e) => {
      if (startY == null) return;
      const endY = e.changedTouches[0]?.clientY;
      if (endY != null && startY - endY > 48) goDropHalf();
      startY = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [noIntro, surfaceDown, goDropHalf]);

  return (
    <section
      id="page-2"
      className={
        'page page-2-entry' +
        (surfaceDown ? ' page-2-entry--settled' : '') +
        (noIntro ? ' page-2-entry--no-intro' : '')
      }
    >
      <div className="p2e-behind" aria-hidden={!surfaceDown}>
        <div className="p2e-behind-inner">
          <h1 className="p2e-behind-title">{SECTION_TITLE}</h1>
          <p className="p2e-behind-sub">{SECTION_SUB}</p>
          <p className="p2e-behind-body">{SECTION_BODY}</p>
        </div>
      </div>

      <div className={`p2e-surface ${surfaceDown ? 'p2e-surface--down' : ''}`}>
        <div className={`p2e-content ${showContent ? 'p2e-visible' : ''}`}>
          <p className="p2e-kicker">Chapter 2</p>
          <h2 className="p2e-title">{SECTION_TITLE}</h2>
          <p className="p2e-subtitle">{SECTION_SUB}</p>
          <p className="p2e-desc">{SECTION_BODY}</p>

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

          {!noIntro && !surfaceDown && (
            <>
              <button type="button" className="p2e-surface-cta" onClick={goDropHalf}>
                Continue
                <span className="p2e-surface-cta-arrow" aria-hidden>↓</span>
              </button>
              <p className="p2e-surface-hint">上滑 · 或稍候 · 降半屏见内页</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

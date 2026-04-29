import { useMemo } from 'react';
import './MapControls.css';

const SCALE_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000,
];
const SCALE_TARGET_PX = 110;

function computeScale(viewState) {
  const lat = viewState.latitude ?? 0;
  const zoom = viewState.zoom ?? 10;
  const metersPerPx =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const raw = metersPerPx * SCALE_TARGET_PX;
  let snapped = SCALE_STEPS[0];
  for (const s of SCALE_STEPS) if (s <= raw) snapped = s;
  const px = snapped / metersPerPx;
  const label = snapped >= 1000 ? `${snapped / 1000} km` : `${snapped} m`;
  return { px, label };
}

export default function MapControls({
  viewState,
  onResetView,
  onResetBearing,
  cameraFollow,
  onToggleCameraFollow,
  /** 'bottom' (default) | 'top' — top uses upper-right to avoid compass stack */
  scalePlacement = 'bottom',
}) {
  const scale = useMemo(() => computeScale(viewState), [viewState]);
  const bearing = viewState.bearing ?? 0;
  const scaleClass =
    scalePlacement === 'top' ? 'mc-scale mc-scale--top' : 'mc-scale';

  return (
    <>
      <div className="mc-nav">
        <button className="mc-btn" onClick={onResetView} title="Reset view" aria-label="Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
        </button>
        {typeof onToggleCameraFollow === 'function' && (
          <button
            type="button"
            className={`mc-btn${cameraFollow ? ' mc-btn-follow-on' : ''}`}
            onClick={onToggleCameraFollow}
            title={cameraFollow ? 'Stop following delivery' : 'Follow delivery agent'}
            aria-pressed={cameraFollow ? 'true' : 'false'}
            aria-label={cameraFollow ? 'Stop follow' : 'Follow agent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </button>
        )}
        <button className="mc-btn mc-compass" onClick={onResetBearing}
          title="Reset bearing" aria-label="Reset bearing">
          <span className="mc-compass-inner" style={{ transform: `rotate(${-bearing}deg)` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="9" />
              <polygon points="12,4 14.2,12 12,10.6 9.8,12" fill="#ff5a5a" stroke="#ff5a5a" />
              <polygon points="12,20 9.8,12 12,13.4 14.2,12" fill="currentColor" />
            </svg>
          </span>
          <span className="mc-compass-n">N</span>
        </button>
      </div>

      <div className={scaleClass} aria-label={`Scale: ${scale.label}`}>
        <div className="mc-scale-line" style={{ width: `${scale.px}px` }} />
        <div className="mc-scale-label">{scale.label}</div>
      </div>
    </>
  );
}

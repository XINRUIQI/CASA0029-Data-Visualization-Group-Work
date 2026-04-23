import { useMemo, useState } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM, SHENZHEN_MAX_BOUNDS } from '../../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const CLASS_COLORS = {
  hub: [255, 50, 50, 220],
  station: [255, 180, 0, 200],
  endpoint: [100, 200, 255, 180],
};

const VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 0,
  bearing: 0,
};

// Nice round distances we will snap the scale bar to (in metres).
const SCALE_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000,
];
const SCALE_TARGET_PX = 120;

/**
 * Compute a dynamic scale bar length + label from the current Web Mercator
 * view state. Formula: at zoom z on Web Mercator, 1 screen pixel ≈
 *   156543.03392 * cos(latitude) / 2^z  metres.
 */
function computeScale(viewState) {
  const lat = viewState.latitude;
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, viewState.zoom);
  const targetMeters = metersPerPixel * SCALE_TARGET_PX;
  let snapped = SCALE_STEPS[0];
  for (const step of SCALE_STEPS) {
    if (step <= targetMeters) snapped = step;
  }
  const px = snapped / metersPerPixel;
  const label = snapped >= 1000 ? `${snapped / 1000} km` : `${snapped} m`;
  return { px, label };
}

export default function Page6Map({ sites, allSites, h3Demand, showCoverage, showCoveredOnly, showBeforeAfter, onHoverSite, onClickSite }) {
  const [viewState, setViewState] = useState(VIEW);

  const scale = useMemo(() => computeScale(viewState), [viewState]);

  const resetView = () => setViewState(VIEW);
  const resetBearing = () =>
    setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }));

  const layers = [];

  if (h3Demand && showBeforeAfter === 'before') {
    layers.push(
      new H3HexagonLayer({
        id: 'demand-bg',
        data: h3Demand,
        getHexagon: d => d.h3,
        getFillColor: d => {
          const dp = d.dp || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 160 * (1 - v), 0, 25 + 120 * v];
        },
        extruded: false,
        stroked: true,
        getLineColor: [255, 255, 255, 8],
        getLineWidth: 1,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  if (h3Demand && showBeforeAfter === 'after') {
    layers.push(
      new H3HexagonLayer({
        id: 'demand-bg-after',
        data: h3Demand,
        getHexagon: d => d.h3,
        getFillColor: d => {
          const dp = d.dp || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 140 * (1 - v), 30, 10 + 45 * v];
        },
        extruded: false,
        stroked: true,
        getLineColor: [255, 255, 255, 5],
        getLineWidth: 1,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  if (showCoverage && showBeforeAfter === 'after' && sites?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'coverage-fill',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 3000,
        getFillColor: [100, 200, 255, 20],
        getLineColor: [100, 200, 255, 50],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
      })
    );

    if (h3Demand) {
      layers.push(
        new H3HexagonLayer({
          id: 'newly-covered',
          data: h3Demand,
          getHexagon: d => d.h3,
          getFillColor: d => {
            const dp = d.dp || 0;
            if (dp < 20 && showCoveredOnly) return [0, 0, 0, 0];
            return [0, 232, 150, 40 + Math.min(dp / 100, 1) * 100];
          },
          extruded: false,
          stroked: false,
          updateTriggers: { getFillColor: [showCoveredOnly, sites] },
        })
      );
    }
  }

  if (allSites?.length) {
    const unselected = allSites.filter(s => !sites?.some(sel => sel.lon === s.lon && sel.lat === s.lat));
    layers.push(
      new ScatterplotLayer({
        id: 'ghost-sites',
        data: unselected,
        getPosition: d => [d.lon, d.lat],
        getRadius: 100,
        getFillColor: [80, 80, 100, 60],
        radiusMinPixels: 2,
        radiusMaxPixels: 6,
      })
    );
  }

  if (sites?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'site-glow',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 600,
        getFillColor: d => [...(CLASS_COLORS[d.site_class] || [200, 200, 200]).slice(0, 3), 40],
        radiusMinPixels: 10,
        radiusMaxPixels: 35,
      })
    );
    layers.push(
      new ScatterplotLayer({
        id: 'selected-sites',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 200,
        getFillColor: d => CLASS_COLORS[d.site_class] || [200, 200, 200, 200],
        radiusMinPixels: 5,
        radiusMaxPixels: 16,
        pickable: true,
        onHover: info => onHoverSite?.(info.object || null),
        onClick: info => onClickSite?.(info.object || null),
      })
    );
  }

  return (
    <div className="p6-map-root">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
          maxBounds={SHENZHEN_MAX_BOUNDS}
          minZoom={9}
          maxZoom={14}
        />
      </DeckGL>

      {/* ── navigation controls: home / compass ── */}
      <div className="p6-nav-controls">
        <button
          className="p6-nav-btn"
          onClick={resetView}
          title="Reset to initial view"
          aria-label="Home"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
        </button>
        <button
          className="p6-nav-btn p6-nav-compass"
          onClick={resetBearing}
          title="Reset rotation to north"
          aria-label="Reset bearing"
        >
          <span
            className="p6-compass-inner"
            style={{ transform: `rotate(${-viewState.bearing}deg)` }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="12" cy="12" r="9" />
              <polygon points="12,4 14.2,12 12,10.6 9.8,12" fill="#ff5a5a" stroke="#ff5a5a" />
              <polygon points="12,20 9.8,12 12,13.4 14.2,12" fill="currentColor" />
            </svg>
          </span>
          <span className="p6-compass-label">N</span>
        </button>
      </div>

      {/* ── scale bar ── */}
      <div className="p6-scale-bar" aria-label={`Scale: ${scale.label}`}>
        <div className="p6-scale-line" style={{ width: `${scale.px}px` }} />
        <div className="p6-scale-label">{scale.label}</div>
      </div>
    </div>
  );
}

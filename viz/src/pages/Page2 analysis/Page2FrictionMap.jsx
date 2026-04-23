import { useState, useMemo } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER } from '../../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const BARRIER_COLORS = {
  water: [70, 130, 220, 140],
  waterway: [100, 160, 240, 100],
  railway: [160, 160, 160, 180],
  highway_major: [220, 60, 60, 140],
};

const VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

// Nice-number scale bar: pick the largest "nice" length (1/2/5 × 10^n meters)
// that fits under a target pixel width, given the current zoom/latitude.
const SCALE_OPTIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000];
function computeScale(vs, targetPx = 110) {
  const mpp = (40075016.686 * Math.abs(Math.cos(vs.latitude * Math.PI / 180)))
              / Math.pow(2, vs.zoom + 8);
  const rawMeters = targetPx * mpp;
  let nice = SCALE_OPTIONS[0];
  for (const v of SCALE_OPTIONS) if (v <= rawMeters) nice = v;
  const widthPx = nice / mpp;
  const label = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
  return { widthPx, label };
}

function hexColor(mode, d, highlight, tw) {
  if (!d) return [80, 80, 80, 40];

  if (highlight) {
    const match = highlight(d);
    if (match === false) return [40, 40, 50, 15];
    if (match === true) return [0, 255, 200, 220];
  }

  const dp = d.dp || 0;
  const fr = d.avg_friction || 0;
  const tdi = d.takeout_demand_index || 0;
  if (mode === 'supply') {
    const v = Math.min(dp / 200, 1);
    return [255, Math.round(160 * (1 - v)), 0, Math.round(10 + 220 * v)];
  }
  if (mode === 'demand') {
    const v = Math.min(tdi, 1) * tw;
    return [255, Math.round(100 * (1 - v)), Math.round(50 * (1 - v)), Math.round(15 + 220 * v)];
  }
  if (mode === 'friction') {
    const v = Math.min(fr, 1);
    return [255, 50 * (1 - v), 100 * (1 - v), 30 + 200 * v];
  }
  if (mode === 'priority') {
    const dv = Math.min(tdi, 1) * tw;
    const fv = Math.min(fr, 1);
    const v = dv * fv;
    return [120 + 135 * v, 40 * (1 - v), 180 + 75 * v, 30 + 200 * v];
  }
  return [80, 80, 80, 40];
}

export default function Page2FrictionMap({
  barriers, activeBarriers, showBarriers, activeMode,
  h3Demand, h3Gap, h3Takeout, routes, showRoutes, onHoverHex, highlightFilter,
  timeWeight = 1
}) {
  const [viewState, setViewState] = useState(VIEW);

  const mergedHex = useMemo(() => {
    if (!h3Demand) return null;
    const gapMap = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    const takeoutMap = new window.Map((h3Takeout || []).map(t => [t.h3, t]));
    return h3Demand.map(d => {
      const gap = gapMap.get(d.h3);
      const tk = takeoutMap.get(d.h3);
      return {
        ...d,
        avg_friction: gap?.avg_friction || 0,
        gap_index: gap?.gap_index || 0,
        food_count: d.food || gap?.food_count || 0,
        retail_count: d.retail || gap?.retail_count || 0,
        edu_count: d.edu || gap?.education_count || 0,
        med_count: d.med || gap?.medical_count || 0,
        scenic_count: d.scenic || gap?.scenic_count || 0,
        leisure_count: d.leisure || gap?.leisure_count || 0,
        pop_count: tk?.pop_count || gap?.pop_count || 0,
        real_order_count: tk?.real_order_count || 0,
        real_order_density: tk?.real_order_density || 0,
        takeout_demand_index: tk?.takeout_demand_index || 0,
        takeout_demand_norm: tk?.takeout_demand_norm || 0,
        food_access_1km: tk?.food_access_1km || 0,
        food_access_2km: tk?.food_access_2km || 0,
        food_access_3km: tk?.food_access_3km || 0,
        xiaoqu_count: tk?.xiaoqu_count || 0,
      };
    });
  }, [h3Demand, h3Gap, h3Takeout]);

  const layers = useMemo(() => {
    const result = [];

    if (showBarriers && barriers) {
      Object.entries(barriers)
        .filter(([type]) => activeBarriers.has(type))
        .forEach(([type, data]) => {
          result.push(
            new GeoJsonLayer({
              id: `barrier-${type}`,
              data,
              getFillColor: BARRIER_COLORS[type] || [128, 128, 128, 100],
              getLineColor: BARRIER_COLORS[type] || [128, 128, 128, 160],
              getLineWidth: type === 'railway' ? 3 : 2,
              lineWidthMinPixels: 1,
              opacity: 0.6,
              pickable: false,
            })
          );
        });
    }

    if (mergedHex) {
      result.push(
        new H3HexagonLayer({
          id: 'analysis-hex',
          data: mergedHex,
          getHexagon: d => d.h3,
          getFillColor: d => hexColor(activeMode, d, highlightFilter, timeWeight),
          getElevation: 0,
          extruded: false,
          pickable: true,
          stroked: false,
          updateTriggers: { getFillColor: [activeMode, highlightFilter, timeWeight] },
          onHover: info => {
            if (info.object) {
              onHoverHex?.(info.object);
            } else {
              onHoverHex?.(null);
            }
          },
        })
      );
    }

    if (showRoutes && routes) {
      result.push(
        new GeoJsonLayer({
          id: 'od-routes',
          data: routes,
          getLineColor: f => {
            const fr = f.properties?.ground_friction ?? 0;
            const v = Math.min(fr / 0.6, 1);
            return [0, Math.round(255 * (1 - v * 0.6)), Math.round(220 - 100 * v), 50 + Math.round(130 * v)];
          },
          getLineWidth: 1.5,
          lineWidthMinPixels: 0.5,
          lineWidthMaxPixels: 3,
          pickable: false,
        })
      );
    }

    return result;
  }, [barriers, activeBarriers, showBarriers, activeMode, mergedHex, routes, showRoutes, onHoverHex, highlightFilter, timeWeight]);

  const scale = computeScale(viewState);

  return (
    <>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
        useDevicePixels={false}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
        />
      </DeckGL>

      {/* Map controls: home / compass / scale */}
      <div className="p2f-ctrl">
        <button
          className="p2f-ctrl-btn"
          title="Reset view"
          onClick={() => setViewState(VIEW)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12 L12 3 L21 12" />
            <path d="M5 10 V21 H19 V10" />
          </svg>
        </button>

        <button
          className="p2f-ctrl-btn p2f-compass"
          title="Reset bearing"
          onClick={() => setViewState(v => ({ ...v, bearing: 0, pitch: 0 }))}
        >
          <svg width="28" height="28" viewBox="0 0 32 32"
               style={{ transform: `rotate(${-viewState.bearing}deg)`,
                        transition: 'transform 0.15s' }}>
            <circle cx="16" cy="16" r="14" fill="none"
                    stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <polygon points="16,4 20,16 16,13 12,16" fill="#ff4500" />
            <polygon points="16,28 20,16 16,19 12,16" fill="#888" />
            <text x="16" y="3.5" fill="#fff" fontSize="5"
                  textAnchor="middle" fontWeight="700">N</text>
          </svg>
        </button>

        <div className="p2f-scale">
          <div className="p2f-scale-bar" style={{ width: `${scale.widthPx}px` }} />
          <span className="p2f-scale-label">{scale.label}</span>
        </div>
      </div>
    </>
  );
}

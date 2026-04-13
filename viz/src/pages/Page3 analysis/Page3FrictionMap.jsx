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

function hexColor(mode, d, highlight, tw) {
  if (!d) return [80, 80, 80, 40];

  if (highlight) {
    const match = highlight(d);
    if (match === false) return [40, 40, 50, 15];
    if (match === true) return [0, 255, 200, 220];
  }

  const dp = d.dp || 0;
  const fr = d.avg_friction || 0;
  if (mode === 'demand') {
    const v = Math.min(dp / 200, 1) * tw;
    return [255, Math.round(160 * (1 - v)), 0, Math.round(10 + 220 * v)];
  }
  if (mode === 'friction') {
    const v = Math.min(fr, 1);
    return [255, 50 * (1 - v), 100 * (1 - v), 30 + 200 * v];
  }
  if (mode === 'overlap') {
    const dv = Math.min(dp / 200, 1);
    const fv = Math.min(fr, 1);
    const v = dv * fv;
    return [120 + 135 * v, 40 * (1 - v), 180 + 75 * v, 30 + 200 * v];
  }
  return [80, 80, 80, 40];
}

export default function Page3FrictionMap({
  barriers, activeBarriers, showBarriers, activeMode,
  h3Demand, h3Gap, routes, showRoutes, onHoverHex, highlightFilter,
  timeWeight = 1
}) {
  const [viewState, setViewState] = useState(VIEW);

  const mergedHex = useMemo(() => {
    if (!h3Demand) return null;
    const gapMap = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    return h3Demand.map(d => {
      const gap = gapMap.get(d.h3);
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
        pop_count: gap?.pop_count || 0,
      };
    });
  }, [h3Demand, h3Gap]);

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

  return (
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
  );
}

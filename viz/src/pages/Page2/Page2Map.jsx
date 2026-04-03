import { useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
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

function gridColor(mode, props) {
  if (!props) return [80, 80, 80, 40];
  const dp = props.demand_pressure || 0;
  const fr = props.avg_friction || props.ground_friction || 0;
  if (mode === 'demand') {
    const v = Math.min(dp / 200, 1);
    return [255, 160 * (1 - v), 0, 30 + 200 * v];
  }
  if (mode === 'friction') {
    const v = Math.min(fr, 1);
    return [255, 50 * (1 - v), 100 * (1 - v), 30 + 200 * v];
  }
  if (mode === 'overlap') {
    const d = Math.min(dp / 200, 1);
    const f = Math.min(fr, 1);
    const v = d * f;
    return [120 + 135 * v, 40 * (1 - v), 180 + 75 * v, 30 + 200 * v];
  }
  return [80, 80, 80, 40];
}

export default function Page2Map({
  barriers, activeBarriers, showBarriers, activeMode,
  demandGrid, frictionGrid, observedSites, scenarioFilter, onHoverHex
}) {
  const [viewState, setViewState] = useState(VIEW);

  const layers = [];

  // Barrier layers
  if (showBarriers && barriers) {
    Object.entries(barriers)
      .filter(([type]) => activeBarriers.has(type))
      .forEach(([type, data]) => {
        layers.push(
          new GeoJsonLayer({
            id: `barrier-${type}`,
            data,
            getFillColor: BARRIER_COLORS[type] || [128, 128, 128, 100],
            getLineColor: BARRIER_COLORS[type] || [128, 128, 128, 160],
            getLineWidth: type === 'railway' ? 3 : 2,
            lineWidthMinPixels: 1,
            opacity: 0.6,
          })
        );
      });
  }

  // Demand / Friction / Overlap grid layer
  if (activeMode !== 'observed' && demandGrid) {
    layers.push(
      new GeoJsonLayer({
        id: 'analysis-grid',
        data: demandGrid,
        getFillColor: f => gridColor(activeMode, f.properties),
        getLineColor: [255, 255, 255, 15],
        getLineWidth: 0.5,
        lineWidthMinPixels: 0.5,
        pickable: true,
        onHover: info => {
          if (info.object) {
            onHoverHex?.({
              demand: info.object.properties?.demand_pressure,
              friction: info.object.properties?.avg_friction || info.object.properties?.ground_friction,
              gap: (info.object.properties?.demand_pressure || 0) / 200 *
                   (info.object.properties?.avg_friction || info.object.properties?.ground_friction || 0),
            });
          } else {
            onHoverHex?.(null);
          }
        },
      })
    );
  }

  // Observed sites overlay (新增)
  if (observedSites && (activeMode === 'observed' || activeMode === 'overlap')) {
    const filtered = scenarioFilter === 'all'
      ? observedSites
      : observedSites.filter(s => s.scenario === scenarioFilter);

    layers.push(
      new ScatterplotLayer({
        id: 'observed-glow',
        data: filtered,
        getPosition: d => [d.lon, d.lat],
        getRadius: 600,
        getFillColor: [0, 232, 150, 40],
        radiusMinPixels: 10,
        radiusMaxPixels: 40,
      })
    );
    layers.push(
      new ScatterplotLayer({
        id: 'observed-dots',
        data: filtered,
        getPosition: d => [d.lon, d.lat],
        getRadius: 150,
        getFillColor: [0, 232, 150, 220],
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        pickable: true,
      })
    );
  }

  return (
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
      />
    </DeckGL>
  );
}

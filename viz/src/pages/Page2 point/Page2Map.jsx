import { useState } from 'react';
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

function hexColor(mode, d) {
  if (!d) return [80, 80, 80, 40];
  const dp = d.dp || 0;
  const fr = d.avg_friction || 0;
  if (mode === 'demand') {
    const v = Math.min(dp / 200, 1);
    return [255, 160 * (1 - v), 0, 30 + 200 * v];
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

export default function Page2Map({
  barriers, activeBarriers, showBarriers, activeMode,
  h3Demand, h3Gap, observedSites, scenarioFilter, onHoverHex
}) {
  const [viewState, setViewState] = useState(VIEW);

  const layers = [];

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

  // H3 hex grid layer — merged demand + gap data
  if (activeMode !== 'observed' && h3Demand) {
    const gapMap = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    const merged = h3Demand.map(d => ({
      ...d,
      avg_friction: gapMap.get(d.h3)?.avg_friction || 0,
      gap_index: gapMap.get(d.h3)?.gap_index || 0,
    }));

    layers.push(
      new H3HexagonLayer({
        id: 'analysis-hex',
        data: merged,
        getHexagon: d => d.h3,
        getFillColor: d => hexColor(activeMode, d),
        getElevation: 0,
        extruded: false,
        pickable: true,
        stroked: true,
        getLineColor: [255, 255, 255, 15],
        getLineWidth: 1,
        lineWidthMinPixels: 0.5,
        updateTriggers: { getFillColor: [activeMode] },
        onHover: info => {
          if (info.object) {
            onHoverHex?.({
              demand: info.object.dp,
              friction: info.object.avg_friction,
              gap: info.object.gap_index,
            });
          } else {
            onHoverHex?.(null);
          }
        },
      })
    );
  }

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

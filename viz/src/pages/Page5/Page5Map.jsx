import { useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM } from '../../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 0,
  bearing: 0,
};

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export default function Page5Map({
  gridGeoJson,
  mode,
  selectedTask,
  highPriorityOnly,
  priorityThreshold,
  onPick,
  selectedGridId,
}) {
  const [viewState, setViewState] = useState(VIEW);
  const [hover, setHover] = useState(null);

  const handleClick = useCallback(
    info => {
      if (info.object) onPick?.(info.object);
    },
    [onPick]
  );

  const layers = [];
  if (gridGeoJson?.features?.length) {
    layers.push(
      new GeoJsonLayer({
        id: 'relief-grid',
        data: gridGeoJson,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 100],
        getFillColor: f => {
          const p = f.properties || {};
          const relief = p.relief_vulnerability ?? 0;
          const taskW = p.task_weight ?? 1;
          let v = relief * (selectedTask === 'all' ? 1 : 0.35 + 0.65 * taskW);
          if (highPriorityOnly && (p.relief_vulnerability ?? 0) < priorityThreshold) {
            return [20, 22, 40, 20];
          }
          if (mode === 'ground') {
            const ease = 1 - v;
            const rgb = lerpColor([40, 48, 70], [120, 220, 160], ease);
            const a = Math.round(30 + 140 * ease);
            return [...rgb, a];
          }
          if (mode === 'hybrid') {
            const rgb = lerpColor([60, 80, 120], [255, 120, 60], v);
            const a = Math.round(35 + 110 * v);
            return [...rgb, a];
          }
          const rgb = lerpColor([30, 40, 80], [255, 70, 120], v);
          const a = Math.round(40 + 130 * v);
          return [...rgb, a];
        },
        getLineColor: f => {
          const id = f.properties?.grid_id;
          if (selectedGridId != null && id === selectedGridId) return [255, 255, 255, 220];
          return [255, 255, 255, 12];
        },
        getLineWidth: f => (selectedGridId != null && f.properties?.grid_id === selectedGridId ? 2 : 0.4),
        lineWidthUnits: 'pixels',
        updateTriggers: {
          getFillColor: [mode, selectedTask, highPriorityOnly, priorityThreshold],
          getLineColor: [selectedGridId],
          getLineWidth: [selectedGridId],
        },
        onHover: info => setHover(info.object ? info : null),
        onClick: handleClick,
      })
    );
  }

  return (
    <div className="p5-map-inner">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layers}
        getCursor={({ isDragging, isHovering }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
        style={{ width: '100%', height: '100%' }}
      >
        <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle="mapbox://styles/mapbox/dark-v11" reuseMaps />
      </DeckGL>
      {hover?.object && (
        <div className="p5-map-tooltip">
          <div className="p5-tt-id">Grid #{hover.object.properties?.grid_id}</div>
          <div className="p5-tt-row">
            缓解脆弱度 <strong>{(hover.object.properties?.relief_vulnerability ?? 0).toFixed(2)}</strong>
          </div>
          <div className="p5-tt-row">替代潜力（排序用）{(hover.object.properties?.substitution_potential ?? 0).toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}

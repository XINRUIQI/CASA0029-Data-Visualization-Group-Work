import { useState, useEffect, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM } from '../../config';
import { COMPOUND_COLORS } from './Page1Landing';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

const INITIAL_VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 30,
  bearing: -15,
  transitionDuration: 0,
};

function getColor(d, alpha = 220) {
  const c = COMPOUND_COLORS[d.compound_type];
  return c ? [...c.rgb, alpha] : [180, 180, 180, alpha];
}

export default function Page1Map({ data, showPlanned, showExisting, flyTo }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    if (flyTo) {
      setViewState(prev => ({
        ...prev,
        longitude: flyTo[0],
        latitude: flyTo[1],
        zoom: 13.5,
        pitch: 45,
        bearing: -10,
        transitionDuration: 1200,
      }));
    } else {
      setViewState(prev => ({
        ...prev,
        ...INITIAL_VIEW,
        transitionDuration: 800,
      }));
    }
  }, [flyTo]);

  const onHover = useCallback(info => {
    setHoverInfo(info.object ? info : null);
  }, []);

  const layers = [];

  if (data) {
    const existing = data.filter(d => d.status === 'existing');
    const planned = data.filter(d => d.status === 'planned');

    if (showExisting && existing.length) {
      layers.push(
        new ScatterplotLayer({
          id: 'existing-glow',
          data: existing,
          getPosition: d => [d.lon, d.lat],
          getRadius: 800,
          getFillColor: d => getColor(d, 40),
          radiusMinPixels: 8,
          radiusMaxPixels: 40,
          updateTriggers: { getFillColor: [data] },
        }),
        new ScatterplotLayer({
          id: 'existing-sites',
          data: existing,
          getPosition: d => [d.lon, d.lat],
          getRadius: 200,
          getFillColor: d => getColor(d, 220),
          getLineColor: [255, 255, 255, 120],
          lineWidthMinPixels: 1,
          stroked: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 16,
          pickable: true,
          onHover,
          updateTriggers: { getFillColor: [data] },
        })
      );
    }

    if (showPlanned && planned.length) {
      layers.push(
        new ScatterplotLayer({
          id: 'planned-glow',
          data: planned,
          getPosition: d => [d.lon, d.lat],
          getRadius: 600,
          getFillColor: d => getColor(d, 30),
          radiusMinPixels: 6,
          radiusMaxPixels: 30,
          updateTriggers: { getFillColor: [data] },
        }),
        new ScatterplotLayer({
          id: 'planned-sites',
          data: planned,
          getPosition: d => [d.lon, d.lat],
          getRadius: 150,
          getFillColor: d => getColor(d, 200),
          radiusMinPixels: 3,
          radiusMaxPixels: 12,
          pickable: true,
          onHover,
          updateTriggers: { getFillColor: [data] },
        })
      );
    }
  }

  const tooltip = hoverInfo?.object;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          reuseMaps
        />
        {tooltip && (
          <div
            className="p1-map-tooltip"
            style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 12 }}
          >
            <div className="tooltip-type" style={{ color: COMPOUND_COLORS[tooltip.compound_type]?.hex }}>
              {COMPOUND_COLORS[tooltip.compound_type]?.label || tooltip.compound_type}
            </div>
            {tooltip.nearest_compound && (
              <div className="tooltip-name">{tooltip.nearest_compound}</div>
            )}
            <div className="tooltip-meta">
              {tooltip.zone_type === 'commercial' ? 'Commercial zone' : 'Last mile'} · {tooltip.status}
            </div>
            <div className="tooltip-dist">{tooltip.distance_m}m to nearest compound</div>
          </div>
        )}
      </DeckGL>
      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(vs => ({ ...vs, ...INITIAL_VIEW, transitionDuration: 800 }))}
        onResetBearing={() => setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }))}
      />
    </div>
  );
}

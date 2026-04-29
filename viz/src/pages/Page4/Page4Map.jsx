import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { WebMercatorViewport } from '@deck.gl/core';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM, SHENZHEN_MAX_BOUNDS } from '../../config';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

const INITIAL_VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude:  SHENZHEN_CENTER[1],
  zoom:      SHENZHEN_ZOOM,
  pitch: 0,
  bearing: 0,
};

const EXISTING_COLOR = '#8a8d99';
const CANDIDATE_COLOR = '#ff7a5c';

function PinIcon({ color, size = 14 }) {
  return (
    <svg viewBox="0 0 40 52" width={size} height={size * 1.3}
      style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
      <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill={color} />
      <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
    </svg>
  );
}

function DiamondIcon({ color, size = 10 }) {
  const h = size * 1.3;
  return (
    <svg viewBox="0 0 20 26" width={size} height={h}
      style={{ display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
      <path d="M10 0L20 13L10 26L0 13Z" fill={color} />
      <circle cx="10" cy="12" r="4" fill="white" opacity="0.85" />
    </svg>
  );
}

export default function Page4Map({ sites, candidateSites, boundary, hexGrid }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!hexGrid || !containerRef.current) return;
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    hexGrid.features.forEach(f => {
      f.geometry.coordinates[0].forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      });
    });
    const { clientWidth: w, clientHeight: h } = containerRef.current;
    if (!w || !h) return;
    const vp = new WebMercatorViewport({ width: w, height: h });
    const { longitude, latitude, zoom } = vp.fitBounds(
      [[minLon, minLat], [maxLon, maxLat]], { padding: 24 }
    );
    setViewState(vs => ({ ...vs, longitude, latitude, zoom, transitionDuration: 600 }));
  }, [hexGrid]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <Map
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="mercator"
        reuseMaps
        maxBounds={SHENZHEN_MAX_BOUNDS}
        minZoom={9}
        maxZoom={14}
        style={{ width: '100%', height: '100%' }}
        onLoad={e => {
          const map = e.target;
          map.getStyle().layers.forEach(l => {
            if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
          });
        }}
      >
        {boundary && (
          <Source id="p4-boundary" type="geojson" data={boundary}>
            <Layer id="p4-boundary-fill" type="fill"
              paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.03 }} />
            <Layer id="p4-boundary-line" type="line"
              paint={{ 'line-color': 'rgba(200,200,210,0.6)', 'line-width': 1, 'line-dasharray': [6, 4] }} />
          </Source>
        )}

        {hexGrid && (
          <Source id="p4-hex-grid" type="geojson" data={hexGrid}>
            <Layer id="p4-hex-grid-fill" type="fill"
              paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.02 }} />
            <Layer id="p4-hex-grid-line" type="line"
              paint={{ 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.12 }} />
          </Source>
        )}

        {/* Optimised candidate sites (render first so existing pins sit on top) */}
        {candidateSites?.map((d, i) => (
          <Marker key={`c${i}`} longitude={d.lon} latitude={d.lat} anchor="center"
            style={{ zIndex: 5 }}>
            <div style={{ pointerEvents: 'none' }}>
              <DiamondIcon color={CANDIDATE_COLOR} size={9} />
            </div>
          </Marker>
        ))}

        {/* Existing vertiport sites (grey) */}
        {sites?.map((d, i) => (
          <Marker key={`v${i}`} longitude={d.lon} latitude={d.lat} anchor="bottom"
            style={{ zIndex: 10 }}>
            <div style={{ pointerEvents: 'none' }}>
              <PinIcon color={EXISTING_COLOR} size={14} />
            </div>
          </Marker>
        ))}
      </Map>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        background: 'rgba(255,255,255,0.92)', borderRadius: 8,
        padding: '8px 14px', fontSize: 11, color: '#F2EBD9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 20, border: '1px solid rgba(168,196,212,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PinIcon color={EXISTING_COLOR} size={12} />
          <span>Existing sites ({sites?.length || 0})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DiamondIcon color={CANDIDATE_COLOR} size={9} />
          <span>Optimised candidates ({candidateSites?.length || 0})</span>
        </div>
      </div>

      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(vs => ({ ...vs, ...INITIAL_VIEW, transitionDuration: 800 }))}
        onResetBearing={() => setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }))}
      />
    </div>
  );
}

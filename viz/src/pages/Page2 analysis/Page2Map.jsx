import { useState, useEffect, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer, PathLayer, GeoJsonLayer } from '@deck.gl/layers';
import { MAPBOX_TOKEN } from '../../config';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

const BARRIER_COLORS = {
  water: [70, 130, 220, 100],
  waterway: [100, 160, 240, 80],
  railway: [160, 160, 160, 120],
  highway_major: [220, 60, 60, 100],
};

function makeGroundPath(origin, destination) {
  const [ox, oy] = origin;
  const [dx, dy] = destination;
  const mx = (ox + dx) / 2 + (dx - ox) * 0.15;
  const my = (oy + dy) / 2 - Math.abs(dx - ox) * 0.08;
  return [origin, [ox + (mx - ox) * 0.4, oy + (my - oy) * 0.1], [mx, my], [dx - (dx - mx) * 0.4, dy - (dy - my) * 0.1], destination];
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export default function Page2Map({ activeCase, showGround, showAir, showBarriers, showBuildings, barriers, animProgress }) {
  const [viewState, setViewState] = useState(null);
  const [mapRef, setMapRef] = useState(null);

  useEffect(() => {
    if (activeCase) {
      const cx = (activeCase.origin[0] + activeCase.destination[0]) / 2;
      const cy = (activeCase.origin[1] + activeCase.destination[1]) / 2;
      setViewState({
        longitude: cx, latitude: cy,
        zoom: 13.5, pitch: 50, bearing: -20,
        transitionDuration: 1200,
      });
    }
  }, [activeCase]);

  // Toggle 3D buildings on Mapbox style
  const onMapLoad = useCallback((evt) => {
    const map = evt.target;
    setMapRef(map);
  }, []);

  useEffect(() => {
    if (!mapRef) return;
    try {
      if (mapRef.getLayer('3d-buildings')) {
        mapRef.setLayoutProperty('3d-buildings', 'visibility', showBuildings ? 'visible' : 'none');
        return;
      }
      if (showBuildings) {
        mapRef.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': '#1a1a2e',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6,
          },
        });
      }
    } catch (e) { /* layer might already exist */ }
  }, [mapRef, showBuildings]);

  if (!viewState) return null;

  const layers = [];

  // Barrier layers
  if (showBarriers && barriers) {
    activeCase.barriers.forEach(type => {
      const data = barriers[type];
      if (data) {
        layers.push(new GeoJsonLayer({
          id: `barrier-${type}`, data,
          getFillColor: BARRIER_COLORS[type],
          getLineColor: BARRIER_COLORS[type],
          getLineWidth: 2, lineWidthMinPixels: 1, opacity: 0.5,
        }));
      }
    });
  }

  // O/D markers
  const points = [
    { pos: activeCase.origin, color: [0, 200, 100, 240] },
    { pos: activeCase.destination, color: [255, 80, 80, 240] },
  ];
  layers.push(new ScatterplotLayer({
    id: 'od-glow', data: points,
    getPosition: d => d.pos, getRadius: 500,
    getFillColor: d => [...d.color.slice(0, 3), 40],
    radiusMinPixels: 15, radiusMaxPixels: 50,
  }));
  layers.push(new ScatterplotLayer({
    id: 'od-points', data: points,
    getPosition: d => d.pos, getRadius: 120,
    getFillColor: d => d.color,
    radiusMinPixels: 6, radiusMaxPixels: 18,
  }));

  // Ground route
  if (showGround) {
    layers.push(new PathLayer({
      id: 'ground-route',
      data: [{ path: makeGroundPath(activeCase.origin, activeCase.destination) }],
      getPath: d => d.path,
      getColor: [255, 80, 80, 200],
      getWidth: 4, widthMinPixels: 3, widthMaxPixels: 8,
      jointRounded: true, capRounded: true,
    }));
  }

  // Air route
  if (showAir) {
    layers.push(new ArcLayer({
      id: 'air-route', data: [activeCase],
      getSourcePosition: d => d.origin,
      getTargetPosition: d => d.destination,
      getSourceColor: [0, 220, 255, 220],
      getTargetColor: [0, 200, 255, 160],
      getWidth: 4, getHeight: 0.4, greatCircle: false,
    }));
  }

  // Animation dot
  if (animProgress !== null && animProgress >= 0 && animProgress <= 1) {
    const pos = lerp(activeCase.origin, activeCase.destination, animProgress);
    layers.push(new ScatterplotLayer({
      id: 'anim-dot',
      data: [{ pos }],
      getPosition: d => d.pos,
      getRadius: 200,
      getFillColor: [0, 255, 220, 255],
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
    }));
    layers.push(new ScatterplotLayer({
      id: 'anim-glow',
      data: [{ pos }],
      getPosition: d => d.pos,
      getRadius: 800,
      getFillColor: [0, 255, 220, 50],
      radiusMinPixels: 20,
      radiusMaxPixels: 60,
    }));
  }

  const defaultView = activeCase ? {
    longitude: (activeCase.origin[0] + activeCase.destination[0]) / 2,
    latitude: (activeCase.origin[1] + activeCase.destination[1]) / 2,
    zoom: 13.5, pitch: 50, bearing: -20,
  } : viewState;

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
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
          onLoad={onMapLoad}
        />
      </DeckGL>
      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(vs => ({ ...vs, ...defaultView, transitionDuration: 800 }))}
        onResetBearing={() => setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }))}
      />
    </div>
  );
}

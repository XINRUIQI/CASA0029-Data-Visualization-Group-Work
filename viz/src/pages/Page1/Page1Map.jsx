import { useState, useEffect, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM } from '../../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const INITIAL_VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 30,
  bearing: -15,
  transitionDuration: 0,
};

export default function Page1Map({ data, showPlanned, showExisting, flyTo }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);

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

  const layers = [];

  if (data) {
    if (showExisting) {
      layers.push(
        new ScatterplotLayer({
          id: 'existing-glow',
          data: data.filter(d => d.status === 'existing'),
          getPosition: d => [d.lon, d.lat],
          getRadius: 800,
          getFillColor: [0, 200, 120, 40],
          radiusMinPixels: 8,
          radiusMaxPixels: 40,
        })
      );
      layers.push(
        new ScatterplotLayer({
          id: 'existing-sites',
          data: data.filter(d => d.status === 'existing'),
          getPosition: d => [d.lon, d.lat],
          getRadius: 200,
          getFillColor: [0, 200, 120, 220],
          radiusMinPixels: 4,
          radiusMaxPixels: 16,
          pickable: true,
        })
      );
    }

    if (showPlanned) {
      layers.push(
        new ScatterplotLayer({
          id: 'planned-glow',
          data: data.filter(d => d.status === 'planned'),
          getPosition: d => [d.lon, d.lat],
          getRadius: 600,
          getFillColor: [255, 160, 40, 30],
          radiusMinPixels: 6,
          radiusMaxPixels: 30,
        })
      );
      layers.push(
        new ScatterplotLayer({
          id: 'planned-sites',
          data: data.filter(d => d.status === 'planned'),
          getPosition: d => [d.lon, d.lat],
          getRadius: 150,
          getFillColor: [255, 160, 40, 200],
          radiusMinPixels: 3,
          radiusMaxPixels: 12,
          pickable: true,
        })
      );
    }
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

import { useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM } from '../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const INITIAL_VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 0,
  bearing: 0,
};

export default function MapView({ layers = [], viewState: externalView, mapStyle, children }) {
  const [viewState, setViewState] = useState(externalView || INITIAL_VIEW);

  const onViewStateChange = useCallback(({ viewState: vs }) => {
    setViewState(vs);
  }, []);

  const currentView = externalView || viewState;
  const style = mapStyle || 'mapbox://styles/mapbox/dark-v11';

  return (
    <DeckGL
      viewState={currentView}
      onViewStateChange={onViewStateChange}
      controller={true}
      layers={layers}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={style}
        reuseMaps
      />
      {children}
    </DeckGL>
  );
}

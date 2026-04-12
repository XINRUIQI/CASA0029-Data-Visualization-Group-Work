import { useState } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MAPBOX_TOKEN, SHENZHEN_CENTER, SHENZHEN_ZOOM, SHENZHEN_MAX_BOUNDS } from '../../config';
import 'mapbox-gl/dist/mapbox-gl.css';

const CLASS_COLORS = {
  hub: [255, 50, 50, 220],
  station: [255, 180, 0, 200],
  endpoint: [100, 200, 255, 180],
};

const VIEW = {
  longitude: SHENZHEN_CENTER[0],
  latitude: SHENZHEN_CENTER[1],
  zoom: SHENZHEN_ZOOM,
  pitch: 0,
  bearing: 0,
};

export default function Page4Map({ sites, allSites, h3Demand, showCoverage, showCoveredOnly, showBeforeAfter, onHoverSite, onClickSite }) {
  const [viewState, setViewState] = useState(VIEW);

  const layers = [];

  if (h3Demand && showBeforeAfter === 'before') {
    layers.push(
      new H3HexagonLayer({
        id: 'demand-bg',
        data: h3Demand,
        getHexagon: d => d.h3,
        getFillColor: d => {
          const dp = d.dp || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 160 * (1 - v), 0, 25 + 120 * v];
        },
        extruded: false,
        stroked: true,
        getLineColor: [255, 255, 255, 8],
        getLineWidth: 1,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  if (h3Demand && showBeforeAfter === 'after') {
    layers.push(
      new H3HexagonLayer({
        id: 'demand-bg-after',
        data: h3Demand,
        getHexagon: d => d.h3,
        getFillColor: d => {
          const dp = d.dp || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 140 * (1 - v), 30, 10 + 45 * v];
        },
        extruded: false,
        stroked: true,
        getLineColor: [255, 255, 255, 5],
        getLineWidth: 1,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  if (showCoverage && showBeforeAfter === 'after' && sites?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'coverage-fill',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 3000,
        getFillColor: [100, 200, 255, 20],
        getLineColor: [100, 200, 255, 50],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
      })
    );

    if (h3Demand) {
      layers.push(
        new H3HexagonLayer({
          id: 'newly-covered',
          data: h3Demand,
          getHexagon: d => d.h3,
          getFillColor: d => {
            const dp = d.dp || 0;
            if (dp < 20 && showCoveredOnly) return [0, 0, 0, 0];
            return [0, 232, 150, 40 + Math.min(dp / 100, 1) * 100];
          },
          extruded: false,
          stroked: false,
          updateTriggers: { getFillColor: [showCoveredOnly, sites] },
        })
      );
    }
  }

  if (allSites?.length) {
    const unselected = allSites.filter(s => !sites?.some(sel => sel.lon === s.lon && sel.lat === s.lat));
    layers.push(
      new ScatterplotLayer({
        id: 'ghost-sites',
        data: unselected,
        getPosition: d => [d.lon, d.lat],
        getRadius: 100,
        getFillColor: [80, 80, 100, 60],
        radiusMinPixels: 2,
        radiusMaxPixels: 6,
      })
    );
  }

  if (sites?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'site-glow',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 600,
        getFillColor: d => [...(CLASS_COLORS[d.site_class] || [200, 200, 200]).slice(0, 3), 40],
        radiusMinPixels: 10,
        radiusMaxPixels: 35,
      })
    );
    layers.push(
      new ScatterplotLayer({
        id: 'selected-sites',
        data: sites,
        getPosition: d => [d.lon, d.lat],
        getRadius: 200,
        getFillColor: d => CLASS_COLORS[d.site_class] || [200, 200, 200, 200],
        radiusMinPixels: 5,
        radiusMaxPixels: 16,
        pickable: true,
        onHover: info => onHoverSite?.(info.object || null),
        onClick: info => onClickSite?.(info.object || null),
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
        maxBounds={SHENZHEN_MAX_BOUNDS}
        minZoom={9}
        maxZoom={14}
      />
    </DeckGL>
  );
}

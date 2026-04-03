import { useState, useEffect } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
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

export default function Page4Map({ sites, allSites, demandGrid, showCoverage, showCoveredOnly, showBeforeAfter, onHoverSite, onClickSite }) {
  const [viewState, setViewState] = useState(VIEW);

  const layers = [];

  // Background grid — full opacity in Before; dimmed under coverage in After (so map never looks "empty")
  if (demandGrid && showBeforeAfter === 'before') {
    layers.push(
      new GeoJsonLayer({
        id: 'demand-bg',
        data: demandGrid,
        getFillColor: f => {
          const dp = f.properties?.demand_pressure || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 160 * (1 - v), 0, 25 + 120 * v];
        },
        getLineColor: [255, 255, 255, 8],
        getLineWidth: 0.3,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  if (demandGrid && showBeforeAfter === 'after') {
    layers.push(
      new GeoJsonLayer({
        id: 'demand-bg-after',
        data: demandGrid,
        getFillColor: f => {
          const dp = f.properties?.demand_pressure || 0;
          if (showCoveredOnly && dp < 30) return [0, 0, 0, 0];
          const v = Math.min(dp / 200, 1);
          return [255, 140 * (1 - v), 30, 10 + 45 * v];
        },
        getLineColor: [255, 255, 255, 5],
        getLineWidth: 0.2,
        lineWidthMinPixels: 0,
        updateTriggers: { getFillColor: [showCoveredOnly] },
      })
    );
  }

  // Coverage circles (after)
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

    if (demandGrid) {
      layers.push(
        new GeoJsonLayer({
          id: 'newly-covered',
          data: demandGrid,
          getFillColor: f => {
            const dp = f.properties?.demand_pressure || 0;
            const cx = f.properties?.cx || (f.geometry?.coordinates?.[0]?.[0]?.[0] ?? 0);
            const cy = f.properties?.cy || (f.geometry?.coordinates?.[0]?.[0]?.[1] ?? 0);
            const covered = sites?.some(s =>
              Math.abs(s.lon - cx) < 0.027 && Math.abs(s.lat - cy) < 0.027
            );
            if (showCoveredOnly && !covered) return [0, 0, 0, 0];
            if (!covered) return [0, 0, 0, 0];
            if (dp < 20) return [0, 232, 150, 20];
            return [0, 232, 150, 40 + Math.min(dp / 100, 1) * 100];
          },
          getLineColor: [0, 0, 0, 0],
          getLineWidth: 0,
          updateTriggers: { getFillColor: [showCoveredOnly, sites] },
        })
      );
    }
  }

  // Ghost sites (unselected, dimmed)
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

  // Selected sites
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

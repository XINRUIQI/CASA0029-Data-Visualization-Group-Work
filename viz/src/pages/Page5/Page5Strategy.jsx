import { useState, useEffect, useMemo, useCallback } from 'react';
import Page5Map from './Page5Map';
import Page5Panel from './Page5Panel';
import { publicDataUrl } from '../../config';
import { latLngToCell, gridDisk } from 'h3-js';
import './Page5.css';

const N = 80;

function sampleRoutes(features, n) {
  const inBounds = features.filter(f => {
    const [lng, lat] = f.geometry.coordinates[0];
    return lng > 113.7 && lng < 114.6 && lat > 22.4 && lat < 22.8;
  });
  const step = Math.max(1, Math.floor(inBounds.length / n));
  const picked = [];
  for (let i = 0; i < inBounds.length && picked.length < n; i += step) {
    const coords = inBounds[i].geometry.coordinates;
    picked.push({
      id: picked.length,
      origin: coords[0],
      destination: coords[coords.length - 1],
    });
  }
  return picked;
}

function shortName(full) {
  return full ? full.split(',')[0].trim() : full;
}

async function reverseGeocode([lng, lat]) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=en`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const json = await res.json();
    return shortName(json.display_name) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function Page5Strategy() {
  const [buildingData,    setBuildingData]    = useState(null);
  const [rawRoutes,       setRawRoutes]       = useState(null);
  const [comparisonRoute, setComparisonRoute] = useState(null);
  const [pickMode,        setPickMode]        = useState(null);
  const [injectedPoint,   setInjectedPoint]   = useState(null);

  useEffect(() => {
    fetch(publicDataUrl('data/buildings_all.geojson'))
      .then(r => r.json()).then(setBuildingData).catch(() => {});
    fetch(publicDataUrl('data/page2_routes.json'))
      .then(r => r.json()).then(d => setRawRoutes(d.features)).catch(() => {});
  }, []);

  const routes = useMemo(
    () => (rawRoutes ? sampleRoutes(rawRoutes, N) : []),
    [rawRoutes]
  );

  /** Shenzhen downtown H3 backdrop (synthetic weights; replace with population JSON when available) */
  const h3Cells = useMemo(() => {
    try {
      const center = latLngToCell(22.53, 114.058, 9);
      return gridDisk(center, 6).map((h3, i) => ({
        h3,
        v: Math.sin(i * 0.31) * 0.5 + Math.cos(i * 0.17) * 0.35 + 0.5,
      }));
    }
    catch {
      return [];
    }
  }, []);

  // Pre-process buildings taller than 110 m into centroid + radius form
  const tallBuildings = useMemo(() => {
    if (!buildingData) return [];
    return buildingData.features
      .filter(f => (f.properties?.height ?? 0) > 110)
      .map(f => {
        const outerRing = f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates[0][0]
          : f.geometry.coordinates[0];
        const lngs = outerRing.map(c => c[0]);
        const lats  = outerRing.map(c => c[1]);
        const centroid = [
          (Math.max(...lngs) + Math.min(...lngs)) / 2,
          (Math.max(...lats) + Math.min(...lats)) / 2,
        ];
        const dx = (Math.max(...lngs) - Math.min(...lngs)) * 102500;
        const dy = (Math.max(...lats) - Math.min(...lats)) * 111000;
        const radiusM = Math.sqrt(dx * dx + dy * dy) / 2;
        return { centroid, radiusM };
      });
  }, [buildingData]);

  const clearComparisonRoute = useCallback(() => {
    setComparisonRoute(null);
  }, []);

  const handleMapClick = async (coords) => {
    if (!pickMode) return;
    const name = await reverseGeocode(coords);
    setInjectedPoint({ mode: pickMode, coords, name });
    setPickMode(null);
  };

  return (
    <section id="page-5" className="page page-5">
      {!comparisonRoute && (
        <div className="p5-enter-hint" role="status">
          <span className="p5-enter-hint-kicker">Getting started</span>
          <span className="p5-enter-hint-text">
            A sample route <strong>compares automatically</strong> when the page loads. Use the <strong>left panel</strong> to change addresses or <em>Pick</em> on the map, then tap <strong>Compare routes</strong> to refresh.
          </span>
          <span className="p5-enter-hint-sub">Background arcs show sample OD flows — your comparison overlays on top when ready.</span>
        </div>
      )}
      <Page5Map
        buildingData={buildingData}
        routes={routes}
        comparisonRoute={comparisonRoute}
        pickMode={pickMode}
        onMapClick={handleMapClick}
        h3Cells={h3Cells}
      />
      <Page5Panel
        onResult={setComparisonRoute}
        onClear={clearComparisonRoute}
        pickMode={pickMode}
        setPickMode={setPickMode}
        injectedPoint={injectedPoint}
        tallBuildings={tallBuildings}
      />
    </section>
  );
}

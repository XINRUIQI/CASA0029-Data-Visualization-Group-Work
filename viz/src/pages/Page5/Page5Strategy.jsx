import { useState, useEffect, useMemo } from 'react';
import Page5Map from './Page5Map';
import Page5Panel from './Page5Panel';
import { publicDataUrl } from '../../config';
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

  const handleMapClick = async (coords) => {
    if (!pickMode) return;
    const name = await reverseGeocode(coords);
    setInjectedPoint({ mode: pickMode, coords, name });
    setPickMode(null);
  };

  return (
    <section id="page-5" className="page page-5">
      <Page5Map
        buildingData={buildingData}
        routes={routes}
        comparisonRoute={comparisonRoute}
        pickMode={pickMode}
        onMapClick={handleMapClick}
        tallBuildings={tallBuildings}
      />
      <Page5Panel
        onResult={setComparisonRoute}
        onClear={() => setComparisonRoute(null)}
        pickMode={pickMode}
        setPickMode={setPickMode}
        injectedPoint={injectedPoint}
        tallBuildings={tallBuildings}
      />
    </section>
  );
}

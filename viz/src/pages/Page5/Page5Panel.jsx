import { useState, useEffect } from 'react';
import { MAPBOX_TOKEN } from '../../config';
import LegendMeshIcon from './LegendMeshIcon';
import { createDroneMesh, createPersonMesh, createRiderMesh } from './meshes';

const DRONE_SPEED = 15;  // m/s
const HUB_DIST_M  = 500;
const DRONE_MAX_M = 3000; // max straight-line range
const BUILDING_CLEARANCE_M = 80; // buffer around tall buildings

async function geocode(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&limit=1&countrycodes=cn` +
    `&viewbox=113.7,22.8,114.6,22.4&bounded=1` +
    `&accept-language=en&namedetails=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const json = await res.json();
  const feat = json[0];
  console.log('[geocode]', query, '->', feat?.lon, feat?.lat, feat?.display_name);
  if (!feat) return null;
  // Prefer explicit English name tag; fall back to first segment of display_name
  const enName = feat.namedetails?.['name:en'] || feat.namedetails?.['name:en-US'];
  const name   = enName ? enName : shortName(feat.display_name);
  return { coords: [parseFloat(feat.lon), parseFloat(feat.lat)], name };
}

// profile: 'walking' | 'cycling' | 'driving'
async function getRoute(origin, dest, profile = 'cycling') {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${origin[0]},${origin[1]};${dest[0]},${dest[1]}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res  = await fetch(url);
  const json = await res.json();
  console.log(`[directions/${profile}]`, JSON.stringify(origin), '→', JSON.stringify(dest), '| dist:', json.routes?.[0]?.distance, '| dur:', json.routes?.[0]?.duration);
  const r = json.routes?.[0];
  if (!r) return null;
  return { coords: r.geometry.coordinates, distance: r.distance, duration: r.duration };
}

function shortName(full) {
  return full ? full.split(',')[0].trim() : full;
}

function pointAlongLine(from, to, distM) {
  const dx    = (to[0] - from[0]) * 102500;
  const dy    = (to[1] - from[1]) * 111000;
  const total = Math.sqrt(dx * dx + dy * dy);
  if (total < 1) return [...from];
  const t = Math.min(distM / total, 0.4);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function straightDist([lng1, lat1], [lng2, lat2]) {
  const dx = (lng2 - lng1) * 102500;
  const dy = (lat2 - lat1) * 111000;
  return Math.sqrt(dx * dx + dy * dy);
}

// Perpendicular distance (metres) from point P to segment A→B
function perpDistToSegmentM([px, py], [ax, ay], [bx, by]) {
  const dx = (bx - ax) * 102500, dy = (by - ay) * 111000;
  const ppx = (px - ax) * 102500, ppy = (py - ay) * 111000;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return Math.sqrt(ppx * ppx + ppy * ppy);
  const t = Math.max(0, Math.min(1, (ppx * dx + ppy * dy) / len2));
  return Math.sqrt((ppx - t * dx) ** 2 + (ppy - t * dy) ** 2);
}

// Returns { waypoint, totalDist } or null if no tall building blocks hub1→hub2
function computeDroneDetour(hub1, hub2, tallBuildings) {
  const blockers = tallBuildings.filter(b =>
    perpDistToSegmentM(b.centroid, hub1, hub2) < b.radiusM + BUILDING_CLEARANCE_M
  );
  if (!blockers.length) return null;

  const mx  = (hub1[0] + hub2[0]) / 2;
  const my  = (hub1[1] + hub2[1]) / 2;
  const ddx = (hub2[0] - hub1[0]) * 102500;
  const ddy = (hub2[1] - hub1[1]) * 111000;
  const len = Math.sqrt(ddx * ddx + ddy * ddy);
  // perpendicular unit vector converted back to degrees
  const perpLng = -ddy / len / 102500;
  const perpLat =  ddx / len / 111000;
  const offsetM = Math.max(...blockers.map(b => b.radiusM)) + BUILDING_CLEARANCE_M + 80;
  const waypoint = [mx + perpLng * offsetM, my + perpLat * offsetM];
  const totalDist = straightDist(hub1, waypoint) + straightDist(waypoint, hub2);
  return { waypoint, totalDist };
}

function fmtMin(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return '< 1 min';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}
function fmtKm(m) { return (m / 1000).toFixed(1) + ' km'; }

function sameCoord(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1];
}

export default function Page5Panel({ onResult, onClear, pickMode, setPickMode, injectedPoint, tallBuildings, defaultOrigin, defaultDest }) {
  const [originQ,      setOriginQ]      = useState(defaultOrigin?.name ?? '');
  const [destQ,        setDestQ]        = useState(defaultDest?.name ?? '');
  const [originCoords, setOriginCoords] = useState(defaultOrigin?.coords ?? null);
  const [destCoords,   setDestCoords]   = useState(defaultDest?.coords ?? null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [result,       setResult]       = useState(null);

  useEffect(() => {
    if (!injectedPoint) return;
    if (injectedPoint.mode === 'origin') {
      setOriginQ(injectedPoint.name);
      setOriginCoords(injectedPoint.coords);
    } else {
      setDestQ(injectedPoint.name);
      setDestCoords(injectedPoint.coords);
    }
  }, [injectedPoint]);

  const handleSearch = async () => {
    if (!originQ.trim() || !destQ.trim()) return;
    setLoading(true); setError(''); setResult(null); onClear();
    try {
      let orig = originCoords ? { coords: originCoords, name: originQ } : await geocode(originQ);
      let dest = destCoords   ? { coords: destCoords,   name: destQ   } : await geocode(destQ);

      if (!orig) { setError(`Location not found: "${originQ}"`); return; }
      if (!dest) { setError(`Location not found: "${destQ}"`);   return; }

      setOriginQ(orig.name);
      setDestQ(dest.name);

      const isDirect =
        sameCoord(orig.coords, defaultOrigin?.coords) &&
        sameCoord(dest.coords, defaultDest?.coords);

      const directDist = straightDist(orig.coords, dest.coords);

      if (!isDirect && directDist < HUB_DIST_M * 2.5) {
        setError('Locations are too close for drone delivery to be effective (min ~1.25 km).');
        return;
      }

      const hub1 = isDirect ? orig.coords : pointAlongLine(orig.coords, dest.coords, HUB_DIST_M);
      const hub2 = isDirect ? dest.coords : pointAlongLine(dest.coords, orig.coords, HUB_DIST_M);

      if (!isDirect) {
        const arcCheck = straightDist(hub1, hub2);
        if (arcCheck > DRONE_MAX_M) {
          setError(`Drone flight segment is ${fmtKm(arcCheck)} — air range is limited to ${fmtKm(DRONE_MAX_M)}.`);
          return;
        }
      }

      const [leg1, leg2, ground] = await Promise.all([
        isDirect ? Promise.resolve(null) : getRoute(orig.coords, hub1, 'cycling'),
        isDirect ? Promise.resolve(null) : getRoute(hub2, dest.coords, 'cycling'),
        getRoute(orig.coords, dest.coords, 'cycling'),
      ]);

      if (!ground) { setError('Unable to fetch route. Please check network.'); return; }

      const leg1Sec = isDirect ? 0 : (leg1?.duration ?? straightDist(orig.coords, hub1) / DRONE_SPEED);
      const leg2Sec = isDirect ? 0 : (leg2?.duration ?? straightDist(hub2, dest.coords) / DRONE_SPEED);

      let arcDist = straightDist(hub1, hub2);
      let arcSec  = arcDist / DRONE_SPEED;
      let droneWaypoint = null;
      let buildingDetour = false;

      if (tallBuildings?.length) {
        const detour = computeDroneDetour(hub1, hub2, tallBuildings);
        if (detour) {
          droneWaypoint  = detour.waypoint;
          arcDist        = detour.totalDist;
          arcSec         = arcDist / DRONE_SPEED;
          buildingDetour = true;
        }
      }

      const res = {
        origin:      orig.coords,
        destination: dest.coords,
        originName:  orig.name,
        destName:    dest.name,
        hub1, hub2,
        directFlight: isDirect,
        droneWaypoint,
        buildingDetour,
        drone: {
          leg1: isDirect ? null : (leg1 ?? { coords: [orig.coords, hub1], distance: HUB_DIST_M, duration: leg1Sec }),
          arcDist, arcSec,
          leg2: isDirect ? null : (leg2 ?? { coords: [hub2, dest.coords], distance: HUB_DIST_M, duration: leg2Sec }),
          totalDuration: leg1Sec + arcSec + leg2Sec,
        },
        ground: {
          coords:   ground.coords,
          distance: ground.distance,
          duration: ground.duration,
        },
      };
      setResult(res);
      onResult(res);
    } catch (e) {
      console.error(e);
      setError('Request failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setOriginQ(defaultOrigin?.name ?? '');
    setOriginCoords(defaultOrigin?.coords ?? null);
    setDestQ(defaultDest?.name ?? '');
    setDestCoords(defaultDest?.coords ?? null);
    setError(''); onClear();
  };

  const resetOriginToDefault = () => {
    if (!defaultOrigin) return;
    setOriginQ(defaultOrigin.name);
    setOriginCoords(defaultOrigin.coords);
  };

  const resetDestToDefault = () => {
    if (!defaultDest) return;
    setDestQ(defaultDest.name);
    setDestCoords(defaultDest.coords);
  };

  const togglePick = (mode) => setPickMode(pickMode === mode ? null : mode);

  return (
    <div className="p5-panel">
      <div className="p5-header-card">
        <div className="p5-panel-title">
          Drone Delivery<br/><span style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.75 }}>vs</span><br/>Rider Delivery
        </div>
        <div className="p5-panel-subtitle">Comparing an optimised drone-assisted route with a road-only rider route in Shenzhen's 3D urban environment — real-world road paths powered by the Mapbox Directions API</div>
      </div>

      <div className="p5-header-card">
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e8904a', marginBottom: '6px' }}>How to use the map?</div>
        <div className="p5-default-note">
          A default drone route is pre-loaded between two vertiport stations — direct flight with no couriers. Click <strong>"Search"</strong> to compare instantly, or customise your own origin / destination.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="p5-panel-desc"><span style={{ fontWeight: 700, color: '#e8904a' }}>Quick start —</span> Click <strong>"Search"</strong> to compare the default drone route vs. rider.</div>
          <div className="p5-panel-desc"><span style={{ fontWeight: 700, color: '#e8904a' }}>Or customise —</span> Use <strong>"Pick 01" / "Pick 02"</strong> or type addresses to set your own origin &amp; destination.</div>
        </div>
        <div className="p5-panel-inputs">
          <div className="p5-input-row">
            <label className="p5-input-label">Origin Point</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {defaultOrigin && originQ !== defaultOrigin.name && (
                <button className="p5-default-btn" onClick={resetOriginToDefault} title="Reset to default drone hub">
                  ↻ Default Hub
                </button>
              )}
              <button className={`p5-pick-btn ${pickMode === 'origin' ? 'active' : ''}`}
                onClick={() => togglePick('origin')} title="Click on map to set origin">
                {pickMode === 'origin' ? '✕ Cancel' : '📍 Pick 01'}
              </button>
            </div>
          </div>
          <input className="p5-input" placeholder="e.g. Shenzhen University"
            value={originQ} onChange={e => { setOriginQ(e.target.value); setOriginCoords(null); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />

          <div className="p5-input-row">
            <label className="p5-input-label">Destination Point</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {defaultDest && destQ !== defaultDest.name && (
                <button className="p5-default-btn" onClick={resetDestToDefault} title="Reset to default landing hub">
                  ↻ Default Hub
                </button>
              )}
              <button className={`p5-pick-btn ${pickMode === 'destination' ? 'active' : ''}`}
                onClick={() => togglePick('destination')} title="Click on map to set destination">
                {pickMode === 'destination' ? '✕ Cancel' : '📍 Pick 02'}
              </button>
            </div>
          </div>
          <input className="p5-input" placeholder="e.g. Shenzhen North Station"
            value={destQ} onChange={e => { setDestQ(e.target.value); setDestCoords(null); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />

          <button className="p5-search-btn" onClick={handleSearch}
            disabled={loading || !originQ.trim() || !destQ.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          {error && <div className="p5-panel-error">{error}</div>}
        </div>

        {pickMode && (
          <div className="p5-pick-hint">
            Click anywhere on the map to set the{' '}
            <strong>{pickMode === 'origin' ? 'origin point' : 'destination point'}</strong>
          </div>
        )}

        {result && (() => {
          const droneFaster = result.drone.totalDuration < result.ground.duration;
          const diffSec     = Math.abs(result.ground.duration - result.drone.totalDuration);
          return (
            <div className="p5-route-results">
              <div className={`p5-time-saved ${droneFaster ? 'drone-wins' : 'ground-wins'}`}>
                {droneFaster
                  ? `Drone saves ${fmtMin(diffSec)} vs rider`
                  : `Rider saves ${fmtMin(diffSec)} vs drone`}
              </div>

              {result.buildingDetour && (
                <div className="p5-detour-warn">
                  ⚠ Building &gt;110 m detected — drone rerouted
                </div>
              )}

              <div className="p5-route-card p5-drone">
                <div className="p5-route-header">
                  <span className="p5-route-badge">Drone Delivery</span>
                  <span className="p5-route-time">{fmtMin(result.drone.totalDuration)}</span>
                </div>
                <div className="p5-route-detail">
                  {result.directFlight
                    ? `Direct flight ${fmtMin(result.drone.arcSec)} · ${fmtKm(result.drone.arcDist)}`
                    : <>
                        Ride {fmtMin(result.drone.leg1.duration)} →&nbsp;
                        Fly {fmtMin(result.drone.arcSec)} ({fmtKm(result.drone.arcDist)}) →&nbsp;
                        Ride {fmtMin(result.drone.leg2.duration)}
                      </>
                  }
                </div>
              </div>

              <div className="p5-route-card p5-ground">
                <div className="p5-route-header">
                  <span className="p5-route-badge">Rider Delivery</span>
                  <span className="p5-route-time">{fmtMin(result.ground.duration)}</span>
                </div>
                <div className="p5-route-detail">{fmtKm(result.ground.distance)} · Road only</div>
              </div>

              <div className="p5-panel-note">* Animation runs at 20× speed for demonstration. Displayed times reflect real estimates.</div>
              <button className="p5-clear-btn" onClick={handleClear}>Clear</button>
            </div>
          );
        })()}
      </div>

      <div className="p5-header-card">
        <div className="p5-flight-info-title">✈ Flight Constraints</div>
        <div className="p5-flight-info-row">
          <span className="p5-fi-label">Max altitude</span>
          <span className="p5-fi-val">120 m</span>
        </div>
        <div className="p5-flight-info-row">
          <span className="p5-fi-label">General flight ceiling</span>
          <span className="p5-fi-val">110 m</span>
        </div>
        <div className="p5-fi-note">
          Commercial operators with full airspace authorisation are exempt from altitude restrictions.
        </div>

        <div className="p5-legend-title" style={{ marginTop: '10px' }}>Map Legend</div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch low-building" />
          Buildings (≤110 m)
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch tall-building" />
          Buildings (&gt;110 m)
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch hub-takeoff" />
          Drone Departure Hub
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch hub-landing" />
          Drone Landing Hub
        </div>
        <div className="p5-legend-row">
          <LegendMeshIcon
            createMesh={createDroneMesh}
            color={[255, 220, 0]}
            eye={[1.6, -1.6, 2.2]}
            target={[0, 0, 0.05]}
            size={32}
          />
          Drone (UAV)
        </div>
        <div className="p5-legend-row">
          <LegendMeshIcon
            createMesh={createPersonMesh}
            color={[255, 160, 60]}
            eye={[2.2, 0.18, 0.65]}
            target={[0, 0.18, 0.65]}
            size={32}
          />
          Delivery Courier (first / last mile)
        </div>
        <div className="p5-legend-row">
          <LegendMeshIcon
            createMesh={createRiderMesh}
            color={[80, 255, 160]}
            eye={[2.5, -0.05, 0.40]}
            target={[0, -0.05, 0.38]}
            size={32}
          />
          Ground Rider (full route)
        </div>
      </div>
    </div>
  );
}

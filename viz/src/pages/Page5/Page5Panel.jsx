import { useState, useEffect } from 'react';
import { MAPBOX_TOKEN } from '../../config';

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

export default function Page5Panel({ onResult, onClear, pickMode, setPickMode, injectedPoint, tallBuildings }) {
  const [originQ,      setOriginQ]      = useState('');
  const [destQ,        setDestQ]        = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords,   setDestCoords]   = useState(null);
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

      // Replace input fields with English geocoded names
      setOriginQ(orig.name);
      setDestQ(dest.name);

      const directDist = straightDist(orig.coords, dest.coords);

      if (directDist < HUB_DIST_M * 2.5) {
        setError('Locations are too close for drone delivery to be effective (min ~1.25 km).');
        return;
      }

      const hub1 = pointAlongLine(orig.coords, dest.coords, HUB_DIST_M);
      const hub2 = pointAlongLine(dest.coords, orig.coords, HUB_DIST_M);

      // ── Constraint 1: drone flight segment (hub1→hub2) must be ≤ 3 km ──
      const arcDirect = straightDist(hub1, hub2);
      if (arcDirect > DRONE_MAX_M) {
        setError(`Drone flight segment is ${fmtKm(arcDirect)} — air range is limited to ${fmtKm(DRONE_MAX_M)}.`);
        return;
      }

      const [leg1, leg2, ground] = await Promise.all([
        getRoute(orig.coords, hub1,        'cycling'),
        getRoute(hub2,        dest.coords, 'cycling'),
        getRoute(orig.coords, dest.coords, 'cycling'),
      ]);

      if (!ground) { setError('Unable to fetch route. Please check network.'); return; }

      const leg1Sec = leg1?.duration ?? straightDist(orig.coords, hub1) / DRONE_SPEED;
      const leg2Sec = leg2?.duration ?? straightDist(hub2, dest.coords) / DRONE_SPEED;

      // ── Constraint 2: avoid buildings > 110 m ──
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
        droneWaypoint,
        buildingDetour,
        drone: {
          leg1: leg1 ?? { coords: [orig.coords, hub1], distance: HUB_DIST_M, duration: leg1Sec },
          arcDist, arcSec,
          leg2: leg2 ?? { coords: [hub2, dest.coords], distance: HUB_DIST_M, duration: leg2Sec },
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
    setResult(null); setOriginQ(''); setDestQ('');
    setOriginCoords(null); setDestCoords(null);
    setError(''); onClear();
  };

  const togglePick = (mode) => setPickMode(pickMode === mode ? null : mode);

  return (
    <div className="p5-panel">
      <div className="p5-panel-title">Route Comparison</div>

      <div className="p5-flight-info">
        <div className="p5-flight-info-title">✈ Flight Constraints</div>
        <div className="p5-flight-info-row">
          <span className="p5-fi-label">Max altitude</span>
          <span className="p5-fi-val">120 m</span>
        </div>
        <div className="p5-flight-info-row">
          <span className="p5-fi-label">General flight ceiling</span>
          <span className="p5-fi-val">110 m</span>
        </div>
        <div className="p5-flight-info-row p5-fi-note">
          Commercial operators with full airspace authorisation are exempt from altitude restrictions.
        </div>
      </div>

      <div className="p5-legend">
        <div className="p5-legend-title">Map Legend</div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch tall-building" />
          Buildings &gt; 110 m — drone avoidance zone
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch hub-takeoff" />
          Drone takeoff point (Hub 1)
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-swatch hub-landing" />
          Drone landing point (Hub 2)
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-icon rider-drone">🚴</span>
          Drone-side courier (first / last mile)
        </div>
        <div className="p5-legend-row">
          <span className="p5-legend-icon rider-ground">🚴</span>
          Ground rider (full route)
        </div>
      </div>

      <div className="p5-panel-inputs">
        <div className="p5-input-row">
          <label className="p5-input-label">Starting Point</label>
          <button className={`p5-pick-btn ${pickMode === 'origin' ? 'active' : ''}`}
            onClick={() => togglePick('origin')} title="Click on map to set origin">
            {pickMode === 'origin' ? '✕ Cancel' : '📍 Pick'}
          </button>
        </div>
        <input className="p5-input" placeholder="e.g. Shenzhen University"
          value={originQ} onChange={e => { setOriginQ(e.target.value); setOriginCoords(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()} />

        <div className="p5-input-row">
          <label className="p5-input-label">Destination</label>
          <button className={`p5-pick-btn ${pickMode === 'destination' ? 'active' : ''}`}
            onClick={() => togglePick('destination')} title="Click on map to set destination">
            {pickMode === 'destination' ? '✕ Cancel' : '📍 Pick'}
          </button>
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
          <strong>{pickMode === 'origin' ? 'starting point' : 'destination'}</strong>
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
                Ride {fmtMin(result.drone.leg1.duration)} →&nbsp;
                Fly {fmtMin(result.drone.arcSec)} ({fmtKm(result.drone.arcDist)}) →&nbsp;
                Ride {fmtMin(result.drone.leg2.duration)}
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
  );
}

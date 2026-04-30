import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { ArcLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import { MAPBOX_TOKEN, POI_COLORS } from '../../config';
import { PoiPinIcon } from './poiIcons';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

const INITIAL_VIEW = {
  longitude: 114.19,
  latitude: 22.63,
  zoom: 9.5,
  pitch: 0,
  bearing: 0,
};

const ZONE_META = {
  commercial: { hex: '#ffa028', label: 'Commercial area pick-up/drop-off points' },
  last_mile:  { hex: '#c864ff', label: 'Last-mile pick-up/drop-off points' },
};

const DISTRICT_EN = {
  '光明区': 'Guangming', '坪山区': 'Pingshan', '龙华区': 'Longhua',
  '盐田区': 'Yantian',  '龙岗区': 'Longgang', '宝安区': "Bao'an",
  '南山区': 'Nanshan',  '福田区': 'Futian',   '罗湖区': 'Luohu',
};

const DISTRICT_INFO = {
  '福田区': { population: 153,  area: 78.7  },
  '罗湖区': { population: 116,  area: 78.8  },
  '南山区': { population: 188,  area: 187.5 },
  '盐田区': { population: 24,   area: 74.6  },
  '宝安区': { population: 420,  area: 397.9 },
  '龙岗区': { population: 393,  area: 843.6 },
  '龙华区': { population: 292,  area: 175.6 },
  '坪山区': { population: 64,   area: 167.0 },
  '光明区': { population: 100,  area: 156.1 },
};

function haversineKm(a, b) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const FLIGHT_RADIUS_KM = 3;

function getBbox(feature) {
  const coords = [];
  const g = feature.geometry;
  if (g.type === 'Polygon') g.coordinates[0].forEach(c => coords.push(c));
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p[0].forEach(c => coords.push(c)));
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function PinIcon({ color, size = 18 }) {
  return (
    <svg viewBox="0 0 40 52" width={size} height={size * 1.3}
      style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
      <path d="M20 0C8.954 0 0 8.954 0 20c0 13.333 20 32 20 32S40 33.333 40 20C40 8.954 31.046 0 20 0z" fill={color} />
      <circle cx="20" cy="19" r="8" fill="white" opacity="0.9" />
    </svg>
  );
}

export default function Page3Map({ data, boundary, hexGrid, activeTab, compoundFilter, focusDistrict, districtStats, onDistrictFocus, viewResetKey }) {
  const [viewState, setViewState]           = useState(INITIAL_VIEW);
  const [tooltip, setTooltip]               = useState(null);
  const [districtPanel, setDistrictPanel]   = useState(null);
  const [selectedHubIdx, setSelectedHubIdx] = useState(null);
  const [hoverDistrict, setHoverDistrict]   = useState(null);
  const [autoPlaying, setAutoPlaying]       = useState(false);
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const viewStateRef    = useRef(INITIAL_VIEW);
  const autoTimerRef    = useRef(null);
  const autoIdxRef      = useRef(0);
  const pendingResetRef = useRef(null); // { target, until } — overrides handleViewStateChange during tab reset

  useEffect(() => {
    clearTimeout(autoTimerRef.current);
    setAutoPlaying(false);
    setSelectedHubIdx(null);
    setDistrictPanel(null);
    if (activeTab === 3) {
      // Routes: auto-play effect will take over immediately; no pendingReset needed
      setViewState({ ...INITIAL_VIEW, pitch: 55, bearing: -20, transitionDuration: 900 });
    } else if (activeTab === 4 && hexGrid && containerRef.current) {
      let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
      hexGrid.features.forEach(f => {
        f.geometry.coordinates[0].forEach(([lon, lat]) => {
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        });
      });
      const bbox = [minLon, minLat, maxLon, maxLat];
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      const vp = new WebMercatorViewport({ width: w, height: h });
      const { longitude, latitude, zoom } = vp.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40 }
      );
      const target = { ...INITIAL_VIEW, longitude, latitude, zoom, pitch: 0, bearing: 0, transitionDuration: 800 };
      pendingResetRef.current = { target, until: Date.now() + 1200 };
      setViewState(target);
    } else {
      const target = { ...INITIAL_VIEW, pitch: 0, bearing: 0, transitionDuration: 700 };
      pendingResetRef.current = { target, until: Date.now() + 1200 };
      setViewState(target);
    }
  }, [activeTab, hexGrid, viewResetKey]);

  // ── Tab 3 data (must be declared before handleDeckClick) ──
  const tab3Data = useMemo(() => {
    if (!data) return null;
    const hubs = data.filter(d => d.zone_type === 'commercial');
    const lms  = data.filter(d => d.zone_type === 'last_mile');
    const connections = hubs.map(hub => ({
      hub,
      reachable: lms.filter(lm =>
        haversineKm([hub.lon, hub.lat], [lm.lon, lm.lat]) <= FLIGHT_RADIUS_KM
      ),
    }));
    return { hubs, lms, connections };
  }, [data]);

  // ── Auto-play: loop through hub routes when entering Routes tab ──
  useEffect(() => {
    if (activeTab !== 3 || !tab3Data) return;

    clearTimeout(autoTimerRef.current);
    autoIdxRef.current = 0;
    setAutoPlaying(true);
    setSelectedHubIdx(null);

    // zoom back to full view first
    setViewState(vs => ({ ...vs, ...INITIAL_VIEW, pitch: 45, bearing: -15, transitionDuration: 700 }));

    const zoomToHub = (idx) => {
      if (!containerRef.current || !tab3Data) return;
      setSelectedHubIdx(idx);
      const { hub, reachable } = tab3Data.connections[idx];
      const allPts = [hub, ...reachable];
      const lons = allPts.map(p => p.lon);
      const lats = allPts.map(p => p.lat);
      const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      const vp = new WebMercatorViewport({ ...viewStateRef.current, width: w, height: h });
      const { longitude, latitude, zoom } = vp.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 100 }
      );
      setViewState(vs => ({ ...vs, longitude, latitude, zoom: Math.min(zoom, 13), transitionDuration: 900 }));
    };

    const step = () => {
      const idx = autoIdxRef.current;
      if (idx >= tab3Data.hubs.length) {
        // loop done, zoom back to full view
        setSelectedHubIdx(null);
        setViewState(vs => ({ ...vs, ...INITIAL_VIEW, pitch: 45, bearing: -15, transitionDuration: 700 }));
        setAutoPlaying(false);
        return;
      }
      zoomToHub(idx);
      autoIdxRef.current += 1;
      autoTimerRef.current = setTimeout(step, 2800);
    };

    autoTimerRef.current = setTimeout(step, 800);

    return () => clearTimeout(autoTimerRef.current);
  }, [activeTab, tab3Data]);

  const stopAutoPlay = useCallback(() => {
    clearTimeout(autoTimerRef.current);
    setAutoPlaying(false);
  }, []);


  const activeArcs = useMemo(() => {
    if (selectedHubIdx === null || !tab3Data) return [];
    const { hub, reachable } = tab3Data.connections[selectedHubIdx];
    return reachable.map(lm => ({ src: [hub.lon, hub.lat], tgt: [lm.lon, lm.lat] }));
  }, [selectedHubIdx, tab3Data]);

  const reachableSet = useMemo(() => {
    if (selectedHubIdx === null || !tab3Data) return null;
    return new Set(tab3Data.connections[selectedHubIdx].reachable);
  }, [selectedHubIdx, tab3Data]);

  // ── Event handlers ──
  const handleViewStateChange = useCallback(({ viewState: vs, interactionState }) => {
    const isUserInteracting = interactionState && !interactionState.inTransition &&
      (interactionState.isPanning || interactionState.isZooming ||
       interactionState.isRotating || interactionState.isDragging);

    if (pendingResetRef.current) {
      if (isUserInteracting) {
        // User grabbed the map — let them take over, cancel the pending reset
        pendingResetRef.current = null;
      } else if (Date.now() < pendingResetRef.current.until) {
        // Keep applying the reset target so deck.gl can't ignore it mid-transition
        setViewState(pendingResetRef.current.target);
        viewStateRef.current = pendingResetRef.current.target;
        return;
      } else {
        pendingResetRef.current = null;
      }
    }

    setViewState(vs);
    viewStateRef.current = vs;
    if (isUserInteracting) {
      setDistrictPanel(null);
      onDistrictFocus?.(null);
    }
  }, [onDistrictFocus]);

  useEffect(() => {
    if (!focusDistrict?.bbox || !containerRef.current) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    const [minLon, minLat, maxLon, maxLat] = focusDistrict.bbox;
    const vp = new WebMercatorViewport({ width, height });
    const { longitude, latitude, zoom } = vp.fitBounds(
      [[minLon, minLat], [maxLon, maxLat]], { padding: 40 }
    );
    setViewState(vs => ({ ...vs, longitude, latitude, zoom, transitionDuration: 800 }));
    const featureName = focusDistrict.featureName;
    const enName   = DISTRICT_EN[featureName] || featureName;
    const distInfo = DISTRICT_INFO[featureName] || {};
    const stats    = districtStats?.find(d => d.name === enName) || {};
    setDistrictPanel({
      zhName: featureName, enName,
      population: distInfo.population, area: distInfo.area,
      commercial: stats.commercial ?? 0,
      last_mile:  stats.last_mile  ?? 0,
    });
  }, [focusDistrict, districtStats]);

  const handleDeckClick = useCallback((info) => {
    // stop auto-play
    stopAutoPlay();

    // Tab 3: pixel-distance hit test for hubs
    if (activeTab === 3 && tab3Data && containerRef.current) {
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      const vp = new WebMercatorViewport({ ...viewStateRef.current, width: w, height: h });
      const HIT_RADIUS = 22;
      let nearest = null, nearestDist = Infinity;
      tab3Data.hubs.forEach((hub, i) => {
        const [px, py] = vp.project([hub.lon, hub.lat]);
        const d = Math.sqrt((px - info.x) ** 2 + (py - info.y) ** 2);
        if (d < HIT_RADIUS && d < nearestDist) { nearestDist = d; nearest = i; }
      });
      if (nearest !== null) {
        const isDeselecting = selectedHubIdx === nearest;
        setSelectedHubIdx(isDeselecting ? null : nearest);
        if (!isDeselecting) {
          const { hub, reachable } = tab3Data.connections[nearest];
          const allPts = [hub, ...reachable];
          const lons = allPts.map(p => p.lon);
          const lats = allPts.map(p => p.lat);
          const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
          const { clientWidth: w, clientHeight: h } = containerRef.current;
          const vp = new WebMercatorViewport({ ...viewStateRef.current, width: w, height: h });
          const { longitude, latitude, zoom } = vp.fitBounds(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60 }
          );
          setViewState(vs => ({ ...vs, longitude, latitude, zoom, transitionDuration: 700 }));
        }
        return;
      }
    }

    // district hit test
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const features = map.queryRenderedFeatures([info.x, info.y], { layers: ['sz-boundary-fill'] });
    if (!features || features.length === 0) {
      setTooltip(null);
      setDistrictPanel(null);
      return;
    }
    const featureName = features[0].properties.name;
    const feature = boundary?.features?.find(f => f.properties.name === featureName);
    if (!feature) return;
    const bbox = getBbox(feature);
    if (containerRef.current) {
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const vp = new WebMercatorViewport({ width, height });
      const { longitude, latitude, zoom } = vp.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40 }
      );
      setViewState(vs => ({ ...vs, longitude, latitude, zoom, transitionDuration: 800 }));
    }
    onDistrictFocus?.({ featureName, bbox });
    const enName   = DISTRICT_EN[featureName] || featureName;
    const distInfo = DISTRICT_INFO[featureName] || {};
    const stats    = districtStats?.find(d => d.name === enName) || {};
    setDistrictPanel({
      zhName: featureName, enName,
      population: distInfo.population, area: distInfo.area,
      commercial: stats.commercial ?? 0,
      last_mile:  stats.last_mile  ?? 0,
    });
  }, [activeTab, tab3Data, districtStats, onDistrictFocus]);

  const lastHoverDistRef = useRef(null);
  const hoverThrottleRef = useRef(0);
  const handleDeckHover = useCallback((info) => {
    const now = performance.now();
    if (now - hoverThrottleRef.current < 32) return;
    hoverThrottleRef.current = now;

    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const features = map.queryRenderedFeatures([info.x, info.y], { layers: ['sz-boundary-fill'] });
    if (!features || features.length === 0) {
      if (lastHoverDistRef.current !== null) {
        lastHoverDistRef.current = null;
        setDistrictPanel(null);
        setHoverDistrict(null);
      }
      return;
    }
    const featureName = features[0].properties.name;
    if (featureName === lastHoverDistRef.current) return;
    lastHoverDistRef.current = featureName;

    setHoverDistrict(featureName);
    const enName   = DISTRICT_EN[featureName] || featureName;
    const distInfo = DISTRICT_INFO[featureName] || {};
    const stats    = districtStats?.find(d => d.name === enName) || {};
    setDistrictPanel({
      zhName: featureName, enName,
      population: distInfo.population, area: distInfo.area,
      commercial: stats.commercial ?? 0,
      last_mile:  stats.last_mile  ?? 0,
    });
  }, [districtStats]);

  // ── DeckGL layers ──
  const deckLayers = useMemo(() => {
    const layers = [];

    if (activeTab === 3 && activeArcs.length > 0) {
      const arcProps = {
        data: activeArcs,
        getSourcePosition: d => d.src,
        getTargetPosition: d => d.tgt,
        getHeight: 0.7,
        greatCircle: false,
      };
      layers.push(new ArcLayer({ ...arcProps, id: 'arc-glow',
        getSourceColor: [255, 230, 80, 15], getTargetColor: [120, 220, 255, 15],
        getWidth: 8, widthMinPixels: 4 }));
      layers.push(new ArcLayer({ ...arcProps, id: 'arc-mid',
        getSourceColor: [255, 220, 60, 55], getTargetColor: [100, 200, 255, 55],
        getWidth: 2.5, widthMinPixels: 1.5 }));
      layers.push(new ArcLayer({ ...arcProps, id: 'arc-core',
        getSourceColor: [255, 245, 160, 255], getTargetColor: [180, 240, 255, 255],
        getWidth: 0.7, widthMinPixels: 0.7 }));
    }

    return layers;
  }, [activeTab, activeArcs, data, selectedHubIdx]);

  const highlightFeatures = useMemo(() => {
    const name = hoverDistrict || focusDistrict?.featureName;
    return {
      type: 'FeatureCollection',
      features: name && boundary
        ? boundary.features.filter(f => f.properties.name === name)
        : [],
    };
  }, [hoverDistrict, focusDistrict, boundary]);

  return (
    <div ref={containerRef} className="p3-map-root" style={{ position: 'absolute', inset: 0 }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{ doubleClickZoom: false }}
        layers={deckLayers}
        style={{ position: 'absolute', inset: 0 }}
        onClick={handleDeckClick}
        onHover={handleDeckHover}
      >
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          projection="mercator"
          style={{ width: '100%', height: '100%' }}
          onLoad={e => {
            const map = e.target;
            map.getStyle().layers.forEach(l => {
              if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
            });
          }}
        >
          {/* Tab 3: 3D buildings */}
          {activeTab === 3 && (
            <Layer id="3d-buildings" type="fill-extrusion" source="composite" source-layer="building"
              filter={['==', 'extrude', 'true']}
              minzoom={12}
              paint={{
                'fill-extrusion-color': '#1a1a2e',
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.7,
              }}
            />
          )}


          {boundary && <Source id="sz-boundary" type="geojson" data={boundary}>
            <Layer id="sz-boundary-fill" type="fill" paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.03 }} />
            <Layer id="sz-boundary-line" type="line"
              paint={{ 'line-color': 'rgba(200,200,210,0.6)', 'line-width': 1, 'line-dasharray': [6, 4] }} />
          </Source>}

          <Source id="sz-highlight" type="geojson" data={highlightFeatures}>
            <Layer id="sz-district-highlight" type="fill" beforeId="sz-boundary-line"
              paint={{ 'fill-color': '#2E5E7E', 'fill-opacity': 0.5 }} />
            <Layer id="sz-district-highlight-border" type="line"
              paint={{ 'line-color': 'rgba(220,220,230,0.9)', 'line-width': 1.5 }} />
          </Source>

          {/* Tab 1 */}
          {activeTab === 1 && data?.map((d, i) => (
            <Marker key={i} longitude={d.lon} latitude={d.lat} anchor="bottom"
              onClick={e => { e.originalEvent.stopPropagation(); setTooltip(tooltip?.i === i ? null : { ...d, i }); }}>
              <PinIcon color={ZONE_META[d.zone_type]?.hex || '#888'} />
            </Marker>
          ))}

          {/* Tab 3：last-mile */}
          {activeTab === 3 && tab3Data?.lms.map((d, i) => {
            const isReachable = reachableSet ? reachableSet.has(d) : false;
            if (selectedHubIdx !== null && !isReachable) return null;
            return (
              <Marker key={`lm${i}`} longitude={d.lon} latitude={d.lat} anchor="bottom">
                <div style={{ pointerEvents: 'none', opacity: selectedHubIdx === null ? 0.5 : 1 }}>
                  <PinIcon color={selectedHubIdx === null ? '#606070' : '#c864ff'} size={14} />
                </div>
              </Marker>
            );
          })}
          {/* Tab 3：hub */}
          {activeTab === 3 && tab3Data?.hubs.map((d, i) => {
            const isSelected = selectedHubIdx === i;
            const isDimmed   = selectedHubIdx !== null && !isSelected;
            return (
              <Marker key={`h${i}`} longitude={d.lon} latitude={d.lat} anchor="bottom">
                <div style={{
                  transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  pointerEvents: 'none',
                  opacity: isDimmed ? 0.35 : 1,
                }}>
                  <PinIcon color="#ffa028" size={18} />
                </div>
              </Marker>
            );
          })}

          {/* Tab 4: Hex Grid (Mapbox native, rendered below markers) */}
          {activeTab === 4 && hexGrid && (
            <Source id="hex-grid" type="geojson" data={hexGrid}>
              <Layer id="hex-grid-fill" type="fill"
                paint={{
                  'fill-color': [
                    'step', ['get', 'coverage_ratio'],
                    '#111118',    // 0  — no coverage
                    0.001, '#0d3060',  // very low
                    50,   '#0a5a8a',   // low
                    100,  '#0b7a6a',   // medium-low
                    200,  '#1a9640',   // medium
                    400,  '#c8a200',   // medium-high
                    800,  '#d04800',   // high
                    1500, '#b50000',   // very high
                  ],
                  'fill-opacity': [
                    'step', ['get', 'coverage_ratio'],
                    0.12,
                    0.001, 0.55,
                    50,   0.65,
                    100,  0.70,
                    200,  0.75,
                    400,  0.82,
                    800,  0.88,
                    1500, 0.92,
                  ],
                }}
              />
              <Layer id="hex-grid-line" type="line"
                paint={{ 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.15 }} />
            </Source>
          )}

          {/* Tab 4: launch/landing point pin icons */}
          {activeTab === 4 && data?.map((d, i) => (
            <Marker key={`v${i}`} longitude={d.lon} latitude={d.lat} anchor="bottom"
              style={{ zIndex: 10 }}>
              <div style={{ pointerEvents: 'none' }}>
                <PinIcon color="#e03030" size={14} />
              </div>
            </Marker>
          ))}

          {/* Tab 2 */}
          {activeTab === 2 && data?.map((d, i) => {
            const isActive = compoundFilter === 'all' || compoundFilter === d.dominant_poi;
            return (
              <Marker key={i} longitude={d.lon} latitude={d.lat} anchor="bottom"
                onClick={e => { e.originalEvent.stopPropagation(); setTooltip(tooltip?.i === i ? null : { ...d, i }); }}>
                <div style={{ opacity: isActive ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                  <PoiPinIcon type={d.dominant_poi} size={20} />
                </div>
              </Marker>
            );
          })}

        </Map>
      </DeckGL>

      {/* Tooltip */}
      {tooltip && (activeTab === 1 || activeTab === 2) && (
        <div className="p3-map-tooltip" style={{ left: '50%', top: 12, transform: 'translateX(-50%)' }}>
          {activeTab === 1 && (
            <div className="p3-tip-type" style={{ color: ZONE_META[tooltip.zone_type]?.hex }}>
              {ZONE_META[tooltip.zone_type]?.label}
            </div>
          )}
          {activeTab === 2 && (
            <div className="p3-tip-type" style={{ color: POI_COLORS[tooltip.dominant_poi]?.hex }}>
              {POI_COLORS[tooltip.dominant_poi]?.label}
            </div>
          )}
          {tooltip.nearest_compound && <div className="p3-tip-name">{tooltip.nearest_compound}</div>}
          <div className="p3-tip-meta">{tooltip.dominant_poi} · {tooltip.distance_m}m</div>
        </div>
      )}

      {/* auto-play hint */}
      {autoPlaying && activeTab === 3 && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,30,0.75)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100,200,255,0.25)', borderRadius: 8,
          padding: '8px 18px', color: 'rgba(200,220,255,0.8)', fontSize: 12,
          letterSpacing: 1, pointerEvents: 'none', zIndex: 30,
          animation: 'fadeInUp 0.4s ease both',
        }}>
          Click anywhere to stop autoplay
        </div>
      )}

      {/* district info panel */}
      {districtPanel && (
        <div className="p3-district-panel">
          <div className="p3-dp-header">
            <span className="p3-dp-zh">{districtPanel.enName}</span>
            <span className="p3-dp-en">District</span>
          </div>
          <div className="p3-dp-divider" />
          <div className="p3-dp-row">
            <span className="p3-dp-label">Population</span>
            <span className="p3-dp-val">{districtPanel.population} ×10k</span>
          </div>
          <div className="p3-dp-row">
            <span className="p3-dp-label">Area</span>
            <span className="p3-dp-val">{districtPanel.area} km²</span>
          </div>
          <div className="p3-dp-row">
            <span className="p3-dp-label">Density</span>
            <span className="p3-dp-val">
              {districtPanel.population && districtPanel.area
                ? Math.round(districtPanel.population * 10000 / districtPanel.area).toLocaleString()
                : '—'} /km²
            </span>
          </div>
          <div className="p3-dp-divider" />
          <div className="p3-dp-row">
            <span className="p3-dp-label">Total Sites</span>
            <span className="p3-dp-val">{districtPanel.commercial + districtPanel.last_mile}</span>
          </div>
          <div className="p3-dp-row">
            <span className="p3-dp-label" style={{ color: '#ffa028' }}>Commercial area</span>
            <span className="p3-dp-val">{districtPanel.commercial}</span>
          </div>
          <div className="p3-dp-row">
            <span className="p3-dp-label" style={{ color: '#c864ff' }}>Last-mile</span>
            <span className="p3-dp-val">{districtPanel.last_mile}</span>
          </div>
        </div>
      )}

      {/* Hub type legend — Routes tab only */}
      {activeTab === 3 && (
        <div className="p3-hub-legend">
          {[
            { color: '#ffa028', label: 'Departure Hub' },
            { color: '#606070', label: 'All Landing Hub' },
            { color: '#c864ff', label: 'Reachable Hub' },
          ].map(({ color, label }) => (
            <div key={label} className="p3-hub-legend-row">
              <PinIcon color={color} size={12} />
              <span className="p3-hub-legend-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(vs => ({ ...vs, ...INITIAL_VIEW, transitionDuration: 800 }))}
        onResetBearing={() => setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }))}
      />
    </div>
  );
}

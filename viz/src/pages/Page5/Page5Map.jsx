import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ArcLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator, WebMercatorViewport } from '@deck.gl/core';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { MAPBOX_TOKEN } from '../../config';
import { createDroneMesh, createPersonMesh, createRiderMesh, createPinMesh } from './meshes';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

function interpPath(coords, t) {
  if (t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  let total = 0;
  const segs = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const dx = (b[0] - a[0]) * 102500;
    const dy = (b[1] - a[1]) * 111000;
    const dz = (b[2] ?? 0) - (a[2] ?? 0);
    segs.push(Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.001);
    total += segs[segs.length - 1];
  }
  let target = t * total, cum = 0;
  for (let i = 0; i < segs.length; i++) {
    if (cum + segs[i] >= target) {
      const s = (target - cum) / segs[i];
      const a = coords[i], b = coords[i + 1];
      return [a[0]+(b[0]-a[0])*s, a[1]+(b[1]-a[1])*s, (a[2]??0)+((b[2]??0)-(a[2]??0))*s];
    }
    cum += segs[i];
  }
  return coords[coords.length - 1];
}

function pathYaw(coords, t) {
  const p0 = interpPath(coords, Math.max(0, t - 0.01));
  const p1 = interpPath(coords, Math.min(1, t + 0.01));
  return Math.atan2((p1[0]-p0[0])*102500, (p1[1]-p0[1])*111000) * 180 / Math.PI;
}

function geoDistM([lng1, lat1], [lng2, lat2]) {
  const dx = (lng2 - lng1) * 102500;
  const dy = (lat2 - lat1) * 111000;
  return Math.sqrt(dx * dx + dy * dy);
}

function droneArc(hub1, hub2, peakAlt = 120, steps = 60) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [
      hub1[0] + (hub2[0] - hub1[0]) * t,
      hub1[1] + (hub2[1] - hub1[1]) * t,
      4 * peakAlt * t * (1 - t),
    ];
  });
}

// Single parabolic altitude profile over a bent path hub1→waypoint→hub2
function droneDetourArc(hub1, waypoint, hub2, peakAlt = 140, steps = 60) {
  const d1 = geoDistM(hub1, waypoint);
  const d2 = geoDistM(waypoint, hub2);
  const total = d1 + d2;
  const tWP = d1 / total; // where the waypoint sits in [0,1]
  const steps1 = Math.max(1, Math.round(steps * tWP));
  const steps2 = steps - steps1;
  const pts = [];
  for (let i = 0; i <= steps1; i++) {
    const t = (i / steps1) * tWP;
    const s = i / steps1;
    pts.push([hub1[0] + (waypoint[0] - hub1[0]) * s, hub1[1] + (waypoint[1] - hub1[1]) * s, 4 * peakAlt * t * (1 - t)]);
  }
  for (let i = 1; i <= steps2; i++) {
    const t = tWP + (i / steps2) * (1 - tWP);
    const s = i / steps2;
    pts.push([waypoint[0] + (hub2[0] - waypoint[0]) * s, waypoint[1] + (hub2[1] - waypoint[1]) * s, 4 * peakAlt * t * (1 - t)]);
  }
  return pts;
}

const INIT_VIEW = { longitude: 114.058, latitude: 22.530, zoom: 13.2, pitch: 60, bearing: 45 };
// Animation speed multiplier — both the courier and drone move 20× faster than real time
// for demonstration purposes only; actual delivery durations are shown in the panel as-is.
const ANIM_SPEED = 20;
const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

export default function Page5Map({ buildingData, routes, comparisonRoute, pickMode, onMapClick, tallBuildings, pickedOrigin, pickedDest }) {
  const [viewState, setViewState] = useState(INIT_VIEW);
  const droneMesh  = useMemo(() => createDroneMesh(), []);
  const personMesh = useMemo(() => createPersonMesh(), []);
  const riderMesh  = useMemo(() => createRiderMesh(), []);
  const pinMesh    = useMemo(() => createPinMesh(), []);

  // 预计算路径
  const leg1Path   = useMemo(() => comparisonRoute?.drone?.leg1?.coords?.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const arcPath    = useMemo(() => {
    if (!comparisonRoute) return null;
    const { hub1, hub2, droneWaypoint } = comparisonRoute;
    if (droneWaypoint) {
      return droneDetourArc(hub1, droneWaypoint, hub2, 140, 60);
    }
    return droneArc(hub1, hub2, 120, 60);
  }, [comparisonRoute]);
  const leg2Path   = useMemo(() => comparisonRoute?.drone?.leg2?.coords?.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const groundPath = useMemo(() => comparisonRoute?.ground.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);

  const [animT, setAnimT] = useState(0);
  const rafRef = useRef();
  const t0Ref  = useRef(performance.now());
  const visibleRef = useRef(true);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const loop = now => {
      if (visibleRef.current) setAnimT((now - t0Ref.current) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 搜索后 fitBounds 同时看两条路线
  useEffect(() => {
    if (!comparisonRoute) {
      setViewState({ ...INIT_VIEW, transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator() });
      return;
    }
    const { origin, destination } = comparisonRoute;
    const mapW = Math.max(window.innerWidth - 340, 400);
    const mapH = window.innerHeight - 40;
    const vp = new WebMercatorViewport({ width: mapW, height: mapH });
    const { longitude, latitude, zoom } = vp.fitBounds(
      [[Math.min(origin[0], destination[0]), Math.min(origin[1], destination[1])],
       [Math.max(origin[0], destination[0]), Math.max(origin[1], destination[1])]],
      { padding: { top: 60, bottom: 60, left: 60, right: 60 } }
    );
    setViewState(vs => ({
      ...vs, longitude, latitude,
      zoom:   Math.min(zoom, 16),
      pitch:  50,
      bearing: 0,
      transitionDuration: 1400,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, [comparisonRoute]);

  const onMapLoad = useCallback(evt => {
    const map = evt.target;
    const styleLayers = map.getStyle().layers;
    let labelLayerId;
    for (const l of styleLayers) {
      if (l.type === 'symbol' && l.layout?.['text-field']) { labelLayerId = l.id; break; }
    }
    styleLayers.forEach(l => {
      if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
      if (l.type === 'symbol') { try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch {} }
    });
    map.addLayer({ id: 'p5-parks', source: 'composite', 'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'park'], type: 'fill',
      paint: { 'fill-color': '#2d9e4f', 'fill-opacity': 0.5 } }, labelLayerId);
    map.addLayer({ id: 'p5-water', source: 'composite', 'source-layer': 'water', type: 'fill',
      paint: { 'fill-color': '#7dd3f0', 'fill-opacity': 0.8 } }, labelLayerId);
    map.addLayer({ id: 'p5-waterway', source: 'composite', 'source-layer': 'waterway', type: 'line',
      paint: { 'line-color': '#7dd3f0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4], 'line-opacity': 0.8 } }, labelLayerId);
  }, []);

  const [normalBldg, tallBldg] = useMemo(() => {
    if (!buildingData) return [null, null];
    return [
      { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) <= 110) },
      { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) >  110) },
    ];
  }, [buildingData]);

  const layers = useMemo(() => {
  const result = [];

  if (!comparisonRoute && routes?.length) {
    result.push(new ArcLayer({
      id: 'routes-arc', data: routes,
      getSourcePosition: d => [...d.origin, 0],
      getTargetPosition: d => [...d.destination, 0],
      getSourceColor: [255, 80, 80, 200],
      getTargetColor: [255, 220, 0, 200],
      getWidth: 1.5, getHeight: 0.3, widthUnits: 'pixels', pickable: false,
    }));
    result.push(new SimpleMeshLayer({
      id: 'origins', data: routes, mesh: droneMesh,
      getPosition: d => [...d.origin, 30 + 30 * Math.sin(animT * 2.2 + d.id * 0.45)],
      getOrientation: d => [0, (animT * 90 + d.id * 37) % 360, 0],
      getColor: [255, 80, 80, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
    result.push(new SimpleMeshLayer({
      id: 'destinations', data: routes, mesh: droneMesh,
      getPosition: d => [...d.destination, 30 + 30 * Math.sin(animT * 2.2 + d.id * 0.45 + Math.PI)],
      getOrientation: d => [0, (animT * 90 + d.id * 37 + 180) % 360, 0],
      getColor: [255, 220, 0, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
  }

  // ── 对比路线 ──
  if (comparisonRoute && arcPath && groundPath) {
    const { origin, destination, hub1, hub2, drone, ground, directFlight: isDirect } = comparisonRoute;

    const scaledT   = animT * ANIM_SPEED;
    const groundT   = (scaledT % ground.duration) / ground.duration;
    const groundPos = interpPath(groundPath, groundT);

    const droneTotal = drone.totalDuration;
    const loopT      = scaledT % droneTotal;
    const leg1Dur    = drone.leg1?.duration ?? 0;
    const leg2Dur    = drone.leg2?.duration ?? 0;

    let person1Pos = null, dronePos = null, person2Pos = null;
    if (!isDirect && loopT < leg1Dur) {
      person1Pos = interpPath(leg1Path, loopT / leg1Dur);
    } else if (loopT < leg1Dur + drone.arcSec) {
      dronePos = interpPath(arcPath, (loopT - leg1Dur) / drone.arcSec);
    } else if (!isDirect && leg2Path) {
      person2Pos = interpPath(leg2Path, (loopT - leg1Dur - drone.arcSec) / leg2Dur);
    }

    if (!isDirect && leg1Path) {
      result.push(new PathLayer({
        id: 'cmp-leg1', data: [{ path: leg1Path }], getPath: d => d.path,
        getColor: [255, 140, 0, 140], getWidth: 2, widthUnits: 'pixels', pickable: false,
      }));
    }
    result.push(new PathLayer({
      id: 'cmp-arc', data: [{ path: arcPath }], getPath: d => d.path,
      getColor: [255, 200, 0, 200], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));
    if (!isDirect && leg2Path) {
      result.push(new PathLayer({
        id: 'cmp-leg2', data: [{ path: leg2Path }], getPath: d => d.path,
        getColor: [255, 140, 0, 140], getWidth: 2, widthUnits: 'pixels', pickable: false,
      }));
    }
    result.push(new PathLayer({
      id: 'cmp-ground', data: [{ path: groundPath }], getPath: d => d.path,
      getColor: [80, 220, 160, 160], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));

    if (!isDirect && person1Pos) {
      result.push(new SimpleMeshLayer({
        id: 'cmp-person1', data: [{ pos: [person1Pos[0], person1Pos[1], 0] }],
        mesh: personMesh, getPosition: d => d.pos,
        getOrientation: [0, pathYaw(leg1Path, loopT / leg1Dur), 0],
        getColor: [255, 160, 60, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT },
      }));
    }
    if (dronePos) {
      result.push(new SimpleMeshLayer({
        id: 'cmp-drone', data: [{ pos: dronePos }],
        mesh: droneMesh, getPosition: d => d.pos,
        getOrientation: [0, (animT * 60) % 360, 0],
        getColor: [255, 220, 0, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT, getOrientation: animT },
      }));
    }
    if (!isDirect && person2Pos) {
      result.push(new SimpleMeshLayer({
        id: 'cmp-person2', data: [{ pos: [person2Pos[0], person2Pos[1], 0] }],
        mesh: personMesh, getPosition: d => d.pos,
        getOrientation: [0, pathYaw(leg2Path, (loopT - leg1Dur - drone.arcSec) / leg2Dur), 0],
        getColor: [255, 160, 60, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT },
      }));
    }

    result.push(new SimpleMeshLayer({
      id: 'cmp-ground-person', data: [{ pos: [groundPos[0], groundPos[1], 0] }],
      mesh: riderMesh, getPosition: d => d.pos,
      getOrientation: [0, pathYaw(groundPath, groundT), 0],
      getColor: [80, 255, 160, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT },
    }));

    result.push(new TextLayer({
      id: 'cmp-labels',
      data: [
        { pos: [...origin,      100], text: isDirect ? 'Departure Hub' : 'Origin',      color: [255, 120, 120, 255] },
        { pos: [...destination, 100], text: isDirect ? 'Landing Hub'   : 'Destination', color: [80,  220, 160, 255] },
      ],
      getPosition: d => d.pos,
      getText:     d => d.text,
      getColor:    d => d.color,
      getSize: 14,
      fontWeight: 'bold',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      background: true,
      getBackgroundColor: [10, 12, 30, 190],
      backgroundPadding: [5, 3, 5, 3],
      pickable: false,
    }));

    result.push(new SimpleMeshLayer({
      id: 'pin-origin',
      data: [{ pos: [...origin, 0] }],
      mesh: pinMesh,
      getPosition: d => d.pos,
      getOrientation: [0, 0, 0],
      getColor: [255, 90, 90, 255],
      sizeScale: 80,
      material: { ambient: 0.6, diffuse: 0.8, shininess: 60 },
      pickable: false,
    }));
    result.push(new SimpleMeshLayer({
      id: 'pin-destination',
      data: [{ pos: [...destination, 0] }],
      mesh: pinMesh,
      getPosition: d => d.pos,
      getOrientation: [0, 0, 0],
      getColor: [60, 220, 140, 255],
      sizeScale: 80,
      material: { ambient: 0.6, diffuse: 0.8, shininess: 60 },
      pickable: false,
    }));

    if (!isDirect) {
      const hubData = [
        { pos: [...hub1, 0], labelPos: [...hub1, 200], color: [60, 210, 255, 230], label: 'Departure' },
        { pos: [...hub2, 0], labelPos: [...hub2, 200], color: [190, 90, 255, 230], label: 'Landing'   },
      ];
      result.push(new ScatterplotLayer({
        id: 'cmp-hubs', data: hubData,
        getPosition: d => d.pos,
        getFillColor: d => d.color,
        getLineColor: [255, 255, 255, 180],
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        getRadius: 40,
        pickable: false,
      }));
      result.push(new TextLayer({
        id: 'cmp-hub-labels', data: hubData,
        getPosition: d => d.labelPos,
        getText:     d => d.label,
        getColor:    d => d.color,
        getSize: 13,
        fontWeight: 'bold',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        background: true,
        getBackgroundColor: [10, 12, 30, 190],
        backgroundPadding: [5, 3, 5, 3],
        pickable: false,
      }));
    }
  }

  // ── pre-search picked point labels ──
  if (!comparisonRoute) {
    const prePickData = [
      pickedOrigin && { pos: [...pickedOrigin, 100], text: 'Origin',      color: [255, 90,  90,  255] },
      pickedDest   && { pos: [...pickedDest,   100], text: 'Destination', color: [60,  220, 140, 255] },
    ].filter(Boolean);

    if (prePickData.length) {
      result.push(new SimpleMeshLayer({
        id: 'pre-pick-pins', data: prePickData, mesh: pinMesh,
        getPosition: d => d.pos,
        getOrientation: [0, 0, 0],
        getColor: d => d.color,
        sizeScale: 80,
        material: { ambient: 0.6, diffuse: 0.8, shininess: 60 },
        pickable: false,
      }));
      result.push(new TextLayer({
        id: 'pre-pick-labels', data: prePickData,
        getPosition: d => d.pos,
        getText:     d => d.text,
        getColor:    d => d.color,
        getSize: 14,
        fontWeight: 'bold',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        background: true,
        getBackgroundColor: [10, 12, 30, 200],
        backgroundPadding: [5, 3, 5, 3],
        pickable: false,
      }));
    }
  }

  if (normalBldg) {
    result.push(new GeoJsonLayer({
      id: 'buildings-normal', data: normalBldg,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 255, 255, 210],
      material: { ambient: 0.4, diffuse: 0.6, shininess: 40 }, pickable: false,
    }));
  }
  if (tallBldg) {
    result.push(new GeoJsonLayer({
      id: 'buildings-tall', data: tallBldg,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 130, 40, 230],
      material: { ambient: 0.5, diffuse: 0.7, shininess: 60 }, pickable: false,
    }));
  }

  return result;
  }, [comparisonRoute, routes, droneMesh, personMesh, riderMesh, pinMesh,
      animT, leg1Path, arcPath, leg2Path, groundPath,
      normalBldg, tallBldg, pickedOrigin, pickedDest, pickMode]);

  const handleClick = (info) => {
    if (pickMode && info.coordinate) {
      onMapClick([info.coordinate[0], info.coordinate[1]]);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', cursor: pickMode ? 'crosshair' : 'grab' }}>
      <DeckGL viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true} layers={layers} style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
        getCursor={() => pickMode ? 'crosshair' : 'grab'}>
        <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAP_STYLE} onLoad={onMapLoad} />
      </DeckGL>

      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(vs => ({
          ...vs, ...INIT_VIEW,
          transitionDuration: 1200,
          transitionInterpolator: new FlyToInterpolator(),
        }))}
        onResetBearing={() => setViewState(vs => ({
          ...vs, bearing: 0, pitch: 0,
          transitionDuration: 400,
        }))}
      />

      <button
        className="p5-next-page-btn"
        onClick={() => document.getElementById('page-6')?.scrollIntoView({ behavior: 'smooth' })}
      >
        Next Page
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2l10 10-10 10" />
        </svg>
      </button>
    </div>
  );
}

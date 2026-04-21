import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ArcLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator, WebMercatorViewport } from '@deck.gl/core';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { MAPBOX_TOKEN } from '../../config';
import { createDroneMesh, createPersonMesh, createRiderMesh, createPinMesh } from './meshes';
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

const INIT_VIEW = { longitude: 114.058, latitude: 22.530, zoom: 13.2, pitch: 60, bearing: 45 };
// Animation speed multiplier — both the courier and drone move 20× faster than real time
// for demonstration purposes only; actual delivery durations are shown in the panel as-is.
const ANIM_SPEED = 20;
const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

export default function Page5Map({ buildingData, routes, comparisonRoute, pickMode, onMapClick, tallBuildings }) {
  const [viewState, setViewState] = useState(INIT_VIEW);
  const droneMesh  = useMemo(() => createDroneMesh(), []);
  const personMesh = useMemo(() => createPersonMesh(), []);
  const riderMesh  = useMemo(() => createRiderMesh(), []);
  const pinMesh    = useMemo(() => createPinMesh(), []);

  // 预计算路径
  const leg1Path   = useMemo(() => comparisonRoute?.drone.leg1.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const arcPath    = useMemo(() => {
    if (!comparisonRoute) return null;
    const { hub1, hub2, droneWaypoint } = comparisonRoute;
    if (droneWaypoint) {
      // Route around tall building: hub1 → waypoint → hub2, peak alt 140 m to clear 110 m buildings
      return [
        ...droneArc(hub1, droneWaypoint, 140, 30),
        ...droneArc(droneWaypoint, hub2, 140, 30).slice(1),
      ];
    }
    return droneArc(hub1, hub2, 120, 60);
  }, [comparisonRoute]);
  const leg2Path   = useMemo(() => comparisonRoute?.drone.leg2.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const groundPath = useMemo(() => comparisonRoute?.ground.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);

  const [animT, setAnimT] = useState(0);
  const rafRef = useRef();
  const t0Ref  = useRef(performance.now());

  useEffect(() => {
    const loop = now => {
      setAnimT((now - t0Ref.current) / 1000);
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
    const vp = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight });
    const { longitude, latitude, zoom } = vp.fitBounds(
      [[Math.min(origin[0], destination[0]), Math.min(origin[1], destination[1])],
       [Math.max(origin[0], destination[0]), Math.max(origin[1], destination[1])]],
      { padding: { top: 60, bottom: 60, left: 320, right: 40 } }
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

  const layers = [];

  // ── 背景航线（无搜索时）──
  if (!comparisonRoute && routes?.length) {
    layers.push(new ArcLayer({
      id: 'routes-arc', data: routes,
      getSourcePosition: d => [...d.origin, 0],
      getTargetPosition: d => [...d.destination, 0],
      getSourceColor: [255, 80, 80, 200],
      getTargetColor: [255, 220, 0, 200],
      getWidth: 1.5, getHeight: 0.3, widthUnits: 'pixels', pickable: false,
    }));
    layers.push(new SimpleMeshLayer({
      id: 'origins', data: routes, mesh: droneMesh,
      getPosition: d => [...d.origin, 30 + 30 * Math.sin(animT * 2.2 + d.id * 0.45)],
      getOrientation: d => [0, (animT * 90 + d.id * 37) % 360, 0],
      getColor: [255, 80, 80, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
    layers.push(new SimpleMeshLayer({
      id: 'destinations', data: routes, mesh: droneMesh,
      getPosition: d => [...d.destination, 30 + 30 * Math.sin(animT * 2.2 + d.id * 0.45 + Math.PI)],
      getOrientation: d => [0, (animT * 90 + d.id * 37 + 180) % 360, 0],
      getColor: [255, 220, 0, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
  }

  // ── 对比路线 ──
  if (comparisonRoute && leg1Path && arcPath && leg2Path && groundPath) {
    const { origin, destination, hub1, hub2, drone, ground } = comparisonRoute;

    // ── 地面骑手（全程，循环动画）──
    const scaledT   = animT * ANIM_SPEED;
    const groundT   = (scaledT % ground.duration) / ground.duration;
    const groundPos = interpPath(groundPath, groundT);

    // ── 无人机三阶段动画 ──
    const droneTotal = drone.totalDuration;
    const loopT      = scaledT % droneTotal;
    const leg1Dur    = drone.leg1.duration;
    const leg2Dur    = drone.leg2.duration;

    let person1Pos = null, dronePos = null, person2Pos = null;
    if (loopT < leg1Dur) {
      // 阶段1：跑腿员从商家 → 枢纽1
      person1Pos = interpPath(leg1Path, loopT / leg1Dur);
    } else if (loopT < leg1Dur + drone.arcSec) {
      // 阶段2：无人机从枢纽1 → 枢纽2
      dronePos = interpPath(arcPath, (loopT - leg1Dur) / drone.arcSec);
    } else {
      // 阶段3：跑腿员从枢纽2 → 客户
      person2Pos = interpPath(leg2Path, (loopT - leg1Dur - drone.arcSec) / leg2Dur);
    }

    // 轨迹线
    layers.push(new PathLayer({
      id: 'cmp-leg1', data: [{ path: leg1Path }], getPath: d => d.path,
      getColor: [255, 140, 0, 140], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));
    layers.push(new PathLayer({
      id: 'cmp-arc', data: [{ path: arcPath }], getPath: d => d.path,
      getColor: [255, 200, 0, 200], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));
    layers.push(new PathLayer({
      id: 'cmp-leg2', data: [{ path: leg2Path }], getPath: d => d.path,
      getColor: [255, 140, 0, 140], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));
    layers.push(new PathLayer({
      id: 'cmp-ground', data: [{ path: groundPath }], getPath: d => d.path,
      getColor: [80, 220, 160, 160], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }));

    // 移动图标
    if (person1Pos) {
      layers.push(new SimpleMeshLayer({
        id: 'cmp-person1', data: [{ pos: [person1Pos[0], person1Pos[1], 0] }],
        mesh: personMesh, getPosition: d => d.pos,
        getOrientation: [0, pathYaw(leg1Path, loopT / leg1Dur), 0],
        getColor: [255, 160, 60, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT },
      }));
    }
    if (dronePos) {
      layers.push(new SimpleMeshLayer({
        id: 'cmp-drone', data: [{ pos: dronePos }],
        mesh: droneMesh, getPosition: d => d.pos,
        getOrientation: [0, (animT * 60) % 360, 0],
        getColor: [255, 220, 0, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT, getOrientation: animT },
      }));
    }
    if (person2Pos) {
      layers.push(new SimpleMeshLayer({
        id: 'cmp-person2', data: [{ pos: [person2Pos[0], person2Pos[1], 0] }],
        mesh: personMesh, getPosition: d => d.pos,
        getOrientation: [0, pathYaw(leg2Path, (loopT - leg1Dur - drone.arcSec) / leg2Dur), 0],
        getColor: [255, 160, 60, 255], sizeScale: 120, material: false, pickable: false,
        updateTriggers: { getPosition: animT },
      }));
    }

    // Ground rider (full route, simultaneous) — shown as cyclist
    layers.push(new SimpleMeshLayer({
      id: 'cmp-ground-person', data: [{ pos: [groundPos[0], groundPos[1], 0] }],
      mesh: riderMesh, getPosition: d => d.pos,
      getOrientation: [0, pathYaw(groundPath, groundT), 0],
      getColor: [80, 255, 160, 255], sizeScale: 120, material: false, pickable: false,
      updateTriggers: { getPosition: animT },
    }));

    // Origin / destination labels
    layers.push(new TextLayer({
      id: 'cmp-labels',
      data: [
        { pos: [...origin,      30], text: 'Origin',      color: [255, 120, 120, 255] },
        { pos: [...destination, 30], text: 'Destination', color: [80,  220, 160, 255] },
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

    // Origin / destination: 3-D map pins
    layers.push(new SimpleMeshLayer({
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
    layers.push(new SimpleMeshLayer({
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

    // Hub markers: takeoff (cyan) vs landing (purple)
    layers.push(new ScatterplotLayer({
      id: 'cmp-hubs',
      data: [
        { pos: [...hub1, 0], color: [60, 210, 255, 230] },  // takeoff — cyan
        { pos: [...hub2, 0], color: [190, 90, 255, 230] },  // landing — purple
      ],
      getPosition: d => d.pos,
      getFillColor: d => d.color,
      getLineColor: [255, 255, 255, 180],
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      getRadius: 40,
      pickable: false,
    }));
  }

  if (buildingData) {
    const normalFeatures = { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) <= 110) };
    const tallFeatures   = { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) >  110) };

    layers.push(new GeoJsonLayer({
      id: 'buildings-normal', data: normalFeatures,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 255, 255, 210],
      material: { ambient: 0.4, diffuse: 0.6, shininess: 40 }, pickable: false,
    }));
    // Buildings > 110 m rendered in orange — drone must avoid these
    layers.push(new GeoJsonLayer({
      id: 'buildings-tall', data: tallFeatures,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 130, 40, 230],
      material: { ambient: 0.5, diffuse: 0.7, shininess: 60 }, pickable: false,
    }));
  }

  const handleClick = (info) => {
    if (pickMode && info.coordinate) {
      onMapClick([info.coordinate[0], info.coordinate[1]]);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, cursor: pickMode ? 'crosshair' : 'grab' }}>
      <DeckGL viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true} layers={layers} style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
        getCursor={() => pickMode ? 'crosshair' : 'grab'}>
        <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAP_STYLE} onLoad={onMapLoad} />
      </DeckGL>
    </div>
  );
}

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { TripsLayer, H3HexagonLayer } from '@deck.gl/geo-layers';
import { FlyToInterpolator, WebMercatorViewport, LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import { SimpleMeshLayer, ScenegraphLayer } from '@deck.gl/mesh-layers';
import { MAPBOX_TOKEN } from '../../config';
import { createPinMesh } from './meshes';
import { buildTripTimestamps } from './page5TripUtils';
import { computeRouteScenario, buildSparkBurst, pathYaw } from './page5Sim';
import { GLTF_CYCLIST, GLTF_DRONE_AND_COURIER } from './page5Models';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

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
const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

/** glTF meshes read better ~ +85° yaw on Mercator-ground paths */
const MODEL_YAW_OFFSET = 85;

function hubPulseScatter({ idPrefix, lng, lat, color, animT }) {
  const hue = [...color.slice(0, 3)];
  const layers = [];
  for (let k = 0; k < 3; k++) {
    const period = 2.8;
    const phase = (((animT * 1.15 + k * 0.95) % period) / period);
    const expand = phase;
    const alpha = Math.floor((0.62 - expand * 0.45 + k * 0.06) * 255);
    layers.push(new ScatterplotLayer({
      id: `${idPrefix}-pulse-${k}`,
      data: [{ position: [lng, lat, 0], fill: [...hue, alpha] }],
      pickable: false,
      stroked: true,
      getPosition: d => d.position,
      getFillColor: d => d.fill,
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      getLineColor: [255, 255, 255, Math.floor(70 + expand * 120)],
      getRadius: 36 + expand * (85 + k * 42),
      radiusUnits: 'meters',
      updateTriggers: { getFillColor: animT, getRadius: animT, getLineColor: animT },
    }));
  }
  return layers;
}

export default function Page5Map({ buildingData, routes, comparisonRoute, pickMode, onMapClick, h3Cells = [] }) {
  const [viewState, setViewState] = useState(INIT_VIEW);
  const [cameraFollow, setCameraFollow] = useState(false);
  const [animT, setAnimT] = useState(0);
  const rafRef = useRef();
  const t0Ref = useRef(0);
  const pinMesh = useMemo(() => createPinMesh(), []);

  const lightingEffect = useMemo(() => new LightingEffect({
    amb: new AmbientLight({ color: [235, 240, 255], intensity: 0.52 }),
    key: new DirectionalLight({
      intensity: 0.95,
      direction: [-0.42, -0.38, -0.82],
    }),
    rim: new DirectionalLight({
      intensity: 0.45,
      color: [210, 230, 255],
      direction: [0.55, -0.12, -0.82],
    }),
  }), []);

  const leg1Path = useMemo(() => comparisonRoute?.drone.leg1.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const arcPath = useMemo(() => {
    if (!comparisonRoute) return null;
    const { hub1, hub2, droneWaypoint } = comparisonRoute;
    if (droneWaypoint) {
      return [
        ...droneArc(hub1, droneWaypoint, 140, 30),
        ...droneArc(droneWaypoint, hub2, 140, 30).slice(1),
      ];
    }
    return droneArc(hub1, hub2, 120, 60);
  }, [comparisonRoute]);
  const leg2Path = useMemo(() => comparisonRoute?.drone.leg2.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);
  const groundPath = useMemo(() => comparisonRoute?.ground.coords.map(c => [...c, 0]) ?? null, [comparisonRoute]);

  const pathBundle = useMemo(() => {
    if (!comparisonRoute || !leg1Path || !arcPath || !leg2Path || !groundPath) return null;
    return {
      drone: comparisonRoute.drone,
      ground: comparisonRoute.ground,
      leg1Path,
      arcPath,
      leg2Path,
      groundPath,
    };
  }, [comparisonRoute, leg1Path, arcPath, leg2Path, groundPath]);

  const scenario = useMemo(
    () => (pathBundle ? computeRouteScenario(comparisonRoute, animT, pathBundle) : null),
    [comparisonRoute, animT, pathBundle],
  );

  const mergedViewState = useMemo(() => {
    if (!cameraFollow || !scenario?.focusLngLat) return viewState;
    return {
      ...viewState,
      longitude: scenario.focusLngLat[0],
      latitude: scenario.focusLngLat[1],
      bearing: scenario.focusBearing ?? viewState.bearing,
      pitch: Math.max(viewState.pitch ?? 0, 48),
    };
  }, [cameraFollow, scenario, viewState]);

  const leg1Timestamps = useMemo(() =>
    comparisonRoute && leg1Path
      ? buildTripTimestamps(leg1Path, 0, comparisonRoute.drone.leg1.duration)
      : null,
  [comparisonRoute, leg1Path]);

  const arcTimestamps = useMemo(() =>
    comparisonRoute && arcPath
      ? buildTripTimestamps(arcPath, 0, comparisonRoute.drone.arcSec)
      : null,
  [comparisonRoute, arcPath]);

  const leg2Timestamps = useMemo(() =>
    comparisonRoute && leg2Path
      ? buildTripTimestamps(leg2Path, 0, comparisonRoute.drone.leg2.duration)
      : null,
  [comparisonRoute, leg2Path]);

  const groundTimestamps = useMemo(() =>
    comparisonRoute && groundPath
      ? buildTripTimestamps(groundPath, 0, comparisonRoute.ground.duration)
      : null,
  [comparisonRoute, groundPath]);

  useEffect(() => {
    t0Ref.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const loop = now => {
      setAnimT((now - t0Ref.current) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let enableFollowTimer;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      setCameraFollow(false);
      if (!comparisonRoute) {
        setViewState({ ...INIT_VIEW, transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator() });
        return;
      }
      const { origin, destination } = comparisonRoute;
      const vp = new WebMercatorViewport({ width: window.innerWidth, height: window.innerHeight });
      const { longitude, latitude, zoom } = vp.fitBounds(
        [[Math.min(origin[0], destination[0]), Math.min(origin[1], destination[1])],
         [Math.max(origin[0], destination[0]), Math.max(origin[1], destination[1])]],
        { padding: { top: 60, bottom: 60, left: 320, right: 40 } },
      );
      setViewState(vs => ({
        ...vs, longitude, latitude,
        zoom: Math.min(zoom, 16),
        pitch: 50,
        bearing: 0,
        transitionDuration: 1400,
        transitionInterpolator: new FlyToInterpolator(),
      }));
      // Brief overview fly first, then follow the drone courier (bearing matches path in page5Sim)
      enableFollowTimer = setTimeout(() => {
        if (cancelled) return;
        setCameraFollow(true);
      }, 1520);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      if (enableFollowTimer) clearTimeout(enableFollowTimer);
    };
  }, [comparisonRoute]);

  const resetViewCentered = useCallback(() => {
    setCameraFollow(false);
    setViewState(vs => ({
      ...vs, ...INIT_VIEW,
      transitionDuration: 1200,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, [setCameraFollow, setViewState]);

  const resetBearingOnly = useCallback(() => {
    setCameraFollow(false);
    setViewState(vs => ({ ...vs, bearing: 0, pitch: 0, transitionDuration: 400 }));
  }, [setCameraFollow, setViewState]);

  const onMapLoad = useCallback(evt => {
    const map = evt.target;
    const styleLayers = map.getStyle().layers;
    let labelLayerId;
    for (const l of styleLayers) {
      if (l.type === 'symbol' && l.layout?.['text-field']) { labelLayerId = l.id; break; }
    }
    styleLayers.forEach(l => {
      if (l['source-layer'] === 'building') map.setLayoutProperty(l.id, 'visibility', 'none');
      if (l.type === 'symbol') {
        try {
          map.setLayoutProperty(l.id, 'visibility', 'none');
        }
        catch { /* ignore missing layouts */ }
      }
    });
    map.addLayer({ id: 'p5-parks', source: 'composite', 'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'park'], type: 'fill',
      paint: { 'fill-color': '#2d9e4f', 'fill-opacity': 0.5 } }, labelLayerId);
    map.addLayer({ id: 'p5-water', source: 'composite', 'source-layer': 'water', type: 'fill',
      paint: { 'fill-color': '#7dd3f0', 'fill-opacity': 0.8 } }, labelLayerId);
    map.addLayer({ id: 'p5-waterway', source: 'composite', 'source-layer': 'waterway', type: 'line',
      paint: { 'line-color': '#7dd3f0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4], 'line-opacity': 0.8 } }, labelLayerId);

    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.08 });
    }
    catch { /* terrain unsupported or duplicate */ }

    try {
      if (!map.getLayer('p5-sky')) {
        map.addLayer({
          id: 'p5-sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun-intensity-factor': 0.15,
          },
        });
      }
    }
    catch { /* sky unsupported */ }
  }, []);

  const handleInteractionStateChange = useCallback(({ interactionState }) => {
    const st = interactionState || {};
    if (cameraFollow && (
      st.isDragging || st.isMoving || st.isZooming || st.isOrbiting ||
      st.isPanning || st.inTransition
    )) {
      setCameraFollow(false);
    }
  }, [cameraFollow, setCameraFollow]);

  const layers = [];

  // ── H3 backdrop (low-density population hint) ──
  if (Array.isArray(h3Cells) && h3Cells.length > 0) {
    layers.push(new H3HexagonLayer({
      id: 'p5-h3-backdrop',
      data: h3Cells,
      getHexagon: d => d.h3,
      getFillColor: d => {
        const v = typeof d.weight === 'number' ? Math.min(Math.max(d.weight, 0), 1) : d.v ?? 0.55;
        const baseA = comparisonRoute ? 28 : 22;
        return [40 + v * 80, 30 + v * 50, 120 + v * 60, Math.floor(baseA + v * (comparisonRoute ? 35 : 60))];
      },
      extruded: false,
      stroked: true,
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      getLineColor: [120, 180, 255, 55],
      pickable: false,
      updateTriggers: { getFillColor: [comparisonRoute] },
    }));
  }

  // ── Background OD arcs: stagger + source/target gradient ──
  if (!comparisonRoute && routes?.length) {
    layers.push(new ArcLayer({
      id: 'routes-arc',
      data: routes,
      updateTriggers: { getSourceColor: animT, getTargetColor: animT },
      getSourcePosition: d => [...d.origin, 0],
      getTargetPosition: d => [...d.destination, 0],
      getSourceColor: d => {
        const w = Math.sin((animT * 0.55 + d.id * 0.71) % (Math.PI * 2)) * 0.35 + 0.65;
        return [245, Math.floor(68 + (1 - w) * 40), Math.floor(90 + (1 - w) * 30), Math.floor(55 + w * 195)];
      },
      getTargetColor: d => {
        const w = Math.cos((animT * 0.48 + (d.id * 83) % 20 * 0.13) % (Math.PI * 2)) * 0.35 + 0.65;
        return [255, Math.floor(180 + (1 - w) * 50), Math.floor(20 + (1 - w) * 50), Math.floor(40 + w * 200)];
      },
      getWidth: 1.85,
      getHeight: 0.32,
      widthUnits: 'pixels',
      pickable: false,
    }));
    layers.push(new ScenegraphLayer({
      id: 'origins',
      scenegraph: GLTF_DRONE_AND_COURIER,
      data: routes,
      getPosition: d => [...d.origin, 18 + 25 * Math.sin(animT * 2.2 + d.id * 0.45)],
      getOrientation: d => [0, (animT * 90 + d.id * 37) % 360 + MODEL_YAW_OFFSET, 0],
      getColor: [255, 90, 90, 255],
      sizeScale: 38,
      pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
    layers.push(new ScenegraphLayer({
      id: 'destinations',
      scenegraph: GLTF_DRONE_AND_COURIER,
      data: routes,
      getPosition: d => [...d.destination, 18 + 25 * Math.sin(animT * 2.2 + d.id * 0.45 + Math.PI)],
      getOrientation: d => [0, (animT * 90 + d.id * 37 + 180) % 360 + MODEL_YAW_OFFSET, 0],
      getColor: [255, 220, 0, 255],
      sizeScale: 38,
      pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));
  }

  // ── Comparison routes ──
  if (comparisonRoute && leg1Path && arcPath && leg2Path && groundPath && scenario
      && leg1Timestamps && arcTimestamps && leg2Timestamps && groundTimestamps) {
    const {
      drone, ground,
    } = comparisonRoute;
    const { origin, destination, hub1, hub2 } = comparisonRoute;
    const s = scenario;

    const trailLeg1 = Math.max(drone.leg1.duration * 0.65, 12);
    const trailArc = Math.max(drone.arcSec * 0.55, 10);
    const trailLeg2 = Math.max(drone.leg2.duration * 0.65, 12);
    const trailGr = Math.max(ground.duration * 0.5, 15);

    layers.push(new TripsLayer({
      id: 'cmp-leg1',
      data: [{ path: leg1Path, timestamps: leg1Timestamps }],
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      currentTime: s.leg1Cur,
      trailLength: trailLeg1,
      fadeTrail: true,
      getColor: [255, 118, 50, 220],
      getWidth: 4,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: false,
      updateTriggers: { currentTime: animT },
    }));
    layers.push(new TripsLayer({
      id: 'cmp-arc',
      data: [{ path: arcPath, timestamps: arcTimestamps }],
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      currentTime: s.arcCur,
      trailLength: trailArc,
      fadeTrail: true,
      getColor: [255, 230, 80, 245],
      getWidth: 5,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: false,
      updateTriggers: { currentTime: animT },
    }));
    layers.push(new TripsLayer({
      id: 'cmp-leg2',
      data: [{ path: leg2Path, timestamps: leg2Timestamps }],
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      currentTime: s.leg2Cur,
      trailLength: trailLeg2,
      fadeTrail: true,
      getColor: [255, 118, 50, 220],
      getWidth: 4,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: false,
      updateTriggers: { currentTime: animT },
    }));
    layers.push(new TripsLayer({
      id: 'cmp-ground',
      data: [{ path: groundPath, timestamps: groundTimestamps }],
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      currentTime: s.groundCur,
      trailLength: trailGr,
      fadeTrail: true,
      getColor: [70, 255, 170, 200],
      getWidth: 4,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: false,
      updateTriggers: { currentTime: animT },
    }));

    const groundTFrac = (s.scaledT % ground.duration) / ground.duration;

    if (s.person1Pos) {
      const ly = pathYaw(leg1Path, s.loopT / s.leg1Dur);
      layers.push(new ScenegraphLayer({
        id: 'cmp-person1',
        scenegraph: GLTF_DRONE_AND_COURIER,
        data: [{ pos: [s.person1Pos[0], s.person1Pos[1], 0] }],
        getPosition: d => d.pos,
        getOrientation: [0, ly + MODEL_YAW_OFFSET, 0],
        getColor: [255, 140, 70, 255],
        sizeScale: 42,
        pickable: false,
        updateTriggers: { getPosition: animT, getOrientation: animT },
      }));
    }
    if (s.dronePos) {
      const arcTFrac = (s.loopT - s.leg1Dur) / s.arcSec;
      const ky = pathYaw(arcPath, arcTFrac);
      layers.push(new ScenegraphLayer({
        id: 'cmp-drone',
        scenegraph: GLTF_DRONE_AND_COURIER,
        data: [{ pos: s.dronePos }],
        getPosition: d => d.pos,
        getOrientation: [0, ky + MODEL_YAW_OFFSET, 0],
        getColor: [255, 228, 60, 255],
        sizeScale: 52,
        pickable: false,
        updateTriggers: { getPosition: animT, getOrientation: animT },
      }));
      layers.push(new ScatterplotLayer({
        id: 'cmp-drone-spot',
        data: [{ position: [s.dronePos[0], s.dronePos[1], 0] }],
        getPosition: d => d.position,
        getFillColor: [255, 230, 120, Math.floor(40 + Math.min((s.droneAlt / 140), 1) * 65)],
        getRadius: Math.max(s.spotlightRadius, 42),
        radiusUnits: 'meters',
        stroked: true,
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        getLineColor: [255, 255, 255, Math.floor(50 + Math.min((s.droneAlt / 120), 1) * 70)],
        pickable: false,
        updateTriggers: { getFillColor: animT, getRadius: animT },
      }));
    }
    if (s.person2Pos) {
      const t2 = (s.loopT - s.leg1Dur - drone.arcSec) / s.leg2Dur;
      const ry = pathYaw(leg2Path, t2);
      layers.push(new ScenegraphLayer({
        id: 'cmp-person2',
        scenegraph: GLTF_DRONE_AND_COURIER,
        data: [{ pos: [s.person2Pos[0], s.person2Pos[1], 0] }],
        getPosition: d => d.pos,
        getOrientation: [0, ry + MODEL_YAW_OFFSET, 0],
        getColor: [255, 140, 70, 255],
        sizeScale: 42,
        pickable: false,
        updateTriggers: { getPosition: animT, getOrientation: animT },
      }));
    }

    layers.push(new ScenegraphLayer({
      id: 'cmp-ground-person',
      scenegraph: GLTF_CYCLIST,
      data: [{ pos: [s.groundPos[0], s.groundPos[1], 0] }],
      getPosition: d => d.pos,
      getOrientation: [0, pathYaw(groundPath, groundTFrac) + MODEL_YAW_OFFSET, 0],
      getColor: [80, 255, 160, 255],
      sizeScale: 58,
      pickable: false,
      updateTriggers: { getPosition: animT, getOrientation: animT },
    }));

    const sparkData = [
      ...buildSparkBurst(hub1[0], hub1[1], s.sparkPhase, 0),
      ...buildSparkBurst(hub2[0], hub2[1], s.sparkPhase + 1.1, 1),
    ];
    layers.push(new ScatterplotLayer({
      id: 'cmp-hub-sparks',
      data: sparkData,
      pickable: false,
      stroked: false,
      radiusUnits: 'meters',
      getPosition: d => d.position,
      getFillColor: d => d.fill,
      getRadius: d => d.r,
      updateTriggers: { getFillColor: animT },
    }));

    layers.push(new TextLayer({
      id: 'cmp-labels',
      data: [
        { pos: [...origin, 30], text: 'Origin', color: [255, 120, 120, 255] },
        { pos: [...destination, 30], text: 'Destination', color: [80, 220, 160, 255] },
      ],
      getPosition: d => d.pos,
      getText: d => d.text,
      getColor: d => d.color,
      getSize: 14,
      fontWeight: 'bold',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      background: true,
      getBackgroundColor: [10, 12, 30, 190],
      backgroundPadding: [5, 3, 5, 3],
      pickable: false,
    }));

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

    layers.push(...hubPulseScatter({ idPrefix: 'h1', lng: hub1[0], lat: hub1[1], color: [60, 210, 255], animT }));
    layers.push(...hubPulseScatter({ idPrefix: 'h2', lng: hub2[0], lat: hub2[1], color: [190, 90, 255], animT }));
  }

  if (buildingData) {
    const normalFeatures = { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) <= 110) };
    const tallFeatures = { ...buildingData, features: buildingData.features.filter(f => (f.properties?.height ?? 0) > 110) };

    layers.push(new GeoJsonLayer({
      id: 'buildings-normal', data: normalFeatures,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 255, 255, 210],
      material: { ambient: 0.4, diffuse: 0.6, shininess: 40 }, pickable: false,
    }));
    layers.push(new GeoJsonLayer({
      id: 'buildings-tall', data: tallFeatures,
      extruded: true, wireframe: false,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [255, 130, 40, 230],
      material: { ambient: 0.5, diffuse: 0.7, shininess: 60 }, pickable: false,
    }));
    layers.push(new GeoJsonLayer({
      id: 'buildings-tall-wireframe',
      data: tallFeatures,
      extruded: true,
      wireframe: true,
      filled: true,
      stroked: true,
      getElevation: f => f.properties.height ?? 0,
      getFillColor: [0, 0, 0, 0],
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      getLineColor: [255, 110, 30, 200],
      material: false,
      pickable: false,
    }));
  }

  const handleClick = info => {
    if (pickMode && info.coordinate) {
      onMapClick([info.coordinate[0], info.coordinate[1]]);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, cursor: pickMode ? 'crosshair' : 'grab' }}>
      <DeckGL viewState={mergedViewState}
        onInteractionStateChange={handleInteractionStateChange}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller
        layers={layers}
        effects={[lightingEffect]}
        style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
        getCursor={() => pickMode ? 'crosshair' : 'grab'}>
        <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAP_STYLE} onLoad={onMapLoad} />
      </DeckGL>
      <MapControls
        viewState={viewState}
        onResetView={resetViewCentered}
        onResetBearing={resetBearingOnly}
        cameraFollow={cameraFollow}
        onToggleCameraFollow={() => setCameraFollow(v => !v)}
      />
    </div>
  );
}

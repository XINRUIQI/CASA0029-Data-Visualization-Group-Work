import { useState, useMemo, useRef, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { cellToLatLng } from 'h3-js';
import { MAPBOX_TOKEN, SHENZHEN_CENTER } from '../../config';
import MapControls from '../../components/MapControls';
import 'mapbox-gl/dist/mapbox-gl.css';

const BARRIER_COLORS = {
  water: [70, 130, 220, 140],
  waterway: [100, 160, 240, 100],
  railway: [160, 160, 160, 180],
  highway_major: [220, 60, 60, 140],
};

const VIEW = {
  longitude: 114.18,
  latitude: 22.63,
  zoom: 9.5,
  pitch: 0,
  bearing: 0,
};


function rampLerp(ramp, v01) {
  const t = Math.max(0, Math.min(1, v01));
  const n = ramp.length - 1;
  const idx = t * n;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, n);
  const f = idx - lo;
  const c0 = ramp[lo];
  const c1 = ramp[hi];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

const DEMAND_RAMP = [
  [220, 245, 242],
  [190, 236, 230],
  [160, 226, 218],
  [129, 216, 208],
  [100, 200, 192],
  [72, 178, 170],
  [48, 152, 144],
  [28, 122, 116],
  [10, 88, 84],
];

const SUPPLY_RAMP = [
  [216, 232, 242],
  [184, 214, 230],
  [148, 194, 216],
  [116, 170, 198],
  [90, 137, 166],
  [66, 112, 148],
  [44, 88, 126],
  [26, 62, 100],
  [10, 38, 72],
];

const FRICTION_RAMP = [
  [255, 240, 220],
  [255, 218, 180],
  [255, 190, 140],
  [255, 160, 100],
  [255, 130, 60],
  [240, 100, 30],
  [215, 72, 10],
  [180, 45, 0],
  [140, 20, 0],
];

const COMPOSITE_RAMP = [
  [232, 218, 242],
  [214, 190, 232],
  [196, 162, 220],
  [176, 132, 206],
  [156, 104, 192],
  [136, 78, 176],
  [114, 54, 156],
  [90, 34, 132],
  [64, 16, 104],
];

function hexColor(mode, d, highlight, tw, frBounds, dpBounds, tdiBounds, compBounds) {
  if (!d) return [80, 80, 80, 40];

  if (highlight) {
    const match = highlight(d);
    if (match === false) return [40, 40, 50, 15];
    if (match === true) return [0, 255, 200, 220];
  }

  const dp = d.dp || 0;
  const fr = d.avg_friction || 0;
  const tdi = d.takeout_demand_index || 0;
  if ((mode === 'friction' || mode === 'priority') && !(fr > 0)) {
    return [0, 0, 0, 0];
  }
  if (mode === 'demand') {
    if (tdi <= 0) return [0, 0, 0, 0];
    const lo = tdiBounds?.[0] ?? 0;
    const hi = tdiBounds?.[1] ?? 1;
    const raw = hi > lo ? (tdi * tw - lo) / (hi - lo) : 0.5;
    const v = Math.max(0, Math.min(1, raw));
    const rgb = rampLerp(DEMAND_RAMP, v);
    return [...rgb, Math.round(90 + 165 * v)];
  }
  if (mode === 'supply') {
    if (dp <= 0) return [0, 0, 0, 0];
    const lo = dpBounds?.[0] ?? 0;
    const hi = dpBounds?.[1] ?? 200;
    const v = Math.max(0, Math.min(1, (dp - lo) / (hi - lo)));
    const rgb = rampLerp(SUPPLY_RAMP, v);
    return [...rgb, Math.round(90 + 165 * v)];
  }
  if (mode === 'friction') {
    const lo = frBounds?.[0] ?? 0;
    const hi = frBounds?.[1] ?? 1;
    const v = hi > lo ? Math.max(0, Math.min(1, (fr - lo) / (hi - lo))) : 0.5;
    const rgb = rampLerp(FRICTION_RAMP, v);
    return [...rgb, Math.round(100 + 140 * v)];
  }
  if (mode === 'priority') {
    const gi = d.gap_index || 0;
    if (gi <= 0) return [0, 0, 0, 0];
    const lo = compBounds?.[0] ?? 0;
    const hi = compBounds?.[1] ?? 1;
    const v = hi > lo ? Math.max(0, Math.min(1, (gi - lo) / (hi - lo))) : 0.5;
    const rgb = rampLerp(COMPOSITE_RAMP, v);
    return [...rgb, Math.round(90 + 165 * v)];
  }
  return [80, 80, 80, 40];
}

function mmNorm(v, lo, hi) {
  if (hi <= lo) return 0;
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
}

export default function Page2FrictionMap({
  barriers, activeBarriers, showBarriers, activeMode,
  h3Demand, h3Gap, h3Takeout, onHoverHex, highlightFilter,
  timeWeight = 1, odAnalysis, showOdArcs, hoveredHexData,
  selectedDemandH3 = null, onDemandHexClick,
}) {
  const [viewState, setViewState] = useState(VIEW);
  const onHoverHexRef = useRef(onHoverHex);
  onHoverHexRef.current = onHoverHex;
  const onDemandHexClickRef = useRef(onDemandHexClick);
  onDemandHexClickRef.current = onDemandHexClick;
  const hoveredHexRef = useRef(hoveredHexData);
  hoveredHexRef.current = hoveredHexData;
  const selectedDemandH3Ref = useRef(selectedDemandH3);
  selectedDemandH3Ref.current = selectedDemandH3;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;

  const lastHoverH3Ref = useRef(null);
  const hoverThrottleRef = useRef(0);
  const throttledHover = useCallback((info) => {
    const h3 = info.object?.h3 ?? null;
    if (h3 === lastHoverH3Ref.current) return;
    lastHoverH3Ref.current = h3;
    const now = performance.now();
    if (now - hoverThrottleRef.current < 32) return;
    hoverThrottleRef.current = now;
    const cb = onHoverHexRef.current;
    if (info.object) {
      cb?.({ ...info.object, _x: info.x, _y: info.y });
    } else {
      cb?.(null);
    }
  }, []);

  const popResBounds = useMemo(() => {
    const rows = h3Takeout || [];
    if (!rows.length) return { minP: 0, maxP: 1, minR: 0, maxR: 1 };
    const pops = rows.map(t => t.pop_count ?? 0);
    const ress = rows.map(t => t.residential_count ?? 0);
    return {
      minP: Math.min(...pops),
      maxP: Math.max(...pops),
      minR: Math.min(...ress),
      maxR: Math.max(...ress),
    };
  }, [h3Takeout]);

  const mergedHex = useMemo(() => {
    if (!h3Demand) return null;
    const gapMap = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    const takeoutMap = new window.Map((h3Takeout || []).map(t => [t.h3, t]));
    const { minP, maxP, minR, maxR } = popResBounds;
    return h3Demand.map(d => {
      const gap = gapMap.get(d.h3);
      const tk = takeoutMap.get(d.h3);
      const pc = tk?.pop_count ?? gap?.pop_count ?? 0;
      const rc = tk?.residential_count ?? 0;
      return {
        ...d,
        avg_friction: gap?.avg_friction || 0,
        avg_detour: gap?.avg_detour || 0,
        avg_congestion: gap?.avg_congestion || 0,
        demand_pressure: gap?.demand_pressure || d.dp || 0,
        gap_index: gap?.gap_index || 0,
        food_count: d.food || gap?.food_count || 0,
        retail_count: d.retail || gap?.retail_count || 0,
        edu_count: d.edu || gap?.education_count || 0,
        med_count: d.med || gap?.medical_count || 0,
        scenic_count: d.scenic || gap?.scenic_count || 0,
        leisure_count: d.leisure || gap?.leisure_count || 0,
        pop_count: pc,
        pop_n: mmNorm(pc, minP, maxP),
        res_n: mmNorm(rc, minR, maxR),
        real_order_count: tk?.real_order_count || 0,
        real_order_density: tk?.real_order_density || 0,
        takeout_demand_index: tk?.takeout_demand_index || 0,
        takeout_demand_norm: tk?.takeout_demand_norm || 0,
        food_access_1km: tk?.food_access_1km || 0,
        food_access_2km: tk?.food_access_2km || 0,
        food_access_3km: tk?.food_access_3km || 0,
        xiaoqu_count: tk?.xiaoqu_count || 0,
        relief_vulnerability: gap?.relief_vulnerability || 0,
        intensity_index: gap?.intensity_index || 0,
      };
    });
  }, [h3Demand, h3Gap, h3Takeout, popResBounds]);

  const frBounds = useMemo(() => {
    if (!mergedHex) return null;
    const vals = mergedHex.map(d => d.avg_friction).filter(v => v > 0).sort((a, b) => a - b);
    if (vals.length < 10) return null;
    const p5 = vals[Math.floor(vals.length * 0.05)];
    const p95 = vals[Math.floor(vals.length * 0.95)];
    return [p5, p95];
  }, [mergedHex]);

  const dpBounds = useMemo(() => {
    if (!mergedHex) return null;
    const vals = mergedHex.map(d => d.dp || 0).filter(v => v > 0).sort((a, b) => a - b);
    if (vals.length < 10) return null;
    const p5 = vals[Math.floor(vals.length * 0.05)];
    const p95 = vals[Math.floor(vals.length * 0.95)];
    return [p5, p95];
  }, [mergedHex]);

  const tdiBounds = useMemo(() => {
    if (!mergedHex) return null;
    const vals = mergedHex.map(d => d.takeout_demand_index || 0).filter(v => v > 0).sort((a, b) => a - b);
    if (vals.length < 10) return null;
    return [vals[Math.floor(vals.length * 0.05)], vals[Math.floor(vals.length * 0.95)]];
  }, [mergedHex]);

  const compBounds = useMemo(() => {
    if (!mergedHex) return null;
    const vals = mergedHex
      .map(d => d.gap_index || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);
    if (vals.length < 10) return null;
    return [vals[Math.floor(vals.length * 0.05)], vals[Math.floor(vals.length * 0.95)]];
  }, [mergedHex]);

  const colorCache = useMemo(() => {
    if (!mergedHex) return null;
    const cache = new window.Map();
    for (const d of mergedHex) {
      cache.set(d.h3, hexColor(activeMode, d, highlightFilter, timeWeight, frBounds, dpBounds, tdiBounds, compBounds));
    }
    return cache;
  }, [mergedHex, activeMode, highlightFilter, timeWeight, frBounds, dpBounds, tdiBounds, compBounds]);

  const layers = useMemo(() => {
    const result = [];

    if (mergedHex && colorCache) {
      result.push(
        new H3HexagonLayer({
          id: 'analysis-hex',
          data: mergedHex,
          getHexagon: d => d.h3,
          getFillColor: d => colorCache.get(d.h3) || [0, 0, 0, 0],
          getElevation: 0,
          extruded: false,
          pickable: true,
          stroked: false,
          updateTriggers: {
            getFillColor: [colorCache],
          },
          onHover: throttledHover,
          onClick: info => {
            if (!info.object?.h3) return;
            const sel = selectedDemandH3Ref.current;
            const next = info.object.h3 === sel ? null : info.object.h3;
            onDemandHexClickRef.current?.(next);
          },
        })
      );
    }

    if (showOdArcs && odAnalysis?.length) {
      result.push(
        new ArcLayer({
          id: 'od-arcs',
          data: odAnalysis,
          getSourcePosition: d => [d.o_lon, d.o_lat],
          getTargetPosition: d => [d.d_lon, d.d_lat],
          getSourceColor: d => {
            const f = Math.min((d.ground_friction ?? 0) / 0.35, 1);
            return [Math.round(40 * (1 - f)), Math.round(180 + 60 * (1 - f)), Math.round(80 + 80 * (1 - f)), 100 + Math.round(100 * f)];
          },
          getTargetColor: d => {
            const f = Math.min((d.ground_friction ?? 0) / 0.35, 1);
            return [Math.round(40 * (1 - f)), Math.round(180 + 60 * (1 - f)), Math.round(80 + 80 * (1 - f)), 60 + Math.round(80 * f)];
          },
          getWidth: 1.2,
          getHeight: 0.15,
          greatCircle: false,
          pickable: true,
          onHover: () => {},
        })
      );
    }

    if (showBarriers && barriers) {
      Object.entries(barriers)
        .filter(([type]) => activeBarriers.has(type))
        .forEach(([type, data]) => {
          result.push(
            new GeoJsonLayer({
              id: `barrier-${type}`,
              data,
              getFillColor: BARRIER_COLORS[type] || [128, 128, 128, 100],
              getLineColor: BARRIER_COLORS[type] || [128, 128, 128, 160],
              getLineWidth: type === 'railway' ? 3 : 2,
              lineWidthMinPixels: 1,
              opacity: 0.8,
              pickable: false,
            })
          );
        });
    }

    return result;
  }, [
    barriers, activeBarriers, showBarriers, activeMode, mergedHex, colorCache,
    odAnalysis, showOdArcs,
  ]);

  const highlightH3 = selectedDemandH3 || hoveredHexData?.h3 || null;
  const highlightLayer = useMemo(() => {
    if (!highlightH3) return null;
    return new H3HexagonLayer({
      id: 'hex-highlight',
      data: [{ h3: highlightH3 }],
      getHexagon: d => d.h3,
      getFillColor: [0, 0, 0, 0],
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: 3,
      getLineColor: [255, 220, 0, 255],
      pickable: false,
    });
  }, [highlightH3]);

  const supplyBuffers = useMemo(() => {
    if (activeMode !== 'supply' || !hoveredHexData?.h3) return null;
    try {
      const [lat, lng] = cellToLatLng(hoveredHexData.h3);
      const center = [lng, lat];
      const a1 = hoveredHexData.food_access_1km || 0;
      const a2 = hoveredHexData.food_access_2km || 0;
      const a3 = hoveredHexData.food_access_3km || 0;
      const aMax = Math.max(a1, a2, a3, 1);
      return [
        { id: 'buf-3km', radius: 3000, access: a3, color: [255, 140, 0] },
        { id: 'buf-2km', radius: 2000, access: a2, color: [255, 100, 0] },
        { id: 'buf-1km', radius: 1000, access: a1, color: [255, 69, 0] },
      ].map(ring => {
        const intensity = ring.access / aMax;
        return new ScatterplotLayer({
          id: `${ring.id}-fill`,
          data: [{ pos: center }],
          getPosition: d => d.pos,
          getRadius: ring.radius,
          radiusUnits: 'meters',
          getFillColor: [...ring.color, Math.round(15 + 70 * intensity)],
          getLineColor: [...ring.color, Math.round(80 + 150 * intensity)],
          stroked: true, lineWidthMinPixels: 1.5, getLineWidth: 2, pickable: false,
        });
      }).concat(new ScatterplotLayer({
        id: 'buf-center',
        data: [{ pos: center }],
        getPosition: d => d.pos,
        getRadius: 80, radiusUnits: 'meters',
        getFillColor: [255, 255, 255, 220],
        getLineColor: [255, 69, 0, 200],
        stroked: true, lineWidthMinPixels: 2, getLineWidth: 3, pickable: false,
      }));
    } catch (_) { return null; }
  }, [activeMode, hoveredHexData]);

  const allLayers = useMemo(() => {
    const result = [...layers];
    if (highlightLayer) result.push(highlightLayer);
    if (supplyBuffers) result.push(...supplyBuffers);
    return result;
  }, [layers, highlightLayer, supplyBuffers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={allLayers}
        style={{ width: '100%', height: '100%' }}
        useDevicePixels={false}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          reuseMaps
        />
      </DeckGL>
      <MapControls
        viewState={viewState}
        onResetView={() => setViewState(VIEW)}
        onResetBearing={() => setViewState(v => ({ ...v, bearing: 0, pitch: 0 }))}
      />
    </div>
  );
}

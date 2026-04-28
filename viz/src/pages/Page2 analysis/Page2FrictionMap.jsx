import { useState, useMemo } from 'react';
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


function hexColor(mode, d, highlight, tw) {
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
  if (mode === 'supply') {
    const v = Math.min(dp / 200, 1);
    return [255, Math.round(160 * (1 - v)), 0, Math.round(10 + 220 * v)];
  }
  if (mode === 'demand') {
    const v = Math.min(tdi, 1) * tw;
    return [255, Math.round(100 * (1 - v)), Math.round(50 * (1 - v)), Math.round(15 + 220 * v)];
  }
  if (mode === 'friction') {
    const t = Math.min(Math.max(fr, 0), 1);
    // Stronger stretch: slight gain + lower gamma so mid/low values spread across more of the ramp
    const v = Math.pow(Math.min(1, t * 1.18), 0.38);
    return [
      255,
      Math.round(235 * (1 - v)),
      Math.round(175 * (1 - v)),
      Math.round(28 + 227 * v),
    ];
  }
  if (mode === 'priority') {
    const dv = Math.min(tdi, 1) * tw;
    const fv = Math.min(fr, 1);
    const raw = Math.min(1, dv * fv);
    const v = Math.pow(Math.min(1, raw * 1.28), 0.34);
    return [
      Math.round(118 + 137 * v),
      Math.round(238 * (1 - v)),
      Math.round(168 + 87 * v),
      Math.round(26 + 229 * v),
    ];
  }
  return [80, 80, 80, 40];
}

export default function Page2FrictionMap({
  barriers, activeBarriers, showBarriers, activeMode,
  h3Demand, h3Gap, h3Takeout, onHoverHex, highlightFilter,
  timeWeight = 1, odAnalysis, showOdArcs, hoveredHexData,
}) {
  const [viewState, setViewState] = useState(VIEW);

  const mergedHex = useMemo(() => {
    if (!h3Demand) return null;
    const gapMap = new window.Map((h3Gap || []).map(g => [g.h3, g]));
    const takeoutMap = new window.Map((h3Takeout || []).map(t => [t.h3, t]));
    return h3Demand.map(d => {
      const gap = gapMap.get(d.h3);
      const tk = takeoutMap.get(d.h3);
      return {
        ...d,
        avg_friction: gap?.avg_friction || 0,
        gap_index: gap?.gap_index || 0,
        food_count: d.food || gap?.food_count || 0,
        retail_count: d.retail || gap?.retail_count || 0,
        edu_count: d.edu || gap?.education_count || 0,
        med_count: d.med || gap?.medical_count || 0,
        scenic_count: d.scenic || gap?.scenic_count || 0,
        leisure_count: d.leisure || gap?.leisure_count || 0,
        pop_count: tk?.pop_count || gap?.pop_count || 0,
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
  }, [h3Demand, h3Gap, h3Takeout]);

  const layers = useMemo(() => {
    const result = [];

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
              opacity: 0.6,
              pickable: false,
            })
          );
        });
    }

    if (mergedHex) {
      result.push(
        new H3HexagonLayer({
          id: 'analysis-hex',
          data: mergedHex,
          getHexagon: d => d.h3,
          getFillColor: d => hexColor(activeMode, d, highlightFilter, timeWeight),
          getElevation: 0,
          extruded: false,
          pickable: true,
          stroked: false,
          updateTriggers: { getFillColor: [activeMode, highlightFilter, timeWeight] },
          onHover: info => {
            if (info.object) {
              onHoverHex?.(info.object);
            } else {
              onHoverHex?.(null);
            }
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
            return [Math.round(60 + 195 * f), Math.round(200 * (1 - f)), Math.round(255 * (1 - f)), 100 + Math.round(100 * f)];
          },
          getTargetColor: d => {
            const f = Math.min((d.ground_friction ?? 0) / 0.35, 1);
            return [Math.round(60 + 195 * f), Math.round(200 * (1 - f)), Math.round(255 * (1 - f)), 60 + Math.round(80 * f)];
          },
          getWidth: 1.2,
          getHeight: 0.15,
          greatCircle: false,
          pickable: true,
          onHover: () => {},
        })
      );
    }

    if (activeMode === 'supply' && hoveredHexData?.h3) {
      try {
        const [lat, lng] = cellToLatLng(hoveredHexData.h3);
        const center = [lng, lat];
        const a1 = hoveredHexData.food_access_1km || 0;
        const a2 = hoveredHexData.food_access_2km || 0;
        const a3 = hoveredHexData.food_access_3km || 0;
        const aMax = Math.max(a1, a2, a3, 1);

        const rings = [
          { id: 'buf-3km', radius: 3000, access: a3, color: [255, 140, 0] },
          { id: 'buf-2km', radius: 2000, access: a2, color: [255, 100, 0] },
          { id: 'buf-1km', radius: 1000, access: a1, color: [255, 69, 0] },
        ];

        rings.forEach(ring => {
          const intensity = ring.access / aMax;
          result.push(
            new ScatterplotLayer({
              id: `${ring.id}-fill`,
              data: [{ pos: center }],
              getPosition: d => d.pos,
              getRadius: ring.radius,
              radiusUnits: 'meters',
              getFillColor: [...ring.color, Math.round(15 + 70 * intensity)],
              getLineColor: [...ring.color, Math.round(80 + 150 * intensity)],
              stroked: true,
              lineWidthMinPixels: 1.5,
              getLineWidth: 2,
              pickable: false,
            })
          );
        });

        result.push(
          new ScatterplotLayer({
            id: 'buf-center',
            data: [{ pos: center }],
            getPosition: d => d.pos,
            getRadius: 80,
            radiusUnits: 'meters',
            getFillColor: [255, 255, 255, 220],
            getLineColor: [255, 69, 0, 200],
            stroked: true,
            lineWidthMinPixels: 2,
            getLineWidth: 3,
            pickable: false,
          })
        );
      } catch (_) { /* invalid h3 index */ }
    }

    return result;
  }, [barriers, activeBarriers, showBarriers, activeMode, mergedHex, onHoverHex, highlightFilter, timeWeight, odAnalysis, showOdArcs, hoveredHexData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layers}
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

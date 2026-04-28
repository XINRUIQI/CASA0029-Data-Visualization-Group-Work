/** Shared animation state for routes & camera follow */

const ANIM_SPEED = 20;

export function interpPath(coords, t) {
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

export function pathYaw(coords, t) {
  const p0 = interpPath(coords, Math.max(0, t - 0.01));
  const p1 = interpPath(coords, Math.min(1, t + 0.01));
  return Math.atan2((p1[0]-p0[0])*102500, (p1[1]-p0[1])*111000) * 180 / Math.PI;
}

/**
 * @param {boolean} opts.hasPaths Precomputed geo paths (with Z)
 */
export function computeRouteScenario(comparisonRoute, animT, paths) {
  if (!comparisonRoute || !paths) return null;

  const { drone, ground, leg1Path, arcPath, leg2Path, groundPath } = paths;

  const scaledT = animT * ANIM_SPEED;
  const groundFrac = (scaledT % ground.duration) / ground.duration;
  const groundPos = interpPath(groundPath, groundFrac);

  const droneTotal = drone.totalDuration;
  const loopT = scaledT % droneTotal;
  const leg1Dur = drone.leg1.duration;
  const leg2Dur = drone.leg2.duration;

  let person1Pos = null, dronePos = null, person2Pos = null;

  if (loopT < leg1Dur) {
    person1Pos = interpPath(leg1Path, loopT / leg1Dur);
  } else if (loopT < leg1Dur + drone.arcSec) {
    dronePos = interpPath(arcPath, (loopT - leg1Dur) / drone.arcSec);
  } else {
    person2Pos = interpPath(leg2Path, (loopT - leg1Dur - drone.arcSec) / leg2Dur);
  }

  const leg1Cur = Math.min(Math.max(loopT, 0), leg1Dur);
  const arcSec = drone.arcSec;
  const arcCur = loopT < leg1Dur ? 0 : Math.min(loopT - leg1Dur, arcSec);
  const leg2Cur = loopT <= leg1Dur + arcSec ? 0 : Math.min(loopT - leg1Dur - arcSec, leg2Dur);
  const groundCur = scaledT % ground.duration;

  // Camera follow prioritises airborne drone → hub legs → cyclist
  let focusLngLat = null;
  let focusBearing = null;
  if (dronePos) {
    focusLngLat = [dronePos[0], dronePos[1]];
    const arcT = (loopT - leg1Dur) / arcSec;
    focusBearing = pathYaw(arcPath, arcT);
  } else if (person1Pos) {
    focusLngLat = [person1Pos[0], person1Pos[1]];
    focusBearing = pathYaw(leg1Path, loopT / leg1Dur);
  } else if (person2Pos) {
    const t2 = (loopT - leg1Dur - drone.arcSec) / leg2Dur;
    focusLngLat = [person2Pos[0], person2Pos[1]];
    focusBearing = pathYaw(leg2Path, t2);
  } else {
    focusLngLat = [groundPos[0], groundPos[1]];
    focusBearing = pathYaw(groundPath, groundFrac);
  }

  const droneAlt = dronePos ? Math.max(dronePos[2] ?? 0, 0) : 0;
  /** Ground spotlight radius in metres (~30–220) */
  const spotlightRadius = 28 + (droneAlt / 140) * 190;

  return {
    loopT,
    scaledT,
    groundFrac,
    groundPos,
    person1Pos,
    dronePos,
    person2Pos,
    leg1Cur,
    arcCur,
    leg2Cur,
    groundCur,
    leg1Dur,
    leg2Dur,
    arcSec,
    focusLngLat,
    focusBearing,
    spotlightRadius,
    droneAlt,
    sparkPhase: (animT * 3.1) % (Math.PI * 2),
  };
}

/** Drone waypoint / hub micro-particles (deck Scatterplot meters) */
export function buildSparkBurst(lng, lat, phaseRad, burstId, count = 18) {
  const rgb = burstId === 1 ? [120, 255, 220] : [255, 210, 100];
  const data = [];
  for (let k = 0; k < count; k++) {
    const seed = burstId * 997 + k * 13;
    const wrap = (((phaseRad + seed * 0.09) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const u = (wrap / (Math.PI * 2)) ** 2;
    const a = seed * 0.61803398875 + phaseRad + (k / count) * Math.PI * 2;
    const rKm = u * (0.055 + Math.sin(seed) * 0.018);
    const dLon = Math.cos(a) * rKm / (111 * Math.cos(lat * Math.PI / 180));
    const dLat = Math.sin(a) * rKm / 111;
    const bob = Math.sin(phaseRad * 5 + seed) * 4;
    const alpha = Math.max(38, Math.floor(u * (200 + k * 2)));
    data.push({
      position: [lng + dLon, lat + dLat, bob],
      r: Math.max(1.5, (1 - u) * 10 + Math.sin(seed) * 3),
      fill: [rgb[0], rgb[1], rgb[2], alpha],
    });
  }
  return data;
}

/**
 * Simple procedural meshes for Page5 visualization
 * All coordinates in local space (meters), Z = up
 */

// ── shared helpers ─────────────────────────────────────────────────────────
function _box(positions, normals, indices, x0, y0, z0, x1, y1, z1) {
  const faces = [
    { v: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], n: [0,0,1]  },
    { v: [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], n: [0,0,-1] },
    { v: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], n: [0,-1,0] },
    { v: [[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]], n: [0,1,0]  },
    { v: [[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]], n: [-1,0,0] },
    { v: [[x1,y1,z0],[x1,y0,z0],[x1,y0,z1],[x1,y1,z1]], n: [1,0,0]  },
  ];
  for (const { v, n } of faces) {
    const s = positions.length / 3;
    for (const p of v) { positions.push(...p); normals.push(...n); }
    indices.push(s, s+1, s+2, s, s+2, s+3);
  }
}

function _sphere(positions, normals, indices, cx, cy, cz, r, latS, lonS) {
  const base = positions.length / 3;
  for (let la = 0; la <= latS; la++) {
    const phi = (la / latS) * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let lo = 0; lo <= lonS; lo++) {
      const theta = (lo / lonS) * Math.PI * 2;
      const ct = Math.cos(theta), st = Math.sin(theta);
      positions.push(cx + r*sp*ct, cy + r*sp*st, cz + r*cp);
      normals.push(sp*ct, sp*st, cp);
    }
  }
  for (let la = 0; la < latS; la++) {
    for (let lo = 0; lo < lonS; lo++) {
      const a = base + la*(lonS+1) + lo;
      const b = a + lonS + 1;
      indices.push(a, b, a+1, b, b+1, a+1);
    }
  }
}

function _flatRing(positions, normals, indices, cx, cy, innerR, outerR, seg, z, nz) {
  const base = positions.length / 3;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    positions.push(cx + cos*outerR, cy + sin*outerR, z); normals.push(0,0,nz);
    positions.push(cx + cos*innerR, cy + sin*innerR, z); normals.push(0,0,nz);
  }
  for (let i = 0; i < seg; i++) {
    const b = base + i*2;
    if (nz > 0) indices.push(b, b+2, b+1, b+1, b+2, b+3);
    else        indices.push(b, b+1, b+2, b+1, b+3, b+2);
  }
}

function _ring(positions, normals, indices, cx, cy, cz, r, thickness, seg, axis) {
  const base = positions.length / 3;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    for (let s = 0; s <= 1; s++) {
      const ro = r + (s === 0 ? thickness : -thickness);
      let x, y, z;
      if (axis === 'x') { x = cx; y = cy + ro*cos; z = cz + ro*sin; }
      else              { x = cx + ro*cos; y = cy; z = cz + ro*sin; }
      positions.push(x, y, z);
      normals.push(axis === 'x' ? 1 : 0, axis === 'x' ? 0 : 1, 0);
    }
  }
  for (let i = 0; i < seg; i++) {
    const b = base + i*2;
    indices.push(b, b+2, b+1, b+1, b+2, b+3);
  }
}

function buildMesh(positions, normals, indices) {
  return {
    attributes: {
      POSITION: { value: new Float32Array(positions), size: 3 },
      NORMAL:   { value: new Float32Array(normals),   size: 3 },
    },
    indices: { value: new Uint32Array(indices), size: 1 },
  };
}

// ──────────────────────────────────────────────────────────────────────────
/** Quadcopter drone: X-frame body + rotor guard rings + propeller blades
 *  + camera gimbal below + landing skids
 *  The drone rotates via getOrientation in the map, making blades appear to spin.
 */
export function createDroneMesh() {
  const pos = [], nor = [], idx = [];
  const B = (x0,y0,z0,x1,y1,z1) => _box(pos,nor,idx,x0,y0,z0,x1,y1,z1);
  const FR = (cx,cy,ri,ro,seg,z,nz) => _flatRing(pos,nor,idx,cx,cy,ri,ro,seg,z,nz);

  const bodyH   = 0.14;
  const armLen  = 0.92;
  const tipDist = armLen * 0.707; // ≈ 0.65
  const rotorZ  = bodyH + 0.05;
  const armDirs = [[1,1],[-1,1],[1,-1],[-1,-1]];

  // Central body — slightly larger for visibility
  B(-0.24, -0.24, 0, 0.24, 0.24, bodyH * 1.6);

  // 4 diagonal arms
  for (const [dx, dy] of armDirs) {
    const ex = dx * tipDist, ey = dy * tipDist, aw = 0.09;
    B(Math.min(0,ex)-aw, Math.min(0,ey)-aw, 0,
      Math.max(0,ex)+aw, Math.max(0,ey)+aw, bodyH);
  }

  // Motor housings + rotor guard rings + propeller blades at each tip
  for (const [dx, dy] of armDirs) {
    const cx = dx * tipDist, cy = dy * tipDist;

    // Motor housing
    B(cx-0.11, cy-0.11, 0, cx+0.11, cy+0.11, bodyH + 0.10);

    // Rotor guard ring (top + bottom faces for thickness)
    FR(cx, cy, 0.08, 0.35, 20, rotorZ,        1);
    FR(cx, cy, 0.08, 0.35, 20, rotorZ - 0.03, -1);

    // Propeller blades: 2 blades (+ shape when viewed from above)
    // Since the drone yaws during animation, blades appear to spin
    const bL = 0.32, bW = 0.07, bT = 0.025;
    B(cx-bL, cy-bW/2, rotorZ, cx+bL, cy+bW/2, rotorZ+bT); // blade along X
    B(cx-bW/2, cy-bL, rotorZ, cx+bW/2, cy+bL, rotorZ+bT); // blade along Y
  }

  // Camera gimbal pod hanging below center body
  B(-0.09, -0.07, -0.20, 0.09, 0.07, 0);

  // Landing skids — two parallel runners
  B(-0.54, -0.05, -0.24, 0.54, -0.02, -0.18);
  B(-0.54,  0.02, -0.24, 0.54,  0.05, -0.18);

  // Skid support struts connecting body to skids
  B(-0.48, -0.05, -0.24, -0.42, 0.05, 0);
  B( 0.42, -0.05, -0.24,  0.48, 0.05, 0);

  return buildMesh(pos, nor, idx);
}

// ──────────────────────────────────────────────────────────────────────────
/** Delivery courier on foot: legs + torso + head + large insulated backpack box
 *  The backpack (外卖保温箱) is the key visual identifier — taller than the person.
 */
export function createPersonMesh() {
  const pos = [], nor = [], idx = [];
  const B = (x0,y0,z0,x1,y1,z1) => _box(pos,nor,idx,x0,y0,z0,x1,y1,z1);
  const S = (cx,cy,cz,r,la,lo)  => _sphere(pos,nor,idx,cx,cy,cz,r,la,lo);

  // Legs (two narrow boxes, separated to look like legs)
  B(-0.16, -0.11, 0,    -0.03, 0.11, 0.44); // left leg
  B( 0.03, -0.11, 0,     0.16, 0.11, 0.44); // right leg

  // Torso
  B(-0.21, -0.14, 0.44,  0.21, 0.14, 0.90);

  // Head
  S(0, 0, 1.06, 0.18, 8, 12);

  // ── Insulated delivery backpack box (外卖保温箱) ──
  // Mounted on the back (y > 0.14), extends well above head
  B(-0.22, 0.14, 0.38,  0.22, 0.50, 1.22);

  return buildMesh(pos, nor, idx);
}

// ──────────────────────────────────────────────────────────────────────────
/** Map-pin / teardrop shape — tip at z=0, ball on top */
export function createPinMesh() {
  const r       = 0.32;
  const coneH   = 0.5;
  const sphereZ = coneH + r * 0.15;
  const lonSegs = 14;
  const latSegs = 10;

  const positions = [];
  const normals   = [];
  const indices   = [];

  // cone: tip → base circle
  const tipIdx = 0;
  positions.push(0, 0, 0); normals.push(0, 0, -1);

  const coneBase = 1;
  for (let i = 0; i < lonSegs; i++) {
    const a = (i / lonSegs) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    positions.push(cos * r, sin * r, coneH);
    const len = Math.sqrt(1 + (r / coneH) ** 2);
    normals.push(cos / len, sin / len, (-r / coneH) / len);
  }
  for (let i = 0; i < lonSegs; i++) {
    indices.push(tipIdx, coneBase + i, coneBase + (i + 1) % lonSegs);
  }

  // sphere (UV sphere centered at sphereZ)
  const sphStart = positions.length / 3;
  for (let lat = 0; lat <= latSegs; lat++) {
    const phi    = (lat / latSegs) * Math.PI;
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
    for (let lon = 0; lon <= lonSegs; lon++) {
      const theta = (lon / lonSegs) * Math.PI * 2;
      const cosT  = Math.cos(theta), sinT = Math.sin(theta);
      positions.push(r * sinPhi * cosT, r * sinPhi * sinT, sphereZ + r * cosPhi);
      normals.push(sinPhi * cosT, sinPhi * sinT, cosPhi);
    }
  }
  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const a = sphStart + lat * (lonSegs + 1) + lon;
      const b = a + lonSegs + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    attributes: {
      POSITION: { value: new Float32Array(positions), size: 3 },
      NORMAL:   { value: new Float32Array(normals),   size: 3 },
    },
    indices: { value: new Uint32Array(indices), size: 1 },
  };
}

// ──────────────────────────────────────────────────────────────────────────
/** Delivery rider on a bike with insulated cargo box on rear rack */
export function createRiderMesh() {
  const pos = [], nor = [], idx = [];
  const B = (x0,y0,z0,x1,y1,z1) => _box(pos,nor,idx,x0,y0,z0,x1,y1,z1);
  const S = (cx,cy,cz,r,la,lo)  => _sphere(pos,nor,idx,cx,cy,cz,r,la,lo);
  const R = (cx,cy,cz,r,t,seg,ax) => _ring(pos,nor,idx,cx,cy,cz,r,t,seg,ax);

  const wheelR = 0.38, wheelT = 0.04, wheelSeg = 20;

  // Wheels: rear at y=-0.35, front at y=0.35
  R(0, -0.35, wheelR, wheelR, wheelT, wheelSeg, 'x');
  R(0,  0.35, wheelR, wheelR, wheelT, wheelSeg, 'x');

  // Bike frame
  B(-0.04, -0.10, wheelR*0.6,  0.04,  0.10, wheelR*1.1);   // seat tube
  B(-0.04, -0.35, wheelR*1.05, 0.04,  0.30, wheelR*1.15);  // top tube
  B(-0.04,  0.10, wheelR*0.4,  0.04,  0.38, wheelR*1.1);   // down tube

  // Handlebar
  B(-0.18, 0.28, wheelR*1.1, 0.18, 0.36, wheelR*1.18);

  // Rider torso (leaning forward)
  B(-0.12, -0.22, wheelR*1.1, 0.12, 0.18, wheelR*1.7);

  // Head + helmet
  S(0, 0, wheelR*1.87, 0.17, 6, 10);
  // Helmet: slightly flattened cap on top of head
  B(-0.19, -0.16, wheelR*1.87, 0.19, 0.16, wheelR*2.05);

  // ── Insulated delivery box on rear rack ──
  // Sits behind the rear wheel (y more negative than -0.35)
  B(-0.22, -0.82, wheelR*0.35, 0.22, -0.38, wheelR*1.62);

  return buildMesh(pos, nor, idx);
}

/**
 * Simple procedural meshes for Page5 visualization
 * All coordinates in local space (meters), Z = up
 */

/** Rider on a bike: two wheels + frame + leaning body */
export function createRiderMesh() {
  const positions = [];
  const normals   = [];
  const indices   = [];

  function addRing(cx, cy, cz, r, thickness, seg, axis) {
    // axis: 'x' = wheel in YZ plane, 'y' = wheel in XZ plane
    const base = positions.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (let s = 0; s <= 1; s++) {
        const ro = r + (s === 0 ? thickness : -thickness);
        let x, y, z;
        if (axis === 'x') { x = cx; y = cy + ro * cos; z = cz + ro * sin; }
        else              { x = cx + ro * cos; y = cy; z = cz + ro * sin; }
        positions.push(x, y, z);
        const nx = axis === 'x' ? 1 : 0;
        const ny = axis === 'x' ? 0 : 1;
        normals.push(nx, ny, 0);
      }
    }
    for (let i = 0; i < seg; i++) {
      const b = base + i * 2;
      indices.push(b, b+2, b+1, b+1, b+2, b+3);
    }
  }

  function addBox(x0, y0, z0, x1, y1, z1) {
    const b = positions.length / 3;
    // top
    positions.push(x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1);
    normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
    indices.push(b, b+1, b+2, b, b+2, b+3);
    // bottom
    const b2 = positions.length / 3;
    positions.push(x0,y0,z0, x1,y1,z0, x1,y0,z0, x0,y1,z0);
    normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
    indices.push(b2, b2+1, b2+2, b2, b2+3, b2+1);
  }

  function addSphere(cx, cy, cz, r, latS, lonS) {
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

  const wheelR = 0.38, wheelT = 0.04, wheelSeg = 20;
  // rear wheel at y=-0.35, front wheel at y=0.35
  addRing(0, -0.35, wheelR, wheelR, wheelT, wheelSeg, 'x');
  addRing(0,  0.35, wheelR, wheelR, wheelT, wheelSeg, 'x');

  // frame: seat tube, top tube, down tube
  addBox(-0.04, -0.10, wheelR * 0.6,  0.04,  0.10, wheelR * 1.1);  // seat tube
  addBox(-0.04, -0.35, wheelR * 1.05, 0.04,  0.30, wheelR * 1.15); // top tube
  addBox(-0.04,  0.10, wheelR * 0.4,  0.04,  0.38, wheelR * 1.1);  // down tube

  // handlebar
  addBox(-0.18, 0.28, wheelR * 1.1, 0.18, 0.36, wheelR * 1.18);

  // rider body (leaning forward): torso box
  addBox(-0.12, -0.22, wheelR * 1.1, 0.12, 0.18, wheelR * 1.7);

  // head
  addSphere(0, 0, wheelR * 1.85, 0.17, 6, 10);

  return {
    attributes: {
      POSITION: { value: new Float32Array(positions), size: 3 },
      NORMAL:   { value: new Float32Array(normals),   size: 3 },
    },
    indices: { value: new Uint32Array(indices), size: 1 },
  };
}

/** Map-pin / teardrop shape — tip at z=0, ball on top */
export function createPinMesh() {
  const r       = 0.32;   // sphere radius
  const coneH   = 0.5;    // height of cone below sphere
  const sphereZ = coneH + r * 0.15; // sphere center (slightly overlaps cone top)
  const lonSegs = 14;
  const latSegs = 10;

  const positions = [];
  const normals   = [];
  const indices   = [];

  // ── cone: tip → base circle ──
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

  // ── sphere (UV sphere centered at sphereZ) ──
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

/** Quadcopter drone: X-frame body + 4 rotor rings viewed from above */
export function createDroneMesh() {
  const positions = [];
  const normals   = [];
  const indices   = [];

  function addFlatRing(cx, cy, innerR, outerR, seg, z, nz) {
    const base = positions.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      positions.push(cx + cos * outerR, cy + sin * outerR, z); normals.push(0, 0, nz);
      positions.push(cx + cos * innerR, cy + sin * innerR, z); normals.push(0, 0, nz);
    }
    for (let i = 0; i < seg; i++) {
      const b = base + i * 2;
      if (nz > 0) indices.push(b, b+2, b+1, b+1, b+2, b+3);
      else        indices.push(b, b+1, b+2, b+1, b+3, b+2);
    }
  }

  function addBox(x0, y0, x1, y1, z0, z1) {
    // top
    const b = positions.length / 3;
    positions.push(x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1);
    normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
    indices.push(b, b+1, b+2, b, b+2, b+3);
    // bottom
    const b2 = positions.length / 3;
    positions.push(x0,y0,z0, x1,y1,z0, x1,y0,z0, x0,y1,z0);
    normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
    indices.push(b2, b2+1, b2+2, b2, b2+3, b2+1);
  }

  const armLen = 0.92;
  const armW   = 0.10;
  const bodyH  = 0.12;
  const rotorR = 0.32;
  const rotorInner = 0.22;
  const rotorSeg   = 16;

  // ── 4 arms (X-frame, 45° diagonal) ──
  const armDirs = [[1,1],[-1,1],[1,-1],[-1,-1]];
  for (const [dx, dy] of armDirs) {
    const ex = dx * armLen * 0.707;
    const ey = dy * armLen * 0.707;
    addBox(-armW*0.5*Math.abs(dy) + ex*0 - armW*0.5,
           -armW*0.5,
            armW*0.5*Math.abs(dy) + ex*0 + armW*0.5,
            armW*0.5, 0, bodyH);
    // simplified: just a thin diagonal box
    addBox(Math.min(0,ex)-armW, Math.min(0,ey)-armW,
           Math.max(0,ex)+armW, Math.max(0,ey)+armW, 0, bodyH);
  }

  // ── central body ──
  addBox(-0.18, -0.18, 0.18, 0.18, 0, bodyH * 1.5);

  // ── 4 rotor rings at arm tips ──
  const tipDist = armLen * 0.707;
  for (const [dx, dy] of armDirs) {
    const cx = dx * tipDist, cy = dy * tipDist;
    addFlatRing(cx, cy, rotorInner, rotorR, rotorSeg, bodyH + 0.01,  1);
    addFlatRing(cx, cy, rotorInner, rotorR, rotorSeg, 0,             -1);
  }

  return {
    attributes: {
      POSITION: { value: new Float32Array(positions), size: 3 },
      NORMAL:   { value: new Float32Array(normals),   size: 3 },
    },
    indices: { value: new Uint32Array(indices), size: 1 },
  };
}

/** Person: a UV-sphere (head) sitting on top of a box body — robust geometry */
export function createPersonMesh() {
  const positions = [];
  const normals   = [];
  const indices   = [];

  // ── box body: 0.4 wide × 0.4 deep × 0.8 tall, base at z=0 ──
  const W = 0.2, D = 0.2, H = 0.8;
  const boxVerts = [
    // front  (y = -D)
    [-W, -D, 0],  [W, -D, 0],  [W, -D, H],  [-W, -D, H],
    // back   (y = +D)
    [W,  D, 0],  [-W,  D, 0],  [-W,  D, H],  [W,  D, H],
    // left   (x = -W)
    [-W,  D, 0],  [-W, -D, 0],  [-W, -D, H],  [-W,  D, H],
    // right  (x = +W)
    [W, -D, 0],  [W,  D, 0],  [W,  D, H],  [W, -D, H],
    // top    (z = H)
    [-W, -D, H],  [W, -D, H],  [W,  D, H],  [-W,  D, H],
    // bottom (z = 0)
    [-W,  D, 0],  [W,  D, 0],  [W, -D, 0],  [-W, -D, 0],
  ];
  const boxNormals = [
    [0,-1,0],[0,-1,0],[0,-1,0],[0,-1,0],
    [0, 1,0],[0, 1,0],[0, 1,0],[0, 1,0],
    [-1,0,0],[-1,0,0],[-1,0,0],[-1,0,0],
    [1, 0,0],[1, 0,0],[1, 0,0],[1, 0,0],
    [0, 0,1],[0, 0,1],[0, 0,1],[0, 0,1],
    [0,0,-1],[0,0,-1],[0,0,-1],[0,0,-1],
  ];
  const base = 0;
  for (let f = 0; f < 6; f++) {
    const i = f * 4;
    const [nx, ny, nz] = boxNormals[i];
    for (let v = 0; v < 4; v++) {
      const [x, y, z] = boxVerts[i + v];
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
    }
    const s = base + i;
    indices.push(s, s+1, s+2, s, s+2, s+3);
  }

  // ── sphere head: UV sphere centered at (0, 0, H + 0.25) ──
  const hr = 0.25, hcz = H + hr;
  const latS = 8, lonS = 12;
  const sphStart = positions.length / 3;
  for (let la = 0; la <= latS; la++) {
    const phi = (la / latS) * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let lo = 0; lo <= lonS; lo++) {
      const theta = (lo / lonS) * Math.PI * 2;
      const ct = Math.cos(theta), st = Math.sin(theta);
      positions.push(hr*sp*ct, hr*sp*st, hcz + hr*cp);
      normals.push(sp*ct, sp*st, cp);
    }
  }
  for (let la = 0; la < latS; la++) {
    for (let lo = 0; lo < lonS; lo++) {
      const a = sphStart + la*(lonS+1) + lo;
      const b = a + lonS + 1;
      indices.push(a, b, a+1, b, b+1, a+1);
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

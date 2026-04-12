import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const GRID = 14;
const SPACING = 1.3;
const HALF = (GRID - 1) * SPACING * 0.5;

const PALETTE = [
  '#ff8c00', '#ff6420', '#ff3264', '#e0285a',
  '#c864ff', '#a050e0', '#64c8ff', '#00e896',
  '#ffb830', '#ff7050', '#b060ff', '#50b0ff',
];

function seededRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function CityBlocks() {
  const groupRef = useRef();

  const blocks = useMemo(() => {
    const arr = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const seed = row * GRID + col;
        const r1 = seededRandom(seed);
        const r2 = seededRandom(seed + 0.5);
        const r3 = seededRandom(seed + 1.0);

        if (r1 < 0.12) continue;

        const height = 0.3 + r2 * 2.8;
        const color = PALETTE[Math.floor(r3 * PALETTE.length)];

        const x = col * SPACING - HALF;
        const z = row * SPACING - HALF;

        arr.push({ x, z, height, color, seed });
      }
    }
    return arr;
  }, []);

  const meshData = useMemo(() => {
    const dummy = new THREE.Object3D();
    const count = blocks.length;
    const colors = new Float32Array(count * 3);
    const matrix = new THREE.Matrix4();
    const matrices = [];
    const baseHeights = [];

    blocks.forEach((b, i) => {
      const c = new THREE.Color(b.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      dummy.position.set(b.x, b.height * 0.5, b.z);
      dummy.scale.set(0.85, b.height, 0.85);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      baseHeights.push(b.height);
    });

    return { count, colors, matrices, baseHeights, blocks };
  }, [blocks]);

  const meshRef = useRef();

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    const dummy = new THREE.Object3D();
    meshData.blocks.forEach((b, i) => {
      const wave = Math.sin(t * 0.6 + b.x * 0.5 + b.z * 0.3) * 0.15;
      const h = meshData.baseHeights[i] + wave;
      dummy.position.set(b.x, h * 0.5, b.z);
      dummy.scale.set(0.85, Math.max(0.1, h), 0.85);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[null, null, meshData.count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.55}
          metalness={0.1}
          transparent
          opacity={0.85}
        />
        <instancedBufferAttribute
          attach="geometry-attributes-color"
          args={[meshData.colors, 3]}
        />
      </instancedMesh>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 12, 6]} intensity={1.0} color="#ffffff" />
      <directionalLight position={[-5, 8, -4]} intensity={0.3} color="#c8d8ff" />
      <pointLight position={[0, 6, 0]} intensity={0.4} color="#ff8c00" distance={20} />
    </>
  );
}

export default function IsometricCityBg() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{
          position: [12, 10, 12],
          fov: 35,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Lights />
        <CityBlocks />
      </Canvas>
    </div>
  );
}

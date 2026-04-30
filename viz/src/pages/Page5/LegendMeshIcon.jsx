import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Renders a procedural mesh into a small canvas icon using Three.js.
 * eye / target are in the mesh's local coordinate space (Z = up).
 */
export default function LegendMeshIcon({ createMesh, color, eye, target = [0, 0, 0.5], size = 44 }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.up.set(0, 0, 1); // Z is up in mesh space
    camera.position.set(...eye);
    camera.lookAt(new THREE.Vector3(...target));

    // Key light from camera direction + soft fill from opposite side
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(...eye);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-eye[0], -eye[1], Math.abs(eye[2]) * 0.5);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const meshData = createMesh();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.POSITION.value, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(meshData.attributes.NORMAL.value,   3));
    geo.setIndex(new THREE.BufferAttribute(meshData.indices.value, 1));

    const [r, g, b] = color;
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(r / 255, g / 255, b / 255),
      shininess: 55,
      specular: new THREE.Color(0.25, 0.25, 0.25),
    });

    scene.add(new THREE.Mesh(geo, mat));
    renderer.render(scene, camera);

    return () => {
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
    />
  );
}

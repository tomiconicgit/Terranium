import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);
  const exrLoader = new EXRLoader(manager);

  // --- Choose one set for now (moondusted) ---
  const diffuse = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const displacement = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');

  // NOTE: Mobile Safari can be finicky with EXR. We'll skip EXR normal/roughness for now.
  // If you want to try them later, uncomment and assign to material.normalMap / roughnessMap.
  // const normalEXR = exrLoader.load('src/assets/textures/moon/moondusted/moondusted-normal.exr');
  // const roughEXR  = exrLoader.load('src/assets/textures/moon/moondusted/moondusted-roughness.exr');

  // Proper color space for sRGB JPGs
  diffuse.colorSpace = THREE.SRGBColorSpace;

  // Tiling
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;

  // Bigger world so you clearly see ground to horizon
  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Lightweight height field (deterministic) — no shader magic needed
  function noise2(x, z) {
    // Simple pseudo-noise using sin/cos blends (mobile-friendly)
    return (
      Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5 +
      Math.sin(x * 0.013 + z * 0.021) * 0.35 +
      Math.cos(x * 0.002 - z * 0.003) * 0.15
    );
  }

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = Math.max(0, noise2(x, z)) * 6.0 + Math.max(0, noise2(x * 0.5, z * 0.5)) * 3.0;
    pos.setY(i, h);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    displacementMap: displacement,
    displacementScale: 0.5,      // gentle parallax from height map
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
  });

  // If you later add normal/roughness EXR, do it like this (EXR normals may need conversion):
  // material.normalMap = normalEXR;
  // material.roughnessMap = roughEXR;

  // Repeat textures at a nice density (world-size aware)
  const repeat = 40; // higher = smaller texels
  diffuse.repeat.set(repeat, repeat);
  displacement.repeat.set(repeat, repeat);
  // if (material.normalMap) material.normalMap.repeat.set(repeat, repeat);
  // if (material.roughnessMap) material.roughnessMap.repeat.set(repeat, repeat);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  // mesh.castShadow = true; // enable if you add rocks/props later

  return mesh;
}
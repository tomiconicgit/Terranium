import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function createTerrain(manager) {
  const loader = new THREE.TextureLoader(manager);
  // Keep EXRLoader import in case you later add EXR normals/roughness
  // const exrLoader = new EXRLoader(manager);

  // --- Texture set (moondusted) ---
  const diffuse = loader.load('src/assets/textures/moon/moondusted/moondusted-diffuse.jpg');
  const displacement = loader.load('src/assets/textures/moon/moondusted/moondusted-displacement.png');
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  displacement.wrapS = displacement.wrapT = THREE.RepeatWrapping;

  const SIZE = 400;
  const SEGMENTS = 256;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // mobile-friendly pseudo-noise dunes
  function noise2(x, z) {
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
    displacementScale: 0.5,
    displacementBias: 0.0,
    roughness: 1.0,
    metalness: 0.0,
    color: new THREE.Color(0xffffff) // tint control
  });

  const repeat = 40;
  diffuse.repeat.set(repeat, repeat);
  displacement.repeat.set(repeat, repeat);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // Public API for UI
  const api = {
    mesh,
    material,
    setDisplacementScale(v) { material.displacementScale = v; },
    setRoughness(v) { material.roughness = v; },
    setRepeat(v) {
      const r = Math.max(1, v);
      diffuse.repeat.set(r, r);
      displacement.repeat.set(r, r);
      diffuse.needsUpdate = true;
      displacement.needsUpdate = true;
    },
    setTintColor(hex) {
      material.color.set(hex);
    },
    // For copying
    _getCurrent: () => ({
      terrainDisplacement: material.displacementScale,
      terrainRoughness: material.roughness,
      terrainRepeat: diffuse.repeat.x,
      terrainTint: `#${material.color.getHexString()}`
    })
  };

  return api;
}
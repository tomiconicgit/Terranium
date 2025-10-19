// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * 200x200 sand base with subtle, cheap height noise.
 * World span: [-200, 200] in X/Z. Keep it simple & fast.
 */
export function createTerrain() {
  const SIZE = 400;      // world width/height in meters
  const HALF = SIZE * 0.5;
  const RES  = 200;      // segments (kept modest)
  const AMP  = 1.4;      // height amplitude (meters), subtle
  const FREQ = 0.05;     // noise frequency

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  geo.rotateX(-Math.PI / 2);

  // Super-cheap value noise (hash-based), no perlin deps
  const h = (x, z) => {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2.0 - 1.0;
  };
  const smoothNoise = (x, z) => {
    // 4-tap bilinear blend
    const xi = Math.floor(x), zi = Math.floor(z);
    const tx = x - xi, tz = z - zi;
    const n00 = h(xi, zi),     n10 = h(xi + 1, zi);
    const n01 = h(xi, zi + 1), n11 = h(xi + 1, zi + 1);
    const nx0 = n00 * (1 - tx) + n10 * tx;
    const nx1 = n01 * (1 - tx) + n11 * tx;
    return nx0 * (1 - tz) + nx1 * tz;
  };

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = smoothNoise(x * FREQ, z * FREQ);
    pos.setY(i, n * AMP);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // PBR sand-ish but cheap (single color + slight AO baked look)
  const sand = new THREE.MeshStandardMaterial({
    color: 0xE1D7B9, metalness: 0.0, roughness: 0.95
  });

  const mesh = new THREE.Mesh(geo, sand);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'SandTerrain';
  mesh.userData.__isTerrain = true;

  // Helper for bounds (used by builder)
  mesh.userData.bounds = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF };

  const group = new THREE.Group();
  group.name = 'terrain_root';
  group.add(mesh);
  return group;
}
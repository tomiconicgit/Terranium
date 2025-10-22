// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * 100x100 flat sand base.
 * World span: [-50, 50] in X/Z.
 */
export function createTerrain() {
  const SIZE = 100;     // world width/height in meters
  const HALF = SIZE * 0.5;
  const RES  = 1;       // 1 segment for a single flat plane

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  geo.rotateX(-Math.PI / 2);

  // No noise, it's a flat plane.
  geo.computeVertexNormals();

  // PBR sand-ish but cheap
  const sand = new THREE.MeshStandardMaterial({
    color: 0xE1D7B9, metalness: 0.0, roughness: 0.95
  });

  const mesh = new THREE.Mesh(geo, sand);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'SandTerrain_100x100_Flat';
  mesh.userData.__isTerrain = true;

  // Helper for bounds
  mesh.userData.bounds = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF };

  const group = new THREE.Group();
  group.name = 'terrain_root';
  group.add(mesh);
  return group;
}

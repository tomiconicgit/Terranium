// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * 100x100 flat concrete base.
 * World span: [-50, 50] in X/Z.
 */
export function createTerrain() {
  const SIZE = 100;      // world width/height in meters
  const HALF = SIZE * 0.5;
  const RES  = 1;        // 1 segment for a single flat plane

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  geo.rotateX(-Math.PI / 2);

  // No noise, it's a flat plane.
  geo.computeVertexNormals();

  // *** UPDATED: PBR concrete material ***
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x808080, // Medium grey
    metalness: 0.1,  // Slightly metallic for a bit of sheen
    roughness: 0.8   // Mostly rough
  });

  const mesh = new THREE.Mesh(geo, concrete);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'ConcreteTerrain_100x100_Flat';
  mesh.userData.__isTerrain = true;

  // Helper for bounds
  mesh.userData.bounds = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF };

  const group = new THREE.Group();
  group.name = 'terrain_root';
  group.add(mesh);
  return group;
}

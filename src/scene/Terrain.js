// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * 100x100 flat base.
 * World span: [-50, 50] in X/Z.
 */
export function createTerrain() {
  const SIZE = 100;
  const HALF = SIZE * 0.5;
  const RES  = 1;

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();

  // *** MODIFIED: Plain grey material by default ***
  const plainMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555, // Medium grey
    metalness: 0.1,
    roughness: 0.8
  });

  const mesh = new THREE.Mesh(geo, plainMaterial);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'ConcreteTerrain_100x100_Flat'; // Use this name to find it
  mesh.userData.__isTerrain = true;

  mesh.userData.bounds = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF };

  const group = new THREE.Group();
  group.name = 'terrain_root';
  group.add(mesh);
  return group;
}

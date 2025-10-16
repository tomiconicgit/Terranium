// src/scene/Terrain.js

import * as THREE from 'three';

export function createTerrain() {
  const plateauSize = 50;
  const worldSize = 250;
  const slopeHeight = 20;

  const geometry = new THREE.PlaneGeometry(worldSize, worldSize, 100, 100);
  const pos = geometry.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const isOutside = Math.abs(x) > plateauSize / 2 || Math.abs(z) > plateauSize / 2;
    if (isOutside) {
      const dx = Math.max(0, Math.abs(x) - plateauSize / 2);
      const dz = Math.max(0, Math.abs(z) - plateauSize / 2);
      const dist = Math.hypot(dx, dz);
      
      const slopeRun = (worldSize - plateauSize) / 2;
      const progress = Math.min(dist / slopeRun, 1.0);
      
      pos.setY(i, -(progress * progress) * slopeHeight);
    }
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
      color: 0x6a6a6a,
      roughness: 0.9,
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  return terrain;
}

// src/scene/Scene.js
import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();
    this.background = null;

    // Bright, even lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.35); this.add(amb);
    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7c6a4d, 1.0); hemi.position.set(0, 60, 0); this.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.10); dir1.position.set(+60, 80, -60);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.80); dir2.position.set(-60, 50, +60);
    const dir3 = new THREE.DirectionalLight(0xffffff, 0.60); dir3.position.set(+60, 40, +60);
    const dir4 = new THREE.DirectionalLight(0xffffff, 0.50); dir4.position.set(-60, 30, -60);
    [dir1, dir2, dir3, dir4].forEach(d => this.add(d));

    // Sky dome
    this.add(createSkyDome());

    // -------- Flat terrain (raycastable) --------
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0xdbcb9a, roughness: 1, metalness: 0 });
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), terrainMat);
    terrain.name = 'terrain';
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(0, 0, 0);
    terrain.receiveShadow = true;
    this.add(terrain);

    // World parent for placed parts
    const world = new THREE.Group(); world.name = 'world'; this.add(world);
  }

  update() {}
}
// src/scene/Scene.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor(opts = {}) {
    super();

    // Keep background null so SkyDome renders
    this.background = null;

    // Simple uniform bucket + tickers if you need them later
    this.userData.uniforms = { time: { value: 0 } };
    this.userData.tick = [];

    // ---------- Lighting: bright + even, accurate colours ----------
    {
      // Soft global fill so corners never go pitch dark
      const amb = new THREE.AmbientLight(0xffffff, 0.35);
      this.add(amb);

      // Slightly bluer sky / warm ground, higher intensity
      const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7c6a4d, 1.0);
      hemi.position.set(0, 60, 0);
      this.add(hemi);

      // 4-key rig from corners – lifts edges/faces for clear visuals
      const dir1 = new THREE.DirectionalLight(0xffffff, 1.10); dir1.position.set(+60, 80, -60);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.80); dir2.position.set(-60, 50, +60);
      const dir3 = new THREE.DirectionalLight(0xffffff, 0.60); dir3.position.set(+60, 40, +60);
      const dir4 = new THREE.DirectionalLight(0xffffff, 0.50); dir4.position.set(-60, 30, -60);
      [dir1, dir2, dir3, dir4].forEach(d => { d.castShadow = false; this.add(d); });
    }

    // ---------- Sky ----------
    this.add(createSkyDome());

    // ---------- Ground: 100×100 instanced blocks (1×1×1) at y=0.5 ----------
    const groundInstanced = makeGroundInstanced({
      size: 100,
      material: new THREE.MeshStandardMaterial({ color: 0xdbcb9a, roughness: 1.0, metalness: 0.0 }) // sand-ish
    });
    groundInstanced.name = 'groundInstanced';
    this.add(groundInstanced);

    // ---------- World root for placed assets ----------
    const world = new THREE.Group();
    world.name = 'world';
    this.add(world);
  }

  update(dt, elapsed /*, camera, player */) {
    this.userData.uniforms.time.value = elapsed;

    // Run any additional scene tickers if added later
    for (const t of this.userData.tick) t(dt, elapsed);
  }
}

/* =============================================================================
   Helpers
============================================================================= */

function makeGroundInstanced({ size = 100, material }) {
  // 1×1×1 cubes centered at (x,0.5,z) so top is y=1.0
  const geom = new THREE.BoxGeometry(1, 1, 1);
  const count = size * size;
  const mesh = new THREE.InstancedMesh(geom, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const tmp = new THREE.Object3D();
  let i = 0;
  const half = Math.floor(size / 2);

  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      const x = gx - half;
      const z = gz - half;
      tmp.position.set(x, 0.5, z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i++, tmp.matrix);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // keep everything – ‘flat world’ feel
  return mesh;
}
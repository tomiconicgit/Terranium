// src/scene/Scene.js
import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();
    this.background = null;
    this.userData.uniforms = { time: { value: 0 } };
    this.userData.tick = [];

    // Lighting (even & bright)
    const amb = new THREE.AmbientLight(0xffffff, 0.35); this.add(amb);
    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7c6a4d, 1.0); hemi.position.set(0, 60, 0); this.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.10); dir1.position.set(+60, 80, -60);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.80); dir2.position.set(-60, 50, +60);
    const dir3 = new THREE.DirectionalLight(0xffffff, 0.60); dir3.position.set(+60, 40, +60);
    const dir4 = new THREE.DirectionalLight(0xffffff, 0.50); dir4.position.set(-60, 30, -60);
    [dir1, dir2, dir3, dir4].forEach(d => this.add(d));

    // Sky
    this.add(createSkyDome());

    // Flat “Minecraft” ground 100×100 (1×1×1 cubes)
    const ground = makeGroundInstanced(100, new THREE.MeshStandardMaterial({ color: 0xdbcb9a, roughness: 1, metalness: 0 }));
    ground.name = 'groundInstanced';
    this.add(ground);

    // Root for placed assets
    const world = new THREE.Group(); world.name = 'world'; this.add(world);
  }

  update(dt, elapsed) {
    this.userData.uniforms.time.value = elapsed;
    for (const t of this.userData.tick) t(dt, elapsed);
  }
}

/* helpers */
function makeGroundInstanced(size, material) {
  const geom = new THREE.BoxGeometry(1,1,1);
  const count = size*size;
  const mesh = new THREE.InstancedMesh(geom, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tmp = new THREE.Object3D();
  let i = 0, half = Math.floor(size/2);
  for (let z=0; z<size; z++) for (let x=0; x<size; x++) {
    tmp.position.set(x - half + 0.5, 0.5, z - half + 0.5);
    tmp.rotation.set(0,0,0); tmp.scale.set(1,1,1); tmp.updateMatrix();
    mesh.setMatrixAt(i++, tmp.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
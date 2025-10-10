import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();
    this.background = null;

    // Lights
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7c6a4d, 0.9);
    hemi.position.set(0, 30, 0);
    this.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(-40, 60, -25);
    this.add(sun);

    // Sky
    this.add(createSkyDome());

    // Flat ambient plane under the voxel world (not visible, just safety)
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: 0x202020, visible: false })
    );
    plane.rotation.x = -Math.PI/2;
    plane.position.y = -0.5;
    this.add(plane);

    // ===== Voxel ground (100x100) using instancing =====
    const size = 100;  // 100x100
    const tile = 1.0;
    const half = (size * tile) / 2;
    const geom = new THREE.BoxGeometry(tile, tile, tile);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd7cbb0, roughness: 1.0, metalness: 0.0 });
    const inst = new THREE.InstancedMesh(geom, mat, size * size);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const m = new THREE.Matrix4();
    let i = 0;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const wx = x * tile - half + tile / 2;
        const wz = z * tile - half + tile / 2;
        m.compose(
          new THREE.Vector3(wx, 0, wz),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1, 1)
        );
        inst.setMatrixAt(i++, m);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.name = 'groundInstanced';
    this.add(inst);

    // container for user-placed blocks
    const world = new THREE.Group();
    world.name = 'world';
    this.add(world);
  }
}
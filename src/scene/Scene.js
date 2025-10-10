import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createSkyDome } from '../objects/SkyDome.js';

export class SceneRoot {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // camera
    this.camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.05, 1500);
    this.camera.position.set(4, 1.7, 6);

    // lights
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7c6a4d, 0.9);
    hemi.position.set(0, 30, 0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-60, 80, -40);
    this.scene.add(sun);

    // sky
    this.scene.add(createSkyDome());

    // ground: 100x100 voxel desert
    const size = 100;
    const mat = new THREE.MeshStandardMaterial({ color: 0xe4d3a5, roughness: 0.95, metalness: 0.02 });
    const geom = new THREE.BoxGeometry(1,1,1); // single cube reused
    const ground = new THREE.InstancedMesh(geom, mat, size*size);
    ground.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const m4 = new THREE.Matrix4();
    const y = 0.5; // level y
    let i = 0;
    for (let z=0; z<size; z++){
      for (let x=0; x<size; x++){
        m4.makeTranslation(x + 0.5, y, z + 0.5);
        ground.setMatrixAt(i++, m4);
      }
    }
    ground.position.set(-size/2, 0, -size/2);
    this.scene.add(ground);

    // a big invisible plane used ONLY for raycasting placement below the first layer
    this.groundRayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshBasicMaterial({ visible:false })
    );
    this.groundRayMesh.rotation.x = -Math.PI/2;
    this.groundRayMesh.position.y = 0; // top surface at y=0
    this.scene.add(this.groundRayMesh);
  }
}
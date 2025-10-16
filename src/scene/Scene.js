// src/scene/Scene.js
import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();
    
    // Create sky
    const sky = createSkyDome();
    this.add(sky);
    this.fog = new THREE.Fog(0x94c0ff, 200, 1000);
    this.background = new THREE.Color(0x94c0ff);

    // Add lights
    this.add(new THREE.HemisphereLight(0xffffff, 0x95abcc, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(120, 160, -110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    this.sun = sun;
    this.add(sun, sun.target);

    // Create terrain
    const PAD_SIZE = 500;
    const terrainGeo = new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE);
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.92 });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    this.add(terrain);

    this._cameraTarget = new THREE.Vector3();
  }

  updateShadows(camera) {
    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.multiplyScalar(20).add(camera.position);
    this.sun.target.position.copy(this._cameraTarget);
  }
}

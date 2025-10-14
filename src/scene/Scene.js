// src/scene/Scene.js — flat 70×70 concrete pad, sky, sun, reflections, pit digging
import * as THREE from 'three';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    this.userData.tile = 4;
    const TILES = 70;
    const PAD = this.userData.tile * TILES;

    const sky = createSkyDome();
    this.add(sky);
    this.fog = new THREE.Fog(0x94c0ff, 200, 1000);
    this.background = new THREE.Color(0x94c0ff);

    this.add(new THREE.HemisphereLight(0xffffff, 0x95abcc, 1.25));

    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(120, 160, -110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096); // Increased resolution for sharper shadows
    sun.shadow.camera.near = 10; sun.shadow.camera.far  = 600;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.bias = -0.0005;
    // **FIX**: Added a normal bias to prevent shadow acne on curved surfaces.
    sun.shadow.normalBias = 0.05; 
    this.sun = sun;
    this.add(sun, sun.target);

    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCamera = new THREE.CubeCamera(1, 2000, cubeRT);
    this.dynamicEnvMap = cubeRT.texture;

    const SEG = TILES * 2;
    const geo = new THREE.PlaneGeometry(PAD, PAD, SEG, SEG);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.92, metalness: 0.02 });
    const terrain = new THREE.Mesh(geo, concrete);
    terrain.rotation.x = -Math.PI / 2;
    terrain.name = 'terrainPlane';
    terrain.receiveShadow = true;
    this.terrain = terrain;
    this.add(terrain);

    this._cameraTarget = new THREE.Vector3();
  }

  digPit(centerWS, size = this.userData.tile, depth = this.userData.tile) {
    const g = this.terrain.geometry;
    const pos = g.attributes.position;
    const center = this.terrain.worldToLocal(centerWS.clone());
    const halfSize = size / 2;

    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);

        if (vx > center.x - halfSize && vx < center.x + halfSize &&
            vy > center.y - halfSize && vy < center.y + halfSize) {
            pos.setZ(i, pos.getZ(i) - depth);
        }
    }

    pos.needsUpdate = true;
    g.computeVertexNormals();
  }

  updateReflections(renderer, camera) {
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(renderer, this);
  }
  
  updateShadows(camera) {
    camera.getWorldDirection(this._cameraTarget);
    this._cameraTarget.multiplyScalar(20).add(camera.position);
    this.sun.target.position.copy(this._cameraTarget);
  }
}

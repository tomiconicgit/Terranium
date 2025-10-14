// src/scene/Scene.js — flat 70×70 concrete pad, sky, sun, reflections, pit digging
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    this.userData.tile = 4;
    const TILES = 70;
    const PAD = this.userData.tile * TILES;

    const skyColor = 0xcce0ff;
    this.background = new THREE.Color(skyColor);
    this.fog = new THREE.Fog(skyColor, 200, 1000);

    this.add(new THREE.HemisphereLight(skyColor, 0x95abcc, 1.05));

    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(120, 160, -110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10; sun.shadow.camera.far  = 600;
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
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

  // **FIX**: Dig depth is now a much more reasonable value to prevent extreme deformation.
  digPit(centerWS, depth = 4, radius = this.userData.tile * 1.8) {
    const g = this.terrain.geometry;
    const pos = g.attributes.position;
    const center = this.terrain.worldToLocal(centerWS.clone());

    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - center.x;
      const dy = pos.getY(i) - center.y; // Use Y in local space for plane
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        const t = 1.0 - Math.min(1.0, dist / radius);
        const curZ = pos.getZ(i);
        pos.setZ(i, curZ - depth * (t * t)); // Displace along local Z (world down)
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

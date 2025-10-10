// Scene.js (only the key bits)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createGroundTiles } from '../objects/GroundTiles.js';
import { createSkyDome } from '../objects/SkyDome.js';
import { createLaunchPadComplex } from '../objects/LaunchPadComplex.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();

    // Background must be null so our SkyDome shows.
    this.background = null;

    this.userData.uniforms = { time: { value: 0 } };
    this.userData.tick = [];

    const ground = createGroundTiles({ size: 140, segments: 140, uniformsRef: this.userData.uniforms });
    ground.name = 'landscape';
    this.add(ground);

    const pad = createLaunchPadComplex();
    this.add(pad);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7c6a4d, 0.9);
    hemi.position.set(0, 30, 0);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-40, 60, -25);
    this.add(sun);

    this.add(createSkyDome());
  }

  update(dt, elapsed, camera, player) {
    this.userData.uniforms.time.value = elapsed;
    const pad = this.getObjectByName('launchPad');
    pad?.userData?.update?.(dt, elapsed, { camera, player });
    for (const t of this.userData.tick) t(dt, elapsed, { camera, player });
  }
}
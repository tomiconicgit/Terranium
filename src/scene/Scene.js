import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createGroundTiles } from '../objects/GroundTiles.js';
import { createProps } from '../objects/Props.js';
import { createSkyDome } from '../objects/SkyDome.js';
import { createLaunchPadComplex } from '../objects/LaunchPadComplex.js';

export class Scene extends THREE.Scene {
  constructor() {
    super();
    this.background = new THREE.Color(0x87a8c7);
    this.userData.uniforms = { time: { value: 0 } };
    this.userData.tick = [];

    // Expanded terrain to 140×140
    const ground = createGroundTiles({
      size: 140, segments: 140, grassRatio: 0.96, uniformsRef: this.userData.uniforms
    });
    ground.name = 'landscape';
    this.add(ground);

    const pad = createLaunchPadComplex();
    this.add(pad);

    const { rocks, trees, tickers } = createProps({
      areaSize: 140, avoidRadius: 30, rockCount: 180, treeCount: 170, uniformsRef: this.userData.uniforms
    });
    this.add(rocks, trees);
    this.userData.tick.push(...tickers);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 0.9);
    hemi.position.set(0, 30, 0);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.45);
    sun.position.set(-40, 60, -25);
    this.add(sun);

    const sky = createSkyDome();
    this.add(sky);
  }

  update(dt, elapsed) {
    this.userData.uniforms.time.value = elapsed;
    for (const t of this.userData.tick) t(dt, elapsed);
  }
}
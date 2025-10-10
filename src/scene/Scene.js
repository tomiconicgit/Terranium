import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createGroundTiles } from '../objects/GroundTiles.js';
import { createLaunchPad } from '../objects/LaunchPad.js';
import { createProps } from '../objects/Props.js';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
    constructor() {
        super();
        this.background = new THREE.Color(0x87a8c7);
        this.userData.tick = [];
        this.userData.uniforms = { time: { value: 0 } };

        // Ground (keeps name 'landscape' for raycasts)
        const ground = createGroundTiles({
            size: 100,
            segments: 100,
            grassRatio: 0.7,
            uniformsRef: this.userData.uniforms
        });
        ground.name = 'landscape';
        this.add(ground);

        // Launch pad
        const pad = createLaunchPad({ radius: 8, height: 0.2 });
        pad.position.set(0, 0.01, 0);
        this.add(pad);

        // Props
        const { rocks, trees, tickers } = createProps({
            areaSize: 100,
            avoidRadius: 14,
            rockCount: 180,
            treeCount: 140,
            uniformsRef: this.userData.uniforms
        });
        this.add(rocks, trees);
        this.userData.tick.push(...tickers);

        // Lighting
        const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 0.85);
        hemi.position.set(0, 30, 0);
        this.add(hemi);

        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(-40, 60, -25);
        this.add(sun);

        // Sky
        const sky = createSkyDome();
        this.add(sky);
    }

    update(dt, elapsed) {
        // pump shared time uniform
        this.userData.uniforms.time.value = elapsed;
        // run material/animation tickers
        for (const t of this.userData.tick) t(dt, elapsed);
    }
}
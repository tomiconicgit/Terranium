import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createGroundTiles } from '../objects/GroundTiles.js';
import { createLaunchPad } from '../objects/LaunchPad.js';
import { createProps } from '../objects/Props.js';
import { createSkyDome } from '../objects/SkyDome.js';

export class Scene extends THREE.Scene {
    constructor() {
        super();

        // Background stays clear; skydome provides horizon color
        this.background = new THREE.Color(0x87a8c7); // fallback if skydome not visible

        // --- Ground area 100x100, named 'landscape' (keeps compatibility) ---
        const ground = createGroundTiles({
            size: 100,          // total world size
            segments: 100,      // visual tile resolution (1 unit tiles)
            grassRatio: 0.65    // % of grass vs sand
        });
        ground.name = 'landscape';
        this.add(ground);

        // --- Launch pad (center) ---
        const pad = createLaunchPad({
            radius: 8,
            height: 0.2
        });
        pad.position.set(0, 0.01, 0);
        this.add(pad);

        // --- Props (rocks, trees) scattered away from pad radius ---
        const { rocks, trees } = createProps({
            areaSize: 100,
            avoidRadius: 14,
            rockCount: 180,
            treeCount: 120
        });
        this.add(rocks);
        this.add(trees);

        // --- Lighting (daylight-ish) ---
        const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 0.8);
        hemi.position.set(0, 30, 0);
        this.add(hemi);

        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(-40, 60, -25);
        sun.castShadow = false;
        this.add(sun);

        // --- Skydome ---
        const sky = createSkyDome();
        this.add(sky);
    }
}
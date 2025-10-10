import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createMoonLandscape } from '../objects/MoonLandscape.js';
import { createSpaceSky } from '../objects/SpaceSky.js';

export class Scene extends THREE.Scene {
    constructor() {
        super();
        this.background = new THREE.Color(0x000000);
        const landscape = createMoonLandscape();
        landscape.name = 'landscape'; 
        this.add(landscape);
        const sky = createSpaceSky();
        this.add(sky);

        // --- Increase Light Intensity ---
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemiLight.position.set(0, 20, 0);
        hemiLight.intensity = 1.5; // Boost ambient light
        this.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(-3, 10, -10);
        dirLight.intensity = 4.0; // Significantly boost the "sun"
        this.add(dirLight);
    }
}

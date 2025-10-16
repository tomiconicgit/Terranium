// src/Main.js

// Import the core of the 3D engine
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

// Import game components
import { createTerrain } from './scene/Terrain.js';
import { createSkyDome } from './scene/SkyDome.js';
import { createLighting } from './scene/Lighting.js';
import { createCamera } from './scene/Camera.js';
import { TouchPad } from './controls/TouchPad.js';

export class Main {
    constructor(debuggerInstance) {
        this.debugger = debuggerInstance;
        this.canvas = document.getElementById('game-canvas');
        this.clock = new THREE.Clock();
        
        this.init();
    }

    // Static method for the loader to grab the asset list
    static getManifest() {
        return [
            { name: 'Debugger Systems', path: './Debugger.js' },
            { name: 'Core Engine (Three.js)', path: 'three.module.js' },
            { name: 'World Terrain', path: './scene/Terrain.js' },
            { name: 'Atmosphere & Sky', path: './scene/SkyDome.js' },
            { name: 'Lighting Engine', path: './scene/Lighting.js' },
            { name: 'Player Camera', path: './scene/Camera.js' },
            { name: 'Control Systems', path: './controls/TouchPad.js' },
            { name: 'Finalizing...', path: '...' },
        ];
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true; // Enable shadows

        // Camera
        this.camera = createCamera();
        this.scene.add(this.camera);

        // Lighting
        const { ambientLight, sunLight } = createLighting();
        this.scene.add(ambientLight);
        this.scene.add(sunLight);
        this.scene.add(sunLight.target);

        // Scenery
        const terrain = createTerrain();
        const skyDome = createSkyDome();
        this.scene.add(terrain);
        this.scene.add(skyDome);

        // Controls
        this.controls = new TouchPad();
        this.playerVelocity = new THREE.Vector3();
        this.lookSpeed = 0.002;

        // Handle window resizing
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // For performance monitoring
        this.frameCount = 0;
        setInterval(() => {
            if (this.frameCount < 30) {
                this.debugger.warn(`Low framerate detected: ${this.frameCount} FPS`, 'Performance');
            }
            this.frameCount = 0;
        }, 1000);
    }

    start() {
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updatePlayer(deltaTime) {
        // Update player movement based on joystick input
        const moveSpeed = 5.0 * deltaTime;
        const moveVector = this.controls.moveVector;

        // Corrected Movement Logic:
        // Forward/backward movement (Y-axis of joystick controls Z-axis of camera)
        this.playerVelocity.z = moveVector.y * moveSpeed;
        
        // Strafe left/right (X-axis of joystick controls X-axis of camera)
        this.playerVelocity.x = moveVector.x * moveSpeed;

        this.camera.translateX(this.playerVelocity.x);
        this.camera.translateZ(this.playerVelocity.z);

        // Update camera rotation based on touch look input
        const lookVector = this.controls.lookVector;
        if (lookVector.length() > 0) {
            this.camera.rotation.y -= lookVector.x * this.lookSpeed;
            this.camera.rotation.x -= lookVector.y * this.lookSpeed;
            // Clamp vertical rotation to prevent flipping
            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            this.controls.lookVector.set(0, 0); // Reset after applying
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        
        this.updatePlayer(deltaTime);

        this.renderer.render(this.scene, this.camera);
        this.frameCount++;
    }
}

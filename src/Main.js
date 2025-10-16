// src/Main.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
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
        this.renderer.shadowMap.enabled = true;

        // Camera
        this.camera = createCamera();
        this.camera.rotation.order = 'YXZ'; // Essential for FPS controls
        this.scene.add(this.camera);

        // Lighting
        const { ambientLight, sunLight } = createLighting();
        this.scene.add(ambientLight);
        this.scene.add(sunLight);
        this.scene.add(sunLight.target);

        // Scenery
        this.terrain = createTerrain(); // Store terrain for raycasting
        const skyDome = createSkyDome();
        this.scene.add(this.terrain);
        this.scene.add(skyDome);

        // Controls
        this.controls = new TouchPad();
        this.playerVelocity = new THREE.Vector3();
        this.lookSpeed = 0.002;
        this.playerHeight = 2.0; // Eye-level height above the ground

        // Raycaster for terrain collision
        this.raycaster = new THREE.Raycaster();
        this.rayDirection = new THREE.Vector3(0, -1, 0);

        // Handle window resizing
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Performance monitoring
        this.frameCount = 0;
        setInterval(() => {
            if (this.frameCount > 0 && this.frameCount < 30) {
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
        const moveSpeed = 5.0 * deltaTime;
        const moveVector = this.controls.moveVector;
        const lookVector = this.controls.lookVector;

        // --- 1. Update Camera Rotation (Look) ---
        if (lookVector.length() > 0) {
            // Horizontal rotation (turning left/right)
            this.camera.rotation.y -= lookVector.x * this.lookSpeed;
            
            // Vertical rotation (looking up/down)
            this.camera.rotation.x -= lookVector.y * this.lookSpeed;
            
            // Clamp vertical rotation to prevent flipping over
            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            
            this.controls.lookVector.set(0, 0); // Reset after applying
        }

        // --- 2. Update Camera Position (Move) ---
        this.playerVelocity.z = moveVector.y * moveSpeed;
        this.playerVelocity.x = moveVector.x * moveSpeed;

        this.camera.translateX(this.playerVelocity.x);
        this.camera.translateZ(this.playerVelocity.z);

        // --- 3. Apply Terrain Following (Collision) ---
        const rayOrigin = new THREE.Vector3(this.camera.position.x, 50, this.camera.position.z);
        this.raycaster.set(rayOrigin, this.rayDirection);
        
        // Find intersections with named terrain objects
        const terrainMeshes = this.terrain.children.filter(c => c.name === "sand_terrain" || c.geometry.type === "PlaneGeometry");
        const intersects = this.raycaster.intersectObjects(terrainMeshes);

        if (intersects.length > 0) {
            // Set the camera's height to be the intersection point plus the player's height
            this.camera.position.y = intersects[0].point.y + this.playerHeight;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        
        // Only update if there is time elapsed to prevent errors
        if (deltaTime > 0) {
            this.updatePlayer(deltaTime);
        }

        this.renderer.render(this.scene, this.camera);
        this.frameCount++;
    }
}

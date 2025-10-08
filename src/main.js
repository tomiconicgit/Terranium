// src/main.js: Orchestrates modules, sets up PWA manifest, initializes scene

import { createScene } from './scene.js';
import { createCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createTerrain } from './objects/terrain.js';
import { createMoon } from './objects/moon.js';
import { createSky } from './objects/sky.js';
import { loadEnvironment } from './objects/environment.js';
import { createLights } from './objects/lights.js';

// PWA manifest setup (dynamic for flexibility)
const manifest = {
    name: 'Terranium',
    short_name: 'Terranium',
    description: 'Lunar sci-fi game',
    start_url: '/',
    display: 'fullscreen',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
};
const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(manifestBlob);
document.querySelector('link[rel="manifest"]').href = manifestURL;

// Note: Add service worker registration here if confirmed.

// Init Three.js
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer(canvas);

const terrain = createTerrain();
const moon = createMoon();
const sky = createSky();

scene.add(terrain);
scene.add(moon);
scene.add(sky);

const lights = createLights();
lights.forEach(light => scene.add(light));

loadEnvironment(scene, renderer);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    // Add rotations/updates if confirmed
    renderer.render(scene, camera);
}
animate();

// Resize handler for mobile
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
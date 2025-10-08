// src/main.js: Orchestrates modules, sets up PWA manifest, initializes scene

import { createScene } from './scene.js';
import { createCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createTerrain } from './objects/terrain.js';
import { createMoon } from './objects/moon.js';
import { createSky } from './objects/sky.js';

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

// Add lights for Phong material
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// First-person camera controls (look around only)
let yaw = 0;
let pitch = 0;
let isMouseDown = false;
let prevTouchX = 0;
let prevTouchY = 0;

function updateCamera() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

updateCamera(); // Initial orientation

// Mouse controls (drag to look)
document.addEventListener('mousedown', () => { isMouseDown = true; });
document.addEventListener('mouseup', () => { isMouseDown = false; });
document.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
        updateCamera();
    }
});

// Touch controls (swipe to look)
document.addEventListener('touchstart', (e) => {
    prevTouchX = e.touches[0].clientX;
    prevTouchY = e.touches[0].clientY;
});
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const deltaX = e.touches[0].clientX - prevTouchX;
    const deltaY = e.touches[0].clientY - prevTouchY;
    yaw -= deltaX * 0.01;
    pitch -= deltaY * 0.01;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    updateCamera();
    prevTouchX = e.touches[0].clientX;
    prevTouchY = e.touches[0].clientY;
});

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
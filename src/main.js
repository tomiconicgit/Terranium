// src/main.js — no moon/environment deps

import { createScene } from './scene.js';
import { createCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createTerrain } from './objects/terrain.js';
import { applySky } from './objects/sky.js';
import { createLights } from './objects/lights.js';

// Dynamic manifest
const manifest = {
  name: 'Terranium',
  short_name: 'Terranium',
  description: 'Lunar sci-fi game',
  start_url: './',
  display: 'fullscreen',
  background_color: '#000000',
  theme_color: '#000000',
  orientation: 'portrait',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png' }
  ]
};
const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(manifestBlob);
const link = document.querySelector('link[rel="manifest"]');
if (link) link.href = manifestURL;

// Canvas + core
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer(canvas);

// World
const terrain = createTerrain();
scene.add(terrain);

// Sky (sets scene.background/environment)
applySky(scene);

// Lights
const lights = createLights();
lights.forEach(l => scene.add(l));

// Loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
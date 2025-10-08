// src/main.js
import { createScene } from './scene.js';
import { createCamera } from './camera.js';
import { createRenderer } from './renderer.js';
import { createTerrain } from './objects/terrain.js';
import { createMoon } from './objects/moon.js';
import { applySky } from './objects/sky.js';
import { loadEnvironment } from './objects/environment.js';
import { createLights } from './objects/lights.js';

// Dynamic manifest (works on GitHub Pages too)
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

// Init Three.js
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer(canvas);

// Objects
const terrain = createTerrain();
const moon = createMoon();
scene.add(terrain);
scene.add(moon);

// Sky (sets scene background/environment; do NOT add to scene)
applySky(scene);

// Lights
const lights = createLights();
lights.forEach(l => scene.add(l));

// Optional: environment preloads
loadEnvironment?.(scene, renderer);

// Animate
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
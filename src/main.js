import * as THREE from 'three';

import { createSky } from './sky.js';
import { Controls } from './controls.js';
import { DesertTerrain } from './desert.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 300);

const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 10, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const manager = new THREE.LoadingManager();
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${Math.floor((itemsLoaded / itemsTotal) * 100)}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
  animate();
};

// Sky (kept)
const moonSky = createSky(scene, renderer);

// Desert terrain (50x50), moon-white; no cacti/buildings
const desert = new DesertTerrain(scene, { width: 50, length: 50 });
const terrain = desert.generateTerrain(); // returns the mesh

// Controls (mobile + PC); keep as-is
const controls = new Controls(camera, renderer.domElement, terrain);
controls.pitch = -0.35;
controls.yaw = 0.0;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (moonSky && moonSky.update) moonSky.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
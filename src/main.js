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

// Hide loading label immediately (no async loads now)
const loadingEl = document.getElementById('loading');
if (loadingEl) loadingEl.style.display = 'none';

// Sky
const moonSky = createSky(scene, renderer);

// Desert terrain (50x50), moon-white
const desert = new DesertTerrain(scene, { width: 50, length: 50 });
const terrain = desert.generateTerrain();

// Controls (mobile + PC)
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
animate(); // <-- start immediately

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
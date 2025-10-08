import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 300);

// Wider FOV for a more open feel
const camera = new THREE.PerspectiveCamera(
  85, // was 75
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
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
  const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${progress}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
  animate();
};

// Terrain
const terrain = createTerrain(manager);
scene.add(terrain);

// Sky & sun
createSky(scene);

// Controls (now with visual joystick)
const controls = new Controls(camera, renderer.domElement, terrain);
controls.pitch = -0.35;
controls.yaw = 0.0;

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
// iOS sometimes fires orientationchange without proper resize; force one.
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
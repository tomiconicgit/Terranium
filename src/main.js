import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Start above ground, looking at the terrain
camera.position.set(0, 6, 16);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
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

// Visual reference grid on ground (helps confirm terrain is visible)
scene.add(new THREE.GridHelper(60, 60, 0x555555, 0x222222));

// Controls
const controls = new Controls(camera, renderer.domElement, terrain);
// Prime internal angles to match the initial look direction (~20° down)
controls.pitch = -0.35; // down a bit
controls.yaw = 0.0;

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
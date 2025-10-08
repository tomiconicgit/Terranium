import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 300);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Start above ground, looking at the terrain
camera.position.set(0, 10, 30);
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

// Grid (slightly above y=0 to avoid z-fighting with terrain flats)
const grid = new THREE.GridHelper(400, 80, 0x555555, 0x222222);
grid.position.y = 0.02;
scene.add(grid);

// Controls
const controls = new Controls(camera, renderer.domElement, terrain);
// Prime internal angles to match the initial look direction (~15–20° down)
controls.pitch = -0.35;
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
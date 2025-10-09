import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 300);

const camera = new THREE.PerspectiveCamera(
  85,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 10, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Keep renderer exposure neutral so sky and terrain are controlled separately
renderer.toneMappingExposure = 1.0;

document.body.appendChild(renderer.domElement);

// --------------------
// Ambient looped sound
// --------------------
const listener = new THREE.AudioListener();
camera.add(listener);

const ambientSound = new THREE.Audio(listener);
const manager = new THREE.LoadingManager(); // also used for textures below

const audioLoader = new THREE.AudioLoader(manager);
audioLoader.load(
  'src/assets/sounds/planetsound.wav',
  (buffer) => {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(0.35); // tweak to taste
    // Autoplay requires a user gesture — we hook that below
  },
  undefined,
  () => console.warn('Could not load planetsound.wav')
);

// Unlock & start on first user interaction
function startAmbientAudio() {
  // resume context if needed
  if (listener.context && listener.context.state === 'suspended') {
    listener.context.resume();
  }
  if (ambientSound.buffer && !ambientSound.isPlaying) {
    ambientSound.play();
  }
  window.removeEventListener('pointerdown', startAmbientAudio);
  window.removeEventListener('keydown', startAmbientAudio);
}
window.addEventListener('pointerdown', startAmbientAudio, { passive: true });
window.addEventListener('keydown', startAmbientAudio);

// Loading UX
manager.onProgress = (url, loaded, total) => {
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${Math.floor((loaded / total) * 100)}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
  animate();
};

// Terrain (mesh + material)
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);

// SKY — pure visual, per the example. It does NOT create or drive lights.
const skyAPI = createSky(scene, renderer);

// ------------------------------
// Terrain lighting (standalone)
// ------------------------------
// Directional light (the "sun" for terrain); independent of the sky.
const sunLight = new THREE.DirectionalLight(0xffffff, 4.5); // your preferred intensity
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 1500;
sunLight.shadow.camera.left = -400;
sunLight.shadow.camera.right = 400;
sunLight.shadow.camera.top = 400;
sunLight.shadow.camera.bottom = -400;

// Aim from a nice angle; adjust independently of sky
// (Matches ~elevation 16.5°, azimuth 360° visually, but not linked.)
const dist = 1000;
const elevRad = THREE.MathUtils.degToRad(90 - 16.5);
const azimRad = THREE.MathUtils.degToRad(360);
const dir = new THREE.Vector3().setFromSphericalCoords(1, elevRad, azimRad);
sunLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
sunLight.target.position.set(0, 0, 0);
sunLight.target.updateMatrixWorld();
scene.add(sunLight);
scene.add(sunLight.target);

// Soft ambient to lift shadows a bit
const ambient = new THREE.AmbientLight(0xffffff, 0.57);
scene.add(ambient);

// Controls
const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

// Tick
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  skyAPI.update(dt); // (no-op now, but fine to keep)
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
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

/* --------------------------
   Tuner UI (minimal wiring)
   -------------------------- */
// If you still want to tweak the sky visually via your sliders,
// keep only these calls (they won’t touch terrain lighting).
const defaults = {
  turbidity: 0.0,
  rayleigh: 0.08,
  mieCoefficient: 0.047,
  mieDirectionalG: 0.01,
  elevation: 16.5,
  azimuth: 360,

  // Terrain material controls you already used:
  terrainDisplacement: 0.55,
  terrainRoughness: 1.0,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0.0
};

const state = { ...defaults };
applyAll();

function applyAll() {
  // Sky visuals only
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);

  // Terrain material knobs
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  if (terrainAPI.setSaturation) terrainAPI.setSaturation(state.terrainSaturation);
}

// Keep your existing panel (if any) or wire new sliders the same way as before.
// The key point: there is no call here that uses the sky to change terrain lights.
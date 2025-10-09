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
document.body.appendChild(renderer.domElement);

// --------------------
// Loading UX
// --------------------
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${Math.floor((loaded / Math.max(1,total)) * 100)}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
};

// --------------------
// Terrain & Sky
// --------------------
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);

const skyAPI = createSky(scene, renderer); // visual sky only (no lighting)

// --------------------
// Terrain lighting (independent from sky)
// --------------------
const sunDir = new THREE.DirectionalLight(0xffffff, 1.5);
sunDir.castShadow = true;
sunDir.shadow.mapSize.set(1024, 1024);
sunDir.shadow.camera.near = 1;
sunDir.shadow.camera.far = 1500;
sunDir.shadow.camera.left = -400;
sunDir.shadow.camera.right = 400;
sunDir.shadow.camera.top = 400;
sunDir.shadow.camera.bottom = -400;
sunDir.position.set(200, 400, 120);
scene.add(sunDir);

const ambient = new THREE.AmbientLight(0x223344, 0.25);
scene.add(ambient);

// --------------------
// Ambient looped sound (separate loader, so it can't block the manager)
// --------------------
const listener = new THREE.AudioListener();
camera.add(listener);

const ambientSound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader(); // separate from the manager
audioLoader.load(
  'assets/sounds/planetsound.wav', // adjust if your file lives elsewhere
  (buffer) => {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(0.35);
    // Autoplay policy might block; user gesture will start it in many cases.
    try { ambientSound.play(); } catch {}
  },
  undefined,
  (err) => { console.warn('Could not load planetsound.wav', err); }
);

// --------------------
// Controls
// --------------------
const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

// --------------------
// Tick
// --------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  skyAPI.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
// Start immediately (do NOT wait for manager.onLoad)
animate();

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
   Tuner UI
   -------------------------- */
// Your latest preset (and a couple of extras)
const defaults = {
  turbidity: 0,
  rayleigh: 0.08,
  mieCoefficient: 0.047,
  mieDirectionalG: 0.01,
  elevation: 16.5,
  azimuth: 360,

  skyExposure: 2.5,          // affects sky only (via shader uniform)
  skySunSize: 35,            // apparent disc size (sprite size in world units)
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Terrain lighting exposure scaler (multiplies real lights)
  lightingExposure: 3.0,

  // Global exposure (tone mapping) – affects terrain only; sky is toneMapped = false
  exposure: 2.48,

  // Terrain params
  terrainDisplacement: 0.55,
  terrainRoughness: 1,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0.0,     // 0 = gray, 1 = original

  // Informational mirrors
  exposureGlobal: 2.48,
  sunIntensity: 4.5,
  ambientIntensity: 0.57,
  envLightColor: '#ffffff'
};

const state = { ...defaults };
applyAll();

// Panel build (kept simple here; if you already inject elsewhere, feel free to merge)
const panel = document.getElementById('tunePanel');
panel.style.display = 'block'; // open by default
panel.setAttribute('aria-hidden', 'false');

// helper to make a slider + number
function row(label, id, min, max, step, value) {
  return `
    <div class="row">
      <label for="${id}">${label}</label>
      <div style="display:flex; gap:6px; align-items:center">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        <input id="${id}Num" type="number" min="${min}" max="${max}" step="${step}" value="${value}" style="width:90px">
      </div>
    </div>
  `;
}

panel.innerHTML = `
  <header><h3>Sky & Terrain Tuner</h3></header>

  <div class="section">Sky (three.js Sky)</div>
  <div class="grid">
    ${row('Turbidity', 'turbidity', 0, 20, 0.01, state.turbidity)}
    ${row('Rayleigh', 'rayleigh', 0, 4, 0.001, state.rayleigh)}
    ${row('Mie Coefficient', 'mieCoefficient', 0, 0.1, 0.001, state.mieCoefficient)}
    ${row('Mie Directional G', 'mieDirectionalG', 0, 1, 0.001, state.mieDirectionalG)}
    ${row('Elevation (°)', 'elevation', -5, 89, 0.1, state.elevation)}
    ${row('Azimuth (°)', 'azimuth', 0, 360, 0.1, state.azimuth)}
    ${row('Sky Exposure', 'skyExposure', 0.0, 5.0, 0.01, state.skyExposure)}
    ${row('Sun Disc Size', 'skySunSize', 1, 200, 1, state.skySunSize)}
  </div>

  <div class="section">Stars</div>
  <div class="grid">
    ${row('Star Count', 'starCount', 0, 15000, 100, state.starCount)}
    ${row('Star Size (px)', 'starSize', 0.5, 6, 0.1, state.starSize)}
    ${row('Twinkle Speed', 'starTwinkleSpeed', 0, 4, 0.01, state.starTwinkleSpeed)}
  </div>

  <div class="section">Terrain Lighting & Exposure</div>
  <div class="grid">
    ${row('Terrain Light Exposure', 'lightingExposure', 0.2, 5.0, 0.01, state.lightingExposure)}
    ${row('Global Exposure (tone map)', 'exposure', 0.1, 5, 0.01, state.exposure)}
  </div>

  <div class="section">Terrain Material</div>
  <div class="grid">
    ${row('Displacement', 'terrainDisplacement', 0, 3, 0.01, state.terrainDisplacement)}
    ${row('Roughness', 'terrainRoughness', 0, 1, 0.01, state.terrainRoughness)}
    ${row('Texture Repeat', 'terrainRepeat', 4, 200, 1, state.terrainRepeat)}
    <div class="row"><label>Sand Tint</label><input id="terrainTint" type="color" value="${state.terrainTint}"></div>
    ${row('Saturation', 'terrainSaturation', 0, 1.5, 0.01, state.terrainSaturation)}
  </div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

function bindPair(id, onChange) {
  const range = document.getElementById(id);
  const num = document.getElementById(id + 'Num');
  if (!range) return;

  const sync = (v) => {
    if (num) num.value = String(v);
    range.value = String(v);
  };
  const handler = (v) => { sync(v); onChange(v); };

  range.addEventListener('input', () => handler(Number(range.value)), { passive: true });
  range.addEventListener('change', () => handler(Number(range.value)), { passive: true });
  if (num) {
    num.addEventListener('input', () => handler(Number(num.value)), { passive: true });
    num.addEventListener('change', () => handler(Number(num.value)), { passive: true });
  }
}
function bindColor(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => onChange(el.value), { passive: true });
  el.addEventListener('change', () => onChange(el.value), { passive: true });
}

// Sky
bindPair('turbidity', v => { state.turbidity = v; skyAPI.setTurbidity(v); });
bindPair('rayleigh', v => { state.rayleigh = v; skyAPI.setRayleigh(v); });
bindPair('mieCoefficient', v => { state.mieCoefficient = v; skyAPI.setMieCoefficient(v); });
bindPair('mieDirectionalG', v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
bindPair('elevation', v => { state.elevation = v; skyAPI.setElevation(v); });
bindPair('azimuth', v => { state.azimuth = v; skyAPI.setAzimuth(v); });
bindPair('skyExposure', v => { state.skyExposure = v; skyAPI.setSkyExposure(v); });
bindPair('skySunSize', v => { state.skySunSize = v; skyAPI.setSunSize(v); });

// Stars
bindPair('starCount', v => { state.starCount = v; skyAPI.setStarCount(v); });
bindPair('starSize', v => { state.starSize = v; skyAPI.setStarSize(v); });
bindPair('starTwinkleSpeed', v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

// Terrain lighting / exposure
bindPair('lightingExposure', v => {
  state.lightingExposure = v;
  const baseSun = 1.5, baseAmb = 0.25;
  sunDir.intensity = baseSun * v;
  ambient.intensity = baseAmb * Math.pow(v, 0.75);
});
bindPair('exposure', v => {
  state.exposure = v;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = v; // affects terrain; sky is toneMapped=false
});

// Terrain material
bindPair('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bindPair('terrainRoughness', v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
bindPair('terrainRepeat', v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
bindColor('terrainTint', v => { state.terrainTint = v; terrainAPI.setTintColor(v); });
bindPair('terrainSaturation', v => { state.terrainSaturation = v; terrainAPI.setSaturation(v); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    ...state,
    ...skyAPI._getCurrent(),
    ...terrainAPI._getCurrent()
  };
  const text = JSON.stringify(snapshot, null, 2);
  try { await navigator.clipboard.writeText(text); toast('Parameters copied to clipboard.'); }
  catch { prompt('Copy parameters:', text); }
});

function toast(msg) {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `
    position:fixed;left:50%;transform:translateX(-50%);
    bottom:calc(80px + var(--safe-bottom));z-index:200;
    background:rgba(20,22,26,.9);color:#fff;border:1px solid rgba(255,255,255,.2);
    padding:10px 12px;border-radius:12px;font-weight:600;
    box-shadow:0 10px 24px rgba(0,0,0,.4)
  `;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1500);
}

function applyAll() {
  // Sky
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);
  skyAPI.setSkyExposure(state.skyExposure);
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);
  skyAPI.setSunSize(state.skySunSize);

  // Terrain lighting / exposure
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = state.exposure;
  const baseSun = 1.5, baseAmb = 0.25;
  sunDir.intensity = baseSun * state.lightingExposure;
  ambient.intensity = baseAmb * Math.pow(state.lightingExposure, 0.75);

  // Terrain material
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  if (terrainAPI.setSaturation) terrainAPI.setSaturation(state.terrainSaturation);
}
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

// Loading UX
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${Math.floor((loaded / total) * 100)}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
  animate();
};

// Terrain & Sky
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);
const skyAPI = createSky(scene, renderer);

// Controls
const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

// Tick
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (skyAPI.update) skyAPI.update(dt);
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
   Tuner UI
   -------------------------- */
// Use your latest preset values as defaults
const defaults = {
  turbidity: 0,
  rayleigh: 0.08,
  mieCoefficient: 0.047,
  mieDirectionalG: 0.01,
  elevation: 16.5,
  azimuth: 360,
  skyExposure: 2.5,
  lightingExposure: 3,
  exposure: 2.48, // global tone-map (if you still expose it)
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,
  terrainDisplacement: 0.55,
  terrainRoughness: 1,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0,
  blendHeightMin: 0,
  blendHeightMax: 12,
  blendSlopeBias: 1,
  wLow: 1,
  wHigh: 0.7,
  wSlope: 0.8,
  exposureGlobal: 2.48,
  sunIntensity: 4.5,
  ambientIntensity: 0.5698767642386944,
  envLightColor: '#ffffff'
};

const state = { ...defaults };
applyAll();

/* ---------- helpers to apply state ---------- */
function applyAll() {
  // Sky
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);

  // Exposures
  if (skyAPI.setSkyExposure) skyAPI.setSkyExposure(state.skyExposure);
  if (skyAPI.setLightingExposure) skyAPI.setLightingExposure(state.lightingExposure);
  if (skyAPI.setExposureGlobal) skyAPI.setExposureGlobal(state.exposure);

  // Stars
  if (skyAPI.setStarCount) skyAPI.setStarCount(state.starCount);
  if (skyAPI.setStarSize) skyAPI.setStarSize(state.starSize);
  if (skyAPI.setStarTwinkleSpeed) skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  if (terrainAPI.setSaturation) terrainAPI.setSaturation(state.terrainSaturation);

  // placeholders (no-ops if not implemented)
  if (terrainAPI.setHeightRange) terrainAPI.setHeightRange(state.blendHeightMin, state.blendHeightMax);
  if (terrainAPI.setSlopeBias) terrainAPI.setSlopeBias(state.blendSlopeBias);
  if (terrainAPI.setWeights) terrainAPI.setWeights(state.wLow, state.wHigh, state.wSlope);
}

/* ---------- UI builder with range + number pair ---------- */
function row(label, id, min, max, step, value) {
  const s = step === undefined ? 'any' : step;
  // number input has its own id with "Num" suffix
  return `
    <div class="row">
      <label for="${id}">${label}</label>
      <div class="pair">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${s}" value="${value}">
        <input id="${id}Num" type="number" min="${min}" max="${max}" step="${s}" value="${value}">
      </div>
    </div>
  `;
}

function wirePair(id, onChange) {
  const rng = document.getElementById(id);
  const num = document.getElementById(id + 'Num');
  if (!rng || !num) return;

  const clamp = (v) => {
    const min = parseFloat(rng.min);
    const max = parseFloat(rng.max);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  };

  // Sync both ways; accept precise decimals from number box.
  const fromRange = () => {
    const v = clamp(parseFloat(rng.value));
    num.value = String(v);
    onChange(v);
  };
  const fromNumber = () => {
    const v = clamp(parseFloat(num.value));
    rng.value = String(v);
    onChange(v);
  };

  // Input for live updates; change as fallback
  rng.addEventListener('input', fromRange, { passive: true });
  rng.addEventListener('change', fromRange, { passive: true });
  num.addEventListener('input', fromNumber, { passive: true });
  num.addEventListener('change', fromNumber, { passive: true });
}

/* ---------- Build panel ---------- */
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Sky & Terrain Tuner</h3></header>

  <div class="section">Sky (three.js Sky)</div>
  <div class="grid">
    ${row('Turbidity', 'turbidity', 0, 20, 0.0001, state.turbidity)}
    ${row('Rayleigh', 'rayleigh', 0, 4, 0.0001, state.rayleigh)}
    ${row('Mie Coefficient', 'mieCoefficient', 0, 0.2, 0.0001, state.mieCoefficient)}
    ${row('Mie Directional G', 'mieDirectionalG', 0, 1, 0.0001, state.mieDirectionalG)}
    ${row('Elevation (°)', 'elevation', -5, 89, 0.0001, state.elevation)}
    ${row('Azimuth (°)', 'azimuth', 0, 360, 0.0001, state.azimuth)}

    ${row('Sky Exposure', 'skyExposure', 0.0, 3.0, 0.0001, state.skyExposure)}
    ${row('Terrain Light Exposure', 'lightingExposure', 0.2, 5.0, 0.0001, state.lightingExposure)}
    ${row('Global Exposure', 'exposure', 0.1, 5.0, 0.0001, state.exposure)}
  </div>

  <div class="section">Stars</div>
  <div class="grid">
    ${row('Star Count', 'starCount', 0, 15000, 1, state.starCount)}
    ${row('Star Size (px)', 'starSize', 0.5, 8, 0.0001, state.starSize)}
    ${row('Twinkle Speed', 'starTwinkleSpeed', 0, 5, 0.0001, state.starTwinkleSpeed)}
  </div>

  <div class="section">Terrain</div>
  <div class="grid">
    ${row('Displacement', 'terrainDisplacement', 0, 3, 0.0001, state.terrainDisplacement)}
    ${row('Roughness', 'terrainRoughness', 0, 1, 0.0001, state.terrainRoughness)}
    ${row('Texture Repeat', 'terrainRepeat', 4, 200, 1, state.terrainRepeat)}
    <div class="row"><label>Sand Tint</label>
      <div class="pair">
        <input id="terrainTint" type="color" value="${state.terrainTint}">
      </div>
    </div>
    ${row('Saturation', 'terrainSaturation', 0, 1.5, 0.0001, state.terrainSaturation)}
  </div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

/* ---------- Wire inputs ---------- */
function bindPair(id, onChange) { wirePair(id, onChange); }
function bindColor(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => onChange(el.value);
  el.addEventListener('input', handler, { passive: true });
  el.addEventListener('change', handler, { passive: true });
}

// Sky binds
bindPair('turbidity', v => { state.turbidity = v; skyAPI.setTurbidity(v); });
bindPair('rayleigh', v => { state.rayleigh = v; skyAPI.setRayleigh(v); });
bindPair('mieCoefficient', v => { state.mieCoefficient = v; skyAPI.setMieCoefficient(v); });
bindPair('mieDirectionalG', v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
bindPair('elevation', v => { state.elevation = v; skyAPI.setElevation(v); });
bindPair('azimuth', v => { state.azimuth = v; skyAPI.setAzimuth(v); });

bindPair('skyExposure', v => { state.skyExposure = v; if (skyAPI.setSkyExposure) skyAPI.setSkyExposure(v); });
bindPair('lightingExposure', v => { state.lightingExposure = v; if (skyAPI.setLightingExposure) skyAPI.setLightingExposure(v); });
bindPair('exposure', v => { state.exposure = v; if (skyAPI.setExposureGlobal) skyAPI.setExposureGlobal(v); });

// Stars binds
bindPair('starCount', v => { state.starCount = v; if (skyAPI.setStarCount) skyAPI.setStarCount(v); });
bindPair('starSize', v => { state.starSize = v; if (skyAPI.setStarSize) skyAPI.setStarSize(v); });
bindPair('starTwinkleSpeed', v => { state.starTwinkleSpeed = v; if (skyAPI.setStarTwinkleSpeed) skyAPI.setStarTwinkleSpeed(v); });

// Terrain binds
bindPair('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bindPair('terrainRoughness', v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
bindPair('terrainRepeat', v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
bindColor('terrainTint', v => { state.terrainTint = v; terrainAPI.setTintColor(v); });
bindPair('terrainSaturation', v => { state.terrainSaturation = v; if (terrainAPI.setSaturation) terrainAPI.setSaturation(v); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = { ...state, ...(skyAPI._getCurrent ? skyAPI._getCurrent() : {}), ...terrainAPI._getCurrent() };
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

// Toggle panel (closed by default)
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
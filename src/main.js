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
  skyAPI.update(dt);
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
const defaults = {
  // Sky (official example controls)
  turbidity: 2.0,
  rayleigh: 1.2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  elevation: 6.0,
  azimuth: 180.0,
  exposure: 1.0,

  // Stars
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Terrain
  terrainDisplacement: 0.55,
  terrainRoughness: 1.0,
  terrainRepeat: 48,
  terrainTint: '#ffffff',
  blendHeightMin: 0.0,
  blendHeightMax: 12.0,
  blendSlopeBias: 1.0,
  wLow: 1.0,
  wHigh: 0.7,
  wSlope: 0.8
};

const state = { ...defaults };
applyAll();

function applyAll() {
  // Sky
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);
  skyAPI.setExposure(state.exposure);

  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  terrainAPI.setHeightRange(state.blendHeightMin, state.blendHeightMax);
  terrainAPI.setSlopeBias(state.blendSlopeBias);
  terrainAPI.setWeights(state.wLow, state.wHigh, state.wSlope);
}

// Build panel UI
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Sky & Terrain Tuner</h3></header>

  <div class="section">Sky (three.js Sky)</div>
  <div class="grid">
    <div class="row"><label>Turbidity</label><input id="turbidity" type="range" min="0" max="20" step="0.1" value="${state.turbidity}"></div>
    <div class="row"><label>Rayleigh</label><input id="rayleigh" type="range" min="0" max="4" step="0.01" value="${state.rayleigh}"></div>
    <div class="row"><label>Mie Coefficient</label><input id="mieCoefficient" type="range" min="0" max="0.1" step="0.001" value="${state.mieCoefficient}"></div>
    <div class="row"><label>Mie Directional G</label><input id="mieDirectionalG" type="range" min="0" max="1" step="0.01" value="${state.mieDirectionalG}"></div>
    <div class="row"><label>Elevation (°)</label><input id="elevation" type="range" min="-5" max="89" step="0.1" value="${state.elevation}"></div>
    <div class="row"><label>Azimuth (°)</label><input id="azimuth" type="range" min="0" max="360" step="0.1" value="${state.azimuth}"></div>
    <div class="row"><label>Exposure</label><input id="exposure" type="range" min="0.2" max="3" step="0.01" value="${state.exposure}"></div>
  </div>

  <div class="section">Stars</div>
  <div class="grid">
    <div class="row"><label>Star Count</label><input id="starCount" type="range" min="0" max="15000" step="100" value="${state.starCount}"></div>
    <div class="row"><label>Star Size (px)</label><input id="starSize" type="range" min="0.5" max="6" step="0.1" value="${state.starSize}"></div>
    <div class="row"><label>Twinkle Speed</label><input id="starTwinkleSpeed" type="range" min="0" max="4" step="0.05" value="${state.starTwinkleSpeed}"></div>
  </div>

  <div class="section">Terrain (sandier + blended textures)</div>
  <div class="grid">
    <div class="row"><label>Displacement</label><input id="terrainDisplacement" type="range" min="0" max="3" step="0.01" value="${state.terrainDisplacement}"></div>
    <div class="row"><label>Roughness</label><input id="terrainRoughness" type="range" min="0" max="1" step="0.01" value="${state.terrainRoughness}"></div>
    <div class="row"><label>Texture Repeat</label><input id="terrainRepeat" type="range" min="4" max="200" step="1" value="${state.terrainRepeat}"></div>
    <div class="row"><label>Sand Tint</label><input id="terrainTint" type="color" value="${state.terrainTint}"></div>

    <div class="row"><label>Blend Height Min</label><input id="blendHeightMin" type="range" min="-10" max="30" step="0.1" value="${state.blendHeightMin}"></div>
    <div class="row"><label>Blend Height Max</label><input id="blendHeightMax" type="range" min="-10" max="30" step="0.1" value="${state.blendHeightMax}"></div>
    <div class="row"><label>Slope Bias</label><input id="blendSlopeBias" type="range" min="0.2" max="4" step="0.05" value="${state.blendSlopeBias}"></div>
    <div class="row"><label>Weight Low (sand)</label><input id="wLow" type="range" min="0" max="2" step="0.01" value="${state.wLow}"></div>
    <div class="row"><label>Weight High</label><input id="wHigh" type="range" min="0" max="2" step="0.01" value="${state.wHigh}"></div>
    <div class="row"><label>Weight Slope (rock)</label><input id="wSlope" type="range" min="0" max="2" step="0.01" value="${state.wSlope}"></div>
  </div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

function bind(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => onChange(el.type === 'color' ? el.value : Number(el.value));
  el.addEventListener('input', handler, { passive: true });
  el.addEventListener('change', handler, { passive: true });
}

// Sky binds
bind('turbidity', v => { state.turbidity = v; skyAPI.setTurbidity(v); });
bind('rayleigh', v => { state.rayleigh = v; skyAPI.setRayleigh(v); });
bind('mieCoefficient', v => { state.mieCoefficient = v; skyAPI.setMieCoefficient(v); });
bind('mieDirectionalG', v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
bind('elevation', v => { state.elevation = v; skyAPI.setElevation(v); });
bind('azimuth', v => { state.azimuth = v; skyAPI.setAzimuth(v); });
bind('exposure', v => { state.exposure = v; skyAPI.setExposure(v); });

// Stars binds
bind('starCount', v => { state.starCount = v; skyAPI.setStarCount(v); });
bind('starSize', v => { state.starSize = v; skyAPI.setStarSize(v); });
bind('starTwinkleSpeed', v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

// Terrain binds
bind('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bind('terrainRoughness', v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
bind('terrainRepeat', v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
bind('terrainTint', v => { state.terrainTint = v; terrainAPI.setTintColor(v); });

bind('blendHeightMin', v => { state.blendHeightMin = v; terrainAPI.setHeightRange(state.blendHeightMin, state.blendHeightMax); });
bind('blendHeightMax', v => { state.blendHeightMax = v; terrainAPI.setHeightRange(state.blendHeightMin, state.blendHeightMax); });
bind('blendSlopeBias', v => { state.blendSlopeBias = v; terrainAPI.setSlopeBias(v); });
bind('wLow', v => { state.wLow = v; terrainAPI.setWeights(state.wLow, state.wHigh, state.wSlope); });
bind('wHigh', v => { state.wHigh = v; terrainAPI.setWeights(state.wLow, state.wHigh, state.wSlope); });
bind('wSlope', v => { state.wSlope = v; terrainAPI.setWeights(state.wLow, state.wHigh, state.wSlope); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    ...state,
    ...skyAPI._getCurrent(),
    ...terrainAPI._getCurrent()
  };
  const text = JSON.stringify(snapshot, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('Parameters copied to clipboard.');
  } catch {
    prompt('Copy parameters:', text);
  }
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

// Toggle panel
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
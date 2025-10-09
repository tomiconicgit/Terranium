import * as THREE from 'three';

import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { Controls } from './controls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 80, 300);

const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 10, 30);
camera.lookAt(0, 0, 0);

// ALSO render layer 1 (Earth)
camera.layers.enable(1);

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

// Pass the same LoadingManager into sky so the GLB load is tracked
const skyAPI = createSky(scene, renderer, manager);

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
// Locked-in defaults (kept simple; adjust as you like)
const defaults = {
  // Sky
  turbidity: 0.2,
  rayleigh: 0.0,
  mieCoefficient: 0.036,
  mieDirectionalG: 0.35,
  elevation: 25.4,
  azimuth: 180,

  // Stars
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Terrain
  terrainDisplacement: 0.55,
  terrainRoughness: 1.0,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0.20,

  // Earth
  earthScale: 120,
  earthPosX: 0,
  earthPosY: 80,
  earthPosZ: -220,
  earthBrightness: 1.0
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

  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  if (terrainAPI.setSaturation) terrainAPI.setSaturation(state.terrainSaturation);

  // Earth
  skyAPI.setEarthScale(state.earthScale);
  skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ);
  skyAPI.setEarthBrightness(state.earthBrightness);
}

/* ---------- Build panel UI (hidden until you press TUNE) ---------- */
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Sky / Terrain / Earth</h3></header>

  <div class="section">Sky (three.js Sky)</div>
  <div class="grid" id="skyGrid"></div>

  <div class="section">Stars</div>
  <div class="grid" id="starGrid"></div>

  <div class="section">Terrain</div>
  <div class="grid" id="terrainGrid"></div>

  <div class="section">Earth</div>
  <div class="grid" id="earthGrid"></div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

function addRangeNumberRow(gridId, label, id, min, max, step, value, onChange, isColor=false) {
  const grid = document.getElementById(gridId);
  const rowLabel = document.createElement('div');
  rowLabel.className = 'row';
  rowLabel.innerHTML = `<label for="${id}">${label}</label>`;

  const rowInput = document.createElement('div');
  rowInput.className = 'row';
  if (isColor) {
    rowInput.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center;">
        <input id="${id}" type="color" value="${value}">
      </div>
    `;
  } else {
    rowInput.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center;">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        <input id="${id}Num" type="number" step="any" value="${value}" style="width:90px; padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.06); color:#eaeef5;">
      </div>
    `;
  }

  grid.appendChild(rowLabel);
  grid.appendChild(rowInput);

  if (isColor) {
    document.getElementById(id).addEventListener('input', (e) => onChange(e.target.value), {passive:true});
    document.getElementById(id).addEventListener('change', (e) => onChange(e.target.value), {passive:true});
  } else {
    const rangeEl = document.getElementById(id);
    const numEl = document.getElementById(id + 'Num');
    const sync = (v) => {
      rangeEl.value = String(v);
      numEl.value = String(v);
      onChange(typeof v === 'string' ? Number(v) : v);
    };
    rangeEl.addEventListener('input', () => sync(rangeEl.value), {passive:true});
    numEl.addEventListener('input', () => sync(numEl.value));
    numEl.addEventListener('change', () => sync(numEl.value));
  }
}

/* Sky controls */
addRangeNumberRow('skyGrid', 'Turbidity',       'turbidity',       0,   20,  0.01, state.turbidity,       v => { state.turbidity = v; skyAPI.setTurbidity(v); });
addRangeNumberRow('skyGrid', 'Rayleigh',        'rayleigh',        0,    4,  0.001, state.rayleigh,        v => { state.rayleigh = v; skyAPI.setRayleigh(v); });
addRangeNumberRow('skyGrid', 'Mie Coefficient', 'mieCoefficient',  0,  0.1, 0.0001, state.mieCoefficient,  v => { state.mieCoefficient = v; skyAPI.setMieCoefficient(v); });
addRangeNumberRow('skyGrid', 'Mie DirectionalG','mieDirectionalG', 0,    1,  0.001, state.mieDirectionalG, v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
addRangeNumberRow('skyGrid', 'Elevation (°)',   'elevation',     -5,   89,   0.01, state.elevation,       v => { state.elevation = v; skyAPI.setElevation(v); });
addRangeNumberRow('skyGrid', 'Azimuth (°)',     'azimuth',         0,  360,   0.01, state.azimuth,         v => { state.azimuth = v; skyAPI.setAzimuth(v); });

/* Stars */
addRangeNumberRow('starGrid', 'Star Count',      'starCount',       0, 15000, 100,   state.starCount,      v => { state.starCount = v; skyAPI.setStarCount(v); });
addRangeNumberRow('starGrid', 'Star Size (px)',  'starSize',      0.5,     6,  0.1,  state.starSize,       v => { state.starSize = v; skyAPI.setStarSize(v); });
addRangeNumberRow('starGrid', 'Twinkle Speed',   'starTwinkleSpeed',0,     4,  0.01, state.starTwinkleSpeed, v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

/* Terrain */
addRangeNumberRow('terrainGrid', 'Displacement', 'terrainDisplacement', 0, 3, 0.01, state.terrainDisplacement, v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
addRangeNumberRow('terrainGrid', 'Roughness',    'terrainRoughness',     0, 1, 0.01, state.terrainRoughness,    v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
addRangeNumberRow('terrainGrid', 'Texture Repeat','terrainRepeat',        4,200,   1, state.terrainRepeat,       v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
addRangeNumberRow('terrainGrid', 'Sand Tint',    'terrainTint',           0, 0,    0, state.terrainTint,         v => { state.terrainTint = v; terrainAPI.setTintColor(v); }, true);
addRangeNumberRow('terrainGrid', 'Saturation',   'terrainSaturation',     0,1.5,0.01, state.terrainSaturation,   v => { state.terrainSaturation = v; if (terrainAPI.setSaturation) terrainAPI.setSaturation(v); });

/* Earth */
addRangeNumberRow('earthGrid', 'Earth Scale',    'earthScale',    1, 1500, 1, state.earthScale, v => { state.earthScale = v; skyAPI.setEarthScale(v); });
addRangeNumberRow('earthGrid', 'Earth X',        'earthPosX', -1000,1000, 1, state.earthPosX,   v => { state.earthPosX = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
addRangeNumberRow('earthGrid', 'Earth Y',        'earthPosY', -1000,1000, 1, state.earthPosY,   v => { state.earthPosY = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
addRangeNumberRow('earthGrid', 'Earth Z',        'earthPosZ', -3000,3000, 1, state.earthPosZ,   v => { state.earthPosZ = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
addRangeNumberRow('earthGrid', 'Earth Brightness','earthBrightness', 0, 5, 0.01, state.earthBrightness, v => { state.earthBrightness = v; skyAPI.setEarthBrightness(v); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = { ...state, ...skyAPI._getCurrent?.(), ...terrainAPI._getCurrent?.() };
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

// Toggle panel (closed by default; opens only when TUNE is pressed)
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
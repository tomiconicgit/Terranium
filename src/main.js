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

// If you previously used layer 1 for Earth, keep it enabled
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

// Terrain & Sky (new simple skybox/haze/IBL)
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);

const skyAPI = createSky(scene, renderer);

// Controls
const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

// ---- Ambient loop (environment sound) ----
try {
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const sound = new THREE.Audio(listener);
  const audioLoader = new THREE.AudioLoader(manager);
  audioLoader.load('src/assets/sounds/planetsound.wav', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.35);
    sound.play();
  });
} catch { /* ignore if blocked */ }

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
  // Stars
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Skybox colors
  skyTopColor: '#000000',
  skyBottomColor: '#000000',
  skyContrast: 1.0,

  // Horizon haze (rayleigh-ish)
  hazeColor: '#223366',
  hazeHeight: 40,
  hazeRadius: 220,
  hazeAlpha: 0.75,

  // Environment IBL (the ONLY lighting)
  envTopColor: '#222222',
  envBottomColor: '#000000',
  envShape: 1.0,       // coverage/steepness (higher = more top color)
  envIntensity: 1.8,   // global IBL boost

  // Terrain material tweaks
  terrainDisplacement: 0.55,
  terrainRoughness: 1.0,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0.2,
  terrainExposure: 1.0,      // material.color boost
  terrainEnvMapIntensity: 1.0 // per-material envMapIntensity
};

const state = { ...defaults };
applyAll();

function applyAll() {
  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Skybox
  skyAPI.setSkyTopColor(state.skyTopColor);
  skyAPI.setSkyBottomColor(state.skyBottomColor);
  skyAPI.setSkyContrast(state.skyContrast);

  // Haze
  skyAPI.setHazeColor(state.hazeColor);
  skyAPI.setHazeHeight(state.hazeHeight);
  skyAPI.setHazeRadius(state.hazeRadius);
  skyAPI.setHazeAlpha(state.hazeAlpha);

  // Env light
  skyAPI.setEnvTopColor(state.envTopColor);
  skyAPI.setEnvBottomColor(state.envBottomColor);
  skyAPI.setEnvShape(state.envShape);
  skyAPI.setEnvIntensity(state.envIntensity);

  // Terrain
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  terrainAPI.setSaturation(state.terrainSaturation);
  if (terrainAPI.setExposure) terrainAPI.setExposure(state.terrainExposure);
  if (terrainAPI.material) terrainAPI.material.envMapIntensity = state.terrainEnvMapIntensity;
}

/* ---------- UI (closed by default; opens with TUNE) ---------- */
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Skybox / Haze / Env Light / Terrain</h3></header>

  <div class="section">Skybox</div>
  <div class="grid" id="skyGrid"></div>

  <div class="section">Stars</div>
  <div class="grid" id="starGrid"></div>

  <div class="section">Horizon Haze</div>
  <div class="grid" id="hazeGrid"></div>

  <div class="section">Environment Light (IBL)</div>
  <div class="grid" id="envGrid"></div>

  <div class="section">Terrain</div>
  <div class="grid" id="terrainGrid"></div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

function addRow(gridId, label, id, min, max, step, value, onChange, type='range') {
  const grid = document.getElementById(gridId);
  const rowLabel = document.createElement('div');
  rowLabel.className = 'row';
  rowLabel.innerHTML = `<label for="${id}">${label}</label>`;

  const rowInput = document.createElement('div');
  rowInput.className = 'row';

  if (type === 'color') {
    rowInput.innerHTML = `
      <div class="pair">
        <input id="${id}" type="color" value="${value}">
      </div>
    `;
  } else {
    rowInput.innerHTML = `
      <div class="pair">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        <input id="${id}Num" type="number" step="any" value="${value}">
      </div>
    `;
  }
  grid.appendChild(rowLabel);
  grid.appendChild(rowInput);

  if (type === 'color') {
    const c = document.getElementById(id);
    const fire = () => onChange(c.value);
    c.addEventListener('input', fire, { passive: true });
    c.addEventListener('change', fire, { passive: true });
  } else {
    const r = document.getElementById(id);
    const n = document.getElementById(id + 'Num');
    const sync = (v) => {
      r.value = String(v);
      n.value = String(v);
      onChange(Number(v));
    };
    r.addEventListener('input', () => sync(r.value), { passive: true });
    n.addEventListener('input', () => sync(n.value));
    n.addEventListener('change', () => sync(n.value));
  }
}

/* Skybox */
addRow('skyGrid', 'Top Color',       'skyTopColor',    0,0,0, state.skyTopColor,    v => { state.skyTopColor = v; skyAPI.setSkyTopColor(v); }, 'color');
addRow('skyGrid', 'Bottom Color',    'skyBottomColor', 0,0,0, state.skyBottomColor, v => { state.skyBottomColor = v; skyAPI.setSkyBottomColor(v); }, 'color');
addRow('skyGrid', 'Contrast',        'skyContrast',  0.1, 3, 0.01, state.skyContrast, v => { state.skyContrast = v; skyAPI.setSkyContrast(v); });

/* Stars */
addRow('starGrid', 'Star Count',      'starCount',        0, 15000, 100,  state.starCount,       v => { state.starCount = v; skyAPI.setStarCount(v); });
addRow('starGrid', 'Star Size (px)',  'starSize',       0.5,     6, 0.1,  state.starSize,        v => { state.starSize = v; skyAPI.setStarSize(v); });
addRow('starGrid', 'Twinkle Speed',   'starTwinkleSpeed', 0,     4, 0.01, state.starTwinkleSpeed,v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

/* Horizon Haze */
addRow('hazeGrid', 'Haze Color',  'hazeColor', 0,0,0, state.hazeColor, v => { state.hazeColor = v; skyAPI.setHazeColor(v); }, 'color');
addRow('hazeGrid', 'Height',      'hazeHeight',  2, 400, 1, state.hazeHeight, v => { state.hazeHeight = v; skyAPI.setHazeHeight(v); });
addRow('hazeGrid', 'Radius',      'hazeRadius',  50, 800, 1, state.hazeRadius, v => { state.hazeRadius = v; skyAPI.setHazeRadius(v); });
addRow('hazeGrid', 'Opacity',     'hazeAlpha',    0, 1, 0.01, state.hazeAlpha,  v => { state.hazeAlpha = v; skyAPI.setHazeAlpha(v); });

/* Environment Light (IBL) */
addRow('envGrid',  'Top Color',     'envTopColor',    0,0,0, state.envTopColor,    v => { state.envTopColor = v; skyAPI.setEnvTopColor(v); }, 'color');
addRow('envGrid',  'Bottom Color',  'envBottomColor', 0,0,0, state.envBottomColor, v => { state.envBottomColor = v; skyAPI.setEnvBottomColor(v); }, 'color');
addRow('envGrid',  'Coverage/Shape','envShape',     0.1, 5, 0.01, state.envShape,      v => { state.envShape = v; skyAPI.setEnvShape(v); });
addRow('envGrid',  'Intensity',     'envIntensity',  0, 4, 0.01,  state.envIntensity,  v => {
  state.envIntensity = v;
  skyAPI.setEnvIntensity(v);
  // Also scale terrain's envMap response if present
  if (terrainAPI.material) terrainAPI.material.envMapIntensity = state.terrainEnvMapIntensity * v;
});

/* Terrain */
addRow('terrainGrid', 'Displacement', 'terrainDisplacement', 0, 3, 0.01, state.terrainDisplacement, v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
addRow('terrainGrid', 'Roughness',    'terrainRoughness',     0, 1, 0.01, state.terrainRoughness,    v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
addRow('terrainGrid', 'Texture Repeat','terrainRepeat',        4,200, 1,   state.terrainRepeat,       v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
addRow('terrainGrid', 'Tint',         'terrainTint',           0,0,0,       state.terrainTint,         v => { state.terrainTint = v; terrainAPI.setTintColor(v); }, 'color');
addRow('terrainGrid', 'Saturation',   'terrainSaturation',     0,1.5,0.01,  state.terrainSaturation,   v => { state.terrainSaturation = v; terrainAPI.setSaturation(v); });
addRow('terrainGrid', 'Exposure',     'terrainExposure',       0.1,4,0.01,  state.terrainExposure,     v => { state.terrainExposure = v; terrainAPI.setExposure(v); });
addRow('terrainGrid', 'EnvMap Intensity','terrainEnvMapIntensity', 0,4,0.01, state.terrainEnvMapIntensity, v => {
  state.terrainEnvMapIntensity = v;
  if (terrainAPI.material) terrainAPI.material.envMapIntensity = v * skyAPI.getEnvIntensity();
});

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

// Toggle panel (closed by default)
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
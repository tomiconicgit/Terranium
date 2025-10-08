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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // default “glare”
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Loading status hook ---
const manager = new THREE.LoadingManager();
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const el = document.getElementById('loading');
  if (el) el.innerText = `Loading: ${Math.floor((itemsLoaded / itemsTotal) * 100)}%`;
};
manager.onLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
  animate();
};

// --- Terrain & Sky factories now return APIs ---
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);

const skyAPI = createSky(scene, renderer);

const controls = new Controls(camera, renderer.domElement, terrainAPI.mesh);
controls.pitch = -0.35;
controls.yaw = 0.0;

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
   On-screen tuner UI (mobile-first)
   -------------------------- */
const defaults = {
  envLightColor: '#ffffff',
  sunIntensity: 1.6,
  ambientIntensity: 0.18,

  skyBrightness: 1.0,
  skyTopColor: '#041021',
  skyBottomColor: '#000000',
  exposure: 1.0,           // overall “glare”

  starCount: 10000,
  starSize: 1.5,
  starTwinkleSpeed: 0.8,

  terrainDisplacement: 0.5,
  terrainRoughness: 1.0,
  terrainRepeat: 40,
  terrainTint: '#ffffff'
};

const state = { ...defaults };

function applyAll() {
  // Lighting
  skyAPI.setEnvironmentLightColor(state.envLightColor);
  skyAPI.setSunIntensity(state.sunIntensity);
  skyAPI.setAmbientIntensity(state.ambientIntensity);

  // Sky
  skyAPI.setSkyBrightness(state.skyBrightness);
  skyAPI.setSkyTopColor(state.skyTopColor);
  skyAPI.setSkyBottomColor(state.skyBottomColor);
  skyAPI.setExposure(state.exposure);

  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain (“natural sand” feel)
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
}
applyAll();

// Build panel
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header>
    <h3>Environment Tuner</h3>
  </header>

  <div class="grid">
    <!-- Environment light -->
    <div class="row">
      <label>Env Light Colour</label>
      <input id="envLightColor" type="color" value="${state.envLightColor}">
    </div>
    <div class="row">
      <label>Sun Intensity</label>
      <input id="sunIntensity" type="range" min="0" max="5" step="0.01" value="${state.sunIntensity}">
    </div>
    <div class="row">
      <label>Ambient Intensity</label>
      <input id="ambientIntensity" type="range" min="0" max="2" step="0.01" value="${state.ambientIntensity}">
    </div>

    <!-- Sky -->
    <div class="row">
      <label>Sky Brightness</label>
      <input id="skyBrightness" type="range" min="0" max="3" step="0.01" value="${state.skyBrightness}">
    </div>
    <div class="row">
      <label>Sky Top Colour</label>
      <input id="skyTopColor" type="color" value="${state.skyTopColor}">
    </div>
    <div class="row">
      <label>Sky Bottom Colour</label>
      <input id="skyBottomColor" type="color" value="${state.skyBottomColor}">
    </div>
    <div class="row">
      <label>Sky Glare (Exposure)</label>
      <input id="exposure" type="range" min="0.2" max="3" step="0.01" value="${state.exposure}">
    </div>

    <!-- Stars -->
    <div class="row">
      <label>Star Count</label>
      <input id="starCount" type="range" min="0" max="15000" step="100" value="${state.starCount}">
    </div>
    <div class="row">
      <label>Star Size (px)</label>
      <input id="starSize" type="range" min="0.5" max="6" step="0.1" value="${state.starSize}">
    </div>
    <div class="row">
      <label>Twinkle Speed</label>
      <input id="starTwinkleSpeed" type="range" min="0" max="4" step="0.05" value="${state.starTwinkleSpeed}">
    </div>

    <!-- Terrain -->
    <div class="row">
      <label>Displacement (relief)</label>
      <input id="terrainDisplacement" type="range" min="0" max="3" step="0.01" value="${state.terrainDisplacement}">
    </div>
    <div class="row">
      <label>Roughness</label>
      <input id="terrainRoughness" type="range" min="0" max="1" step="0.01" value="${state.terrainRoughness}">
    </div>
    <div class="row">
      <label>Texture Repeat</label>
      <input id="terrainRepeat" type="range" min="4" max="160" step="1" value="${state.terrainRepeat}">
    </div>
    <div class="row">
      <label>Sand Tint</label>
      <input id="terrainTint" type="color" value="${state.terrainTint}">
    </div>
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

bind('envLightColor', v => { state.envLightColor = v; skyAPI.setEnvironmentLightColor(v); });
bind('sunIntensity', v => { state.sunIntensity = v; skyAPI.setSunIntensity(v); });
bind('ambientIntensity', v => { state.ambientIntensity = v; skyAPI.setAmbientIntensity(v); });

bind('skyBrightness', v => { state.skyBrightness = v; skyAPI.setSkyBrightness(v); });
bind('skyTopColor', v => { state.skyTopColor = v; skyAPI.setSkyTopColor(v); });
bind('skyBottomColor', v => { state.skyBottomColor = v; skyAPI.setSkyBottomColor(v); });
bind('exposure', v => { state.exposure = v; skyAPI.setExposure(v); });

bind('starCount', v => { state.starCount = v; skyAPI.setStarCount(v); });
bind('starSize', v => { state.starSize = v; skyAPI.setStarSize(v); });
bind('starTwinkleSpeed', v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

bind('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bind('terrainRoughness', v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
bind('terrainRepeat', v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
bind('terrainTint', v => { state.terrainTint = v; terrainAPI.setTintColor(v); });

document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    ...state,
    // authoritative snapshot from live objects:
    ...skyAPI._getCurrent(),
    ...terrainAPI._getCurrent()
  };
  const text = JSON.stringify(snapshot, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('Parameters copied to clipboard.');
  } catch {
    // Fallback: create a prompt
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
  setTimeout(() => n.remove(), 1600);
}

// Toggle panel
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
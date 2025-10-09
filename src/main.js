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
const skyAPI = createSky(scene, renderer, manager); // stars + sky shader + Earth

// --- Dedicated terrain lighting (independent of sky) ---
const terrainSun = new THREE.DirectionalLight(0xffffff, 3.0);
terrainSun.position.set(120, 200, -140);
terrainSun.castShadow = true;
terrainSun.shadow.mapSize.set(1024, 1024);
terrainSun.shadow.camera.near = 1;
terrainSun.shadow.camera.far = 1500;
terrainSun.shadow.camera.left = -400;
terrainSun.shadow.camera.right = 400;
terrainSun.shadow.camera.top = 400;
terrainSun.shadow.camera.bottom = -400;
scene.add(terrainSun);
scene.add(terrainSun.target);

const terrainAmbient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(terrainAmbient);

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
const defaults = {
  // Sky (physical model)
  turbidity: 0,
  rayleigh: 0.08,
  mieCoefficient: 0.047,
  mieDirectionalG: 0.01,
  elevation: 16.5,
  azimuth: 360,

  // Sky color grading (new)
  skyTopColor: '#88aaff',
  skyCoeffColor: '#ffffff',
  skyBottomColor: '#000011',
  skyContrast: 1.0,

  // Stars
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Terrain lighting
  terrainDirIntensity: 3.0,
  terrainAmbIntensity: 0.55,

  // Terrain material
  terrainDisplacement: 0.55,
  terrainRoughness: 1,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0,

  // Earth (GLB, visual-only)
  earthScale: 120,
  earthPosX: 0,
  earthPosY: 80,
  earthPosZ: -220,
  earthBrightness: 1.2
};

const state = { ...defaults };
applyAll();

/* ---------- helpers to apply state ---------- */
function applyAll() {
  // Sky params
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);

  // Sky grading
  skyAPI.setSkyTopColor(state.skyTopColor);
  skyAPI.setSkyCoeffColor(state.skyCoeffColor);
  skyAPI.setSkyBottomColor(state.skyBottomColor);
  skyAPI.setSkyContrast(state.skyContrast);

  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain lights
  terrainSun.intensity = state.terrainDirIntensity;
  terrainAmbient.intensity = state.terrainAmbIntensity;

  // Terrain material
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

/* ---------- UI builder with range + number pair ---------- */
function row(label, id, min, max, step, value) {
  const s = step === undefined ? 'any' : step;
  return `
    <div class="row">
      <label for="${id}">${label}</label>
      <div class="pair">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${s}" value="${value}">
        <input id="${id}Num" type="number" min="${min}" max="${max}" step="${s}" value="${value}" style="width:90px;margin-left:8px">
      </div>
    </div>
  `;
}
function colorRow(label, id, value) {
  return `
    <div class="row">
      <label for="${id}">${label}</label>
      <div class="pair">
        <input id="${id}" type="color" value="${value}">
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

  rng.addEventListener('input', fromRange, { passive: true });
  rng.addEventListener('change', fromRange, { passive: true });
  num.addEventListener('input', fromNumber, { passive: true });
  num.addEventListener('change', fromNumber, { passive: true });
}

function bindPair(id, onChange) { wirePair(id, onChange); }
function bindColor(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => onChange(el.value);
  el.addEventListener('input', handler, { passive: true });
  el.addEventListener('change', handler, { passive: true });
}

/* ---------- Build panel (closed by default) ---------- */
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Sky & Terrain Tuner</h3></header>

  <div class="section">Sky</div>
  <div class="grid">
    ${row('Turbidity', 'turbidity', 0, 20, 0.0001, state.turbidity)}
    ${row('Rayleigh', 'rayleigh', 0, 4, 0.0001, state.rayleigh)}
    ${row('Mie Coefficient', 'mieCoefficient', 0, 0.2, 0.0001, state.mieCoefficient)}
    ${row('Mie Directional G', 'mieDirectionalG', 0, 1, 0.0001, state.mieDirectionalG)}
    ${row('Elevation (°)', 'elevation', -5, 89, 0.0001, state.elevation)}
    ${row('Azimuth (°)', 'azimuth', 0, 360, 0.0001, state.azimuth)}

    ${colorRow('Sky Top Color', 'skyTopColor', state.skyTopColor)}
    ${colorRow('Sky Coeff Color', 'skyCoeffColor', state.skyCoeffColor)}
    ${colorRow('Sky Bottom Color', 'skyBottomColor', state.skyBottomColor)}
    ${row('Sky Contrast', 'skyContrast', 0, 5, 0.0001, state.skyContrast)}
  </div>

  <div class="section">Stars</div>
  <div class="grid">
    ${row('Star Count', 'starCount', 0, 15000, 1, state.starCount)}
    ${row('Star Size (px)', 'starSize', 0.5, 8, 0.0001, state.starSize)}
    ${row('Twinkle Speed', 'starTwinkleSpeed', 0, 5, 0.0001, state.starTwinkleSpeed)}
  </div>

  <div class="section">Terrain Lighting</div>
  <div class="grid">
    ${row('Directional Intensity', 'terrainDirIntensity', 0, 10, 0.0001, state.terrainDirIntensity)}
    ${row('Ambient Intensity', 'terrainAmbIntensity', 0, 5, 0.0001, state.terrainAmbIntensity)}
  </div>

  <div class="section">Terrain Material</div>
  <div class="grid">
    ${row('Displacement', 'terrainDisplacement', 0, 3, 0.0001, state.terrainDisplacement)}
    ${row('Roughness', 'terrainRoughness', 0, 1, 0.0001, state.terrainRoughness)}
    ${row('Texture Repeat', 'terrainRepeat', 4, 200, 1, state.terrainRepeat)}
    ${colorRow('Sand Tint', 'terrainTint', state.terrainTint)}
    ${row('Saturation', 'terrainSaturation', 0, 1.5, 0.0001, state.terrainSaturation)}
  </div>

  <div class="section">Earth (GLB)</div>
  <div class="grid">
    ${row('Earth Scale', 'earthScale', 0.1, 500, 0.0001, state.earthScale)}
    ${row('Earth X', 'earthPosX', -2000, 2000, 0.0001, state.earthPosX)}
    ${row('Earth Y', 'earthPosY', -2000, 2000, 0.0001, state.earthPosY)}
    ${row('Earth Z', 'earthPosZ', -4000, 4000, 0.0001, state.earthPosZ)}
    ${row('Earth Brightness', 'earthBrightness', 0, 5, 0.0001, state.earthBrightness)}
  </div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

/* ---------- Wire inputs ---------- */
// Sky params
bindPair('turbidity', v => { state.turbidity = v; skyAPI.setTurbidity(v); });
bindPair('rayleigh', v => { state.rayleigh = v; skyAPI.setRayleigh(v); });
bindPair('mieCoefficient', v => { state.mieCoefficient = v; skyAPI.setMieCoefficient(v); });
bindPair('mieDirectionalG', v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
bindPair('elevation', v => { state.elevation = v; skyAPI.setElevation(v); });
bindPair('azimuth', v => { state.azimuth = v; skyAPI.setAzimuth(v); });

// Sky grading
bindColor('skyTopColor', v => { state.skyTopColor = v; skyAPI.setSkyTopColor(v); });
bindColor('skyCoeffColor', v => { state.skyCoeffColor = v; skyAPI.setSkyCoeffColor(v); });
bindColor('skyBottomColor', v => { state.skyBottomColor = v; skyAPI.setSkyBottomColor(v); });
bindPair('skyContrast', v => { state.skyContrast = v; skyAPI.setSkyContrast(v); });

// Stars
bindPair('starCount', v => { state.starCount = v; skyAPI.setStarCount(v); });
bindPair('starSize', v => { state.starSize = v; skyAPI.setStarSize(v); });
bindPair('starTwinkleSpeed', v => { state.starTwinkleSpeed = v; skyAPI.setStarTwinkleSpeed(v); });

// Terrain lighting
bindPair('terrainDirIntensity', v => { state.terrainDirIntensity = v; terrainSun.intensity = v; });
bindPair('terrainAmbIntensity', v => { state.terrainAmbIntensity = v; terrainAmbient.intensity = v; });

// Terrain material
bindPair('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bindPair('terrainRoughness', v => { state.terrainRoughness = v; terrainAPI.setRoughness(v); });
bindPair('terrainRepeat', v => { state.terrainRepeat = v; terrainAPI.setRepeat(v); });
bindColor('terrainTint', v => { state.terrainTint = v; terrainAPI.setTintColor(v); });
bindPair('terrainSaturation', v => { state.terrainSaturation = v; if (terrainAPI.setSaturation) terrainAPI.setSaturation(v); });

// Earth
bindPair('earthScale', v => { state.earthScale = v; skyAPI.setEarthScale(v); });
bindPair('earthPosX', v => { state.earthPosX = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
bindPair('earthPosY', v => { state.earthPosY = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
bindPair('earthPosZ', v => { state.earthPosZ = v; skyAPI.setEarthPosition(state.earthPosX, state.earthPosY, state.earthPosZ); });
bindPair('earthBrightness', v => { state.earthBrightness = v; skyAPI.setEarthBrightness(v); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    ...state,
    ...(skyAPI._getCurrent ? skyAPI._getCurrent() : {}),
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

// Toggle panel (closed by default)
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = false;
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
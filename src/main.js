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
// Keep neutral; we control brightness via lights/material, not sky
renderer.toneMappingExposure = 1.0;

document.body.appendChild(renderer.domElement);

// --------------------
// Ambient looped sound
// --------------------
const listener = new THREE.AudioListener();
camera.add(listener);

const ambientSound = new THREE.Audio(listener);
const manager = new THREE.LoadingManager(); // shared with textures too
const audioLoader = new THREE.AudioLoader(manager);
audioLoader.load(
  'src/assets/sounds/planetsound.wav',
  (buffer) => {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(0.35);
  },
  undefined,
  () => console.warn('Could not load planetsound.wav')
);
// unlock on first user interaction
function startAmbientAudio() {
  if (listener.context && listener.context.state === 'suspended') listener.context.resume();
  if (ambientSound.buffer && !ambientSound.isPlaying) ambientSound.play();
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

// Terrain & Sky
const terrainAPI = createTerrain(manager);
scene.add(terrainAPI.mesh);
const skyAPI = createSky(scene, renderer);

// ------------------------------
// Terrain lighting (standalone)
// ------------------------------
const sunLight = new THREE.DirectionalLight(0xffffff, 4.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 1500;
sunLight.shadow.camera.left = -400;
sunLight.shadow.camera.right = 400;
sunLight.shadow.camera.top = 400;
sunLight.shadow.camera.bottom = -400;

// Aim from ~elev 16.5°, az 360° (independent of sky)
const dist = 1000;
const elevRad = THREE.MathUtils.degToRad(90 - 16.5);
const azimRad = THREE.MathUtils.degToRad(360);
const dir = new THREE.Vector3().setFromSphericalCoords(1, elevRad, azimRad);
sunLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
sunLight.target.position.set(0, 0, 0);
sunLight.target.updateMatrixWorld();
scene.add(sunLight);
scene.add(sunLight.target);

// Ambient fill
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
  skyAPI.update(dt, camera); // also orients sun disk to camera
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
   Tuner UI (open by default)
   -------------------------- */
// Defaults (feel free to change)
const defaults = {
  // Sky (visual only)
  turbidity: 0.0,
  rayleigh: 0.08,
  mieCoefficient: 0.047,
  mieDirectionalG: 0.01,
  elevation: 16.5,
  azimuth: 360,

  // Visual Sun
  sunSize: 45,
  sunInner: 1.0,

  // Stars
  starCount: 10000,
  starSize: 1.6,
  starTwinkleSpeed: 0.9,

  // Terrain material
  terrainDisplacement: 0.55,
  terrainRoughness: 1.0,
  terrainRepeat: 48,
  terrainTint: '#f5f7ff',
  terrainSaturation: 0.0,

  // Terrain lights
  sunLightIntensity: 4.5,
  ambientIntensity: 0.57
};

const state = { ...defaults };
applyAll();

// Build panel UI with sliders + numeric inputs
const panel = document.getElementById('tunePanel');
panel.innerHTML = `
  <header><h3>Sky, Stars & Terrain Tuner</h3></header>

  <div class="section">Sky (visual only)</div>
  <div class="grid">
    ${row('Turbidity','turbidity',0,20,0.01,state.turbidity)}
    ${row('Rayleigh','rayleigh',0,4,0.001,state.rayleigh)}
    ${row('Mie Coefficient','mieCoefficient',0,0.2,0.001,state.mieCoefficient)}
    ${row('Mie Directional G','mieDirectionalG',0,1,0.001,state.mieDirectionalG)}
    ${row('Elevation (°)','elevation',-5,89,0.1,state.elevation)}
    ${row('Azimuth (°)','azimuth',0,360,0.1,state.azimuth)}
  </div>

  <div class="section">Sun (visual disk)</div>
  <div class="grid">
    ${row('Sun Size','sunSize',1,200,1,state.sunSize)}
    ${row('Sun Inner Intensity','sunInner',0,4,0.01,state.sunInner)}
  </div>

  <div class="section">Stars</div>
  <div class="grid">
    ${row('Star Count','starCount',0,15000,100,state.starCount)}
    ${row('Star Size (px)','starSize',0.5,6,0.1,state.starSize)}
    ${row('Twinkle Speed','starTwinkleSpeed',0,4,0.01,state.starTwinkleSpeed)}
  </div>

  <div class="section">Terrain Lighting</div>
  <div class="grid">
    ${row('Sun Light Intensity','sunLightIntensity',0,12,0.01,state.sunLightIntensity)}
    ${row('Ambient Intensity','ambientIntensity',0,3,0.01,state.ambientIntensity)}
  </div>

  <div class="section">Terrain Material</div>
  <div class="grid">
    ${row('Displacement','terrainDisplacement',0,3,0.01,state.terrainDisplacement)}
    ${row('Roughness','terrainRoughness',0,1,0.01,state.terrainRoughness)}
    ${row('Texture Repeat','terrainRepeat',1,200,1,state.terrainRepeat)}
    <div class="row">
      <label>Sand Tint</label>
      <input id="terrainTint" type="color" value="${state.terrainTint}">
    </div>
    ${row('Saturation','terrainSaturation',0,1.5,0.01,state.terrainSaturation)}
  </div>

  <button id="copyParams" type="button">Copy current parameters</button>
`;

// Helper to create slider + number
function row(label, id, min, max, step, value) {
  return `
    <div class="row">
      <label for="${id}">${label}</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        <input id="${id}Num" type="number" min="${min}" max="${max}" step="${step}" value="${value}" style="width:110px;">
      </div>
    </div>
  `;
}

function bindPair(id, onChange) {
  const r = document.getElementById(id);
  const n = document.getElementById(id + 'Num');
  if (!r || !n) return;
  const clamp = (v) => {
    const min = Number(r.min), max = Number(r.max);
    return Math.min(max, Math.max(min, v));
  };
  const syncFromRange = () => { n.value = r.value; onChange(Number(r.value)); };
  const syncFromNumber = () => { const v = clamp(Number(n.value)); n.value = String(v); r.value = String(v); onChange(v); };
  r.addEventListener('input', syncFromRange, { passive: true });
  n.addEventListener('input', syncFromNumber, { passive: true });
}

// Wire bindings

// Sky
bindPair('turbidity',       v => { state.turbidity = v;       skyAPI.setTurbidity(v); });
bindPair('rayleigh',        v => { state.rayleigh = v;        skyAPI.setRayleigh(v); });
bindPair('mieCoefficient',  v => { state.mieCoefficient = v;  skyAPI.setMieCoefficient(v); });
bindPair('mieDirectionalG', v => { state.mieDirectionalG = v; skyAPI.setMieDirectionalG(v); });
bindPair('elevation',       v => { state.elevation = v;       skyAPI.setElevation(v); });
bindPair('azimuth',         v => { state.azimuth = v;         skyAPI.setAzimuth(v); });

// Sun visual
bindPair('sunSize',         v => { state.sunSize = v;         skyAPI.setSunSize(v); });
bindPair('sunInner',        v => { state.sunInner = v;        skyAPI.setSunInnerIntensity(v); });

// Stars
bindPair('starCount',       v => { state.starCount = v;       skyAPI.setStarCount(v); });
bindPair('starSize',        v => { state.starSize = v;        skyAPI.setStarSize(v); });
bindPair('starTwinkleSpeed',v => { state.starTwinkleSpeed = v;skyAPI.setStarTwinkleSpeed(v); });

// Terrain lights
bindPair('sunLightIntensity', v => { state.sunLightIntensity = v; sunLight.intensity = v; });
bindPair('ambientIntensity',  v => { state.ambientIntensity = v;  ambient.intensity = v; });

// Terrain material
bindPair('terrainDisplacement', v => { state.terrainDisplacement = v; terrainAPI.setDisplacementScale(v); });
bindPair('terrainRoughness',    v => { state.terrainRoughness = v;    terrainAPI.setRoughness(v); });
bindPair('terrainRepeat',       v => { state.terrainRepeat = v|0;     terrainAPI.setRepeat(v|0); });
document.getElementById('terrainTint').addEventListener('input', (e) => {
  state.terrainTint = e.target.value;
  terrainAPI.setTintColor(state.terrainTint);
}, { passive: true });
bindPair('terrainSaturation',   v => { state.terrainSaturation = v; if (terrainAPI.setSaturation) terrainAPI.setSaturation(v); });

// Copy params
document.getElementById('copyParams').addEventListener('click', async () => {
  const snapshot = {
    ...state,
    ...skyAPI._getCurrent?.(),
    ...terrainAPI._getCurrent?.()
  };
  const text = JSON.stringify(snapshot, null, 2);
  try { await navigator.clipboard.writeText(text); toast('Parameters copied to clipboard.'); }
  catch { prompt('Copy parameters:', text); }
});

// Toast helper
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

// Apply defaults once everything exists
function applyAll() {
  // Sky
  skyAPI.setTurbidity(state.turbidity);
  skyAPI.setRayleigh(state.rayleigh);
  skyAPI.setMieCoefficient(state.mieCoefficient);
  skyAPI.setMieDirectionalG(state.mieDirectionalG);
  skyAPI.setElevation(state.elevation);
  skyAPI.setAzimuth(state.azimuth);

  // Sun visual
  skyAPI.setSunSize(state.sunSize);
  skyAPI.setSunInnerIntensity(state.sunInner);

  // Stars
  skyAPI.setStarCount(state.starCount);
  skyAPI.setStarSize(state.starSize);
  skyAPI.setStarTwinkleSpeed(state.starTwinkleSpeed);

  // Terrain material
  terrainAPI.setDisplacementScale(state.terrainDisplacement);
  terrainAPI.setRoughness(state.terrainRoughness);
  terrainAPI.setRepeat(state.terrainRepeat);
  terrainAPI.setTintColor(state.terrainTint);
  if (terrainAPI.setSaturation) terrainAPI.setSaturation(state.terrainSaturation);

  // Terrain lights
  sunLight.intensity = state.sunLightIntensity;
  ambient.intensity  = state.ambientIntensity;
}

// Open panel by default
const tuneBtn = document.getElementById('tuneBtn');
let panelOpen = true;
panel.style.display = 'block';
panel.setAttribute('aria-hidden', 'false');
tuneBtn.addEventListener('click', () => {
  panelOpen = !panelOpen;
  panel.style.display = panelOpen ? 'block' : 'none';
  panel.setAttribute('aria-hidden', String(!panelOpen));
});
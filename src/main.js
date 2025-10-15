// src/main.js — Main loop with GamepadFPV (unchanged) + PCControls added
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';     // keep your original
import { PCControls } from './controls/PCControls.js';     // new
import { Builder } from './tools/Builder.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { AssetLibrary } from './ui/AssetLibrary.js';

const mount = document.getElementById('app');
const overlay = document.getElementById('errorOverlay');
const settingsBtnEl = document.getElementById('settingsBtn');
const settingsPanelEl = document.getElementById('settingsPanel');
const startScreenEl = document.getElementById('startScreen');
const startBtnEl = document.getElementById('startBtn');

// Asset Library
const libraryBtnEl = document.getElementById('libraryBtn');
const assetLibraryEl = document.getElementById('assetLibrary');
const closeLibraryBtnEl = document.getElementById('closeLibraryBtn');
const categoriesContainerEl = document.getElementById('categoriesContainer');
const assetsGridContainerEl = document.getElementById('assetsGridContainer');

function die(msg, err){
  overlay.style.display = 'flex';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n' + err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, rig, pc;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  mount.appendChild(renderer.domElement);

  scene = new Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);

  // Your original gamepad-driven rig (owns the camera)
  rig = new GamepadFPV(camera);
  rig.position.set(0, 3, 10);
  scene.add(rig);

  // New PC controls layered onto the same rig
  pc = new PCControls(rig, renderer.domElement);

} catch (e) {
  die('Renderer/scene init', e);
}

/* ---------- UI ---------- */
let builder, settingsPanel, assetLibrary;
try {
  settingsPanel = new SettingsPanel(settingsBtnEl, settingsPanelEl);
  assetLibrary = new AssetLibrary(
    libraryBtnEl, assetLibraryEl, closeLibraryBtnEl,
    categoriesContainerEl, assetsGridContainerEl
  );
  builder = new Builder(scene, camera, settingsPanel, assetLibrary);
  assetLibrary.onSelect(assetDef => builder.setActiveAsset(assetDef));
} catch (e) {
  die('UI init (Builder/Settings/Library)', e);
}

/* ---------- Resize ---------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

/* ---------- Mouse clicks for build/remove ---------- */
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => {
  const isUI =
    e.target.closest('#settingsPanel') ||
    e.target.closest('#assetLibrary') ||
    e.target.closest('#settingsBtn') ||
    e.target.closest('#libraryBtn');
  if (isUI) return;
  if (e.button === 0) builder.queuePlaceClick();
  if (e.button === 2) builder.queueRemoveClick();
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // Both inputs can contribute every frame:
  rig.update(dt); // gamepad look + move
  pc.update(dt);  // WASD + mouse look (keeps rig._yaw/_pitch in sync)

  builder.update(dt);
  scene.updateShadows?.(camera);
  scene.updateReflections?.(renderer, camera);

  renderer.render(scene, camera);
}

// Render once behind start screen
renderer.render(scene, camera);

startBtnEl.addEventListener('click', () => {
  startScreenEl.classList.add('hidden');
  pc.requestPointerLock(); // lock pointer for mouse look
  animate();
}, { once: true });

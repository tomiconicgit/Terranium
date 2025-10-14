// src/main.js — Main application loop with Asset Library
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Builder } from './tools/Builder.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { AssetLibrary } from './ui/AssetLibrary.js'; // New import

const mount = document.getElementById('app');
const overlay = document.getElementById('errorOverlay');
const settingsBtnEl = document.getElementById('settingsBtn');
const settingsPanelEl = document.getElementById('settingsPanel');
const startScreenEl = document.getElementById('startScreen');
const startBtnEl = document.getElementById('startBtn');

// Asset Library elements
const libraryBtnEl = document.getElementById('libraryBtn');
const assetLibraryEl = document.getElementById('assetLibrary');
const closeLibraryBtnEl = document.getElementById('closeLibraryBtn');
const categoriesContainerEl = document.getElementById('categoriesContainer');
const assetsGridContainerEl = document.getElementById('assetsGridContainer');

function die(msg, err){
  overlay.style.display = 'block';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n' + err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, fpv;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  mount.appendChild(renderer.domElement);
  scene = new Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
  fpv = new GamepadFPV(camera);
  fpv.position.set(0, 3, 10);
  scene.add(fpv);

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

  assetLibrary.onSelect(assetDef => {
    builder.setActiveAsset(assetDef);
  });

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
  if (!gameStarted) {
    renderer.render(scene, camera);
  }
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
let gameStarted = false;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  
  fpv.update(dt);
  builder.update(dt);

  if (typeof scene.updateShadows === 'function') scene.updateShadows(camera);
  if (typeof scene.updateReflections === 'function') scene.updateReflections(renderer, camera);

  renderer.render(scene, camera);
}

renderer.render(scene, camera);

startBtnEl.addEventListener('click', () => {
  gameStarted = true;
  startScreenEl.classList.add('hidden');
  animate();
}, { once: true });


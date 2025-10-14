// src/main.js — Main application loop with Asset Library
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Builder } from './tools/Builder.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { AssetLibrary } from './ui/AssetLibrary.js';

// ... DOM element getters (omitted for brevity) ...

function die(msg, err){ /* ... */ }

/* ---------- Three ---------- */
let renderer, scene, camera, fpv;
try {
  // ... renderer and scene setup (omitted for brevity) ...
} catch (e) {
  die('Renderer/scene init', e);
}

/* ---------- UI ---------- */
let builder, settingsPanel, assetLibrary;
try {
  // ... UI setup (omitted for brevity) ...
} catch (e) {
  die('UI init (Builder/Settings/Library)', e);
}

/* ---------- Resize ---------- */
window.addEventListener('resize', () => { /* ... */ });

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
let gameStarted = false;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  
  fpv.update(dt);
  // **FIX**: Pass delta time to the builder to handle animations
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

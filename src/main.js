// src/main.js
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';

// --- Post-processing imports ---
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


const mount    = document.getElementById('app');
const hotbarEl = document.getElementById('hotbar');
const overlay  = document.getElementById('errorOverlay');

function die(msg, err){
  overlay.style.display = 'block';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n' + err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, fpv, composer, bloomPass; // Add composer and bloomPass
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1; // Slightly increase exposure for better bloom
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  mount.appendChild(renderer.domElement);

  scene = new Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  fpv = new GamepadFPV(camera);
  fpv.position.set(0, 2, 6);
  scene.add(fpv);

  // --- Post-processing setup ---
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.6);
  // bloomPass params: (resolution, strength, radius, threshold)
  composer.addPass(bloomPass);


} catch (e) {
  die('Renderer/scene init', e);
}

/* ---------- UI ---------- */
let hotbar, builder;
try {
  hotbar = new Hotbar(hotbarEl);
  builder = new Builder(scene, camera, hotbar);
} catch (e) {
  die('UI init (Hotbar/Builder)', e);
}

/* ---------- Resize ---------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h); // Also resize the composer
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t  = clock.elapsedTime;

  fpv.update(dt);
  builder.update(dt);
  if (typeof scene.update === 'function') scene.update(dt, t);

  // Use the composer to render instead of the renderer directly
  composer.render();
}

animate();

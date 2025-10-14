// src/main.js — Upgraded with cinematic post-processing
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';

// ✨ NEW: Import post-processing modules
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const mount    = document.getElementById('app');
const hotbarEl = document.getElementById('hotbar');
const overlay  = document.getElementById('errorOverlay');

function die(msg, err){
  overlay.style.display = 'block';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n' + err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, fpv, composer, lutPass;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  mount.appendChild(renderer.domElement);

  scene = new Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
  fpv = new GamepadFPV(camera);
  fpv.position.set(0, 3, 10);
  scene.add(fpv);

  // ✨ NEW: Setup Post-Processing Composer
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Pass 1: Bloom for realistic bright glows
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.6, 0.85);
  composer.addPass(bloomPass);

  // Pass 2: LUT for cinematic color grading
  lutPass = new LUTPass();
  composer.addPass(lutPass);
  new LUTCubeLoader().load(
    // A free LUT that provides a cinematic, cold, high-contrast look
    'https://cdn.jsdelivr.net/gh/devizv/free-luts/luts/Neutral-LUTs-by-IWLTBAP/C-9800.CUBE',
    (lut) => { lutPass.lut = lut; lutPass.enabled = true; }
  );

  // Final Pass: Ensure correct output
  composer.addPass(new OutputPass());


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
  composer.setSize(w, h); // ✨ Resize the composer too
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  
  fpv.update(dt);
  builder.update(dt);

  if (typeof scene.updateShadows === 'function') scene.updateShadows(camera);
  
  // ✨ Render using the composer to apply effects
  composer.render(dt);
}
animate();

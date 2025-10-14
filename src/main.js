// src/main.js — Using a procedural sky instead of HDRI
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';

const mount    = document.getElementById('app');
const hotbarEl = document.getElementById('hotbar');
const overlay  = document.getElementById('errorOverlay');

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
  renderer.shadowMap.type = THREE.VSMShadowMap;

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
let hotbar, builder;
try {
  hotbar = new Hotbar(hotbarEl); // Corrected variable name here
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
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  
  fpv.update(dt);
  builder.update(dt);

  if (typeof scene.updateShadows === 'function') scene.updateShadows(camera);
  
  renderer.render(scene, camera);
}
animate();

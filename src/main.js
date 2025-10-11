// src/main.js
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';

const mount   = document.getElementById('app');
const hotbarEl = document.getElementById('hotbar');
const overlay = document.getElementById('errorOverlay');

function die(msg, err){
  overlay.style.display='block';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n'+err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, fpv;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);

  scene = new Scene();

  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.05, 4000);
  fpv = new GamepadFPV(camera);
  fpv.position.set(0, 2, 6);
  scene.add(fpv);
} catch (e) { die('Renderer/scene init', e); }

/* ---------- UI ---------- */
let hotbar, builder;
try {
  hotbar = new Hotbar(hotbarEl);
  builder = new Builder(scene, camera, hotbar);
} catch (e) { die('UI init (Hotbar/Builder)', e); }

/* ---------- Resize ---------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t  = clock.elapsedTime;

  fpv.update(dt);
  builder.update(dt);
  scene.update(dt, t);

  renderer.render(scene, camera);
}
animate();
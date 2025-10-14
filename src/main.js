// src/main.js — Upgraded with realistic environment lighting
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';
// Import the loader for HDR environment maps
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

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
  // ✨ SHADOW UPGRADE: VSM is smoother and more realistic than the default
  renderer.shadowMap.type = THREE.VSMShadowMap;

  mount.appendChild(renderer.domElement);

  scene = new Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
  fpv = new GamepadFPV(camera);
  fpv.position.set(0, 3, 10);
  scene.add(fpv);

  // ✨ LIGHTING UPGRADE: Load an HDRI for realistic environment light
  const loader = new RGBELoader();
  loader.load(
    // Using a free, high-quality HDRI from Poly Haven
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sky_cloudy_01_1k.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture; // This provides the realistic lighting and reflections
    },
    undefined, // onProgress callback (optional)
    (err) => console.error('Failed to load HDRI.', err)
  );

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
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  
  fpv.update(dt);
  builder.update(dt);

  // Reactivate dynamic shadow camera for better shadow quality as you move
  if (typeof scene.updateShadows === 'function') scene.updateShadows(camera);
  
  renderer.render(scene, camera);
}
animate();

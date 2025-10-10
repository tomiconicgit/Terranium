// main.js — controller-only FPV voxel builder

import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Builder } from './tools/Builder.js';
import { Hotbar } from './ui/Hotbar.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
else renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 3, 6);

const controls = new GamepadFPV(camera);
controls.position.set(0, 3, 0);  // player body proxy
scene.add(controls);

// Hotbar + Builder
const hotbar = new Hotbar(document.getElementById('hotbar'));
const builder = new Builder(scene, camera, hotbar);

// resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// main loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  controls.update(dt);      // left stick strafing + forward/back; right stick look; A/X up/down
  builder.update(dt);       // reticle ray, highlight align, placement state

  renderer.render(scene, camera);
}
animate();
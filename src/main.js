// src/main.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';

// Core elements
const mount = document.getElementById('app');
const overlay = document.getElementById('errorOverlay');
const startScreenEl = document.getElementById('startScreen');
const startBtnEl = document.getElementById('startBtn');

// UI Buttons & Panels
const uploadBtn = document.getElementById('uploadBtn');
const modelUploader = document.getElementById('modelUploader');
const adjustBtn = document.getElementById('adjustBtn');
const adjustPanel = document.getElementById('adjustPanel');

// Adjustment Sliders
const scaleSlider = document.getElementById('scaleSlider');
const posXSlider = document.getElementById('posXSlider');
const posYSlider = document.getElementById('posYSlider');
const posZSlider = document.getElementById('posZSlider');
const copyDataBtn = document.getElementById('copyDataBtn');

// Touch UI
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const joyBase = document.getElementById('joyBase');
const joyKnob = document.getElementById('joyKnob');

function die(msg, err){
  overlay.style.display = 'flex';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n' + err.stack : '');
  throw err || new Error(msg);
}

/* ---------- Three ---------- */
let renderer, scene, camera, rig;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);
  
  scene = new Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  
  rig = new GamepadFPV(camera);
  rig.position.set(0, 15, 40); // Start further back to see the rocket
  scene.add(rig);
} catch (e) {
  die('Renderer/scene init', e);
}

/* ---------- Model Loader & Adjustment ---------- */
let lastLoadedModel = null;
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(dracoLoader);
const raycaster = new THREE.Raycaster();

function loadModel(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        gltfLoader.parse(event.target.result, '', (gltf) => {
            const model = gltf.scene;
            lastLoadedModel = model; // Store reference to the latest model
            
            model.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            // Raycast to place model on the terrain surface, away from the center
            raycaster.set(new THREE.Vector3(30, 100, 30), new THREE.Vector3(0, -1, 0));
            const terrain = scene.getObjectByName('terrain');
            if (terrain) {
                const intersects = raycaster.intersectObject(terrain);
                if (intersects.length > 0) {
                    model.position.copy(intersects[0].point);
                }
            } else {
                 model.position.set(30, 10, 30); // Fallback
            }

            scene.add(model);
            
            // Sync sliders with the new model's initial state
            updateSlidersFromModel();
            adjustBtn.style.display = 'flex'; // Show the adjust button
            adjustPanel.classList.remove('hidden'); // Show panel by default for new model
        }, (error) => {
            console.error('An error happened during GLTF parsing:', error);
            alert('Could not load the model.');
        });
    };
    reader.readAsArrayBuffer(file);
}

function updateSlidersFromModel() {
    if (!lastLoadedModel) return;
    scaleSlider.value = lastLoadedModel.scale.x;
    posXSlider.value = lastLoadedModel.position.x;
    posYSlider.value = lastLoadedModel.position.y;
    posZSlider.value = lastLoadedModel.position.z;
}

// UI Event Listeners
uploadBtn.addEventListener('click', () => modelUploader.click());
modelUploader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) loadModel(file);
});

adjustBtn.addEventListener('click', () => adjustPanel.classList.toggle('hidden'));

// Slider Event Listeners
scaleSlider.addEventListener('input', () => {
    if (lastLoadedModel) {
        const scale = parseFloat(scaleSlider.value);
        lastLoadedModel.scale.set(scale, scale, scale);
    }
});
posXSlider.addEventListener('input', () => { if (lastLoadedModel) lastLoadedModel.position.x = parseFloat(posXSlider.value); });
posYSlider.addEventListener('input', () => { if (lastLoadedModel) lastLoadedModel.position.y = parseFloat(posYSlider.value); });
posZSlider.addEventListener('input', () => { if (lastLoadedModel) lastLoadedModel.position.z = parseFloat(posZSlider.value); });

copyDataBtn.addEventListener('click', () => {
    if (!lastLoadedModel) return;
    const data = {
        scale: parseFloat(lastLoadedModel.scale.x.toFixed(4)),
        position: {
            x: parseFloat(lastLoadedModel.position.x.toFixed(4)),
            y: parseFloat(lastLoadedModel.position.y.toFixed(4)),
            z: parseFloat(lastLoadedModel.position.z.toFixed(4))
        }
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        const originalText = copyDataBtn.textContent;
        copyDataBtn.textContent = 'Copied!';
        setTimeout(() => { copyDataBtn.textContent = originalText; }, 2000);
    });
});

/* ---------- Core App Logic (Resize, Controls, Loop) ---------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

const joy = { active: false, centerX: 0, centerY: 0, lx: 0, ly: 0, radius: 70 };
const lookTouch = { active: false, lastX: 0, lastY: 0, dx: 0, dy: 0 };
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function leftStart(e){ joy.active = true; e.preventDefault(); }
function leftMove(e){
  if (!joy.active) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - joy.centerX;
  const dy = t.clientY - joy.centerY;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, joy.radius);
  const ang = Math.atan2(dy, dx);
  const nx = Math.cos(ang) * clamped;
  const ny = Math.sin(ang) * clamped;
  joyKnob.style.transform = `translate(${nx}px, ${ny}px)`;
  joy.lx = clamp(nx / joy.radius, -1, 1);
  joy.ly = clamp(ny / joy.radius, -1, 1);
  e.preventDefault();
}
function leftEnd(e){
  joy.active = false; joy.lx = 0; joy.ly = 0;
  joyKnob.style.transform = 'translate(0, 0)';
  e.preventDefault();
}
touchLeft.addEventListener('touchstart', leftStart, { passive: false });
touchLeft.addEventListener('touchmove', leftMove,   { passive: false });
touchLeft.addEventListener('touchend',  leftEnd,    { passive: false });
touchLeft.addEventListener('touchcancel', leftEnd,  { passive:false });

function rightStart(e){
  const t = e.changedTouches[0]; lookTouch.active = true;
  lookTouch.lastX = t.clientX; lookTouch.lastY = t.clientY; e.preventDefault();
}
function rightMove(e){
  if (!lookTouch.active) return;
  const t = e.changedTouches[0];
  lookTouch.dx += (t.clientX - lookTouch.lastX);
  lookTouch.dy += (t.clientY - lookTouch.lastY);
  lookTouch.lastX = t.clientX; lookTouch.lastY = t.clientY; e.preventDefault();
}
function rightEnd(e){ lookTouch.active = false; e.preventDefault(); }
touchRight.addEventListener('touchstart', rightStart, { passive: false });
touchRight.addEventListener('touchmove',  rightMove,  { passive: false });
touchRight.addEventListener('touchend',   rightEnd,   { passive: false });
touchRight.addEventListener('touchcancel', rightEnd,  { passive: false });

const clock = new THREE.Clock();
const TOUCH_LOOK_SENS = 0.0020;
const TOUCH_MOVE_SPEED = 8.0;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  if (lookTouch.dx !== 0 || lookTouch.dy !== 0) {
    rig._yaw -= lookTouch.dx * TOUCH_LOOK_SENS;
    rig._pitch -= lookTouch.dy * TOUCH_LOOK_SENS;
    const maxPitch = Math.PI/2 - 0.01;
    rig._pitch = Math.max(-maxPitch, Math.min(maxPitch, rig._pitch));
    rig.rotation.set(rig._pitch, rig._yaw, 0, 'YXZ');
    lookTouch.dx = 0; lookTouch.dy = 0;
  }

  rig.update(dt);

  if (joy.lx !== 0 || joy.ly !== 0) {
    const dirF = new THREE.Vector3(0,0,-1).applyQuaternion(rig.quaternion);
    const dirR = new THREE.Vector3(1,0,0).applyQuaternion(rig.quaternion);
    dirF.y = 0; dirR.y = 0; dirF.normalize(); dirR.normalize();
    const vel = new THREE.Vector3();
    vel.addScaledVector(dirR, joy.lx * TOUCH_MOVE_SPEED);
    vel.addScaledVector(dirF, -joy.ly * TOUCH_MOVE_SPEED);
    rig.position.addScaledVector(vel, dt);
  }

  scene.update?.(renderer, camera);
  renderer.render(scene, camera);
}

startBtnEl.addEventListener('click', () => {
  startScreenEl.classList.add('hidden');
  if (window.matchMedia('(pointer: coarse)').matches) {
    const joyRect = joyBase.getBoundingClientRect();
    joy.centerX = joyRect.left + joyRect.width / 2;
    joy.centerY = joyRect.top + joyRect.height / 2;
  }
  animate();
}, { once: true });

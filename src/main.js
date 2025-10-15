// src/main.js — Gamepad only + on-screen touch controls (joystick, buttons, swipe look)
import * as THREE from 'three';
import { Scene } from './scene/Scene.js';
import { GamepadFPV } from './controls/GamepadFPV.js';
import { Builder } from './tools/Builder.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { AssetLibrary } from './ui/AssetLibrary.js';

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

// Touch UI
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const joyBase = document.getElementById('joyBase');
const joyKnob = document.getElementById('joyKnob');
const btnX = document.getElementById('btnX');
const btnY = document.getElementById('btnY');
const btnB = document.getElementById('btnB');
const touchButtons = document.getElementById('touchButtons');

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
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  mount.appendChild(renderer.domElement);
  scene = new Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);

  rig = new GamepadFPV(camera);
  rig.position.set(0, 3, 10);
  scene.add(rig);

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

/* ---------- Mouse (desktop) place/remove (unchanged behaviour) ---------- */
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


/* ---------- Touch controls implementation ---------- */
// CHANGE: Movement joystick state updated for fixed position
const joy = {
  active: false,
  centerX: 0, // Will be set on start
  centerY: 0, // Will be set on start
  lx: 0, // [-1..1]
  ly: 0, // [-1..1]
  radius: 70
};
// Look swipe state (right zone)
const lookTouch = {
  active: false,
  lastX: 0,
  lastY: 0,
  dx: 0,
  dy: 0
};

// CHANGE: show() and hide() helpers are no longer needed for the joystick
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// CHANGE: Left joystick handlers simplified for a fixed joystick
function leftStart(e){
  joy.active = true;
  e.preventDefault();
}
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
  
  // Visual knob: translate relative to its static CSS position
  joyKnob.style.transform = `translate(${nx}px, ${ny}px)`;

  // Normalized axes
  joy.lx = clamp(nx / joy.radius, -1, 1);
  joy.ly = clamp(ny / joy.radius, -1, 1);
  e.preventDefault();
}
function leftEnd(e){
  joy.active = false;
  joy.lx = 0; joy.ly = 0;
  // Reset the knob's visual position
  joyKnob.style.transform = 'translate(0, 0)';
  e.preventDefault();
}

touchLeft.addEventListener('touchstart', leftStart, { passive: false });
touchLeft.addEventListener('touchmove', leftMove,   { passive: false });
touchLeft.addEventListener('touchend',  leftEnd,    { passive: false });
touchLeft.addEventListener('touchcancel', leftEnd,  { passive:false });

// Right swipe-look handlers
function rightStart(e){
  const t = e.changedTouches[0];
  lookTouch.active = true;
  lookTouch.lastX = t.clientX;
  lookTouch.lastY = t.clientY;
  e.preventDefault();
}
function rightMove(e){
  if (!lookTouch.active) return;
  const t = e.changedTouches[0];
  lookTouch.dx += (t.clientX - lookTouch.lastX);
  lookTouch.dy += (t.clientY - lookTouch.lastY);
  lookTouch.lastX = t.clientX;
  lookTouch.lastY = t.clientY;
  e.preventDefault();
}
function rightEnd(e){
  lookTouch.active = false;
  e.preventDefault();
}

touchRight.addEventListener('touchstart', rightStart, { passive: false });
touchRight.addEventListener('touchmove',  rightMove,  { passive: false });
touchRight.addEventListener('touchend',   rightEnd,   { passive: false });
touchRight.addEventListener('touchcancel', rightEnd,  { passive: false });

// Right button cluster: map to build actions
function bindTap(el, fn){
  const handler = (e)=>{ e.preventDefault(); fn(); };
  el.addEventListener('touchstart', handler, { passive: false });
  el.addEventListener('click', handler); // fallback if tapped on desktop
}
// X = place, B = remove, Y = rotate 90°
bindTap(btnX, () => builder.queuePlaceClick());
bindTap(btnB, () => builder.queueRemoveClick());
bindTap(btnY, () => { settingsPanel.rotationY += Math.PI/2; settingsPanel.triggerChange?.(); });

// Show buttons on touch devices only (this is handled by CSS now)
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  touchButtons.style.display = 'block';
}

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
const TOUCH_LOOK_SENS = 0.0020;
const TOUCH_MOVE_SPEED = 6.5;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // 1) Apply touch-look
  if (lookTouch.dx !== 0 || lookTouch.dy !== 0) {
    rig._yaw   -= lookTouch.dx * TOUCH_LOOK_SENS;
    rig._pitch -= lookTouch.dy * TOUCH_LOOK_SENS;
    const maxPitch = Math.PI/2 - 0.01;
    rig._pitch = Math.max(-maxPitch, Math.min(maxPitch, rig._pitch));
    rig.rotation.set(rig._pitch, rig._yaw, 0, 'YXZ');
    lookTouch.dx = 0; lookTouch.dy = 0;
  }

  // 2) Update gamepad rig
  rig.update(dt);

  // 3) Add touch-joystick movement
  if (joy.lx !== 0 || joy.ly !== 0) {
    const dirF = new THREE.Vector3(0,0,-1).applyQuaternion(rig.quaternion);
    const dirR = new THREE.Vector3(1,0,0).applyQuaternion(rig.quaternion);
    dirF.y = 0; dirR.y = 0; dirF.normalize(); dirR.normalize();
    const vel = new THREE.Vector3();
    vel.addScaledVector(dirR, joy.lx * TOUCH_MOVE_SPEED);
    vel.addScaledVector(dirF, -joy.ly * TOUCH_MOVE_SPEED);
    rig.position.addScaledVector(vel, dt);
  }

  builder.update(dt);
  scene.updateShadows?.(camera);
  scene.updateReflections?.(renderer, camera);

  renderer.render(scene, camera);
}

// Initial render behind splash
renderer.render(scene, camera);

// Start: hide splash and run
startBtnEl.addEventListener('click', () => {
  startScreenEl.classList.add('hidden');

  // CHANGE: Calculate the joystick's fixed center position once after the UI is visible
  if (window.matchMedia('(pointer: coarse)').matches) {
    const joyRect = joyBase.getBoundingClientRect();
    joy.centerX = joyRect.left + joyRect.width / 2;
    joy.centerY = joyRect.top + joyRect.height / 2;
  }
  
  animate();
}, { once: true });

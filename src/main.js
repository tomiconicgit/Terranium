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

  // Your original gamepad rig
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
// Movement joystick state
const joy = {
  active: false,
  originX: 0,
  originY: 0,
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

// Helpers
function show(el, x, y){ el.style.opacity = '1'; el.style.transform = `translate(${x}px, ${y}px)`; }
function hide(el){ el.style.opacity = '0'; }

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// Left joystick handlers
function leftStart(e){
  const t = e.changedTouches[0];
  joy.active = true;
  joy.originX = t.clientX;
  joy.originY = t.clientY;
  // place base/knob centered
  show(joyBase, joy.originX - 70, joy.originY - 70);
  show(joyKnob, joy.originX - 36, joy.originY - 36);
  e.preventDefault();
}
function leftMove(e){
  if (!joy.active) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - joy.originX;
  const dy = t.clientY - joy.originY;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, joy.radius);
  const ang = Math.atan2(dy, dx);
  const nx = Math.cos(ang) * clamped;
  const ny = Math.sin(ang) * clamped;
  // Visual knob
  show(joyKnob, joy.originX - 36 + nx, joy.originY - 36 + ny);
  // Normalized axes
  joy.lx = clamp(nx / joy.radius, -1, 1);   // right is +X
  joy.ly = clamp(ny / joy.radius, -1, 1);   // down is +Y
  e.preventDefault();
}
function leftEnd(e){
  joy.active = false;
  joy.lx = 0; joy.ly = 0;
  hide(joyBase); hide(joyKnob);
  e.preventDefault();
}

touchLeft.addEventListener('touchstart', leftStart, { passive: false });
touchLeft.addEventListener('touchmove', leftMove,   { passive: false });
touchLeft.addEventListener('touchend',  leftEnd,    { passive: false });
touchLeft.addEventListener('touchcancel', leftEnd,  { passive: false });

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

// Show buttons on touch devices only
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  touchButtons.style.display = 'block';
}

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
// Touch sensitivities
const TOUCH_LOOK_SENS = 0.0020;   // radians per pixel
const TOUCH_MOVE_SPEED = 6.5;     // m/s for full deflection

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // 1) Apply touch-look to rig by directly tweaking the rig’s internal yaw/pitch
  if (lookTouch.dx !== 0 || lookTouch.dy !== 0) {
    // GamepadFPV stores yaw/pitch in _yaw/_pitch
    rig._yaw   -= lookTouch.dx * TOUCH_LOOK_SENS;
    rig._pitch -= lookTouch.dy * TOUCH_LOOK_SENS;
    const maxPitch = Math.PI/2 - 0.01;
    rig._pitch = Math.max(-maxPitch, Math.min(maxPitch, rig._pitch));
    rig.rotation.set(rig._pitch, rig._yaw, 0, 'YXZ');
    // decay/consume frame delta
    lookTouch.dx = 0; lookTouch.dy = 0;
  }

  // 2) Let the original gamepad rig update (real controller input)
  rig.update(dt);

  // 3) Add touch-joystick movement on top (so it works without a controller)
  if (joy.lx !== 0 || joy.ly !== 0) {
    const dirF = new THREE.Vector3(0,0,-1).applyQuaternion(rig.quaternion);
    const dirR = new THREE.Vector3(1,0,0).applyQuaternion(rig.quaternion);
    dirF.y = 0; dirR.y = 0; dirF.normalize(); dirR.normalize();
    const vel = new THREE.Vector3();
    vel.addScaledVector(dirR, joy.lx * TOUCH_MOVE_SPEED);
    vel.addScaledVector(dirF, -joy.ly * TOUCH_MOVE_SPEED); // up on stick = forward
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
  animate();
}, { once: true });

// src/main.js — cache-busted dynamic imports for ALL modules

const V = Date.now(); // cache-buster

const three = await import(`https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js`);

const { Scene }           = await import(`./scene/Scene.js?v=${V}`);
const { Player }          = await import(`./player/Player.js?v=${V}`);
const { Camera }          = await import(`./camera/Camera.js?v=${V}`);
const { DesktopControls } = await import(`./controls/DesktopControls.js?v=${V}`);
const { MobileControls }  = await import(`./controls/MobileControls.js?v=${V}`);

// If Scene dynamically imports anything, it should already use relative paths;
// the browser will fetch those fresh (new files like LaunchPadComplex.js won’t be cached yet).

// --- Orientation (best effort) ---
if (screen.orientation?.lock) { try { await screen.orientation.lock('landscape'); } catch {} }

// --- Renderer ---
const renderer = new three.WebGLRenderer({ antialias: true });
renderer.outputEncoding = three.sRGBEncoding;
renderer.toneMapping = three.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- World ---
const scene = new Scene();               // adds ground + MASSIVE pad + fence + props
const player = new Player();
scene.add(player.mesh);
const camera = new Camera(player);

// Controls
const isMobile = 'ontouchstart' in window;
const controls = isMobile
  ? new MobileControls(player, camera)
  : new DesktopControls(player, camera);

// Keep reference to the ground mesh by name
const landscape = scene.getObjectByName('landscape');

// Resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Main loop
const clock = new three.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  controls.update();
  player.update(landscape, dt);
  camera.update(dt, player);

  scene.update?.(dt, elapsed);
  renderer.render(scene, camera);
}
animate();

// Optional: quick visual assert if pad is missing
if (!scene.getObjectByName?.('launchPad')) {
  console.warn('LaunchPad not found in scene. Ensure Scene.js imports LaunchPadComplex.js.');
}
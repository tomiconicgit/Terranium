// src/main.js — no top-level await; mobile/PWA-safe dynamic imports

(async function boot() {
  const V = Date.now(); // cache-buster

  const three = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');

  const { Scene }           = await import(`./scene/Scene.js?v=${V}`);
  const { Player }          = await import(`./player/Player.js?v=${V}`);
  const { Camera }          = await import(`./camera/Camera.js?v=${V}`);
  const { DesktopControls } = await import(`./controls/DesktopControls.js?v=${V}`);
  const { MobileControls }  = await import(`./controls/MobileControls.js?v=${V}`);

  // Orientation (best effort)
  if (screen.orientation?.lock) { try { await screen.orientation.lock('landscape'); } catch {} }

  // Renderer
  const renderer = new three.WebGLRenderer({ antialias: true });
  // three r169 prefers outputColorSpace:
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = three.SRGBColorSpace;
  else renderer.outputEncoding = three.sRGBEncoding; // fallback for older builds
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // World
  const scene  = new Scene();
  const player = new Player();
  scene.add(player.mesh);
  const camera = new Camera(player);

  // Spawn safely outside trench
  player.mesh.position.set(-24, 8, -6);
  player.rotation = Math.PI * 0.15;
  camera.pitch = 0;

  // Controls
  const isMobile = 'ontouchstart' in window;
  const controls = isMobile
    ? new MobileControls(player, camera)
    : new DesktopControls(player, camera);

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

    scene.update?.(dt, elapsed, camera, player);
    renderer.render(scene, camera);
  }
  animate();

  if (!scene.getObjectByName?.('launchPad')) {
    console.warn('LaunchPad not found in scene. Ensure Scene.js imports LaunchPadComplex.js.');
  }
})();
// First-person app entry (no top-level await on old iOS)
(async function boot() {
  const V = Date.now();
  const three = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');

  const { Scene }           = await import(`./scene/Scene.js?v=${V}`);
  const { Player }          = await import(`./player/Player.js?v=${V}`);
  const { Camera }          = await import(`./camera/Camera.js?v=${V}`);
  const { DesktopControls } = await import(`./controls/DesktopControls.js?v=${V}`);
  const { MobileControls }  = await import(`./controls/MobileControls.js?v=${V}`);

  if (screen.orientation?.lock) { try { await screen.orientation.lock('landscape'); } catch {} }

  const renderer = new three.WebGLRenderer({ antialias:true });
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = three.SRGBColorSpace;
  else renderer.outputEncoding = three.sRGBEncoding;
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene  = new Scene();                // ground + sky + launch pad complex
  const player = new Player(); scene.add(player.mesh);
  const camera = new Camera(player);

  // spawn near pad, facing it
  player.mesh.position.set(-24, 8, -6);
  player.rotation = Math.PI * 0.15;
  camera.pitch = 0;

  const isMobile = 'ontouchstart' in window;
  const controls = isMobile ? new MobileControls(player, camera) : new DesktopControls(player, camera);

  const ground = scene.getObjectByName('landscape');

  addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new three.Clock();
  function tick(){
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    const t  = clock.elapsedTime;

    controls.update();
    player.update(ground, dt);
    camera.update(dt, player);
    scene.update?.(dt, t, camera, player);

    renderer.render(scene, camera);
  }
  tick();
})();
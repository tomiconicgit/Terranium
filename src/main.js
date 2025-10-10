import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { SceneRoot }       from './scene/Scene.js';
import { DesktopFPV }      from './controls/DesktopFPV.js';
import { MobileFPV }       from './controls/MobileFPV.js';
import { Builder }         from './tools/Builder.js';
import { initUI }          from './ui/Hotbar.js';

(async function boot(){
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const root = new SceneRoot();
  const { scene, camera, groundRayMesh } = root;

  const isMobile = 'ontouchstart' in window;
  const controls = isMobile
    ? new MobileFPV(camera, document.getElementById('joy'))
    : new DesktopFPV(camera, renderer.domElement);

  const builder = new Builder(scene, camera, groundRayMesh);
  const uiApi   = initUI(builder);
  builder.setUI(uiApi);

  addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  (function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    controls.update(dt);
    builder.update(dt);
    renderer.render(scene, camera);
  })();
})();
// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { Hotbar } from './ui/Hotbar.js';
import { Builder } from './tools/Builder.js';

// Minimal example catalog so Hotbar never receives undefined
const CATALOG = [
  { id:'grass',    name:'Grass Block',   kind:'block', color:'#5da35d' },
  { id:'concrete', name:'Concrete',      kind:'block', color:'#9aa1a9' },
  { id:'sand',     name:'Sand',          kind:'block', color:'#e7d8a6' },
  { id:'asphalt',  name:'Asphalt',       kind:'block', color:'#2f2f34' },
  { id:'metal',    name:'Metal',         kind:'block', color:'#9db4c6' },
  { id:'iron',     name:'White Iron',    kind:'block', color:'#dfe6ee' },
  { id:'slab',     name:'Half Slab',     kind:'slab',  color:'#bfc3c8' },
  { id:'pipe',     name:'Pipe',          kind:'pipe',  color:'#c8c59e' },
  { id:'window',   name:'Window',        kind:'window',color:'#7fa0c4' },
  { id:'wire',     name:'Wire',          kind:'pipe',  color:'#444' }
];

const mount = document.getElementById('app');
const overlay = document.getElementById('errorOverlay');

function die(msg, err){
  overlay.style.display='block';
  overlay.textContent = 'Boot failed: ' + msg + (err && err.stack ? '\n\n'+err.stack : '');
  throw err || new Error(msg);
}

let renderer, scene, camera, orbit;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101213);

  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 2000);
  camera.position.set(40, 30, 60);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;

  // Simple ground so you see *something* even if other modules are missing
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI/2;
  scene.add(ground);

  const hemi = new THREE.HemisphereLight(0xcce0ff, 0x444422, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(50, 80, -30);
  scene.add(sun);
} catch (e) {
  die('Renderer/scene init', e);
}

// ---- UI: Hotbar + Builder (defensive) ----
let hotbar, builder;
try {
  hotbar = new Hotbar({ slots: 10 });
  builder = new Builder({
    hotbar,
    onSelect: (item) => {
      // You can reflect the selected item in your preview system here
      // console.log('Selected item:', item);
    }
  });
  builder.setCatalog(CATALOG);   // <— this used to be undefined and crashed setCatalog
} catch (e) {
  die('UI init (Hotbar/Builder)', e);
}

// ---- Resize ----
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Loop ----
function animate(){
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
animate();
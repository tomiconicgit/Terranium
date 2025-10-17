// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  // Selection / center tile
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const center    = (Array.isArray(selection.tiles) && selection.tiles[0]) || { i: 0, j: 0 };
  const ci = Number.isFinite(center.i) ? center.i : 0;
  const cj = Number.isFinite(center.j) ? center.j : 0;

  // 30×30 “around” center: 15 to the - side, 14 to the + side (total 30)
  const halfMinus = 15;
  const halfPlus  = 14;
  const minI = ci - halfMinus, maxI = ci + halfPlus;
  const minJ = cj - halfMinus, maxJ = cj + halfPlus;

  // World grid 100×100 centered on origin ⇒ i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials
  const concreteMat = makeConcreteMaterial();       // procedural concrete (level 0)
  const metalMat    = makeProceduralMetalMaterial(); // procedural(ish) metal (pit + walls)

  // Base tile geometry (instanced)
  const tileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
  tileGeo.rotateX(-Math.PI / 2);

  // Partition tiles into: ground (y=0, concrete) and pit (y=-15, metal)
  const depth = 15;
  const groundTransforms = [];
  const pitTransforms    = [];
  const m = new THREE.Matrix4();

  for (let j = -HALF; j < HALF; j++) {
    for (let i = -HALF; i < HALF; i++) {
      const x = (i + 0.5) * tileSize;
      const z = (j + 0.5) * tileSize;
      const inPit = (i >= minI && i <= maxI && j >= minJ && j <= maxJ);
      const y = inPit ? -depth : 0;
      m.makeTranslation(x, y, z);
      (inPit ? pitTransforms : groundTransforms).push(m.clone());
    }
  }

  // Instanced ground (concrete @ y=0 except pit)
  const ground = new THREE.InstancedMesh(tileGeo, concreteMat, groundTransforms.length);
  ground.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ground.name = 'ground_concrete';
  ground.receiveShadow = true;
  groundTransforms.forEach((mat, idx) => ground.setMatrixAt(idx, mat));
  ground.instanceMatrix.needsUpdate = true;
  group.add(ground);

  // Instanced pit floor (metal @ y=-15)
  const pit = new THREE.InstancedMesh(tileGeo, metalMat, pitTransforms.length);
  pit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pit.name = 'pit_metal_floor';
  pit.receiveShadow = true;
  pitTransforms.forEach((mat, idx) => pit.setMatrixAt(idx, mat));
  pit.instanceMatrix.needsUpdate = true;
  group.add(pit);

  // Perimeter metal walls from -15 up to 0
  const walls = new THREE.Group();
  walls.name = 'metal_walls';

  const wallHeight    = depth;              // 15 tall (from -15 to 0)
  const wallThickness = 0.2 * tileSize;     // thin
  const wallYCenter   = -depth / 2;         // halfway between -15 and 0

  // Spans (in world units) across tile bounds
  const spanX = (maxI - minI + 1) * tileSize;
  const spanZ = (maxJ - minJ + 1) * tileSize;

  // Build four sides: -Z, +Z, -X, +X
  // Front/back along X (rotateX already handled by PlaneGeometry; these are Boxes)
  walls.add(makeWall(spanX, wallHeight, wallThickness,
    (minI + maxI + 1) * 0.5 * tileSize, wallYCenter, (minJ - 0.5) * tileSize, metalMat)); // -Z edge

  walls.add(makeWall(spanX, wallHeight, wallThickness,
    (minI + maxI + 1) * 0.5 * tileSize, wallYCenter, (maxJ + 0.5) * tileSize, metalMat)); // +Z edge

  // Left/right along Z, rotate 90° around Y
  const wallZRot = Math.PI / 2;
  walls.add(makeWall(spanZ, wallHeight, wallThickness,
    (minI - 0.5) * tileSize, wallYCenter, (minJ + maxJ + 1) * 0.5 * tileSize, metalMat, wallZRot)); // -X edge

  walls.add(makeWall(spanZ, wallHeight, wallThickness,
    (maxI + 0.5) * tileSize, wallYCenter, (minJ + maxJ + 1) * 0.5 * tileSize, metalMat, wallZRot)); // +X edge

  group.add(walls);

  return group;
}

/* ---------------- helpers ---------------- */
function makeWall(length, height, thickness, x, y, z, material, rotY = 0) {
  const geo = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------- Procedural concrete (level 0) ---------- */
function makeConcreteMaterial() {
  const uniforms = {
    uColorA: { value: new THREE.Color(0xbdbdbd) }, // light gray
    uColorB: { value: new THREE.Color(0x9e9e9e) }, // mid gray
  };

  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv * 10.0;  // scale for fine detail
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragment = `
    varying vec2 vUv;
    uniform vec3 uColorA;
    uniform vec3 uColorB;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      float n  = noise(vUv * 2.5);
      float n2 = noise(vUv * 8.0);
      float speck = step(0.97, fract(n2 * 7.0 + n));
      vec3 base = mix(uColorA, uColorB, n);
      base *= (1.0 - 0.05 * speck);                 // tiny dark speckles
      base *= 0.95 + 0.05 * noise(vUv * 0.5);       // subtle AO-ish
      gl_FragColor = vec4(base, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    lights: false
  });
}

/* ---------- Procedural metal (pit + walls) ---------- */
/* Uses a tiny canvas-generated tileable “brushed/plates” map fed into a PBR material
   so it still reacts to your scene lights. */
function makeProceduralMetalMaterial() {
  const tex = makeMetalCanvasTexture(256);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.28,
    map: tex,
    // You could also feed this map into roughnessMap for extra variation, e.g.:
    // roughnessMap: tex
  });
}

function makeMetalCanvasTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base steel tone
  ctx.fillStyle = '#b3b6bb';
  ctx.fillRect(0, 0, size, size);

  // Brushed noise streaks
  const rows = size;
  for (let y = 0; y < rows; y++) {
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const len = size * (0.4 + Math.random() * 0.6);
    const x   = Math.random() * (size - len);
    ctx.fillRect(x, y, len, 1);
  }

  // Subtle plate seams / grid
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  const cells = 8;
  for (let i = 1; i < cells; i++) {
    const p = Math.floor((i * size) / cells) + 0.5;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}
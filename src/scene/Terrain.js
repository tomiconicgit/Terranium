// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  // Selection comes from the Highlighter: a perimeter (axis-aligned) loop of tiles.
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const tiles     = Array.isArray(selection.tiles) ? selection.tiles : [];

  // World grid 100×100 centered on origin ⇒ i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  // --- Derive rectangle bounds from the perimeter loop ---
  // We only need the inclusive bounding box: [minI..maxI] × [minJ..maxJ].
  let minI, maxI, minJ, maxJ;
  if (tiles.length) {
    const is = tiles.map(t => +t.i);
    const js = tiles.map(t => +t.j);
    minI = Math.min(...is); maxI = Math.max(...is);
    minJ = Math.min(...js); maxJ = Math.max(...js);
  } else {
    // Fallback safety zone (10×10 around origin) if nothing is highlighted.
    minI = -5; maxI = 4;
    minJ = -5; maxJ = 4;
  }

  // Clamp to world limits
  minI = Math.max(minI, -HALF);
  maxI = Math.min(maxI,  HALF - 1);
  minJ = Math.max(minJ, -HALF);
  maxJ = Math.min(maxJ,  HALF - 1);

  // Inclusive tile counts and spans in world units
  const pitTilesX = (maxI - minI + 1);
  const pitTilesZ = (maxJ - minJ + 1);
  const pitSpanX  = pitTilesX * tileSize;
  const pitSpanZ  = pitTilesZ * tileSize;

  // World extents (full board)
  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // Rectangle center in world units (aligned to our i/j grid)
  const pitCenterX = (minI + maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // Root node
  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials
  const concreteMat = makeConcreteMaterial();        // outside the pit
  const metalMat    = makeProceduralMetalMaterial(); // pit floor + walls

  // Geometry dims
  const depth        = 15;    // pit depth target: -15m
  const epsilon      = 0.02;  // small overlaps to hide seams
  const groundThick  = 0.05;  // thin slab to avoid z-fighting
  const floorThick   = 0.08;

  // ---------- Ground (concrete) around the pit ----------
  // Left slab (everything with i < minI)
  if (minI > -HALF) {
    const width = (minI - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_left';
    m.position.set(((-HALF) * tileSize) + (width * 0.5), 0 - groundThick * 0.5, 0);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Right slab (everything with i > maxI)
  if (maxI < HALF - 1) {
    const width = ((HALF - 1) - maxI) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_right';
    m.position.set(((maxI + 1) * tileSize) + (width * 0.5), 0 - groundThick * 0.5, 0);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Front slab (everything with j < minJ)
  if (minJ > -HALF) {
    const depthSpan = (minJ - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_front';
    m.position.set(pitCenterX, 0 - groundThick * 0.5, ((-HALF) * tileSize) + (depthSpan * 0.5));
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Back slab (everything with j > maxJ)
  if (maxJ < HALF - 1) {
    const depthSpan = ((HALF - 1) - maxJ) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_back';
    m.position.set(pitCenterX, 0 - groundThick * 0.5, ((maxJ + 1) * tileSize) + (depthSpan * 0.5));
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Pit floor (metal) at -15m ----------
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    // center the slab at Y ≈ -15; we place its top surface at exactly -15 (with tiny epsilon)
    m.position.set(pitCenterX, -depth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Pit perimeter walls (metal), aligned to the rectangle outline ----------
  const wallHeight    = depth + groundThick + epsilon; // extends slightly into the ground slab
  const wallThickness = Math.max(0.2 * tileSize, 0.1);
  const wallYCenter   = -depth * 0.5; // centered between 0 and -depth (top ≈ 0, bottom ≈ -15)

  // -Z edge (front wall runs along j = minJ boundary)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    (minJ * tileSize) - (wallThickness * 0.5) + epsilon,
    metalMat, 0, 'pit_wall_front'
  ));

  // +Z edge (back wall runs along j = maxJ boundary)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    ((maxJ + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    metalMat, 0, 'pit_wall_back'
  ));

  // -X edge (left wall runs along i = minI boundary)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    (minI * tileSize) - (wallThickness * 0.5) + epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_left'
  ));

  // +X edge (right wall runs along i = maxI boundary)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    ((maxI + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_right'
  ));

  // ---------- Bookkeeping / export helpers ----------
  // Enumerate every interior tile (inclusive bounds).
  const interiorTiles = [];
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      interiorTiles.push({ i, j, y: -depth });
    }
  }
  group.userData.pit = {
    tileSize,
    depth,
    bounds: { minI, maxI, minJ, maxJ },
    interiorTiles,
    perimeter: tiles   // original highlighted loop (as provided)
  };

  return group;
}

/* ---------------- helpers ---------------- */
function makeWall(length, height, thickness, x, y, z, material, rotY = 0, name = 'pit_wall') {
  const geo = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.name = name;
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

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    lights: false
  });
  // Helps with any grazing-angle artifacts against wall tops
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}

/* ---------- Procedural metal (pit + walls) ---------- */
function makeProceduralMetalMaterial() {
  const tex = makeMetalCanvasTexture(256);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.28,
    map: tex,
  });
  return mat;
}

function makeMetalCanvasTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base steel tone
  ctx.fillStyle = '#b3b6bb';
  ctx.fillRect(0, 0, size, size);

  // Brushed noise streaks
  for (let y = 0; y < size; y++) {
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const len = size * (0.4 + Math.random() * 0.6);
    const x   = Math.random() * (size - len);
    ctx.fillRect(x, y, len, 1);
  }

  // Subtle plate seams
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
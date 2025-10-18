// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * Usage:
 *  createTerrain({
 *    selection: {
 *      tileSize: 1,
 *      tiles: [{ i: 15, j: -1, y: 0 }] // the REFERENCE tile
 *    }
 *  })
 *
 * This will make a 40×40 tile area centered on (15,-1) a metal pit at -15m.
 * Everything outside that area is flat concrete at y=0.
 */
export function createTerrain(opts = {}) {
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const tiles     = Array.isArray(selection.tiles) ? selection.tiles : [];

  // Reference tile (centre). If none given, default to origin.
  const ref = tiles[0] || { i: 0, j: 0 };
  const ci  = Number.isFinite(+ref.i) ? +ref.i : 0;
  const cj  = Number.isFinite(+ref.j) ? +ref.j : 0;

  // World grid 100×100 centered on origin ⇒ i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  // === CONFIG: size of the metal area (in tiles) ===
  const PIT_TILES_X = 40;
  const PIT_TILES_Z = 40;

  // For even sizes, “centered on a tile” means offsets are asymmetric by 1:
  // we take 19 tiles to the negative side and 20 tiles to the positive side
  // (19 + 1 + 20 = 40).
  const NEG_X = Math.floor((PIT_TILES_X - 1) / 2); // 19
  const POS_X = PIT_TILES_X - 1 - NEG_X;           // 20
  const NEG_Z = Math.floor((PIT_TILES_Z - 1) / 2); // 19
  const POS_Z = PIT_TILES_Z - 1 - NEG_Z;           // 20

  // Inclusive bounds in tile coords
  let minI = ci - NEG_X;
  let maxI = ci + POS_X;
  let minJ = cj - NEG_Z;
  let maxJ = cj + POS_Z;

  // Clamp to world bounds
  minI = Math.max(minI, -HALF);
  maxI = Math.min(maxI,  HALF - 1);
  minJ = Math.max(minJ, -HALF);
  maxJ = Math.min(maxJ,  HALF - 1);

  // Spans in tiles & world units
  const pitTilesX = (maxI - minI + 1);
  const pitTilesZ = (maxJ - minJ + 1);
  const pitSpanX  = pitTilesX * tileSize;
  const pitSpanZ  = pitTilesZ * tileSize;

  // World extents (full board)
  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // Pit centre in world units (aligned to our grid)
  const pitCenterX = (minI + maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // Root
  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials
  const concreteMat = makeConcreteMaterial();        // outside pit
  const metalMat    = makeProceduralMetalMaterial(); // pit floor + walls

  // Geometry dims
  const depth        = 15;     // target floor height: -15m
  const epsilon      = 0.02;   // hide seams
  const groundThick  = 0.05;   // thin slab to avoid z-fighting
  const floorThick   = 0.08;

  // ---------- Concrete ground around the pit (four slabs) ----------
  // Left slab (i < minI)
  if (minI > -HALF) {
    const width = (minI - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_left';
    m.position.set(((-HALF) * tileSize) + (width * 0.5), -groundThick * 0.5, 0);
    m.receiveShadow = true;
    group.add(m);
  }
  // Right slab (i > maxI)
  if (maxI < HALF - 1) {
    const width = ((HALF - 1) - maxI) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_right';
    m.position.set(((maxI + 1) * tileSize) + (width * 0.5), -groundThick * 0.5, 0);
    m.receiveShadow = true;
    group.add(m);
  }
  // Front slab (j < minJ)
  if (minJ > -HALF) {
    const depthSpan = (minJ - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_front';
    m.position.set(pitCenterX, -groundThick * 0.5, ((-HALF) * tileSize) + (depthSpan * 0.5));
    m.receiveShadow = true;
    group.add(m);
  }
  // Back slab (j > maxJ)
  if (maxJ < HALF - 1) {
    const depthSpan = ((HALF - 1) - maxJ) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_back';
    m.position.set(pitCenterX, -groundThick * 0.5, ((maxJ + 1) * tileSize) + (depthSpan * 0.5));
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Metal floor at -15m ----------
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    // Top surface sits at ≈ -15 (nudged by epsilon to avoid z-fight with wall bottoms)
    m.position.set(pitCenterX, -depth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Metal perimeter walls (outline of the 40×40) ----------
  const wallHeight    = depth + groundThick + epsilon; // slightly pokes into ground slab
  const wallThickness = Math.max(0.2 * tileSize, 0.1);
  const wallYCenter   = -depth * 0.5;                  // roughly centred between 0 and -15

  // -Z edge (front)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    (minJ * tileSize) - (wallThickness * 0.5) + epsilon,
    metalMat, 0, 'pit_wall_front'
  ));

  // +Z edge (back)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    ((maxJ + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    metalMat, 0, 'pit_wall_back'
  ));

  // -X edge (left)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    (minI * tileSize) - (wallThickness * 0.5) + epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_left'
  ));

  // +X edge (right)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    ((maxI + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_right'
  ));

  // ---------- Bookkeeping / debug ----------
  const interiorTiles = [];
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      interiorTiles.push({ i, j, y: -depth });
    }
  }
  group.userData.pit = {
    tileSize,
    depth,
    reference: { i: ci, j: cj },
    widthTiles: pitTilesX,
    heightTiles: pitTilesZ,
    bounds: { minI, maxI, minJ, maxJ },
    interiorTiles
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
  mat.polygonOffset = true; // fight z-fighting on rim
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}

/* ---------- Procedural metal (pit + walls) ---------- */
function makeProceduralMetalMaterial() {
  const tex = makeMetalCanvasTexture(256);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.28,
    map: tex,
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
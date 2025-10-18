// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  // Selection / center tile
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const center    = (Array.isArray(selection.tiles) && selection.tiles[0]) || { i: 0, j: 0 };
  const ci = Number.isFinite(center.i) ? center.i : 0;
  const cj = Number.isFinite(center.j) ? center.j : 0;

  // 30×30 area around the center
  const halfMinus = 15;
  const halfPlus  = 14;
  const minI = ci - halfMinus, maxI = ci + halfPlus;
  const minJ = cj - halfMinus, maxJ = cj + halfPlus;

  // World grid 100×100 centered on origin  → i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials
  const concreteMat = makeConcretePBRMaterial();     // level 0 (outside pit) — now LIT
  const metalMat    = makeProceduralMetalMaterial(); // pit floor + walls (already PBR)

  // Common dims
  const depth        = 15;                 // pit depth
  const epsilon      = 0.02;               // small overlaps to hide seams
  const groundThick  = 0.05;               // thin slab to avoid z-fight
  const floorThick   = 0.08;

  // Span in world units for the pit
  const pitSpanX = (maxI - minI + 1) * tileSize;
  const pitSpanZ = (maxJ - minJ + 1) * tileSize;

  // World extents (full board)
  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // Convert i,j to world center positions
  const pitCenterX = (minI + maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // ---------- Ground at level 0 (four frame slabs around the pit) ----------
  // Left strip
  if (minI > -HALF) {
    const width = (minI - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_left';
    m.position.set(((-HALF) * tileSize) + (width * 0.5), -groundThick * 0.5, 0);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Right strip
  if (maxI < HALF - 1) {
    const width = ((HALF - 1) - maxI) * tileSize;
    const g = new THREE.BoxGeometry(width + epsilon, groundThick, worldSpanZ + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_right';
    m.position.set(((maxI + 1) * tileSize) + (width * 0.5), -groundThick * 0.5, 0);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Front strip (-Z)
  if (minJ > -HALF) {
    const depthSpan = (minJ - (-HALF)) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_front';
    m.position.set(pitCenterX, -groundThick * 0.5, ((-HALF) * tileSize) + (depthSpan * 0.5));
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }
  // Back strip (+Z)
  if (maxJ < HALF - 1) {
    const depthSpan = ((HALF - 1) - maxJ) * tileSize;
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, groundThick, depthSpan + epsilon);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_frame_back';
    m.position.set(pitCenterX, -groundThick * 0.5, ((maxJ + 1) * tileSize) + (depthSpan * 0.5));
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Pit floor (single solid box, no seams) ----------
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    m.position.set(pitCenterX, -depth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Perimeter walls (slight overlap into ground & floor) ----------
  const wallHeight    = depth + groundThick + epsilon; // poke slightly into ground
  const wallThickness = Math.max(0.2 * tileSize, 0.1);
  const wallYCenter   = -depth * 0.5; // centered between 0 and -depth

  // -Z edge (front)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5), (minJ * tileSize) - (wallThickness * 0.5) + epsilon,
    metalMat, 0, 'pit_wall_front'
  ));
  // +Z edge (back)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5), ((maxJ + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    metalMat, 0, 'pit_wall_back'
  ));
  // -X edge (left)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    (minI * tileSize) - (wallThickness * 0.5) + epsilon, wallYCenter - (floorThick * 0.5), pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_left'
  ));
  // +X edge (right)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    ((maxI + 1) * tileSize) + (wallThickness * 0.5) - epsilon, wallYCenter - (floorThick * 0.5), pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_right'
  ));

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

/* ---------- Concrete (now LIT: PBR, reacts to lights & shadows) ---------- */
function makeConcretePBRMaterial() {
  const tex = makeConcreteCanvasTexture(512);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Gentle tiling; big slabs
  tex.repeat.set(6, 6);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    metalness: 0.0,
    roughness: 0.85
  });
  // Make sure self-shadowing looks clean
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}

function makeConcreteCanvasTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, size, size);

  // Soft noise clouds
  const bands = 140;
  for (let i = 0; i < bands; i++) {
    const y = Math.floor((i / bands) * size);
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Speckles
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < size * 2; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1.0;

  // Light seams grid
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
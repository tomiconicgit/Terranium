// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  // --- Input selection (same as before) ---
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;

  // --- Derive pit rectangle from selection tiles (AABB over tiles) ---
  const tiles = Array.isArray(selection.tiles) ? selection.tiles : [];
  let rect;
  if (tiles.length > 0) {
    let minI = +Infinity, maxI = -Infinity, minJ = +Infinity, maxJ = -Infinity;
    for (const t of tiles) {
      if (!Number.isFinite(t?.i) || !Number.isFinite(t?.j)) continue;
      if (t.i < minI) minI = t.i; if (t.i > maxI) maxI = t.i;
      if (t.j < minJ) minJ = t.j; if (t.j > maxJ) maxJ = t.j;
    }
    rect = { minI, maxI, minJ, maxJ };
  } else {
    // Fallback: 40×40 centered on (0,0)
    const sizeI = 40, sizeJ = 40;
    const halfI = Math.floor(sizeI / 2), halfJ = Math.floor(sizeJ / 2);
    rect = { minI: -halfI, maxI: -halfI + sizeI - 1, minJ: -halfJ, maxJ: -halfJ + sizeJ - 1 };
  }

  // === Whole pit move: i=19 → i=36 (shift by +17 tiles) ===
  // We just add +17 to BOTH minI and maxI so the entire rectangle translates intact.
  const SHIFT_I = 17; // <-- if you ever need a different move, change this value
  rect.minI += SHIFT_I;
  rect.maxI += SHIFT_I;

  // --- World constants ---
  const GRID = 100;           // build concrete frame inside a 100×100 world board
  const HALF = GRID / 2;

  // --- Group root ---
  const group = new THREE.Group();
  group.name = 'terrain_root';

  // --- Materials (PBR so lights affect them) ---
  const concreteMat = makeConcretePBRMaterial();     // outside pit @ y=0
  const metalMat    = makeMetalPBRMaterial();        // pit floor + walls

  // --- Dimensions ---
  const pitDepth      = 15;        // floor at -15
  const epsilon       = 0.02;      // to hide seams
  const groundThick   = 0.05;      // thin slabs at y≈0 (no z-fight)
  const floorThick    = 0.08;      // pit floor thickness
  const wallThickness = Math.max(0.2 * tileSize, 0.1);
  const wallHeight    = pitDepth + groundThick + epsilon;
  const wallYCenter   = -pitDepth * 0.5;

  // --- Pit spans (world units) ---
  const pitSpanX = (rect.maxI - rect.minI + 1) * tileSize;
  const pitSpanZ = (rect.maxJ - rect.minJ + 1) * tileSize;

  // --- World spans (board) ---
  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // --- Pit center (world units) ---
  const pitCenterX = (rect.minI + rect.maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (rect.minJ + rect.maxJ + 1) * 0.5 * tileSize;

  // ----------------------------------------------------
  // 1) Concrete at y≈0 AROUND the pit (four frame slabs)
  //    These leave a hole exactly where the pit is.
  // ----------------------------------------------------

  // Left frame (all tiles left of pit)
  if (rect.minI > -HALF) {
    const width = (rect.minI - (-HALF)) * tileSize;
    addSlab(group, concreteMat, width + epsilon, worldSpanZ + epsilon,
      ((-HALF) * tileSize) + (width * 0.5),
      -groundThick * 0.5,
      0,
      'ground_frame_left'
    );
  }

  // Right frame (all tiles right of pit)
  if (rect.maxI < HALF - 1) {
    const width = ((HALF - 1) - rect.maxI) * tileSize;
    addSlab(group, concreteMat, width + epsilon, worldSpanZ + epsilon,
      ((rect.maxI + 1) * tileSize) + (width * 0.5),
      -groundThick * 0.5,
      0,
      'ground_frame_right'
    );
  }

  // Front frame (−Z side)
  if (rect.minJ > -HALF) {
    const span = (rect.minJ - (-HALF)) * tileSize;
    addSlab(group, concreteMat, pitSpanX + epsilon, span + epsilon,
      pitCenterX,
      -groundThick * 0.5,
      ((-HALF) * tileSize) + (span * 0.5),
      'ground_frame_front'
    );
  }

  // Back frame (+Z side)
  if (rect.maxJ < HALF - 1) {
    const span = ((HALF - 1) - rect.maxJ) * tileSize;
    addSlab(group, concreteMat, pitSpanX + epsilon, span + epsilon,
      pitCenterX,
      -groundThick * 0.5,
      ((rect.maxJ + 1) * tileSize) + (span * 0.5),
      'ground_frame_back'
    );
  }

  // ----------------------------------------------------
  // 2) Pit floor at -15 (metal)
  // ----------------------------------------------------
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    m.position.set(pitCenterX, -pitDepth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  }

  // ----------------------------------------------------
  // 3) Metal perimeter walls (slightly overlapping floor/ground)
  // ----------------------------------------------------
  // -Z edge (front)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    (rect.minJ * tileSize) - (wallThickness * 0.5) + epsilon,
    metalMat, 0, 'pit_wall_front'
  ));
  // +Z edge (back)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5),
    ((rect.maxJ + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    metalMat, 0, 'pit_wall_back'
  ));
  // -X edge (left)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    (rect.minI * tileSize) - (wallThickness * 0.5) + epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_left'
  ));
  // +X edge (right)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    ((rect.maxI + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    wallYCenter - (floorThick * 0.5),
    pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_right'
  ));

  return group;
}

/* ---------------- helpers ---------------- */
function addSlab(group, mat, sx, sz, x, y, z, name) {
  const g = new THREE.BoxGeometry(sx, 0.05, sz);
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = true;
  group.add(m);
}

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

/* ---------- PBR concrete ---------- */
function makeConcretePBRMaterial() {
  const tex = makeConcreteCanvasTexture(512);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    metalness: 0.0,
    roughness: 0.85
  });
}

function makeConcreteCanvasTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, size, size);

  const bands = 140;
  for (let i = 0; i < bands; i++) {
    const y = Math.floor((i / bands) * size);
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, y, size, 1);
  }
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < size * 2; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1.0;

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

/* ---------- PBR metal for pit ---------- */
function makeMetalPBRMaterial() {
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

  ctx.fillStyle = '#b3b6bb';
  ctx.fillRect(0, 0, size, size);

  // brushed streaks
  for (let y = 0; y < size; y++) {
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const len = size * (0.4 + Math.random() * 0.6);
    const x   = Math.random() * (size - len);
    ctx.fillRect(x, y, len, 1);
  }

  // subtle plate seams
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
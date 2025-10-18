// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;

  // --- Determine pit rectangle in tile coordinates ---
  // Priority 1: explicit rectangle override (optional)
  let rect = (typeof window !== 'undefined' && window.PIT_RECT) ? sanitizeRect(window.PIT_RECT) : null;

  if (!rect) {
    const tiles = Array.isArray(selection.tiles) ? selection.tiles : [];
    if (tiles.length >= 2) {
      // Use AABB over provided tiles (works for outlines)
      let minI = +Infinity, maxI = -Infinity, minJ = +Infinity, maxJ = -Infinity;
      for (const t of tiles) {
        if (!Number.isFinite(t?.i) || !Number.isFinite(t?.j)) continue;
        if (t.i < minI) minI = t.i; if (t.i > maxI) maxI = t.i;
        if (t.j < minJ) minJ = t.j; if (t.j > maxJ) maxJ = t.j;
      }
      rect = { minI, maxI, minJ, maxJ };
    } else {
      // Single tile → default to 40×40 centered on that tile (override with size/sizeI/sizeJ)
      const center = tiles[0] || { i: 0, j: 0 };
      const sizeI = clampInt(selection.sizeI ?? selection.size ?? 40, 1, 2000);
      const sizeJ = clampInt(selection.sizeJ ?? selection.size ?? 40, 1, 2000);
      const halfI = Math.floor(sizeI / 2), halfJ = Math.floor(sizeJ / 2);
      rect = {
        minI: (center.i|0) - halfI,
        maxI: (center.i|0) + (sizeI - halfI - 1),
        minJ: (center.j|0) - halfJ,
        maxJ: (center.j|0) + (sizeJ - halfJ - 1)
      };
    }
  }

  // --- WHOLE-PIT MOVE (what you asked for) ---
  // Provide via opts.pitMove OR window.PIT_MOVE = { i:{from,to} | {di}, j:{from,to} | {dj} }
  const pitMove = opts.pitMove || (typeof window !== 'undefined' ? window.PIT_MOVE : null);
  if (pitMove) {
    rect = applyWholePitMove(rect, pitMove);
  }

  const { minI, maxI, minJ, maxJ } = rect;

  // World grid 100×100 centered on origin → i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials (PBR so lights affect them)
  const concreteMat = makeConcretePBRMaterial();     // outside pit
  const metalMat    = makeProceduralMetalMaterial(); // pit floor + walls

  // Common dims
  const depth        = 15;       // pit depth (-15)
  const epsilon      = 0.02;     // small overlap to hide seams
  const groundThick  = 0.05;     // thin ground slab (avoid z-fight)
  const floorThick   = 0.08;
  const wallThickness= Math.max(0.2 * tileSize, 0.1);

  // Pit span in world units
  const pitSpanX = (maxI - minI + 1) * tileSize;
  const pitSpanZ = (maxJ - minJ + 1) * tileSize;

  // Full world extents
  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // World center of the pit rect
  const pitCenterX = (minI + maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // ---------- Ground at level 0 (frame around the pit, not covering it) ----------
  // Left frame
  if (minI > -HALF) {
    const width = (minI - (-HALF)) * tileSize;
    addSlab(group, concreteMat, width + epsilon, worldSpanZ + epsilon,
      ((-HALF) * tileSize) + (width * 0.5), -groundThick * 0.5, 0, 'ground_frame_left');
  }
  // Right frame
  if (maxI < HALF - 1) {
    const width = ((HALF - 1) - maxI) * tileSize;
    addSlab(group, concreteMat, width + epsilon, worldSpanZ + epsilon,
      ((maxI + 1) * tileSize) + (width * 0.5), -groundThick * 0.5, 0, 'ground_frame_right');
  }
  // Front frame (-Z)
  if (minJ > -HALF) {
    const span = (minJ - (-HALF)) * tileSize;
    addSlab(group, concreteMat, pitSpanX + epsilon, span + epsilon,
      pitCenterX, -groundThick * 0.5, ((-HALF) * tileSize) + (span * 0.5), 'ground_frame_front');
  }
  // Back frame (+Z)
  if (maxJ < HALF - 1) {
    const span = ((HALF - 1) - maxJ) * tileSize;
    addSlab(group, concreteMat, pitSpanX + epsilon, span + epsilon,
      pitCenterX, -groundThick * 0.5, ((maxJ + 1) * tileSize) + (span * 0.5), 'ground_frame_back');
  }

  // ---------- Pit floor (solid plate at -15) ----------
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    m.position.set(pitCenterX, -depth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
  }

  // ---------- Perimeter walls ----------
  const wallHeight  = depth + groundThick + epsilon;
  const wallYCenter = -depth * 0.5;

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

/* ---------------- WHOLE-PIT MOVE helpers ---------------- */
function applyWholePitMove(rect, move) {
  const r = { ...rect };

  // Axis I
  if (move.i) {
    if (Number.isFinite(move.i.di)) {
      r.minI += move.i.di|0; r.maxI += move.i.di|0;
    } else if (Number.isFinite(move.i.from) && Number.isFinite(move.i.to)) {
      const from = move.i.from|0, to = move.i.to|0;
      // If either i-edge equals 'from', compute delta and shift both edges
      if (r.minI === from || r.maxI === from) {
        const di = to - from;
        r.minI += di; r.maxI += di;
      }
    }
  }
  // Axis J (same idea if you ever need it)
  if (move.j) {
    if (Number.isFinite(move.j.dj)) {
      r.minJ += move.j.dj|0; r.maxJ += move.j.dj|0;
    } else if (Number.isFinite(move.j.from) && Number.isFinite(move.j.to)) {
      const from = move.j.from|0, to = move.j.to|0;
      if (r.minJ === from || r.maxJ === from) {
        const dj = to - from;
        r.minJ += dj; r.maxJ += dj;
      }
    }
  }
  // Keep ordering correct
  if (r.minI > r.maxI) [r.minI, r.maxI] = [r.maxI, r.minI];
  if (r.minJ > r.maxJ) [r.minJ, r.maxJ] = [r.maxJ, r.minJ];
  return r;
}

/* ---------------- geometry helpers ---------------- */
function sanitizeRect(r) {
  const minI = Math.min(r.minI|0, r.maxI|0);
  const maxI = Math.max(r.minI|0, r.maxI|0);
  const minJ = Math.min(r.minJ|0, r.maxJ|0);
  const maxJ = Math.max(r.minJ|0, r.maxJ|0);
  return { minI, maxI, minJ, maxJ };
}
function clampInt(v, lo, hi){ v = (v|0); return Math.max(lo, Math.min(hi, v)); }

function addSlab(group, mat, sx, sz, x, y, z, name) {
  const g = new THREE.BoxGeometry(sx, 0.05, sz);
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = true;
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

/* ---------- Concrete: PBR so it reacts to light ---------- */
function makeConcretePBRMaterial() {
  const tex = makeConcreteCanvasTexture(512);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    metalness: 0.0,
    roughness: 0.85
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
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

  ctx.fillStyle = '#b3b6bb';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const len = size * (0.4 + Math.random() * 0.6);
    const x   = Math.random() * (size - len);
    ctx.fillRect(x, y, len, 1);
  }

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
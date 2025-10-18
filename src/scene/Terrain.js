// src/scene/Terrain.js
import * as THREE from 'three';

/**
 * Terrain with:
 * - A big concrete ground slab at y=0 (world-sized).
 * - A metal pit (floor at -15) sized 40×40 tiles, centered on a reference tile.
 * - Snap logic to move the edge that was at i=20 to i=40 (as per your last step).
 * - Rim details (hazard stripe caps + rim lights/bollards).
 * - Interior details (floor grate grid + angled deflectors).
 */
export function createTerrain(opts = {}) {
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const tiles     = Array.isArray(selection.tiles) ? selection.tiles : [];

  // Reference tile (centre). If none, default to origin.
  const ref = tiles[0] || { i: 0, j: 0 };
  const ci  = Number.isFinite(+ref.i) ? +ref.i : 0;
  const cj  = Number.isFinite(+ref.j) ? +ref.j : 0;

  // World grid 100×100 centered on origin ⇒ i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2;

  // === CONFIG ===
  const PIT_TILES_X = 40;
  const PIT_TILES_Z = 40;
  const depth       = 15;     // pit depth (floor around y=-15)
  const groundThick = 0.08;   // concrete ground thickness
  const floorThick  = 0.10;   // metal floor thickness
  const epsilon     = 0.02;   // anti-seam overlap

  // Centered bounds for an even-size (40): 19 to negative, 20 to positive side
  const NEG_X = Math.floor((PIT_TILES_X - 1) / 2); // 19
  const POS_X = PIT_TILES_X - 1 - NEG_X;           // 20
  const NEG_Z = Math.floor((PIT_TILES_Z - 1) / 2); // 19
  const POS_Z = PIT_TILES_Z - 1 - NEG_Z;           // 20

  // Inclusive tile bounds
  let minI = ci - NEG_X;
  let maxI = ci + POS_X;
  let minJ = cj - NEG_Z;
  let maxJ = cj + POS_Z;

  // Snap the edge at i=20 to i=40 (shift pit horizontally) – keeps your “correct spot”
  const wantSnap = selection.snapEdgeI || { from: 20, to: 40 };
  if (Number.isFinite(+wantSnap.from) && Number.isFinite(+wantSnap.to)) {
    if (minI === +wantSnap.from || maxI === +wantSnap.from) {
      const di = (+wantSnap.to) - (+wantSnap.from);
      minI += di; maxI += di;
    }
  }

  // Clamp to world bounds
  minI = Math.max(minI, -HALF);
  maxI = Math.min(maxI,  HALF - 1);
  minJ = Math.max(minJ, -HALF);
  maxJ = Math.min(maxJ,  HALF - 1);

  // Spans
  const pitTilesX = (maxI - minI + 1);
  const pitTilesZ = (maxJ - minJ + 1);
  const pitSpanX  = pitTilesX * tileSize;
  const pitSpanZ  = pitTilesZ * tileSize;

  const worldSpanX = GRID * tileSize;
  const worldSpanZ = GRID * tileSize;

  // Centers in world units (grid-aligned)
  const pitCenterX = (minI + maxI + 1) * 0.5 * tileSize;
  const pitCenterZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // Root group
  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Materials
  const concreteMat   = makeConcreteMaterial();
  const metalMat      = makeProceduralMetalMaterial();
  const hazardMat     = makeHazardStripeMaterial();
  const rimLightMat   = new THREE.MeshStandardMaterial({ color: 0x111418, emissive: 0x30364a, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.2 });
  const bollardMat    = new THREE.MeshStandardMaterial({ color: 0x59626b, roughness: 0.7, metalness: 0.3 });

  /* ------------------------------------------------------------------------ */
  /*  Concrete base slab (BRINGS BACK THE GROUND)                              */
  /* ------------------------------------------------------------------------ */
  {
    const g = new THREE.BoxGeometry(worldSpanX + 0.1, groundThick, worldSpanZ + 0.1);
    const m = new THREE.Mesh(g, concreteMat);
    m.name = 'ground_base';
    // Slightly below 0 so tops of walls meet cleanly without z-fighting.
    m.position.set(0, -groundThick * 0.5, 0);
    m.receiveShadow = true;
    group.add(m);
  }

  /* ------------------------------------------------------------------------ */
  /*  Metal pit floor                                                         */
  /* ------------------------------------------------------------------------ */
  {
    const g = new THREE.BoxGeometry(pitSpanX + epsilon, floorThick, pitSpanZ + epsilon);
    const m = new THREE.Mesh(g, metalMat);
    m.name = 'pit_floor';
    // Top of this slab ≈ -15 (nudged to avoid z-fight with wall bottoms)
    m.position.set(pitCenterX, -depth - floorThick * 0.5 + epsilon * 0.5, pitCenterZ);
    m.receiveShadow = true;
    group.add(m);
  }

  /* ------------------------------------------------------------------------ */
  /*  Perimeter walls                                                         */
  /* ------------------------------------------------------------------------ */
  const wallHeight    = depth + groundThick + epsilon; // overlap into ground slab
  const wallThickness = Math.max(0.2 * tileSize, 0.1);
  const wallYCenter   = -depth * 0.5;

  // -Z (front)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5), (minJ * tileSize) - (wallThickness * 0.5) + epsilon,
    metalMat, 0, 'pit_wall_front'
  ));
  // +Z (back)
  group.add(makeWall(
    pitSpanX + wallThickness, wallHeight, wallThickness,
    pitCenterX, wallYCenter - (floorThick * 0.5), ((maxJ + 1) * tileSize) + (wallThickness * 0.5) - epsilon,
    metalMat, 0, 'pit_wall_back'
  ));
  // -X (left)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    (minI * tileSize) - (wallThickness * 0.5) + epsilon, wallYCenter - (floorThick * 0.5), pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_left'
  ));
  // +X (right)
  group.add(makeWall(
    pitSpanZ + wallThickness, wallHeight, wallThickness,
    ((maxI + 1) * tileSize) + (wallThickness * 0.5) - epsilon, wallYCenter - (floorThick * 0.5), pitCenterZ,
    metalMat, Math.PI / 2, 'pit_wall_right'
  ));

  /* ------------------------------------------------------------------------ */
  /*  Rim details (hazard stripe caps + rim lights/bollards)                  */
  /* ------------------------------------------------------------------------ */
  addRimCaps(group, hazardMat, {
    minI, maxI, minJ, maxJ, tileSize,
    rimWidth: Math.max(0.35 * tileSize, 0.25)   // thickness of the cap
  });

  addRimLightsAndBollards(group, {                // small emissive lights & posts
    minI, maxI, minJ, maxJ, tileSize,
    spacingTiles: 4,                              // place every N tiles
    lightMat: rimLightMat,
    postMat:  bollardMat
  });

  /* ------------------------------------------------------------------------ */
  /*  Interior details (grate + angled deflectors)                            */
  /* ------------------------------------------------------------------------ */
  addFloorGrate(group, metalMat, {
    centerX: pitCenterX, centerZ: pitCenterZ,
    spanX: pitSpanX, spanZ: pitSpanZ,
    yTop: -depth + 0.02,                          // sits just above floor top
    barEvery: 2 * tileSize,                       // grid spacing
    barThick: 0.04,                               // bar thickness
    barHeight: 0.06
  });

  addAngledDeflectors(group, metalMat, {
    minI, maxI, minJ, maxJ, tileSize,
    yTop: -depth + 0.0,
    inset: 2.0 * tileSize,                        // inset from each wall
    length: 6.0 * tileSize,
    height: 2.0,                                   // plate height
    angle: THREE.MathUtils.degToRad(28)           // lean angle
  });

  /* ------------------------------------------------------------------------ */
  /*  Debug/export helpers                                                    */
  /* ------------------------------------------------------------------------ */
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

/* ---------------- RIM HELPERS ---------------- */

function addRimCaps(root, hazardMat, { minI, maxI, minJ, maxJ, tileSize, rimWidth }) {
  const y = 0.01; // tiny offset above ground to avoid z-fight
  const spanX = (maxI - minI + 1) * tileSize;
  const spanZ = (maxJ - minJ + 1) * tileSize;
  const centerX = (minI + maxI + 1) * 0.5 * tileSize;
  const centerZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  // Front cap (-Z edge)
  root.add(makeCap(
    spanX + rimWidth, rimWidth, centerX, y, (minJ * tileSize) - rimWidth * 0.5, hazardMat, 0, 'rim_cap_front'
  ));
  // Back cap (+Z edge)
  root.add(makeCap(
    spanX + rimWidth, rimWidth, centerX, y, ((maxJ + 1) * tileSize) + rimWidth * 0.5, hazardMat, 0, 'rim_cap_back'
  ));
  // Left cap (-X edge) – rotate 90° to align along Z
  const left = makeCap(spanZ + rimWidth, rimWidth, (minI * tileSize) - rimWidth * 0.5, y, centerZ, hazardMat, Math.PI/2, 'rim_cap_left');
  root.add(left);
  // Right cap (+X edge)
  const right = makeCap(spanZ + rimWidth, rimWidth, ((maxI + 1) * tileSize) + rimWidth * 0.5, y, centerZ, hazardMat, Math.PI/2, 'rim_cap_right');
  root.add(right);
}

function makeCap(length, width, x, y, z, material, rotY = 0, name = 'rim_cap') {
  const geo = new THREE.BoxGeometry(length, 0.06, width);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addRimLightsAndBollards(root, { minI, maxI, minJ, maxJ, tileSize, spacingTiles, lightMat, postMat }) {
  const spacing = Math.max(1, spacingTiles) * tileSize;
  const yLight = 0.18;
  const yPost  = 0.0;
  const postH  = 0.55;
  const postR  = 0.06;

  const addPairAlongX = (jWorld) => {
    let x0 = (minI * tileSize);
    let x1 = ((maxI + 1) * tileSize);
    for (let x = x0; x <= x1; x += spacing) {
      // Light
      root.add(makeLightBox(x, yLight, jWorld, 0.20 * tileSize, 0.06, 0.12 * tileSize, lightMat));
      // Bollard
      root.add(makePost(x, yPost, jWorld + Math.sign(jWorld) * 0.18, postR, postH, postMat));
    }
  };
  const addPairAlongZ = (iWorld) => {
    let z0 = (minJ * tileSize);
    let z1 = ((maxJ + 1) * tileSize);
    for (let z = z0; z <= z1; z += spacing) {
      root.add(makeLightBox(iWorld, yLight, z, 0.12 * tileSize, 0.06, 0.20 * tileSize, lightMat));
      root.add(makePost(iWorld + Math.sign(iWorld) * 0.18, yPost, z, postR, postH, postMat));
    }
  };

  addPairAlongX((minJ * tileSize) - 0.22);
  addPairAlongX(((maxJ + 1) * tileSize) + 0.22);
  addPairAlongZ((minI * tileSize) - 0.22);
  addPairAlongZ(((maxI + 1) * tileSize) + 0.22);
}

function makeLightBox(x, y, z, sx, sy, sz, mat) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function makePost(x, y, z, radius, height, mat) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + height * 0.5, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------------- INTERIOR HELPERS ---------------- */

function addFloorGrate(root, mat, { centerX, centerZ, spanX, spanZ, yTop, barEvery, barThick, barHeight }) {
  // Grate bars along X direction
  const nx = Math.max(2, Math.floor(spanZ / barEvery));
  const bz = spanZ / nx;
  const barGeoX = new THREE.BoxGeometry(spanX, barHeight, barThick);
  const barsX = new THREE.InstancedMesh(barGeoX, mat, nx);
  barsX.name = 'grate_bars_x';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < nx; i++) {
    const z = centerZ - spanZ * 0.5 + (i + 0.5) * bz;
    dummy.position.set(centerX, yTop + barHeight * 0.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    barsX.setMatrixAt(i, dummy.matrix);
  }
  root.add(barsX);

  // Grate bars along Z direction
  const nz = Math.max(2, Math.floor(spanX / barEvery));
  const bx = spanX / nz;
  const barGeoZ = new THREE.BoxGeometry(barThick, barHeight, spanZ);
  const barsZ = new THREE.InstancedMesh(barGeoZ, mat, nz);
  barsZ.name = 'grate_bars_z';
  for (let i = 0; i < nz; i++) {
    const x = centerX - spanX * 0.5 + (i + 0.5) * bx;
    dummy.position.set(x, yTop + barHeight * 0.5, centerZ);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    barsZ.setMatrixAt(i, dummy.matrix);
  }
  root.add(barsZ);
}

function addAngledDeflectors(root, mat, { minI, maxI, minJ, maxJ, tileSize, yTop, inset, length, height, angle }) {
  // Two simple angled plates facing each other along +Z and -Z near the center
  const centerX = (minI + maxI + 1) * 0.5 * tileSize;
  const centerZ = (minJ + maxJ + 1) * 0.5 * tileSize;

  const plateGeo = new THREE.BoxGeometry(length, height, 0.12); // thin plate
  const makePlate = (x, z, rotY, name) => {
    const m = new THREE.Mesh(plateGeo, mat);
    m.name = name;
    m.position.set(x, yTop + height * 0.5, z);
    m.rotation.set(angle, rotY, 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  // Forward plate (faces -Z → +Z)
  root.add(makePlate(centerX, centerZ - inset, 0, 'deflector_front'));
  // Back plate
  root.add(makePlate(centerX, centerZ + inset, Math.PI, 'deflector_back'));
}

/* ---------------- PRIMITIVES ---------------- */

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

/* ---------------- MATERIALS ---------------- */

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
  mat.polygonOffset = true; // avoid rim z-fighting
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  return mat;
}

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

function makeHazardStripeMaterial() {
  const tex = makeHazardStripeTexture(512);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.4,
    roughness: 0.6,
    map: tex,
    emissive: new THREE.Color(0x111111),
    emissiveIntensity: 0.25
  });
}

/* ---------------- CANVAS TEXTURES ---------------- */

function makeMetalCanvasTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base steel tone
  ctx.fillStyle = '#b3b6bb';
  ctx.fillRect(0, 0, size, size);

  // Brushed streaks
  for (let y = 0; y < size; y++) {
    const a = 0.06 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const len = size * (0.4 + Math.random() * 0.6);
    const x   = Math.random() * (size - len);
    ctx.fillRect(x, y, len, 1);
  }

  // Plate seams
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

function makeHazardStripeTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.floor(size * 0.25);
  const ctx = canvas.getContext('2d');

  // Diagonal yellow/black stripes
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stripeW = Math.floor(canvas.height * 0.9);
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = '#f7d10d';
    ctx.fillRect(0, 0, stripeW * 0.5, canvas.height * 2);
    ctx.restore();
  }

  // grime pass
  ctx.globalAlpha = 0.25;
  for (let y = 0; y < canvas.height; y++) {
    const a = Math.random() * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    const len = canvas.width * (0.2 + Math.random() * 0.8);
    const x   = Math.random() * (canvas.width - len);
    ctx.fillRect(x, y, len, 1);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}
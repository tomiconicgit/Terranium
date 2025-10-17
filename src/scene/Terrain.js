// src/scene/Terrain.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

export function createTerrain(opts = {}) {
  // Allow passing selection, else read from global, else empty
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;
  const tiles     = Array.isArray(selection.tiles) ? selection.tiles : [];

  const group = new THREE.Group();
  group.name = 'terrain_root';

  // ----- Materials (procedural-ish) -----
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a, metalness: 1.0, roughness: 0.25
  });

  // Minimal “procedural concrete” via a tiny noise ShaderMaterial
  const concreteMat = makeConcreteMaterial();

  // ----- Ground plane 100x100 at y=0 -----
  // world extent: 100 x 100 meters centered at origin => from -50..+50 on X/Z
  const groundSize = 100 * tileSize;
  const groundGeo  = new THREE.PlaneGeometry(groundSize, groundSize, 100, 100);
  const ground     = new THREE.Mesh(groundGeo, concreteMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground_terrain';
  group.add(ground);

  if (tiles.length === 0) {
    // Nothing else to build; return the base ground
    return group;
  }

  // ----- Build the pit floor at y = -15 for each provided tile -----
  const depth = 15; // from y=0 down to -15
  const tileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
  tileGeo.rotateX(-Math.PI / 2);

  // Use InstancedMesh for performance
  const pitFloor = new THREE.InstancedMesh(tileGeo, metalMat, tiles.length);
  pitFloor.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pitFloor.castShadow = false;
  pitFloor.receiveShadow = true;
  pitFloor.name = 'metal_floor';

  const m = new THREE.Matrix4();
  for (let idx = 0; idx < tiles.length; idx++) {
    const t = tiles[idx];
    const x = t.i * tileSize;
    const z = t.j * tileSize;
    m.makeTranslation(x, -depth, z);
    pitFloor.setMatrixAt(idx, m);
  }
  pitFloor.instanceMatrix.needsUpdate = true;
  group.add(pitFloor);

  // ----- Metal perimeter walls from -15 up to 0 around the selection -----
  // We’ll build a simple rectangular perimeter using the bounds of the tiles.
  const { minI, maxI, minJ, maxJ } = getBounds(tiles);

  // Outer rectangle at ground level (y=0), walls drop to -depth
  const wallHeight = depth;
  const wallThickness = 0.2 * tileSize;

  // Lengths along each side (span the tile bounds in world units)
  const spanX = (maxI - minI + 1) * tileSize;
  const spanZ = (maxJ - minJ + 1) * tileSize;

  // Create 4 boxes: +X edge, -X edge, +Z edge, -Z edge
  const wallYCenter = -depth / 2; // halfway between 0 and -depth

  const walls = new THREE.Group();
  walls.name = 'metal_walls';

  // Along X (front/back)
  walls.add(makeWall(spanX, wallHeight, wallThickness,  (minI + maxI + 1) * 0.5 * tileSize, wallYCenter, (minJ - 0.5) * tileSize, metalMat)); // -Z side
  walls.add(makeWall(spanX, wallHeight, wallThickness,  (minI + maxI + 1) * 0.5 * tileSize, wallYCenter, (maxJ + 0.5) * tileSize, metalMat)); // +Z side

  // Along Z (left/right)
  const wallZRot = Math.PI / 2;
  walls.add(makeWall(spanZ, wallHeight, wallThickness,  (minI - 0.5) * tileSize, wallYCenter, (minJ + maxJ + 1) * 0.5 * tileSize, metalMat, wallZRot)); // -X side
  walls.add(makeWall(spanZ, wallHeight, wallThickness,  (maxI + 0.5) * tileSize, wallYCenter, (minJ + maxJ + 1) * 0.5 * tileSize, metalMat, wallZRot)); // +X side

  group.add(walls);

  return group;
}

// Helpers
function getBounds(tiles) {
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  for (const t of tiles) {
    if (t.i < minI) minI = t.i;
    if (t.i > maxI) maxI = t.i;
    if (t.j < minJ) minJ = t.j;
    if (t.j > maxJ) maxJ = t.j;
  }
  // if something went weird, avoid Infinities
  if (!isFinite(minI)) { minI = 0; maxI = -1; }
  if (!isFinite(minJ)) { minJ = 0; maxJ = -1; }
  return { minI, maxI, minJ, maxJ };
}

function makeWall(length, height, thickness, x, y, z, material, rotY = 0) {
  const geo = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Very small “procedural” concrete shader: per-fragment noise + speckle
function makeConcreteMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0xbdbdbd) }, // light gray
    uColorB: { value: new THREE.Color(0x9e9e9e) }, // mid gray
  };

  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv * 10.0; // scale for more detail
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Cheap hash/noise
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
      base *= (1.0 - 0.05 * speck); // tiny dark speckles
      // very subtle AO-ish darkening
      base *= 0.95 + 0.05 * noise(vUv * 0.5);
      gl_FragColor = vec4(base, 1.0);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    lights: false
  });

  // Wrap with MeshStandardMaterial-like properties using onBeforeCompile if desired.
  // Keep it simple: use ShaderMaterial for color, rely on scene lights for shading via base Lambertian look.
  // To participate in lighting, we'd need a full PBR shader; this minimal version is for visuals only.
  // If you want it lit, swap to MeshStandardMaterial with a canvas-generated texture.

  // To still receive light/shadows in a basic way, we can convert it to a standard material with a procedurally
  // generated canvas texture. Keeping ShaderMaterial for brevity/clarity here.

  return mat;
}
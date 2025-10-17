// src/scene/Terrain.js
import * as THREE from 'three';

export function createTerrain(opts = {}) {
  // Read selection (or window global)
  const selection = opts.selection || (typeof window !== 'undefined' ? window.EXCAVATION_SELECTION : null) || {};
  const tileSize  = typeof selection.tileSize === 'number' ? selection.tileSize : 1;

  // Center tile defaults to (0,0) if not provided
  const center = (Array.isArray(selection.tiles) && selection.tiles[0]) || { i: 0, j: 0 };
  const ci = Number.isFinite(center.i) ? center.i : 0;
  const cj = Number.isFinite(center.j) ? center.j : 0;

  // Area to lower: 30×30 tiles “around” the center tile.
  // For an even size (30), we’ll take 15 to the - side and 14 to the + side (total 30).
  const halfMinus = 15;
  const halfPlus  = 14;
  const minI = ci - halfMinus, maxI = ci + halfPlus;
  const minJ = cj - halfMinus, maxJ = cj + halfPlus;

  // World grid we render: 100×100 tiles centered on origin => i,j in [-50..49]
  const GRID = 100;
  const HALF = GRID / 2; // 50

  const group = new THREE.Group();
  group.name = 'terrain_root';

  // Procedural-ish concrete
  const concreteMat = makeConcreteMaterial();

  // Single plane tile, Instanced across the grid
  const tileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
  tileGeo.rotateX(-Math.PI / 2); // face up

  const count = GRID * GRID;
  const tiles = new THREE.InstancedMesh(tileGeo, concreteMat, count);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.name = 'ground_terrain';
  tiles.receiveShadow = true;

  // Place every tile; lower the 30×30 region to -15
  const depth = 15;
  const m = new THREE.Matrix4();
  let idx = 0;
  for (let j = -HALF; j < HALF; j++) {
    for (let i = -HALF; i < HALF; i++) {
      const inPit = (i >= minI && i <= maxI && j >= minJ && j <= maxJ);
      const y = inPit ? -depth : 0;
      const x = (i + 0.5) * tileSize;
      const z = (j + 0.5) * tileSize;
      m.makeTranslation(x, y, z);
      tiles.setMatrixAt(idx++, m);
    }
  }
  tiles.instanceMatrix.needsUpdate = true;

  group.add(tiles);
  return group;
}

/* ---------- tiny “procedural concrete” shader ---------- */
function makeConcreteMaterial() {
  const uniforms = {
    uColorA: { value: new THREE.Color(0xbdbdbd) },
    uColorB: { value: new THREE.Color(0x9e9e9e) },
  };

  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv * 10.0; // more detail
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
      base *= (1.0 - 0.05 * speck);
      base *= 0.95 + 0.05 * noise(vUv * 0.5);
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
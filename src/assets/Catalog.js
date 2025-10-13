// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Catalog (only concrete) ---------- */
export function makeCatalog() {
  return [
    { id:"concrete_flat",  name:"Concrete Floor", baseType:"flat", kind:"flat",
      material: matConcrete, size:{x:3, y:0.2, z:3}, preview:"#b9b9b9" },

    { id:"concrete_wall",  name:"Concrete Wall",  baseType:"wall", kind:"wall",
      material: matConcrete, size:{x:3, y:3, z:0.2}, preview:"#c7c7c7" },
  ];
}

/* ---------- Mesh builder (simple box) ---------- */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z, 1, 1, 1),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/* ---------- Realistic Concrete Material (Procedural Color + Normals) ---------- */
let _concreteMaps = null;

function createConcreteMaps(size = 512) {
  const mapData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);

  // High-quality noise function for realism
  const fbm = (x, y, octaves) => {
    let sum = 0, amp = 0.5, freq = 2.0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * pseudo(x * freq + y * freq * 57.0);
      amp *= 0.5; freq *= 2.0;
    }
    return sum;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;

      // --- Color Map ---
      let c = 0.6 + fbm(nx, ny, 5) * 0.1; // Base grey
      c += fbm(nx * 3.0, ny * 3.0, 6) * 0.05; // Mottling/stains
      c = THREE.MathUtils.clamp(c, 0.0, 1.0);
      const g = Math.round(c * 255);
      mapData[i] = mapData[i+1] = mapData[i+2] = g;
      mapData[i+3] = 255;

      // --- Normal Map (from noise gradient) ---
      const strength = 0.4;
      const e = 1 / size; // epsilon for sampling neighbors
      const h_center = fbm(nx, ny, 4);
      const h_x = fbm(nx + e, ny, 4);
      const h_y = fbm(nx, ny + e, 4);
      
      const n = new THREE.Vector3(
        (h_center - h_x) * strength,
        (h_center - h_y) * strength,
        1.0
      ).normalize();
      
      normalData[i]   = (n.x * 0.5 + 0.5) * 255; // R
      normalData[i+1] = (n.y * 0.5 + 0.5) * 255; // G
      normalData[i+2] = (n.z * 0.5 + 0.5) * 255; // B
      normalData[i+3] = 255;
    }
  }

  const map = new THREE.DataTexture(mapData, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  
  const normalMap = new THREE.DataTexture(normalData, size, size);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.needsUpdate = true;

  return { map, normalMap };
}

function getConcreteMaps() {
  if (!_concreteMaps) _concreteMaps = createConcreteMaps();
  return _concreteMaps;
}

function matConcrete() {
  const { map, normalMap } = getConcreteMaps();
  return new THREE.MeshStandardMaterial({
    map: map,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8), // Adjust strength of bumps
    roughness: 0.85,
    metalness: 0.0,
  });
}

function pseudo(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967295;
}

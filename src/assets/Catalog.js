// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Catalog ---------- */
export function makeCatalog() {
  return [
    { id:"concrete_flat",  name:"Concrete Floor", baseType:"flat", kind:"flat",
      material: matConcrete, size:{x:3, y:0.2, z:3}, preview:"#b9b9b9" },
    { id:"concrete_wall",  name:"Concrete Wall",  baseType:"wall", kind:"wall",
      material: matConcrete, size:{x:3, y:3, z:0.2}, preview:"#c7c7c7" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/* ---------- High-Quality, Seamless Concrete Material ---------- */
let _concreteMaps = null;

function createConcreteMaps(size = 1024) { // Increased resolution
  const mapData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);

  const { fbm, valueNoise } = setupNoise();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;

      // Color Map: Layered noise for detail
      let c = 0.5 + fbm(nx * 1.5, ny * 1.5, 5) * 0.2; // Base blotches
      c += fbm(nx * 6, ny * 6, 4) * 0.05;          // Medium detail
      c += fbm(nx * 18, ny * 18, 3) * 0.02;        // Fine grain
      c = THREE.MathUtils.clamp(c, 0.2, 0.8);
      const g = Math.round(c * 255);
      mapData[i] = mapData[i+1] = mapData[i+2] = g;
      mapData[i+3] = 255;

      // Normal Map: Gradient of noise for bumps and pits
      const strength = 0.6;
      const e = 1 / size;
      const h_center = fbm(nx * 5, ny * 5, 4);
      const h_x = fbm((nx + e) * 5, ny * 5, 4);
      const h_y = fbm(nx * 5, (ny + e) * 5, 4);
      
      const n = new THREE.Vector3((h_center - h_x), (h_center - h_y), e / strength).normalize();
      normalData[i]   = (n.x * 0.5 + 0.5) * 255;
      normalData[i+1] = (n.y * 0.5 + 0.5) * 255;
      normalData[i+2] = 1.0 * 255;
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
  const mat = new THREE.MeshStandardMaterial({
    map: map,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.8,
    metalness: 0.0,
  });

  // This is the key to seamless tiling
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vWorldPosition = worldPosition.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);`
    );

    shader.fragmentShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      
      // Select UVs based on world-space face direction (simple triplanar)
      vec2 getSeamlessUVs() {
        vec3 absNormal = abs(vWorldNormal);
        if (absNormal.y > absNormal.x && absNormal.y > absNormal.z) {
          return vWorldPosition.xz; // Top/Bottom face
        } else if (absNormal.x > absNormal.y && absNormal.x > absNormal.z) {
          return vWorldPosition.yz; // Left/Right face
        }
        return vWorldPosition.xy; // Front/Back face
      }
    ` + shader.fragmentShader;

    // Replace default UV with our world-space UVs
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_particle_fragment>',
      `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
        vec2 seamlessUV = getSeamlessUVs() * 0.33; // Scale texture
      #endif
      ` + shader.fragmentShader.substring(shader.fragmentShader.indexOf('#include <map_particle_fragment>'))
    );
    shader.fragmentShader = shader.fragmentShader.replace(/vUv/g, 'seamlessUV');
  };

  return mat;
}

// Helper for generating high-quality noise
function setupNoise() {
  const lerp = (a, b, t) => a + (b - a) * t;
  const fade = (t) => t*t*t*(t*(t*6-15)+10);
  function hash(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n^(n>>13))*1274126177; return ((n^(n>>16))>>>0)/4294967295;
  }
  function valueNoise(x, y) {
    const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
    const s=hash(xi,yi), t=hash(xi+1,yi), u=hash(xi,yi+1), v=hash(xi+1,yi+1);
    const sx=fade(xf), sy=fade(yf);
    return lerp(lerp(s,t,sx), lerp(u,v,sx), sy);
  }
  const fbm = (x, y, octaves) => {
    let sum=0, amp=0.5, freq=1;
    for (let i=0; i<octaves; i++) {
      sum += amp * valueNoise(x*freq, y*freq); amp*=0.5; freq*=2;
    }
    return sum;
  };
  return { fbm, valueNoise };
}

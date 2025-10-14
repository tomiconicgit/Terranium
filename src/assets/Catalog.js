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

/* ---------- High-Quality, Seamless Concrete Material (Cleaned Up) ---------- */
let _concreteMaps = null;

function createConcreteMaps(size = 1024) { // Increased resolution for better detail
  const mapData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);

  const { fbm, valueNoise } = setupNoise();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;

      // --- Color Map: Subtle, layered noise for a cleaner look ---
      // Reduced frequencies and amplitudes to make the pattern less "busy"
      let c = 0.6 + fbm(nx * 1.0, ny * 1.0, 4) * 0.1;   // Base, very subtle large variations
      c += fbm(nx * 4.0, ny * 4.0, 3) * 0.03;          // Smaller, softer variations
      c = THREE.MathUtils.clamp(c, 0.4, 0.8);          // Kept within a tighter, brighter range
      const g = Math.round(c * 255);
      mapData[i] = mapData[i+1] = mapData[i+2] = g;
      mapData[i+3] = 255;

      // --- Normal Map: Subtle gradient of noise for surface variation ---
      // Lower strength for a smoother feel
      const strength = 0.3; // Reduced strength for less pronounced bumps
      const e = 1 / size;
      const h_center = fbm(nx * 3, ny * 3, 3); // Frequencies adjusted for smoother normals
      const h_x = fbm((nx + e) * 3, ny * 3, 3);
      const h_y = fbm(nx * 3, (ny + e) * 3, 3);
      
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
    normalScale: new THREE.Vector2(0.5, 0.5), // Further reduced for a smoother look
    roughness: 0.7, // Slightly smoother reflection
    metalness: 0.0,
  });

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
      
      vec2 getSeamlessUVs() {
        vec3 absNormal = abs(vWorldNormal);
        if (absNormal.y > absNormal.x && absNormal.y > absNormal.z) {
          return vWorldPosition.xz;
        } else if (absNormal.x > absNormal.y && absNormal.x > absNormal.z) {
          return vWorldPosition.yz;
        }
        return vWorldPosition.xy;
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_particle_fragment>',
      `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
        vec2 seamlessUV = getSeamlessUVs() * 0.2; // Adjusted scale for larger, smoother pattern
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

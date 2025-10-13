// src/assets/Catalog.js
import * as THREE from 'three';

/* ---------- Catalog ---------- */
export function makeCatalog() {
  return [
    { id:'metal_flat',    name:'Metal Flat',    baseType:'flat', kind:'flat',  material: matMetal,
      size:{ x:3, y:0.2, z:3 }, thickness:0.2, preview:'#b8c2cc' },

    { id:'metal_wall',    name:'Metal Wall',    baseType:'wall', kind:'wall',  material: matWall,
      size:{ x:3, y:3,   z:0.2 }, thickness:0.2, preview:'#dfe6ee' },

    { id:'concrete_flat', name:'Concrete Flat', baseType:'flat', kind:'flat',  material: matConcrete,
      size:{ x:3, y:0.2, z:3 }, thickness:0.2, preview:'#9a9a9a' },

    { id:'concrete_wall', name:'Concrete Wall', baseType:'wall', kind:'wall',  material: matConcrete,
      size:{ x:3, y:3,   z:0.2 }, thickness:0.2, preview:'#c0c0c0' },
  ];
}

/* Creates a mesh group for a given part definition. */
export function buildPart(def) {
  const g = new THREE.Group();
  const mat = def.material();

  let mesh = null;
  if (def.baseType === 'wall') {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness),
      mat
    );
  } else if (def.baseType === 'flat') {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z),
      mat
    );
  }
  if (mesh) g.add(mesh);
  return g;
}

/* ---------- Materials ---------- */

function matMetal() {
  return new THREE.MeshStandardMaterial({
    color: 0x9ea6af,
    roughness: 0.45,
    metalness: 0.85
  });
}

function matWall() {
  return new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    roughness: 0.40,
    metalness: 0.90
  });
}

/* ----- Procedural Concrete (fixed) ----- */
/* Use RGBA data + sRGB color space so mobiles (iOS/Safari) pick SRGB8_ALPHA8. */

let concreteColorMap = null;

function createNoiseTexture(width, height, baseGray, range) {
  const size = width * height;
  const data = new Uint8Array(4 * size); // RGBA

  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const g = Math.floor(baseGray + Math.random() * range); // 0..255
    data[stride + 0] = g;   // R
    data[stride + 1] = g;   // G
    data[stride + 2] = g;   // B
    data[stride + 3] = 255; // A (ensures SRGB8_ALPHA8 path)
  }

  const tex = new THREE.DataTexture(data, width, height); // default RGBAFormat
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace; // tell three this is sRGB data
  tex.needsUpdate = true;
  return tex;
}

function matConcrete() {
  if (!concreteColorMap) {
    // light grey noise (looks like cast concrete)
    concreteColorMap = createNoiseTexture(64, 64, 160, 80);
  }

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,       // let the map carry the tone
    map: concreteColorMap, // sRGB RGBA DataTexture
    metalness: 0.0,
    roughness: 0.9
  });

  // tile a bit across 3×3 faces
  if (mat.map) mat.map.repeat.set(3, 3);

  return mat;
}
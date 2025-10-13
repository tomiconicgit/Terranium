// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Catalog ---------- */
export function makeCatalog() {
  return [
    { id:"metal_flat",    name:"Metal Flat",    baseType:"flat", kind:"flat",  material: matMetal,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#b8c2cc" },

    { id:"metal_wall",    name:"Metal Wall",    baseType:"wall", kind:"wall",  material: matWall,
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#dfe6ee" },

    { id:"concrete_flat", name:"Concrete Flat", baseType:"flat", kind:"flat",  material: matConcrete,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#b9b9b9" },

    { id:"concrete_wall", name:"Concrete Wall", baseType:"wall", kind:"wall",  material: matConcrete,
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#c7c7c7" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();

  let mesh = null;
  if (def.baseType === "wall") {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness, 1, 1, 1),
      material
    );
  } else {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z, 1, 1, 1),
      material
    );
  }

  // give slight bevel look by expanding geometry normals out a bit
  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  g.add(mesh);
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
    roughness: 0.4,
    metalness: 0.9
  });
}

/* ---------- Smooth, solid concrete with slab-edge shading ---------- */

let _concreteTex = null;

function createSmoothConcreteTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // subtle smooth noise
      const n = Math.floor(170 + 8 * Math.sin((x * 0.05) + (y * 0.07)) + 8 * Math.cos((x * 0.04)));
      const i = (y * size + x) * 4;
      data[i] = data[i+1] = data[i+2] = n;
      data[i+3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function concreteTexture() {
  if (!_concreteTex) _concreteTex = createSmoothConcreteTexture(256);
  return _concreteTex;
}

function matConcrete() {
  const tex = concreteTexture();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.35,
    sheen: 0.2,
    sheenColor: new THREE.Color(0x9d9d9d)
  });

  // make seams visible via lighting falloff at edges
  mat.side = THREE.FrontSide;
  mat.map.repeat.set(3, 3);

  return mat;
}
// src/assets/Catalog.js
import * as THREE from "three";
import { createMetalPanelMaterial } from "../materials/ProcPanel.js";

/* ---------- Catalog ---------- */
export function makeCatalog() {
  return [
    // Metal — fully procedural panels (no textures)
    { id:"metal_flat", name:"Metal Flat", baseType:"flat", kind:"flat",
      material: () => matMetalFlat(),
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#a7b6c2" },

    { id:"metal_wall", name:"Metal Wall", baseType:"wall", kind:"wall",
      material: () => matMetalWall(),
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#dbe6f3" },

    // Your concrete (unchanged)
    { id:"concrete_flat", name:"Concrete Flat", baseType:"flat", kind:"flat",
      material: matConcrete,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#b9b9b9" },

    { id:"concrete_wall", name:"Concrete Wall", baseType:"wall", kind:"wall",
      material: matConcrete,
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#c7c7c7" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();

  let mesh;
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

  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  g.add(mesh);
  return g;
}

/* ---------- Materials ---------- */

// Procedural metal panels tuned separately for floor & wall
function matMetalFlat() {
  return createMetalPanelMaterial({
    baseColor: 0x8fa2b3,
    metalness: 0.9,
    roughness: 0.38,
    panelSize: 0.9,     // multiple panels across a 3m tile
    seamWidth: 0.03,
    seamDark:  0.55,
    bolts: true,
    boltRadius: 0.05,
    mode: 'flat'
  });
}
function matMetalWall() {
  return createMetalPanelMaterial({
    baseColor: 0xaec2d3,
    metalness: 0.9,
    roughness: 0.4,
    panelSize: 0.8,     // denser panels on walls
    seamWidth: 0.028,
    seamDark:  0.6,
    bolts: true,
    boltRadius: 0.045,
    mode: 'wall'
  });
}

/* ---------- Your existing concrete material ---------- */
let _concreteTex = null;
function createSmoothConcreteTexture(size = 256) {
  const period = size;
  const data   = new Uint8Array(size * size * 4);
  const grid = new Float32Array((period + 1) * (period + 1));
  for (let y = 0; y <= period; y++) {
    for (let x = 0; x <= period; x++) {
      const i = y * (period + 1) + x;
      const rx = x % period, ry = y % period;
      grid[i] = pseudo(rx * 374761393 + ry * 668265263);
    }
  }
  const fade = t => t*t*(3-2*t);
  const sample = (nx, ny) => {
    const x0 = Math.floor(nx) % period, y0 = Math.floor(ny) % period;
    const x1 = (x0 + 1) % period,       y1 = (y0 + 1) % period;
    const fx = nx - Math.floor(nx),     fy = ny - Math.floor(ny);
    const i00 = y0*(period+1)+x0, i10 = y0*(period+1)+x1;
    const i01 = y1*(period+1)+x0, i11 = y1*(period+1)+x1;
    const a = grid[i00], b = grid[i10], c = grid[i01], d = grid[i11];
    const u = fade(fx), v = fade(fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,u), THREE.MathUtils.lerp(c,d,u), v);
  };

  const amp0 = 0.22, scale0 = 0.018;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let f = 0, amp = amp0, sc = scale0;
      for (let o = 0; o < 4; o++) { f += amp * sample(x*sc*period, y*sc*period); amp*=0.5; sc*=2.0; }
      const g = Math.round(172 + (f - 0.5) * 26);
      const i = (y * size + x) * 4;
      data[i+0]=g; data[i+1]=g; data[i+2]=g; data[i+3]=255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
function concreteTexture() { if (!_concreteTex) _concreteTex = createSmoothConcreteTexture(256); return _concreteTex; }
function matConcrete() {
  const tex = concreteTexture();
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.98,
    metalness: 0.0,
    envMapIntensity: 0
  });
}

/* tiny deterministic PRNG */
function pseudo(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967295;
}
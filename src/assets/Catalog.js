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
  const material = def.material(); // returns a MeshStandardMaterial

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z, 1, 1, 1),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  g.add(mesh);
  return g;
}

/* ---------- Concrete material (procedural) ---------- */
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
function concreteTexture() {
  if (!_concreteTex) _concreteTex = createSmoothConcreteTexture(256);
  return _concreteTex;
}
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
function pseudo(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967295;
}
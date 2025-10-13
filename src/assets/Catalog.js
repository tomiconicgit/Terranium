// src/assets/Catalog.js
import * as THREE from "three";

/* ---------------- Catalog ---------------- */
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

/* Create a mesh group for the part (origin at geometric center) */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();

  let core = null;
  if (def.baseType === "wall") {
    core = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness),
      material
    );
  } else {
    core = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.thickness, def.size.z),
      material
    );
  }
  if (core) g.add(core);

  // Add physical seam grooves for concrete only (robust on all devices)
  if (def.id.startsWith("concrete_")) addConcreteSeams(g, def);

  return g;
}

/* ---------------- Materials ---------------- */

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

/* -------- Smooth, tileable concrete (iOS-safe) -------- */

let _concreteTex = null;

function createSmoothConcreteTexture(size = 256) {
  const period = size; // tileable
  const data   = new Uint8Array(size * size * 4);

  // value-noise grid (periodic)
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

  const amp0 = 0.24, scale0 = 0.018;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let f = 0, amp = amp0, sc = scale0;
      for (let o = 0; o < 4; o++) { f += amp * sample(x*sc*period, y*sc*period); amp*=0.5; sc*=2.0; }
      const g = Math.round(170 + (f - 0.5) * 30); // ~160..185
      const idx = (y * size + x) * 4;
      data[idx+0]=g; data[idx+1]=g; data[idx+2]=g; data[idx+3]=255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size); // RGBA
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
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.85,
    metalness: 0.0
  });
}

/* ---------- seam grooves (tiny inset meshes) ---------- */
function addConcreteSeams(group, def){
  const SEAM_W = 0.028;    // width of groove on surface
  const SEAM_D = 0.012;    // how deep it looks
  const EPS    = 0.00025;  // lift to avoid z-fight

  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, roughness: 1.0, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    depthWrite: false
  });

  if (def.baseType === "flat") {
    const yTop =  def.thickness/2 + EPS;
    // long edges (along X)
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_D, SEAM_W), seamMat))
         .position.set(0, yTop - SEAM_D/2,  def.size.z/2 - SEAM_W/2);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_D, SEAM_W), seamMat))
         .position.set(0, yTop - SEAM_D/2, -def.size.z/2 + SEAM_W/2);
    // short edges (along Z)
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, SEAM_D, def.size.z), seamMat))
         .position.set( def.size.x/2 - SEAM_W/2, yTop - SEAM_D/2, 0);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, SEAM_D, def.size.z), seamMat))
         .position.set(-def.size.x/2 + SEAM_W/2, yTop - SEAM_D/2, 0);
  } else { // wall (put grooves on front & back faces)
    const zFront =  def.thickness/2 + EPS;
    const zBack  = -def.thickness/2 - EPS;
    const yTop   =  def.size.y/2 - SEAM_W/2;
    const yBot   = -def.size.y/2 + SEAM_W/2;

    // verticals (left/right) – front
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, def.size.y, SEAM_D), seamMat))
         .position.set( def.size.x/2 - SEAM_W/2, 0, zFront);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, def.size.y, SEAM_D), seamMat))
         .position.set(-def.size.x/2 + SEAM_W/2, 0, zFront);
    // horizontals – front
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_W, SEAM_D), seamMat))
         .position.set(0, yTop, zFront);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_W, SEAM_D), seamMat))
         .position.set(0, yBot, zFront);

    // repeat on back face
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, def.size.y, SEAM_D), seamMat))
         .position.set( def.size.x/2 - SEAM_W/2, 0, zBack);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(SEAM_W, def.size.y, SEAM_D), seamMat))
         .position.set(-def.size.x/2 + SEAM_W/2, 0, zBack);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_W, SEAM_D), seamMat))
         .position.set(0, yTop, zBack);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(def.size.x, SEAM_W, SEAM_D), seamMat))
         .position.set(0, yBot, zBack);
  }
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
// src/assets/Catalog.js
import * as THREE from "three";

/* ---------- Catalog ---------- */
export function makeCatalog() {
  return [
    { id:"metal_flat",    name:"Metal Flat",    baseType:"flat",  kind:"flat",  material: matMetal,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#b8c2cc" },

    { id:"metal_wall",    name:"Metal Wall",    baseType:"wall",  kind:"wall",  material: matWall,
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#dfe6ee" },

    // NEW: Metal Beam (1×1 tile footprint, height = wall)
    { id:"metal_beam",    name:"Metal Beam",    baseType:"beam",  kind:"pillar", material: matBeam,
      size:{x:3, y:3,   z:3},  thickness:0.0, preview:"#c7ccd2" },

    { id:"concrete_flat", name:"Concrete Flat", baseType:"flat",  kind:"flat",  material: matConcrete,
      size:{x:3, y:0.2, z:3}, thickness:0.2, preview:"#b9b9b9" },

    { id:"concrete_wall", name:"Concrete Wall", baseType:"wall",  kind:"wall",  material: matConcrete,
      size:{x:3, y:3,   z:0.2}, thickness:0.2, preview:"#c7c7c7" },
  ];
}

/* ---------- Mesh builder ---------- */
export function buildPart(def) {
  const g = new THREE.Group();
  const material = def.material();

  // Beam: build an I-beam inside a 3×3 footprint, height = def.size.y
  if (def.baseType === "beam") {
    const H = def.size.y;        // 3
    const W = 2.6;               // flange width (X) inside tile
    const D = 1.0;               // flange/web depth (Z)
    const t = 0.22;              // flange thickness (Y)
    const tw = 0.36;             // web thickness (X)

    const top    = new THREE.Mesh(new THREE.BoxGeometry(W, t, D), material);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, t, D), material);
    const web    = new THREE.Mesh(new THREE.BoxGeometry(tw, H - 2*t, D), material);

    top.position.set(0,  H/2 - t/2, 0);
    bottom.position.set(0, -H/2 + t/2, 0);
    web.position.set(0, 0, 0);

    [top,bottom,web].forEach(m => { m.castShadow = true; m.receiveShadow = true; });

    g.add(top, bottom, web);
    return g;
  }

  // Walls & flats as before
  let mesh;
  if (def.baseType === "wall") {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size.x, def.size.y, def.thickness, 1, 1, 1),
      material
    );
  } else { // flat
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

// Steel beam: slightly darker, a touch rougher than wall metal
function matBeam() {
  return new THREE.MeshStandardMaterial({
    color: 0x9aa3ab,     // cool steel
    roughness: 0.55,
    metalness: 0.85
  });
}

/* ---------- Matte, smooth concrete (iOS-safe RGBA DataTexture) ---------- */

let _concreteTex = null;

function createSmoothConcreteTexture(size = 256) {
  // Tileable, low-frequency value-noise (fBm) for a clean slab look
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

  const amp0 = 0.22, scale0 = 0.018; // smooth + subtle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let f = 0, amp = amp0, sc = scale0;
      for (let o = 0; o < 4; o++) { f += amp * sample(x*sc*period, y*sc*period); amp*=0.5; sc*=2.0; }
      const g = Math.round(172 + (f - 0.5) * 26); // ~160..185, very matte grey
      const i = (y * size + x) * 4;
      data[i+0]=g; data[i+1]=g; data[i+2]=g; data[i+3]=255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size); // RGBA
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
    roughness: 0.98,   // matte
    metalness: 0.0,
    envMapIntensity: 0 // kill any environment shine if present
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
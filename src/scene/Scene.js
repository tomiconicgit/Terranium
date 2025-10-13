// Scene.js — uneven sand + mountain ring + shadowed lights + terrain API
import * as THREE from 'three';

export class Scene extends THREE.Scene {
  constructor(renderer /* for shadow radius */) {
    super();

    this.background = new THREE.Color(0xbfd8ff);

    /* ---------- Lights (with shadows) ---------- */
    this.add(new THREE.AmbientLight(0xffffff, 0.25));

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(120, 180, -90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far  = 600;
    const s = 180; // shadow frustum half-size
    sun.shadow.camera.left   = -s;
    sun.shadow.camera.right  =  s;
    sun.shadow.camera.top    =  s;
    sun.shadow.camera.bottom = -s;
    this.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-80, 120, 80);
    this.add(fill);

    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x9a7c55, 0.7);
    hemi.position.set(0, 120, 0);
    this.add(hemi);

    /* ---------- Terrain (heightfield) ---------- */
    // Coords: ring 70..100 becomes mountains. We give extra margin.
    this.halfSize = 140;                 // world half-extent (meters)
    this.segments = 192;                 // grid resolution (192×192 quads)
    this.cell     = (this.halfSize * 2) / this.segments;

    const geo = new THREE.PlaneGeometry(
      this.halfSize * 2,
      this.halfSize * 2,
      this.segments,
      this.segments
    );

    // Build heights
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // plane local "y" becomes world Z after rotation
      const r = Math.hypot(x, y);

      // low dunes inside 70, ramp to mountains until 100, then mountains
      const duneAmp = 0.9;
      const mtnAmp  = 12.0;

      const ramp = smoothstep(70.0, 100.0, r);       // 0 → 1 between 70..100
      const amp  = THREE.MathUtils.lerp(duneAmp, mtnAmp, ramp);

      // FBM noise field
      const h = fbm2(x * 0.06, y * 0.06, 4) * amp
              + fbm2(x * 0.18, y * 0.18, 2) * (amp * 0.15); // detail

      pos.setZ(i, h);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xdbc9a0, roughness: 1.0, metalness: 0.0
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.name = 'terrainPlane';       // keep compatibility with Builder
    terrain.receiveShadow = true;

    this.terrain = terrain;
    this.add(terrain);

    // Re-usable scratch vectors
    this._v3a = new THREE.Vector3();
    this._v3b = new THREE.Vector3();
  }

  update(/* dt, elapsed */) { /* no-op */ }

  /* ---------- Terrain sampling (bilinear) ---------- */
  getTerrainHeightAt(wx, wz) {
    const mesh = this.terrain;
    const geo  = mesh.geometry;
    const pos  = geo.attributes.position;

    // world → local (plane space)
    const pLocal = this._v3a.set(wx, 0, wz);
    mesh.worldToLocal(pLocal); // after this, pLocal.{x,y} are the plane coords

    const x = pLocal.x;
    const y = pLocal.y;

    const half = this.halfSize;
    if (x < -half || x > half || y < -half || y > half) return 0;

    const step = this.cell;
    const sx = (x + half) / step;
    const sy = (y + half) / step;

    const i0 = Math.floor(sx);
    const j0 = Math.floor(sy);
    const i1 = Math.min(i0 + 1, this.segments);
    const j1 = Math.min(j0 + 1, this.segments);

    const tx = sx - i0;
    const ty = sy - j0;

    const idx = (ii, jj) => jj * (this.segments + 1) + ii;

    const z00 = pos.getZ(idx(i0, j0));
    const z10 = pos.getZ(idx(i1, j0));
    const z01 = pos.getZ(idx(i0, j1));
    const z11 = pos.getZ(idx(i1, j1));

    const z0 = THREE.MathUtils.lerp(z00, z10, tx);
    const z1 = THREE.MathUtils.lerp(z01, z11, tx);
    const z  = THREE.MathUtils.lerp(z0, z1, ty);

    // local z equals world y after rotation
    return z;
  }

  /* ---------- Sand depression + blend around a slab ---------- */
  /** Sink sand under a slab and blend out to outerR
   * @param {THREE.Vector3} centerWorld - center in world (x, y, z)
   * @param {number} bottomY - slab bottom world Y to match (we press slightly below)
   * @param {number} innerR - full effect radius (meters)
   * @param {number} outerR - falloff end radius (meters)
   * @param {number} extraPress - additional press depth (meters)
   */
  pressSand(centerWorld, bottomY, innerR, outerR, extraPress = 0.06) {
    const mesh = this.terrain;
    const geo  = mesh.geometry;
    const pos  = geo.attributes.position;

    // Convert center to terrain local plane space
    const c = this._v3a.copy(centerWorld);
    c.y = 0; // just to be explicit
    mesh.worldToLocal(c); // now c.x,c.y are plane coords, target height is local z

    const targetZ = bottomY - extraPress; // local z == world y

    // Iterate all verts; only touch those within outerR
    for (let j = 0; j <= this.segments; j++) {
      for (let i = 0; i <= this.segments; i++) {
        const idx = j * (this.segments + 1) + i;

        const vx = pos.getX(idx);
        const vy = pos.getY(idx);
        const vz = pos.getZ(idx);

        const dx = vx - c.x;
        const dy = vy - c.y;
        const r  = Math.hypot(dx, dy);
        if (r > outerR) continue;

        let newZ = vz;
        if (r <= innerR) {
          newZ = Math.min(vz, targetZ);
        } else {
          const t = (r - innerR) / (outerR - innerR); // 0..1
          const w = 1.0 - smoothstep(0, 1, t);        // 1..0 smooth
          const desired = Math.min(vz, targetZ);
          newZ = vz * (1 - w) + desired * w;
        }

        pos.setZ(idx, newZ);
      }
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.boundingSphere = null;
    geo.computeBoundingSphere();
  }
}

/* ---------- tiny FBM/value-noise ---------- */
function fbm2(x, y, octaves = 4) {
  let amp = 0.5, freq = 1.0, sum = 0.0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(x * freq, y * freq);
    freq *= 2.0;
    amp  *= 0.5;
  }
  return sum;
}
function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi,        yf = y - yi;
  const s = hash2(xi,   yi);
  const t = hash2(xi+1, yi);
  const u = hash2(xi,   yi+1);
  const v = hash2(xi+1, yi+1);
  const sx = fade(xf), sy = fade(yf);
  const a = lerp(s, t, sx);
  const b = lerp(u, v, sx);
  return lerp(a, b, sy) * 2.0 - 1.0; // -1..1
}
function hash2(x, y) {
  let n = x * 374761393 + y * 668265263; // 32-bit hash
  n = (n ^ (n >> 13)) * 1274126177;
  n = (n ^ (n >> 16)) >>> 0;
  return n / 4294967295;
}
const lerp = (a, b, t) => a + (b - a) * t;
const fade = (t) => t * t * (3 - 2 * t);
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
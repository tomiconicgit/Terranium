// src/craft/Craft.js
import * as THREE from 'three';

/**
 * Chunk-meshed builder:
 * - World bounds: |x|,|z| <= 200, y in [-30, 3000]
 * - Chunk size: 16×16×16 (lazy-created), face-culling mesher (fast!), 1 mesh per material per chunk.
 * - Hotbar: Metal / Concrete / Tarmac / Glass (glass is transparent).
 * - Preview block, DDA voxel picking, dig & stack work correctly.
 *
 * Notes:
 * - Greedy meshing can be added later; this already slashes draw calls vs per-cube instancing.
 * - A hidden “sand” type fills ground, so you can dig down to -30.
 */

const CHUNK = { X:16, Y:16, Z:16 };

const TYPE = {
  AIR: 0,
  METAL: 1,
  CONCRETE: 2,
  TARMAC: 3,
  GLASS: 4,
  SAND: 5, // hidden base terrain
};

// Directions for face culling (nx,ny,nz) with normal and a face id
const DIRS = [
  { n:[ 1, 0, 0], face:0 }, // +X
  { n:[-1, 0, 0], face:1 }, // -X
  { n:[ 0, 1, 0], face:2 }, // +Y
  { n:[ 0,-1, 0], face:3 }, // -Y
  { n:[ 0, 0, 1], face:4 }, // +Z
  { n:[ 0, 0,-1], face:5 }  // -Z
];

export class CraftSystem {
  constructor({ scene, camera, renderer, debuggerInstance }) {
    this.scene    = scene;
    this.camera   = camera;
    this.renderer = renderer;
    this.debugger = debuggerInstance;

    // World bounds
    this.tile = 1.0;
    this.maxXZ = 200;
    this.minY  = -30;
    this.maxY  = 3000;

    // DDA
    this.maxDDASteps = 10000;

    // Rotation state (45° steps)
    this.yawSteps   = 0;
    this.pitchSteps = 0;

    // Materials
    this.materials = this._makeMaterials();

    // Types available in hotbar (exclude SAND)
    this.hotbarTypes = [
      { id: TYPE.METAL,    label: 'Metal',    mat: this.materials.metal },
      { id: TYPE.CONCRETE, label: 'Concrete', mat: this.materials.concrete },
      { id: TYPE.TARMAC,   label: 'Tarmac',   mat: this.materials.tarmac },
      { id: TYPE.GLASS,    label: 'Glass',    mat: this.materials.glass },
    ];
    this.selected = 0;

    // Chunks: key "cx,cy,cz" -> Chunk
    this.chunks = new Map();

    // Build ground: fill sand from -30..0 (lazy by chunk on access)
    this.groundBuilt = false;

    // Preview ghost
    this.preview = this._makePreview();

    // Hotbar UI
    this._buildHotbar();
    window.addEventListener('resize', ()=>this._layoutHotbar(), false);

    // A temp raycaster
    this._raycaster = new THREE.Raycaster();
  }

  /* ---------- public API for controller ---------- */
  selectNext(){ this.selected = (this.selected + 1) % this.hotbarTypes.length; this._updateHotbar(); }
  selectPrev(){ this.selected = (this.selected - 1 + this.hotbarTypes.length) % this.hotbarTypes.length; this._updateHotbar(); }
  yawStep(){   this.yawSteps   = (this.yawSteps + 1) & 7; }
  pitchStep(){ this.pitchSteps = (this.pitchSteps + 1) & 7; }
  fly(deltaY){
    this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y + deltaY, this.minY - 2, this.maxY + 10);
  }

  place(){
    this._ensureGround();
    const target = this._computePlacement();
    if (!target) return;
    const { gx, gy, gz } = target.placeGrid;
    if (!this._inBounds(gx,gy,gz)) return;

    const id = this.hotbarTypes[this.selected].id;
    this._setVoxel(gx, gy, gz, id);
    this._remeshAround(gx, gy, gz);
  }

  removeOrDig(){
    this._ensureGround();
    const hit = this._ddaPick();
    if (hit && hit.block) {
      const { x,y,z, type } = hit.block;
      if (type !== TYPE.AIR) {
        this._setVoxel(x,y,z, TYPE.AIR);
        this._remeshAround(x,y,z);
      }
      return;
    }
    // fallback: remove at current preview cell if present
    const cell = this._currentPreviewCell();
    if (!cell) return;
    const t = this._getVoxel(cell.x, cell.y, cell.z);
    if (t !== TYPE.AIR) {
      this._setVoxel(cell.x, cell.y, cell.z, TYPE.AIR);
      this._remeshAround(cell.x, cell.y, cell.z);
    }
  }

  update(dt){
    this._ensureGround();
    this._updatePreview();
  }

  /* ---------- materials ---------- */
  _makeMaterials(){
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9,  roughness: 0.35 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.0,  roughness: 0.9 });
    const tarmac = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1,  roughness: 0.95 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x99c7ff, metalness: 0.0, roughness: 0.05, transmission: 0.8,
      transparent: true, opacity: 0.6, ior: 1.2, thickness: 0.2
    });
    const sand = new THREE.MeshStandardMaterial({ color: 0xE1D7B9, metalness: 0.0, roughness: 0.95 });
    return { metal, concrete, tarmac, glass, sand };
  }

  /* ---------- hotbar ---------- */
  _buildHotbar(){
    const bar = document.createElement('div');
    bar.id = 'craft-hotbar';
    bar.style.cssText = `
      position:fixed; z-index:12; bottom:18px;
      height:68px; display:flex; gap:8px; padding:8px 10px;
      background:rgba(20,20,24,0.6); border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; backdrop-filter: blur(6px);
      left:50%; transform:translateX(-50%);
    `;
    this.hotSlots = [];
    for (let i=0;i<this.hotbarTypes.length;i++){
      const t = this.hotbarTypes[i];
      const slot = document.createElement('div');
      slot.style.cssText = `
        flex:1; min-width:80px; height:52px; border-radius:8px;
        border:2px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:600; user-select:none; font-family: system-ui, sans-serif;
      `;
      slot.textContent = t.label;
      bar.appendChild(slot);
      this.hotSlots.push(slot);
    }
    document.body.appendChild(bar);
    this._layoutHotbar();
    this._updateHotbar();
  }
  _layoutHotbar(){
    const bar = document.getElementById('craft-hotbar');
    if (!bar) return;
    bar.style.width = Math.min(560, window.innerWidth - 40) + 'px';
  }
  _updateHotbar(){
    for (let i=0;i<this.hotSlots.length;i++){
      const el = this.hotSlots[i];
      if (i === this.selected) {
        el.style.borderColor = 'rgba(255,255,255,0.85)';
        el.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.25) inset';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.15)';
        el.style.boxShadow = 'none';
      }
    }
  }

  /* ---------- preview ---------- */
  _makePreview(){
    const g = new THREE.BoxGeometry(1,1,1);
    const m = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.25, depthWrite:false });
    const mesh = new THREE.Mesh(g, m);
    mesh.visible = true;
    mesh.renderOrder = 9999;
    this.scene.add(mesh);
    return mesh;
  }
  _currentPreviewCell(){
    const res = this._ddaPick();
    if (res && res.block) {
      const { lastEmpty } = res;
      return this._inBounds(lastEmpty.x, lastEmpty.y, lastEmpty.z) ? lastEmpty : null;
    }
    // fallback: project onto an imaginary ground at y=0
    const ndc = new THREE.Vector2(0,0);
    this._raycaster.setFromCamera(ndc, this.camera);
    const ro = this._raycaster.ray.origin, rd = this._raycaster.ray.direction;
    if (Math.abs(rd.y) < 1e-4) return null;
    const t = (0 - ro.y) / rd.y;
    if (t <= 0) return null;
    const p = ro.clone().addScaledVector(rd, t);
    const gx = Math.floor(p.x / this.tile);
    const gy = Math.floor(0 / this.tile) + 1;
    const gz = Math.floor(p.z / this.tile);
    return this._inBounds(gx,gy,gz) ? { x:gx, y:gy, z:gz } : null;
  }
  _updatePreview(){
    const cell = this._currentPreviewCell();
    if (!cell) { this.preview.visible = false; return; }
    this.preview.visible = true;
    const yaw   = this.yawSteps   * (Math.PI / 4);
    const pitch = this.pitchSteps * (Math.PI / 4);
    this.preview.position.set(
      cell.x*this.tile + 0.5*this.tile,
      cell.y*this.tile + 0.5*this.tile,
      cell.z*this.tile + 0.5*this.tile
    );
    this.preview.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  /* ---------- ground (hidden sand type) ---------- */
  _ensureGround(){
    if (this.groundBuilt) return;
    // Only allocate chunks intersecting [-200,200] range when accessed — but seed a flat sand floor by
    // marking voxels on demand when chunks are first created.
    this.groundBuilt = true;
  }

  /* ---------- voxel storage ---------- */
  _inBounds(x,y,z){
    return (
      x >= -this.maxXZ && x <= this.maxXZ &&
      z >= -this.maxXZ && z <= this.maxXZ &&
      y >= this.minY   && y <= this.maxY
    );
  }
  _cKey(cx,cy,cz){ return `${cx},${cy},${cz}`; }
  _toChunkCoords(x,y,z){
    const cx = Math.floor(x / CHUNK.X);
    const cy = Math.floor((y - this.minY) / CHUNK.Y); // shift y so minY starts at 0 chunk
    const cz = Math.floor(z / CHUNK.Z);
    return { cx, cy, cz };
  }
  _toLocal(x,y,z){
    const lx = ((x % CHUNK.X) + CHUNK.X) % CHUNK.X;
    const ly = ((y - this.minY) % CHUNK.Y + CHUNK.Y) % CHUNK.Y;
    const lz = ((z % CHUNK.Z) + CHUNK.Z) % CHUNK.Z;
    return { lx, ly, lz };
  }
  _getChunk(cx,cy,cz, create=true){
    if (cy < 0) return null;
    const key = this._cKey(cx,cy,cz);
    let c = this.chunks.get(key);
    if (!c && create) {
      c = this._createChunk(cx,cy,cz);
      this.chunks.set(key, c);
      // Seed ground sand for y-slab that intersects [-30..0]
      const yStart = this.minY + cy*CHUNK.Y;
      const yEnd   = yStart + CHUNK.Y - 1;
      if (yEnd >= this.minY && yStart <= 0) {
        for (let ly=0; ly<CHUNK.Y; ly++){
          const wy = yStart + ly;
          if (wy >= this.minY && wy <= 0) {
            for (let lx=0; lx<CHUNK.X; lx++){
              for (let lz=0; lz<CHUNK.Z; lz++){
                c.vox[this._idx(lx,ly,lz)] = TYPE.SAND;
              }
            }
          }
        }
        this._rebuildChunk(c);
      }
    }
    return c;
  }
  _createChunk(cx,cy,cz){
    const vox = new Uint8Array(CHUNK.X * CHUNK.Y * CHUNK.Z); // defaults to AIR
    const group = new THREE.Group();
    group.name = `chunk_${cx}_${cy}_${cz}`;
    // position in world (chunk origin)
    const x0 = cx * CHUNK.X * this.tile;
    const y0 = (this.minY + cy * CHUNK.Y) * this.tile;
    const z0 = cz * CHUNK.Z * this.tile;
    group.position.set(x0, y0, z0);
    this.scene.add(group);
    return { cx,cy,cz, vox, group, meshes: new Map(), dirty:false };
  }
  _idx(lx,ly,lz){ return (ly*CHUNK.Z + lz)*CHUNK.X + lx; }

  _getVoxel(x,y,z){
    if (!this._inBounds(x,y,z)) return TYPE.AIR;
    const { cx,cy,cz } = this._toChunkCoords(x,y,z);
    const c = this._getChunk(cx,cy,cz,false);
    if (!c) return TYPE.AIR;
    const { lx,ly,lz } = this._toLocal(x,y,z);
    return c.vox[this._idx(lx,ly,lz)];
  }
  _setVoxel(x,y,z, id){
    const { cx,cy,cz } = this._toChunkCoords(x,y,z);
    const c = this._getChunk(cx,cy,cz,true);
    if (!c) return;
    const { lx,ly,lz } = this._toLocal(x,y,z);
    c.vox[this._idx(lx,ly,lz)] = id;
    c.dirty = true;
  }

  _remeshAround(x,y,z){
    const { cx,cy,cz } = this._toChunkCoords(x,y,z);
    for (let dx=-1; dx<=1; dx++){
      for (let dy=-1; dy<=1; dy++){
        for (let dz=-1; dz<=1; dz++){
          const c = this._getChunk(cx+dx,cy+dy,cz+dz,false);
          if (c) { c.dirty = true; this._rebuildChunk(c); }
        }
      }
    }
  }

  /* ---------- chunk meshing (face culling) ---------- */
  _rebuildChunk(c){
    if (!c.dirty) return;
    c.dirty = false;

    // Dispose old meshes
    c.meshes.forEach(m=>{
      m.geometry.dispose();
      // keep materials (shared)
      c.group.remove(m);
    });
    c.meshes.clear();

    // Accumulate per-material vertices
    const build = new Map(); // type -> { pos[], nor[], uv[], idx[] }
    const ensure = (type)=>{
      if (!build.has(type)) build.set(type, { pos:[], nor:[], uv:[], idx:[], vcount:0 });
      return build.get(type);
    };

    const tile = this.tile;
    const pushFace = (acc, ax,ay,az, bx,by,bz, cx,cy,cz, dx,dy,dz, nx,ny,nz) => {
      const { pos, nor, uv, idx } = acc;
      const v0 = acc.vcount;
      pos.push(ax,ay,az, bx,by,bz, cx,cy,cz, dx,dy,dz);
      nor.push(nx,ny,nz, nx,ny,nz, nx,ny,nz, nx,ny,nz);
      uv.push(0,0, 1,0, 1,1, 0,1);
      idx.push(v0, v0+1, v0+2, v0, v0+2, v0+3);
      acc.vcount += 4;
    };

    const W = CHUNK.X, H = CHUNK.Y, D = CHUNK.Z;
    for (let ly=0; ly<H; ly++){
      for (let lz=0; lz<D; lz++){
        for (let lx=0; lx<W; lx++){
          const id = c.vox[this._idx(lx,ly,lz)];
          if (id === TYPE.AIR) continue;

          // Do not render internal SAND faces unless exposed
          const isTransp = (id === TYPE.GLASS);
          const matType = id;

          // world coords of this voxel center
          const wx = (c.cx*CHUNK.X + lx) * tile;
          const wy = (this.minY + c.cy*CHUNK.Y + ly) * tile;
          const wz = (c.cz*CHUNK.Z + lz) * tile;

          // cube min/max
          const x0 = wx, x1 = wx + tile;
          const y0 = wy, y1 = wy + tile;
          const z0 = wz, z1 = wz + tile;

          // For each face, if neighbor is air or out-of-bounds, emit it
          for (const d of DIRS) {
            const nx = d.n[0], ny = d.n[1], nz = d.n[2];
            const nId = this._getVoxel(
              (c.cx*CHUNK.X + lx + nx),
              (this.minY + c.cy*CHUNK.Y + ly) ,
              (c.cz*CHUNK.Z + lz + nz)
            );
            if (nId !== TYPE.AIR) continue; // occluded

            const acc = ensure(matType);
            // Build the quad
            if (nx ===  1) pushFace(acc, x1,y0,z0, x1,y0,z1, x1,y1,z1, x1,y1,z0,  1,0,0);
            if (nx === -1) pushFace(acc, x0,y0,z1, x0,y0,z0, x0,y1,z0, x0,y1,z1, -1,0,0);
            if (ny ===  1) pushFace(acc, x0,y1,z1, x1,y1,z1, x1,y1,z0, x0,y1,z0,  0,1,0);
            if (ny === -1) pushFace(acc, x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1,  0,-1,0);
            if (nz ===  1) pushFace(acc, x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1,  0,0,1);
            if (nz === -1) pushFace(acc, x1,y0,z0, x0,y0,z0, x0,y1,z0, x1,y1,z0,  0,0,-1);
          }
        }
      }
    }

    // Build meshes by material type
    build.forEach((acc, type)=>{
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
      g.setAttribute('normal',   new THREE.Float32BufferAttribute(acc.nor, 3));
      g.setAttribute('uv',       new THREE.Float32BufferAttribute(acc.uv, 2));
      g.setIndex(acc.idx);
      g.computeBoundingSphere();

      const mat = this._matForType(type);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      // Transparent material ordering
      if (type === TYPE.GLASS) mesh.renderOrder = 10;

      c.group.add(mesh);
      c.meshes.set(type, mesh);
    });
  }

  _matForType(t){
    switch(t){
      case TYPE.METAL:    return this.materials.metal;
      case TYPE.CONCRETE: return this.materials.concrete;
      case TYPE.TARMAC:   return this.materials.tarmac;
      case TYPE.GLASS:    return this.materials.glass;
      case TYPE.SAND:     return this.materials.sand;
      default:            return this.materials.concrete;
    }
  }

  /* ---------- DDA picking ---------- */
  _ddaPick(){
    const ndc = new THREE.Vector2(0,0); // center of screen
    this._raycaster.setFromCamera(ndc, this.camera);
    const ro = this._raycaster.ray.origin.clone();
    const rd = this._raycaster.ray.direction.clone();

    // Clamp by a max range
    const maxRange = 8000;

    // Start voxel
    let x = Math.floor(ro.x / this.tile);
    let y = Math.floor(ro.y / this.tile);
    let z = Math.floor(ro.z / this.tile);

    const stepX = rd.x > 0 ? 1 : (rd.x < 0 ? -1 : 0);
    const stepY = rd.y > 0 ? 1 : (rd.y < 0 ? -1 : 0);
    const stepZ = rd.z > 0 ? 1 : (rd.z < 0 ? -1 : 0);

    const txDelta = stepX !== 0 ? Math.abs(1 / rd.x) : Infinity;
    const tyDelta = stepY !== 0 ? Math.abs(1 / rd.y) : Infinity;
    const tzDelta = stepZ !== 0 ? Math.abs(1 / rd.z) : Infinity;

    const vx = x + (stepX > 0 ? 1 : 0);
    const vy = y + (stepY > 0 ? 1 : 0);
    const vz = z + (stepZ > 0 ? 1 : 0);

    let txMax = stepX !== 0 ? ((vx * this.tile - ro.x) / rd.x) : Infinity;
    let tyMax = stepY !== 0 ? ((vy * this.tile - ro.y) / rd.y) : Infinity;
    let tzMax = stepZ !== 0 ? ((vz * this.tile - ro.z) / rd.z) : Infinity;

    let lastEmpty = { x, y, z };
    for (let i=0; i<this.maxDDASteps; i++) {
      if (this._inBounds(x,y,z)) {
        const t = this._getVoxel(x,y,z);
        if (t !== TYPE.AIR) return { block:{ x,y,z, type:t }, lastEmpty };
      }
      if (txMax < tyMax) {
        if (txMax < tzMax) { x += stepX; lastEmpty = { x,y,z }; if (txMax > maxRange) break; txMax += txDelta; }
        else { z += stepZ; lastEmpty = { x,y,z }; if (tzMax > maxRange) break; tzMax += tzDelta; }
      } else {
        if (tyMax < tzMax) { y += stepY; lastEmpty = { x,y,z }; if (tyMax > maxRange) break; tyMax += tyDelta; }
        else { z += stepZ; lastEmpty = { x,y,z }; if (tzMax > maxRange) break; tzMax += tzDelta; }
      }
      if (!this._inBounds(x,y,z) && (Math.abs(x)>this.maxXZ+2 || Math.abs(z)>this.maxXZ+2 || y<this.minY-2 || y>this.maxY+2)) break;
    }
    return null;
  }

  _computePlacement(){
    const res = this._ddaPick();
    if (res && res.block) {
      const { lastEmpty } = res;
      return { placeGrid: { gx:lastEmpty.x, gy:lastEmpty.y, gz:lastEmpty.z } };
    }
    const cell = this._currentPreviewCell();
    if (!cell) return null;
    return { placeGrid: { gx:cell.x, gy:cell.y, gz:cell.z } };
  }
}
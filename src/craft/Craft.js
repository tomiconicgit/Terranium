// src/craft/Craft.js
import * as THREE from 'three';

/**
 * Voxel Craft System with CHUNK MESHING
 * -------------------------------------
 * - World voxels exist on a 1m grid.
 * - Terrain is procedural "sand" from y=-30..h(x,z) with a subtle noise surface.
 * - User can dig (carve) or place blocks (metal, concrete, tarmac, glass).
 * - Rendering uses per-chunk meshes with face culling (1 draw per material per chunk).
 * - DDA picking runs against the voxel field (placed ∪ (terrain − carved)).
 * - On-screen build controls: Y/X rotate buttons + center tap pad (single=place, double=dig).
 *
 * World bounds:
 *   x,z ∈ [-200,200]  (matches your original)
 *   y   ∈ [-30, 3000] (terrain fills up to around 0; above is empty until you place)
 */

export class CraftSystem {
  constructor({ scene, camera, renderer, debuggerInstance }) {
    this.scene   = scene;
    this.camera  = camera;
    this.renderer= renderer;
    this.debugger = debuggerInstance;

    // ====== VOXEL WORLD PARAMS ======
    this.tile = 1;                // 1m cubes
    this.minY = -30;
    this.maxY = 3000;
    this.maxXZ = 200;

    // Chunk size (x,z are 16, y is 32 → keeps rebuilds cheap)
    this.CX = 16;
    this.CY = 32;
    this.CZ = 16;

    // Terrain noise (kept subtle, surface near y≈0)
    this.NOISE_FREQ = 0.05;
    this.NOISE_AMP  = 1.6;

    // DDA params
    this.maxDDASteps = 8000;

    // Rotation state (45° steps)
    this.yawSteps   = 0; // around Y (horizontal)
    this.pitchSteps = 0; // around X (vertical)

    // Materials & block types
    this.materials = this._makeMaterials();
    this.types = [
      { id:'sand',     label:'Sand',     mat:this.materials.sand,     isTerrain:true },
      { id:'metal',    label:'Metal',    mat:this.materials.metal,    isTerrain:false },
      { id:'concrete', label:'Concrete', mat:this.materials.concrete, isTerrain:false },
      { id:'tarmac',   label:'Tarmac',   mat:this.materials.tarmac,   isTerrain:false },
      { id:'glass',    label:'Glass',    mat:this.materials.glass,    isTerrain:false },
    ];

    // Sparse data:
    // placed: Map<"x,y,z", typeId>  (non-terrain blocks the user placed)
    // carved: Set<"x,y,z">          (terrain voxels removed by digging)
    this.placed = new Map();
    this.carved = new Set();

    // CHUNKS: Map<"cx,cy,cz", { group, meshesByType, dirty }>
    this.chunks = new Map();

    // Preview ghost
    this.preview = this._makePreview();

    // UI (hotbar at bottom)
    this.selected = 1; // default to first buildable type (metal)
    this._buildHotbar();

    // On-screen build buttons (Y/X rotate + tap pad)
    this._buildOnscreenControls();

    // Hide old CPU terrain; we now render voxel sand
    this._hideLegacyTerrain();

    // Mesh maintenance queue
    this._dirtyQueue = new Set();

    // Rebuild visible ring around camera on first update
    this._initialized = false;

    // Hook resize for hotbar layout
    window.addEventListener('resize', ()=>this._layoutHotbar(), false);
  }

  /* ===================== PUBLIC API (controller bindings) ===================== */
  selectNext(){ this.selected = (this.selected + 1) % this.types.length; if (this.types[this.selected].isTerrain) this.selected = (this.selected + 1) % this.types.length; this._updateHotbar(); }
  selectPrev(){
    this.selected = (this.selected - 1 + this.types.length) % this.types.length;
    if (this.types[this.selected].isTerrain) this.selected = (this.selected - 1 + this.types.length) % this.types.length;
    this._updateHotbar();
  }
  yawStep(){   this.yawSteps   = (this.yawSteps + 1) & 7; }
  pitchStep(){ this.pitchSteps = (this.pitchSteps + 1) & 7; }

  fly(deltaY){
    this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y + deltaY, this.minY - 2, this.maxY + 10);
  }

  place() {
    const target = this._computePlacement();
    if (!target) return;
    const { gx, gy, gz } = target.placeGrid;
    if (!this._inBounds(gx, gy, gz)) return;

    const key = this._key(gx, gy, gz);
    // prevent placing inside solid (unless it's terrain; then we "place over" by replacing terrain)
    if (this._solidAt(gx,gy,gz)) return;

    const type = this.types[this.selected].id;
    this.placed.set(key, type);
    this._markVoxelAndNeighborsDirty(gx,gy,gz);
  }

  removeOrDig() {
    const hit = this._ddaPick();
    if (!hit) return;

    const { x, y, z } = hit.block;

    const k = this._key(x,y,z);
    if (this.placed.has(k)) {
      // remove placed block
      this.placed.delete(k);
      this._markVoxelAndNeighborsDirty(x,y,z);
      return;
    }

    // If it's terrain, carve it
    if (this._terrainSolid(x,y,z)) {
      this.carved.add(k);
      this._markVoxelAndNeighborsDirty(x,y,z);
    }
  }

  update(dt) {
    // First-time: build initial chunk ring around camera (lazy terrain)
    if (!this._initialized) {
      this._initialized = true;
      this._primeInitialChunks();
    }

    // Rebuild any dirty chunks (bounded work per frame)
    this._processDirtyQueue(2); // max 2 chunk rebuilds per frame to stay smooth

    // Update preview ghost
    this._updatePreview();
  }

  /* ===================== ONSCREEN CONTROLS ===================== */
  _buildOnscreenControls() {
    // Right-side Y/X rotate buttons
    const wrap = document.createElement('div');
    wrap.className = 'no-look';
    wrap.style.cssText = `
      position:fixed; right:18px; bottom:18px; z-index:14; display:flex; flex-direction:column; gap:10px;
    `;

    const mkBtn = (txt) => {
      const b = document.createElement('button');
      b.className = 'no-look';
      b.textContent = txt;
      b.style.cssText = `
        width:64px; height:64px; border-radius:50%; border:1px solid rgba(255,255,255,.3);
        background:rgba(20,20,24,.6); color:#fff; font-weight:700; font-size:18px;
        backdrop-filter: blur(6px); cursor:pointer;
      `;
      return b;
    };

    const btnY = mkBtn('Y');
    const btnX = mkBtn('X');
    btnY.title = 'Rotate yaw +45°';
    btnX.title = 'Rotate pitch +45°';

    btnY.addEventListener('click', (e)=>{ e.stopPropagation(); this.yawStep(); }, { passive:true });
    btnX.addEventListener('click', (e)=>{ e.stopPropagation(); this.pitchStep(); }, { passive:true });

    wrap.appendChild(btnY);
    wrap.appendChild(btnX);
    document.body.appendChild(wrap);

    // Center tap pad (single = place, double = dig)
    const pad = document.createElement('div');
    pad.id = 'place-pad';
    pad.className = 'no-look';
    pad.style.cssText = `
      position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);
      width:120px; height:120px; z-index:13; border-radius:12px;
      border:1px dashed rgba(255,255,255,.25);
      background:rgba(20,20,24,.15);
      touch-action: manipulation;
    `;
    document.body.appendChild(pad);

    let lastTap = 0;
    const DOUBLE_MS = 280;

    const handler = () => {
      const now = performance.now();
      if (now - lastTap < DOUBLE_MS) {
        this.removeOrDig();
        lastTap = 0;
      } else {
        this.place();
        lastTap = now;
      }
    };

    pad.addEventListener('touchend', (e)=>{ e.preventDefault(); handler(); }, { passive:false });
    pad.addEventListener('click',      (e)=>{ e.preventDefault(); handler(); });
  }

  /* ===================== MATERIALS ===================== */
  _makeMaterials() {
    const common = { metalness: 0.0, roughness: 1.0 };
    const sand = new THREE.MeshStandardMaterial({ color: 0xE1D7B9, metalness:0.0, roughness:0.95 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9, roughness: 0.35 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.05, roughness: 0.9 });
    const tarmac = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1, roughness: 0.95 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x99c7ff, metalness: 0.05, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 0.4
    });
    return { ...common, sand, metal, concrete, tarmac, glass };
  }

  /* ===================== PREVIEW ===================== */
  _makePreview() {
    const geo = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.25, depthWrite:false, depthTest:false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 9999;
    this.scene.add(mesh);
    return mesh;
  }

  _updatePreview(){
    const cell = this._currentPreviewCell();
    if (!cell || !this._inBounds(cell.x, cell.y, cell.z)) { this.preview.visible = false; return; }
    this.preview.visible = true;
    const yaw   = this.yawSteps   * (Math.PI / 4);
    const pitch = this.pitchSteps * (Math.PI / 4);
    this.preview.position.set(
      cell.x * this.tile + 0.5*this.tile,
      cell.y * this.tile + 0.5*this.tile,
      cell.z * this.tile + 0.5*this.tile
    );
    this.preview.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  /* ===================== WORLD HELPERS ===================== */
  _key(x,y,z){ return `${x},${y},${z}`; }
  _ckey(cx,cy,cz){ return `${cx},${cy},${cz}`; }

  _inBounds(x,y,z){
    return (
      x >= -this.maxXZ && x <= this.maxXZ &&
      z >= -this.maxXZ && z <= this.maxXZ &&
      y >= this.minY   && y <= this.maxY
    );
  }

  _floorDiv(n, s){ return (n>=0) ? Math.floor(n/s) : Math.floor((n - (s-1))/s); }

  _toChunkCoords(x,y,z){
    const cx = this._floorDiv(x, this.CX);
    const cy = this._floorDiv(y - this.minY, this.CY); // shift y so minY maps to 0
    const cz = this._floorDiv(z, this.CZ);
    return { cx, cy, cz };
  }

  _markVoxelAndNeighborsDirty(x,y,z){
    const dirs = [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const d of dirs){
      const vx = x + d[0], vy = y + d[1], vz = z + d[2];
      const { cx,cy,cz } = this._toChunkCoords(vx,vy,vz);
      const key = this._ckey(cx,cy,cz);
      this._dirtyQueue.add(key);
    }
  }

  _primeInitialChunks(){
    const cam = this.camera.position;
    const cc = this._toChunkCoords(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    const R = 4; // radius in chunks (9x9 around you)
    for (let dz=-R; dz<=R; dz++){
      for (let dx=-R; dx<=R; dx++){
        // cover ground cy that contains y≈0 and one above
        for (let dy=-1; dy<=1; dy++){
          const key = this._ckey(cc.cx+dx, Math.max(0,cc.cy+dy), cc.cz+dz);
          this._dirtyQueue.add(key);
        }
      }
    }
  }

  _processDirtyQueue(maxPerFrame=2){
    let count = 0;
    for (const key of this._dirtyQueue) {
      if (count >= maxPerFrame) break;
      this._dirtyQueue.delete(key);
      const [cxS,cyS,czS] = key.split(','); 
      this._buildChunk(parseInt(cxS), parseInt(cyS), parseInt(czS));
      count++;
    }
  }

  _hideLegacyTerrain(){
    const toHide = [];
    this.scene.traverse(o => { if (o?.userData?.__isTerrain) toHide.push(o); });
    toHide.forEach(o => o.visible = false);
  }

  /* ===================== TERRAIN FIELD ===================== */
  _noise(x, z) {
    // simple hash-noise (deterministic, cheap)
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2.0 - 1.0;
  }
  _heightAt(x, z) {
    const n = this._noise(x * this.NOISE_FREQ, z * this.NOISE_FREQ);
    return Math.round(n * this.NOISE_AMP); // integer surface
  }

  _terrainSolid(x,y,z){
    if (y < this.minY) return false;
    const h = this._heightAt(x, z); // around 0 ± ~2
    return (y <= h);
  }

  _solidAt(x,y,z){
    // placed overrides everything
    const k = this._key(x,y,z);
    if (this.placed.has(k)) return true;

    // terrain minus carved
    if (this.carved.has(k)) return false;
    return this._terrainSolid(x,y,z);
  }

  _typeAt(x,y,z){
    const k = this._key(x,y,z);
    if (this.placed.has(k)) return this.placed.get(k);
    if (this.carved.has(k)) return null;
    return this._terrainSolid(x,y,z) ? 'sand' : null;
  }

  /* ===================== PICKING (DDA) ===================== */
  _ddaPick() {
    const rc = _tmp.raycaster;
    rc.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const ro = rc.ray.origin.clone();
    const rd = rc.ray.direction.clone();

    // limit distance reasonably (world is 400×400)
    const maxT = 1200;

    // starting cell
    let x = Math.floor(ro.x);
    let y = Math.floor(ro.y);
    let z = Math.floor(ro.z);

    const stepX = rd.x > 0 ? 1 : (rd.x < 0 ? -1 : 0);
    const stepY = rd.y > 0 ? 1 : (rd.y < 0 ? -1 : 0);
    const stepZ = rd.z > 0 ? 1 : (rd.z < 0 ? -1 : 0);

    const txDelta = stepX !== 0 ? Math.abs(1 / rd.x) : Infinity;
    const tyDelta = stepY !== 0 ? Math.abs(1 / rd.y) : Infinity;
    const tzDelta = stepZ !== 0 ? Math.abs(1 / rd.z) : Infinity;

    const vx = x + (stepX > 0 ? 1 : 0);
    const vy = y + (stepY > 0 ? 1 : 0);
    const vz = z + (stepZ > 0 ? 1 : 0);

    let txMax = stepX !== 0 ? ((vx - ro.x) / rd.x) : Infinity;
    let tyMax = stepY !== 0 ? ((vy - ro.y) / rd.y) : Infinity;
    let tzMax = stepZ !== 0 ? ((vz - ro.z) / rd.z) : Infinity;

    let lastEmpty = { x, y, z };
    let traveled = 0;

    for (let i=0; i<this.maxDDASteps; i++) {
      if (this._inBounds(x,y,z)) {
        if (this._solidAt(x,y,z)) {
          return { block:{x,y,z}, lastEmpty };
        }
      }

      // step to next boundary
      if (txMax < tyMax) {
        if (txMax < tzMax) { x += stepX; traveled = txMax; txMax += txDelta; }
        else               { z += stepZ; traveled = tzMax; tzMax += tzDelta; }
      } else {
        if (tyMax < tzMax) { y += stepY; traveled = tyMax; tyMax += tyDelta; }
        else               { z += stepZ; traveled = tzMax; tzMax += tzDelta; }
      }
      lastEmpty = { x, y, z };
      if (traveled > maxT) break;
      if (!this._inBounds(x,y,z) && (Math.abs(x)>this.maxXZ+2 || Math.abs(z)>this.maxXZ+2 || y<this.minY-2 || y>this.maxY+2)) break;
    }
    return null;
  }

  _computePlacement(){
    const res = this._ddaPick();
    if (res && res.block) {
      return { placeGrid: { gx:res.lastEmpty.x, gy:res.lastEmpty.y, gz:res.lastEmpty.z } };
    }
    // fallback: snap to surface at ray forward up to 1200m; place at nearest integer cell in front
    const rc = _tmp.raycaster;
    rc.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const p = this.camera.position.clone().add(rc.ray.direction.clone().multiplyScalar(5));
    const gx = Math.round(p.x), gy = Math.round(p.y), gz = Math.round(p.z);
    return { placeGrid: { gx, gy, gz } };
  }

  _currentPreviewCell(){
    const res = this._ddaPick();
    if (res && res.block) return res.lastEmpty;
    const rc = _tmp.raycaster;
    rc.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const p = this.camera.position.clone().add(rc.ray.direction.clone().multiplyScalar(5));
    return { x:Math.round(p.x), y:Math.round(p.y), z:Math.round(p.z) };
  }

  /* ===================== CHUNK MESHING ===================== */
  _buildChunk(cx,cy,cz){
    // bounds in voxel coords
    const x0 = cx * this.CX;
    const y0 = this.minY + cy * this.CY;
    const z0 = cz * this.CZ;

    const x1 = x0 + this.CX;
    const y1 = y0 + this.CY;
    const z1 = z0 + this.CZ;

    // bail if out of horizontal world
    if (x0 > this.maxXZ || x1 < -this.maxXZ || z0 > this.maxXZ || z1 < -this.maxXZ) return;

    // collect faces by material id
    const buckets = new Map(); // typeId -> { positions, normals, uvs, indices }
    const ensure = (tid) => {
      if (!buckets.has(tid)) buckets.set(tid, { positions:[], normals:[], uvs:[], indices:[], vtx:0 });
      return buckets.get(tid);
    };

    const addFace = (tid, ax, ay, az, bx, by, bz, cx2, cy2, cz2, dx, dy, dz, nx, ny, nz) => {
      const b = ensure(tid);
      const base = b.vtx;
      b.positions.push(
        ax,ay,az,  bx,by,bz,  cx2,cy2,cz2,  dx,dy,dz
      );
      b.normals.push(
        nx,ny,nz,  nx,ny,nz,  nx,ny,nz,     nx,ny,nz
      );
      b.uvs.push(0,0, 1,0, 1,1, 0,1);
      b.indices.push(base, base+1, base+2, base, base+2, base+3);
      b.vtx += 4;
    };

    // Iterate cells; add faces where neighbor is empty
    for (let z=z0; z<z1; z++){
      for (let y=y0; y<y1; y++){
        for (let x=x0; x<x1; x++){
          const tid = this._typeAt(x,y,z);
          if (!tid) continue;

          // for each of 6 dirs, if neighbor not solid, emit a face
          // left (-X)
          if (!this._solidAt(x-1,y,z)) {
            addFace(tid,
              x,  y,  z+1,   x,  y+1, z+1,   x,  y+1, z,   x,  y,  z,
              -1, 0,  0
            );
          }
          // right (+X)
          if (!this._solidAt(x+1,y,z)) {
            addFace(tid,
              x+1,y,  z,   x+1,y+1, z,   x+1,y+1, z+1,   x+1,y,  z+1,
               1, 0,  0
            );
          }
          // bottom (-Y)
          if (!this._solidAt(x,y-1,z)) {
            addFace(tid,
              x,  y,  z,   x+1,y,  z,   x+1,y,  z+1,   x,  y,  z+1,
               0,-1,  0
            );
          }
          // top (+Y)
          if (!this._solidAt(x,y+1,z)) {
            addFace(tid,
              x,  y+1,  z+1,   x+1,y+1,  z+1,   x+1,y+1,  z,   x,  y+1,  z,
               0, 1,  0
            );
          }
          // back (-Z)
          if (!this._solidAt(x,y,z-1)) {
            addFace(tid,
              x+1, y, z,   x+1, y+1, z,   x, y+1, z,   x, y, z,
               0, 0, -1
            );
          }
          // front (+Z)
          if (!this._solidAt(x,y,z+1)) {
            addFace(tid,
              x, y, z+1,   x, y+1, z+1,   x+1, y+1, z+1,   x+1, y, z+1,
               0, 0, 1
            );
          }
        }
      }
    }

    // Create/replace chunk group
    const ckey = this._ckey(cx,cy,cz);
    let chunk = this.chunks.get(ckey);
    if (!chunk) {
      chunk = { group: new THREE.Group(), meshesByType: new Map(), cx,cy,cz };
      chunk.group.name = `chunk_${ckey}`;
      this.scene.add(chunk.group);
      this.chunks.set(ckey, chunk);
    }

    // Clear existing meshes
    for (const m of chunk.meshesByType.values()) {
      chunk.group.remove(m);
      m.geometry.dispose();
    }
    chunk.meshesByType.clear();

    // Build meshes per material bucket
    for (const [tid, data] of buckets.entries()) {
      if (data.vtx === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      g.setAttribute('normal',   new THREE.Float32BufferAttribute(data.normals,   3));
      g.setAttribute('uv',       new THREE.Float32BufferAttribute(data.uvs,       2));
      g.setIndex(data.indices);

      const mat = this._materialForType(tid);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true; // ok for chunky meshes
      chunk.group.add(mesh);
      chunk.meshesByType.set(tid, mesh);
    }
  }

  _materialForType(tid){
    switch(tid){
      case 'sand':     return this.materials.sand;
      case 'metal':    return this.materials.metal;
      case 'concrete': return this.materials.concrete;
      case 'tarmac':   return this.materials.tarmac;
      case 'glass':    return this.materials.glass;
      default:         return this.materials.concrete;
    }
  }

  /* ===================== HOTBAR UI ===================== */
  _buildHotbar() {
    const bar = document.createElement('div');
    bar.id = 'craft-hotbar';
    bar.style.cssText = `
      position:fixed; z-index:12; bottom:18px; left:50%; transform:translateX(-50%);
      height:68px; display:flex; gap:8px; padding:8px 10px;
      background:rgba(20,20,24,0.6); border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; backdrop-filter: blur(6px);
    `;

    // show only buildable types (skip 'sand')
    const buildables = this.types.filter(t=>!t.isTerrain);
    this.hotSlots = [];
    for (let i=0;i<buildables.length;i++){
      const t = buildables[i];
      const slot = document.createElement('div');
      slot.style.cssText = `
        flex:1; min-width:80px; height:52px; border-radius:8px;
        border:2px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:600; user-select:none; font-family: system-ui, sans-serif;
      `;
      slot.textContent = t.label;
      slot.dataset.type = t.id;
      slot.onclick = () => {
        this.selected = this.types.findIndex(tt=>tt.id===t.id);
        this._updateHotbar();
      };
      bar.appendChild(slot);
      this.hotSlots.push(slot);
    }
    document.body.appendChild(bar);
    this._layoutHotbar();
    this._updateHotbar();
  }

  _layoutHotbar() {
    const bar = document.getElementById('craft-hotbar');
    if (!bar) return;
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.width = Math.min(560, window.innerWidth - 40) + 'px';
  }

  _updateHotbar(){
    const buildables = this.types.filter(t=>!t.isTerrain);
    const current = this.types[this.selected].id;
    for (let i=0;i<this.hotSlots.length;i++){
      const el = this.hotSlots[i];
      const id = buildables[i].id;
      if (id === current) {
        el.style.borderColor = 'rgba(255,255,255,0.85)';
        el.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.25) inset';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.15)';
        el.style.boxShadow = 'none';
      }
    }
  }

  /* ===================== INTERNAL TEMP ===================== */
}

/* ------- shared temp ------- */
const _tmp = {
  raycaster: new THREE.Raycaster()
};
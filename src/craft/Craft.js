// src/craft/Craft.js
import * as THREE from 'three';

/**
 * CraftSystem (instanced voxels + DDA picking)
 * - Very light on draw calls: 1 InstancedMesh per block type, count grows as you build.
 * - Place/remove/dig; yaw/pitch 45° steps; hotbar; preview ghost.
 * - Bounds: x,z in [-200,200], y in [-30,3000].
 */
export class CraftSystem {
  constructor({ scene, camera, renderer, debuggerInstance }) {
    this.scene   = scene;
    this.camera  = camera;
    this.renderer= renderer;
    this.debugger = debuggerInstance;

    // World limits
    this.tile = 1.0;
    this.minY = -30;
    this.maxY = 3000;
    this.maxXZ = 200;

    // DDA limit
    this.maxDDASteps = 6000;

    // Rotation state (45° steps)
    this.yawSteps   = 0;
    this.pitchSteps = 0;

    // Materials & block types
    this.materials = this._makeMaterials();
    this.types = [
      { id:'metal',    label:'Metal',    mat:this.materials.metal    },
      { id:'concrete', label:'Concrete', mat:this.materials.concrete },
      { id:'tarmac',   label:'Tarmac',   mat:this.materials.tarmac   },
      { id:'glass',    label:'Glass',    mat:this.materials.glass    },
    ];

    // Instancing setup
    this.capacity = 10000; // per-type; bump later if needed
    this.meshes       = {};   // id -> InstancedMesh
    this.nextIndex    = {};   // id -> next fresh index
    this.free         = {};   // id -> stack<int>
    this.occupied     = {};   // id -> boolean[]
    this.lastActiveIx = {};   // id -> highest active+1
    this._initInstancing();

    // Sparse voxel map: "x,y,z" -> { typeId, index }
    this.vox = new Map();

    // Preview ghost cube
    this.preview = this._makePreview();

    // Hotbar UI
    this.selected = 0;
    this._buildHotbar();

    // Pick targets: only terrain (instances picked via DDA)
    this._terrainTargets = [];
    this._rebuildTerrainTargets();

    window.addEventListener('resize', ()=>this._layoutHotbar(), false);
  }

  /* ---------------- Public API (controller binds) ---------------- */
  selectNext(){ this.selected = (this.selected + 1) % this.types.length; this._updateHotbar(); }
  selectPrev(){ this.selected = (this.selected - 1 + this.types.length) % this.types.length; this._updateHotbar(); }
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
    if (this.vox.has(key)) return; // occupied

    const type = this.types[this.selected].id;
    const idx = this._allocIndex(type);
    const mesh = this.meshes[type];

    const yaw   = this.yawSteps   * (Math.PI / 4);
    const pitch = this.pitchSteps * (Math.PI / 4);

    const p = new THREE.Vector3(
      gx*this.tile + 0.5*this.tile,
      gy*this.tile + 0.5*this.tile,
      gz*this.tile + 0.5*this.tile
    );
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1,1,1));

    mesh.setMatrixAt(idx, m);
    mesh.instanceMatrix.needsUpdate = true;
    this._enableIndex(type, idx);

    this.vox.set(key, { typeId:type, index:idx });
  }

  removeOrDig() {
    const hit = this._ddaPick();
    if (hit && hit.block) {
      const { x, y, z } = hit.block;
      const info = this.vox.get(this._key(x,y,z));
      if (!info) return;
      this._freeIndex(info.typeId, info.index);
      this.vox.delete(this._key(x,y,z));
      return;
    }
    const cell = this._currentPreviewCell();
    if (!cell) return;
    const info = this.vox.get(this._key(cell.x, cell.y, cell.z));
    if (!info) return;
    this._freeIndex(info.typeId, info.index);
    this.vox.delete(this._key(cell.x, cell.y, cell.z));
  }

  update(dt) {
    this._updatePreview();
  }

  /* ---------------- Internals ---------------- */
  _makeMaterials() {
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9, roughness: 0.35 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.0, roughness: 0.9 });
    const tarmac = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1, roughness: 0.95 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x99c7ff, metalness: 0.05, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 0.4
    });
    return { metal, concrete, tarmac, glass };
  }

  _initInstancing() {
    const geo = new THREE.BoxGeometry(1,1,1);
    for (const t of this.types) {
      const imesh = new THREE.InstancedMesh(geo, t.mat, this.capacity);
      imesh.name = `vox_${t.id}`;
      imesh.castShadow = true; imesh.receiveShadow = true;
      imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      imesh.count = 0; // start drawing nothing
      this.scene.add(imesh);
      this.meshes[t.id] = imesh;
      this.nextIndex[t.id]    = 0;
      this.free[t.id]         = [];
      this.occupied[t.id]     = new Array(this.capacity).fill(false);
      this.lastActiveIx[t.id] = 0;
    }
  }

  _makePreview() {
    const geo = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.25, depthWrite:false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = true;
    mesh.renderOrder = 9999;
    this.scene.add(mesh);
    return mesh;
  }

  _rebuildTerrainTargets() {
    this._terrainTargets.length = 0;
    this.scene.traverse(o => {
      if (o?.userData?.__isTerrain) this._terrainTargets.push(o);
    });
  }

  _layoutHotbar() {
    const bar = document.getElementById('craft-hotbar');
    if (!bar) return;
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.width = Math.min(560, window.innerWidth - 40) + 'px';
  }

  _buildHotbar() {
    const bar = document.createElement('div');
    bar.id = 'craft-hotbar';
    bar.style.cssText = `
      position:fixed; z-index:12; bottom:18px;
      height:68px; display:flex; gap:8px; padding:8px 10px;
      background:rgba(20,20,24,0.6); border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; backdrop-filter: blur(6px);
    `;

    this.hotSlots = [];
    for (let i=0;i<this.types.length;i++){
      const t = this.types[i];
      const slot = document.createElement('div');
      slot.style.cssText = `
        flex:1; min-width:80px; height:52px; border-radius:8px;
        border:2px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:600; user-select:none; font-family: system-ui, sans-serif;
      `;
      slot.textContent = t.label;
      slot.dataset.type = t.id;
      bar.appendChild(slot);
      this.hotSlots.push(slot);
    }
    document.body.appendChild(bar);
    this._layoutHotbar();
    this._updateHotbar();
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

  _key(x,y,z){ return `${x},${y},${z}`; }

  _allocIndex(type){
    const free = this.free[type];
    if (free.length > 0) return free.pop();
    const idx = this.nextIndex[type]++;
    if (idx >= this.capacity) {
      this.debugger?.warn?.(`Instancing capacity reached for ${type} (${this.capacity}). Consider raising capacity.`, 'Craft');
      return this.capacity - 1; // clamp
    }
    return idx;
  }

  _enableIndex(type, idx){
    const im = this.meshes[type];
    this.occupied[type][idx] = true;
    if (idx + 1 > im.count) im.count = idx + 1;
    this.lastActiveIx[type] = Math.max(this.lastActiveIx[type], idx + 1);
  }

  _freeIndex(type, idx){
    // Hide instance by moving/scaling away
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(0, -9999, 0);
    const q = new THREE.Quaternion();
    m.compose(p, q.identity(), new THREE.Vector3(0,0,0));
    const im = this.meshes[type];
    im.setMatrixAt(idx, m);
    im.instanceMatrix.needsUpdate = true;

    // Mark free
    this.occupied[type][idx] = false;
    this.free[type].push(idx);

    // Shrink count if we removed the last drawn index
    if (idx === im.count - 1) {
      let newCount = im.count - 1;
      const occ = this.occupied[type];
      while (newCount > 0 && !occ[newCount - 1]) newCount--;
      im.count = newCount;
      this.lastActiveIx[type] = newCount;
    }
  }

  _inBounds(x,y,z){
    return (
      x >= -this.maxXZ && x <= this.maxXZ &&
      z >= -this.maxXZ && z <= this.maxXZ &&
      y >= this.minY   && y <= this.maxY
    );
  }

  /* ===== Voxel DDA picking ===== */
  _ddaPick() {
    // Ray from viewport center
    const ndc = new THREE.Vector2(0, 0);
    const raycaster = _tmp.raycaster;
    raycaster.setFromCamera(ndc, this.camera);
    const ro = raycaster.ray.origin.clone();
    const rd = raycaster.ray.direction.clone();

    // First, intersect terrain once to clamp far distance
    let maxT = 10000;
    const hitT = raycaster.intersectObjects(this._terrainTargets, true)[0];
    if (hitT) {
      const d = hitT.distance;
      maxT = Math.max(1, d + 3000);
    }

    // Convert to voxel coords
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
        const key = this._key(x,y,z);
        if (this.vox.has(key)) {
          return { block:{x,y,z}, lastEmpty };
        }
      }

      // Step to next voxel boundary
      if (txMax < tyMax) {
        if (txMax < tzMax) { x += stepX; lastEmpty = { x, y, z }; if (txMax > maxT) break; txMax += txDelta; }
        else               { z += stepZ; lastEmpty = { x, y, z }; if (tzMax > maxT) break; tzMax += tzDelta; }
      } else {
        if (tyMax < tzMax) { y += stepY; lastEmpty = { x, y, z }; if (tyMax > maxT) break; tyMax += tyDelta; }
        else               { z += stepZ; lastEmpty = { x, y, z }; if (tzMax > maxT) break; tzMax += tzDelta; }
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
    const rc = _tmp.raycaster;
    rc.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hit = rc.intersectObjects(this._terrainTargets, true)[0];
    if (!hit) return null;
    const gx = Math.floor(hit.point.x / this.tile);
    const gy = Math.floor(hit.point.y / this.tile) + 1;
    const gz = Math.floor(hit.point.z / this.tile);
    return { placeGrid: { gx, gy, gz } };
  }

  _currentPreviewCell(){
    const res = this._ddaPick();
    if (res && res.block) return res.lastEmpty;
    const rc = _tmp.raycaster;
    rc.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hit = rc.intersectObjects(this._terrainTargets, true)[0];
    if (!hit) return null;
    const gx = Math.floor(hit.point.x / this.tile);
    const gy = Math.floor(hit.point.y / this.tile) + 1;
    const gz = Math.floor(hit.point.z / this.tile);
    return { x:gx, y:gy, z:gz };
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
}

const _tmp = { raycaster: new THREE.Raycaster() };
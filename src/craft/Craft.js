// src/craft/Craft.js
import * as THREE from 'three';

/**
 * CraftSystem
 * - Hotbar UI (bottom)
 * - 4 block types: smooth metal, smooth concrete, tarmac, glass
 * - Instanced per block type (fast). Sparse voxel map with free-list.
 * - Place / remove / dig via center-screen ray.
 * - Rotations: yaw & pitch in 45° steps.
 * - Bounds: |x|,|z| <= 200; y in [-30, 3000]
 */
export class CraftSystem {
  constructor({ scene, camera, renderer, debuggerInstance }) {
    this.scene   = scene;
    this.camera  = camera;
    this.renderer= renderer;
    this.debugger = debuggerInstance;

    // Voxel grid settings
    this.tile = 1.0; // 1m cubes
    this.minY = -30;
    this.maxY = 3000;
    this.maxXZ = 200; // |x|,|z| <= 200

    // Raycast helpers
    this.raycaster = new THREE.Raycaster();
    this.rayDir = new THREE.Vector3();
    this.rayFrom = new THREE.Vector3();

    // Block rotation state (45° steps)
    this.yawSteps   = 0; // multiples of 45° (0..7)
    this.pitchSteps = 0; // multiples of 45° (0..7)

    // Materials
    this.materials = this._makeMaterials();

    // Instanced meshes per type
    this.types = [
      { id:'metal',    label:'Metal',    mat:this.materials.metal,    color:'#b8c2cc' },
      { id:'concrete', label:'Concrete', mat:this.materials.concrete, color:'#cfcfcf' },
      { id:'tarmac',   label:'Tarmac',   mat:this.materials.tarmac,   color:'#404040' },
      { id:'glass',    label:'Glass',    mat:this.materials.glass,    color:'#99c7ff' },
    ];
    this.meshes = {};  // id -> InstancedMesh
    this.capacity = 20000; // per type (adjustable)
    this._initInstancing();

    // Sparse voxel map: key "x,y,z" -> { typeId, index }
    this.vox = new Map();
    this.free = { metal:[], concrete:[], tarmac:[], glass:[] };
    this.nextIndex = { metal:0, concrete:0, tarmac:0, glass:0 };

    // Preview ghost
    this.preview = this._makePreview();

    // Hotbar UI
    this.selected = 0; // index into this.types
    this._buildHotbar();

    // Work list for ray targets (terrain + block meshes)
    this._rayTargets = [];
    this._rebuildRayTargets();

    window.addEventListener('resize', ()=>this._layoutHotbar(), false);
  }

  /* ---------- Public API for controller ---------- */
  selectNext(){ this.selected = (this.selected + 1) % this.types.length; this._updateHotbar(); }
  selectPrev(){ this.selected = (this.selected - 1 + this.types.length) % this.types.length; this._updateHotbar(); }
  yawStep(){   this.yawSteps   = (this.yawSteps + 1)   & 7; }
  pitchStep(){ this.pitchSteps = (this.pitchSteps + 1) & 7; }

  fly(deltaY){ // small camera lift/drop for A/B
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

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const s = new THREE.Vector3(1,1,1);
    const p = new THREE.Vector3(gx*this.tile + 0.5*this.tile, gy*this.tile + 0.5*this.tile, gz*this.tile + 0.5*this.tile);

    m.compose(p, q, s);
    mesh.setMatrixAt(idx, m);
    mesh.instanceMatrix.needsUpdate = true;

    this.vox.set(key, { typeId:type, index:idx });
  }

  removeOrDig() {
    // If aiming at a block: remove it.
    // Else (aiming at terrain): dig means remove block directly under preview cell if any.
    const hit = this._raycast();
    if (hit && hit.object && hit.instanceId !== undefined) {
      // We hit an instanced block; figure voxel & free it.
      const { grid } = this._hitToGrid(hit);
      const key = this._key(grid.x, grid.y, grid.z);
      const info = this.vox.get(key);
      if (!info) return;
      this._freeIndex(info.typeId, info.index);
      this.vox.delete(key);
      return;
    }

    // DIG under preview cell
    const cell = this._currentPreviewCell();
    if (!cell) return;
    const key = this._key(cell.x, cell.y, cell.z);
    const info = this.vox.get(key);
    if (!info) return;
    this._freeIndex(info.typeId, info.index);
    this.vox.delete(key);
  }

  update(dt) {
    // Update preview position each frame
    this._updatePreview();
  }

  /* ---------- Internals ---------- */
  _makeMaterials() {
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9, roughness: 0.35 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.0, roughness: 0.9 });
    const tarmac = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.1, roughness: 0.95 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x99c7ff, metalness: 0.05, roughness: 0.05,
      transparent: true, opacity: 0.35, envMapIntensity: 0.4
    });
    return { metal, concrete, tarmac, glass };
  }

  _initInstancing() {
    // Unit cube geometry (centered), scaled via matrix translate by +0.5 for grid cell alignment
    const geo = new THREE.BoxGeometry(1,1,1);
    geo.translate(0,0,0); // we'll position per-instance

    for (const t of this.types) {
      const imesh = new THREE.InstancedMesh(geo, t.mat, this.capacity);
      imesh.name = `vox_${t.id}`;
      imesh.castShadow = true; imesh.receiveShadow = true;
      imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(imesh);
      this.meshes[t.id] = imesh;
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

  _rebuildRayTargets() {
    this._rayTargets.length = 0;
    // terrain meshes
    this.scene.traverse(o => {
      if (o?.userData?.__isTerrain) this._rayTargets.push(o);
    });
    // instanced containers (so we can hit blocks)
    for (const t of this.types) this._rayTargets.push(this.meshes[t.id]);
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
      return this.capacity - 1; // clamp; will overwrite last
    }
    return idx;
  }

  _freeIndex(type, idx){
    // Hide instance by scaling to zero
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3(0, -9999, 0); // drop far below
    m.compose(p, q.identity(), new THREE.Vector3(0,0,0));
    this.meshes[type].setMatrixAt(idx, m);
    this.meshes[type].instanceMatrix.needsUpdate = true;
    this.free[type].push(idx);
  }

  _inBounds(x,y,z){
    return (
      x >= -this.maxXZ && x <= this.maxXZ &&
      z >= -this.maxXZ && z <= this.maxXZ &&
      y >= this.minY   && y <= this.maxY
    );
  }

  _raycast(){
    const cx = this.renderer.domElement.clientWidth  * 0.5;
    const cy = this.renderer.domElement.clientHeight * 0.5;
    const ndc = new THREE.Vector2(
      (cx / this.renderer.domElement.clientWidth)  * 2 - 1,
      -(cy / this.renderer.domElement.clientHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(this._rayTargets, true)[0];
  }

  _hitToGrid(hit){
    // Convert hit.point to grid coords
    const p = hit.point;
    // If we hit an instanced block face, we want the adjacent cell for placement
    let normal = hit.face?.normal?.clone() || new THREE.Vector3(0,1,0);
    // Transform normal by object matrix if needed
    if (hit.object.isInstancedMesh || hit.object.isMesh) {
      hit.object.updateMatrixWorld(true);
      normal.transformDirection(hit.object.matrixWorld);
    }
    normal.round(); // axis-aligned

    const grid = {
      x: Math.floor(p.x / this.tile),
      y: Math.floor(p.y / this.tile),
      z: Math.floor(p.z / this.tile),
    };
    return { grid, normal };
  }

  _computePlacement(){
    const hit = this._raycast();
    if (!hit) return null;

    const { grid, normal } = this._hitToGrid(hit);

    let place = { x:grid.x, y:grid.y, z:grid.z };
    // If we aimed at a block, place adjacent in normal direction.
    if (hit.object.isInstancedMesh) {
      place = { x:grid.x + normal.x, y:grid.y + normal.y, z:grid.z + normal.z };
    }

    return {
      placeGrid: { gx:place.x, gy:place.y, gz:place.z }
    };
  }

  _currentPreviewCell(){
    const hit = this._raycast();
    if (!hit) return null;
    const { grid, normal } = this._hitToGrid(hit);
    let cell = { x:grid.x, y:grid.y, z:grid.z };
    if (hit.object.isInstancedMesh) {
      cell = { x:grid.x + normal.x, y:grid.y + normal.y, z:grid.z + normal.z };
    }
    return this._inBounds(cell.x, cell.y, cell.z) ? cell : null;
  }

  _updatePreview(){
    const cell = this._currentPreviewCell();
    if (!cell) { this.preview.visible = false; return; }
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